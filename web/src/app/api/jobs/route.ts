import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessionExists, getSession } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import { computeMatchScore } from '@/lib/match-scoring';
import { matchesAnyCity } from '@/lib/city-filter';
import type { Job, JobInput, ResumeProfile } from '@/lib/types';
import { JOB_STATUSES } from '@/lib/types';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { session_code?: string; jobs?: JobInput[] };

    if (!body.session_code || !body.jobs || !Array.isArray(body.jobs)) {
      return NextResponse.json(
        { error: 'Missing required fields: session_code and jobs array' },
        { status: 400 }
      );
    }

    const { session_code, jobs } = body;

    if (jobs.length === 0) {
      return NextResponse.json({ inserted: 0, duplicates: 0 });
    }

    if (jobs.length > 500) {
      return NextResponse.json(
        { error: 'Maximum 500 jobs per request' },
        { status: 400 }
      );
    }

    const exists = await sessionExists(session_code);
    if (!exists) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    if (!(await checkRateLimit(`jobs:${session_code}`, 500, 3600000))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 500 jobs per session per hour.' },
        { status: 429 }
      );
    }

    const sql = getDb();
    let inserted = 0;
    let duplicates = 0;

    for (const job of jobs) {
      if (!job.title || !job.url || !job.source) {
        continue;
      }

      const title = sanitize(job.title, 500);
      const company = job.company ? sanitize(job.company, 500) : null;
      const location = job.location ? sanitize(job.location, 500) : null;
      const url = sanitize(job.url, 2000);
      const source = sanitize(job.source, 50);
      const salary = job.salary ? sanitize(job.salary, 255) : null;
      const description = job.description ? sanitize(job.description, 50000) : null;
      const posted_date = job.posted_date ? sanitize(job.posted_date, 255) : null;
      const job_type = job.job_type ? sanitize(job.job_type, 50) : null;
      const experience_level = job.experience_level ? sanitize(job.experience_level, 50) : null;
      const skills = job.skills ? sanitize(job.skills, 5000) : null;
      const benefits = job.benefits ? sanitize(job.benefits, 5000) : null;
      const relevance_score = typeof job.relevance_score === 'number' ? Math.min(Math.max(Math.round(job.relevance_score), 0), 100) : 0;
      const country = job.country ? sanitize(job.country, 100) : null;

      try {
        const result = await sql(
          `INSERT INTO jobs (session_code, title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (session_code, url) DO NOTHING
           RETURNING id`,
          [session_code, title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country]
        );
        if (result.length > 0) {
          inserted++;
        } else {
          duplicates++;
        }
      } catch {
        duplicates++;
      }
    }

    // Rate limit counter was already incremented by checkRateLimit

    // Auto-score newly inserted jobs against resume profile
    if (inserted > 0) {
      try {
        const [sessionRow] = await sql(
          'SELECT user_id, resume_skills AS session_resume FROM sessions WHERE code = $1',
          [session_code],
        );

        // Fallback chain: session.resume_skills → user.resume_skills
        let profile: ResumeProfile | null =
          (sessionRow?.session_resume as ResumeProfile | null) ?? null;

        if (!profile && sessionRow?.user_id) {
          const [userRow] = await sql(
            'SELECT resume_skills FROM users WHERE id = $1 AND resume_skills IS NOT NULL',
            [sessionRow.user_id],
          );
          if (userRow?.resume_skills) {
            profile = userRow.resume_skills as ResumeProfile;
          }
        }

        if (profile) {
          const unscoredJobs = await sql(
            'SELECT id, title, skills, description, experience_level FROM jobs WHERE session_code = $1 AND relevance_score = 0 AND duplicate_of IS NULL',
            [session_code],
          );
          for (const job of unscoredJobs) {
            const score = computeMatchScore(profile, {
              title: job.title,
              skills: job.skills,
              description: job.description,
              experience_level: job.experience_level,
            });
            if (score > 0) {
              await sql('UPDATE jobs SET relevance_score = $1 WHERE id = $2', [score, job.id]);
            }
          }
        }
      } catch (err) {
        // Non-critical — don't fail the insert response
        console.error('Auto-score error:', err);
      }
    }

    return NextResponse.json({ inserted, duplicates });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionCode = searchParams.get('session');
    const source = searchParams.get('source');
    const status = searchParams.get('status');

    if (!sessionCode) {
      return NextResponse.json(
        { error: 'Missing session parameter' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionCode);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    const sql = getDb();
    let query = 'SELECT * FROM jobs WHERE session_code = $1';
    const params: (string)[] = [sessionCode];
    let paramIndex = 2;

    if (source) {
      query += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (status && JOB_STATUSES.includes(status as Job['status'])) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY relevance_score DESC, scraped_at DESC';

    const rows = await sql(query, params);

    // Filter by city — drop jobs outside the user's chosen cities
    const effectiveLocations = session.locations ?? (session.location ? [session.location] : []);
    const jobs = effectiveLocations.length > 0
      ? (rows as Job[]).filter((job) => matchesAnyCity(job.location, effectiveLocations, session.remote))
      : (rows as Job[]);

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Jobs GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

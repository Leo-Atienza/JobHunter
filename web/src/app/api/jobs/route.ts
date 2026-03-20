import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessionExists } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import type { Job, JobInput } from '@/lib/types';
import { JOB_STATUSES } from '@/lib/types';

const jobRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkJobRateLimit(sessionCode: string, maxJobs = 500, windowMs = 3600000): boolean {
  const now = Date.now();
  const entry = jobRateLimitMap.get(sessionCode);

  if (!entry || now > entry.resetAt) {
    jobRateLimitMap.set(sessionCode, { count: 0, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxJobs) {
    return false;
  }

  return true;
}

function incrementJobCount(sessionCode: string, count: number) {
  const entry = jobRateLimitMap.get(sessionCode);
  if (entry) {
    entry.count += count;
  }
}

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

    if (!checkJobRateLimit(session_code)) {
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

    incrementJobCount(session_code, inserted);

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
    const session = searchParams.get('session');
    const source = searchParams.get('source');
    const status = searchParams.get('status');

    if (!session) {
      return NextResponse.json(
        { error: 'Missing session parameter' },
        { status: 400 }
      );
    }

    const exists = await sessionExists(session);
    if (!exists) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    const sql = getDb();
    let query = 'SELECT * FROM jobs WHERE session_code = $1';
    const params: (string)[] = [session];
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
    return NextResponse.json(rows as Job[]);
  } catch (error) {
    console.error('Jobs GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

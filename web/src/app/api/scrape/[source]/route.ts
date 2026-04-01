import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import { SERVER_SCRAPERS } from '@/lib/scrapers';
import type { ScrapeParams } from '@/lib/scrapers/types';
import type { JobInput, ResumeProfile } from '@/lib/types';
import { parseSalary } from '@/lib/salary-parser';
import { matchesCountry } from '@/lib/country-filter';
import { extractSkills, extractBenefits } from '@/lib/skills-extractor';
import { computeMatchScore } from '@/lib/match-scoring';

export const maxDuration = 60; // Vercel Pro; free tier caps at 10s

/**
 * POST /api/scrape/[source]
 * Scrapes a single source server-side and inserts results into the DB.
 * Body: { session_code: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  try {
    const { source } = await params;
    const body = await request.json() as { session_code?: string };

    if (!body.session_code) {
      return NextResponse.json({ error: 'Missing session_code' }, { status: 400 });
    }

    const scraperFn = SERVER_SCRAPERS[source];
    if (!scraperFn) {
      return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
    }

    const session = await getSession(body.session_code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const sql = getDb();

    // Build scrape params from session preferences
    const scrapeParams: ScrapeParams = {
      keywords: session.keywords ?? [],
      location: session.location ?? '',
      remote: session.remote ?? false,
      country: session.country ?? undefined,
    };

    // Run the scraper with timing
    const startMs = Date.now();
    const result = await scraperFn(scrapeParams);
    const durationMs = Date.now() - startMs;

    if (result.error) {
      // Log the error
      await logScrapeRun(sql, body.session_code, source, 'error', 0, 0, 0, result.error, durationMs);
      return NextResponse.json({
        source,
        inserted: 0,
        duplicates: 0,
        total: 0,
        error: result.error,
      });
    }

    // Filter jobs by country if session has a country preference
    const filteredJobs = session.country
      ? result.jobs.filter((job) => matchesCountry(job.location, job.country, session.country))
      : result.jobs;

    const filtered = result.jobs.length - filteredJobs.length;

    // Insert jobs into DB
    const { inserted, duplicates } = await insertJobs(body.session_code, filteredJobs);

    // Auto-score newly inserted jobs against resume profile
    if (inserted > 0) {
      try {
        // Fallback chain: session.resume_skills → user.resume_skills
        let resumeProfile: ResumeProfile | null =
          (session.resume_skills as ResumeProfile | null) ?? null;

        if (!resumeProfile && session.user_id) {
          const [userRow] = await sql(
            'SELECT resume_skills FROM users WHERE id = $1 AND resume_skills IS NOT NULL',
            [session.user_id],
          );
          if (userRow?.resume_skills) {
            resumeProfile = userRow.resume_skills as ResumeProfile;
          }
        }

        if (resumeProfile) {
          const unscoredJobs = await sql(
            'SELECT id, title, skills, description, experience_level FROM jobs WHERE session_code = $1 AND relevance_score = 0 AND duplicate_of IS NULL',
            [body.session_code],
          );
          for (const job of unscoredJobs) {
            const score = computeMatchScore(resumeProfile, {
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
        // Non-critical — don't fail the scrape response
        console.error('Auto-score error:', err);
      }
    }

    // Log success
    await logScrapeRun(sql, body.session_code, source, 'success', result.jobs.length, inserted, duplicates, null, durationMs);

    return NextResponse.json({
      source,
      inserted,
      duplicates,
      total: result.jobs.length,
      filtered,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/** Normalize title+company into a dedup key. */
function dedupKey(title: string, company: string | null): string {
  const t = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const c = (company ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  return `${t}::${c}`;
}

async function insertJobs(
  sessionCode: string,
  jobs: JobInput[],
): Promise<{ inserted: number; duplicates: number }> {
  const sql = getDb();
  let inserted = 0;
  let duplicates = 0;

  // Fetch existing jobs for cross-source dedup
  const existingRows = await sql(
    `SELECT id, title, company FROM jobs WHERE session_code = $1 AND duplicate_of IS NULL`,
    [sessionCode],
  );
  const existingKeys = new Map<string, number>();
  for (const row of existingRows) {
    existingKeys.set(dedupKey(row.title as string, row.company as string | null), row.id as number);
  }

  for (const job of jobs) {
    if (!job.title || !job.url || !job.source) continue;

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
    const skills = job.skills ? sanitize(job.skills, 5000) : extractSkills(description);
    const benefits = job.benefits ? sanitize(job.benefits, 5000) : extractBenefits(description);
    const relevance_score = typeof job.relevance_score === 'number'
      ? Math.min(Math.max(Math.round(job.relevance_score), 0), 100)
      : 0;
    const country = job.country ? sanitize(job.country, 100) : null;

    // Parse salary into min/max
    const { min: salaryMin, max: salaryMax } = parseSalary(salary);

    // Check cross-source dedup (same title+company = duplicate from another source)
    const key = dedupKey(title, company);
    const duplicateOfId = existingKeys.get(key) ?? null;

    try {
      const result = await sql(
        `INSERT INTO jobs (session_code, title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country, salary_min, salary_max, duplicate_of)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (session_code, url) DO NOTHING
         RETURNING id`,
        [sessionCode, title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country, salaryMin, salaryMax, duplicateOfId],
      );
      if (result.length > 0) {
        inserted++;
        // If this is not a duplicate, register it for future dedup checks
        if (!duplicateOfId) {
          existingKeys.set(key, result[0].id as number);
        }
      } else {
        duplicates++;
      }
    } catch {
      duplicates++;
    }
  }

  return { inserted, duplicates };
}

/** Persist a scraper run outcome for health monitoring. Fire-and-forget. */
async function logScrapeRun(
  sql: ReturnType<typeof getDb>,
  sessionCode: string,
  source: string,
  status: 'success' | 'error',
  jobsFound: number,
  jobsInserted: number,
  duplicates: number,
  errorMessage: string | null,
  durationMs: number,
) {
  try {
    await sql(
      `INSERT INTO scrape_logs (session_code, source, status, jobs_found, jobs_inserted, duplicates, error_message, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionCode, source, status, jobsFound, jobsInserted, duplicates, errorMessage, durationMs],
    );
  } catch {
    // Non-critical — don't let logging failures break scraping
  }
}

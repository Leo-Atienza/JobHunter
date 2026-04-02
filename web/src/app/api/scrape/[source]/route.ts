import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import { SERVER_SCRAPERS } from '@/lib/scrapers';
import type { ScrapeParams, ScrapeResult } from '@/lib/scrapers/types';
import type { JobInput, ResumeProfile } from '@/lib/types';
import { parseSalary } from '@/lib/salary-parser';
import { matchesCountry } from '@/lib/country-filter';
import { matchesCity, matchesAnyCity } from '@/lib/city-filter';
import { extractSkills, extractBenefits } from '@/lib/skills-extractor';
import { computeMatchScoreWithBreakdown } from '@/lib/match-scoring';
import { expandWithSynonyms } from '@/lib/synonyms';

export const maxDuration = 60; // Hobby default is 300s; 60s is plenty for any single scraper

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

    // Build effective locations (backward compat: synthesize from single location)
    const effectiveLocations = session.locations ?? (session.location ? [session.location] : []);

    // Expand keywords with synonyms — originals first, then synonyms fill the rest.
    // This ensures scrapers that slice(0, N) always see the user's actual keywords.
    const rawKeywords = session.keywords ?? [];
    const expandedSet = new Set<string>();
    for (const kw of rawKeywords) expandedSet.add(kw.toLowerCase().trim());
    for (const kw of rawKeywords) {
      for (const syn of expandWithSynonyms(kw)) {
        expandedSet.add(syn);
      }
    }
    const expandedKeywords = [...expandedSet].slice(0, 20);

    // Build base scrape params from session preferences
    const baseScrapeParams: ScrapeParams = {
      keywords: expandedKeywords,
      location: session.location ?? '',
      locations: effectiveLocations,
      remote: session.remote ?? false,
      country: session.country ?? undefined,
    };

    // Determine which locations to fan out to for this source.
    // Jobbank uses Apify ($0.25/run) — only scrape first location to conserve credits.
    const fanOutLocations = effectiveLocations.length > 0
      ? (source === 'jobbank' ? [effectiveLocations[0]] : effectiveLocations)
      : [''];

    // Run the scraper with timing, guarded by route-level timeout.
    const SCRAPER_TIMEOUT_MS = 55000;
    const startMs = Date.now();

    // Fan-out: call scraper once per city, merge results
    const cityResults = await Promise.race([
      Promise.allSettled(
        fanOutLocations.map((cityLocation) => {
          const cityParams: ScrapeParams = { ...baseScrapeParams, location: cityLocation };
          return scraperFn(cityParams);
        }),
      ),
      new Promise<PromiseSettledResult<ScrapeResult>[]>((resolve) =>
        setTimeout(
          () => resolve([{ status: 'rejected', reason: new Error('timeout') }]),
          SCRAPER_TIMEOUT_MS,
        ),
      ),
    ]);
    const durationMs = Date.now() - startMs;

    // Merge results from all cities
    const allJobs: JobInput[] = [];
    const errors: string[] = [];
    let totalCreditsUsed: number | null = null;
    for (const r of cityResults) {
      if (r.status === 'fulfilled') {
        if (r.value.error) errors.push(r.value.error);
        else allJobs.push(...r.value.jobs);
        if (r.value.credits_used != null) {
          totalCreditsUsed = (totalCreditsUsed ?? 0) + r.value.credits_used;
        }
      } else {
        errors.push(r.reason instanceof Error ? r.reason.message : 'Scraper failed');
      }
    }

    // If all cities failed, report error
    if (allJobs.length === 0 && errors.length > 0) {
      const errorMsg = errors[0] === 'timeout' ? 'Scraper timed out after 55s' : errors[0];
      await logScrapeRun(sql, body.session_code, source, 'error', 0, 0, 0, errorMsg, durationMs, totalCreditsUsed);
      return NextResponse.json({
        source,
        inserted: 0,
        duplicates: 0,
        total: 0,
        error: errorMsg,
      });
    }

    // Deduplicate by URL across cities
    const seenUrls = new Set<string>();
    const dedupedJobs = allJobs.filter((job) => {
      if (seenUrls.has(job.url)) return false;
      seenUrls.add(job.url);
      return true;
    });

    // Filter jobs by country if session has a country preference
    const countryFiltered = session.country
      ? dedupedJobs.filter((job) => matchesCountry(job.location, job.country, session.country))
      : dedupedJobs;

    // Filter jobs by city — match any of the session's cities
    const includeRemote = session.include_remote !== false;
    const filteredJobs = effectiveLocations.length > 0
      ? countryFiltered.filter((job) => matchesAnyCity(job.location, effectiveLocations, session.remote, includeRemote))
      : countryFiltered;

    const filtered = dedupedJobs.length - filteredJobs.length;

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
            const breakdown = computeMatchScoreWithBreakdown(resumeProfile, {
              title: job.title,
              skills: job.skills,
              description: job.description,
              experience_level: job.experience_level,
            });
            if (breakdown.total > 0) {
              await sql(
                'UPDATE jobs SET relevance_score = $1, score_breakdown = $2 WHERE id = $3',
                [breakdown.total, JSON.stringify(breakdown), job.id],
              );
            }
          }
        }
      } catch (err) {
        // Non-critical — don't fail the scrape response
        console.error('Auto-score error:', err);
      }
    }

    // Log success
    await logScrapeRun(sql, body.session_code, source, 'success', dedupedJobs.length, inserted, duplicates, null, durationMs, totalCreditsUsed);

    return NextResponse.json({
      source,
      inserted,
      duplicates,
      total: dedupedJobs.length,
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

  // Prepare all rows, then insert in parallel chunks for speed.
  // On Vercel Hobby (10s limit), sequential inserts of 50+ jobs can take 5s.
  const prepared = jobs
    .filter((job) => job.title && job.url && job.source)
    .map((job) => {
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
      const { min: salaryMin, max: salaryMax } = parseSalary(salary);
      const key = dedupKey(title, company);
      const duplicateOfId = existingKeys.get(key) ?? null;

      return { title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country, salaryMin, salaryMax, key, duplicateOfId };
    });

  // Insert in parallel chunks of 10
  const CHUNK_SIZE = 10;
  for (let i = 0; i < prepared.length; i += CHUNK_SIZE) {
    const chunk = prepared.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        const result = await sql(
          `INSERT INTO jobs (session_code, title, company, location, url, source, salary, description, posted_date, job_type, experience_level, skills, benefits, relevance_score, country, salary_min, salary_max, duplicate_of)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (session_code, url) DO NOTHING
           RETURNING id`,
          [sessionCode, row.title, row.company, row.location, row.url, row.source, row.salary, row.description, row.posted_date, row.job_type, row.experience_level, row.skills, row.benefits, row.relevance_score, row.country, row.salaryMin, row.salaryMax, row.duplicateOfId],
        );
        if (result.length > 0) {
          if (!row.duplicateOfId) {
            existingKeys.set(row.key, result[0].id as number);
          }
          return 'inserted' as const;
        }
        return 'duplicate' as const;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'inserted') inserted++;
        else duplicates++;
      } else {
        duplicates++;
      }
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
  creditsUsed: number | null = null,
) {
  try {
    await sql(
      `INSERT INTO scrape_logs (session_code, source, status, jobs_found, jobs_inserted, duplicates, error_message, duration_ms, credits_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sessionCode, source, status, jobsFound, jobsInserted, duplicates, errorMessage, durationMs, creditsUsed],
    );
  } catch {
    // Non-critical — don't let logging failures break scraping
  }
}

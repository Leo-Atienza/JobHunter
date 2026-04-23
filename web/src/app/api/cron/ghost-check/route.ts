import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const maxDuration = 60;

const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 5000;
const CONCURRENCY = 10;

/** Check a single URL — returns true if the job appears to be a ghost */
async function isGhostUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobHunter/1.0; link-checker)',
      },
    });

    clearTimeout(timeout);

    // 404, 410 Gone = definitely ghost
    // 403/401 might just be auth-walled, not ghost
    return res.status === 404 || res.status === 410;
  } catch {
    // Network error / timeout — could be temporary, don't mark as ghost on first fail
    // We'll catch it on the next run if it persists
    return false;
  }
}

/** Process URLs in batches with concurrency limit */
async function checkBatch(
  jobs: { id: number; url: string }[],
): Promise<{ id: number; isGhost: boolean }[]> {
  const results: { id: number; isGhost: boolean }[] = [];

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const chunk = jobs.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (job) => ({
        id: job.id,
        isGhost: await isGhostUrl(job.url),
      })),
    );
    results.push(...chunkResults);
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getDb();

    // Pick jobs that haven't been checked in 24h (or never checked)
    // Only check non-duplicate jobs from non-expired sessions
    const jobs = await sql(`
      SELECT j.id, j.url
      FROM jobs j
      JOIN sessions s ON j.session_code = s.code
      WHERE j.duplicate_of IS NULL
        AND s.expires_at > NOW()
        AND (j.ghost_checked_at IS NULL OR j.ghost_checked_at < NOW() - INTERVAL '24 hours')
      ORDER BY j.ghost_checked_at ASC NULLS FIRST
      LIMIT ${BATCH_SIZE}
    `);

    if (jobs.length === 0) {
      return NextResponse.json({ checked: 0, ghosts_found: 0, message: 'No jobs to check' });
    }

    const results = await checkBatch(jobs as { id: number; url: string }[]);

    // Update all checked jobs' timestamps
    const allIds = results.map((r) => r.id);
    const ghostIds = results.filter((r) => r.isGhost).map((r) => r.id);

    // Mark timestamp on all checked jobs
    if (allIds.length > 0) {
      await sql(`UPDATE jobs SET ghost_checked_at = NOW() WHERE id = ANY($1)`, [allIds]);
    }

    // Mark ghosts
    if (ghostIds.length > 0) {
      await sql(`UPDATE jobs SET is_ghost = true WHERE id = ANY($1)`, [ghostIds]);
    }

    // Un-ghost any that were previously ghost but now respond OK
    const revivedIds = results.filter((r) => !r.isGhost).map((r) => r.id);
    if (revivedIds.length > 0) {
      await sql(`UPDATE jobs SET is_ghost = false WHERE id = ANY($1) AND is_ghost = true`, [
        revivedIds,
      ]);
    }

    console.log(`Ghost check: checked ${results.length}, found ${ghostIds.length} ghosts`);

    return NextResponse.json({
      checked: results.length,
      ghosts_found: ghostIds.length,
      revived: revivedIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Ghost check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

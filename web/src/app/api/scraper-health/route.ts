import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * GET /api/scraper-health?days=7
 * Returns aggregate health metrics for each scraper source.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10) || 7, 1), 90);

    const sql = getDb();

    const rows = await sql(
      `SELECT
         source,
         COUNT(*)::int AS total_runs,
         COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
         COUNT(*) FILTER (WHERE status = 'error')::int AS error_count,
         COUNT(*) FILTER (WHERE status = 'success' AND jobs_found = 0)::int AS zero_result_count,
         ROUND(AVG(jobs_found) FILTER (WHERE status = 'success'))::int AS avg_jobs_found,
         ROUND(AVG(duration_ms))::int AS avg_duration_ms,
         MAX(scraped_at) AS last_run,
         (array_agg(error_message ORDER BY scraped_at DESC) FILTER (WHERE error_message IS NOT NULL))[1] AS last_error
       FROM scrape_logs
       WHERE scraped_at > NOW() - make_interval(days => $1)
       GROUP BY source
       ORDER BY source`,
      [days],
    );

    const sources: Record<string, unknown> = {};
    let totalRuns = 0;
    let totalSuccess = 0;

    for (const row of rows) {
      const src = row.source as string;
      const runs = row.total_runs as number;
      const successes = row.success_count as number;

      totalRuns += runs;
      totalSuccess += successes;

      sources[src] = {
        total_runs: runs,
        success_count: successes,
        error_count: row.error_count as number,
        zero_result_count: row.zero_result_count as number,
        avg_jobs_found: (row.avg_jobs_found as number) ?? 0,
        avg_duration_ms: (row.avg_duration_ms as number) ?? 0,
        last_run: row.last_run as string,
        last_error: (row.last_error as string) ?? null,
        success_rate: runs > 0 ? Math.round((successes / runs) * 100) : 0,
      };
    }

    return NextResponse.json({
      sources,
      overall: {
        total_runs: totalRuns,
        success_rate: totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0,
        sources_tracked: Object.keys(sources).length,
        days,
      },
    });
  } catch (error) {
    console.error('Scraper health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

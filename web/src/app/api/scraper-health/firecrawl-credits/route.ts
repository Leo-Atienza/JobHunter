import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const sql = getDb();
    const [row] = await sql(
      `SELECT
         COUNT(*)::int AS runs_this_month,
         COALESCE(SUM(credits_used), 0)::int AS actual_used,
         COUNT(*) FILTER (WHERE credits_used IS NULL)::int AS untracked_runs
       FROM scrape_logs
       WHERE source = 'firecrawl'
         AND scraped_at >= date_trunc('month', NOW())`,
    );

    const runsThisMonth = (row?.runs_this_month as number) ?? 0;
    const actualUsed = (row?.actual_used as number) ?? 0;
    const untrackedRuns = (row?.untracked_runs as number) ?? 0;
    // For pre-migration rows without credits_used, fall back to estimation
    const totalUsed = actualUsed + untrackedRuns * 15;
    const remaining = Math.max(0, 500 - totalUsed);
    const percentUsed = Math.min(100, Math.round((totalUsed / 500) * 100));

    return NextResponse.json({
      runs_this_month: runsThisMonth,
      credits_used: totalUsed,
      estimated_remaining: remaining,
      percent_used: percentUsed,
      monthly_limit: 500,
    });
  } catch (error) {
    console.error('Firecrawl credits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

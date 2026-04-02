import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const sql = getDb();
    const [row] = await sql(
      `SELECT COUNT(*)::int AS runs_this_month
       FROM scrape_logs
       WHERE source = 'firecrawl'
         AND scraped_at >= date_trunc('month', NOW())`
    );

    const runsThisMonth = (row?.runs_this_month as number) ?? 0;
    // ~5 credits per query (3 queries/run) = ~15 credits per run
    const estimatedUsed = runsThisMonth * 15;
    const estimatedRemaining = Math.max(0, 500 - estimatedUsed);
    const percentUsed = Math.min(100, Math.round((estimatedUsed / 500) * 100));

    return NextResponse.json({
      runs_this_month: runsThisMonth,
      estimated_used: estimatedUsed,
      estimated_remaining: estimatedRemaining,
      percent_used: percentUsed,
      monthly_limit: 500,
    });
  } catch (error) {
    console.error('Firecrawl credits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

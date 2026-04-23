import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const sql = getDb();
    const [row] = await sql(
      `SELECT COUNT(*)::int AS runs_this_month
       FROM scrape_logs
       WHERE source = 'jobbank'
         AND status = 'success'
         AND scraped_at >= date_trunc('month', NOW())`,
    );

    const MONTHLY_LIMIT = parseInt(process.env.APIFY_MONTHLY_LIMIT ?? '16', 10);
    const runsThisMonth = (row?.runs_this_month as number) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - runsThisMonth);
    const percentUsed = Math.min(100, Math.round((runsThisMonth / MONTHLY_LIMIT) * 100));

    return NextResponse.json({
      runs_this_month: runsThisMonth,
      remaining,
      monthly_limit: MONTHLY_LIMIT,
      percent_used: percentUsed,
      cost_per_run: 0.25,
      estimated_cost: runsThisMonth * 0.25,
      is_exhausted: remaining === 0,
    });
  } catch (error) {
    console.error('Apify credits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

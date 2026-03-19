import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessionExists } from '@/lib/session';
import type { JobStats } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get('session');

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

    const [totalResult, sourceResult, statusResult, lastUpdatedResult] = await Promise.all([
      sql('SELECT COUNT(*)::int as total FROM jobs WHERE session_code = $1', [session]),
      sql(
        'SELECT source, COUNT(*)::int as count FROM jobs WHERE session_code = $1 GROUP BY source ORDER BY count DESC',
        [session]
      ),
      sql(
        'SELECT status, COUNT(*)::int as count FROM jobs WHERE session_code = $1 GROUP BY status ORDER BY count DESC',
        [session]
      ),
      sql(
        'SELECT MAX(scraped_at) as last_updated FROM jobs WHERE session_code = $1',
        [session]
      ),
    ]);

    const by_source: Record<string, number> = {};
    for (const row of sourceResult) {
      by_source[row.source as string] = row.count as number;
    }

    const by_status: Record<string, number> = {};
    for (const row of statusResult) {
      by_status[row.status as string] = row.count as number;
    }

    const stats: JobStats = {
      total: (totalResult[0]?.total as number) ?? 0,
      by_source,
      by_status,
      last_updated: (lastUpdatedResult[0]?.last_updated as string) ?? null,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

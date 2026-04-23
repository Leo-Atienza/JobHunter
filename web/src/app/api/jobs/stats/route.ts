import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { cityFilterSQLMulti } from '@/lib/city-filter';
import type { JobStats } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get('session');

    if (!session) {
      return NextResponse.json({ error: 'Missing session parameter' }, { status: 400 });
    }

    const sessionData = await getSession(session);
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const sql = getDb();

    // Build city filter clause — applies to all stats queries (supports multi-city)
    const effectiveLocations =
      sessionData.locations ?? (sessionData.location ? [sessionData.location] : []);
    const includeRemote = sessionData.include_remote !== false;
    const { clause: cityClause, params: cityParams } = cityFilterSQLMulti(
      effectiveLocations,
      2,
      includeRemote,
    );
    const baseParams = [session, ...cityParams];

    const [
      totalResult,
      sourceResult,
      statusResult,
      lastUpdatedResult,
      salaryResult,
      ghostResult,
      matchResult,
    ] = await Promise.all([
      sql(
        `SELECT COUNT(*)::int as total FROM jobs WHERE session_code = $1${cityClause}`,
        baseParams,
      ),
      sql(
        `SELECT source, COUNT(*)::int as count FROM jobs WHERE session_code = $1${cityClause} GROUP BY source ORDER BY count DESC`,
        baseParams,
      ),
      sql(
        `SELECT status, COUNT(*)::int as count FROM jobs WHERE session_code = $1${cityClause} GROUP BY status ORDER BY count DESC`,
        baseParams,
      ),
      sql(
        `SELECT MAX(scraped_at) as last_updated FROM jobs WHERE session_code = $1${cityClause}`,
        baseParams,
      ),
      sql(
        `SELECT ROUND(AVG(salary_min))::int as avg_salary, COUNT(*)::int as with_salary FROM jobs WHERE session_code = $1${cityClause} AND salary_min IS NOT NULL`,
        baseParams,
      ),
      sql(
        `SELECT COUNT(*)::int as ghost_count FROM jobs WHERE session_code = $1${cityClause} AND is_ghost = true`,
        baseParams,
      ),
      sql(
        `SELECT ROUND(AVG(relevance_score))::int as avg_match FROM jobs WHERE session_code = $1${cityClause} AND relevance_score > 0`,
        baseParams,
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
      avg_salary: (salaryResult[0]?.avg_salary as number) ?? null,
      with_salary_count: (salaryResult[0]?.with_salary as number) ?? 0,
      ghost_count: (ghostResult[0]?.ghost_count as number) ?? 0,
      avg_match: (matchResult[0]?.avg_match as number) ?? null,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

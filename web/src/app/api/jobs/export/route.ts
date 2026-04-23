import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { cityFilterSQLMulti } from '@/lib/city-filter';
import { generateCsv } from '@/lib/utils';
import type { Job } from '@/lib/types';

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
    const effectiveLocations =
      sessionData.locations ?? (sessionData.location ? [sessionData.location] : []);
    const includeRemote = sessionData.include_remote !== false;
    const { clause: cityClause, params: cityParams } = cityFilterSQLMulti(
      effectiveLocations,
      2,
      includeRemote,
    );
    const rows = (await sql(
      `SELECT title, company, location, source, salary, posted_date, status, url, notes FROM jobs WHERE session_code = $1${cityClause} ORDER BY scraped_at DESC`,
      [session, ...cityParams],
    )) as Pick<
      Job,
      | 'title'
      | 'company'
      | 'location'
      | 'source'
      | 'salary'
      | 'posted_date'
      | 'status'
      | 'url'
      | 'notes'
    >[];

    const headers = [
      'Title',
      'Company',
      'Location',
      'Source',
      'Salary',
      'Posted Date',
      'Status',
      'URL',
      'Notes',
    ];
    const csvRows = rows.map((row) => [
      row.title ?? '',
      row.company ?? '',
      row.location ?? '',
      row.source ?? '',
      row.salary ?? '',
      row.posted_date ?? '',
      row.status ?? '',
      row.url ?? '',
      row.notes ?? '',
    ]);

    const csv = generateCsv(headers, csvRows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jobhunter-${session}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

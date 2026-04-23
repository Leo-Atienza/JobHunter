import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateCsv } from '@/lib/utils';
import type { Job } from '@/lib/types';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const rows = (await sql(
      `SELECT j.title, j.company, j.location, j.source, j.salary,
              j.posted_date, j.status, j.url, j.notes
       FROM jobs j
       JOIN sessions s ON j.session_code = s.code
       WHERE s.user_id = $1
         AND j.status NOT IN ('new', 'dismissed')
         AND j.duplicate_of IS NULL
       ORDER BY j.status_changed_at DESC NULLS LAST, j.scraped_at DESC
       LIMIT 500`,
      [session.user.id],
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
        'Content-Disposition': 'attachment; filename="jobhunter-tracker.csv"',
      },
    });
  } catch (error) {
    console.error('Saved jobs export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sql = getDb();
  const jobs = await sql(
    `SELECT j.*, s.keywords as session_keywords
     FROM jobs j
     JOIN sessions s ON j.session_code = s.code
     WHERE s.user_id = $1
       AND j.status NOT IN ('new', 'dismissed')
       AND j.duplicate_of IS NULL
     ORDER BY j.status_changed_at DESC NULLS LAST, j.scraped_at DESC
     LIMIT 500`,
    [session.user.id],
  );

  return NextResponse.json({ jobs });
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ sessions: [] });
  }

  const sql = getDb();
  const rows = await sql(
    `SELECT s.code, s.keywords, s.created_at, s.expires_at,
            (SELECT COUNT(*) FROM jobs WHERE session_code = s.code AND duplicate_of IS NULL) as job_count
     FROM sessions s
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 20`,
    [session.user.id],
  );

  return NextResponse.json({ sessions: rows });
}

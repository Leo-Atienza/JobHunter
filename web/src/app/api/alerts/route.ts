import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { isValidCodeFormat, isSessionOwner } from '@/lib/session';
import { isAlertsEnabled, makeUnsubscribeToken } from '@/lib/email/alerts-digest';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const sql = getDb();
  const alerts = await sql(
    `SELECT a.id, a.session_code, a.frequency, a.enabled, a.last_sent_at, a.created_at,
            s.keywords, s.locations
     FROM job_alerts a
     JOIN sessions s ON a.session_code = s.code
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [session.user.id],
  );

  return NextResponse.json({ alerts });
}

export async function POST(request: NextRequest) {
  if (!isAlertsEnabled()) {
    return NextResponse.json({ error: 'Alerts not yet enabled' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { session_code?: string } | null;
  const code = body?.session_code;

  if (!code || !isValidCodeFormat(code)) {
    return NextResponse.json({ error: 'Invalid session_code' }, { status: 400 });
  }

  const allowed = await isSessionOwner(code, session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: 'Session not found or not owned' }, { status: 404 });
  }

  const sql = getDb();
  const token = makeUnsubscribeToken();

  // Idempotent: if an alert already exists for this session, re-enable it and return.
  const rows = await sql(
    `INSERT INTO job_alerts (session_code, user_id, unsubscribe_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_code) DO UPDATE
       SET enabled = true
     RETURNING id, session_code, enabled, unsubscribe_token`,
    [code, session.user.id, token],
  );

  return NextResponse.json({ alert: rows[0] });
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const alertId = parseInt(id, 10);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return NextResponse.json({ error: 'Invalid alert id' }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql('DELETE FROM job_alerts WHERE id = $1 AND user_id = $2 RETURNING id', [
    alertId,
    session.user.id,
  ]);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}

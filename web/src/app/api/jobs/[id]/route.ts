import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sanitize } from '@/lib/utils';
import { JOB_STATUSES } from '@/lib/types';
import type { JobStatus } from '@/lib/types';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const sessionCode = request.headers.get('x-session-code');
    if (!sessionCode) {
      return NextResponse.json({ error: 'Missing session code' }, { status: 403 });
    }

    const sql = getDb();
    const jobOwnership = await sql('SELECT session_code FROM jobs WHERE id = $1', [jobId]);
    if (jobOwnership.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (jobOwnership[0].session_code !== sessionCode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = (await request.json()) as { status?: string; notes?: string };
    const updates: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (body.status !== undefined) {
      if (!JOB_STATUSES.includes(body.status as JobStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${JOB_STATUSES.join(', ')}` },
          { status: 400 },
        );
      }
      updates.push(`status = $${paramIndex}`);
      values.push(body.status);
      paramIndex++;
      updates.push(`status_changed_at = NOW()`);
    }

    if (body.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(sanitize(body.notes, 5000));
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(jobId);
    const result = await sql(
      `UPDATE jobs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Job PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

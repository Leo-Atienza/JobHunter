import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { computeMatchScoreWithBreakdown } from '@/lib/match-scoring';
import type { ResumeProfile } from '@/lib/types';

export const maxDuration = 60;

/**
 * POST /api/jobs/backfill-scores
 * Re-scores all jobs in a session that have a relevance_score but no score_breakdown.
 * Body: { session_code: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { session_code?: string };

    if (!body.session_code) {
      return NextResponse.json({ error: 'Missing session_code' }, { status: 400 });
    }

    const session = await getSession(body.session_code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const sql = getDb();

    // Resolve resume profile: session → user fallback
    let resumeProfile: ResumeProfile | null =
      (session.resume_skills as ResumeProfile | null) ?? null;

    if (!resumeProfile && session.user_id) {
      const [userRow] = await sql(
        'SELECT resume_skills FROM users WHERE id = $1 AND resume_skills IS NOT NULL',
        [session.user_id],
      );
      if (userRow?.resume_skills) {
        resumeProfile = userRow.resume_skills as ResumeProfile;
      }
    }

    if (!resumeProfile) {
      return NextResponse.json({ error: 'No resume profile found for this session' }, { status: 400 });
    }

    // Find jobs that need backfill, capped at 200 per call to stay within timeout
    const BATCH_LIMIT = 200;
    const unscoredJobs = await sql(
      `SELECT id, title, skills, description, experience_level
       FROM jobs
       WHERE session_code = $1 AND score_breakdown IS NULL AND duplicate_of IS NULL
       LIMIT $2`,
      [body.session_code, BATCH_LIMIT],
    );

    // Count total remaining for the response
    const [{ count: remainingCount }] = await sql(
      `SELECT COUNT(*)::int AS count FROM jobs
       WHERE session_code = $1 AND score_breakdown IS NULL AND duplicate_of IS NULL`,
      [body.session_code],
    );

    let updated = 0;
    for (const job of unscoredJobs) {
      const breakdown = computeMatchScoreWithBreakdown(resumeProfile, {
        title: job.title,
        skills: job.skills,
        description: job.description,
        experience_level: job.experience_level,
      });
      await sql(
        'UPDATE jobs SET relevance_score = $1, score_breakdown = $2 WHERE id = $3',
        [breakdown.total, JSON.stringify(breakdown), job.id],
      );
      updated++;
    }

    const remaining = (remainingCount as number) - updated;
    return NextResponse.json({ updated, remaining });
  } catch (error) {
    console.error('Backfill scores error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

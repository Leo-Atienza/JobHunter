import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { scoreDreamMatch } from '@/lib/dream-match';
import type { JobForScoring } from '@/lib/dream-match';

export const maxDuration = 60;

/**
 * POST /api/jobs/dream-score
 * Scores all jobs in a session against the session's dream job description.
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

    if (!session.dream_job?.trim()) {
      return NextResponse.json({ error: 'No dream job description set for this session' }, { status: 400 });
    }

    const sql = getDb();

    // Fetch all non-duplicate jobs for scoring
    const rows = await sql(
      `SELECT id, title, company, description, location, skills, job_type, experience_level
       FROM jobs
       WHERE session_code = $1 AND duplicate_of IS NULL
       ORDER BY id`,
      [body.session_code],
    );

    if (rows.length === 0) {
      return NextResponse.json({ scored: 0 });
    }

    const jobs: JobForScoring[] = rows.map((row) => ({
      id: row.id as number,
      title: row.title as string,
      company: row.company as string | null,
      description: row.description as string | null,
      location: row.location as string | null,
      skills: row.skills as string | null,
      job_type: row.job_type as string | null,
      experience_level: row.experience_level as string | null,
    }));

    // Score all jobs against the dream description
    const scores = await scoreDreamMatch(session.dream_job, jobs);

    // Update dream_score in DB + recompute composite relevance_score
    let scored = 0;
    for (const score of scores) {
      try {
        await sql(
          `UPDATE jobs
           SET dream_score = $1,
               relevance_score = CASE
                 WHEN relevance_score > 0
                   THEN ROUND(0.4 * relevance_score + 0.6 * $1)::int
                 ELSE $1
               END
           WHERE id = $2`,
          [score.score, score.id],
        );
        scored++;
      } catch {
        // Non-critical — skip individual failures
      }
    }

    return NextResponse.json({ scored, total: rows.length });
  } catch (error) {
    console.error('Dream score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sessionExists } from '@/lib/session';
import { computeMatchScore } from '@/lib/match-scoring';
import { extractResumeSkills } from '@/lib/resume-extract';
import type { ResumeProfile } from '@/lib/types';

/**
 * POST /api/user/resume
 * Extract skills from resume text via Gemini, save profile, score all jobs.
 * Works for both authenticated (saves to users + sessions) and anonymous (saves to sessions only).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;

    const body = (await request.json()) as {
      text?: string;
      session_code?: string;
      filename?: string;
    };

    if (!body.text || body.text.trim().length < 100) {
      return NextResponse.json(
        { error: 'Resume text too short. Please upload a valid PDF resume.' },
        { status: 400 },
      );
    }

    if (!body.session_code) {
      return NextResponse.json({ error: 'Missing session_code' }, { status: 400 });
    }

    const exists = await sessionExists(body.session_code);
    if (!exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Extract skills with Gemini
    const resumeText = body.text.slice(0, 8000);
    let profile: ResumeProfile;
    try {
      profile = await extractResumeSkills(resumeText);
    } catch {
      return NextResponse.json({ error: 'Failed to extract skills from resume' }, { status: 500 });
    }

    if (profile.skills.length === 0) {
      return NextResponse.json(
        { error: 'No skills could be extracted. Try a different resume format.' },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Save to user table if authenticated
    if (userId) {
      await sql(
        `UPDATE users
         SET resume_skills = $1, resume_filename = $2, resume_updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(profile), body.filename ?? null, userId],
      );
    }

    // Always save to session for immediate scoring
    await sql(
      'UPDATE sessions SET resume_skills = $1 WHERE code = $2',
      [JSON.stringify(profile), body.session_code],
    );

    // Batch-score all jobs in this session
    const jobs = await sql(
      'SELECT id, title, skills, description, experience_level FROM jobs WHERE session_code = $1 AND duplicate_of IS NULL',
      [body.session_code],
    );

    let scored = 0;
    for (const job of jobs) {
      const score = computeMatchScore(profile, {
        title: job.title,
        skills: job.skills,
        description: job.description,
        experience_level: job.experience_level,
      });

      if (score > 0) {
        await sql('UPDATE jobs SET relevance_score = $1 WHERE id = $2', [score, job.id]);
        scored++;
      }
    }

    return NextResponse.json({ profile, jobs_scored: scored });
  } catch (error) {
    console.error('Resume extract error:', error);
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
  }
}

/**
 * GET /api/user/resume
 * Retrieve the user's stored resume profile.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ profile: null, filename: null, updated_at: null });
    }

    const sql = getDb();
    const [user] = await sql(
      'SELECT resume_skills, resume_filename, resume_updated_at FROM users WHERE id = $1',
      [session.user.id],
    );

    if (!user?.resume_skills) {
      return NextResponse.json({ profile: null, filename: null, updated_at: null });
    }

    return NextResponse.json({
      profile: user.resume_skills as ResumeProfile,
      filename: user.resume_filename,
      updated_at: user.resume_updated_at,
    });
  } catch (error) {
    console.error('Resume GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/resume
 * Remove resume and reset job scores.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;

    const { searchParams } = new URL(request.url);
    const sessionCode = searchParams.get('session');

    const sql = getDb();

    // Clear resume from user if authenticated
    if (userId) {
      await sql(
        'UPDATE users SET resume_skills = NULL, resume_filename = NULL, resume_updated_at = NULL WHERE id = $1',
        [userId],
      );
    }

    // Clear from session and reset scores
    if (sessionCode) {
      await sql('UPDATE sessions SET resume_skills = NULL WHERE code = $1', [sessionCode]);
      await sql('UPDATE jobs SET relevance_score = 0 WHERE session_code = $1', [sessionCode]);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Resume DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}

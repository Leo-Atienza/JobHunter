import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sessionExists } from '@/lib/session';
import { computeMatchScore } from '@/lib/match-scoring';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ResumeProfile } from '@/lib/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * POST /api/user/resume
 * Extract skills from resume text via Gemini, save to users table, score all jobs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
    }

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

    // Truncate to 8000 chars for Gemini input budget
    const resumeText = body.text.slice(0, 8000);

    // Extract skills with Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Extract structured information from this resume text. Return ONLY valid JSON with these fields:
- "skills": string[] (technical and soft skills, lowercased, max 50 items)
- "experience_years": number | null (estimated total years of professional experience)
- "titles": string[] (job titles the person has held, max 10)
- "summary": string (one-sentence professional summary)

Do NOT include any markdown formatting, code blocks, or extra text. Return ONLY the JSON object.

Resume text:
${resumeText}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Parse Gemini response — strip markdown code fences if present
    const jsonStr = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let profile: ResumeProfile;
    try {
      const parsed = JSON.parse(jsonStr);
      profile = {
        skills: Array.isArray(parsed.skills)
          ? parsed.skills.filter((s: unknown) => typeof s === 'string').slice(0, 50)
          : [],
        experience_years:
          typeof parsed.experience_years === 'number' ? parsed.experience_years : null,
        titles: Array.isArray(parsed.titles)
          ? parsed.titles.filter((t: unknown) => typeof t === 'string').slice(0, 10)
          : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };
    } catch {
      console.error('Failed to parse Gemini response:', responseText.slice(0, 200));
      return NextResponse.json({ error: 'Failed to extract skills from resume' }, { status: 500 });
    }

    if (profile.skills.length === 0) {
      return NextResponse.json(
        { error: 'No skills could be extracted. Try a different resume format.' },
        { status: 400 },
      );
    }

    // Save to users table
    const sql = getDb();
    await sql(
      `UPDATE users
       SET resume_skills = $1, resume_filename = $2, resume_updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(profile), body.filename ?? null, session.user.id],
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
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionCode = searchParams.get('session');

    const sql = getDb();

    // Clear resume from user
    await sql(
      'UPDATE users SET resume_skills = NULL, resume_filename = NULL, resume_updated_at = NULL WHERE id = $1',
      [session.user.id],
    );

    // Reset scores for the current session if provided
    if (sessionCode) {
      await sql('UPDATE jobs SET relevance_score = 0 WHERE session_code = $1', [sessionCode]);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Resume DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}

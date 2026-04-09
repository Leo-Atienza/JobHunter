import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isSessionOwner } from '@/lib/session';
import { auth } from '@/lib/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI summaries not configured' }, { status: 503 });
    }

    const sql = getDb();

    // Check if summary already exists
    const [job] = await sql(
      'SELECT id, title, company, location, description, salary, job_type, experience_level, skills, ai_summary, session_code FROM jobs WHERE id = $1',
      [jobId],
    );

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify caller owns the session that contains this job
    const authSession = await auth().catch(() => null);
    const userId = authSession?.user?.id ?? null;
    const allowed = await isSessionOwner(job.session_code as string, userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Return cached summary if available
    if (job.ai_summary) {
      return NextResponse.json({ summary: job.ai_summary });
    }

    // Need a description to summarize
    if (!job.description) {
      return NextResponse.json({ error: 'No description to summarize' }, { status: 400 });
    }

    // Generate summary with Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Truncate description to avoid token waste
    const desc = (job.description as string).slice(0, 3000);

    const prompt = `Summarize this job listing in 2-3 concise sentences. Focus on: what the role does, key requirements, and any standout benefits or compensation. Be direct and factual.

Title: ${job.title}
Company: ${job.company ?? 'Unknown'}
Location: ${job.location ?? 'Not specified'}
Salary: ${job.salary ?? 'Not listed'}
Type: ${job.job_type ?? 'Not specified'}
Level: ${job.experience_level ?? 'Not specified'}
Skills: ${job.skills ?? 'Not specified'}

Description:
${desc}`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    // Cache the summary
    await sql('UPDATE jobs SET ai_summary = $1 WHERE id = $2', [summary, jobId]);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

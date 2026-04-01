/**
 * Dream Job AI Matching — scores jobs against a natural language dream job description.
 * Uses Gemini 2.0 Flash (free tier: 1500 req/day, 15 RPM).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BATCH_SIZE = 20;
const MAX_CONCURRENT_BATCHES = 2;

export interface JobForScoring {
  id: number;
  title: string;
  company: string | null;
  description: string | null;
  location: string | null;
  skills: string | null;
  job_type: string | null;
  experience_level: string | null;
}

export interface DreamScoreResult {
  id: number;
  score: number;
  reason: string;
}

/**
 * Score a batch of jobs against a dream job description using Gemini.
 * Returns scores (0-100) with one-line match reasons.
 */
export async function scoreDreamMatch(
  dreamJob: string,
  jobs: JobForScoring[],
): Promise<DreamScoreResult[]> {
  if (!GEMINI_API_KEY || !dreamJob.trim() || jobs.length === 0) return [];

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const results: DreamScoreResult[] = [];
  const batches: JobForScoring[][] = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  // Process batches with limited concurrency to stay within Gemini rate limits
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    const batchResults = await Promise.allSettled(
      concurrentBatches.map((batch) => scoreBatch(model, dreamJob, batch)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
      // Skip failed batches — partial results are better than none
    }
  }

  return results;
}

async function scoreBatch(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  dreamJob: string,
  batch: JobForScoring[],
): Promise<DreamScoreResult[]> {
  const jobSummaries = batch
    .map(
      (j, idx) =>
        `[${idx}] "${j.title}" at ${j.company ?? 'Unknown'} | ${j.location ?? 'Unknown'} | ${j.job_type ?? 'N/A'} | ${j.experience_level ?? 'N/A'} | Skills: ${j.skills?.slice(0, 200) ?? 'N/A'} | ${j.description?.slice(0, 300) ?? 'No description'}`,
    )
    .join('\n');

  const prompt = `You are an expert job matching AI. Score how well each job matches this candidate's dream job description.

Dream job: "${dreamJob}"

Jobs to score:
${jobSummaries}

Return ONLY a JSON array with no extra text. Each element: {"index": <number>, "score": <0-100>, "reason": "<one sentence>"}

Scoring guide:
- 85-100: Excellent match — role, skills, company type, and preferences align closely
- 70-84: Strong match — most criteria met with minor gaps
- 50-69: Partial match — some relevant aspects but notable mismatches
- 25-49: Weak match — few matching criteria
- 0-24: Poor match — fundamentally different from what the candidate wants

Consider: role type, required skills, company culture/size, location preferences, seniority level, work-life balance signals, compensation signals, and industry fit.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();
  const jsonStr = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

  let parsed: { index: number; score: number; reason: string }[];
  try {
    const raw = JSON.parse(jsonStr);
    parsed = Array.isArray(raw) ? raw : [];
  } catch {
    console.error('Dream match: failed to parse Gemini response');
    return [];
  }

  const results: DreamScoreResult[] = [];
  for (const entry of parsed) {
    if (typeof entry.index === 'number' && batch[entry.index]) {
      results.push({
        id: batch[entry.index].id,
        score: Math.min(100, Math.max(0, Math.round(entry.score))),
        reason: (entry.reason ?? '').slice(0, 500),
      });
    }
  }

  return results;
}

/**
 * Shared resume skill extraction via Gemini 2.0 Flash.
 * Used by both session creation (anonymous) and user/resume (authenticated).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ResumeProfile } from './types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function extractResumeSkills(resumeText: string): Promise<ResumeProfile> {
  if (!GEMINI_API_KEY) throw new Error('AI features not configured');

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
  const jsonStr = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

  const parsed = JSON.parse(jsonStr);
  return {
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
}

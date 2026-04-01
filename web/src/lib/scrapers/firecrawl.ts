import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { matchesKeywords, normalizeJobType, parseDate } from './utils';
import Firecrawl from '@mendable/firecrawl-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const BATCH_SIZE = 3;
const MAX_URLS = 10;
const MAX_MARKDOWN_LENGTH = 12000;
const MIN_MARKDOWN_LENGTH = 200;

interface ParsedJob {
  title?: string;
  company?: string | null;
  location?: string | null;
  url?: string | null;
  salary?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  description?: string | null;
  posted_date?: string | null;
}

/**
 * Scrape arbitrary career page URLs using Firecrawl + Gemini parsing.
 * Uses /scrape (1 credit/page) + Gemini to extract structured job data from markdown.
 */
export async function scrapeFirecrawl(params: ScrapeParams): Promise<ScrapeResult> {
  const urls = (params.config?.firecrawl_urls as string[]) ?? [];

  // Silent skip if no URLs configured (not an error — user just didn't add any)
  if (urls.length === 0) {
    return { source: 'firecrawl', jobs: [] };
  }

  if (!FIRECRAWL_API_KEY) {
    return { source: 'firecrawl', jobs: [], error: 'Firecrawl API key not configured' };
  }

  if (!GEMINI_API_KEY) {
    return { source: 'firecrawl', jobs: [], error: 'AI features not configured' };
  }

  const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const allJobs: JobInput[] = [];
  const errors: string[] = [];
  const cappedUrls = urls.slice(0, MAX_URLS);

  // Process URLs in batches to respect rate limits and Vercel timeout
  for (let i = 0; i < cappedUrls.length; i += BATCH_SIZE) {
    const batch = cappedUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((url) => scrapeAndParsePage(firecrawl, model, url, params))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.error) {
          errors.push(result.value.error);
        }
        allJobs.push(...result.value.jobs);
      } else {
        errors.push(result.reason?.message ?? 'Unknown error');
      }
    }
  }

  return {
    source: 'firecrawl',
    jobs: allJobs,
    error: errors.length > 0 && allJobs.length === 0 ? errors.join('; ') : undefined,
  };
}

/** Scrape a single page and parse jobs from its markdown content. */
async function scrapeAndParsePage(
  firecrawl: Firecrawl,
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  url: string,
  params: ScrapeParams,
): Promise<{ jobs: JobInput[]; error?: string }> {
  try {
    // Scrape the page (1 credit)
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    const markdown = scrapeResult.markdown ?? '';

    if (markdown.length < MIN_MARKDOWN_LENGTH) {
      return { jobs: [], error: `${getDomain(url)}: page too short or blocked` };
    }

    // Parse jobs from markdown using Gemini
    const jobs = await parseJobsFromMarkdown(model, markdown, url, params);
    return { jobs };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Handle specific Firecrawl errors gracefully
    if (message.includes('402') || message.includes('payment')) {
      return { jobs: [], error: 'Firecrawl free credits exhausted' };
    }
    return { jobs: [], error: `${getDomain(url)}: ${message}` };
  }
}

/** Use Gemini to extract structured job data from page markdown. */
async function parseJobsFromMarkdown(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  markdown: string,
  sourceUrl: string,
  params: ScrapeParams,
): Promise<JobInput[]> {
  const truncatedMarkdown = markdown.slice(0, MAX_MARKDOWN_LENGTH);

  const prompt = `You are a job listing parser. Given the following webpage content (in Markdown), extract ALL job postings you can find.

Return ONLY a JSON array with no markdown code blocks. Each object must have these fields (use null for missing data):
{
  "title": string,
  "company": string | null,
  "location": string | null,
  "url": string | null,
  "salary": string | null,
  "job_type": string | null,
  "experience_level": string | null,
  "description": string | null,
  "posted_date": string | null
}

For the "url" field: if there is a link to a specific job detail page, provide the full absolute URL. If the URL is relative, prepend the site origin.

Source URL: ${sourceUrl}
Keywords being searched: ${params.keywords.join(', ')}

---
${truncatedMarkdown}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  // Strip markdown code fences if present (same pattern as resume route)
  const jsonStr = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

  let parsed: ParsedJob[];
  try {
    const raw = JSON.parse(jsonStr);
    parsed = Array.isArray(raw) ? raw : [];
  } catch {
    console.error('Firecrawl: failed to parse Gemini response for', getDomain(sourceUrl));
    return [];
  }

  const jobs: JobInput[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    const title = entry.title?.trim();
    if (!title) continue;

    // Build a searchable string for keyword matching
    const searchable = [title, entry.description, entry.location, entry.company]
      .filter(Boolean)
      .join(' ');

    // Only include jobs that match the search keywords
    if (params.keywords.length > 0 && !matchesKeywords(searchable, params.keywords)) {
      continue;
    }

    // Resolve job URL — use provided URL, fallback to source page with fragment
    const jobUrl = entry.url && (entry.url.startsWith('http://') || entry.url.startsWith('https://'))
      ? entry.url
      : `${sourceUrl}#job-${i}`;

    jobs.push({
      title,
      company: entry.company?.trim() || undefined,
      location: entry.location?.trim() || undefined,
      url: jobUrl,
      source: 'firecrawl',
      salary: entry.salary?.trim() || undefined,
      description: entry.description?.trim()?.slice(0, 5000) || undefined,
      posted_date: parseDate(entry.posted_date),
      job_type: entry.job_type ? normalizeJobType(entry.job_type) : undefined,
      experience_level: entry.experience_level?.trim() || undefined,
    });
  }

  return jobs;
}

/** Extract domain from URL for user-friendly display. */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.slice(0, 40);
  }
}

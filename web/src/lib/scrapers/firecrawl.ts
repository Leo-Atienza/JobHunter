import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { matchesKeywords, normalizeJobType, parseDate } from './utils';
import Firecrawl from '@mendable/firecrawl-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MAX_RESULTS_PER_KEYWORD = 5;
const MAX_KEYWORDS = 5;
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
 * Search the web for jobs using Firecrawl search API + Gemini parsing.
 * Builds search queries from keywords + location, parses results with AI.
 */
export async function scrapeFirecrawl(params: ScrapeParams): Promise<ScrapeResult> {
  if (params.keywords.length === 0) {
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

  // Build one search query per keyword
  const location = params.location?.trim();
  const queries = params.keywords.slice(0, MAX_KEYWORDS).map((kw) => {
    if (params.remote) return `${kw} remote jobs`;
    return location ? `${kw} jobs ${location}` : `${kw} jobs`;
  });

  const allJobs: JobInput[] = [];
  const errors: string[] = [];

  // Run all searches in parallel
  const searchResults = await Promise.allSettled(
    queries.map((query) =>
      firecrawl.search(query, {
        limit: MAX_RESULTS_PER_KEYWORD,
        scrapeOptions: { formats: ['markdown'] },
      })
    ),
  );

  // Parse each search result's documents
  for (let i = 0; i < searchResults.length; i++) {
    const result = searchResults[i];

    if (result.status === 'rejected') {
      const msg = result.reason?.message ?? 'Unknown error';
      if (msg.includes('402') || msg.includes('payment')) {
        errors.push('Firecrawl free credits exhausted');
      } else {
        errors.push(`Search "${queries[i]}": ${msg}`);
      }
      continue;
    }

    // v2 search returns { web?: Array<SearchResultWeb | Document> }
    const webResults = result.value?.web ?? [];
    if (webResults.length === 0) continue;

    // Parse jobs from each document that has markdown content
    const docResults = await Promise.allSettled(
      webResults
        .filter((doc) => 'markdown' in doc && (doc.markdown?.length ?? 0) >= MIN_MARKDOWN_LENGTH)
        .map((doc) => {
          const url = 'url' in doc ? (doc.url ?? '') : '';
          const markdown = 'markdown' in doc ? (doc.markdown ?? '') : '';
          return parseJobsFromMarkdown(model, markdown, url, params);
        }),
    );

    for (const docResult of docResults) {
      if (docResult.status === 'fulfilled') {
        allJobs.push(...docResult.value);
      }
    }
  }

  return {
    source: 'firecrawl',
    jobs: allJobs,
    error: errors.length > 0 && allJobs.length === 0 ? errors.join('; ') : undefined,
  };
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

  // Strip markdown code fences if present
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

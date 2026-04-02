import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { normalizeJobType, parseDate } from './utils';
import Firecrawl from '@mendable/firecrawl-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MAX_RESULTS_PER_KEYWORD = 5;
const MAX_KEYWORDS = 3;
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

/** Fields available on a Firecrawl search result (without scrapeOptions). */
interface SearchResultDoc {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
  [key: string]: unknown;
}

const NON_JOB_TITLES = /^(sign in|log ?in|home|blog|404|page not found|privacy|terms|about us|contact|careers at|faq|help center)/i;
const SEARCH_PAGE_PATTERNS = /[?&](q|query|search|keyword)=/i;
const JOB_TERMS = /\b(job|role|position|engineer|developer|manager|analyst|designer|architect|consultant|coordinator|specialist|director|associate|intern|salary|experience|apply|hiring|recruit|openings?|vacanc)/i;

/**
 * Search the web for jobs using Firecrawl search API.
 * Primary path: extract job info from search result metadata (cheap, no Gemini needed).
 * Optional enrichment: if markdown is available and Gemini is configured, use AI parsing.
 */
export async function scrapeFirecrawl(params: ScrapeParams): Promise<ScrapeResult> {
  if (params.keywords.length === 0) {
    return { source: 'firecrawl', jobs: [] };
  }

  if (!FIRECRAWL_API_KEY) {
    return { source: 'firecrawl', jobs: [], error: 'Firecrawl API key not configured' };
  }

  const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });

  // Optional Gemini for enrichment (not required)
  const geminiModel = GEMINI_API_KEY
    ? new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: 'gemini-2.0-flash' })
    : null;

  // Build one search query per keyword
  const location = params.location?.trim();
  const queries = params.keywords.slice(0, MAX_KEYWORDS).map((kw) => {
    if (params.remote) return `${kw} remote jobs`;
    return location ? `${kw} jobs ${location}` : `${kw} jobs`;
  });

  const allJobs: JobInput[] = [];
  const seenUrls = new Set<string>();
  const errors: string[] = [];

  // Run all searches in parallel — no scrapeOptions = ~1 credit per result
  const searchResults = await Promise.allSettled(
    queries.map((query) =>
      firecrawl.search(query, { limit: MAX_RESULTS_PER_KEYWORD })
    ),
  );

  let totalWebResults = 0;
  let totalExtracted = 0;
  let totalEnriched = 0;
  let creditsUsed = 0;

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

    // Each fulfilled search call costs ~1 credit per result returned
    const raw = result.value as Record<string, unknown> | undefined;
    const webResults: SearchResultDoc[] =
      (raw?.data as SearchResultDoc[]) ?? (raw?.web as SearchResultDoc[]) ?? (Array.isArray(raw) ? raw as SearchResultDoc[] : []);
    creditsUsed += webResults.length; // ~1 credit per result returned
    totalWebResults += webResults.length;

    if (webResults.length === 0) {
      console.warn(`Firecrawl: query "${queries[i]}" returned 0 results. Response keys: ${raw ? Object.keys(raw).join(',') : 'null'}`);
      continue;
    }

    console.log(`Firecrawl: query "${queries[i]}" -> ${webResults.length} results`);

    // Phase 1: Extract basic job info from search result metadata
    for (const doc of webResults) {
      if (!doc.url || seenUrls.has(doc.url)) continue;
      if (!isLikelyJobListing(doc)) continue;

      const job = extractJobFromSearchResult(doc);
      if (job) {
        seenUrls.add(doc.url);
        allJobs.push(job);
        totalExtracted++;
      }
    }

    // Phase 2: Optional Gemini enrichment for docs with markdown
    if (geminiModel) {
      const docsWithMarkdown = webResults.filter(
        (doc) => typeof doc.markdown === 'string' && (doc.markdown as string).length >= MIN_MARKDOWN_LENGTH,
      );

      if (docsWithMarkdown.length > 0) {
        const docResults = await Promise.allSettled(
          docsWithMarkdown.map((doc) =>
            parseJobsFromMarkdown(geminiModel, doc.markdown as string, doc.url ?? '', params),
          ),
        );

        for (const docResult of docResults) {
          if (docResult.status === 'fulfilled') {
            for (const job of docResult.value) {
              // Strip fragments for dedup — Gemini fallback URLs use #job-N
              const canonicalUrl = job.url?.split('#')[0] ?? '';
              if (canonicalUrl && !seenUrls.has(canonicalUrl)) {
                seenUrls.add(canonicalUrl);
                allJobs.push(job);
                totalEnriched++;
              }
            }
          }
        }
      }
    }
  }

  console.log(`Firecrawl: ${queries.length} queries, ${totalWebResults} results, ${totalExtracted} extracted, ${totalEnriched} enriched -> ${allJobs.length} total jobs`);

  // Only set error when no jobs found — the route short-circuits on result.error
  // and skips insertion. Partial failures are logged to console only.
  if (errors.length > 0 && allJobs.length > 0) {
    console.warn(`Firecrawl: partial failures (${allJobs.length} jobs still extracted): ${errors.join('; ')}`);
  }

  return {
    source: 'firecrawl',
    jobs: allJobs,
    credits_used: creditsUsed,
    error: allJobs.length === 0
      ? `No jobs extracted (${queries.length} queries, ${totalWebResults} results)${errors.length ? ': ' + errors.join('; ') : ''}`
      : undefined,
  };
}

/** Check if a search result looks like a job listing (not a homepage, blog, etc). */
function isLikelyJobListing(doc: SearchResultDoc): boolean {
  const title = doc.title ?? '';
  const desc = doc.description ?? '';
  const url = doc.url ?? '';

  // Reject non-job pages
  if (NON_JOB_TITLES.test(title)) return false;

  // Reject search/category aggregate pages
  if (SEARCH_PAGE_PATTERNS.test(url)) return false;

  // Require at least one job-related term in title or description
  return JOB_TERMS.test(title) || JOB_TERMS.test(desc);
}

/** Extract job info from search result metadata (no AI needed). */
function extractJobFromSearchResult(doc: SearchResultDoc): JobInput | null {
  const rawTitle = doc.title?.trim() ?? '';
  const desc = doc.description?.trim() ?? '';
  const url = doc.url ?? '';

  if (!rawTitle || !url) return null;

  // Clean title: strip known job board suffixes like " | LinkedIn", " - Indeed"
  const title = rawTitle
    .replace(/\s*[|–—-]\s*(LinkedIn|Indeed|Glassdoor|ZipRecruiter|Monster|Dice|SimplyHired|Workday|Lever|Greenhouse|Jobicy|Remotive).*$/i, '')
    .trim();

  if (title.length < 3) return null;

  // Extract company from description: "at Company", "- Company", "Company is hiring"
  const company = extractCompany(desc, url);

  // Extract location from description
  const location = extractLocation(desc);

  return {
    title,
    company: company || undefined,
    location: location || undefined,
    url,
    source: 'firecrawl',
    description: desc || undefined,
  };
}

/** Try to extract company name from description text or URL. */
function extractCompany(desc: string, url: string): string | null {
  // "at Company Name" pattern — require titlecase words (proper nouns)
  const atMatch = desc.match(/\bat\s+([A-Z][A-Za-z0-9&.]+(?:\s[A-Z][A-Za-z0-9&.]+){0,4})(?:\s*[-–|,.]|\s+in\b|\s+is\b|\s*$)/);
  if (atMatch) return atMatch[1].trim();

  // "Company Name is hiring" pattern — require titlecase words
  const hiringMatch = desc.match(/^([A-Z][A-Za-z0-9&.]+(?:\s[A-Z][A-Za-z0-9&.]+){0,4})\s+is\s+(?:hiring|looking|seeking)/);
  if (hiringMatch) return hiringMatch[1].trim();

  // Fallback: domain name (e.g. stripe.com -> Stripe)
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const parts = hostname.split('.');
    if (parts.length >= 2 && !['com', 'org', 'net', 'io', 'co'].includes(parts[0])) {
      const domain = parts[0];
      // Skip if any part of hostname is a known job board (e.g. jobs.lever.co)
      const jobBoards = ['linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster', 'dice', 'lever', 'greenhouse', 'workday', 'jooble', 'adzuna', 'remotive', 'jobicy', 'himalayas'];
      if (!parts.some((p) => jobBoards.includes(p.toLowerCase()))) {
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }
  } catch { /* ignore invalid URLs */ }

  return null;
}

/** Try to extract location from description text. */
function extractLocation(desc: string): string | null {
  // "Remote" standalone
  if (/\bremote\b/i.test(desc)) {
    const remoteMatch = desc.match(/\b(remote|fully remote|hybrid|on-site)\b/i);
    if (remoteMatch) {
      // Check for "Remote in City" or "Remote - City"
      const extMatch = desc.match(/\bremote\s*(?:[-–]\s*|in\s+)([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/i);
      if (extMatch) return `Remote - ${extMatch[1]}`;
      return remoteMatch[0];
    }
  }

  // "City, State/Province" pattern (e.g. "Toronto, Ontario", "San Francisco, CA", "Salt Lake City, UT")
  const cityStateMatch = desc.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/);
  if (cityStateMatch) return cityStateMatch[0];

  return null;
}

/** Use Gemini to extract structured job data from page markdown (optional enrichment). */
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
    // Try to extract JSON array from response text as a fallback
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const fallback = JSON.parse(arrayMatch[0]);
        parsed = Array.isArray(fallback) ? fallback : [];
      } catch {
        console.error('Firecrawl: failed to parse Gemini response for', getDomain(sourceUrl), '| First 200 chars:', responseText.slice(0, 200));
        return [];
      }
    } else {
      console.error('Firecrawl: failed to parse Gemini response for', getDomain(sourceUrl), '| First 200 chars:', responseText.slice(0, 200));
      return [];
    }
  }

  const jobs: JobInput[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    const title = entry.title?.trim();
    if (!title) continue;

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

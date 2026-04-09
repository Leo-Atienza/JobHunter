/**
 * LinkedIn Public Jobs scraper — $0, no auth required.
 *
 * Uses LinkedIn's guest/public jobs API which returns server-rendered HTML
 * fragments with job cards. No login or API key needed.
 *
 * Paginates through multiple pages (25 jobs per page) for broader coverage.
 */

import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { USER_AGENT, parseDate } from './utils';

const JOBS_PER_PAGE = 25;
const MAX_PAGES = 2; // 50 jobs max — enough for most searches, keeps scan fast

/** Country code → LinkedIn geo ID for better location targeting. */
const COUNTRY_GEO: Record<string, string> = {
  ca: '101174742',   // Canada
  us: '103644278',   // United States
  uk: '101165590',   // United Kingdom
  au: '101452733',   // Australia
  de: '101282230',   // Germany
  fr: '105015875',   // France
  in: '102713980',   // India
};

/** Build LinkedIn guest search URL. */
function buildSearchUrl(params: ScrapeParams, start: number): string {
  const keywords = encodeURIComponent(params.keywords.join(' '));
  const location = encodeURIComponent(params.location || '');
  const country = params.country?.toLowerCase() || '';
  const geoId = COUNTRY_GEO[country] || '';

  let url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search`
    + `?keywords=${keywords}&location=${location}&start=${start}`;

  if (geoId) url += `&geoId=${geoId}`;
  if (params.remote) url += '&f_WT=2'; // Remote filter

  return url;
}

/** Fetch one page of LinkedIn guest job results. */
async function fetchPage(url: string): Promise<{ html: string | null; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) {
      return { html: null, error: `LinkedIn returned ${resp.status}` };
    }
    const html = await resp.text();
    // Detect block/CAPTCHA pages — real results contain job card class names
    if (html.length > 200 && !html.includes('base-search-card')) {
      return { html: null, error: 'LinkedIn blocked request (no job cards in response)' };
    }
    return { html };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed';
    return { html: null, error: `LinkedIn fetch error: ${msg}` };
  }
}

/** Parse job cards from LinkedIn HTML fragment. */
function parseJobCards(html: string): JobInput[] {
  const jobs: JobInput[] = [];

  // Extract each field with regex — LinkedIn uses consistent class names
  const titles = [...html.matchAll(
    /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi,
  )].map(m => m[1].trim());

  const companies = [...html.matchAll(
    /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi,
  )].map(m => m[1].trim());

  const locations = [...html.matchAll(
    /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
  )].map(m => m[1].trim());

  const links = [...html.matchAll(
    /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/gi,
  )].map(m => m[1].split('?')[0]); // Strip tracking params

  const dates = [...html.matchAll(
    /<time[^>]*datetime="([^"]+)"/gi,
  )].map(m => m[1]);

  // LinkedIn sometimes includes salary in a separate span
  const salaries = [...html.matchAll(
    /<span[^>]*class="[^"]*job-search-card__salary-info[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
  )].map(m => m[1].trim());

  // listdate class contains posting dates (e.g. "2 days ago"), not job types
  const postedDates = [...html.matchAll(
    /<span[^>]*class="[^"]*job-search-card__listdate[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
  )].map(m => m[1].trim());

  const count = Math.min(titles.length, links.length);
  for (let i = 0; i < count; i++) {
    const title = titles[i];
    const url = links[i];
    if (!title || !url) continue;

    jobs.push({
      title,
      company: companies[i] || undefined,
      location: locations[i] || undefined,
      url,
      source: 'linkedin-public',
      salary: salaries[i] || undefined,
      posted_date: parseDate(dates[i] || postedDates[i]),
    });
  }

  return jobs;
}

export async function scrapeLinkedInPublic(params: ScrapeParams): Promise<ScrapeResult> {
  const allJobs: JobInput[] = [];
  const seen = new Set<string>();
  let lastError: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * JOBS_PER_PAGE;
    const url = buildSearchUrl(params, start);
    const { html, error } = await fetchPage(url);

    if (error) {
      lastError = error;
      break;
    }
    if (!html || html.length < 200) break;

    const pageJobs = parseJobCards(html);
    if (!pageJobs.length) break;

    for (const job of pageJobs) {
      if (!seen.has(job.url)) {
        seen.add(job.url);
        allJobs.push(job);
      }
    }

    if (page < MAX_PAGES - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const error = lastError
    ? allJobs.length === 0
      ? lastError
      : `Partial results (${allJobs.length} jobs): ${lastError}`
    : undefined;

  return { source: 'linkedin-public', jobs: allJobs, error };
}

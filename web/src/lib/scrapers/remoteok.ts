import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, matchesKeywords, parseDate } from './utils';

/** Shape of a job object returned by the RemoteOK public API. */
interface RemoteOKJob {
  id?: string;
  position?: string;
  company?: string;
  company_logo?: string;
  location?: string;
  tags?: string[];
  url?: string;
  apply_url?: string;
  salary_min?: number;
  salary_max?: number;
  date?: string;
  description?: string;
}

/**
 * Format a salary range from min/max numbers into a human-readable string.
 * Returns undefined when either bound is missing.
 */
function formatSalary(min?: number, max?: number): string | undefined {
  if (min == null || max == null) return undefined;
  return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
}

/**
 * Scrape remote jobs from RemoteOK's public JSON API.
 *
 * The API returns an array where the first element is metadata (not a job),
 * so it is skipped. Results are filtered client-side to ensure relevance.
 */
export async function scrapeRemoteOK(params: ScrapeParams): Promise<ScrapeResult> {
  // RemoteOK tags= is an AND filter — limit to 3 tags to avoid 0 results
  const query = params.keywords.slice(0, 3).join(',');
  const url = `https://remoteok.com/api?tags=${encodeURIComponent(query)}`;

  // RemoteOK requires a browser-like User-Agent to avoid 403 responses.
  const raw = await fetchJson<(RemoteOKJob | Record<string, unknown>)[]>(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobHunter/1.0)' },
  });

  if (!raw || !Array.isArray(raw)) {
    return { source: 'remoteok', jobs: [] };
  }

  // First element is always API metadata — skip it.
  const items = raw.slice(1) as RemoteOKJob[];

  const jobs = items
    .filter((item) => {
      if (!item.position?.trim()) return false;

      // Keep only jobs where title or tags contain at least one keyword.
      const tagText = item.tags?.join(' ') ?? '';
      return matchesKeywords(`${item.position} ${tagText}`, params.keywords);
    })
    .map((item) => {
      const id = item.id ?? '';
      const jobUrl = item.url?.trim()
        || item.apply_url?.trim()
        || `https://remoteok.com/remote-jobs/${id}`;

      return {
        title: item.position!.trim(),
        company: item.company?.trim() || undefined,
        location: item.location?.trim() || 'Remote',
        url: jobUrl,
        source: 'remoteok' as const,
        salary: formatSalary(item.salary_min, item.salary_max),
        description: item.description || undefined,
        posted_date: parseDate(item.date),
        skills: item.tags?.length ? item.tags.join(', ') : undefined,
      };
    })
    .filter((job) => job.url.trim());

  return { source: 'remoteok', jobs };
}

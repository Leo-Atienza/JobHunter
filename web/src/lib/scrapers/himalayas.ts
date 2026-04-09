import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson } from './utils';

interface HimalayasJob {
  title?: string; companyName?: string; companySlug?: string;
  slug?: string; applicationLink?: string;
  locationRestrictions?: string | string[];
  minSalary?: number; maxSalary?: number;
  pubDate?: string; publishedDate?: string;
  excerpt?: string; description?: string;
  seniority?: string | string[];
}

const SENIORITY_MAP: Record<string, string> = {
  entry_level: 'Entry', entry: 'Entry', mid_level: 'Mid', mid: 'Mid',
  senior_level: 'Senior', senior: 'Senior', lead: 'Lead',
  principal: 'Principal', intern: 'Intern', internship: 'Intern',
};

export async function scrapeHimalayas(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const jobs = [];
  let failedPages = 0;

  for (let page = 0; page < 3; page++) {
    const data = await fetchJson<{ jobs?: HimalayasJob[] }>(
      `https://himalayas.app/jobs/api?q=${encodeURIComponent(query)}&offset=${page * 20}&limit=20&sort=recent`
    );
    if (data === null) {
      failedPages++;
      if (jobs.length === 0 && page === 0) {
        return { source: 'himalayas', jobs: [], error: 'Himalayas API unavailable' };
      }
      continue;
    }
    const items = data?.jobs ?? [];
    if (!items.length) break;

    for (const item of items) {
      const title = item.title?.trim();
      if (!title) continue;

      let location = item.locationRestrictions;
      if (Array.isArray(location)) location = location.join(', ') || 'Remote';
      location = (location as string) || 'Remote';

      let url: string | undefined;
      if (item.slug && item.companySlug) {
        url = `https://himalayas.app/companies/${item.companySlug}/jobs/${item.slug}`;
      } else if (item.applicationLink) {
        url = item.applicationLink;
      }
      if (!url) continue;

      let salary: string | undefined;
      if (item.minSalary && item.maxSalary) salary = `$${item.minSalary.toLocaleString()} - $${item.maxSalary.toLocaleString()}`;
      else if (item.minSalary) salary = `From $${item.minSalary.toLocaleString()}`;
      else if (item.maxSalary) salary = `Up to $${item.maxSalary.toLocaleString()}`;

      const rawSeniority = Array.isArray(item.seniority) ? item.seniority[0] : item.seniority;
      const seniority = rawSeniority?.toLowerCase().trim();
      jobs.push({
        title, company: item.companyName?.trim() || undefined,
        location, url, source: 'himalayas' as const,
        salary, description: item.excerpt || item.description || undefined,
        posted_date: item.pubDate || item.publishedDate || undefined,
        experience_level: seniority ? SENIORITY_MAP[seniority] ?? seniority : undefined,
      });
    }
    if (items.length < 20) break;
  }

  return {
    source: 'himalayas',
    jobs,
    ...(failedPages > 0 ? { error: `${failedPages} of 3 pages failed (${jobs.length} jobs from successful pages)` } : {}),
  };
}

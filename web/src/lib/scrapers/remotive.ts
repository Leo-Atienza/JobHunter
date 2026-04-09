import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, normalizeJobType } from './utils';

const CATEGORY_MAP: Record<string, string> = {
  software: 'software-dev', engineer: 'software-dev', developer: 'software-dev',
  frontend: 'software-dev', backend: 'software-dev', fullstack: 'software-dev',
  'full stack': 'software-dev', devops: 'devops-sysadmin', data: 'data',
  design: 'design', product: 'product', marketing: 'marketing',
  customer: 'customer-support', sales: 'sales', qa: 'qa', writing: 'writing',
};

function guessCategory(keywords: string[]): string | undefined {
  const combined = keywords.join(' ').toLowerCase();
  for (const [token, slug] of Object.entries(CATEGORY_MAP)) {
    if (combined.includes(token)) return slug;
  }
  return undefined;
}

interface RemotiveJob {
  title?: string; company_name?: string; url?: string;
  salary?: string; description?: string; publication_date?: string;
  candidate_required_location?: string; job_type?: string;
}

export async function scrapeRemotive(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const category = guessCategory(params.keywords);

  const urls: string[] = [];
  if (category) urls.push(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&category=${category}`);
  urls.push(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`);

  let items: RemotiveJob[] = [];
  let allFailed = true;
  let categoryFailed = false;
  for (const url of urls) {
    const data = await fetchJson<{ jobs?: RemotiveJob[] }>(url);
    if (data !== null) {
      allFailed = false;
      items = data?.jobs ?? [];
      if (items.length) break;
    } else if (urls.length > 1 && url === urls[0]) {
      categoryFailed = true;
    }
  }

  const jobs = items
    .filter((item) => item.title?.trim() && item.url?.trim())
    .map((item) => ({
      title: item.title!.trim(),
      company: item.company_name?.trim() || undefined,
      location: item.candidate_required_location || 'Remote',
      url: item.url!.trim(),
      source: 'remotive' as const,
      salary: item.salary?.trim() || undefined,
      description: item.description || undefined,
      posted_date: item.publication_date || undefined,
      job_type: normalizeJobType(item.job_type),
    }));

  const error = allFailed
    ? 'Remotive API unavailable'
    : categoryFailed && jobs.length > 0
      ? 'Category search failed, results from generic fallback'
      : undefined;

  return { source: 'remotive', jobs, error };
}

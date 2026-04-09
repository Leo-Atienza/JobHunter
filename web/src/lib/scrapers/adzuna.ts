import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, normalizeJobType } from './utils';

interface AdzunaJob {
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url?: string;
  salary_min?: number; salary_max?: number;
  description?: string;
  created?: string;
  contract_type?: string;
}

export async function scrapeAdzuna(params: ScrapeParams): Promise<ScrapeResult> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_API_KEY;
  if (!appId || !appKey) {
    return { source: 'adzuna', jobs: [], error: 'No API keys configured' };
  }

  const query = params.keywords.join(' ');

  // Use explicit country, or infer from location string
  let country = params.country?.toLowerCase();
  if (!country) {
    const loc = (params.location || '').toLowerCase();
    if (/\b(canada|toronto|vancouver|montreal|ottawa|calgary|edmonton|winnipeg|ontario|british columbia|alberta|quebec|kitchener|waterloo|hamilton|london on|gta)\b/.test(loc)) {
      country = 'ca';
    } else if (/\b(united states|usa|new york|san francisco|los angeles|chicago|seattle|austin|boston)\b/.test(loc)) {
      country = 'us';
    } else if (/\b(united kingdom|london|manchester|birmingham|uk|england)\b/.test(loc)) {
      country = 'gb';
    } else if (/\b(australia|sydney|melbourne|brisbane)\b/.test(loc)) {
      country = 'au';
    }
  }
  if (!country) {
    return { source: 'adzuna', jobs: [], error: 'Could not determine country from location' };
  }
  const jobs = [];
  let failedPages = 0;

  for (let page = 1; page <= 2; page++) {
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}` +
      `?app_id=${appId}&app_key=${appKey}` +
      `&what=${encodeURIComponent(query)}` +
      `&where=${encodeURIComponent(params.location)}` +
      `&results_per_page=20&content-type=application/json`;

    const data = await fetchJson<{ results?: AdzunaJob[] }>(url);
    if (data === null) {
      failedPages++;
      if (jobs.length === 0 && page === 1) {
        return { source: 'adzuna', jobs: [], error: 'Adzuna API unavailable' };
      }
      continue;
    }
    const items = data?.results ?? [];
    if (!items.length) break;

    for (const item of items) {
      const title = item.title?.trim();
      if (!title || !item.redirect_url) continue;

      let salary: string | undefined;
      if (item.salary_min && item.salary_max) salary = `$${item.salary_min.toLocaleString(undefined, { maximumFractionDigits: 0 })} - $${item.salary_max.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      else if (item.salary_min) salary = `From $${item.salary_min.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      else if (item.salary_max) salary = `Up to $${item.salary_max.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

      jobs.push({
        title,
        company: item.company?.display_name?.trim() || undefined,
        location: item.location?.display_name?.trim() || undefined,
        url: item.redirect_url,
        source: 'adzuna' as const,
        salary,
        description: item.description || undefined,
        posted_date: item.created || undefined,
        job_type: normalizeJobType(item.contract_type),
      });
    }
  }

  return {
    source: 'adzuna',
    jobs,
    ...(failedPages > 0 ? { error: `${failedPages} of 2 pages failed (${jobs.length} jobs from successful pages)` } : {}),
  };
}

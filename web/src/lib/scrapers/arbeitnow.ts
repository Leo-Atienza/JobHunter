import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, stripHtml, matchesKeywords } from './utils';

interface ArbeitnowJob {
  title?: string; company_name?: string; location?: string;
  remote?: boolean; url?: string; slug?: string;
  description?: string; created_at?: number | string;
  tags?: string[];
}

export async function scrapeArbeitnow(params: ScrapeParams): Promise<ScrapeResult> {
  const _query = params.keywords.join(' ');
  const jobs = [];

  for (let page = 1; page <= 3; page++) {
    const data = await fetchJson<{ data?: ArbeitnowJob[]; links?: { next?: string } }>(
      `https://arbeitnow.com/api/job-board-api?page=${page}`
    );
    const items = data?.data ?? [];
    if (!items.length) break;

    for (const item of items) {
      const title = item.title?.trim();
      if (!title) continue;

      const searchable = `${title} ${(item.tags ?? []).join(' ')} ${item.description ?? ''}`;
      if (!matchesKeywords(searchable, params.keywords)) continue;

      let location = item.location?.trim() || undefined;
      if (item.remote && location) location = `${location} (Remote)`;
      else if (item.remote) location = 'Remote';

      const url = item.url || (item.slug ? `https://arbeitnow.com/view/${item.slug}` : undefined);
      if (!url) continue;

      let posted_date: string | undefined;
      if (typeof item.created_at === 'number') {
        posted_date = new Date(item.created_at * 1000).toISOString().split('T')[0];
      } else if (typeof item.created_at === 'string') {
        posted_date = item.created_at;
      }

      jobs.push({
        title, company: item.company_name?.trim() || undefined,
        location, url, source: 'arbeitnow' as const,
        description: item.description ? stripHtml(item.description) : undefined,
        posted_date,
        skills: item.tags?.join(', ') || undefined,
      });
    }
    if (!data?.links?.next) break;
  }

  return { source: 'arbeitnow', jobs };
}

import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, stripHtml, normalizeJobType, matchesKeywords } from './utils';

interface MuseJob {
  name?: string;
  company?: { name?: string };
  locations?: { name?: string }[];
  refs?: { landing_page?: string };
  publication_date?: string;
  contents?: string;
  levels?: { name?: string }[];
  type?: string;
}

const LEVEL_MAP: Record<string, string> = {
  'Entry Level': 'Entry', 'Mid Level': 'Mid', 'Senior Level': 'Senior',
  Internship: 'Intern', Management: 'Lead',
};

export async function scrapeThemuse(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const allJobs = [];

  for (let page = 0; page < 3; page++) {
    const qs = new URLSearchParams({ page: String(page) });
    if (params.remote) qs.set('location', 'Flexible / Remote');

    const data = await fetchJson<{ results?: MuseJob[]; page_count?: number }>(
      `https://www.themuse.com/api/public/jobs?${qs}`
    );
    const items = data?.results ?? [];
    if (!items.length) break;

    for (const item of items) {
      const title = item.name?.trim();
      if (!title) continue;

      const url = item.refs?.landing_page;
      if (!url) continue;

      const locs = (item.locations ?? []).map((l) => l.name).filter(Boolean);
      const level = item.levels?.[0]?.name;

      allJobs.push({
        title,
        company: item.company?.name?.trim() || undefined,
        location: locs.join(', ') || undefined,
        url,
        source: 'themuse' as const,
        description: item.contents ? stripHtml(item.contents) : undefined,
        posted_date: item.publication_date?.split('T')[0] || undefined,
        experience_level: level ? LEVEL_MAP[level] ?? level : undefined,
        job_type: normalizeJobType(item.type),
      });
    }

    if (page + 1 >= (data?.page_count ?? 0)) break;
  }

  // Client-side keyword + location filtering (API has no free-text search)
  const jobs = allJobs.filter((j) => {
    const text = `${j.title} ${j.description ?? ''}`;
    if (!matchesKeywords(text, params.keywords)) return false;

    if (params.location && !params.remote && j.location) {
      const city = params.location.toLowerCase().split(',')[0].trim();
      if (city && !j.location.toLowerCase().includes(city)) return false;
    }
    return true;
  });

  return { source: 'themuse', jobs };
}

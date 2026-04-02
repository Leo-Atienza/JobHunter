import type { ScrapeParams, ScrapeResult } from './types';
import { USER_AGENT, stripHtml, normalizeJobType, parseDate } from './utils';

interface JoobleJob {
  title?: string; company?: string; location?: string;
  link?: string; snippet?: string; salary?: string;
  updated?: string; type?: string;
}

export async function scrapeJooble(params: ScrapeParams): Promise<ScrapeResult> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    return { source: 'jooble', jobs: [], error: 'No API key configured' };
  }

  const query = params.keywords.join(' ');
  const jobs = [];

  for (let page = 1; page <= 2; page++) {
    try {
      const resp = await fetch(`https://jooble.org/api/${apiKey}`, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: query, location: params.location, page: String(page) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) break;
      const data = await resp.json() as { jobs?: JoobleJob[] };
      const items = data.jobs ?? [];
      if (!items.length) break;

      for (const item of items) {
        const title = item.title?.trim();
        if (!title || !item.link?.trim()) continue;

        jobs.push({
          title,
          company: item.company?.trim() || undefined,
          location: item.location?.trim() || undefined,
          url: item.link.trim(),
          source: 'jooble' as const,
          salary: item.salary?.trim() || undefined,
          description: item.snippet ? stripHtml(item.snippet) : undefined,
          posted_date: parseDate(item.updated),
          job_type: normalizeJobType(item.type),
        });
      }
    } catch {
      break;
    }
  }

  return { source: 'jooble', jobs };
}

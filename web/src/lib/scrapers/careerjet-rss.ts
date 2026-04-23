import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { extractTag, extractCdata, stripHtml, safeParseDate } from './utils';
import { stealthFetch } from './anti-detect';

const FEED_BASE = 'https://www.careerjet.ca/search/jobs';

function parseRssItems(xml: string): JobInput[] {
  const items: JobInput[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  for (const [, itemXml] of itemMatches) {
    const title = extractCdata(itemXml, 'title') ?? extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') ?? extractCdata(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractCdata(itemXml, 'description') ?? extractTag(itemXml, 'description');
    const company = extractTag(itemXml, 'company') ?? extractCdata(itemXml, 'company');
    const location = extractTag(itemXml, 'location') ?? extractCdata(itemXml, 'location');

    if (!title || !link) continue;

    items.push({
      title: title.trim(),
      company: company?.trim() || undefined,
      location: location?.trim() || undefined,
      url: link.trim(),
      source: 'careerjet',
      description: description ? stripHtml(description).slice(0, 5000) : undefined,
      posted_date: pubDate ? safeParseDate(pubDate) : undefined,
      country: 'ca',
    });
  }

  return items;
}

/**
 * Scrape CareerJet Canada via RSS feed.
 * Free, no API key required. Aggregates from multiple Canadian job boards.
 */
export async function scrapeCareerjetRss(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const location = params.location || 'Canada';

  const url = `${FEED_BASE}?s=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&sort=date&format=rss`;

  try {
    const resp = await stealthFetch(url, {
      mode: 'rss',
      maxRetries: 2,
      timeout: 12_000,
    });

    if (!resp.ok) {
      return { source: 'careerjet', jobs: [], error: `CareerJet returned ${resp.status}` };
    }

    const xml = await resp.text();

    if (!xml.includes('<item>')) {
      return { source: 'careerjet', jobs: [], error: 'No items in CareerJet RSS feed' };
    }

    const jobs = parseRssItems(xml);
    return { source: 'careerjet', jobs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { source: 'careerjet', jobs: [], error: msg };
  }
}

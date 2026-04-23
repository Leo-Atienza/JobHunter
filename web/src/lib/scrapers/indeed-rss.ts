import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';
import { extractTag, extractCdata, stripHtml, safeParseDate } from './utils';
import { stealthFetch } from './anti-detect';

const FEED_BASE = 'https://ca.indeed.com/rss';

/**
 * Parse Indeed's title format: "Job Title - Company Name - City, Province"
 * Falls back gracefully if the format doesn't match.
 */
function parseIndeedTitle(raw: string): {
  cleanTitle: string;
  company: string | null;
  location: string | null;
} {
  const parts = raw.split(' - ').map((p) => p.trim());
  if (parts.length >= 3) {
    return { cleanTitle: parts[0], company: parts[1], location: parts.slice(2).join(' - ') };
  }
  if (parts.length === 2) {
    // Could be "Title - Location" or "Title - Company" — heuristic: if it contains a comma, it's location
    const maybeLocation = parts[1].includes(',') ? parts[1] : null;
    return {
      cleanTitle: parts[0],
      company: maybeLocation ? null : parts[1],
      location: maybeLocation,
    };
  }
  return { cleanTitle: raw, company: null, location: null };
}

function parseRssItems(xml: string): JobInput[] {
  const items: JobInput[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  for (const [, itemXml] of itemMatches) {
    const title = extractCdata(itemXml, 'title') ?? extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') ?? extractCdata(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractCdata(itemXml, 'description') ?? extractTag(itemXml, 'description');

    if (!title || !link) continue;

    const { cleanTitle, company, location } = parseIndeedTitle(title);

    // Preserve Indeed's jk parameter (unique job key), strip tracking noise
    let cleanUrl = link;
    try {
      const u = new URL(link);
      const jk = u.searchParams.get('jk');
      if (jk) cleanUrl = `${u.origin}${u.pathname}?jk=${jk}`;
    } catch {
      /* invalid URL, use as-is */
    }

    items.push({
      title: cleanTitle,
      company: company ?? undefined,
      location: location ?? undefined,
      url: cleanUrl,
      source: 'indeed-rss',
      description: description ? stripHtml(description).slice(0, 5000) : undefined,
      posted_date: pubDate ? safeParseDate(pubDate) : undefined,
      country: 'ca',
    });
  }

  return items;
}

/**
 * Scrape Indeed Canada via public RSS feed.
 * Free, no API key required. May be rate-limited or blocked by Indeed.
 */
export async function scrapeIndeedRss(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const location = params.location || 'Canada';

  const url = `${FEED_BASE}?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&sort=date&limit=50`;

  try {
    const resp = await stealthFetch(url, {
      mode: 'rss',
      maxRetries: 2,
      timeout: 12_000,
    });

    if (!resp.ok) {
      return { source: 'indeed-rss', jobs: [], error: `Indeed RSS returned ${resp.status}` };
    }

    const xml = await resp.text();

    if (!xml.includes('<item>')) {
      return { source: 'indeed-rss', jobs: [], error: 'No items in RSS feed' };
    }

    const jobs = parseRssItems(xml);
    return { source: 'indeed-rss', jobs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { source: 'indeed-rss', jobs: [], error: msg };
  }
}

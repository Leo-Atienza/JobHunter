import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';

const FEED_BASE = 'https://ca.indeed.com/rss';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function extractCdata(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  return m ? m[1].trim() : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

/**
 * Parse Indeed's title format: "Job Title - Company Name - City, Province"
 * Falls back gracefully if the format doesn't match.
 */
function parseIndeedTitle(raw: string): { cleanTitle: string; company: string | null; location: string | null } {
  const parts = raw.split(' - ').map((p) => p.trim());
  if (parts.length >= 3) {
    return { cleanTitle: parts[0], company: parts[1], location: parts.slice(2).join(' - ') };
  }
  if (parts.length === 2) {
    // Could be "Title - Location" or "Title - Company" — heuristic: if it contains a comma, it's location
    const maybeLocation = parts[1].includes(',') ? parts[1] : null;
    return { cleanTitle: parts[0], company: maybeLocation ? null : parts[1], location: maybeLocation };
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

    // Strip Indeed tracking params from URL for cleaner dedup
    const cleanUrl = link.includes('?') ? link.split('?')[0] : link;

    items.push({
      title: cleanTitle,
      company: company ?? undefined,
      location: location ?? undefined,
      url: cleanUrl,
      source: 'indeed-rss',
      description: description ? stripHtml(description).slice(0, 5000) : undefined,
      posted_date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : undefined,
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
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
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

import type { ScrapeParams, ScrapeResult } from './types';
import type { JobInput } from '@/lib/types';

const FEED_BASE = 'https://www.talent.com/rss/jobs';

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
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeParseDate(raw: string): string | undefined {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().split('T')[0];
  } catch {
    return undefined;
  }
}

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
      source: 'talent',
      description: description ? stripHtml(description).slice(0, 5000) : undefined,
      posted_date: pubDate ? safeParseDate(pubDate) : undefined,
      country: 'ca',
    });
  }

  return items;
}

/**
 * Scrape Talent.com (formerly Neuvoo) Canada via RSS feed.
 * Free, no API key required. Major Canadian job aggregator.
 */
export async function scrapeTalentRss(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const location = params.location || 'Canada';

  // Talent.com RSS format: /rss/jobs?k=QUERY&l=LOCATION
  const url = `${FEED_BASE}?k=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&sort=date`;

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
      return { source: 'talent', jobs: [], error: `Talent.com returned ${resp.status}` };
    }

    const xml = await resp.text();

    if (!xml.includes('<item>')) {
      return { source: 'talent', jobs: [], error: 'No items in Talent.com RSS feed' };
    }

    const jobs = parseRssItems(xml);
    return { source: 'talent', jobs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { source: 'talent', jobs: [], error: msg };
  }
}

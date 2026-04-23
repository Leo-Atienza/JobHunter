import type { ScrapeParams, ScrapeResult } from './types';
import { matchesKeywords, parseDate, stripHtml } from './utils';
import { stealthFetch } from './anti-detect';

const WWR_FEED_URL = 'https://weworkremotely.com/remote-jobs.rss';

/**
 * Extract all `<item>` blocks from an RSS XML string.
 * Returns an array of raw XML strings, one per job listing.
 */
function extractItems(xml: string): string[] {
  const matches = xml.match(/<item>[\s\S]*?<\/item>/gi);
  return matches ?? [];
}

/** Extract text content of the first matching XML tag within a block. */
function extractTag(block: string, tag: string): string | undefined {
  const pattern = new RegExp(
    `<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`,
    'i',
  );
  const match = block.match(pattern);
  if (!match) return undefined;
  // Group 1 = CDATA content, group 2 = plain content
  return (match[1] ?? match[2])?.trim() || undefined;
}

/**
 * Parse a WWR title string into company and job title parts.
 *
 * WWR title format: "Company: Job Title"
 * When the separator is absent, the full string becomes the title.
 */
function parseTitle(raw: string): { title: string; company: string | undefined } {
  const separatorIndex = raw.indexOf(': ');
  if (separatorIndex === -1) {
    return { title: raw.trim(), company: undefined };
  }
  return {
    company: raw.slice(0, separatorIndex).trim(),
    title: raw.slice(separatorIndex + 2).trim(),
  };
}

/**
 * Scrape remote jobs from the We Work Remotely public RSS feed.
 *
 * Uses stealthFetch (RSS mode) because the endpoint returns XML, not JSON.
 * Parses the RSS with regex — the feed structure is stable and well-defined.
 */
export async function scrapeWeWorkRemotely(params: ScrapeParams): Promise<ScrapeResult> {
  let xml: string;

  try {
    const resp = await stealthFetch(WWR_FEED_URL, {
      mode: 'rss',
      maxRetries: 2,
      timeout: 10_000,
    });
    if (!resp.ok) {
      return {
        source: 'weworkremotely',
        jobs: [],
        error: `WeWorkRemotely returned ${resp.status}`,
      };
    }
    xml = await resp.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { source: 'weworkremotely', jobs: [], error: `WeWorkRemotely fetch error: ${msg}` };
  }

  const items = extractItems(xml);

  const jobs = items
    .map((block) => {
      const rawTitle = extractTag(block, 'title');
      const link = extractTag(block, 'link');
      const pubDate = extractTag(block, 'pubDate');
      const rawDescription = extractTag(block, 'description');

      if (!rawTitle || !link) return null;

      const { title, company } = parseTitle(rawTitle);
      if (!title) return null;

      // Filter by keyword match against the job title.
      if (!matchesKeywords(title, params.keywords)) return null;

      return {
        title,
        company,
        location: 'Remote' as const,
        url: link.trim(),
        source: 'weworkremotely' as const,
        posted_date: parseDate(pubDate),
        description: rawDescription ? stripHtml(rawDescription) : undefined,
      };
    })
    .filter((job): job is NonNullable<typeof job> => job !== null);

  return { source: 'weworkremotely', jobs };
}

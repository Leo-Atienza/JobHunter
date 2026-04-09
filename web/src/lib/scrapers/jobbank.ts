import type { ScrapeParams, ScrapeResult } from './types';
import { getDb } from '@/lib/db';

interface ApifyJobbankItem {
  url?: string;
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  datePosted?: string;
  descriptionText?: string;
  remote?: boolean;
}

export async function scrapeJobbank(params: ScrapeParams): Promise<ScrapeResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { source: 'jobbank', jobs: [], error: 'Apify token not configured' };
  }

  // Pre-flight: check monthly Apify usage to avoid exceeding free tier
  try {
    const sql = getDb();
    const MONTHLY_LIMIT = parseInt(process.env.APIFY_MONTHLY_LIMIT ?? '16', 10);
    const [row] = await sql(
      `SELECT COUNT(*)::int AS runs_this_month
       FROM scrape_logs
       WHERE source = 'jobbank'
         AND status = 'success'
         AND scraped_at >= date_trunc('month', NOW())`,
    );
    const runsThisMonth = (row?.runs_this_month as number) ?? 0;
    if (runsThisMonth >= MONTHLY_LIMIT) {
      return {
        source: 'jobbank',
        jobs: [],
        error: `Apify monthly limit reached (${runsThisMonth}/${MONTHLY_LIMIT} runs). Resets next month.`,
      };
    }
  } catch (e) {
    // Non-fatal — if DB check fails, proceed with scrape
    console.warn('Apify rate limit check failed (proceeding):', e);
  }

  const query = params.keywords.join(' ');
  const searchUrl =
    `https://www.jobbank.gc.ca/jobsearch/jobsearch` +
    `?searchstring=${encodeURIComponent(query)}` +
    `&locationstring=${encodeURIComponent(params.location || '')}`;

  let items: ApifyJobbankItem[];
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/powerdot~jobbank-ca-actor/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [{ url: searchUrl }],
          maxPositionsPerUrl: 50,
          proxyConfiguration: { useApifyProxy: true },
        }),
      },
    );

    if (!resp.ok) {
      const msg = resp.status === 402
        ? 'Apify credits exhausted'
        : `Apify API error (${resp.status})`;
      return { source: 'jobbank', jobs: [], error: msg };
    }

    items = await resp.json();
    if (!Array.isArray(items)) {
      return { source: 'jobbank', jobs: [], error: 'Unexpected Apify response' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed';
    return { source: 'jobbank', jobs: [], error: `Apify request failed: ${msg}` };
  }

  const jobs = items
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title!.trim(),
      company: item.company?.trim() || undefined,
      location: item.location?.trim() || undefined,
      url: item.url!,
      source: 'jobbank' as const,
      salary: item.salary || undefined,
      description: item.descriptionText || undefined,
      posted_date: item.datePosted || undefined,
      country: 'ca',
    }));

  return { source: 'jobbank', jobs };
}

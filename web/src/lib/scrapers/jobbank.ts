import type { ScrapeParams, ScrapeResult } from './types';

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

  const query = params.keywords.join(' ');
  const searchUrl =
    `https://www.jobbank.gc.ca/jobsearch/jobsearch` +
    `?searchstring=${encodeURIComponent(query)}` +
    `&locationstring=${encodeURIComponent(params.location || '')}`;

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

  const items: ApifyJobbankItem[] = await resp.json();
  if (!Array.isArray(items)) {
    return { source: 'jobbank', jobs: [], error: 'Unexpected Apify response' };
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

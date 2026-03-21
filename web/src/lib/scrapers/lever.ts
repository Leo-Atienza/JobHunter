import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, normalizeJobType, matchesKeywords } from './utils';

const DEFAULT_COMPANIES = [
  'shopify', 'wealthsimple', 'clio', '1password', 'hopper', 'benevity',
  'vidyard', 'ada-support', 'koho', 'clearco', 'tophat', 'ecobee',
  'freshbooks', 'tulip', 'dnaspaces', 'properly', 'vena-solutions',
  'certn', 'jobber', 'neo-financial', 'faire', 'snapcommerce',
  'league', 'paytm-labs', 'plaid',
];

interface LeverPosting {
  text?: string;
  categories?: { location?: string; commitment?: string; team?: string; department?: string; level?: string };
  hostedUrl?: string; applyUrl?: string;
  descriptionPlain?: string;
  createdAt?: number;
}

export async function scrapeLever(params: ScrapeParams): Promise<ScrapeResult> {
  const companies = (params.config?.lever_companies as string[]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  // Process companies in batches of 5 to stay within timeout
  const batchSize = 5;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (slug) => {
        const qs = params.location ? `?mode=json&location=${encodeURIComponent(params.location)}` : '?mode=json';
        const postings = await fetchJson<LeverPosting[]>(
          `https://api.lever.co/v0/postings/${slug}${qs}`
        );
        if (!Array.isArray(postings)) return [];

        return postings.filter((p) => {
          const title = p.text?.trim();
          if (!title) return false;
          const cats = p.categories ?? {};
          const searchable = `${title} ${cats.team ?? ''} ${cats.department ?? ''}`;
          return matchesKeywords(searchable, params.keywords);
        }).map((p) => {
          const cats = p.categories ?? {};
          let posted_date: string | undefined;
          if (p.createdAt) {
            posted_date = new Date(p.createdAt).toISOString().split('T')[0];
          }
          const LEVEL_MAP: Record<string, string> = {
            entry: 'Entry', junior: 'Entry', mid: 'Mid', 'mid-level': 'Mid',
            senior: 'Senior', lead: 'Lead', principal: 'Principal', intern: 'Intern',
          };
          const level = cats.level?.toLowerCase().trim();
          return {
            title: p.text!.trim(),
            company: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            location: cats.location || undefined,
            url: (p.hostedUrl || p.applyUrl)!,
            source: 'lever' as const,
            description: p.descriptionPlain || undefined,
            posted_date,
            job_type: normalizeJobType(cats.commitment),
            experience_level: level ? LEVEL_MAP[level] ?? level : undefined,
          };
        }).filter((j) => j.url);
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') jobs.push(...r.value);
    }
  }

  return { source: 'lever', jobs };
}

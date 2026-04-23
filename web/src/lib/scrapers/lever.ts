import type { ScrapeParams, ScrapeResult } from './types';
import { normalizeJobType, matchesKeywords } from './utils';
import { stealthFetchJson } from './anti-detect';

// Verified active as of April 2026.
// Dead slugs removed: hopper, benevity, vidyard, ada-support, koho, clearco,
// tophat, ecobee, freshbooks, tulip, dnaspaces, properly, vena-solutions,
// certn, jobber, neo-financial, faire, snapcommerce, league, paytm-labs,
// shopify, 1password, clio (all 404 as of 2026-04-02).
const DEFAULT_COMPANIES = ['plaid', 'mistral', 'wealthsimple', 'netflix'];

interface LeverPosting {
  text?: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    department?: string;
    level?: string;
  };
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  createdAt?: number;
}

export async function scrapeLever(params: ScrapeParams): Promise<ScrapeResult> {
  const companies = (params.config?.lever_companies as string[]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  // All companies in parallel — each hits a different domain so no rate-limit concern.
  // Individual requests use stealthFetchJson's 10s timeout with retry.
  const results = await Promise.allSettled(
    companies.map(async (slug) => {
      const qs = params.location
        ? `?mode=json&location=${encodeURIComponent(params.location)}`
        : '?mode=json';
      const postings = await stealthFetchJson<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${slug}${qs}`,
      );
      if (!Array.isArray(postings)) return [];

      const LEVEL_MAP: Record<string, string> = {
        entry: 'Entry',
        junior: 'Entry',
        mid: 'Mid',
        'mid-level': 'Mid',
        senior: 'Senior',
        lead: 'Lead',
        principal: 'Principal',
        intern: 'Intern',
      };

      return postings
        .filter((p) => {
          const title = p.text?.trim();
          if (!title) return false;
          const cats = p.categories ?? {};
          const searchable = `${title} ${cats.team ?? ''} ${cats.department ?? ''}`;
          return matchesKeywords(searchable, params.keywords);
        })
        .map((p) => {
          const cats = p.categories ?? {};
          let posted_date: string | undefined;
          if (p.createdAt) {
            posted_date = new Date(p.createdAt).toISOString().split('T')[0];
          }
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
            experience_level: level ? (LEVEL_MAP[level] ?? level) : undefined,
          };
        })
        .filter((j) => j.url);
    }),
  );

  let failures = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') jobs.push(...r.value);
    else failures++;
  }

  const error =
    failures > 0
      ? jobs.length === 0
        ? `All ${failures} Lever boards failed`
        : `${failures} of ${companies.length} boards failed (${jobs.length} jobs from successful boards)`
      : undefined;

  return { source: 'lever', jobs, error };
}

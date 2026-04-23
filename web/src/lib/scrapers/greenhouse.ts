import type { ScrapeParams, ScrapeResult } from './types';
import { stripHtml, matchesKeywords, parseDate } from './utils';
import { stealthFetchJson } from './anti-detect';

// Verified active as of April 2026 via live HTTP 200 from
// boards-api.greenhouse.io. Mix of Canadian-HQ'd, Canadian-hiring, and
// remote-friendly US companies.
//
// Dead tokens removed (404 historical / confirmed gone): openai, notion,
// snowflake, plaid, ramp, zapier, supabase, replit (migrated to Ashby);
// lightspeedcommerce, nuvei, coveo, dapperlabs, applydigital, thinkific,
// trulioo, achievers, procurify, opentext, sap, ceridian.
const DEFAULT_COMPANIES = [
  // Existing tier — Canadian HQ / heavy Canadian hiring
  'gitlab',
  'grafanalabs',
  'stripe',
  'databricks',
  'datadog',
  'webflow',
  'anthropic',
  'elastic',
  'hootsuite',
  'benevity',
  'cloudflare',
  'postman',
  'unity3d',
  'figma',
  'flipp',
  'd2l',
  'fingerprint',
  'ritual',
  'lattice',
  // Added 2026-04-23 — verified live (HTTP 200), high-signal remote-friendly
  'airbnb',
  'coinbase',
  'robinhood',
  'gusto',
  'brex',
  'discord',
  'twitch',
  'reddit',
  'roblox',
  'dropbox',
  'samsara',
  'affirm',
  'vercel',
];

interface GreenhouseJob {
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  content?: string;
  updated_at?: string;
  created_at?: string;
  departments?: { name?: string }[];
}

export async function scrapeGreenhouse(params: ScrapeParams): Promise<ScrapeResult> {
  const companies = (params.config?.greenhouse_companies as string[]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  // All companies in parallel — each hits a different Greenhouse board.
  const results = await Promise.allSettled(
    companies.map(async (token) => {
      const data = await stealthFetchJson<{ jobs?: GreenhouseJob[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
      );
      return (data?.jobs ?? [])
        .filter((j) => {
          const title = j.title?.trim();
          if (!title || !j.absolute_url) return false;
          const depts = (j.departments ?? []).map((d) => d.name ?? '').join(' ');
          return matchesKeywords(`${title} ${depts}`, params.keywords);
        })
        .map((j) => ({
          title: j.title!.trim(),
          company: token.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          location: j.location?.name || undefined,
          url: j.absolute_url!,
          source: 'greenhouse' as const,
          description: j.content ? stripHtml(j.content) : undefined,
          posted_date: parseDate(j.updated_at || j.created_at),
        }));
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
        ? `All ${failures} Greenhouse boards failed`
        : `${failures} of ${companies.length} boards failed (${jobs.length} jobs from successful boards)`
      : undefined;

  return { source: 'greenhouse', jobs, error };
}

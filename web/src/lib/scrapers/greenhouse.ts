import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, stripHtml, matchesKeywords, parseDate } from './utils';

// Verified active as of 2026-04 — sorted by Canada-eligible job count.
// Dead tokens removed: lightspeedcommerce, nuvei, coveo, dapperlabs,
// applydigital, thinkific, trulioo, achievers, procurify, opentext,
// sap, benchsci, ceridian (all 404).
const DEFAULT_COMPANIES = [
  'gitlab', 'grafanalabs', 'stripe', 'databricks', 'datadog',
  'webflow', 'anthropic', 'elastic', 'hootsuite', 'benevity',
  'cloudflare', 'postman', 'unity3d', 'figma', 'flipp',
  'd2l', 'fingerprint', 'ritual', 'lattice', 'eventbase',
];

interface GreenhouseJob {
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  content?: string;
  updated_at?: string; created_at?: string;
  departments?: { name?: string }[];
}

export async function scrapeGreenhouse(params: ScrapeParams): Promise<ScrapeResult> {
  const companies = (params.config?.greenhouse_companies as string[]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  // All companies in parallel — each hits a different Greenhouse board.
  const results = await Promise.allSettled(
    companies.map(async (token) => {
      const data = await fetchJson<{ jobs?: GreenhouseJob[] }>(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
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
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') jobs.push(...r.value);
  }

  return { source: 'greenhouse', jobs };
}

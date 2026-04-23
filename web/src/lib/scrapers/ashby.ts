import type { ScrapeParams, ScrapeResult } from './types';
import { stripHtml, normalizeJobType, matchesKeywords, parseDate } from './utils';
import { stealthFetchJson } from './anti-detect';

// Verified active as of April 2026. Public job boards on Ashby
// (https://api.ashbyhq.com/posting-api/job-board/{slug}) — structured JSON,
// no auth required. Many tier-1 AI + dev-tooling companies migrated here from
// Greenhouse / Lever over the past two years.
const DEFAULT_COMPANIES = [
  // Original tier (2026-04-23)
  'openai',
  'cohere',
  'notion',
  'linear',
  'vercel',
  'supabase',
  'ramp',
  'posthog',
  'replit',
  'neon',
  'cursor',
  'mercury',
  'benchling',
  'retool',
  'runway',
  'perplexity',
  'vapi',
  'ashby',
  // Added 2026-04-23 Session 14 — each verified live with ≥2 active listings
  // AI infra / dev tools
  'character',
  'modal',
  'pinecone',
  'langchain',
  'warp',
  'browserbase',
  'elevenlabs',
  'granola',
  'dust',
  'tavus',
  'n8n',
  'anyscale',
  'mosaic',
  'pika',
  // Applied AI / vertical
  'harvey',
  'decagon',
  'sierra',
  // Product tools / fintech / HR
  'attio',
  'quora',
  'zip',
  'deel',
];

// Slug → display name overrides for brands that don't title-case cleanly.
const COMPANY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  posthog: 'PostHog',
  vapi: 'Vapi',
  vercel: 'Vercel',
  neon: 'Neon',
  ramp: 'Ramp',
  ashby: 'Ashby',
  elevenlabs: 'ElevenLabs',
  langchain: 'LangChain',
  n8n: 'n8n',
  character: 'Character.AI',
};

interface AshbyJob {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string }>;
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  address?: {
    postalAddress?: {
      addressRegion?: string;
      addressCountry?: string;
      addressLocality?: string;
    };
  };
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
}

function formatCompany(slug: string): string {
  return COMPANY_NAMES[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferCountry(addr: AshbyJob['address']): string | undefined {
  const raw = addr?.postalAddress?.addressCountry?.toLowerCase().trim();
  if (!raw) return undefined;
  if (raw === 'us' || raw === 'usa' || raw.includes('united states')) return 'us';
  if (raw === 'ca' || raw.includes('canada')) return 'ca';
  if (raw === 'uk' || raw === 'gb' || raw.includes('united kingdom')) return 'uk';
  return undefined;
}

/**
 * Scrape Ashby job boards — a growing ATS that replaced Greenhouse/Lever for
 * many AI-first companies (OpenAI, Cohere, Notion, Linear, Vercel, Supabase).
 * One request per company, all in parallel via Promise.allSettled.
 */
export async function scrapeAshby(params: ScrapeParams): Promise<ScrapeResult> {
  const companies = (params.config?.ashby_companies as string[]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  const results = await Promise.allSettled(
    companies.map(async (slug) => {
      const data = await stealthFetchJson<{ jobs?: AshbyJob[] }>(
        `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
      );
      return (data?.jobs ?? [])
        .filter((j) => {
          if (j.isListed === false) return false;
          const title = j.title?.trim();
          if (!title || !j.jobUrl) return false;
          const searchable = `${title} ${j.team ?? ''} ${j.department ?? ''}`;
          return matchesKeywords(searchable, params.keywords);
        })
        .map((j) => {
          const secondary = (j.secondaryLocations ?? [])
            .map((s) => s.location)
            .filter((l): l is string => !!l);
          const primary = j.isRemote
            ? 'Remote'
            : j.location || j.address?.postalAddress?.addressLocality || undefined;
          const location =
            secondary.length > 0 && primary ? `${primary} • ${secondary.join(', ')}` : primary;
          return {
            title: j.title!.trim(),
            company: formatCompany(slug),
            location,
            url: j.jobUrl!,
            source: 'ashby' as const,
            description: j.descriptionHtml ? stripHtml(j.descriptionHtml) : undefined,
            posted_date: parseDate(j.publishedAt),
            job_type: normalizeJobType(j.employmentType),
            country: inferCountry(j.address),
          };
        });
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
        ? `All ${failures} Ashby boards failed`
        : `${failures} of ${companies.length} boards failed (${jobs.length} jobs from successful boards)`
      : undefined;

  return { source: 'ashby', jobs, error };
}

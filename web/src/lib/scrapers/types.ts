/** Shared types for server-side scrapers. */

import type { JobInput } from '@/lib/types';

export interface ScrapeParams {
  keywords: string[];
  location: string;
  /** All searched cities */
  locations: string[];
  remote: boolean;
  country?: string;
  /** Optional config passed from session (e.g. company lists for ATS scrapers) */
  config?: Record<string, unknown>;
}

export interface ScrapeResult {
  source: string;
  jobs: JobInput[];
  error?: string;
  /** Actual API credits consumed (e.g. Firecrawl search calls). */
  credits_used?: number;
}

export type ScraperFn = (params: ScrapeParams) => Promise<ScrapeResult>;

/** Shared types for server-side scrapers. */

import type { JobInput } from '@/lib/types';

export interface ScrapeParams {
  keywords: string[];
  location: string;
  remote: boolean;
  country?: string;
  /** Natural language dream job description for AI scoring */
  dream_job?: string;
  /** Optional config passed from session (e.g. API keys from env) */
  config?: Record<string, unknown>;
}

export interface ScrapeResult {
  source: string;
  jobs: JobInput[];
  error?: string;
}

export type ScraperFn = (params: ScrapeParams) => Promise<ScrapeResult>;

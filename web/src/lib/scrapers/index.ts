/** Server-side scraper registry. */

import type { ScraperFn } from './types';
import { scrapeRemotive } from './remotive';
import { scrapeHimalayas } from './himalayas';
import { scrapeArbeitnow } from './arbeitnow';
import { scrapeJobicy } from './jobicy';
import { scrapeDevitjobs } from './devitjobs';
import { scrapeThemuse } from './themuse';
import { scrapeLever } from './lever';
import { scrapeGreenhouse } from './greenhouse';
import { scrapeWorkday } from './workday';
import { scrapeAdzuna } from './adzuna';
import { scrapeJooble } from './jooble';

/** All server-side scrapers keyed by source name. */
export const SERVER_SCRAPERS: Record<string, ScraperFn> = {
  remotive: scrapeRemotive,
  himalayas: scrapeHimalayas,
  arbeitnow: scrapeArbeitnow,
  jobicy: scrapeJobicy,
  devitjobs: scrapeDevitjobs,
  themuse: scrapeThemuse,
  lever: scrapeLever,
  greenhouse: scrapeGreenhouse,
  workday: scrapeWorkday,
  adzuna: scrapeAdzuna,
  jooble: scrapeJooble,
};

/** Sources that can run server-side (no browser needed). */
export const SERVER_SCRAPER_NAMES = Object.keys(SERVER_SCRAPERS);

/** Sources that still require the local Python scraper (browser-based). */
export const LOCAL_ONLY_SOURCES = ['linkedin', 'indeed', 'glassdoor'] as const;

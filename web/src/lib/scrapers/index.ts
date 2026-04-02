/** Server-side scraper registry. */

import type { ScraperFn } from './types';
import { scrapeRemotive } from './remotive';
import { scrapeHimalayas } from './himalayas';
import { scrapeJobicy } from './jobicy';
import { scrapeDevitjobs } from './devitjobs';
import { scrapeLever } from './lever';
import { scrapeGreenhouse } from './greenhouse';
import { scrapeAdzuna } from './adzuna';
import { scrapeJooble } from './jooble';
import { scrapeLinkedInPublic } from './linkedin-public';
import { scrapeFirecrawl } from './firecrawl';
import { scrapeJobbank } from './jobbank';
import { scrapeRemoteOK } from './remoteok';
import { scrapeWeWorkRemotely } from './weworkremotely';

/** All server-side scrapers keyed by source name. */
export const SERVER_SCRAPERS: Record<string, ScraperFn> = {
  jobbank: scrapeJobbank,
  remotive: scrapeRemotive,
  himalayas: scrapeHimalayas,
  jobicy: scrapeJobicy,
  devitjobs: scrapeDevitjobs,
  lever: scrapeLever,
  greenhouse: scrapeGreenhouse,
  adzuna: scrapeAdzuna,
  jooble: scrapeJooble,
  'linkedin-public': scrapeLinkedInPublic,
  firecrawl: scrapeFirecrawl,
  remoteok: scrapeRemoteOK,
  weworkremotely: scrapeWeWorkRemotely,
};

/** Sources that can run server-side (no browser needed). */
export const SERVER_SCRAPER_NAMES = Object.keys(SERVER_SCRAPERS);

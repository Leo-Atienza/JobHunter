import type { ScrapeParams, ScrapeResult } from './types';
import { normalizeJobType, parseDate, matchesKeywords } from './utils';
import { stealthFetchJson } from './anti-detect';

interface DevITJob {
  name?: string;
  company?: string;
  cityCategory?: string;
  stateCategory?: string;
  jobUrl?: string;
  redirectJobUrl?: string;
  remoteType?: string;
  workplace?: string;
  annualSalaryFrom?: number;
  annualSalaryTo?: number;
  jobType?: string;
  expLevel?: string;
  activeFrom?: string;
  technologies?: string[];
}

export async function scrapeDevitjobs(params: ScrapeParams): Promise<ScrapeResult> {
  const data = await stealthFetchJson<DevITJob[]>('https://devitjobs.com/api/jobslight');
  if (!Array.isArray(data))
    return { source: 'devitjobs', jobs: [], error: 'DevITjobs API unavailable' };

  const jobs = [];
  for (const item of data) {
    const title = item.name?.trim();
    if (!title) continue;

    const techs = (item.technologies ?? []).join(' ');
    if (!matchesKeywords(`${title} ${techs}`, params.keywords)) continue;

    const slug = item.jobUrl;
    if (!slug) continue;
    const url = item.redirectJobUrl || `https://devitjobs.com/jobs/${slug}`;

    const parts = [item.cityCategory, item.stateCategory].filter(Boolean);
    let location = parts.join(', ') || undefined;
    const remoteInfo = item.remoteType || item.workplace;
    if (remoteInfo) location = location ? `${location} (${remoteInfo})` : remoteInfo;

    let salary: string | undefined;
    if (item.annualSalaryFrom && item.annualSalaryTo) {
      salary = `$${item.annualSalaryFrom.toLocaleString()} - $${item.annualSalaryTo.toLocaleString()}/yr`;
    }

    jobs.push({
      title,
      company: item.company?.trim() || undefined,
      location,
      url,
      source: 'devitjobs' as const,
      salary,
      posted_date: parseDate(item.activeFrom),
      job_type: normalizeJobType(item.jobType),
      experience_level: item.expLevel?.trim() || undefined,
      skills: item.technologies?.join(', ') || undefined,
    });
  }

  return { source: 'devitjobs', jobs };
}

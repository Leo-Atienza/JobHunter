import type { ScrapeParams, ScrapeResult } from './types';
import { USER_AGENT, stripHtml, parseDate } from './utils';

interface CareerJetJob {
  title?: string;
  company?: string;
  locations?: string;
  date?: string;
  description?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency_code?: string;
  salary_type?: string;
  url?: string;
  site?: string;
}

interface CareerJetResponse {
  type?: string;
  jobs?: CareerJetJob[];
  hits?: number;
  pages?: number;
}

/**
 * CareerJet affiliate API scraper.
 * Free API — register at https://www.careerjet.com/partners/api
 * Requires CAREERJET_AFFID env var.
 */
export async function scrapeCareerjet(params: ScrapeParams): Promise<ScrapeResult> {
  const affid = process.env.CAREERJET_AFFID;
  if (!affid) {
    return { source: 'careerjet', jobs: [], error: 'No affiliate ID configured' };
  }

  const query = params.keywords.join(' ');
  const jobs = [];

  for (let page = 1; page <= 3; page++) {
    try {
      const searchParams = new URLSearchParams({
        affid,
        user_ip: '1.0.0.0', // placeholder — affiliate requirement
        user_agent: USER_AGENT,
        url: 'https://jobhunter.app',
        keywords: query,
        location: params.location || '',
        pagesize: '50',
        page: String(page),
        sort: 'date',
      });

      // Use locale for country filtering
      if (params.country) {
        const locale = COUNTRY_LOCALE[params.country.toUpperCase()] ?? 'en_WW';
        searchParams.set('locale_code', locale);
      }

      const resp = await fetch(
        `https://public.api.careerjet.net/search?${searchParams.toString()}`,
        {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!resp.ok) break;
      const data = (await resp.json()) as CareerJetResponse;

      if (data.type === 'ERROR' || !data.jobs?.length) break;

      for (const item of data.jobs) {
        const title = item.title?.trim();
        if (!title || !item.url?.trim()) continue;

        // Build salary string from parsed fields
        let salary: string | undefined;
        if (item.salary) {
          salary = item.salary;
        } else if (item.salary_min || item.salary_max) {
          const parts = [];
          if (item.salary_min) parts.push(String(item.salary_min));
          if (item.salary_max) parts.push(String(item.salary_max));
          const curr = item.salary_currency_code ?? '';
          const type = item.salary_type ?? 'year';
          salary = `${curr} ${parts.join(' - ')} / ${type}`.trim();
        }

        jobs.push({
          title,
          company: item.company?.trim() || undefined,
          location: item.locations?.trim() || undefined,
          url: item.url.trim(),
          source: 'careerjet' as const,
          salary,
          description: item.description ? stripHtml(item.description) : undefined,
          posted_date: parseDate(item.date),
        });
      }

      // Stop if we've fetched all pages
      if (data.pages && page >= data.pages) break;
    } catch {
      break;
    }
  }

  return { source: 'careerjet', jobs };
}

/** Map country codes to CareerJet locale codes. */
const COUNTRY_LOCALE: Record<string, string> = {
  US: 'en_US',
  CA: 'en_CA',
  GB: 'en_GB',
  UK: 'en_GB',
  AU: 'en_AU',
  NZ: 'en_NZ',
  IN: 'en_IN',
  DE: 'de_DE',
  FR: 'fr_FR',
  ES: 'es_ES',
  IT: 'it_IT',
  NL: 'nl_NL',
  BR: 'pt_BR',
  JP: 'ja_JP',
  KR: 'ko_KR',
  CN: 'zh_CN',
  SE: 'sv_SE',
  NO: 'no_NO',
  DK: 'da_DK',
  FI: 'fi_FI',
  PL: 'pl_PL',
  AT: 'de_AT',
  CH: 'de_CH',
  BE: 'fr_BE',
  IE: 'en_IE',
  SG: 'en_SG',
  MX: 'es_MX',
  AR: 'es_AR',
};

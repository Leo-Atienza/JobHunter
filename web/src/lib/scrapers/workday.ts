import type { ScrapeParams, ScrapeResult } from './types';
import { USER_AGENT, matchesKeywords } from './utils';

const DEFAULT_COMPANIES: [string, string, string][] = [
  ['RBC', 'https://rbc.wd3.myworkdayjobs.com', 'rbc/RBC'],
  ['TD Bank', 'https://td.wd3.myworkdayjobs.com', 'TD/tdcareers'],
  ['Telus', 'https://telus.wd3.myworkdayjobs.com', 'telus/careers'],
  ['Rogers', 'https://rogers.wd3.myworkdayjobs.com', 'rogerscommunications/RogersCommunicationsCareers'],
  ['Bell', 'https://bell.wd3.myworkdayjobs.com', 'bell/Careers'],
  ['Manulife', 'https://manulife.wd3.myworkdayjobs.com', 'manulife_Careers/Manulife_Careers'],
  ['Sun Life', 'https://sunlife.wd3.myworkdayjobs.com', 'sunlife/SunLifeFinancial'],
  ['Scotiabank', 'https://scotiabank.wd3.myworkdayjobs.com', 'scotiabank/scotiabankcareers'],
  ['CIBC', 'https://cibc.wd3.myworkdayjobs.com', 'cibc/searchCIBC'],
  ['Canada Post', 'https://canadapost.wd3.myworkdayjobs.com', 'canadapost/Canada_Post_Careers'],
  ['CGI', 'https://cgi.wd3.myworkdayjobs.com', 'cgi/CGICareers'],
];

interface WorkdayPosting {
  title?: string;
  locationsText?: string;
  externalPath?: string;
  postedOn?: string;
  bulletFields?: { type?: string; value?: string }[];
}

export async function scrapeWorkday(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const companies = (params.config?.workday_companies as [string, string, string][]) ?? DEFAULT_COMPANIES;
  const jobs = [];

  const batchSize = 3;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ([displayName, baseUrl, sitePath]) => {
        const apiUrl = `${baseUrl}/wday/cxs/${sitePath}/jobs`;
        const searchText = params.location ? `${query} ${params.location}` : query;
        const siteName = sitePath.split('/').pop()!;

        try {
          const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Origin: baseUrl,
              Referer: `${baseUrl}/${siteName}/`,
            },
            body: JSON.stringify({
              appliedFacets: {}, limit: 20, offset: 0, searchText,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!resp.ok) return [];
          const data = await resp.json() as { jobPostings?: WorkdayPosting[] };

          return (data.jobPostings ?? [])
            .filter((p) => {
              const title = p.title?.trim();
              if (!title || !p.externalPath) return false;
              const bullets = (p.bulletFields ?? []).map((b) => b.value ?? '').join(' ');
              return matchesKeywords(`${title} ${bullets}`, params.keywords);
            })
            .map((p) => {
              let location = p.locationsText;
              if (!location) {
                location = p.bulletFields?.find((b) => b.type === 'location')?.value;
              }
              return {
                title: p.title!.trim(),
                company: displayName,
                location: location || undefined,
                url: `${baseUrl}/${siteName}${p.externalPath}`,
                source: 'workday' as const,
                posted_date: p.postedOn || undefined,
              };
            });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`Workday scraper failed for ${displayName}: ${msg}`);
          return [];
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') jobs.push(...r.value);
    }
  }

  return { source: 'workday', jobs };
}

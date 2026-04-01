import type { ScrapeParams, ScrapeResult } from './types';
import { fetchJson, normalizeJobType, parseDate } from './utils';

const INDUSTRY_MAP: Record<string, string> = {
  software: 'dev-engineering', developer: 'dev-engineering', engineer: 'dev-engineering',
  devops: 'dev-engineering', data: 'data-science', analytics: 'data-science',
  design: 'design-multimedia', marketing: 'marketing', product: 'product-management',
  finance: 'finance-legal', hr: 'hr', sales: 'sales',
  customer: 'customer-success', writing: 'copywriting', qa: 'testing-qa',
};

const GEO_MAP: Record<string, string> = {
  ca: 'canada', us: 'usa', uk: 'uk', au: 'australia', de: 'germany', fr: 'france',
};

interface JobicyJob {
  jobTitle?: string; companyName?: string; jobGeo?: string;
  url?: string; annualSalaryMin?: number; annualSalaryMax?: number;
  salaryCurrency?: string; jobType?: string; jobLevel?: string;
  jobExcerpt?: string; pubDate?: string;
}

export async function scrapeJobicy(params: ScrapeParams): Promise<ScrapeResult> {
  const query = params.keywords.join(' ');
  const combined = query.toLowerCase();

  let industry: string | undefined;
  for (const [token, slug] of Object.entries(INDUSTRY_MAP)) {
    if (combined.includes(token)) { industry = slug; break; }
  }

  const geo = params.country ? GEO_MAP[params.country.toLowerCase()] : undefined;

  const buildUrl = (withIndustry: boolean) => {
    const p: string[] = [`count=50`, `tag=${encodeURIComponent(query)}`];
    if (geo) p.push(`geo=${geo}`);
    if (withIndustry && industry) p.push(`industry=${industry}`);
    return `https://jobicy.com/api/v2/remote-jobs?${p.join('&')}`;
  };

  const parseJobs = (items: JobicyJob[]) =>
    items.filter((i) => i.jobTitle?.trim() && i.url?.trim()).map((item) => {
      let salary: string | undefined;
      if (item.annualSalaryMin && item.annualSalaryMax) {
        const sym = item.salaryCurrency === 'USD' || item.salaryCurrency === 'CAD' ? '$' : `${item.salaryCurrency ?? ''} `;
        salary = `${sym}${item.annualSalaryMin.toLocaleString()} - ${sym}${item.annualSalaryMax.toLocaleString()}/yr`;
      }
      return {
        title: item.jobTitle!.trim(), company: item.companyName?.trim() || undefined,
        location: item.jobGeo?.trim() || 'Remote', url: item.url!.trim(),
        source: 'jobicy' as const, salary,
        description: item.jobExcerpt?.trim() || undefined,
        posted_date: parseDate(item.pubDate),
        job_type: normalizeJobType(item.jobType),
        experience_level: item.jobLevel?.trim() || undefined,
      };
    });

  // Try with industry filter first
  const resp = await fetchJson<{ jobs?: JobicyJob[] }>(buildUrl(true));
  // Check for HTML response (bot protection)
  const items = resp?.jobs ?? [];
  let jobs = parseJobs(items);

  if (!jobs.length && industry) {
    const fallback = await fetchJson<{ jobs?: JobicyJob[] }>(buildUrl(false));
    jobs = parseJobs(fallback?.jobs ?? []);
  }

  return { source: 'jobicy', jobs };
}

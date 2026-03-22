import type { ScrapeParams, ScrapeResult } from './types';
import { normalizeJobType, parseDate } from './utils';

interface USAJobsResult {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    PositionURI: string;
    PositionLocation: Array<{
      LocationName: string;
      CountryCode: string;
      CityName: string;
    }>;
    OrganizationName: string;
    DepartmentName: string;
    PositionSchedule: Array<{ Name: string }>;
    PositionOfferingType: Array<{ Name: string }>;
    QualificationSummary: string;
    PositionRemuneration: Array<{
      MinimumRange: string;
      MaximumRange: string;
      RateIntervalCode: string;
      Description: string;
    }>;
    PublicationStartDate: string;
    ApplicationCloseDate: string;
    PositionFormattedDescription: Array<{
      Content: string;
    }>;
    UserArea: {
      Details: {
        MajorDuties?: string[];
        JobSummary?: string;
      };
    };
  };
}

interface USAJobsResponse {
  SearchResult: {
    SearchResultCount: number;
    SearchResultCountAll: number;
    SearchResultItems: USAJobsResult[];
  };
}

/**
 * USAJobs.gov API scraper.
 * Free API — register at https://developer.usajobs.gov/
 * Requires USAJOBS_API_KEY and USAJOBS_EMAIL env vars.
 */
export async function scrapeUsajobs(params: ScrapeParams): Promise<ScrapeResult> {
  const apiKey = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;

  if (!apiKey || !email) {
    return { source: 'usajobs', jobs: [], error: 'No API key or email configured' };
  }

  const query = params.keywords.join(' ');
  const jobs = [];

  for (let page = 1; page <= 3; page++) {
    try {
      const searchParams = new URLSearchParams({
        Keyword: query,
        ResultsPerPage: '50',
        Page: String(page),
        SortField: 'DatePosted',
        SortDirection: 'Desc',
      });

      if (params.location) {
        searchParams.set('LocationName', params.location);
      }

      if (params.remote) {
        searchParams.set('RemoteIndicator', 'True');
      }

      const resp = await fetch(
        `https://data.usajobs.gov/api/search?${searchParams.toString()}`,
        {
          headers: {
            Host: 'data.usajobs.gov',
            'User-Agent': email,
            'Authorization-Key': apiKey,
          },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!resp.ok) break;
      const data = (await resp.json()) as USAJobsResponse;

      const items = data.SearchResult?.SearchResultItems ?? [];
      if (!items.length) break;

      for (const item of items) {
        const d = item.MatchedObjectDescriptor;
        const title = d.PositionTitle?.trim();
        if (!title || !d.PositionURI) continue;

        // Build location string
        const location = d.PositionLocation
          ?.map((loc) => loc.LocationName)
          .filter(Boolean)
          .join('; ') || undefined;

        // Build salary string
        let salary: string | undefined;
        const remuneration = d.PositionRemuneration?.[0];
        if (remuneration) {
          const min = remuneration.MinimumRange;
          const max = remuneration.MaximumRange;
          const rate = remuneration.RateIntervalCode === 'PA' ? '/year' :
                       remuneration.RateIntervalCode === 'PH' ? '/hour' :
                       `/${remuneration.RateIntervalCode}`;
          salary = `$${min} - $${max} ${rate}`;
        }

        // Build description
        const desc = d.UserArea?.Details?.JobSummary ||
                     d.QualificationSummary ||
                     d.PositionFormattedDescription?.[0]?.Content || undefined;

        // Determine job type from schedule
        const schedule = d.PositionSchedule?.[0]?.Name;
        const jobType = normalizeJobType(schedule);

        jobs.push({
          title,
          company: d.OrganizationName || d.DepartmentName || undefined,
          location,
          url: d.PositionURI,
          source: 'usajobs' as const,
          salary,
          description: desc ? desc.slice(0, 5000) : undefined,
          posted_date: parseDate(d.PublicationStartDate),
          job_type: jobType,
          country: 'US',
        });
      }

      // Stop if no more results
      if (items.length < 50) break;
    } catch {
      break;
    }
  }

  return { source: 'usajobs', jobs };
}

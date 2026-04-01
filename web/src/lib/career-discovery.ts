import Firecrawl from '@mendable/firecrawl-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

const COMMON_CAREER_PATHS = [
  '/careers',
  '/jobs',
  '/join',
  '/join-us',
  '/work-with-us',
  '/opportunities',
];

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function domainGuesses(company: string): string[] {
  const slug = slugify(company);
  const slugDashed = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const unique = new Set<string>();

  // Common domain patterns
  for (const base of [slug, slugDashed]) {
    unique.add(`${base}.com`);
  }
  // Also try .io, .co for tech companies
  unique.add(`${slug}.io`);
  unique.add(`${slug}.co`);

  return Array.from(unique);
}

/**
 * Try common career page URL patterns using HEAD requests.
 * Free — no API credits needed.
 */
export async function tryHeuristicUrls(company: string): Promise<string | null> {
  const domains = domainGuesses(company);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Build candidate URLs: each domain + each career path
    const candidates: string[] = [];
    for (const domain of domains) {
      for (const path of COMMON_CAREER_PATHS) {
        candidates.push(`https://${domain}${path}`);
      }
      // Also try careers subdomain
      candidates.push(`https://careers.${domain}`);
    }

    // Check candidates in parallel batches of 6 (avoid overwhelming)
    for (let i = 0; i < candidates.length; i += 6) {
      const batch = candidates.slice(i, i + 6);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'User-Agent': 'JobHunter/1.0 (career-page-discovery)' },
          });
          if (res.ok) return url;
          throw new Error(`${res.status}`);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          return result.value;
        }
      }
    }
  } catch {
    // Timeout or abort — fall through
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

/**
 * Search for a company's careers page via Firecrawl.
 * Costs 1 credit per call.
 */
export async function discoverViaFirecrawl(company: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null;

  try {
    const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });
    const query = `${company} careers page jobs apply`;

    const response = await firecrawl.search(query, {
      limit: 3,
    });

    // v2 SDK returns { web?: Array<SearchResultWeb | Document> }
    const webResults = response?.web ?? [];
    if (webResults.length === 0) return null;

    // Look for results whose URL contains career-related keywords
    const careerPatterns = /careers|jobs|join|hiring|opportunities|work-with|openings/i;

    for (const result of webResults) {
      const url = 'url' in result ? result.url : undefined;
      if (url && careerPatterns.test(url)) {
        return url;
      }
    }

    // If no career-specific URL found, return the first result URL
    const first = webResults[0];
    const firstUrl = 'url' in first ? first.url : undefined;
    return firstUrl ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('402')) {
      console.warn('Firecrawl credits exhausted for career discovery');
    }
    return null;
  }
}

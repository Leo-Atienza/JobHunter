/** Shared utilities for server-side scrapers. */

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/** Strip HTML tags from a string. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Fetch JSON with timeout and error handling. Returns null on failure. */
export async function fetchJson<T = unknown>(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<T | null> {
  const { timeout = 8000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...init.headers,
      },
    });
    if (!resp.ok) {
      console.warn(`fetchJson ${resp.status} ${resp.statusText} — ${url}`);
      return null;
    }
    return (await resp.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`fetchJson error — ${url}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Normalize job type strings to consistent format. */
const JOB_TYPE_MAP: Record<string, string> = {
  full_time: 'Full-time',
  'full-time': 'Full-time',
  fulltime: 'Full-time',
  'full time': 'Full-time',
  permanent: 'Full-time',
  part_time: 'Part-time',
  'part-time': 'Part-time',
  parttime: 'Part-time',
  'part time': 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  intern: 'Internship',
  freelance: 'Freelance',
};

export function normalizeJobType(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  return JOB_TYPE_MAP[raw.toLowerCase().trim()] ?? (raw.trim() || undefined);
}

/** Parse an ISO date string to YYYY-MM-DD. */
export function parseDate(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  if (raw.includes('T')) return raw.split('T')[0];
  return raw;
}

/** Check if any keyword token matches in text. */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const combined = keywords.join(' ').toLowerCase();
  const textLower = text.toLowerCase();

  // Full phrase match
  if (textLower.includes(combined)) return true;

  // Any token match (>= 2 chars so "IT", "QA", "ML" are included)
  const tokens = combined.split(/\s+/).filter((t) => t.length >= 2);
  return tokens.some((t) => textLower.includes(t));
}

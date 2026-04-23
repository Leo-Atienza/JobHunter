/**
 * Anti-detection utilities inspired by Botasaurus patterns.
 *
 * Centralizes: realistic browser fingerprinting, User-Agent rotation,
 * Google Referrer trick, human-like request timing, and retry with
 * exponential backoff + jitter.
 */

// ---------------------------------------------------------------------------
// User-Agent rotation — 8 recent Chrome versions across platforms
// ---------------------------------------------------------------------------

const USER_AGENTS = [
  // Chrome 124 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 123 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Chrome 124 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 123 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Chrome 124 — Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Firefox 125 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Firefox 125 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Edge 124 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
] as const;

/** Pick a random User-Agent for this request. */
export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------------------------------------------------------------------------
// Browser-realistic header sets — mimics real Chrome header ordering
// ---------------------------------------------------------------------------

interface HeaderPreset {
  /** Human-readable name for logging. */
  name: string;
  /** Generate headers for a given URL. */
  headers: (url: string) => Record<string, string>;
}

const CHROME_PRESET: HeaderPreset = {
  name: 'chrome-124',
  headers: (url) => ({
    'User-Agent': randomUserAgent(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  }),
};

const JSON_API_PRESET: HeaderPreset = {
  name: 'json-api',
  headers: (url) => ({
    'User-Agent': randomUserAgent(),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }),
};

const RSS_PRESET: HeaderPreset = {
  name: 'rss-feed',
  headers: (url) => ({
    'User-Agent': randomUserAgent(),
    Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  }),
};

/** Headers that look like a Google Referrer visit (bypasses Cloudflare connection challenges). */
const GOOGLE_REFERRER_PRESET: HeaderPreset = {
  name: 'google-referrer',
  headers: (url) => ({
    ...CHROME_PRESET.headers(url),
    Referer: 'https://www.google.com/',
    'Sec-Fetch-Site': 'cross-site',
  }),
};

export type HeaderMode = 'html' | 'json' | 'rss' | 'google-referrer';

const PRESETS: Record<HeaderMode, HeaderPreset> = {
  html: CHROME_PRESET,
  json: JSON_API_PRESET,
  rss: RSS_PRESET,
  'google-referrer': GOOGLE_REFERRER_PRESET,
};

/** Generate realistic browser headers for a request. */
export function browserHeaders(url: string, mode: HeaderMode = 'html'): Record<string, string> {
  return PRESETS[mode].headers(url);
}

// ---------------------------------------------------------------------------
// Human-like delay — random interval to avoid mechanical timing patterns
// ---------------------------------------------------------------------------

/**
 * Wait for a random duration between min and max milliseconds.
 * Simulates human browsing intervals between paginated requests.
 */
export function humanDelay(minMs = 300, maxMs = 900): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Fetch with retry, backoff, and anti-detection headers
// ---------------------------------------------------------------------------

export interface StealthFetchOptions {
  /** Header mode preset. Default: 'json' */
  mode?: HeaderMode;
  /** Maximum retry attempts on 403/429/5xx. Default: 2 */
  maxRetries?: number;
  /** Request timeout in ms. Default: 10000 */
  timeout?: number;
  /** Additional headers to merge (override preset). */
  headers?: Record<string, string>;
  /** HTTP method. Default: 'GET' */
  method?: string;
  /** Request body (for POST). */
  body?: string;
}

/**
 * Fetch with anti-detection headers + exponential backoff retry with jitter.
 *
 * Retries on: 403 (blocked), 429 (rate-limited), 5xx (server error).
 * Does NOT retry on: 404, 400, or other 4xx (genuine errors).
 */
export async function stealthFetch(
  url: string,
  options: StealthFetchOptions = {},
): Promise<Response> {
  const {
    mode = 'json',
    maxRetries = 2,
    timeout = 10_000,
    headers: extraHeaders = {},
    method = 'GET',
    body,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s... + random jitter 0-500ms
      const backoff = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, backoff));
    }

    try {
      const resp = await fetch(url, {
        method,
        body,
        headers: {
          ...browserHeaders(url, mode),
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(timeout),
      });

      // Retryable status codes
      if (
        (resp.status === 403 || resp.status === 429 || resp.status >= 500) &&
        attempt < maxRetries
      ) {
        console.warn(
          `stealthFetch ${resp.status} on attempt ${attempt + 1}/${maxRetries + 1} — ${url}`,
        );
        continue;
      }

      return resp;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        console.warn(
          `stealthFetch error on attempt ${attempt + 1}/${maxRetries + 1} — ${url}: ${lastError.message}`,
        );
        continue;
      }
    }
  }

  throw lastError ?? new Error(`stealthFetch failed after ${maxRetries + 1} attempts`);
}

/**
 * Fetch JSON with anti-detection. Drop-in replacement for fetchJson.
 * Returns null on failure (matches existing fetchJson contract).
 */
export async function stealthFetchJson<T = unknown>(
  url: string,
  options: StealthFetchOptions = {},
): Promise<T | null> {
  try {
    const resp = await stealthFetch(url, { mode: 'json', ...options });
    if (!resp.ok) {
      console.warn(`stealthFetchJson ${resp.status} ${resp.statusText} — ${url}`);
      return null;
    }
    return (await resp.json()) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`stealthFetchJson error — ${url}: ${msg}`);
    return null;
  }
}

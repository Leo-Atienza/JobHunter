/** Shared utilities for server-side scrapers. */

/** Strip HTML tags and decode common entities. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the text content of a plain XML tag. */
export function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

/** Extract CDATA content from an XML tag. */
export function extractCdata(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  return m ? m[1].trim() : null;
}

/** Safely parse a date string to YYYY-MM-DD, returning undefined on failure. */
export function safeParseDate(raw: string): string | undefined {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().split('T')[0];
  } catch {
    return undefined;
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

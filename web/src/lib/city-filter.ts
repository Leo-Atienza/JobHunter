/** Post-scrape city filter — keeps only jobs in the user's chosen city. */

const REMOTE_PATTERN = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bglobal\b|\bdistributed\b/i;

/** Country/region names that aren't cities. */
const NON_CITY_TERMS = new Set([
  'canada', 'united states', 'usa', 'us', 'uk', 'united kingdom',
  'australia', 'germany', 'france', 'india', 'deutschland', 'england',
  'britain', 'remote', 'anywhere', 'worldwide', 'global', 'distributed',
]);

/**
 * Extract the city name from a freetext location string like
 * "Toronto, ON", "San Francisco, CA", or "Vancouver, British Columbia".
 * Returns null if no city can be determined (e.g. "Canada", "Remote").
 */
export function extractCity(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const firstPart = trimmed.split(',')[0].trim();
  if (firstPart.length < 2) return null;

  if (NON_CITY_TERMS.has(firstPart.toLowerCase())) return null;
  if (REMOTE_PATTERN.test(firstPart)) return null;

  return firstPart.toLowerCase().replace(/-/g, ' ');
}

/**
 * Check if a job's location matches the session's city.
 * Returns true if the job should be kept.
 *
 * - Remote/WFH/anywhere jobs always pass (available to everyone).
 * - Jobs with no location are dropped (can't verify city).
 * - Otherwise the job location must contain the target city name.
 */
export function matchesCity(
  jobLocation: string | null | undefined,
  sessionLocation: string | null | undefined,
  isRemoteSearch: boolean,
): boolean {
  if (!sessionLocation) return true;

  const city = extractCity(sessionLocation);
  if (!city) return true; // Can't determine city — skip filter

  // No location on the job → can't verify
  if (!jobLocation) return false;

  const normalized = jobLocation.toLowerCase().replace(/-/g, ' ');

  // Remote jobs pass through — they're available anywhere
  if (REMOTE_PATTERN.test(normalized)) return true;

  // If the user explicitly wants remote jobs, also keep "Hybrid" in the target city
  // but still drop jobs in other cities that aren't remote
  if (isRemoteSearch && /\bhybrid\b/i.test(normalized)) {
    return normalized.includes(city);
  }

  return normalized.includes(city);
}

/**
 * Check if a job's location matches ANY of the session's cities.
 * Returns true if the job should be kept.
 *
 * - Remote/WFH/anywhere jobs always pass.
 * - Jobs with no location are dropped.
 * - Otherwise the job location must contain at least one target city name.
 * - Empty locations array = no filter (keep all).
 */
export function matchesAnyCity(
  jobLocation: string | null | undefined,
  sessionLocations: string[],
  isRemoteSearch: boolean,
): boolean {
  if (sessionLocations.length === 0) return true;

  const cities = sessionLocations
    .map((loc) => extractCity(loc))
    .filter((c): c is string => c !== null);

  if (cities.length === 0) return true; // Can't determine any city — skip filter

  if (!jobLocation) return false;

  const normalized = jobLocation.toLowerCase().replace(/-/g, ' ');

  // Remote jobs pass through — they're available anywhere
  if (REMOTE_PATTERN.test(normalized)) return true;

  // Hybrid jobs: only keep if they're in one of the target cities
  if (isRemoteSearch && /\bhybrid\b/i.test(normalized)) {
    return cities.some((city) => normalized.includes(city));
  }

  return cities.some((city) => normalized.includes(city));
}

/**
 * Build a SQL WHERE clause fragment for city filtering.
 * Returns { clause, params } where clause is empty string if no filter needed.
 * The paramIndex is the next $N placeholder index to use.
 *
 * Usage: `WHERE session_code = $1 ${clause}` with params appended.
 */
export function cityFilterSQL(
  sessionLocation: string | null | undefined,
  paramIndex: number,
): { clause: string; params: string[] } {
  if (!sessionLocation) return { clause: '', params: [] };

  const city = extractCity(sessionLocation);
  if (!city) return { clause: '', params: [] };

  // Keep jobs that: contain the city name (case-insensitive), OR are remote/wfh/anywhere, OR have no location (dropped at app layer)
  return {
    clause: ` AND (location ILIKE $${paramIndex} OR location ~* 'remote|work from home|wfh|anywhere|worldwide|global|distributed')`,
    params: [`%${city}%`],
  };
}

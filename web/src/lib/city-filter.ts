/** Post-scrape city filter — keeps only jobs in the user's chosen city. */

const REMOTE_PATTERN = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bglobal\b|\bdistributed\b/i;

/** Metro area aliases — searching "GTA" also matches Toronto, Mississauga, etc. */
const GTA_CITIES = ['toronto', 'mississauga', 'brampton', 'vaughan', 'markham', 'richmond hill', 'oakville', 'burlington', 'oshawa', 'pickering'];
const VANCOUVER_CITIES = ['vancouver', 'burnaby', 'surrey', 'richmond', 'coquitlam', 'langley', 'delta', 'north vancouver', 'west vancouver', 'new westminster', 'port moody', 'port coquitlam', 'maple ridge', 'white rock', 'abbotsford'];
const METRO_ALIASES: Record<string, string[]> = {
  'gta': GTA_CITIES,
  'greater toronto': GTA_CITIES,
  'greater toronto area': GTA_CITIES,
  'toronto': ['gta', 'greater toronto', 'mississauga', 'brampton', 'vaughan', 'markham', 'richmond hill', 'oakville', 'burlington', 'oshawa', 'pickering'],
  'lower mainland': VANCOUVER_CITIES,
  'metro vancouver': VANCOUVER_CITIES,
  'greater vancouver': VANCOUVER_CITIES,
  'vancouver': ['lower mainland', 'metro vancouver', 'burnaby', 'surrey', 'richmond', 'coquitlam', 'langley', 'delta', 'north vancouver', 'west vancouver', 'new westminster', 'port moody', 'port coquitlam', 'maple ridge', 'white rock', 'abbotsford'],
};

/** Expand a city into itself + all its metro aliases. */
export function expandCity(city: string): string[] {
  return [city, ...(METRO_ALIASES[city] ?? [])];
}

/** Check if a normalized job location matches any expanded city token. */
function cityTokensMatch(normalized: string, city: string): boolean {
  return expandCity(city).some((c) => normalized.includes(c));
}

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
  includeRemote: boolean = true,
): boolean {
  if (!sessionLocation) return true;

  const city = extractCity(sessionLocation);
  if (!city) return true; // Can't determine city — skip filter

  // No location on the job → can't verify
  if (!jobLocation) return false;

  const normalized = jobLocation.toLowerCase().replace(/-/g, ' ');

  // Remote jobs: only pass if included
  if (REMOTE_PATTERN.test(normalized)) return includeRemote;

  // If the user explicitly wants remote jobs, also keep "Hybrid" in the target city
  // but still drop jobs in other cities that aren't remote
  if (isRemoteSearch && /\bhybrid\b/i.test(normalized)) {
    return cityTokensMatch(normalized, city);
  }

  return cityTokensMatch(normalized, city);
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
  includeRemote: boolean = true,
): boolean {
  if (sessionLocations.length === 0) return true;

  const cities = sessionLocations
    .map((loc) => extractCity(loc))
    .filter((c): c is string => c !== null);

  if (cities.length === 0) return true; // Can't determine any city — skip filter

  if (!jobLocation) return false;

  const normalized = jobLocation.toLowerCase().replace(/-/g, ' ');

  // Remote jobs: only pass if included
  if (REMOTE_PATTERN.test(normalized)) return includeRemote;

  // Hybrid jobs: only keep if they're in one of the target cities
  if (isRemoteSearch && /\bhybrid\b/i.test(normalized)) {
    return cities.some((city) => cityTokensMatch(normalized, city));
  }

  return cities.some((city) => cityTokensMatch(normalized, city));
}

const REMOTE_SQL_PATTERN = "location ~* 'remote|work from home|wfh|anywhere|worldwide|global|distributed'";

/** Build ILIKE conditions for a set of city tokens, starting at paramIndex. */
function buildCityIlikeClauses(
  cityTokens: string[],
  paramIndex: number,
  includeRemote: boolean = true,
): { clause: string; params: string[] } {
  if (cityTokens.length === 0) return { clause: '', params: [] };

  const conditions = cityTokens.map((_, i) => `location ILIKE $${paramIndex + i}`);
  if (includeRemote) {
    conditions.push(REMOTE_SQL_PATTERN);
  }

  return {
    clause: ` AND (${conditions.join(' OR ')})`,
    params: cityTokens.map((c) => `%${c}%`),
  };
}

/**
 * Build a SQL WHERE clause fragment for city filtering (single location).
 * Returns { clause, params } where clause is empty string if no filter needed.
 * The paramIndex is the next $N placeholder index to use.
 *
 * Usage: `WHERE session_code = $1 ${clause}` with params appended.
 */
export function cityFilterSQL(
  sessionLocation: string | null | undefined,
  paramIndex: number,
  includeRemote: boolean = true,
): { clause: string; params: string[] } {
  if (!sessionLocation) return { clause: '', params: [] };

  const city = extractCity(sessionLocation);
  if (!city) return { clause: '', params: [] };

  const tokens = [...new Set(expandCity(city))];
  return buildCityIlikeClauses(tokens, paramIndex, includeRemote);
}

/**
 * Build a SQL WHERE clause fragment for multi-city filtering.
 * Expands all locations through metro aliases, deduplicates, and builds OR'd ILIKE conditions.
 */
export function cityFilterSQLMulti(
  locations: string[],
  paramIndex: number,
  includeRemote: boolean = true,
): { clause: string; params: string[] } {
  if (locations.length === 0) return { clause: '', params: [] };

  const allTokens = new Set<string>();
  for (const loc of locations) {
    const city = extractCity(loc);
    if (city) {
      for (const token of expandCity(city)) {
        allTokens.add(token);
      }
    }
  }

  if (allTokens.size === 0) return { clause: '', params: [] };

  return buildCityIlikeClauses([...allTokens], paramIndex, includeRemote);
}

/** Post-scrape country filter — drops jobs whose location doesn't match the session's country. */

interface CountryDef {
  names: string[];
  /** Positive match — location strings that indicate this country */
  pattern: RegExp;
}

/**
 * Country definitions. Patterns must be specific enough to avoid cross-country
 * false positives (e.g., "Vancouver, Washington" is US, not Canada).
 *
 * Strategy: match on "Country" or "City, Province/State" combos that are
 * unambiguous. Ambiguous city names (Hamilton, London, Victoria, Surrey)
 * only match when followed by a Canadian province.
 */
const COUNTRY_MAP: Record<string, CountryDef> = {
  ca: {
    names: ['canada'],
    pattern: new RegExp([
      '\\bcanada\\b',
      // Unambiguous Canadian cities
      '\\btoronto\\b', '\\bmontreal\\b', '\\bmontréal\\b', '\\bottawa\\b',
      '\\bcalgary\\b', '\\bedmonton\\b', '\\bwinnipeg\\b',
      '\\bmississauga\\b', '\\bbrampton\\b', '\\bkitchener\\b',
      '\\bsaskatoon\\b', '\\bregina\\b', '\\bquebec\\s*city\\b',
      // Province names
      '\\bontario\\b', '\\bbritish columbia\\b', '\\balberta\\b',
      '\\bsaskatchewan\\b', '\\bmanitoba\\b', '\\bnova scotia\\b',
      '\\bnew brunswick\\b', '\\bquebec\\b', '\\bquébec\\b',
      // Canadian province abbreviations (with comma prefix to avoid matching US states)
      ',\\s*on\\b', ',\\s*bc\\b', ',\\s*ab\\b', ',\\s*qc\\b',
      ',\\s*ns\\b', ',\\s*mb\\b', ',\\s*sk\\b', ',\\s*nb\\b',
      ',\\s*pe\\b', ',\\s*nl\\b',
    ].join('|'), 'i'),
  },
  us: {
    names: ['united states', 'usa', 'u.s.'],
    pattern: new RegExp([
      '\\bunited states\\b', '\\busa\\b', '\\bu\\.s\\.\\b',
      // Major unambiguous US cities
      '\\bnew york\\b', '\\bsan francisco\\b', '\\blos angeles\\b',
      '\\bchicago\\b', '\\bseattle\\b', '\\bboston\\b', '\\baustin\\b',
      '\\bdenver\\b', '\\bdallas\\b', '\\bhouston\\b', '\\bmiami\\b',
      '\\bphoenix\\b', '\\bphiladelphia\\b', '\\bsan diego\\b',
      '\\bsan jose\\b', '\\batlanta\\b', '\\bminneapolis\\b',
      '\\bportland\\b', '\\braleigh\\b', '\\bcharlotte\\b',
      // US state abbreviations (with comma prefix)
      ',\\s*(?:ny|ca|tx|wa|il|ma|co|ga|fl|pa|az|oh|nc|va|nj|mn|or|md|ct|mi|wi|mo|in|tn|sc|al|ky|la|ut|nv|nm|ne|ks|ar|ms|ia|ok|wv|id|nh|me|ri|mt|de|sd|nd|wy|hi|ak|dc|vt)\\b',
      // US state names
      '\\bcalifornia\\b', '\\btexas\\b', '\\bflorida\\b', '\\bgeorgia\\b',
      '\\bnorth carolina\\b', '\\bvirginia\\b', '\\bwashington\\b',
      '\\bmassachusetts\\b', '\\billinois\\b', '\\bcolorado\\b',
      '\\bpennsylvania\\b', '\\bnew jersey\\b', '\\bmaryland\\b',
      '\\bconnecticut\\b', '\\boregon\\b', '\\bminnesota\\b',
      '\\btennesee\\b', '\\bwisconsin\\b', '\\bmissouri\\b',
      '\\bindiana\\b', '\\bmichigan\\b', '\\bohio\\b',
      '\\bnew mexico\\b', '\\bnebraska\\b', '\\brhode island\\b',
    ].join('|'), 'i'),
  },
  uk: {
    names: ['united kingdom', 'uk', 'england', 'britain'],
    pattern: /\bunited kingdom\b|\bengland\b|\bbritain\b|\blondon,?\s*(?:uk|england|united kingdom)\b|\bmanchester\b|\bbirmingham,?\s*(?:uk|england)\b|\bleeds\b|\bbristol\b|\bedinburgh\b|\bglasgow\b|\bliverpool\b|\bcambridge,?\s*(?:uk|england)\b|\boxford,?\s*(?:uk|england)\b/i,
  },
  au: {
    names: ['australia'],
    pattern: /\baustralia\b|\bsydney\b|\bmelbourne\b|\bbrisbane\b|\bperth,?\s*(?:au|australia)\b|\badelaide\b|\bcanberra\b|,\s*(?:nsw|vic|qld)\b/i,
  },
  de: {
    names: ['germany', 'deutschland'],
    pattern: /\bgermany\b|\bdeutschland\b|\bberlin\b|\bmunich\b|\bmünchen\b|\bfrankfurt\b|\bhamburg\b|\bstuttgart\b|\bdüsseldorf\b|\bcologne\b|\bköln\b/i,
  },
  fr: {
    names: ['france'],
    pattern: /\bfrance\b|\bparis\b|\blyon\b|\bmarseille\b|\btoulouse\b|\bnantes\b|\bstrasbourg\b|\bbordeaux\b/i,
  },
  in: {
    names: ['india'],
    pattern: /\bindia\b|\bbangalore\b|\bbengaluru\b|\bmumbai\b|\bdelhi\b|\bnew delhi\b|\bhyderabad\b|\bchennai\b|\bpune\b|\bkolkata\b|\bgurgaon\b|\bgurugram\b|\bnoida\b/i,
  },
};

const REMOTE_PATTERN = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bglobal\b|\bdistributed\b/i;

/** Normalize hyphens to spaces so "New-York" matches "new york" patterns */
function normalizeLoc(loc: string): string {
  return loc.replace(/-/g, ' ');
}

/**
 * Check if a location string mentions a country OTHER than the target.
 * Used to reject "Berlin (Remote)" when user wants Canada.
 */
function mentionsOtherCountry(loc: string, sessionCountry: string): boolean {
  const normalized = normalizeLoc(loc);
  for (const [code, def] of Object.entries(COUNTRY_MAP)) {
    if (code === sessionCountry.toLowerCase()) continue;
    if (def.pattern.test(normalized)) return true;
  }
  return false;
}

/**
 * Check if a location string positively matches the target country.
 */
function matchesTarget(loc: string, def: CountryDef): boolean {
  return def.pattern.test(normalizeLoc(loc));
}

/**
 * Check if a job's location matches the session's country filter.
 * Returns true if the job should be kept.
 */
export function matchesCountry(
  jobLocation: string | null | undefined,
  jobCountry: string | null | undefined,
  sessionCountry: string | null | undefined,
): boolean {
  // No country filter set — keep everything
  if (!sessionCountry) return true;

  const sc = sessionCountry.toLowerCase();
  const def = COUNTRY_MAP[sc];
  if (!def) return true; // Unknown country code — don't filter

  const loc = jobLocation ?? '';

  // No location info at all — drop it (we can't verify country)
  if (!loc && !jobCountry) return false;

  // Check job's explicit country field first
  if (jobCountry) {
    const jc = jobCountry.toLowerCase();
    if (jc === sc) return true;
    if (def.names.some((n) => jc.includes(n))) return true;
    // If job has an explicit country that doesn't match, reject
    return false;
  }

  // Check if location positively matches the target country
  if (matchesTarget(loc, def)) {
    return true;
  }

  // If it's marked remote but doesn't mention our country,
  // only keep if it doesn't mention a different country either
  // "Remote" alone = keep, "Berlin (Remote)" = drop for CA users
  if (REMOTE_PATTERN.test(loc)) {
    // Pure remote with no city/country context — keep it
    const stripped = loc.replace(REMOTE_PATTERN, '').replace(/[(),\s-]+/g, ' ').trim();
    if (!stripped) return true; // just "Remote" or "Work from home"
    // Has city/place context — only keep if it matches our target country
    // This rejects "Gudow (Remote)" for CA users even if Gudow isn't in any map
    return matchesTarget(loc, def);
  }

  return false;
}

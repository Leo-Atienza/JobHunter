/** Post-scrape country filter — drops jobs whose location doesn't match the session's country. */

interface CountryDef {
  names: string[];
  pattern: RegExp;
}

const COUNTRY_MAP: Record<string, CountryDef> = {
  ca: {
    names: ['canada'],
    pattern: /\bcanada\b|\bca\b|\btoronto\b|\bvancouver\b|\bmontreal\b|\bmontréal\b|\bottawa\b|\bcalgary\b|\bedmonton\b|\bwinnipeg\b|\bquebec\b|\bquébec\b|\bontario\b|\bbritish columbia\b|\balberta\b|\bsaskatchewan\b|\bmanitoba\b|\bnova scotia\b|\bnew brunswick\b|\bhalifax\b|\bvictoria\b|\bsurrey\b|\bmississauga\b|\bbrampton\b|\bhamilton\b|\blondon, on\b|\bkitchener\b|\bwaterloo\b|\b, on\b|\b, bc\b|\b, ab\b|\b, qc\b|\b, ns\b|\b, mb\b|\b, sk\b|\b, nb\b/i,
  },
  us: {
    names: ['united states', 'usa', 'u.s.'],
    pattern: /\bunited states\b|\busa\b|\bu\.s\.\b|\bnew york\b|\bsan francisco\b|\blos angeles\b|\bchicago\b|\bseattle\b|\bboston\b|\baustin\b|\bdenver\b|\batlanta\b|\bdallas\b|\bhouston\b|\bmiami\b|\bphoenix\b|\bphiladelphia\b|\bsan diego\b|\bsan jose\b|\bwashington\b|\b, ca\b|\b, ny\b|\b, tx\b|\b, wa\b|\b, il\b|\b, ma\b|\b, co\b|\b, ga\b|\b, fl\b|\b, pa\b|\b, az\b|\b, oh\b|\b, nc\b|\b, va\b|\b, nj\b|\b, mn\b|\b, or\b|\b, md\b/i,
  },
  uk: {
    names: ['united kingdom', 'uk', 'england', 'britain'],
    pattern: /\bunited kingdom\b|\b\buk\b\b|\bengland\b|\bbritain\b|\blondon\b|\bmanchester\b|\bbirmingham\b|\bleeds\b|\bbristol\b|\bedinburgh\b|\bglasgow\b|\bliverpool\b|\bcambridge\b|\boxford\b/i,
  },
  au: {
    names: ['australia'],
    pattern: /\baustralia\b|\bsydney\b|\bmelbourne\b|\bbrisbane\b|\bperth\b|\badelaide\b|\bcanberra\b|\b, nsw\b|\b, vic\b|\b, qld\b|\b, wa\b/i,
  },
  de: {
    names: ['germany', 'deutschland'],
    pattern: /\bgermany\b|\bdeutschland\b|\bberlin\b|\bmunich\b|\bmünchen\b|\bfrankfurt\b|\bhamburg\b|\bstuttgart\b|\bdüsseldorf\b|\bcologne\b|\bköln\b/i,
  },
  fr: {
    names: ['france'],
    pattern: /\bfrance\b|\bparis\b|\blyon\b|\bmarseille\b|\btoulouse\b|\bnice\b|\bnantes\b|\bstrasbourg\b|\bbordeaux\b/i,
  },
  in: {
    names: ['india'],
    pattern: /\bindia\b|\bbangalore\b|\bbengaluru\b|\bmumbai\b|\bdelhi\b|\bnew delhi\b|\bhyderabad\b|\bchennai\b|\bpune\b|\bkolkata\b|\bgurgaon\b|\bgurugram\b|\bnoida\b/i,
  },
};

const REMOTE_PATTERN = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bglobal\b|\bdistributed\b/i;

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

  const def = COUNTRY_MAP[sessionCountry.toLowerCase()];
  if (!def) return true; // Unknown country code — don't filter

  // Remote jobs are valid for any country
  const loc = jobLocation ?? '';
  if (REMOTE_PATTERN.test(loc)) return true;

  // No location info at all — keep it (benefit of the doubt)
  if (!loc && !jobCountry) return true;

  // Check job's country field first
  if (jobCountry) {
    const jc = jobCountry.toLowerCase();
    if (jc === sessionCountry.toLowerCase()) return true;
    if (def.names.some((n) => jc.includes(n))) return true;
  }

  // Check location string against country pattern
  if (def.pattern.test(loc)) return true;

  return false;
}

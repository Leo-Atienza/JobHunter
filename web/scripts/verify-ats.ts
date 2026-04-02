/**
 * ATS company list verification script.
 *
 * Checks each Lever and Greenhouse company slug/token against their public
 * APIs to determine whether the board is still active, dead, or erroring.
 *
 * Run with:
 *   npx tsx web/scripts/verify-ats.ts
 */

// ─── Current company lists ────────────────────────────────────────────────────

const LEVER_CURRENT = ['plaid', 'mistral', 'wealthsimple', 'netflix'];

const LEVER_CANDIDATES = ['shopify', '1password', 'clio', 'faire', 'hopper', 'koho'];

const GREENHOUSE_CURRENT = [
  'gitlab', 'grafanalabs', 'stripe', 'databricks', 'datadog',
  'webflow', 'anthropic', 'elastic', 'hootsuite', 'benevity',
  'cloudflare', 'postman', 'unity3d', 'figma', 'flipp',
  'd2l', 'fingerprint', 'ritual', 'lattice', 'eventbase',
];

const GREENHOUSE_CANDIDATES = ['shopify', 'wattpad', 'freshbooks', 'koho', 'benchsci'];

// ─── Result types ─────────────────────────────────────────────────────────────

type Status = 'active' | 'dead' | 'error';

interface CheckResult {
  slug: string;
  status: Status;
  detail: string;
}

// ─── Lever check ─────────────────────────────────────────────────────────────

/**
 * Checks a single Lever company slug.
 * Active = HTTP 200 + response body is a JSON array.
 */
async function checkLever(slug: string): Promise<CheckResult> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { slug, status: 'dead', detail: `HTTP ${res.status}` };
    }
    const body = await res.json();
    if (!Array.isArray(body)) {
      return { slug, status: 'dead', detail: 'response is not an array' };
    }
    return { slug, status: 'active', detail: `${body.length} posting(s)` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { slug, status: 'error', detail: msg };
  }
}

// ─── Greenhouse check ─────────────────────────────────────────────────────────

/**
 * Checks a single Greenhouse board token.
 * Active = HTTP 200 + response body has a `jobs` array.
 */
async function checkGreenhouse(token: string): Promise<CheckResult> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { slug: token, status: 'dead', detail: `HTTP ${res.status}` };
    }
    const body = await res.json() as Record<string, unknown>;
    if (!Array.isArray(body?.jobs)) {
      return { slug: token, status: 'dead', detail: 'missing jobs array in response' };
    }
    return { slug: token, status: 'active', detail: `${(body.jobs as unknown[]).length} job(s)` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { slug: token, status: 'error', detail: msg };
  }
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/** Returns a formatted status icon + line for a single result. */
function formatResult(r: CheckResult): string {
  const icon = r.status === 'active' ? '✓' : r.status === 'dead' ? '✗' : '?';
  return `  ${icon} ${r.slug.padEnd(24)} ${r.detail}`;
}

/**
 * Prints a labelled section of results with a summary line at the end.
 */
function printSection(title: string, results: CheckResult[]): void {
  console.log(`\n${title}`);
  console.log('─'.repeat(50));
  for (const r of results) {
    console.log(formatResult(r));
  }
  const active = results.filter((r) => r.status === 'active').length;
  const dead = results.filter((r) => r.status === 'dead').length;
  const errors = results.filter((r) => r.status === 'error').length;
  console.log(`\n  Summary: ${active} active, ${dead} dead, ${errors} error`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('ATS Company List Verifier');
  console.log('='.repeat(50));
  console.log('Legend:  ✓ active   ✗ dead   ? error/timeout\n');

  // Run all checks in parallel — four independent groups.
  const [leverCurrent, leverCandidates, greenhouseCurrent, greenhouseCandidates] =
    await Promise.all([
      Promise.all(LEVER_CURRENT.map(checkLever)),
      Promise.all(LEVER_CANDIDATES.map(checkLever)),
      Promise.all(GREENHOUSE_CURRENT.map(checkGreenhouse)),
      Promise.all(GREENHOUSE_CANDIDATES.map(checkGreenhouse)),
    ]);

  printSection('Lever — Current list', leverCurrent);
  printSection('Lever — Candidates (potential additions)', leverCandidates);
  printSection('Greenhouse — Current list', greenhouseCurrent);
  printSection('Greenhouse — Candidates (potential additions)', greenhouseCandidates);

  // Emit actionable summary.
  const allLever = [...leverCurrent, ...leverCandidates];
  const allGreenhouse = [...greenhouseCurrent, ...greenhouseCandidates];

  const leverActive = allLever.filter((r) => r.status === 'active').map((r) => `'${r.slug}'`);
  const greenhouseActive = allGreenhouse.filter((r) => r.status === 'active').map((r) => `'${r.slug}'`);

  console.log('\n' + '='.repeat(50));
  console.log('Recommended lists (active only):');
  console.log(`\nLever:\n  [${leverActive.join(', ')}]`);
  console.log(`\nGreenhouse:\n  [${greenhouseActive.join(', ')}]`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

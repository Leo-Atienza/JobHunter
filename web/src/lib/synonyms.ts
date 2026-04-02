/**
 * Synonym map for common tech/IT job titles and skills.
 * Key = canonical term (lowercase), values = alternate terms.
 */
const SYNONYMS: Record<string, string[]> = {
  'it support': ['help desk', 'helpdesk', 'technical support', 'desktop support', 'service desk', 'end user support'],
  'software developer': ['software engineer', 'programmer', 'application developer', 'web developer'],
  'frontend': ['front-end', 'front end', 'ui developer', 'react developer'],
  'backend': ['back-end', 'back end', 'server side', 'api developer'],
  'full stack': ['fullstack', 'full-stack'],
  'devops': ['site reliability', 'sre', 'platform engineer', 'infrastructure engineer'],
  'data analyst': ['business analyst', 'data specialist', 'analytics engineer'],
  'data scientist': ['machine learning engineer', 'ml engineer', 'ai engineer'],
  'qa': ['quality assurance', 'test engineer', 'sdet', 'automation tester'],
  'project manager': ['program manager', 'scrum master', 'delivery manager'],
  'product manager': ['product owner'],
  'ux designer': ['ui designer', 'product designer', 'interaction designer'],
  'system administrator': ['sysadmin', 'systems administrator', 'infrastructure admin'],
  'network engineer': ['network administrator', 'network analyst'],
  'cybersecurity': ['information security', 'security analyst', 'security engineer'],
  'cloud engineer': ['cloud architect', 'aws engineer', 'azure engineer'],
  'database administrator': ['dba', 'database engineer'],
  'javascript': ['js', 'node.js', 'nodejs'],
  'typescript': ['ts'],
  'python': ['django', 'flask', 'fastapi'],
  'kubernetes': ['k8s'],
  'postgresql': ['postgres', 'psql'],
};

/**
 * Expand a search term with its synonyms (bidirectional).
 * Returns deduplicated array including the original term.
 */
export function expandWithSynonyms(term: string): string[] {
  const lower = term.toLowerCase().trim();
  if (!lower) return [];

  const results = new Set<string>([lower]);

  // Forward lookup: term is a canonical key
  const forward = SYNONYMS[lower];
  if (forward) {
    for (const s of forward) results.add(s);
  }

  // Reverse lookup: term appears as a value
  for (const [canonical, alts] of Object.entries(SYNONYMS)) {
    if (alts.includes(lower)) {
      results.add(canonical);
      for (const a of alts) results.add(a);
    }
  }

  return [...results];
}

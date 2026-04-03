/**
 * Synonym map for common tech/IT job titles and skills.
 * Key = canonical term (lowercase), values = alternate terms.
 */
const SYNONYMS: Record<string, string[]> = {
  // IT Support & ITSM
  'it support': ['help desk', 'helpdesk', 'technical support', 'desktop support', 'service desk', 'end user support'],
  'it technician': ['it specialist', 'it analyst', 'computer technician'],
  'it manager': ['it director', 'it operations manager', 'technology manager'],
  'service desk analyst': ['service desk technician', 'it service desk', 'itsm analyst'],

  // Software Development
  'software developer': ['software engineer', 'programmer', 'application developer', 'web developer'],
  'frontend': ['front-end', 'front end', 'ui developer', 'react developer'],
  'backend': ['back-end', 'back end', 'server side', 'api developer'],
  'full stack': ['fullstack', 'full-stack'],
  'mobile developer': ['ios developer', 'android developer', 'react native developer', 'flutter developer'],
  'embedded': ['embedded software', 'firmware engineer', 'embedded systems'],

  // DevOps & Infrastructure
  'devops': ['site reliability', 'sre', 'platform engineer', 'infrastructure engineer'],
  'system administrator': ['sysadmin', 'systems administrator', 'infrastructure admin', 'linux admin', 'windows admin'],
  'network engineer': ['network administrator', 'network analyst', 'network architect'],
  'cloud engineer': ['cloud architect', 'aws engineer', 'azure engineer', 'gcp engineer', 'cloud administrator'],

  // Data & AI
  'data analyst': ['business analyst', 'data specialist', 'analytics engineer', 'bi analyst', 'business intelligence'],
  'data scientist': ['machine learning engineer', 'ml engineer', 'ai engineer'],
  'data engineer': ['etl developer', 'data pipeline engineer', 'big data engineer'],
  'database administrator': ['dba', 'database engineer', 'database analyst'],

  // Security
  'cybersecurity': ['information security', 'security analyst', 'security engineer', 'infosec'],
  'security architect': ['security consultant', 'cybersecurity architect'],
  'soc analyst': ['security operations', 'incident response analyst', 'threat analyst'],
  'penetration tester': ['ethical hacker', 'security tester', 'pentest'],

  // Management & Leadership
  'project manager': ['program manager', 'scrum master', 'delivery manager'],
  'product manager': ['product owner'],
  'engineering manager': ['dev manager', 'development manager', 'software manager'],
  'technical lead': ['tech lead', 'team lead', 'lead developer', 'lead engineer'],
  'cto': ['chief technology officer', 'vp engineering', 'head of engineering'],

  // Design
  'ux designer': ['ui designer', 'product designer', 'interaction designer'],
  'ux researcher': ['user researcher', 'usability researcher'],

  // QA & Testing
  'qa': ['quality assurance', 'test engineer', 'sdet', 'automation tester'],
  'qa lead': ['test lead', 'qa manager', 'quality lead'],

  // Specialized Roles
  'solutions architect': ['technical architect', 'enterprise architect'],
  'technical writer': ['documentation specialist', 'content developer'],
  'business systems analyst': ['systems analyst', 'bsa', 'requirements analyst'],
  'erp consultant': ['sap consultant', 'oracle consultant', 'dynamics consultant', 'erp developer', 'erp analyst'],
  'salesforce': ['sfdc', 'salesforce administrator', 'salesforce developer', 'salesforce consultant'],
  'crm': ['customer relationship management', 'hubspot', 'dynamics 365'],
  'release manager': ['release engineer', 'build engineer', 'deployment engineer'],
  'it auditor': ['it compliance', 'it governance', 'grc analyst'],
  'change manager': ['change management', 'organizational change'],

  // Marketing Technology
  'marketing analyst': ['growth analyst', 'digital marketing analyst', 'marketing data analyst'],
  'seo specialist': ['seo analyst', 'search engine optimization', 'seo manager'],
  'marketing automation': ['marketo', 'pardot', 'eloqua', 'mailchimp developer'],
  'digital marketing': ['performance marketing', 'growth marketing', 'demand generation'],
  'content strategist': ['content manager', 'content marketing manager'],

  // ERP & Enterprise
  'sap': ['sap basis', 'sap abap', 'sap hana', 'sap fico', 'sap mm', 'sap sd'],
  'oracle': ['oracle dba', 'oracle cloud', 'oracle ebs', 'pl/sql'],
  'workday': ['workday consultant', 'workday integrations', 'workday hcm'],

  // Compliance & GRC
  'compliance analyst': ['compliance officer', 'regulatory analyst', 'risk analyst'],
  'privacy engineer': ['data privacy', 'gdpr specialist', 'privacy analyst'],

  // Languages & Frameworks
  'javascript': ['js', 'node.js', 'nodejs'],
  'typescript': ['ts'],
  'python': ['django', 'flask', 'fastapi'],
  'java': ['spring', 'spring boot'],
  'c#': ['csharp', '.net', 'dotnet', 'asp.net'],
  'c++': ['cpp', 'cplusplus'],
  'ruby': ['rails', 'ruby on rails'],
  'go': ['golang'],
  'rust': ['rustlang'],
  'php': ['laravel', 'symfony'],
  'swift': ['swiftui', 'swift developer'],
  'kotlin': ['kotlin developer', 'jetpack compose'],
  'scala': ['akka', 'spark developer'],
  'react': ['reactjs', 'react.js', 'next.js', 'nextjs'],
  'angular': ['angularjs', 'angular developer'],
  'vue': ['vuejs', 'vue.js', 'nuxt', 'nuxtjs'],

  // Infrastructure & Tools
  'kubernetes': ['k8s'],
  'docker': ['containerization', 'containers'],
  'terraform': ['infrastructure as code', 'iac', 'opentofu'],
  'ansible': ['configuration management', 'puppet', 'chef'],
  'postgresql': ['postgres', 'psql'],
  'mysql': ['mariadb'],
  'mongodb': ['mongo', 'nosql'],
  'redis': ['caching', 'in-memory database'],
  'elasticsearch': ['elastic', 'elk stack', 'opensearch'],
  'kafka': ['event streaming', 'message queue', 'rabbitmq'],
  'aws': ['amazon web services'],
  'azure': ['microsoft azure'],
  'gcp': ['google cloud', 'google cloud platform'],
  'servicenow': ['snow', 'itsm platform'],
  'jira': ['atlassian', 'confluence'],
  'git': ['github', 'gitlab', 'bitbucket', 'version control'],
  'ci/cd': ['jenkins', 'github actions', 'gitlab ci', 'circleci', 'continuous integration'],
  'grafana': ['prometheus', 'datadog', 'monitoring', 'observability'],
  'splunk': ['log management', 'siem', 'log analysis'],
  'power bi': ['tableau', 'looker', 'data visualization'],
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

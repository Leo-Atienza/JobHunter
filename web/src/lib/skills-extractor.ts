/**
 * Extracts skills and benefits from a job description using pattern matching.
 * No LLM needed — scans for section headers + bullet lists.
 */

// Common tech skills to look for in descriptions
const KNOWN_SKILLS = [
  // Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C#',
  'C\\+\\+',
  'Go',
  'Rust',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Scala',
  'R',
  // Frontend
  'React',
  'Angular',
  'Vue',
  'Next\\.js',
  'Svelte',
  'HTML',
  'CSS',
  'Tailwind',
  'SASS',
  'LESS',
  // Backend
  'Node\\.js',
  'Express',
  'Django',
  'Flask',
  'Spring',
  'Rails',
  'FastAPI',
  'ASP\\.NET',
  'Laravel',
  // Data
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Elasticsearch',
  'Kafka',
  'GraphQL',
  // Cloud/DevOps
  'AWS',
  'Azure',
  'GCP',
  'Docker',
  'Kubernetes',
  'Terraform',
  'CI/CD',
  'Jenkins',
  'GitHub Actions',
  // AI/ML
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Computer Vision',
  'TensorFlow',
  'PyTorch',
  'LLM',
  // General
  'REST',
  'API',
  'Microservices',
  'Agile',
  'Scrum',
  'Git',
  'Linux',
  'Figma',
];

const SKILLS_SECTION_PATTERN =
  /(?:requirements|qualifications|skills|what you(?:'|')ll need|must have|what you bring|tech stack|technologies|preferred qualifications|key skills|technical skills|required skills)\s*[:—\-\n]/i;

const BENEFITS_SECTION_PATTERN =
  /(?:benefits|perks|what we offer|why join|compensation|we offer|our benefits|employee benefits|what's in it for you)\s*[:—\-\n]/i;

/**
 * Extract skills from a job description.
 * Strategy: look for a skills/requirements section first, then fall back to keyword scanning.
 */
export function extractSkills(description: string | null | undefined): string | null {
  if (!description || description.length < 50) return null;

  const found = new Set<string>();

  // Strategy 1: Find skills section and extract bullet items
  const skillsMatch = SKILLS_SECTION_PATTERN.exec(description);
  if (skillsMatch) {
    const sectionStart = skillsMatch.index + skillsMatch[0].length;
    // Grab text until next section header or end (max 2000 chars)
    const sectionText = description.slice(sectionStart, sectionStart + 2000);
    const nextSection = sectionText.search(
      /\n\s*(?:about|responsibilities|duties|description|role|benefits|perks|what we offer|who you are|how to apply|salary|compensation|location)\s*[:—\-\n]/i,
    );
    const relevantText = nextSection > 0 ? sectionText.slice(0, nextSection) : sectionText;

    // Extract bullet items from the section
    const bullets: string[] = [];
    let m: RegExpExecArray | null;
    const bulletRegex = /(?:^|\n)\s*[•·▪▸►●○◆\-–—*]\s*(.+)/g;
    while ((m = bulletRegex.exec(relevantText)) !== null) {
      bullets.push(m[1].trim());
    }

    // If we found bullets, extract skills from them
    if (bullets.length > 0) {
      for (const bullet of bullets) {
        for (const skill of KNOWN_SKILLS) {
          const re = new RegExp(`\\b${skill}\\b`, 'i');
          if (re.test(bullet)) {
            // Use canonical casing
            const canonical = skill.replace(/\\\./g, '.').replace(/\\\+/g, '+');
            found.add(canonical);
          }
        }
        // Also extract short phrases from bullets that look like skills
        // e.g., "3+ years of experience with React" → "React"
        // Already handled by KNOWN_SKILLS scan above
      }
    }
  }

  // Strategy 2: Scan entire description for known skills (catches cases without sections)
  if (found.size < 3) {
    for (const skill of KNOWN_SKILLS) {
      const re = new RegExp(`\\b${skill}\\b`, 'i');
      if (re.test(description)) {
        const canonical = skill.replace(/\\\./g, '.').replace(/\\\+/g, '+');
        found.add(canonical);
      }
    }
  }

  if (found.size === 0) return null;
  return Array.from(found).slice(0, 20).join(', ');
}

/**
 * Extract benefits from a job description.
 * Looks for a benefits/perks section and extracts bullet items.
 */
export function extractBenefits(description: string | null | undefined): string | null {
  if (!description || description.length < 50) return null;

  const benefitsMatch = BENEFITS_SECTION_PATTERN.exec(description);
  if (!benefitsMatch) return null;

  const sectionStart = benefitsMatch.index + benefitsMatch[0].length;
  const sectionText = description.slice(sectionStart, sectionStart + 2000);

  // Find end of benefits section
  const nextSection = sectionText.search(
    /\n\s*(?:about|requirements|qualifications|responsibilities|skills|description|role|who you are|how to apply|location)\s*[:—\-\n]/i,
  );
  const relevantText = nextSection > 0 ? sectionText.slice(0, nextSection) : sectionText;

  // Extract bullet items
  const bullets: string[] = [];
  let m: RegExpExecArray | null;
  const bulletRegex = /(?:^|\n)\s*[•·▪▸►●○◆\-–—*]\s*(.+)/g;
  while ((m = bulletRegex.exec(relevantText)) !== null) {
    const item = m[1].trim();
    if (item.length > 5 && item.length < 200) {
      bullets.push(item);
    }
  }

  if (bullets.length === 0) {
    // Fall back to splitting by newlines for non-bulleted lists
    const lines = relevantText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 10 && l.length < 200);
    if (lines.length > 0 && lines.length <= 15) {
      return lines.slice(0, 10).join('; ');
    }
    return null;
  }

  return bullets.slice(0, 10).join('; ');
}

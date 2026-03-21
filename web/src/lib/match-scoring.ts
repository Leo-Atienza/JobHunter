import type { ResumeProfile } from './types';

interface JobScoreInput {
  title: string;
  skills: string | null;
  description: string | null;
  experience_level: string | null;
}

/**
 * Compute a 0-100 match score between a resume profile and a job.
 * Pure function — no API calls, no side effects.
 *
 * Breakdown:
 *   Skill overlap:       50 pts
 *   Title relevance:     20 pts
 *   Description keywords: 20 pts
 *   Experience fit:      10 pts
 */
export function computeMatchScore(resume: ResumeProfile, job: JobScoreInput): number {
  const skillScore = scoreSkillOverlap(resume.skills, job.skills);
  const titleScore = scoreTitleRelevance(resume.titles, job.title);
  const descScore = scoreDescriptionKeywords(resume.skills, job.description);
  const expScore = scoreExperienceFit(resume.experience_years, job.experience_level);

  return Math.min(100, Math.round(skillScore + titleScore + descScore + expScore));
}

/** Normalize a string for matching: lowercase, trim, collapse whitespace */
function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Split comma/semicolon separated skills into a normalized set */
function parseSkills(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => norm(s))
    .filter((s) => s.length > 1);
}

/**
 * Skill overlap: 50 pts max
 * Checks how many of the job's listed skills match the resume skills.
 * Uses both exact match and substring containment.
 */
function scoreSkillOverlap(resumeSkills: string[], jobSkillsRaw: string | null): number {
  if (!jobSkillsRaw || resumeSkills.length === 0) return 0;

  const jobSkills = parseSkills(jobSkillsRaw);
  if (jobSkills.length === 0) return 0;

  const resumeNorm = resumeSkills.map(norm);

  let matched = 0;
  for (const jobSkill of jobSkills) {
    const isMatch = resumeNorm.some(
      (rs) => rs === jobSkill || rs.includes(jobSkill) || jobSkill.includes(rs),
    );
    if (isMatch) matched++;
  }

  return Math.min(50, (matched / jobSkills.length) * 50);
}

/**
 * Title relevance: 20 pts max
 * Fuzzy match resume job titles against the job's title.
 * Exact substring = 20, word overlap = proportional, none = 0.
 */
function scoreTitleRelevance(resumeTitles: string[], jobTitle: string): number {
  if (resumeTitles.length === 0) return 0;

  const jobNorm = norm(jobTitle);
  const jobWords = new Set(jobNorm.split(/\s+/).filter((w) => w.length > 2));

  let bestScore = 0;

  for (const title of resumeTitles) {
    const titleNorm = norm(title);

    // Exact substring match — full points
    if (jobNorm.includes(titleNorm) || titleNorm.includes(jobNorm)) {
      return 20;
    }

    // Word overlap
    const titleWords = titleNorm.split(/\s+/).filter((w) => w.length > 2);
    if (titleWords.length === 0) continue;

    let overlap = 0;
    for (const tw of titleWords) {
      if (jobWords.has(tw)) overlap++;
    }

    const score = (overlap / titleWords.length) * 20;
    if (score > bestScore) bestScore = score;
  }

  return Math.round(bestScore);
}

/**
 * Description keywords: 20 pts max
 * How many resume skills appear anywhere in the job description.
 */
function scoreDescriptionKeywords(resumeSkills: string[], description: string | null): number {
  if (!description || resumeSkills.length === 0) return 0;

  const descNorm = norm(description);
  let found = 0;

  for (const skill of resumeSkills) {
    if (descNorm.includes(norm(skill))) {
      found++;
    }
  }

  return Math.min(20, (found / resumeSkills.length) * 20);
}

/**
 * Experience fit: 10 pts max
 * Maps resume years → expected level, compares to job's experience_level.
 * Exact match = 10, adjacent = 5, far = 0.
 */
function scoreExperienceFit(years: number | null, jobLevel: string | null): number {
  if (years === null || !jobLevel) return 5; // neutral if unknown

  const levelNorm = norm(jobLevel);

  // Map experience years to a numeric tier
  const resumeTier = yearToTier(years);

  // Map job level string to tier
  const jobTier = levelStringToTier(levelNorm);

  if (jobTier === null) return 5; // can't determine, neutral

  const diff = Math.abs(resumeTier - jobTier);
  if (diff === 0) return 10;
  if (diff === 1) return 5;
  return 0;
}

function yearToTier(years: number): number {
  if (years <= 1) return 0; // intern/entry
  if (years <= 3) return 1; // junior
  if (years <= 6) return 2; // mid
  if (years <= 10) return 3; // senior
  return 4; // lead/principal
}

function levelStringToTier(level: string): number | null {
  if (/intern|trainee|co-?op|student/.test(level)) return 0;
  if (/entry|junior|jr|associate|graduate/.test(level)) return 1;
  if (/mid|intermediate|regular/.test(level)) return 2;
  if (/senior|sr|experienced|staff/.test(level)) return 3;
  if (/lead|principal|director|manager|executive|vp|chief|head/.test(level)) return 4;
  return null;
}

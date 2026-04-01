import { describe, it, expect } from 'vitest';
import { extractSkills, extractBenefits } from './skills-extractor';

describe('extractSkills', () => {
  it('returns null for empty/short input', () => {
    expect(extractSkills(null)).toBeNull();
    expect(extractSkills(undefined)).toBeNull();
    expect(extractSkills('short')).toBeNull();
  });

  it('extracts known skills from description text', () => {
    const desc = `
      We are looking for a Full Stack Developer.
      Requirements:
      - 3+ years of experience with React and TypeScript
      - Experience with Node.js and PostgreSQL
      - Familiarity with Docker and AWS
      - Knowledge of Git and CI/CD pipelines
    `;
    const skills = extractSkills(desc);
    expect(skills).not.toBeNull();
    expect(skills).toContain('React');
    expect(skills).toContain('TypeScript');
    expect(skills).toContain('Node.js');
    expect(skills).toContain('PostgreSQL');
  });

  it('falls back to keyword scanning when no section header', () => {
    const desc = `
      This role involves building web applications using Python and Django.
      You will work with PostgreSQL databases and deploy using Docker containers on AWS.
      Good understanding of REST APIs and GraphQL is a plus.
    `;
    const skills = extractSkills(desc);
    expect(skills).not.toBeNull();
    expect(skills).toContain('Python');
    expect(skills).toContain('Django');
  });

  it('limits to 20 skills max', () => {
    const desc = `
      Requirements:
      - JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, PHP, Swift, Kotlin
      - React, Angular, Vue, Next.js, Svelte, HTML, CSS, Tailwind
      - Node.js, Express, Django, Flask, Spring
    `;
    const skills = extractSkills(desc);
    expect(skills).not.toBeNull();
    const count = skills!.split(', ').length;
    expect(count).toBeLessThanOrEqual(20);
  });
});

describe('extractBenefits', () => {
  it('returns null for empty input', () => {
    expect(extractBenefits(null)).toBeNull();
    expect(extractBenefits(undefined)).toBeNull();
  });

  it('extracts bullet benefits from a benefits section', () => {
    const desc = `
      About the Role:
      We need a developer.

      Benefits:
      - Health insurance
      - 401k matching
      - Remote work flexibility
      - Unlimited PTO
    `;
    const benefits = extractBenefits(desc);
    expect(benefits).not.toBeNull();
    expect(benefits).toContain('Health insurance');
    expect(benefits).toContain('401k matching');
  });

  it('returns null when no benefits section', () => {
    const desc = `
      We are looking for a talented engineer to join our team.
      You will build amazing products. Requirements include React and TypeScript.
    `;
    expect(extractBenefits(desc)).toBeNull();
  });
});

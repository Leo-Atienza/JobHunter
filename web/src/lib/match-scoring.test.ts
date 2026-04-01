import { describe, it, expect } from 'vitest';
import { computeMatchScore } from './match-scoring';
import type { ResumeProfile } from './types';

function makeResume(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
  return {
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    titles: ['Software Engineer'],
    experience_years: 4,
    summary: 'Full stack developer with 4 years of experience',
    ...overrides,
  };
}

describe('computeMatchScore', () => {
  it('returns 0-100 range', () => {
    const score = computeMatchScore(makeResume(), {
      title: 'Software Engineer',
      skills: 'React, TypeScript, Node.js, PostgreSQL',
      description: 'We use React and TypeScript with Node.js and PostgreSQL',
      experience_level: 'Mid',
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores high for perfect match', () => {
    const score = computeMatchScore(makeResume(), {
      title: 'Software Engineer',
      skills: 'React, TypeScript, Node.js, PostgreSQL',
      description: 'Build with React, TypeScript, Node.js, PostgreSQL',
      experience_level: 'Mid',
    });
    expect(score).toBeGreaterThan(70);
  });

  it('scores low for no overlap', () => {
    const score = computeMatchScore(makeResume(), {
      title: 'Marketing Manager',
      skills: 'SEO, Google Ads, Content Marketing',
      description: 'Manage marketing campaigns and ad spend',
      experience_level: 'Senior',
    });
    expect(score).toBeLessThan(30);
  });

  it('handles null skills gracefully', () => {
    const score = computeMatchScore(makeResume(), {
      title: 'Developer',
      skills: null,
      description: null,
      experience_level: null,
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('gives partial credit for some skill overlap', () => {
    const score = computeMatchScore(makeResume(), {
      title: 'Frontend Developer',
      skills: 'React, Vue, Angular, CSS',
      description: 'Frontend work with React',
      experience_level: 'Mid',
    });
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(80);
  });

  it('gives experience fit points for matching tier', () => {
    const midScore = computeMatchScore(makeResume({ experience_years: 4 }), {
      title: 'Dev',
      skills: null,
      description: null,
      experience_level: 'Mid',
    });
    const seniorScore = computeMatchScore(makeResume({ experience_years: 4 }), {
      title: 'Dev',
      skills: null,
      description: null,
      experience_level: 'Senior',
    });
    expect(midScore).toBeGreaterThan(seniorScore);
  });
});

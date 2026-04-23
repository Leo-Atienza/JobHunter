import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  sanitize,
  generateCsv,
  getSourceDisplayName,
  getSourceColor,
} from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end');
  });
});

describe('formatDate', () => {
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('returns "Just now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(formatDate(now)).toBe('Just now');
  });

  it('returns relative format for recent dates', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(formatDate(twoHoursAgo)).toBe('2h ago');
  });
});

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<b>hello</b> <script>alert(1)</script>')).toBe('hello alert(1)');
  });

  it('limits length', () => {
    expect(sanitize('a'.repeat(200), 10)).toBe('a'.repeat(10));
  });
});

describe('generateCsv', () => {
  it('produces valid CSV', () => {
    const csv = generateCsv(
      ['Name', 'Age'],
      [
        ['Alice', '30'],
        ['Bob', '25'],
      ],
    );
    expect(csv).toBe('Name,Age\nAlice,30\nBob,25');
  });

  it('escapes commas and quotes', () => {
    const csv = generateCsv(['Val'], [['hello, "world"']]);
    expect(csv).toBe('Val\n"hello, ""world"""');
  });
});

describe('getSourceDisplayName', () => {
  it('returns human name for known sources', () => {
    expect(getSourceDisplayName('linkedin')).toBe('LinkedIn');
    expect(getSourceDisplayName('jobbank')).toBe('Job Bank');
    expect(getSourceDisplayName('linkedin-public')).toBe('LinkedIn');
  });

  it('capitalizes unknown sources', () => {
    expect(getSourceDisplayName('newsite')).toBe('Newsite');
  });
});

describe('getSourceColor', () => {
  it('returns colors for known sources', () => {
    const color = getSourceColor('linkedin');
    expect(color.bg).toContain('blue');
    expect(color.text).toContain('blue');
  });

  it('returns slate for unknown sources', () => {
    const color = getSourceColor('unknown');
    expect(color.bg).toContain('slate');
  });
});

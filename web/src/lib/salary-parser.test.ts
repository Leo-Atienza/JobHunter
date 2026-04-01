import { describe, it, expect } from 'vitest';
import { parseSalary } from './salary-parser';

describe('parseSalary', () => {
  it('returns nulls for empty input', () => {
    expect(parseSalary(null)).toEqual({ min: null, max: null });
    expect(parseSalary(undefined)).toEqual({ min: null, max: null });
    expect(parseSalary('')).toEqual({ min: null, max: null });
  });

  it('parses range "$80,000 - $120,000"', () => {
    expect(parseSalary('$80,000 - $120,000')).toEqual({ min: 80000, max: 120000 });
  });

  it('parses "k" suffix "$80k-120k"', () => {
    expect(parseSalary('$80k-120k')).toEqual({ min: 80000, max: 120000 });
  });

  it('parses hourly "$50/hr" to annual', () => {
    const result = parseSalary('$50/hr');
    expect(result.min).toBe(50 * 40 * 52);
    expect(result.max).toBe(50 * 40 * 52);
  });

  it('parses "From $80,000" as single value', () => {
    expect(parseSalary('From $80,000')).toEqual({ min: 80000, max: 80000 });
  });

  it('parses "Up to $120,000"', () => {
    expect(parseSalary('Up to $120,000')).toEqual({ min: 120000, max: 120000 });
  });

  it('handles reversed range (min > max)', () => {
    const result = parseSalary('$120,000 - $80,000');
    expect(result.min).toBe(80000);
    expect(result.max).toBe(120000);
  });

  it('detects hourly via "per hour"', () => {
    const result = parseSalary('$35 per hour');
    expect(result.min).toBe(35 * 40 * 52);
  });

  it('treats small numbers as hourly (implicit conversion)', () => {
    const result = parseSalary('$25 - $35');
    expect(result.min).toBe(25 * 40 * 52);
    expect(result.max).toBe(35 * 40 * 52);
  });
});

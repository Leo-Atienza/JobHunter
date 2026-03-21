/**
 * Parse free-text salary strings into numeric min/max (annual, in USD-equivalent).
 *
 * Handles formats like:
 *   "$80,000 - $120,000"
 *   "$80k-120k"
 *   "$50/hr"
 *   "From $80,000"
 *   "Up to $120,000"
 *   "120,000 CAD"
 *   "$80,000 - $120,000/yr"
 *   "$80,000 (YEARLY)"
 */
export function parseSalary(raw: string | null | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };

  const text = raw.replace(/,/g, '').toLowerCase().trim();
  if (!text) return { min: null, max: null };

  // Detect hourly rate
  const isHourly = /\/\s*h(ou)?r|per\s*hour|hourly/i.test(text);

  // Extract all numbers (with optional k suffix)
  const numberPattern = /\$?\s*(\d+(?:\.\d+)?)\s*k?/g;
  const numbers: number[] = [];
  let match;
  while ((match = numberPattern.exec(text)) !== null) {
    let num = parseFloat(match[1]);
    // Handle "k" suffix (e.g., "80k" = 80000)
    const fullMatch = match[0];
    if (fullMatch.includes('k') && num < 1000) {
      num *= 1000;
    }
    // Skip unreasonably small or large numbers
    if (num >= 10 && num <= 10_000_000) {
      numbers.push(num);
    }
  }

  if (numbers.length === 0) return { min: null, max: null };

  let min = numbers[0];
  let max = numbers.length > 1 ? numbers[1] : numbers[0];

  // Ensure min <= max
  if (min > max) [min, max] = [max, min];

  // Convert hourly to annual (assuming 40h/week, 52 weeks)
  if (isHourly || (min < 500 && max < 500)) {
    min = Math.round(min * 40 * 52);
    max = Math.round(max * 40 * 52);
  }

  return {
    min: Math.round(min),
    max: Math.round(max),
  };
}

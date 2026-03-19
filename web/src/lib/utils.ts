/**
 * Simple className merger — joins truthy values with spaces.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a date string to a human-readable relative or absolute format.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format a full timestamp for tooltips etc.
 */
export function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sanitize a string — strip HTML tags and limit length.
 */
export function sanitize(input: string, maxLength = 10000): string {
  const stripped = input.replace(/<[^>]*>/g, '');
  return stripped.slice(0, maxLength).trim();
}

/**
 * Generate a CSV string from rows.
 */
export function generateCsv(
  headers: string[],
  rows: string[][]
): string {
  const escapeCsvField = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Source badge color mapping.
 */
export function getSourceColor(source: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    linkedin: { bg: 'bg-blue-100', text: 'text-blue-800' },
    indeed: { bg: 'bg-purple-100', text: 'text-purple-800' },
    glassdoor: { bg: 'bg-green-100', text: 'text-green-800' },
    jobbank: { bg: 'bg-red-100', text: 'text-red-800' },
    remotive: { bg: 'bg-teal-100', text: 'text-teal-800' },
    adzuna: { bg: 'bg-orange-100', text: 'text-orange-800' },
  };
  return colors[source.toLowerCase()] ?? { bg: 'bg-slate-100', text: 'text-slate-800' };
}

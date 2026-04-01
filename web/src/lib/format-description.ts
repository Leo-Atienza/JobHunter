/**
 * Format raw job description text into readable paragraphs.
 * Adds line breaks before section headers, bullets, and numbered lists.
 */
export function formatDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw;
  // Add line breaks before common section headers
  text = text.replace(
    /\s*(Requirements|Qualifications|Responsibilities|What you['']ll do|What we offer|About|Skills|Benefits|Duties|Experience|Education|Preferred|Must have|Nice to have|Key|Overview|Summary|Description|Role|Position|Job Type|Who you are|What you bring|Why join|Perks|Compensation|Salary|Location|How to apply)(\s*[:—\-])/gi,
    '\n\n$1$2',
  );
  // Add line breaks before bullet-like patterns
  text = text.replace(/\s*([•·▪▸►●○◆\-–—]\s)/g, '\n$1');
  // Add line breaks before numbered lists
  text = text.replace(/\s+(\d+[.)]\s)/g, '\n$1');
  // Collapse 3+ newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

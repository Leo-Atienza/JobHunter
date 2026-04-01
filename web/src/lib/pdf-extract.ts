const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PAGES = 20;

/**
 * Extract text from a PDF file in the browser using pdfjs-dist.
 * Runs entirely client-side — no server upload needed.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('PDF file is too large. Maximum size is 5MB.');
  }

  if (file.type !== 'application/pdf') {
    throw new Error('File must be a PDF.');
  }

  // Dynamic import to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source to CDN to avoid bundling issues
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  const fullText = textParts.join('\n\n');
  if (fullText.trim().length < 50) {
    throw new Error(
      'Could not extract meaningful text from this PDF. It may be a scanned image — try a text-based resume instead.',
    );
  }

  return fullText;
}

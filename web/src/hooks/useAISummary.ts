import { useState, useEffect, useRef } from 'react';

/**
 * Fetches an AI summary for a job on demand (when `enabled` becomes true).
 * Caches the result and only fetches once per mount.
 */
export function useAISummary(
  jobId: number,
  cachedSummary: string | null,
  hasDescription: boolean,
  enabled: boolean,
) {
  const [summary, setSummary] = useState<string | null>(cachedSummary);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || summary || fetchedRef.current || !hasDescription) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch(`/api/jobs/${jobId}/summarize`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { summary?: string } | null) => {
        if (data?.summary) setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled, summary, jobId, hasDescription]);

  return { summary, loading };
}

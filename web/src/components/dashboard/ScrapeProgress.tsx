'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { SERVER_SCRAPER_NAMES } from '@/lib/scrapers';
import { RefreshCw } from 'lucide-react';
import { getSourceDisplayName } from '@/lib/utils';

interface ScrapeProgressProps {
  code: string;
  sessionSources: string[] | null;
}

interface SourceStatus {
  state: 'pending' | 'running' | 'done' | 'error';
  inserted?: number;
  total?: number;
  error?: string;
}

export function ScrapeProgress({ code, sessionSources }: ScrapeProgressProps) {
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const startedRef = useRef(false);

  // Determine which sources to scrape server-side (stable ref)
  const serverSources = useMemo(
    () => (sessionSources ?? SERVER_SCRAPER_NAMES).filter((s) => SERVER_SCRAPER_NAMES.includes(s)),
    [sessionSources],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Initialize all statuses
    const initial: Record<string, SourceStatus> = {};
    for (const s of serverSources) initial[s] = { state: 'pending' };
    setStatuses(initial);

    // Fire all server-side scrapers in parallel
    for (const source of serverSources) {
      setStatuses((prev) => ({ ...prev, [source]: { state: 'running' } }));

      fetch(`/api/scrape/${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: code }),
      })
        .then((res) => res.json())
        .then((data: { inserted?: number; total?: number; error?: string }) => {
          setStatuses((prev) => ({
            ...prev,
            [source]: {
              state: data.error ? 'error' : 'done',
              inserted: data.inserted,
              total: data.total,
              error: data.error,
            },
          }));
        })
        .catch(() => {
          setStatuses((prev) => ({
            ...prev,
            [source]: { state: 'error', error: 'Network error' },
          }));
        });
    }
  }, [code, serverSources]);

  const entries = Object.entries(statuses);
  const totalDone = entries.filter(([, s]) => s.state === 'done' || s.state === 'error').length;
  const totalServer = serverSources.length;
  const totalInserted = entries.reduce((acc, [, s]) => acc + (s.inserted ?? 0), 0);
  const allDone = totalDone >= entries.length && entries.length > 0;

  return (
    <div className="animate-fade-in mt-8">
      <div className="mx-auto max-w-lg">
        <div className="text-center" aria-live="polite" aria-atomic="true">
          {!allDone && (
            <div className="relative mx-auto mb-6 h-16 w-16">
              <div className="border-primary-100 absolute inset-0 rounded-full border-4" />
              <div
                className="border-t-primary-600 absolute inset-0 animate-spin rounded-full border-4"
                style={{ animationDuration: '1s' }}
              />
            </div>
          )}
          <h2 className="font-display text-primary-950 text-xl font-bold">
            {allDone ? `Found ${totalInserted} jobs` : 'Searching for jobs...'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {allDone
              ? 'All sources have been searched. Results are shown below.'
              : `Scanning ${totalServer} sources in parallel...`}
          </p>
          {!allDone && entries.length > 0 && (
            <p className="text-primary-600 mt-1.5 text-xs font-medium">
              {totalDone} / {entries.length} sources complete
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="bg-primary-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${entries.length ? (totalDone / entries.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-400">
          {totalDone} of {entries.length} sources complete
        </p>

        {/* Source status list */}
        <div className="mt-4 space-y-1.5">
          {entries.map(([source, status]) => (
            <div
              key={source}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            >
              <span
                className={
                  status.state === 'done'
                    ? 'text-slate-700'
                    : status.state === 'error'
                      ? 'text-error-600'
                      : 'text-slate-500'
                }
              >
                {getSourceDisplayName(source)}
              </span>
              <span className="flex items-center gap-2">
                {status.state === 'pending' && (
                  <span className="text-xs text-slate-400">Waiting...</span>
                )}
                {status.state === 'running' && (
                  <span className="text-primary-600 flex items-center gap-1.5 text-xs">
                    <RefreshCw size={12} className="animate-spin" />
                    Searching...
                  </span>
                )}
                {status.state === 'done' && (
                  <span className="text-success-600 text-xs font-medium">
                    {status.inserted ?? 0} jobs
                  </span>
                )}
                {status.state === 'error' && (
                  <span
                    className={`text-xs ${
                      status.error?.includes('limit')
                        ? 'font-medium text-amber-600'
                        : 'text-error-500'
                    }`}
                  >
                    {status.error?.includes('limit')
                      ? 'Monthly limit reached'
                      : (status.error ?? 'Failed')}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

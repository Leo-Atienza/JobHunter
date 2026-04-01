'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_SCRAPER_NAMES } from '@/lib/scrapers';
import { getSourceDisplayName } from '@/lib/utils';

interface SourceStatus {
  state: 'pending' | 'running' | 'done' | 'error';
  inserted?: number;
  error?: string;
}

interface RescanButtonProps {
  code: string;
  onRescanStart: () => void;
  onComplete: () => void;
}

export function RescanButton({ code, onRescanStart, onComplete }: RescanButtonProps) {
  const [scanning, setScanning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [showProgress, setShowProgress] = useState(false);

  const startRescan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setShowProgress(true);
    onRescanStart();

    const initial: Record<string, SourceStatus> = {};
    for (const s of SERVER_SCRAPER_NAMES) initial[s] = { state: 'pending' };
    setStatuses(initial);

    const promises = SERVER_SCRAPER_NAMES.map(async (source) => {
      setStatuses((prev) => ({ ...prev, [source]: { state: 'running' } }));
      try {
        const res = await fetch(`/api/scrape/${source}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_code: code }),
        });
        const data = await res.json() as { inserted?: number; error?: string };
        setStatuses((prev) => ({
          ...prev,
          [source]: {
            state: data.error ? 'error' : 'done',
            inserted: data.inserted,
            error: data.error,
          },
        }));
      } catch {
        setStatuses((prev) => ({
          ...prev,
          [source]: { state: 'error', error: 'Network error' },
        }));
      }
    });

    await Promise.all(promises);
    setScanning(false);
    onComplete();
  }, [scanning, code, onRescanStart, onComplete]);

  const entries = Object.entries(statuses);
  const totalDone = entries.filter(([, s]) => s.state === 'done' || s.state === 'error').length;
  const totalInserted = entries.reduce((acc, [, s]) => acc + (s.inserted ?? 0), 0);
  const allDone = entries.length > 0 && totalDone >= entries.length;

  return (
    <>
      <button
        onClick={startRescan}
        disabled={scanning}
        title="Rescan all sources"
        className={`inline-flex items-center gap-2 rounded-xl p-2 sm:px-4 sm:py-2 text-sm font-semibold transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 ${
          scanning ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={scanning ? 'animate-spin' : ''}
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span className="hidden sm:inline">{scanning ? 'Scanning...' : 'Rescan'}</span>
      </button>

      {/* Progress modal — portaled to body to escape sticky header stacking context */}
      {showProgress && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!scanning) setShowProgress(false); }}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-slide-up">
            <div className="text-center mb-4">
              <h3 className="font-display text-lg font-bold text-primary-950">
                {allDone ? `Found ${totalInserted} new jobs` : 'Rescanning all sources...'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {allDone
                  ? 'Duplicates are filtered automatically.'
                  : `${totalDone} of ${entries.length} sources complete`}
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-600 transition-all duration-500"
                style={{ width: `${entries.length ? (totalDone / entries.length) * 100 : 0}%` }}
              />
            </div>

            {/* Source list */}
            <div className="mt-4 max-h-60 overflow-y-auto space-y-1">
              {entries.map(([source, status]) => (
                <div key={source} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm">
                  <span className={
                    status.state === 'done' ? 'text-slate-700' :
                    status.state === 'error' ? 'text-red-600' : 'text-slate-500'
                  }>
                    {getSourceDisplayName(source)}
                  </span>
                  <span>
                    {status.state === 'pending' && <span className="text-xs text-slate-400">Waiting...</span>}
                    {status.state === 'running' && (
                      <span className="flex items-center gap-1.5 text-xs text-primary-600">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Searching...
                      </span>
                    )}
                    {status.state === 'done' && (
                      <span className="text-xs font-medium text-green-600">{status.inserted ?? 0} jobs</span>
                    )}
                    {status.state === 'error' && (
                      <span className="text-xs text-red-500">{status.error ?? 'Failed'}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {allDone && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowProgress(false)}
                  className="rounded-xl bg-primary-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-950/10 transition-all hover:bg-primary-900 hover:-translate-y-0.5"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

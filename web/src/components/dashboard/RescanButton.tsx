'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
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
        const data = (await res.json()) as { inserted?: number; error?: string };
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
        className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 sm:px-4 sm:py-2 ${
          scanning ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{scanning ? 'Scanning...' : 'Rescan'}</span>
      </button>

      {/* Progress modal — portaled to body to escape sticky header stacking context */}
      {showProgress &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                if (!scanning) setShowProgress(false);
              }}
            />
            <div className="animate-slide-up relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 text-center">
                <h3 className="font-display text-primary-950 text-lg font-bold">
                  {allDone ? `Found ${totalInserted} new jobs` : 'Rescanning all sources...'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {allDone
                    ? 'Duplicates are filtered automatically.'
                    : `${totalDone} of ${entries.length} sources complete`}
                </p>
              </div>

              {/* Progress bar */}
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="bg-primary-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${entries.length ? (totalDone / entries.length) * 100 : 0}%` }}
                />
              </div>

              {/* Source list */}
              <div className="mt-4 max-h-60 space-y-1 overflow-y-auto">
                {entries.map(([source, status]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
                  >
                    <span
                      className={
                        status.state === 'done'
                          ? 'text-slate-700'
                          : status.state === 'error'
                            ? 'text-red-600'
                            : 'text-slate-500'
                      }
                    >
                      {getSourceDisplayName(source)}
                    </span>
                    <span>
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
                        <span className="text-xs font-medium text-green-600">
                          {status.inserted ?? 0} jobs
                        </span>
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
                    className="bg-primary-950 shadow-primary-950/10 hover:bg-primary-900 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5"
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

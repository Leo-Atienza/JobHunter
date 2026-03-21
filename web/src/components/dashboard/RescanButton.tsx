'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';

interface RescanButtonProps {
  code: string;
  onRescanStart: () => void;
}

export function RescanButton({ code, onRescanStart }: RescanButtonProps) {
  const [open, setOpen] = useState(false);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    onRescanStart();
  }

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cmd = `python -m scrape --session ${code} --api-url ${apiUrl}`;

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Rescan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-slide-up">
            <h3 className="font-display text-lg font-bold text-primary-950">
              Re-run Scraper
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Run the command below to scan for new jobs. Existing results will be kept — duplicates are automatically filtered.
            </p>

            <div className="mt-4 rounded-lg bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <pre className="text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  <code>{cmd}</code>
                </pre>
                <CopyButton text={cmd} />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              The scraper uses your saved session preferences (keywords, location, sources).
              New jobs will appear on the dashboard automatically.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-xl bg-primary-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-950/10 transition-all hover:bg-primary-900 hover:-translate-y-0.5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

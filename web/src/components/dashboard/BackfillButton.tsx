'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

interface BackfillButtonProps {
  sessionCode: string;
  onComplete: () => void;
}

export function BackfillButton({ sessionCode, onComplete }: BackfillButtonProps) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState({ updated: 0, remaining: 0 });
  const toast = useToast();

  const runBackfill = useCallback(async () => {
    setState('running');
    let totalUpdated = 0;

    try {
      // Loop until no remaining jobs
      for (let i = 0; i < 20; i++) {
        const res = await fetch('/api/jobs/backfill-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_code: sessionCode }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data: { updated: number; remaining: number } = await res.json();
        totalUpdated += data.updated;
        setProgress({ updated: totalUpdated, remaining: data.remaining });

        if (data.remaining <= 0 || data.updated === 0) break;
      }

      setState('done');
      onComplete();
      toast({
        message: `Re-scored ${totalUpdated} job${totalUpdated !== 1 ? 's' : ''}`,
        type: 'success',
        duration: 4000,
      });
    } catch (err) {
      setState('idle');
      toast({
        message: err instanceof Error ? err.message : 'Backfill failed',
        type: 'error',
        duration: 5000,
      });
    }
  }, [sessionCode, onComplete, toast]);

  if (state === 'done') return null;

  return (
    <div className="mt-2 flex justify-end">
    <button
      onClick={runBackfill}
      disabled={state === 'running'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === 'running' ? (
        <>
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Scoring... {progress.updated > 0 && `(${progress.updated} done, ${progress.remaining} left)`}
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6" />
            <path d="M2.5 22v-6h6" />
            <path d="M2.5 11.5a10 10 0 0 1 18.8-4.3" />
            <path d="M21.5 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Re-score older jobs
        </>
      )}
    </button>
    </div>
  );
}

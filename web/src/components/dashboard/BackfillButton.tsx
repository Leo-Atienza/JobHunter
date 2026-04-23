'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { RefreshCw } from 'lucide-react';

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
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'running' ? (
          <>
            <RefreshCw size={12} className="animate-spin" />
            Scoring...{' '}
            {progress.updated > 0 && `(${progress.updated} done, ${progress.remaining} left)`}
          </>
        ) : (
          <>
            <RefreshCw size={12} />
            Re-score older jobs
          </>
        )}
      </button>
    </div>
  );
}

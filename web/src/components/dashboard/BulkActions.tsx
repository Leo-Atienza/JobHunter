'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';

interface BulkActionsProps {
  selectedIds: Set<number>;
  sessionCode: string;
  onComplete: () => void;
  onClear: () => void;
}

export function BulkActions({ selectedIds, sessionCode, onComplete, onClear }: BulkActionsProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const count = selectedIds.size;

  if (count === 0) return null;

  async function applyBulk(status: string, label: string) {
    setLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
            body: JSON.stringify({ status }),
          })
        )
      );
      toast({
        message: `${count} job${count !== 1 ? 's' : ''} marked as ${label}`,
        type: 'success',
      });
      onComplete();
      onClear();
    } catch {
      toast({ message: 'Some updates failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      style={{ animation: 'slide-in-up 0.25s ease-out' }}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-2xl">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary-950 px-2 text-xs font-bold text-white tabular-nums">
          {count}
        </span>
        <span className="text-sm font-medium text-slate-700">
          selected
        </span>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          onClick={() => applyBulk('saved', 'Saved')}
          disabled={loading}
          className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
        >
          Save All
        </button>
        <button
          onClick={() => applyBulk('applied', 'Applied')}
          disabled={loading}
          className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          Applied
        </button>
        <button
          onClick={() => applyBulk('dismissed', 'Dismissed')}
          disabled={loading}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
        >
          Dismiss
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          onClick={onClear}
          disabled={loading}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Clear selection"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

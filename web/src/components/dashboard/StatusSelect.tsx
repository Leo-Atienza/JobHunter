'use client';

import { useState } from 'react';
import type { JobStatus } from '@/lib/types';
import { JOB_STATUSES } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

interface StatusSelectProps {
  jobId: number;
  currentStatus: JobStatus;
  onUpdate: () => void;
  sessionCode: string;
}

const statusStyles: Record<JobStatus, string> = {
  new: 'border-blue-300 bg-blue-50 text-blue-800',
  saved: 'border-purple-300 bg-purple-50 text-purple-800',
  applied: 'border-amber-300 bg-amber-50 text-amber-800',
  interview: 'border-green-300 bg-green-50 text-green-800',
  offer: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-300 bg-red-50 text-red-800',
  dismissed: 'border-slate-300 bg-slate-50 text-slate-600',
};

const statusLabels: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
};

export function StatusSelect({ jobId, currentStatus, onUpdate, sessionCode }: StatusSelectProps) {
  const [loading, setLoading] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const toast = useToast();

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onUpdate();
        setFlashKey((k) => k + 1);
        toast({
          message: `Status changed to ${statusLabels[newStatus as JobStatus]}`,
          type: 'info',
          duration: 2000,
        });
      }
    } catch {
      // Silently fail — the UI will reflect actual state on next refresh
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      key={flashKey}
      value={currentStatus}
      onChange={(e) => void handleChange(e.target.value)}
      disabled={loading}
      className={`focus:ring-primary-100 animate-fade-in cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all outline-none focus:ring-2 disabled:opacity-50 ${statusStyles[currentStatus]}`}
    >
      {JOB_STATUSES.map((status) => (
        <option key={status} value={status}>
          {statusLabels[status]}
        </option>
      ))}
    </select>
  );
}

'use client';

import { Download } from 'lucide-react';

interface SavedExportButtonProps {
  disabled: boolean;
}

export function SavedExportButton({ disabled }: SavedExportButtonProps) {
  return (
    <a
      href={disabled ? undefined : '/api/user/saved-jobs/export'}
      download="jobhunter-tracker.csv"
      title="Export all tracked jobs as CSV"
      aria-disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg p-2 sm:px-3 sm:py-1.5 text-sm font-semibold transition-all ${
        disabled
          ? 'pointer-events-none bg-slate-100 text-slate-400'
          : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5'
      }`}
      onClick={(e) => { if (disabled) e.preventDefault(); }}
    >
      <Download size={14} />
      <span className="hidden sm:inline">Export</span>
    </a>
  );
}

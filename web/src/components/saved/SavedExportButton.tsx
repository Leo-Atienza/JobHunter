'use client';

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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="hidden sm:inline">Export</span>
    </a>
  );
}

'use client';

import type { JobStats, JobStatus } from '@/lib/types';
import { JOB_SOURCES, JOB_STATUSES } from '@/lib/types';
import { getSourceColor, cn } from '@/lib/utils';

interface FiltersProps {
  sourceFilter: string | null;
  statusFilter: string | null;
  remoteFilter: boolean;
  onSourceChange: (source: string | null) => void;
  onStatusChange: (status: string | null) => void;
  onRemoteChange: (value: boolean) => void;
  stats: JobStats | null;
}

const statusLabels: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
};

export function Filters({
  sourceFilter,
  statusFilter,
  remoteFilter,
  onSourceChange,
  onStatusChange,
  onRemoteChange,
  stats,
}: FiltersProps) {
  const activeSources = stats ? Object.keys(stats.by_source) : [];

  return (
    <div className="flex flex-col gap-3 sm:flex-wrap sm:flex-row sm:items-center">
      {/* Source filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <span className="mr-1 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400">Source:</span>
        <button
          onClick={() => onSourceChange(null)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all',
            !sourceFilter
              ? 'bg-primary-950 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          All
        </button>
        {JOB_SOURCES.map((source) => {
          const isActive = activeSources.includes(source);
          const colors = getSourceColor(source);
          const count = stats?.by_source[source] ?? 0;
          return (
            <button
              key={source}
              onClick={() => onSourceChange(sourceFilter === source ? null : source)}
              disabled={!isActive}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap',
                sourceFilter === source
                  ? `${colors.bg} ${colors.text} ring-2 ring-primary-300`
                  : isActive
                    ? `${colors.bg} ${colors.text} hover:ring-1 hover:ring-primary-200`
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              )}
            >
              {source}
              {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Remote toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={remoteFilter}
          onClick={() => onRemoteChange(!remoteFilter)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            remoteFilter ? 'bg-accent-500' : 'bg-slate-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
              remoteFilter ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-xs font-medium text-slate-600">Remote only</span>
      </label>

      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-slate-400">Status:</span>
        <select
          value={statusFilter ?? ''}
          onChange={(e) => onStatusChange(e.target.value || null)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]} ({stats?.by_status[status] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Active filter tags */}
      {(sourceFilter || statusFilter || remoteFilter) && (
        <button
          onClick={() => {
            onSourceChange(null);
            onStatusChange(null);
            onRemoteChange(false);
          }}
          className="inline-flex items-center gap-1 rounded-full bg-error-100 px-3 py-1 text-xs font-medium text-error-600 transition-colors hover:bg-error-200"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear filters
        </button>
      )}
    </div>
  );
}

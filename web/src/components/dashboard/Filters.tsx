'use client';

import { useState } from 'react';
import type { JobStats, JobStatus } from '@/lib/types';
import { JOB_SOURCES, JOB_STATUSES } from '@/lib/types';
import { getSourceColor, getSourceDisplayName, cn } from '@/lib/utils';

interface FiltersProps {
  sourceFilter: string | null;
  statusFilter: string | null;
  remoteFilter: boolean;
  experienceFilter: string | null;
  jobTypeFilter: string | null;
  salaryMin: string;
  salaryMax: string;
  onSourceChange: (source: string | null) => void;
  onStatusChange: (status: string | null) => void;
  onRemoteChange: (value: boolean) => void;
  onExperienceChange: (level: string | null) => void;
  onJobTypeChange: (type: string | null) => void;
  onSalaryMinChange: (val: string) => void;
  onSalaryMaxChange: (val: string) => void;
  stats: JobStats | null;
}

const EXPERIENCE_LEVELS = ['Entry', 'Intern', 'Mid', 'Senior', 'Lead', 'Principal'] as const;
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Temporary'] as const;

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
  experienceFilter,
  jobTypeFilter,
  salaryMin,
  salaryMax,
  onSourceChange,
  onStatusChange,
  onRemoteChange,
  onExperienceChange,
  onJobTypeChange,
  onSalaryMinChange,
  onSalaryMaxChange,
  stats,
}: FiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeSources = stats ? Object.keys(stats.by_source) : [];

  const activeFilterCount = [
    sourceFilter,
    statusFilter,
    remoteFilter,
    experienceFilter,
    jobTypeFilter,
    salaryMin,
    salaryMax,
  ].filter(Boolean).length;

  const clearAll = () => {
    onSourceChange(null);
    onStatusChange(null);
    onRemoteChange(false);
    onExperienceChange(null);
    onJobTypeChange(null);
    onSalaryMinChange('');
    onSalaryMaxChange('');
  };

  const filterContent = (
    <>
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
              {getSourceDisplayName(source)}
              {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Row 2: dropdowns + toggles */}
      <div className="flex flex-wrap items-center gap-3">
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

        {/* Experience level filter */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-slate-400">Level:</span>
          <select
            value={experienceFilter ?? ''}
            onChange={(e) => onExperienceChange(e.target.value || null)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Any level</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        {/* Job type filter */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-slate-400">Type:</span>
          <select
            value={jobTypeFilter ?? ''}
            onChange={(e) => onJobTypeChange(e.target.value || null)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Any type</option>
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Salary range filter */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wider text-slate-400">Salary:</span>
          <input
            type="number"
            placeholder="Min"
            value={salaryMin}
            onChange={(e) => onSalaryMinChange(e.target.value)}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <span className="text-xs text-slate-400">-</span>
          <input
            type="number"
            placeholder="Max"
            value={salaryMax}
            onChange={(e) => onSalaryMaxChange(e.target.value)}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
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
    </>
  );

  return (
    <div className="w-full">
      {/* Mobile: collapsible toggle */}
      <div className="sm:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-950 px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-slate-400 transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-slide-down">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop: always visible */}
      <div className="hidden sm:flex sm:flex-col sm:gap-3">
        {filterContent}
      </div>
    </div>
  );
}

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
  freshnessFilter: string | null;
  hideGhosts: boolean;
  companyFilter: string | null;
  sessionCompanies: string[] | null;
  locationFilter: string | null;
  sessionLocation: string | null;
  onSourceChange: (source: string | null) => void;
  onStatusChange: (status: string | null) => void;
  onRemoteChange: (value: boolean) => void;
  onExperienceChange: (level: string | null) => void;
  onJobTypeChange: (type: string | null) => void;
  onSalaryMinChange: (val: string) => void;
  onSalaryMaxChange: (val: string) => void;
  onFreshnessChange: (val: string | null) => void;
  onHideGhostsChange: (val: boolean) => void;
  onCompanyChange: (val: string | null) => void;
  onLocationChange: (val: string | null) => void;
  stats: JobStats | null;
}

const EXPERIENCE_LEVELS = ['Entry', 'Intern', 'Mid', 'Senior', 'Lead', 'Principal'] as const;
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance', 'Temporary'] as const;

const statusLabels: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
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
  freshnessFilter,
  hideGhosts,
  companyFilter,
  sessionCompanies,
  locationFilter,
  sessionLocation,
  onSourceChange,
  onStatusChange,
  onRemoteChange,
  onExperienceChange,
  onJobTypeChange,
  onSalaryMinChange,
  onSalaryMaxChange,
  onFreshnessChange,
  onHideGhostsChange,
  onCompanyChange,
  onLocationChange,
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
    freshnessFilter,
    hideGhosts,
    companyFilter,
    locationFilter,
  ].filter(Boolean).length;

  const clearAll = () => {
    onSourceChange(null);
    onStatusChange(null);
    onRemoteChange(false);
    onExperienceChange(null);
    onJobTypeChange(null);
    onSalaryMinChange('');
    onSalaryMaxChange('');
    onFreshnessChange(null);
    onHideGhostsChange(false);
    onCompanyChange(null);
    onLocationChange(null);
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

      {/* Location filter pills */}
      {sessionLocation && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          <span className="mr-1 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400">Location:</span>
          {(['near', 'remote', 'other'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onLocationChange(locationFilter === opt ? null : opt)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap',
                locationFilter === opt
                  ? 'bg-primary-950 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {opt === 'near'
                ? `Near ${sessionLocation.split(',')[0].trim()}`
                : opt === 'remote'
                  ? 'Remote'
                  : 'Other'}
            </button>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="border-b border-slate-100" />

      {/* Row 2: controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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

        {/* Status filter — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status:</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onStatusChange(null)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                !statusFilter ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              All
            </button>
            {JOB_STATUSES.map((status) => {
              const count = stats?.by_status[status] ?? 0;
              if (count === 0 && statusFilter !== status) return null;
              return (
                <button
                  key={status}
                  onClick={() => onStatusChange(statusFilter === status ? null : status)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all whitespace-nowrap',
                    statusFilter === status
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {statusLabels[status]}
                  {count > 0 && <span className="ml-0.5 opacity-50">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Experience level — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Level:</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onExperienceChange(null)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                !experienceFilter ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Any
            </button>
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => onExperienceChange(experienceFilter === level ? null : level)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                  experienceFilter === level
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Job type — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type:</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onJobTypeChange(null)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                !jobTypeFilter ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Any
            </button>
            {JOB_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => onJobTypeChange(jobTypeFilter === type ? null : type)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap',
                  jobTypeFilter === type
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: salary, freshness, ghost toggle, company */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Salary range filter */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Salary:</span>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100/60 p-0.5">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
              <input
                type="number"
                placeholder="Min"
                value={salaryMin}
                onChange={(e) => onSalaryMinChange(e.target.value)}
                className="w-20 rounded-md border-0 bg-white py-1 pl-5 pr-1.5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <span className="text-[10px] text-slate-400">to</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
              <input
                type="number"
                placeholder="Max"
                value={salaryMax}
                onChange={(e) => onSalaryMaxChange(e.target.value)}
                className="w-20 rounded-md border-0 bg-white py-1 pl-5 pr-1.5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>
        </div>

        {/* Freshness filter — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Posted:</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            {[
              { value: null, label: 'Any time' },
              { value: '1', label: '24h' },
              { value: '7', label: '7d' },
              { value: '14', label: '14d' },
              { value: '30', label: '30d' },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => onFreshnessChange(freshnessFilter === opt.value ? null : opt.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap',
                  freshnessFilter === opt.value
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hide ghost jobs toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={hideGhosts}
            onClick={() => onHideGhostsChange(!hideGhosts)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
              hideGhosts ? 'bg-error-400' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                hideGhosts ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-xs font-medium text-slate-600">
            Hide expired{stats?.ghost_count ? ` (${stats.ghost_count})` : ''}
          </span>
        </label>

        {/* Company filter (from session) */}
        {sessionCompanies && sessionCompanies.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Company:</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
              <button
                onClick={() => onCompanyChange(null)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                  !companyFilter ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All
              </button>
              {sessionCompanies.map((c) => (
                <button
                  key={c}
                  onClick={() => onCompanyChange(companyFilter === c ? null : c)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition-all capitalize',
                    companyFilter === c
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full bg-error-50 px-3 py-1 text-xs font-semibold text-error-600 transition-all hover:bg-error-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear all
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

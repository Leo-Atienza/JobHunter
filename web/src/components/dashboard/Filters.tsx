'use client';

import { useState } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';
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
  sessionLocations: string[] | null;
  detectedCities: { cities: { name: string; count: number }[]; remoteCount: number };
  includeRemote: boolean;
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
const JOB_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Internship',
  'Freelance',
  'Temporary',
] as const;

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
  sessionLocations,
  detectedCities,
  includeRemote,
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
      <div className="scrollbar-none -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <span className="mr-1 shrink-0 text-xs font-medium tracking-wider text-slate-400 uppercase">
          Source:
        </span>
        <button
          onClick={() => onSourceChange(null)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all',
            !sourceFilter
              ? 'bg-primary-950 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
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
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all',
                sourceFilter === source
                  ? `${colors.bg} ${colors.text} ring-primary-300 ring-2`
                  : isActive
                    ? `${colors.bg} ${colors.text} hover:ring-primary-200 hover:ring-1`
                    : 'cursor-not-allowed bg-slate-50 text-slate-300',
              )}
            >
              {getSourceDisplayName(source)}
              {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Location filter pills — data-driven from job locations */}
      {(detectedCities.cities.length > 0 || detectedCities.remoteCount > 0) && (
        <div className="scrollbar-none -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <span className="mr-1 shrink-0 text-xs font-medium tracking-wider text-slate-400 uppercase">
            Location:
          </span>
          {/* Metro grouping — only if session has a city with metro aliases */}
          {sessionLocations &&
            sessionLocations.map((loc) => {
              const city = loc.split(',')[0].trim();
              const filterKey = `near:${city.toLowerCase()}`;
              return (
                <button
                  key={`metro-${city}`}
                  onClick={() => onLocationChange(locationFilter === filterKey ? null : filterKey)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all',
                    locationFilter === filterKey
                      ? 'bg-primary-950 text-white shadow-sm'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                  )}
                >
                  All {city} area
                </button>
              );
            })}
          {/* Individual detected cities */}
          {detectedCities.cities.map(({ name, count }) => {
            const filterKey = `city:${name.toLowerCase()}`;
            return (
              <button
                key={name}
                onClick={() => onLocationChange(locationFilter === filterKey ? null : filterKey)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all',
                  locationFilter === filterKey
                    ? 'bg-primary-950 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {name}
                <span className="ml-1 opacity-50">{count}</span>
              </button>
            );
          })}
          {/* Remote */}
          {detectedCities.remoteCount > 0 && (
            <button
              onClick={() => onLocationChange(locationFilter === 'remote' ? null : 'remote')}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all',
                locationFilter === 'remote'
                  ? 'bg-primary-950 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              Remote
              <span className="ml-1 opacity-50">{detectedCities.remoteCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Divider */}
      <hr className="border-slate-100/80" />

      {/* Row 2: controls */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Remote toggle — hidden when session excludes remote */}
        {includeRemote && (
          <label className="flex cursor-pointer items-center gap-2">
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
        )}

        {/* Status filter — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Status:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onStatusChange(null)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                !statusFilter
                  ? 'text-primary-800 bg-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
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
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all',
                    statusFilter === status
                      ? 'text-primary-800 bg-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
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
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Level:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onExperienceChange(null)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                !experienceFilter
                  ? 'text-primary-800 bg-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
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
                    ? 'text-primary-800 bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Job type — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Type:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            <button
              onClick={() => onJobTypeChange(null)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                !jobTypeFilter
                  ? 'text-primary-800 bg-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Any
            </button>
            {JOB_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => onJobTypeChange(jobTypeFilter === type ? null : type)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-all',
                  jobTypeFilter === type
                    ? 'text-primary-800 bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: salary, freshness, ghost toggle, company */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Salary range filter */}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Salary:
          </span>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100/60 p-0.5">
            <div className="relative">
              <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-slate-400">
                $
              </span>
              <input
                type="number"
                placeholder="Min"
                value={salaryMin}
                onChange={(e) => onSalaryMinChange(e.target.value)}
                className="focus:ring-primary-200 w-20 rounded-md border-0 bg-white py-1 pr-1.5 pl-5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2"
              />
            </div>
            <span className="text-[10px] text-slate-400">to</span>
            <div className="relative">
              <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-slate-400">
                $
              </span>
              <input
                type="number"
                placeholder="Max"
                value={salaryMax}
                onChange={(e) => onSalaryMaxChange(e.target.value)}
                className="focus:ring-primary-200 w-20 rounded-md border-0 bg-white py-1 pr-1.5 pl-5 text-xs text-slate-700 shadow-sm outline-none focus:ring-2"
              />
            </div>
          </div>
        </div>

        {/* Freshness filter — pill group */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Posted:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
            {[
              { value: null, label: 'Any time' },
              { value: '1', label: '24h' },
              { value: '7', label: '7d' },
              { value: '14', label: '14d' },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => onFreshnessChange(freshnessFilter === opt.value ? null : opt.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-all',
                  freshnessFilter === opt.value
                    ? 'text-primary-800 bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hide ghost jobs toggle */}
        <label className="flex cursor-pointer items-center gap-2">
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
            <span className="mr-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              Company:
            </span>
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5">
              <button
                onClick={() => onCompanyChange(null)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-semibold transition-all',
                  !companyFilter
                    ? 'text-primary-800 bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                All
              </button>
              {sessionCompanies.map((c) => (
                <button
                  key={c}
                  onClick={() => onCompanyChange(companyFilter === c ? null : c)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition-all',
                    companyFilter === c
                      ? 'text-primary-800 bg-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
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
            className="bg-error-50 text-error-600 hover:bg-error-100 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all"
          >
            <X size={12} />
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
            <Filter size={16} className="text-slate-400" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-950 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {mobileOpen && (
          <div className="animate-slide-down mt-2 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop: always visible */}
      <div className="hidden gap-2.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex sm:flex-col">
        {filterContent}
      </div>
    </div>
  );
}

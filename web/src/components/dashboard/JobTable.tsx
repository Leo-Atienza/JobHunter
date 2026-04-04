'use client';

import type { Job } from '@/lib/types';
import { JobRow } from './JobRow';
import { cn } from '@/lib/utils';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

interface JobTableProps {
  jobs: Job[];
  sortField: keyof Job;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Job) => void;
  onJobUpdate: () => void;
  onJobClick?: (jobId: number) => void;
  sessionCode: string;
  onClearFilters?: () => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: () => void;
}

interface ColumnDef {
  field: keyof Job;
  label: string;
  className?: string;
  sortable: boolean;
}

const columns: ColumnDef[] = [
  { field: 'title', label: 'Title', sortable: true },
  { field: 'company', label: 'Company', className: 'hidden md:table-cell', sortable: true },
  { field: 'location', label: 'Location', className: 'hidden lg:table-cell', sortable: true },
  { field: 'source', label: 'Source', sortable: true },
  { field: 'relevance_score', label: 'Match', className: 'hidden lg:table-cell', sortable: true },
  { field: 'salary', label: 'Salary', className: 'hidden xl:table-cell', sortable: true },
  { field: 'posted_date', label: 'Posted', className: 'hidden lg:table-cell', sortable: true },
  { field: 'status', label: 'Status', sortable: true },
];

function SortIndicator({ field, sortField, sortDirection }: { field: keyof Job; sortField: keyof Job; sortDirection: 'asc' | 'desc' }) {
  if (field !== sortField) {
    return <ChevronDown size={12} className="ml-1 opacity-0 group-hover:opacity-30" />;
  }
  return sortDirection === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-primary-600" />
    : <ChevronDown size={12} className="ml-1 text-primary-600" />;
}

export function JobTable({ jobs, sortField, sortDirection, onSort, onJobUpdate, onJobClick, sessionCode, onClearFilters, selectedIds, onToggleSelect, onToggleSelectAll }: JobTableProps) {
  const hasSelection = selectedIds !== undefined && onToggleSelect !== undefined;
  if (jobs.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          <Search size={32} className="text-primary-400" />
        </div>
        <p className="mt-4 font-display text-lg font-bold text-slate-700">
          No jobs match your current filters
        </p>
        <p className="mt-1 max-w-xs text-center text-sm text-slate-500">
          Try widening your search — remove a filter, broaden your keywords, or add more locations.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-900 hover:-translate-y-0.5"
          >
            <Search size={14} />
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {hasSelection && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={jobs.length > 0 && selectedIds!.size === jobs.length}
                    onChange={() => onToggleSelectAll?.()}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.field}
                  className={cn(
                    'group px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400',
                    col.className,
                    col.sortable && 'cursor-pointer select-none hover:text-slate-600 transition-colors'
                  )}
                  onClick={() => col.sortable && onSort(col.field)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && (
                      <SortIndicator field={col.field} sortField={sortField} sortDirection={sortDirection} />
                    )}
                  </span>
                </th>
              ))}
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onUpdate={onJobUpdate}
                onJobClick={onJobClick}
                sessionCode={sessionCode || job.session_code}
                isSelected={selectedIds?.has(job.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

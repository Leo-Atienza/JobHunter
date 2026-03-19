'use client';

import type { Job } from '@/lib/types';
import { JobRow } from './JobRow';
import { cn } from '@/lib/utils';

interface JobTableProps {
  jobs: Job[];
  sortField: keyof Job;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Job) => void;
  onJobUpdate: () => void;
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
  { field: 'salary', label: 'Salary', className: 'hidden xl:table-cell', sortable: true },
  { field: 'posted_date', label: 'Posted', className: 'hidden lg:table-cell', sortable: true },
  { field: 'status', label: 'Status', sortable: true },
];

function SortIndicator({ field, sortField, sortDirection }: { field: keyof Job; sortField: keyof Job; sortDirection: 'asc' | 'desc' }) {
  if (field !== sortField) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-0 group-hover:opacity-30">
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1 text-primary-600">
      {sortDirection === 'asc' ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
    </svg>
  );
}

export function JobTable({ jobs, sortField, sortDirection, onSort, onJobUpdate }: JobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <p className="mt-4 font-display text-lg font-semibold text-slate-400">
          No matching jobs
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
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
              <JobRow key={job.id} job={job} onUpdate={onJobUpdate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

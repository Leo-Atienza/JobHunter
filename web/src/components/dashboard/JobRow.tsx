'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { getSourceColor, formatDate } from '@/lib/utils';

interface JobRowProps {
  job: Job;
  onUpdate: () => void;
}

export function JobRow({ job, onUpdate }: JobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep notes in sync with prop changes
  useEffect(() => {
    setNotes(job.notes ?? '');
  }, [job.notes]);

  const saveNotes = useCallback(
    (newNotes: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/jobs/${job.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: newNotes }),
          });
        } catch {
          // Silent fail — notes will be retried on next edit
        }
      }, 800);
    },
    [job.id]
  );

  function handleNotesChange(value: string) {
    setNotes(value);
    saveNotes(value);
  }

  const sourceColors = getSourceColor(job.source);

  return (
    <>
      <tr
        className="group cursor-pointer transition-colors hover:bg-primary-50/30"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Title */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary-950 max-w-xs">
                {job.title}
              </p>
              <p className="truncate text-xs text-slate-400 md:hidden">
                {job.company}
              </p>
            </div>
          </div>
        </td>

        {/* Company */}
        <td className="hidden md:table-cell px-4 py-3">
          <p className="truncate text-sm text-slate-600 max-w-[180px]">
            {job.company ?? '—'}
          </p>
        </td>

        {/* Location */}
        <td className="hidden lg:table-cell px-4 py-3">
          <p className="truncate text-sm text-slate-500 max-w-[160px]">
            {job.location ?? '—'}
          </p>
        </td>

        {/* Source */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}
          >
            {job.source}
          </span>
        </td>

        {/* Salary */}
        <td className="hidden xl:table-cell px-4 py-3">
          <p className="text-sm text-slate-600">
            {job.salary ?? '—'}
          </p>
        </td>

        {/* Posted */}
        <td className="hidden lg:table-cell px-4 py-3">
          <p className="text-sm text-slate-500">
            {job.posted_date ?? formatDate(job.scraped_at)}
          </p>
        </td>

        {/* Status */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <StatusSelect
            jobId={job.id}
            currentStatus={job.status}
            onUpdate={onUpdate}
          />
        </td>

        {/* Expand arrow */}
        <td className="px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="animate-slide-down">
          <td colSpan={8} className="border-b border-slate-100 bg-slate-50/50 px-4 py-5">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </h4>
                {job.description ? (
                  <p className="text-sm leading-relaxed text-slate-600 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {job.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-400">No description available</p>
                )}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors hover:text-primary-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  View original listing
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Notes
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add your notes about this position..."
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">Auto-saved as you type</p>
              </div>
            </div>

            {/* Extra metadata on mobile */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 md:hidden">
              {job.location && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.salary && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  {job.salary}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

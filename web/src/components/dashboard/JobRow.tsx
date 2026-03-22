'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';

interface JobRowProps {
  job: Job;
  onUpdate: () => void;
  onJobClick?: (jobId: number) => void;
}

export function JobRow({ job, onUpdate, onJobClick }: JobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes ?? '');
  const [aiSummary, setAiSummary] = useState<string | null>(job.ai_summary ?? null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryFetchedRef = useRef(false);

  // Keep notes in sync with prop changes
  useEffect(() => {
    setNotes(job.notes ?? '');
  }, [job.notes]);

  // Fetch AI summary on expand (if not already cached)
  useEffect(() => {
    if (!expanded || aiSummary || summaryFetchedRef.current || !job.description) return;
    summaryFetchedRef.current = true;
    setSummaryLoading(true);
    fetch(`/api/jobs/${job.id}/summarize`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { summary?: string } | null) => {
        if (data?.summary) setAiSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [expanded, aiSummary, job.id, job.description]);

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

  // Format raw description text into readable paragraphs
  const formattedDescription = useMemo(() => {
    if (!job.description) return null;
    let text = job.description;
    // Add line breaks before common section headers
    text = text.replace(/\s*(Requirements|Qualifications|Responsibilities|What you['']ll do|What we offer|About|Skills|Benefits|Duties|Experience|Education|Preferred|Must have|Nice to have|Key|Overview|Summary|Description|Role|Position|Job Type|Who you are|What you bring|Why join|Perks|Compensation|Salary|Location|How to apply)(\s*[:—\-])/gi, '\n\n$1$2');
    // Add line breaks before bullet-like patterns
    text = text.replace(/\s*([•·▪▸►●○◆\-–—]\s)/g, '\n$1');
    // Add line breaks before numbered lists
    text = text.replace(/\s+(\d+[.)]\s)/g, '\n$1');
    // Collapse 3+ newlines into 2
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }, [job.description]);

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
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}
            >
              {getSourceDisplayName(job.source)}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title={`Also on: ${job.also_on.join(', ')}`}>
                +{job.also_on.length}
              </span>
            )}
            {job.is_ghost && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600" title="This job listing URL returned 404 — it may have been removed">
                Expired?
              </span>
            )}
          </div>
        </td>

        {/* Relevance */}
        <td className="hidden lg:table-cell px-4 py-3">
          {job.relevance_score > 0 ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              job.relevance_score >= 80 ? 'bg-green-100 text-green-700' :
              job.relevance_score >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {job.relevance_score}%
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </td>

        {/* Salary */}
        <td className="hidden xl:table-cell px-4 py-3">
          {job.salary ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {job.salary}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
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

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {onJobClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onJobClick(job.id); }}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                title="View details"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}
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
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="animate-slide-down">
          <td colSpan={9} className="border-b border-slate-100 bg-slate-50/50 px-4 py-5">
            {/* Job detail badges */}
            {(job.job_type || job.experience_level || job.relevance_score > 0 || job.country || job.is_ghost) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {job.job_type && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {job.job_type}
                  </span>
                )}
                {job.experience_level && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                    {job.experience_level}
                  </span>
                )}
                {job.relevance_score > 0 && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    job.relevance_score >= 80 ? 'bg-green-100 text-green-700' :
                    job.relevance_score >= 50 ? 'bg-amber-100 text-amber-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {job.relevance_score}% match
                  </span>
                )}
                {job.country && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {job.country}
                  </span>
                )}
                {job.is_ghost && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    Possibly expired
                  </span>
                )}
              </div>
            )}

            {/* AI Summary */}
            {(aiSummary || summaryLoading) && (
              <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary-600">AI Summary</h4>
                </div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-sm text-primary-500">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating summary...
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-primary-900">{aiSummary}</p>
                )}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </h4>
                {formattedDescription ? (
                  <div className="text-sm leading-relaxed text-slate-600 max-h-72 overflow-y-auto whitespace-pre-wrap pr-2">
                    {formattedDescription}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">No description available</p>
                )}

                {/* Skills */}
                {job.skills && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.split(',').map((skill) => (
                        <span key={skill.trim()} className="inline-flex rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 border border-primary-200">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {job.benefits && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Benefits
                    </h4>
                    <p className="text-sm text-slate-600">{job.benefits}</p>
                  </div>
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

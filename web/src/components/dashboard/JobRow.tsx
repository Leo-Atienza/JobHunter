'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Bookmark, ExternalLink, ChevronDown, MapPin, DollarSign } from 'lucide-react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { AISummaryBlock } from './AISummaryBlock';
import { useAISummary } from '@/hooks/useAISummary';
import { formatDescription } from '@/lib/format-description';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';
import { MatchScorePopover } from './MatchScorePopover';

interface JobRowProps {
  job: Job;
  onUpdate: () => void;
  onJobClick?: (jobId: number) => void;
  sessionCode: string;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

export function JobRow({
  job,
  onUpdate,
  onJobClick,
  sessionCode,
  isSelected,
  onToggleSelect,
}: JobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(job.notes ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { summary: aiSummary, loading: summaryLoading } = useAISummary(
    job.id,
    job.ai_summary ?? null,
    !!job.description,
    expanded,
  );

  const saveNotes = useCallback(
    (newNotes: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/jobs/${job.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
            body: JSON.stringify({ notes: newNotes }),
          });
        } catch {
          // Silent fail — notes will be retried on next edit
        }
      }, 800);
    },
    [job.id, sessionCode],
  );

  function handleNotesChange(value: string) {
    setNotes(value);
    saveNotes(value);
  }

  const formattedDescription = useMemo(() => formatDescription(job.description), [job.description]);

  const sourceColors = getSourceColor(job.source);

  return (
    <>
      <tr
        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-primary-50/60' : 'hover:bg-slate-50/80'}`}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {/* Checkbox */}
        {onToggleSelect && (
          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect(job.id)}
              className="text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 cursor-pointer rounded border-slate-300"
              aria-label={`Select ${job.title}`}
            />
          </td>
        )}
        {/* Title */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <p className="text-primary-950 max-w-xs truncate text-sm font-semibold">
                {job.title}
              </p>
              <p className="truncate text-xs text-slate-400 md:hidden">{job.company}</p>
            </div>
          </div>
        </td>

        {/* Company */}
        <td className="hidden px-4 py-3 md:table-cell">
          <p className="max-w-[180px] truncate text-sm text-slate-600">{job.company ?? '—'}</p>
        </td>

        {/* Location */}
        <td className="hidden px-4 py-3 lg:table-cell">
          <p className="max-w-[160px] truncate text-sm text-slate-500">{job.location ?? '—'}</p>
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
              <span
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                title={`Also on: ${job.also_on.join(', ')}`}
              >
                +{job.also_on.length}
              </span>
            )}
            {job.is_ghost && (
              <span
                className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                title="This job listing URL returned 404 — it may have been removed"
              >
                Expired?
              </span>
            )}
          </div>
        </td>

        {/* Relevance */}
        <td className="hidden px-4 py-3 lg:table-cell">
          <div className="flex flex-col gap-1">
            {job.relevance_score > 0 ? (
              <MatchScorePopover
                score={job.relevance_score}
                breakdown={job.score_breakdown ?? null}
                id={`row-${job.id}`}
              />
            ) : (
              <span className="text-sm text-slate-400">&mdash;</span>
            )}
          </div>
        </td>

        {/* Salary */}
        <td className="hidden px-4 py-3 xl:table-cell">
          {job.salary ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {job.salary}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </td>

        {/* Posted */}
        <td className="hidden px-4 py-3 lg:table-cell">
          <p className="text-sm text-slate-500">{formatDate(job.posted_date ?? job.scraped_at)}</p>
        </td>

        {/* Status */}
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <StatusSelect
            jobId={job.id}
            currentStatus={job.status}
            onUpdate={onUpdate}
            sessionCode={sessionCode}
          />
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newStatus = job.status === 'saved' ? 'new' : 'saved';
                fetch(`/api/jobs/${job.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
                  body: JSON.stringify({ status: newStatus }),
                }).then(() => onUpdate());
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                job.status === 'saved'
                  ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                  : 'text-slate-300 hover:bg-slate-100 hover:text-amber-400'
              }`}
              title={job.status === 'saved' ? 'Unsave job' : 'Save job'}
            >
              <Bookmark size={13} fill={job.status === 'saved' ? 'currentColor' : 'none'} />
            </button>
            {onJobClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJobClick(job.id);
                }}
                className="hover:bg-primary-50 hover:text-primary-600 rounded-md p-1 text-slate-400 transition-colors"
                title="View details"
              >
                <ExternalLink size={14} />
              </button>
            )}
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="animate-slide-down">
          <td
            colSpan={onToggleSelect ? 10 : 9}
            className="border-b border-slate-100 bg-slate-50/50 px-4 py-5"
          >
            {/* Job detail badges */}
            {(job.job_type ||
              job.experience_level ||
              job.relevance_score > 0 ||
              job.country ||
              job.is_ghost) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {job.job_type && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {job.job_type}
                  </span>
                )}
                {job.experience_level && (
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                    {job.experience_level}
                  </span>
                )}
                {job.relevance_score > 0 && (
                  <MatchScorePopover
                    score={job.relevance_score}
                    breakdown={job.score_breakdown ?? null}
                    id={`row-expanded-${job.id}`}
                  />
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
            <div className="mb-4">
              <AISummaryBlock summary={aiSummary} loading={summaryLoading} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Description */}
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Description
                </h4>
                {formattedDescription ? (
                  <div className="max-h-72 overflow-y-auto pr-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                    {formattedDescription}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No description available</p>
                )}

                {/* Skills */}
                {job.skills && (
                  <div className="mt-3">
                    <h4 className="mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                      Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.split(',').map((skill) => (
                        <span
                          key={skill.trim()}
                          className="bg-primary-50 text-primary-700 border-primary-200 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium"
                        >
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {job.benefits && (
                  <div className="mt-3">
                    <h4 className="mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                      Benefits
                    </h4>
                    <p className="text-sm text-slate-600">{job.benefits}</p>
                  </div>
                )}

                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 mt-3 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View original listing
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* Notes */}
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Notes
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add your notes about this position..."
                  rows={5}
                  className="focus:border-primary-400 focus:ring-primary-100 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-400">Auto-saved as you type</p>
              </div>
            </div>

            {/* Extra metadata on mobile */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 md:hidden">
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {job.location}
                </span>
              )}
              {job.salary && (
                <span className="flex items-center gap-1">
                  <DollarSign size={12} />
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

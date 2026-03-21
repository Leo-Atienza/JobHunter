'use client';

import { useState, useEffect, useRef } from 'react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { getSourceColor, formatDate } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
}

export function JobCard({ job, onUpdate }: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(job.ai_summary ?? null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryFetchedRef = useRef(false);

  const sourceColors = getSourceColor(job.source);

  // Fetch AI summary on detail expand
  useEffect(() => {
    if (!showDetails || aiSummary || summaryFetchedRef.current || !job.description) return;
    summaryFetchedRef.current = true;
    setSummaryLoading(true);
    fetch(`/api/jobs/${job.id}/summarize`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { summary?: string } | null) => {
        if (data?.summary) setAiSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [showDetails, aiSummary, job.id, job.description]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div className="p-4">
        {/* Header: source + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}>
              {job.source}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title={`Also on: ${job.also_on.join(', ')}`}>
                +{job.also_on.length}
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <StatusSelect jobId={job.id} currentStatus={job.status} onUpdate={onUpdate} />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-primary-950 leading-snug line-clamp-2">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {job.title}
          </a>
        </h3>

        {/* Company */}
        {job.company && (
          <p className="mt-1 text-sm text-slate-600 truncate">{job.company}</p>
        )}

        {/* Salary (prominent) */}
        {job.salary && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {job.salary}
            </span>
          </div>
        )}

        {/* Location + metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate max-w-[140px]">{job.location}</span>
            </span>
          )}
          {job.posted_date && (
            <span>{job.posted_date}</span>
          )}
          {!job.posted_date && (
            <span>{formatDate(job.scraped_at)}</span>
          )}
        </div>

        {/* Tags row */}
        {(job.job_type || job.experience_level) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {job.job_type && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                {job.job_type}
              </span>
            )}
            {job.experience_level && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                {job.experience_level}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expand/collapse details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
      >
        {showDetails ? 'Hide details' : 'Show details'}
      </button>

      {showDetails && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* AI Summary */}
          {(aiSummary || summaryLoading) && (
            <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 mb-1">AI Summary</p>
              {summaryLoading ? (
                <div className="flex items-center gap-2 text-xs text-primary-500">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-primary-900">{aiSummary}</p>
              )}
            </div>
          )}

          {/* Description excerpt */}
          {job.description && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</p>
              <p className="text-xs leading-relaxed text-slate-600 line-clamp-6">{job.description}</p>
            </div>
          )}

          {/* Skills */}
          {job.skills && (
            <div className="flex flex-wrap gap-1">
              {job.skills.split(',').slice(0, 6).map((skill) => (
                <span key={skill.trim()} className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 border border-primary-200">
                  {skill.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

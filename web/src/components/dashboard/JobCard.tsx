'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { AISummaryBlock } from './AISummaryBlock';
import { useAISummary } from '@/hooks/useAISummary';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
  onJobClick?: (jobId: number) => void;
  sessionCode: string;
}

export function JobCard({ job, onUpdate, onJobClick, sessionCode }: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { summary: aiSummary, loading: summaryLoading } = useAISummary(
    job.id, job.ai_summary ?? null, !!job.description, showDetails,
  );

  const sourceColors = getSourceColor(job.source);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300">
      <div className="p-4">
        {/* Header: source + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}>
              {getSourceDisplayName(job.source)}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title={`Also on: ${job.also_on.join(', ')}`}>
                +{job.also_on.length}
              </span>
            )}
            {job.is_ghost && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600" title="This job listing URL returned 404 — it may have been removed">
                Possibly expired
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <StatusSelect jobId={job.id} currentStatus={job.status} onUpdate={onUpdate} sessionCode={sessionCode} />
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
          <span>{formatDate(job.posted_date ?? job.scraped_at)}</span>
        </div>

        {/* Tags row */}
        {(job.job_type || job.experience_level || job.relevance_score > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {job.relevance_score > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                job.relevance_score >= 80 ? 'bg-green-50 text-green-700' :
                job.relevance_score >= 50 ? 'bg-amber-50 text-amber-700' :
                'bg-orange-50 text-orange-700'
              }`}>
                {job.relevance_score}% match
              </span>
            )}
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

      {/* Actions */}
      <div className="flex border-t border-slate-100">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex-1 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
        {onJobClick && (
          <button
            onClick={() => onJobClick(job.id)}
            className="border-l border-slate-100 px-4 py-2 text-xs font-medium text-primary-500 hover:bg-primary-50 hover:text-primary-700 transition-colors"
          >
            Full view
          </button>
        )}
      </div>

      {showDetails && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* AI Summary */}
          <AISummaryBlock summary={aiSummary} loading={summaryLoading} compact />

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

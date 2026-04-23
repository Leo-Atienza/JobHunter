'use client';

import { useState, useCallback } from 'react';
import { Bookmark, MapPin } from 'lucide-react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { AISummaryBlock } from './AISummaryBlock';
import { useAISummary } from '@/hooks/useAISummary';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { MatchScorePopover } from './MatchScorePopover';

function BookmarkButton({
  jobId,
  isSaved,
  sessionCode,
  onUpdate,
}: {
  jobId: number;
  isSaved: boolean;
  sessionCode: string;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const toggle = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
        body: JSON.stringify({ status: isSaved ? 'new' : 'saved' }),
      });
      onUpdate();
      toast({
        message: isSaved ? 'Removed from Tracker' : 'Saved to Tracker',
        type: 'success',
        duration: 2500,
        ...(!isSaved ? { action: { label: 'View', href: '/saved' } } : {}),
      });
    } finally {
      setSaving(false);
    }
  }, [jobId, isSaved, sessionCode, onUpdate, toast]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      disabled={saving}
      className={`group/bk flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
        isSaved
          ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
          : 'text-slate-300 hover:bg-slate-100 hover:text-amber-400'
      }`}
      title={isSaved ? 'Unsave job' : 'Save job'}
    >
      <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
    </button>
  );
}

function QuickApplyButton({
  jobId,
  sessionCode,
  onUpdate,
}: {
  jobId: number;
  sessionCode: string;
  onUpdate: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const toast = useToast();

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
        body: JSON.stringify({ status: 'applied' }),
      });
      onUpdate();
      toast({
        message: 'Marked as Applied',
        type: 'success',
        duration: 3000,
        action: { label: 'View Tracker', href: '/saved' },
      });
    } finally {
      setApplying(false);
    }
  }, [jobId, sessionCode, onUpdate, toast]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        apply();
      }}
      disabled={applying}
      className="border-l border-slate-100 px-4 py-2 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {applying ? 'Applying…' : 'Quick Apply'}
    </button>
  );
}

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
  onJobClick?: (jobId: number) => void;
  sessionCode: string;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

export function JobCard({
  job,
  onUpdate,
  onJobClick,
  sessionCode,
  isFocused,
  isSelected,
  onToggleSelect,
}: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { summary: aiSummary, loading: summaryLoading } = useAISummary(
    job.id,
    job.ai_summary ?? null,
    !!job.description,
    showDetails,
  );

  const sourceColors = getSourceColor(job.source);

  return (
    <div
      className={`group/card hover:shadow-primary-950/[0.04] hover:border-primary-200/60 relative rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${isFocused ? 'ring-primary-400 border-primary-300 ring-2' : isSelected ? 'ring-primary-300 border-primary-200 bg-primary-50/30 ring-2' : 'border-slate-200/80'}`}
    >
      {/* Selection checkbox — visible on hover or when selected */}
      {onToggleSelect && (
        <div
          className={`absolute top-2.5 left-2.5 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'} transition-opacity`}
        >
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(job.id);
            }}
            className="text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer rounded border-slate-300 shadow-sm"
            aria-label={`Select ${job.title}`}
          />
        </div>
      )}
      <div className="p-4">
        {/* Header: source + status */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}
            >
              {getSourceDisplayName(job.source)}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
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
                Possibly expired
              </span>
            )}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <BookmarkButton
              jobId={job.id}
              isSaved={job.status === 'saved'}
              sessionCode={sessionCode}
              onUpdate={onUpdate}
            />
            <StatusSelect
              jobId={job.id}
              currentStatus={job.status}
              onUpdate={onUpdate}
              sessionCode={sessionCode}
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-primary-950 line-clamp-2 text-[15px] leading-snug font-bold">
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
        {job.company && <p className="mt-1 truncate text-sm text-slate-600">{job.company}</p>}

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
              <MapPin size={12} />
              <span className="max-w-[140px] truncate">{job.location}</span>
            </span>
          )}
          <span>{formatDate(job.posted_date ?? job.scraped_at)}</span>
        </div>

        {/* Tags row */}
        {(job.job_type || job.experience_level || job.relevance_score > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {job.relevance_score > 0 && (
              <MatchScorePopover
                score={job.relevance_score}
                breakdown={job.score_breakdown ?? null}
                id={`card-${job.id}`}
              />
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
          className="flex-1 px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
        {job.status !== 'applied' &&
          job.status !== 'interview' &&
          job.status !== 'offer' &&
          job.status !== 'rejected' && (
            <QuickApplyButton jobId={job.id} sessionCode={sessionCode} onUpdate={onUpdate} />
          )}
        {onJobClick && (
          <button
            onClick={() => onJobClick(job.id)}
            className="text-primary-500 hover:bg-primary-50 hover:text-primary-700 border-l border-slate-100 px-4 py-2 text-xs font-medium transition-colors"
          >
            Full view
          </button>
        )}
      </div>

      {showDetails && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          {/* AI Summary */}
          <AISummaryBlock summary={aiSummary} loading={summaryLoading} compact />

          {/* Description excerpt */}
          {job.description && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Description
              </p>
              <p className="line-clamp-6 text-xs leading-relaxed text-slate-600">
                {job.description}
              </p>
            </div>
          )}

          {/* Skills */}
          {job.skills && (
            <div className="flex flex-wrap gap-1">
              {job.skills
                .split(',')
                .slice(0, 6)
                .map((skill) => (
                  <span
                    key={skill.trim()}
                    className="bg-primary-50 text-primary-700 border-primary-200 rounded border px-1.5 py-0.5 text-[10px] font-medium"
                  >
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

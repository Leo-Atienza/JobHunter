'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';
import { formatDescription } from '@/lib/format-description';
import { MatchScorePopover } from './MatchScorePopover';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onUpdate: () => void;
  /** Navigate to prev/next job in the list */
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  sessionCode: string;
}

export function JobDetailModal({
  job,
  onClose,
  onUpdate,
  onNavigate,
  hasPrev,
  hasNext,
  sessionCode,
}: JobDetailModalProps) {
  const [notes, setNotes] = useState(job.notes ?? '');
  const [aiSummary, setAiSummary] = useState<string | null>(job.ai_summary ?? null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryFetchedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(), 150);
  }, [onClose]);

  // SSR guard — createPortal needs document.body
  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus trap — focus panel on mount, trap Tab within it, restore focus on unmount
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeBtn = panel.querySelector<HTMLElement>('button[aria-label="Close"]');
    closeBtn?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      previouslyFocused?.focus();
    };
  }, []);

  // Reset state when the user navigates to a different job. We intentionally
  // depend only on job.id — including job.notes or job.ai_summary would wipe
  // the user's in-progress typing every time SWR refreshes the jobs list.
  useEffect(() => {
    setNotes(job.notes ?? '');
    setAiSummary(job.ai_summary ?? null);
    summaryFetchedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // Fetch AI summary
  useEffect(() => {
    if (aiSummary || summaryFetchedRef.current || !job.description) return;
    summaryFetchedRef.current = true;
    setSummaryLoading(true);
    fetch(`/api/jobs/${job.id}/summarize`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { summary?: string } | null) => {
        if (data?.summary) setAiSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [aiSummary, job.id, job.description]);

  // Keyboard navigation (skip when focused on an input/textarea)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape in form fields
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          handleClose();
        }
        return;
      }
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate?.('prev');
      if (e.key === 'ArrowRight' && hasNext) onNavigate?.('next');
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleClose, onNavigate, hasPrev, hasNext]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const saveNotes = useCallback(
    (newNotes: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/jobs/${job.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
            body: JSON.stringify({ notes: newNotes }),
          });
        } catch {}
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

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`relative z-10 flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-2xl ${leaving ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            {onNavigate && (
              <div className="mr-2 flex items-center gap-1">
                <button
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Previous job (Left arrow)"
                  aria-label="Previous job"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Next job (Right arrow)"
                  aria-label="Next job"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}
            >
              {getSourceDisplayName(job.source)}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                title={`Also on: ${job.also_on.map(getSourceDisplayName).join(', ')}`}
              >
                +{job.also_on.length} source{job.also_on.length > 1 ? 's' : ''}
              </span>
            )}
            {job.is_ghost && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                Possibly expired
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Title + company */}
          <div>
            <h2 id="job-modal-title" className="text-primary-950 text-xl leading-tight font-bold">
              {job.title}
            </h2>
            {job.company && (
              <p className="mt-1 text-sm font-medium text-slate-600">{job.company}</p>
            )}
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3 sm:gap-3">
            {job.location && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Location
                </p>
                <p className="text-sm font-medium text-slate-700">{job.location}</p>
              </div>
            )}
            {job.salary && (
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">
                  Salary
                </p>
                <p className="text-sm font-semibold text-emerald-700">{job.salary}</p>
              </div>
            )}
            {job.job_type && (
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-blue-500 uppercase">
                  Type
                </p>
                <p className="text-sm font-medium text-blue-700">{job.job_type}</p>
              </div>
            )}
            {job.experience_level && (
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-purple-500 uppercase">
                  Level
                </p>
                <p className="text-sm font-medium text-purple-700">{job.experience_level}</p>
              </div>
            )}
            {job.relevance_score > 0 && (
              <div
                className={`rounded-lg p-3 ${
                  job.relevance_score >= 80
                    ? 'bg-green-50'
                    : job.relevance_score >= 50
                      ? 'bg-amber-50'
                      : 'bg-orange-50'
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  Match
                </p>
                <MatchScorePopover
                  score={job.relevance_score}
                  breakdown={job.score_breakdown ?? null}
                  id={`modal-${job.id}`}
                />
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Posted
              </p>
              <p className="text-sm font-medium text-slate-700">
                {job.posted_date ?? formatDate(job.scraped_at)}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Status:
            </span>
            <StatusSelect
              jobId={job.id}
              currentStatus={job.status}
              onUpdate={onUpdate}
              sessionCode={sessionCode}
            />
          </div>

          {/* AI Summary */}
          {(aiSummary || summaryLoading) && (
            <div className="border-primary-200 bg-primary-50/50 rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={14} className="text-primary-600" />
                <h4 className="text-primary-600 text-xs font-semibold tracking-wider uppercase">
                  AI Summary
                </h4>
              </div>
              {summaryLoading ? (
                <div className="text-primary-500 flex items-center gap-2 text-sm">
                  <RefreshCw size={16} className="animate-spin" />
                  Generating summary...
                </div>
              ) : (
                <p className="text-primary-900 text-sm leading-relaxed">{aiSummary}</p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Description
            </h4>
            {formattedDescription ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                {formattedDescription}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No description available</p>
            )}
          </div>

          {/* Skills */}
          {job.skills && (
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.split(',').map((skill) => (
                  <span
                    key={skill.trim()}
                    className="bg-primary-50 text-primary-700 border-primary-200 inline-flex rounded-md border px-2.5 py-1 text-xs font-medium"
                  >
                    {skill.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Benefits
              </h4>
              <p className="text-sm leading-relaxed text-slate-600">{job.benefits}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Your Notes
            </h4>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add your notes about this position..."
              rows={4}
              className="focus:border-primary-400 focus:ring-primary-100 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none focus:ring-2"
            />
            <p className="mt-1 text-xs text-slate-400">Auto-saved as you type</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary-950 hover:bg-primary-800 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            View original listing
            <ExternalLink size={14} />
          </a>
          <p className="text-xs text-slate-400">Use arrow keys to navigate</p>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

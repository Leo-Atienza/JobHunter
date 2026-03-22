'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Job } from '@/lib/types';
import { StatusSelect } from './StatusSelect';
import { getSourceColor, getSourceDisplayName, formatDate } from '@/lib/utils';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onUpdate: () => void;
  /** Navigate to prev/next job in the list */
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function JobDetailModal({ job, onClose, onUpdate, onNavigate, hasPrev, hasNext }: JobDetailModalProps) {
  const [notes, setNotes] = useState(job.notes ?? '');
  const [aiSummary, setAiSummary] = useState<string | null>(job.ai_summary ?? null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryFetchedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // SSR guard — createPortal needs document.body
  useEffect(() => { setMounted(true); }, []);

  // Reset state when job changes
  useEffect(() => {
    setNotes(job.notes ?? '');
    setAiSummary(job.ai_summary ?? null);
    summaryFetchedRef.current = false;
  }, [job.id, job.notes, job.ai_summary]);

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
        if (e.key === 'Escape') { (e.target as HTMLElement).blur(); onClose(); }
        return;
      }
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate?.('prev');
      if (e.key === 'ArrowRight' && hasNext) onNavigate?.('next');
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const saveNotes = useCallback(
    (newNotes: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/jobs/${job.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: newNotes }),
          });
        } catch {}
      }, 800);
    },
    [job.id],
  );

  function handleNotesChange(value: string) {
    setNotes(value);
    saveNotes(value);
  }

  const formattedDescription = useMemo(() => {
    if (!job.description) return null;
    let text = job.description;
    text = text.replace(/\s*(Requirements|Qualifications|Responsibilities|What you['']ll do|What we offer|About|Skills|Benefits|Duties|Experience|Education|Preferred|Must have|Nice to have|Key|Overview|Summary|Description|Role|Position|Job Type|Who you are|What you bring|Why join|Perks|Compensation|Salary|Location|How to apply)(\s*[:—\-])/gi, '\n\n$1$2');
    text = text.replace(/\s*([•·▪▸►●○◆\-–—]\s)/g, '\n$1');
    text = text.replace(/\s+(\d+[.)]\s)/g, '\n$1');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }, [job.description]);

  const sourceColors = getSourceColor(job.source);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            {onNavigate && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous job (Left arrow)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next job (Right arrow)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${sourceColors.bg} ${sourceColors.text}`}>
              {getSourceDisplayName(job.source)}
            </span>
            {job.also_on && job.also_on.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500" title={`Also on: ${job.also_on.map(getSourceDisplayName).join(', ')}`}>
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
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="Close (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title + company */}
          <div>
            <h2 className="text-xl font-bold text-primary-950 leading-tight">{job.title}</h2>
            {job.company && (
              <p className="mt-1 text-sm font-medium text-slate-600">{job.company}</p>
            )}
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {job.location && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Location</p>
                <p className="text-sm font-medium text-slate-700">{job.location}</p>
              </div>
            )}
            {job.salary && (
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Salary</p>
                <p className="text-sm font-semibold text-emerald-700">{job.salary}</p>
              </div>
            )}
            {job.job_type && (
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Type</p>
                <p className="text-sm font-medium text-blue-700">{job.job_type}</p>
              </div>
            )}
            {job.experience_level && (
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 mb-1">Level</p>
                <p className="text-sm font-medium text-purple-700">{job.experience_level}</p>
              </div>
            )}
            {job.relevance_score > 0 && (
              <div className={`rounded-lg p-3 ${
                job.relevance_score >= 80 ? 'bg-green-50' :
                job.relevance_score >= 50 ? 'bg-amber-50' : 'bg-orange-50'
              }`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Match</p>
                <p className={`text-sm font-bold ${
                  job.relevance_score >= 80 ? 'text-green-700' :
                  job.relevance_score >= 50 ? 'text-amber-700' : 'text-orange-700'
                }`}>{job.relevance_score}%</p>
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Posted</p>
              <p className="text-sm font-medium text-slate-700">{job.posted_date ?? formatDate(job.scraped_at)}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status:</span>
            <StatusSelect jobId={job.id} currentStatus={job.status} onUpdate={onUpdate} />
          </div>

          {/* AI Summary */}
          {(aiSummary || summaryLoading) && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
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

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
            {formattedDescription ? (
              <div className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                {formattedDescription}
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">No description available</p>
            )}
          </div>

          {/* Skills */}
          {job.skills && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.split(',').map((skill) => (
                  <span key={skill.trim()} className="inline-flex rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 border border-primary-200">
                    {skill.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Benefits</h4>
              <p className="text-sm leading-relaxed text-slate-600">{job.benefits}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add your notes about this position..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"
            />
            <p className="mt-1 text-xs text-slate-400">Auto-saved as you type</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            View original listing
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <p className="text-xs text-slate-400">
            Use arrow keys to navigate
          </p>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

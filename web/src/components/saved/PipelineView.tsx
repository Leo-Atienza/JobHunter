'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type { Job, JobStatus } from '@/lib/types';
import { cn, getSourceColor } from '@/lib/utils';

interface PipelineViewProps {
  jobs: Job[];
  onJobClick: (id: number) => void;
  onStatusChange: (jobId: number, sessionCode: string, newStatus: JobStatus) => void;
}

const PIPELINE_STAGES: {
  status: JobStatus;
  label: string;
  next: JobStatus | null;
  color: string;
  border: string;
  headerBg: string;
  headerText: string;
  gradientFrom: string;
}[] = [
  {
    status: 'saved',
    label: 'Saved',
    next: 'applied',
    color: 'text-purple-700',
    border: 'border-l-purple-400',
    headerBg: 'bg-purple-50',
    headerText: 'text-purple-800',
    gradientFrom: 'from-purple-50/60',
  },
  {
    status: 'applied',
    label: 'Applied',
    next: 'interview',
    color: 'text-amber-700',
    border: 'border-l-amber-400',
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-800',
    gradientFrom: 'from-amber-50/60',
  },
  {
    status: 'interview',
    label: 'Interview',
    next: 'offer',
    color: 'text-green-700',
    border: 'border-l-green-400',
    headerBg: 'bg-green-50',
    headerText: 'text-green-800',
    gradientFrom: 'from-green-50/60',
  },
  {
    status: 'offer',
    label: 'Offer',
    next: null,
    color: 'text-emerald-700',
    border: 'border-l-emerald-400',
    headerBg: 'bg-emerald-50',
    headerText: 'text-emerald-800',
    gradientFrom: 'from-emerald-50/60',
  },
];

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevRef.current = value;
  }, [value]);

  return <span>{display}</span>;
}

function formatDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PipelineView({ jobs, onJobClick, onStatusChange }: PipelineViewProps) {
  const grouped = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage.status] = [];
    }
    map['rejected'] = [];
    for (const job of jobs) {
      if (map[job.status]) {
        map[job.status].push(job);
      }
    }
    return map;
  }, [jobs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) {
      c[stage.status] = grouped[stage.status]?.length ?? 0;
    }
    c['rejected'] = grouped['rejected']?.length ?? 0;
    return c;
  }, [grouped]);

  return (
    <div className="space-y-6">
      {/* Mini stats row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {PIPELINE_STAGES.map((stage, i) => {
          const prevCount = i > 0 ? counts[PIPELINE_STAGES[i - 1].status] : null;
          const conversion = prevCount && prevCount > 0
            ? Math.round((counts[stage.status] / prevCount) * 100)
            : null;
          return (
            <div
              key={stage.status}
              className={cn(
                'relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br to-white p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                stage.gradientFrom
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn('font-display text-2xl font-extrabold sm:text-3xl', stage.color)}>
                  <AnimatedCounter value={counts[stage.status]} />
                </span>
                {conversion !== null && (
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200/60">
                    {conversion}%
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none sm:gap-4">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage.status} className="w-64 shrink-0 sm:w-72">
            {/* Column header */}
            <div className={cn('mb-3 flex items-center justify-between rounded-lg px-3 py-2', stage.headerBg)}>
              <span className={cn('text-sm font-bold', stage.headerText)}>{stage.label}</span>
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white',
                counts[stage.status] > 0 ? 'bg-slate-700' : 'bg-slate-300'
              )}>
                {counts[stage.status]}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {grouped[stage.status].length === 0 ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                      <div className="mt-2 h-2.5 w-1/2 rounded bg-slate-100" />
                    </div>
                  ))}
                  <p className="px-1 text-center text-[11px] text-slate-400">
                    {stage.status === 'saved'
                      ? 'Bookmark jobs to track them'
                      : `Move jobs here from ${PIPELINE_STAGES[PIPELINE_STAGES.indexOf(stage) - 1]?.label ?? 'previous stage'}`}
                  </p>
                </div>
              ) : (
                grouped[stage.status].map((job, index) => {
                  const sourceColor = getSourceColor(job.source);
                  return (
                    <div
                      key={job.id}
                      className={cn(
                        'group cursor-pointer rounded-xl border border-slate-200/80 border-l-4 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                        stage.border
                      )}
                      style={{ animationDelay: `${index * 40}ms` }}
                      onClick={() => onJobClick(job.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-slate-800">
                            {job.title}
                          </h4>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {job.company ?? 'Unknown company'}
                          </p>
                        </div>
                        {stage.next && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(job.id, job.session_code, stage.next!);
                            }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
                            title={`Move to ${PIPELINE_STAGES.find((s) => s.status === stage.next)?.label}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                            </svg>
                          </button>
                        )}
                        {!stage.next && (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', sourceColor.bg, sourceColor.text)}>
                          {job.source}
                        </span>
                        {job.posted_date && (
                          <span className="text-[10px] text-slate-400">{formatDate(job.posted_date)}</span>
                        )}
                      </div>
                      {job.salary && (
                        <p className="mt-1.5 truncate text-[11px] font-medium text-green-700">{job.salary}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Rejected section */}
      {counts['rejected'] > 0 && (
        <details className="group rounded-xl border border-slate-200/60 bg-slate-50/50">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700">
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="transition-transform group-open:rotate-90"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Rejected ({counts['rejected']})
          </summary>
          <div className="border-t border-slate-200/60 px-4 py-3">
            <div className="space-y-1.5">
              {grouped['rejected'].map((job) => (
                <div
                  key={job.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                  onClick={() => onJobClick(job.id)}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm line-through">{job.title}</span>
                    <span className="ml-2 text-xs">{job.company}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                    Rejected
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

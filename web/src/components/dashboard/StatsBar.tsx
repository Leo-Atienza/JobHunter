'use client';

import { useEffect, useRef, useState } from 'react';
import type { JobStats } from '@/lib/types';
import { getSourceColor, formatDate } from '@/lib/utils';

interface StatsBarProps {
  stats: JobStats;
}

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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevRef.current = value;
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export function StatsBar({ stats }: StatsBarProps) {
  const sources = Object.entries(stats.by_source);
  const statuses = Object.entries(stats.by_status);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {/* Total jobs */}
      <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-primary-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute top-3 right-3 text-primary-200/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        </div>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Jobs</p>
        <p className="mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold text-primary-950">
          <AnimatedCounter value={stats.total} />
        </p>
        <p className="mt-1 text-[10px] sm:text-xs text-slate-400 truncate">
          Last updated {formatDate(stats.last_updated)}
        </p>
      </div>

      {/* By source */}
      <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-blue-50/30 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute top-3 right-3 text-blue-200/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
          </svg>
        </div>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">By Source</p>
        <div className="mt-2 sm:mt-3 flex flex-wrap gap-1">
          {sources.length > 0 ? (
            sources.map(([source, count]) => {
              const colors = getSourceColor(source);
              return (
                <span
                  key={source}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${colors.bg} ${colors.text}`}
                >
                  {source}
                  <span className="opacity-70">{count}</span>
                </span>
              );
            })
          ) : (
            <span className="text-xs sm:text-sm text-slate-300">No data yet</span>
          )}
        </div>
      </div>

      {/* By status */}
      <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-violet-50/30 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute top-3 right-3 text-violet-200/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">By Status</p>
        <div className="mt-2 sm:mt-3 flex flex-wrap gap-1">
          {statuses.length > 0 ? (
            statuses.map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-700"
              >
                {status}
                <span className="opacity-60">{count}</span>
              </span>
            ))
          ) : (
            <span className="text-xs sm:text-sm text-slate-300">No data yet</span>
          )}
        </div>
      </div>

      {/* Salary insights */}
      <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute top-3 right-3 text-emerald-200/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Salary Insights</p>
        {stats.avg_salary ? (
          <>
            <p className="mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold text-emerald-600">
              ${Math.round(stats.avg_salary / 1000)}k
            </p>
            <p className="mt-1 text-[10px] sm:text-xs text-slate-400">
              avg across {stats.with_salary_count} jobs with salary
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold text-slate-300">—</p>
            <p className="mt-1 text-[10px] sm:text-xs text-slate-400">No salary data yet</p>
          </>
        )}
      </div>

      {/* Job quality */}
      <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-amber-50/30 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="absolute top-3 right-3 text-amber-200/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Job Quality</p>
        <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
          {stats.avg_match !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${
              stats.avg_match >= 60 ? 'bg-green-100 text-green-700' :
              stats.avg_match >= 40 ? 'bg-amber-100 text-amber-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {stats.avg_match}% avg match
            </span>
          )}
          {stats.ghost_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-red-600">
              {stats.ghost_count} expired
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-600">
            {sources.length} sources
          </span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Globe, CheckCircle2, DollarSign, Star } from 'lucide-react';
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {/* Total jobs */}
      <div className="stagger-1 group to-primary-50/40 relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
        <div className="text-primary-200/60 absolute top-3 right-3">
          <ClipboardList size={20} />
        </div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-xs">
          Total Jobs
        </p>
        <p className="font-display text-primary-950 mt-1 text-2xl font-extrabold sm:mt-2 sm:text-4xl">
          <AnimatedCounter value={stats.total} />
        </p>
        <p className="mt-1 truncate text-[10px] text-slate-400 sm:text-xs">
          Last updated {formatDate(stats.last_updated)}
        </p>
      </div>

      {/* By source */}
      <div className="stagger-2 group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-blue-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
        <div className="absolute top-3 right-3 text-blue-200/60">
          <Globe size={20} />
        </div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-xs">
          By Source
        </p>
        <div className="scrollbar-none mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto sm:mt-3">
          {sources.length > 0 ? (
            sources.map(([source, count]) => {
              const colors = getSourceColor(source);
              return (
                <span
                  key={source}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${colors.bg} ${colors.text}`}
                >
                  {source}
                  <span className="opacity-70">{count}</span>
                </span>
              );
            })
          ) : (
            <span className="text-xs text-slate-300 sm:text-sm">No data yet</span>
          )}
        </div>
      </div>

      {/* By status */}
      <div className="stagger-3 group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-violet-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
        <div className="absolute top-3 right-3 text-violet-200/60">
          <CheckCircle2 size={20} />
        </div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-xs">
          By Status
        </p>
        <div className="scrollbar-none mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto sm:mt-3">
          {statuses.length > 0 ? (
            statuses.map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 sm:text-xs"
              >
                {status}
                <span className="opacity-60">{count}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-300 sm:text-sm">No data yet</span>
          )}
        </div>
      </div>

      {/* Salary insights */}
      <div className="stagger-4 group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
        <div className="absolute top-3 right-3 text-emerald-200/60">
          <DollarSign size={20} />
        </div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-xs">
          Salary Insights
        </p>
        {stats.avg_salary ? (
          <>
            <p className="font-display mt-1 text-2xl font-extrabold text-emerald-600 sm:mt-2 sm:text-4xl">
              $<AnimatedCounter value={Math.round(stats.avg_salary / 1000)} />k
            </p>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">
              avg across {stats.with_salary_count} jobs with salary
            </p>
          </>
        ) : (
          <>
            <p className="font-display mt-1 text-2xl font-extrabold text-slate-300 sm:mt-2 sm:text-4xl">
              —
            </p>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">No salary data yet</p>
          </>
        )}
      </div>

      {/* Job quality */}
      <div className="stagger-5 group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-amber-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
        <div className="absolute top-3 right-3 text-amber-200/60">
          <Star size={20} />
        </div>
        <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-xs">
          Job Quality
        </p>
        <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
          {stats.avg_match !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${
                stats.avg_match >= 60
                  ? 'bg-green-100 text-green-700'
                  : stats.avg_match >= 40
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-orange-100 text-orange-700'
              }`}
            >
              {stats.avg_match}% avg match
            </span>
          )}
          {stats.ghost_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 sm:text-xs">
              {stats.ghost_count} expired
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:text-xs">
            {sources.length} sources
          </span>
        </div>
      </div>
    </div>
  );
}

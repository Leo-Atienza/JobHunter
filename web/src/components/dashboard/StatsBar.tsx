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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* Total jobs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">Total Jobs</p>
        <p className="mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold text-primary-950">
          <AnimatedCounter value={stats.total} />
        </p>
        <p className="mt-1 text-[10px] sm:text-xs text-slate-400 truncate">
          Last updated {formatDate(stats.last_updated)}
        </p>
      </div>

      {/* By source */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">By Source</p>
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">By Status</p>
        <div className="mt-2 sm:mt-3 flex flex-wrap gap-1">
          {statuses.length > 0 ? (
            statuses.map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-700"
              >
                {status}
                <span className="opacity-70">{count}</span>
              </span>
            ))
          ) : (
            <span className="text-xs sm:text-sm text-slate-300">No data yet</span>
          )}
        </div>
      </div>

      {/* Quick info */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">Sources Active</p>
        <p className="mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold text-accent-500">
          <AnimatedCounter value={sources.length} />
        </p>
        <p className="mt-1 text-[10px] sm:text-xs text-slate-400 truncate">
          {sources.map(([s]) => s).join(', ') || 'None yet'}
        </p>
      </div>
    </div>
  );
}

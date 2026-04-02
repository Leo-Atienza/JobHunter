'use client';

import { useEffect, useState } from 'react';
import { getSourceDisplayName } from '@/lib/utils';

interface SourceHealth {
  total_runs: number;
  success_count: number;
  error_count: number;
  zero_result_count: number;
  avg_jobs_found: number;
  avg_duration_ms: number;
  last_run: string;
  last_error: string | null;
  success_rate: number;
}

interface HealthData {
  sources: Record<string, SourceHealth>;
  overall: {
    total_runs: number;
    success_rate: number;
    sources_tracked: number;
    days: number;
  };
}

/** Returns badge class pair based on success rate. */
function statusColor(rate: number): string {
  if (rate >= 90) return 'text-success-600 bg-success-50';
  if (rate >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-error-600 bg-error-50';
}

/** Returns dot color class based on success rate. */
function statusDot(rate: number): string {
  if (rate >= 90) return 'bg-success-500';
  if (rate >= 50) return 'bg-amber-500';
  return 'bg-error-500';
}

/** Formats milliseconds as human-readable duration. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Returns relative time string from an ISO timestamp. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Skeleton screens
// ---------------------------------------------------------------------------

/** Skeleton placeholder rendered while health data is loading. */
function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Time range pill skeletons */}
      <div className="flex items-center gap-2">
        <div className="animate-pulse h-4 w-20 rounded bg-slate-100" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-8 w-12 rounded-lg bg-slate-100" />
        ))}
      </div>

      {/* Summary card skeletons */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-slate-100 h-24"
          />
        ))}
      </div>

      {/* Table row skeletons */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="p-4 space-y-3">
          {/* Header bar */}
          <div className="animate-pulse h-4 w-full rounded bg-slate-100" />
          {/* 8 row pairs */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={`animate-pulse h-4 rounded bg-slate-100 ${
                  i % 2 === 0 ? 'w-3/4' : 'w-2/3'
                }`}
              />
              <div
                className={`animate-pulse h-4 rounded bg-slate-100 ${
                  i % 2 === 0 ? 'w-1/4' : 'w-1/3'
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  /** Card label shown in small caps above the value. */
  label: string;
  /** Formatted value displayed prominently. */
  value: string | number;
  /** Tailwind color token prefix, controls gradient and text hue. */
  color?: 'primary' | 'success' | 'amber' | 'error';
  /**
   * Literal stagger class from globals.css utilities.
   * Pass as a full class string (e.g. "stagger-1") so Tailwind's scanner
   * sees the literal token, matching the StatsBar pattern.
   */
  staggerClass: 'stagger-1' | 'stagger-2' | 'stagger-3' | 'stagger-4';
  /** Decorative SVG icon rendered at low opacity. */
  icon: React.ReactNode;
}

/** L100 summary card matching StatsBar visual language. */
function SummaryCard({ label, value, color = 'primary', staggerClass, icon }: SummaryCardProps) {
  const gradientMap = {
    primary: 'bg-gradient-to-br from-white to-primary-50/40',
    success: 'bg-gradient-to-br from-white to-emerald-50/40',
    amber:   'bg-gradient-to-br from-white to-amber-50/40',
    error:   'bg-gradient-to-br from-white to-red-50/40',
  };

  const valueColorMap = {
    primary: 'text-primary-950',
    success: 'text-success-600',
    amber:   'text-amber-600',
    error:   'text-error-600',
  };

  const iconOpacityMap = {
    primary: 'text-primary-200/60',
    success: 'text-emerald-200/60',
    amber:   'text-amber-200/60',
    error:   'text-red-200/60',
  };

  return (
    <div
      className={`${staggerClass} group relative overflow-hidden rounded-xl border border-slate-200/80 ${gradientMap[color]} p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      {/* Decorative icon — purely visual, hidden from assistive tech */}
      <div className={`absolute top-3 right-3 ${iconOpacityMap[color]}`} aria-hidden="true">
        {icon}
      </div>

      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`mt-1 sm:mt-2 font-display text-2xl sm:text-4xl font-extrabold ${valueColorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icon helpers — inline to avoid extra imports
// ---------------------------------------------------------------------------

function IconZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mobile source card
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source: string;
  s: SourceHealth;
  index: number;
}

/** Card-based layout for each source shown on mobile (below sm breakpoint). */
function SourceCard({ source, s, index }: SourceCardProps) {
  return (
    <div
      className="animate-fade-in rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Source name + status badge */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-display font-semibold text-primary-950 truncate">
          {getSourceDisplayName(source)}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(s.success_rate)}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s.success_rate)}`} />
          {s.success_rate}%
        </span>
      </div>

      {/* 2-col metrics grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Runs</dt>
          <dd className="mt-0.5 text-slate-700 font-semibold">{s.total_runs}</dd>
        </div>
        <div>
          <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Errors</dt>
          <dd className={`mt-0.5 font-semibold ${s.error_count > 0 ? 'text-error-600' : 'text-slate-400'}`}>
            {s.error_count || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Avg Jobs</dt>
          <dd className="mt-0.5 text-slate-700 font-semibold">{s.avg_jobs_found}</dd>
        </div>
        <div>
          <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Avg Time</dt>
          <dd className="mt-0.5 text-slate-700 font-semibold">{formatDuration(s.avg_duration_ms)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Last Run</dt>
          <dd className="mt-0.5 text-slate-500">
            <span title={new Date(s.last_run).toLocaleString()}>{timeAgo(s.last_run)}</span>
          </dd>
        </div>

        {s.last_error && (
          <div className="col-span-2">
            <dt className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Last Error</dt>
            <dd className="mt-0.5 text-error-500 text-xs">
              {s.last_error.length > 80 ? (
                <details>
                  <summary className="cursor-pointer select-none">{s.last_error.slice(0, 80)}…</summary>
                  <span className="mt-1 block">{s.last_error}</span>
                </details>
              ) : (
                s.last_error
              )}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function ScraperHealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`/api/scraper-health?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setData(d as HealthData);
          setError(null);
        }
      })
      .catch(() => active && setError('Failed to load health data'))
      .finally(() => active && setLoading(false));

    // Auto-refresh every 30s without triggering the full loading skeleton
    const interval = setInterval(() => {
      fetch(`/api/scraper-health?days=${days}`)
        .then((r) => r.json())
        .then((d) => active && setData(d as HealthData))
        .catch(() => {});
    }, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [days]);

  if (loading) return <SkeletonDashboard />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-center text-error-700">
        {error ?? 'No data available'}
      </div>
    );
  }

  const entries = Object.entries(data.sources).sort(
    ([, a], [, b]) => a.success_rate - b.success_rate,
  );

  const sourcesWithErrors = entries.filter(([, s]) => s.error_count > 0).length;
  const sourcesZeroResults = entries.filter(([, s]) => s.zero_result_count > 0).length;

  /** Derive the appropriate color for the success-rate card. */
  const successRateColor =
    data.overall.success_rate >= 90 ? 'success' : data.overall.success_rate >= 50 ? 'amber' : 'error';

  return (
    <div className="space-y-6">

      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Time range:</span>
        {([1, 7, 30] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              days === d
                ? 'bg-primary-950 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200'
            }`}
          >
            {d === 1 ? '24h' : `${d}d`}
          </button>
        ))}
      </div>

      {/* Summary cards — L100 StatsBar pattern */}
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Total Runs"
          value={data.overall.total_runs}
          color="primary"
          staggerClass="stagger-1"
          icon={<IconZap />}
        />
        <SummaryCard
          label="Success Rate"
          value={`${data.overall.success_rate}%`}
          color={successRateColor}
          staggerClass="stagger-2"
          icon={<IconCheckCircle />}
        />
        <SummaryCard
          label="Sources with Errors"
          value={sourcesWithErrors}
          color={sourcesWithErrors > 0 ? 'amber' : 'success'}
          staggerClass="stagger-3"
          icon={<IconAlertTriangle />}
        />
        <SummaryCard
          label="Zero-Result Sources"
          value={sourcesZeroResults}
          color={sourcesZeroResults > 0 ? 'amber' : 'success'}
          staggerClass="stagger-4"
          icon={<IconEyeOff />}
        />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">
            No scraper runs recorded yet. Run a search to start collecting health data.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Runs</th>
                    <th className="px-4 py-3 text-right">Success</th>
                    <th className="px-4 py-3 text-right">Errors</th>
                    <th className="px-4 py-3 text-right">Avg Jobs</th>
                    <th className="px-4 py-3 text-right">Avg Time</th>
                    <th className="px-4 py-3">Last Run</th>
                    <th className="px-4 py-3">Last Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(([source, s], index) => (
                    <tr
                      key={source}
                      className="animate-fade-in hover:bg-slate-50 transition-colors duration-100"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-3 font-medium text-primary-950">
                        {getSourceDisplayName(source)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(s.success_rate)}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s.success_rate)}`} />
                          {s.success_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.total_runs}</td>
                      <td className="px-4 py-3 text-right text-success-600">{s.success_count}</td>
                      <td className="px-4 py-3 text-right text-error-600">{s.error_count || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.avg_jobs_found}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatDuration(s.avg_duration_ms)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <span title={new Date(s.last_run).toLocaleString()}>
                          {timeAgo(s.last_run)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] text-error-500 text-xs">
                        {s.last_error ? (
                          s.last_error.length > 80 ? (
                            <details>
                              <summary className="cursor-pointer select-none truncate max-w-[180px]">
                                {s.last_error.slice(0, 80)}…
                              </summary>
                              <span className="mt-1 block whitespace-normal">{s.last_error}</span>
                            </details>
                          ) : (
                            <span className="truncate block max-w-[180px]">{s.last_error}</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list — shown below sm breakpoint */}
          <div className="sm:hidden space-y-3">
            {entries.map(([source, s], index) => (
              <SourceCard key={source} source={source} s={s} index={index} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

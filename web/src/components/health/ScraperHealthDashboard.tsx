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


function statusColor(rate: number): string {
  if (rate >= 90) return 'text-success-600 bg-success-50';
  if (rate >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-error-600 bg-error-50';
}

function statusDot(rate: number): string {
  if (rate >= 90) return 'bg-success-500';
  if (rate >= 50) return 'bg-amber-500';
  return 'bg-error-500';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

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

    // Auto-refresh every 30s
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Time range:</span>
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              days === d
                ? 'bg-primary-950 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {d === 1 ? '24h' : `${d}d`}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Runs" value={data.overall.total_runs} />
        <SummaryCard
          label="Success Rate"
          value={`${data.overall.success_rate}%`}
          color={data.overall.success_rate >= 90 ? 'success' : data.overall.success_rate >= 50 ? 'amber' : 'error'}
        />
        <SummaryCard label="Sources with Errors" value={sourcesWithErrors} color={sourcesWithErrors > 0 ? 'amber' : 'success'} />
        <SummaryCard label="Zero-Result Sources" value={sourcesZeroResults} color={sourcesZeroResults > 0 ? 'amber' : 'success'} />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No scraper runs recorded yet. Run a search to start collecting health data.</p>
        </div>
      ) : (
        <>
          {/* Source table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                  {entries.map(([source, s]) => (
                    <tr key={source} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-primary-950">
                        {getSourceDisplayName(source)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(s.success_rate)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(s.success_rate)}`} />
                          {s.success_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.total_runs}</td>
                      <td className="px-4 py-3 text-right text-success-600">{s.success_count}</td>
                      <td className="px-4 py-3 text-right text-error-600">{s.error_count || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.avg_jobs_found}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatDuration(s.avg_duration_ms)}</td>
                      <td className="px-4 py-3 text-slate-500">{timeAgo(s.last_run)}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-error-500 text-xs">
                        {s.last_error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = 'slate',
}: {
  label: string;
  value: string | number;
  color?: 'slate' | 'success' | 'amber' | 'error';
}) {
  const colorMap = {
    slate: 'text-primary-950',
    success: 'text-success-600',
    amber: 'text-amber-600',
    error: 'text-error-600',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

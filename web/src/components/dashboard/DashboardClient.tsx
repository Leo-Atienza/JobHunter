'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import type { Job, JobStats } from '@/lib/types';
import { StatsBar } from './StatsBar';
import { Filters } from './Filters';
import { SearchBar } from './SearchBar';
import { JobTable } from './JobTable';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';
import { DeleteButton } from './DeleteButton';
import { RescanButton } from './RescanButton';
import { WaitingState } from './WaitingState';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatTimestamp } from '@/lib/utils';

interface DashboardClientProps {
  code: string;
  expiresAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DashboardClient({ code, expiresAt }: DashboardClientProps) {
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [remoteFilter, setRemoteFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Job>('relevance_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const lastTotalRef = useRef<number>(0);
  const staleCountRef = useRef<number>(0);
  const [refreshInterval, setRefreshInterval] = useState(10000);

  // Build query URL
  let jobsUrl = `/api/jobs?session=${code}`;
  if (sourceFilter) jobsUrl += `&source=${sourceFilter}`;
  if (statusFilter) jobsUrl += `&status=${statusFilter}`;

  const { data: jobs, mutate: mutateJobs } = useSWR<Job[]>(jobsUrl, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
  });

  const { data: stats } = useSWR<JobStats>(
    `/api/jobs/stats?session=${code}`,
    fetcher,
    { refreshInterval, revalidateOnFocus: true }
  );

  // Adaptive polling — slow down when nothing changes
  useEffect(() => {
    if (stats) {
      if (stats.total === lastTotalRef.current) {
        staleCountRef.current++;
        if (staleCountRef.current >= 12) {
          // ~2 minutes at 10s intervals
          setRefreshInterval(60000);
        }
      } else {
        staleCountRef.current = 0;
        setRefreshInterval(10000);
      }
      lastTotalRef.current = stats.total;
    }
  }, [stats]);

  const handleSort = useCallback(
    (field: keyof Job) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  const handleJobUpdate = useCallback(() => {
    void mutateJobs();
  }, [mutateJobs]);

  const handleRescanStart = useCallback(() => {
    staleCountRef.current = 0;
    setRefreshInterval(10000);
  }, []);

  // Filter and sort jobs client-side
  const filteredJobs = (jobs ?? [])
    .filter((job) => {
      if (!remoteFilter) return true;
      return /remote|work from home|wfh|anywhere/i.test(job.location ?? '');
    })
    .filter((job) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        (job.company?.toLowerCase().includes(q) ?? false) ||
        (job.location?.toLowerCase().includes(q) ?? false) ||
        (job.salary?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const isLoading = jobs === undefined;
  const hasJobs = (jobs?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-950">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <span className="font-display text-lg font-bold text-primary-950">JobHunter</span>
            </a>
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
              <span className="font-mono text-sm font-semibold text-primary-800">{code}</span>
              <CopyButton text={code} />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block text-right">
              <p className="text-xs text-slate-400">
                Expires {formatTimestamp(expiresAt)}
              </p>
            </div>
            <RescanButton code={code} onRescanStart={handleRescanStart} />
            <ShareButton code={code} jobCount={stats?.total ?? 0} disabled={!hasJobs} />
            <ExportButton code={code} disabled={!hasJobs} />
            <DeleteButton code={code} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats */}
        {stats && <StatsBar stats={stats} />}

        {isLoading ? (
          /* Loading skeleton */
          <div className="mt-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : !hasJobs ? (
          <WaitingState code={code} />
        ) : (
          <>
            {/* Filters and search */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Filters
                sourceFilter={sourceFilter}
                statusFilter={statusFilter}
                remoteFilter={remoteFilter}
                onSourceChange={setSourceFilter}
                onStatusChange={setStatusFilter}
                onRemoteChange={setRemoteFilter}
                stats={stats ?? null}
              />
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-slate-500">
              Showing <span className="font-semibold text-primary-800">{filteredJobs.length}</span> of{' '}
              <span className="font-semibold">{jobs?.length ?? 0}</span> jobs
            </div>

            {/* Job table */}
            <JobTable
              jobs={filteredJobs}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onJobUpdate={handleJobUpdate}
            />
          </>
        )}
      </main>
    </div>
  );
}

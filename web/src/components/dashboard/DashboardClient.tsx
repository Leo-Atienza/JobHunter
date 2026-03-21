'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import type { Job, JobStats, Session } from '@/lib/types';
import { StatsBar } from './StatsBar';
import { Filters } from './Filters';
import { SearchBar } from './SearchBar';
import { JobTable } from './JobTable';
import { JobCard } from './JobCard';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';
import { DeleteButton } from './DeleteButton';
import { RescanButton } from './RescanButton';
import { WaitingState } from './WaitingState';
import { ScrapeProgress } from './ScrapeProgress';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatTimestamp } from '@/lib/utils';
import { ActionsMenu } from './ActionsMenu';

interface DashboardClientProps {
  code: string;
  expiresAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DashboardClient({ code, expiresAt }: DashboardClientProps) {
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [remoteFilter, setRemoteFilter] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<string | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState<string | null>(null);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
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

  // Fetch session preferences (for auto-scraping source list)
  const { data: session } = useSWR<Session>(
    `/api/session/${code}`,
    fetcher,
    { revalidateOnFocus: false }
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

  // Merge duplicates: hide duplicate rows, add "also_on" sources to primary
  const allJobs = jobs ?? [];
  const primaryJobs = (() => {
    const duplicateSourceMap = new Map<number, string[]>();
    // Collect sources from duplicate entries
    for (const job of allJobs) {
      if (job.duplicate_of) {
        const existing = duplicateSourceMap.get(job.duplicate_of) ?? [];
        existing.push(job.source);
        duplicateSourceMap.set(job.duplicate_of, existing);
      }
    }
    // Filter out duplicates, attach also_on to primaries
    return allJobs
      .filter((job) => !job.duplicate_of)
      .map((job) => ({
        ...job,
        also_on: duplicateSourceMap.get(job.id) ?? [],
      }));
  })();

  // Filter and sort jobs client-side
  const filteredJobs = primaryJobs
    .filter((job) => {
      if (!remoteFilter) return true;
      return /remote|work from home|wfh|anywhere/i.test(job.location ?? '');
    })
    .filter((job) => {
      if (!experienceFilter) return true;
      return job.experience_level?.toLowerCase() === experienceFilter.toLowerCase();
    })
    .filter((job) => {
      if (!jobTypeFilter) return true;
      return job.job_type?.toLowerCase() === jobTypeFilter.toLowerCase();
    })
    .filter((job) => {
      const minVal = salaryMin ? parseInt(salaryMin, 10) * 1000 : 0;
      const maxVal = salaryMax ? parseInt(salaryMax, 10) * 1000 : Infinity;
      if (!minVal && maxVal === Infinity) return true;
      // If job has no parsed salary, include it (don't hide jobs with unknown salary)
      if (!job.salary_min && !job.salary_max) return true;
      const jobMin = job.salary_min ?? 0;
      const jobMax = job.salary_max ?? Infinity;
      return jobMax >= minVal && jobMin <= maxVal;
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-950">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <span className="hidden sm:inline font-display text-lg font-bold text-primary-950">JobHunter</span>
            </a>
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 sm:gap-2 sm:px-3">
              <span className="font-mono text-xs font-semibold text-primary-800 sm:text-sm">{code}</span>
              <CopyButton text={code} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden lg:block text-right">
              <p className="text-xs text-slate-400">
                Expires {formatTimestamp(expiresAt)}
              </p>
            </div>
            {/* Desktop: show individual buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <RescanButton code={code} onRescanStart={handleRescanStart} />
              <ShareButton code={code} jobCount={stats?.total ?? 0} disabled={!hasJobs} />
              <ExportButton code={code} disabled={!hasJobs} />
              <DeleteButton code={code} />
            </div>
            {/* Mobile: collapsed menu */}
            <div className="sm:hidden">
              <ActionsMenu
                code={code}
                hasJobs={hasJobs}
                jobCount={stats?.total ?? 0}
                onRescanStart={handleRescanStart}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
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
          <ScrapeProgress code={code} sessionSources={session?.sources ?? null} />
        ) : (
          <>
            {/* Filters and search */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <Filters
                sourceFilter={sourceFilter}
                statusFilter={statusFilter}
                remoteFilter={remoteFilter}
                experienceFilter={experienceFilter}
                jobTypeFilter={jobTypeFilter}
                salaryMin={salaryMin}
                salaryMax={salaryMax}
                onSourceChange={setSourceFilter}
                onStatusChange={setStatusFilter}
                onRemoteChange={setRemoteFilter}
                onExperienceChange={setExperienceFilter}
                onJobTypeChange={setJobTypeFilter}
                onSalaryMinChange={setSalaryMin}
                onSalaryMaxChange={setSalaryMax}
                stats={stats ?? null}
              />
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            {/* Results count + view toggle */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Showing <span className="font-semibold text-primary-800">{filteredJobs.length}</span> of{' '}
                <span className="font-semibold">{jobs?.length ?? 0}</span> jobs
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Table view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Job list */}
            {viewMode === 'table' ? (
              <JobTable
                jobs={filteredJobs}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onJobUpdate={handleJobUpdate}
              />
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredJobs.map((job) => (
                  <JobCard key={job.id} job={job} onUpdate={handleJobUpdate} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

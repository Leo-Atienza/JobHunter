'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import type { Job, JobStats, Session } from '@/lib/types';
import { StatsBar } from './StatsBar';
import { Filters } from './Filters';
import { SearchBar } from './SearchBar';
import { JobTable } from './JobTable';
import { LazyJobCard } from './LazyJobCard';
import { ExportButton } from './ExportButton';
import { ShareButton } from './ShareButton';
import { DeleteButton } from './DeleteButton';
import { RescanButton } from './RescanButton';
import { ScrapeProgress } from './ScrapeProgress';
import { Pagination } from './Pagination';
import { JobDetailModal } from './JobDetailModal';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatTimestamp } from '@/lib/utils';
import { ActionsMenu } from './ActionsMenu';
import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';
import { ResumeUpload } from './ResumeUpload';
import { useSession } from 'next-auth/react';

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
  const [freshnessFilter, setFreshnessFilter] = useState<string | null>(null);
  const [hideGhosts, setHideGhosts] = useState(false);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window === 'undefined') return 'table';
    return (localStorage.getItem('jobhunter_view_mode') as 'table' | 'cards')
      ?? (window.innerWidth < 640 ? 'cards' : 'table');
  });
  const [sortField, setSortField] = useState<keyof Job>('relevance_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const lastTotalRef = useRef<number>(0);
  const staleCountRef = useRef<number>(0);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const { data: authSession } = useSession();

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
      setCurrentPage(1);
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

  // Reset page when filters change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  // Merge duplicates: hide duplicate rows, add "also_on" sources to primary
  const allJobs = jobs ?? [];
  const primaryJobs = useMemo(() => {
    const duplicateSourceMap = new Map<number, string[]>();
    for (const job of allJobs) {
      if (job.duplicate_of) {
        const existing = duplicateSourceMap.get(job.duplicate_of) ?? [];
        existing.push(job.source);
        duplicateSourceMap.set(job.duplicate_of, existing);
      }
    }
    return allJobs
      .filter((job) => !job.duplicate_of)
      .map((job) => ({
        ...job,
        also_on: duplicateSourceMap.get(job.id) ?? [],
      }));
  }, [allJobs]);

  // Filter and sort jobs client-side
  const filteredJobs = useMemo(() => {
    return primaryJobs
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
        // Exclude jobs with no salary data when salary filter is active
        if (!job.salary_min && !job.salary_max) return false;
        const jobMin = job.salary_min ?? 0;
        const jobMax = job.salary_max ?? Infinity;
        return jobMax >= minVal && jobMin <= maxVal;
      })
      .filter((job) => {
        if (!freshnessFilter) return true;
        const days = parseInt(freshnessFilter, 10);
        const cutoff = Date.now() - days * 86400000;
        // Use posted_date if available, fall back to scraped_at
        const dateStr = job.posted_date ?? job.scraped_at;
        const parsed = new Date(dateStr).getTime();
        return !isNaN(parsed) && parsed >= cutoff;
      })
      .filter((job) => {
        if (!hideGhosts) return true;
        return !job.is_ghost;
      })
      .filter((job) => {
        if (!companyFilter) return true;
        return job.company?.toLowerCase().includes(companyFilter.toLowerCase()) ?? false;
      })
      .filter((job) => {
        if (!locationFilter) return true;
        const loc = job.location?.toLowerCase() ?? '';
        if (locationFilter === 'remote') {
          return /remote|work from home|wfh|anywhere|worldwide/i.test(loc);
        }
        if (locationFilter === 'near' && session?.location) {
          const city = session.location.split(',')[0].trim().toLowerCase();
          return loc.includes(city);
        }
        if (locationFilter === 'other') {
          const isRemote = /remote|work from home|wfh|anywhere|worldwide/i.test(loc);
          const isNear = session?.location
            ? loc.includes(session.location.split(',')[0].trim().toLowerCase())
            : false;
          return !isRemote && !isNear;
        }
        return true;
      })
      .filter((job) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          job.title.toLowerCase().includes(q) ||
          (job.company?.toLowerCase().includes(q) ?? false) ||
          (job.location?.toLowerCase().includes(q) ?? false) ||
          (job.salary?.toLowerCase().includes(q) ?? false) ||
          (job.description?.toLowerCase().includes(q) ?? false)
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
  }, [primaryJobs, remoteFilter, experienceFilter, jobTypeFilter, salaryMin, salaryMax, freshnessFilter, hideGhosts, companyFilter, locationFilter, session, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, safePage, pageSize]);

  // Keep page in bounds when filters shrink result set
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Job detail modal
  const selectedJob = useMemo(
    () => filteredJobs.find((j) => j.id === selectedJobId) ?? null,
    [filteredJobs, selectedJobId],
  );

  const selectedIndex = selectedJob ? filteredJobs.indexOf(selectedJob) : -1;

  const handleJobClick = useCallback((jobId: number) => {
    if ('startViewTransition' in document) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        setSelectedJobId(jobId);
      });
    } else {
      setSelectedJobId(jobId);
    }
  }, []);

  const handleModalNavigate = useCallback((direction: 'prev' | 'next') => {
    if (selectedIndex === -1) return;
    const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < filteredJobs.length) {
      setSelectedJobId(filteredJobs[newIndex].id);
      // If navigating beyond current page, update page
      const newPage = Math.floor(newIndex / pageSize) + 1;
      if (newPage !== safePage) setCurrentPage(newPage);
    }
  }, [selectedIndex, filteredJobs, pageSize, safePage]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const isLoading = jobs === undefined;
  const hasJobs = (jobs?.length ?? 0) > 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-950">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <span className="hidden sm:inline font-display text-lg font-bold text-primary-950">JobHunter</span>
            </Link>
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 sm:gap-2 sm:px-3">
              <span className="font-mono text-xs font-semibold text-primary-800 sm:text-sm">{code}</span>
              <CopyButton text={code} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/saved"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="10" y="8" width="5" height="13" rx="1" />
                <rect x="17" y="5" width="5" height="16" rx="1" />
              </svg>
              Tracker
            </Link>
            <div className="hidden lg:block text-right">
              <p className="text-xs text-slate-400">
                Expires {formatTimestamp(expiresAt)}
              </p>
            </div>
            {/* Desktop: show individual buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <RescanButton code={code} onRescanStart={handleRescanStart} onComplete={handleJobUpdate} />
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
                onRescanComplete={handleJobUpdate}
              />
            </div>
            <div className="ml-1 border-l border-slate-200 pl-2">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Stats */}
        {stats ? (
          <StatsBar stats={stats} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        )}

        {/* Resume upload for match scoring */}
        <div className="mt-4">
          <ResumeUpload
            sessionCode={code}
            onScored={handleJobUpdate}
            isSignedIn={!!authSession?.user?.id}
            sessionResumeProfile={session?.resume_skills ?? null}
          />
        </div>

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
                freshnessFilter={freshnessFilter}
                hideGhosts={hideGhosts}
                companyFilter={companyFilter}
                sessionCompanies={session?.companies ?? null}
                onSourceChange={(v) => { setSourceFilter(v); resetPage(); }}
                onStatusChange={(v) => { setStatusFilter(v); resetPage(); }}
                onRemoteChange={(v) => { setRemoteFilter(v); resetPage(); }}
                onExperienceChange={(v) => { setExperienceFilter(v); resetPage(); }}
                onJobTypeChange={(v) => { setJobTypeFilter(v); resetPage(); }}
                onSalaryMinChange={(v) => { setSalaryMin(v); resetPage(); }}
                onSalaryMaxChange={(v) => { setSalaryMax(v); resetPage(); }}
                onFreshnessChange={(v) => { setFreshnessFilter(v); resetPage(); }}
                onHideGhostsChange={(v) => { setHideGhosts(v); resetPage(); }}
                onCompanyChange={(v) => { setCompanyFilter(v); resetPage(); }}
                locationFilter={locationFilter}
                sessionLocation={session?.location ?? null}
                onLocationChange={(v) => { setLocationFilter(v); resetPage(); }}
                stats={stats ?? null}
              />
              <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} />
            </div>

            {/* Results count + view toggle */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-500" aria-live="polite" aria-atomic="true">
                Showing <span className="font-bold text-primary-900">{filteredJobs.length}</span> of{' '}
                <span className="font-semibold">{primaryJobs.length}</span> jobs
                {filteredJobs.length !== primaryJobs.length && (
                  <span className="ml-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-600">filtered</span>
                )}
                {stats && stats.ghost_count > 0 && !hideGhosts && (
                  <span className="ml-2 text-error-500">{stats.ghost_count} possibly expired</span>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  onClick={() => { setViewMode('table'); localStorage.setItem('jobhunter_view_mode', 'table'); }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Table view"
                  aria-label="Switch to table view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
                <button
                  onClick={() => { setViewMode('cards'); localStorage.setItem('jobhunter_view_mode', 'cards'); }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card view"
                  aria-label="Switch to card view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Job list — paginated */}
            {viewMode === 'table' ? (
              <JobTable
                jobs={paginatedJobs}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onJobUpdate={handleJobUpdate}
                onJobClick={handleJobClick}
                sessionCode={code}
              />
            ) : (
              <div className="mt-4 grid gap-3 grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3">
                {paginatedJobs.map((job) => (
                  <LazyJobCard key={job.id} job={job} onUpdate={handleJobUpdate} onJobClick={handleJobClick} sessionCode={code} />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredJobs.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
      </main>

      {/* Job detail slide-out */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onUpdate={handleJobUpdate}
          onNavigate={handleModalNavigate}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filteredJobs.length - 1}
          sessionCode={code}
        />
      )}
    </div>
  );
}

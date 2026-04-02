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
import { formatTimestamp, formatDate } from '@/lib/utils';
import { extractCity, expandCity } from '@/lib/city-filter';
import { ActionsMenu } from './ActionsMenu';
import Link from 'next/link';
import { UserMenu } from '@/components/auth/UserMenu';
import { ResumeUpload } from './ResumeUpload';
import { useSession } from 'next-auth/react';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay';
import { BulkActions } from './BulkActions';
import { useToast } from '@/components/ui/Toast';

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const lastTotalRef = useRef<number>(0);
  const staleCountRef = useRef<number>(0);
  const ghostNotifiedRef = useRef(false);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [newJobsBanner, setNewJobsBanner] = useState<number | null>(null);
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

  // Adaptive polling — slow down when nothing changes, show banner on new jobs
  useEffect(() => {
    if (stats) {
      if (stats.total === lastTotalRef.current) {
        staleCountRef.current++;
        if (staleCountRef.current >= 12) {
          setRefreshInterval(60000);
        }
      } else {
        // Show "new jobs found" banner when new jobs arrive after initial load
        if (lastTotalRef.current > 0 && stats.total > lastTotalRef.current) {
          const diff = stats.total - lastTotalRef.current;
          setNewJobsBanner(diff);
        }
        staleCountRef.current = 0;
        setRefreshInterval(10000);
      }
      lastTotalRef.current = stats.total;
    }
  }, [stats]);

  // Auto-dismiss new jobs banner after 8 seconds
  useEffect(() => {
    if (newJobsBanner === null) return;
    const timer = setTimeout(() => setNewJobsBanner(null), 8000);
    return () => clearTimeout(timer);
  }, [newJobsBanner]);

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

  const clearAllFilters = useCallback(() => {
    setSourceFilter(null);
    setStatusFilter(null);
    setRemoteFilter(false);
    setExperienceFilter(null);
    setJobTypeFilter(null);
    setSalaryMin('');
    setSalaryMax('');
    setFreshnessFilter(null);
    setHideGhosts(false);
    setCompanyFilter(null);
    setLocationFilter(null);
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

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

  // Detect distinct cities and provinces from job data
  const detectedCities = useMemo(() => {
    const REMOTE_RE = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bdistributed\b|\bglobal\b/i;
    const cityMap = new Map<string, number>();
    let remoteCount = 0;
    for (const job of primaryJobs) {
      const loc = job.location ?? '';
      if (REMOTE_RE.test(loc)) { remoteCount++; continue; }
      // Normalize separators before extracting — some locations use ";", " - ", "–"
      const normalized = loc.replace(/\s*[;–—]\s*/g, ', ').replace(/\s+-\s+/g, ', ');
      const city = extractCity(normalized);
      // Skip noisy entries: too long, contain numbers, country names, or "CA-" prefixed codes
      if (!city || city.length > 25 || city.length < 3 || /\d/.test(city) ||
          /\bcanada\b|\bunited\b|\bstates\b/i.test(city) ||
          /^(ca|us|uk)\b/i.test(city)) continue;
      const display = city.replace(/\b\w/g, (c) => c.toUpperCase());
      cityMap.set(display, (cityMap.get(display) || 0) + 1);
    }
    const cities = [...cityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
    return { cities, remoteCount };
  }, [primaryJobs]);

  // Filter and sort jobs client-side
  const filteredJobs = useMemo(() => {
    return primaryJobs
      .filter((job) => {
        if (!remoteFilter) return true;
        return /remote|work from home|wfh|anywhere/i.test(job.location ?? '');
      })
      .filter((job) => {
        if (!experienceFilter) return true;
        const level = job.experience_level?.toLowerCase() ?? '';
        if (!level) return false;
        const aliases: Record<string, string[]> = {
          entry: ['entry', 'entry level', 'entry-level', 'junior', 'junior/entry', 'associate', 'new grad'],
          intern: ['intern', 'internship', 'co-op', 'coop'],
          mid: ['mid', 'mid-level', 'mid level', 'intermediate', 'regular', 'middle'],
          senior: ['senior', 'senior level', 'sr', 'sr.', 'experienced'],
          lead: ['lead', 'staff', 'lead/staff', 'team lead'],
          principal: ['principal', 'distinguished', 'fellow', 'architect'],
        };
        const key = experienceFilter.toLowerCase();
        const matches = aliases[key] ?? [key];
        return matches.some((m) => level === m || level.includes(m));
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
          return /remote|work from home|wfh|anywhere|worldwide|distributed|global/i.test(loc);
        }
        if (locationFilter.startsWith('city:')) {
          const city = locationFilter.slice(5); // individual city match
          return loc.includes(city);
        }
        if (locationFilter.startsWith('near:')) {
          const city = locationFilter.slice(5);
          // Use metro alias expansion (e.g. "toronto" includes markham, mississauga, etc.)
          return expandCity(city).some((c) => loc.includes(c));
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

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === paginatedJobs.length) return new Set();
      return new Set(paginatedJobs.map((j) => j.id));
    });
  }, [paginatedJobs]);

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

  const toast = useToast();

  // One-time ghost notification on initial load
  useEffect(() => {
    if (ghostNotifiedRef.current || !stats || hideGhosts || stats.ghost_count <= 0) return;
    ghostNotifiedRef.current = true;
    toast({
      message: `${stats.ghost_count} job listing${stats.ghost_count !== 1 ? 's' : ''} may have expired`,
      type: 'info',
      duration: 6000,
    });
  }, [stats, hideGhosts, toast]);

  const handleToggleSave = useCallback(async (jobId: number) => {
    const job = filteredJobs.find((j) => j.id === jobId);
    if (!job) return;
    const newStatus = job.status === 'saved' ? 'new' : 'saved';
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Session-Code': code },
      body: JSON.stringify({ status: newStatus }),
    });
    void mutateJobs();
    toast({
      message: newStatus === 'saved' ? 'Saved to Tracker' : 'Removed from Tracker',
      type: 'success',
      duration: 2500,
      ...(newStatus === 'saved' ? { action: { label: 'View', href: '/saved' } } : {}),
    });
  }, [filteredJobs, code, mutateJobs, toast]);

  const { focusedJobId, showShortcuts, setShowShortcuts } = useKeyboardNav({
    jobs: paginatedJobs,
    selectedJobId: selectedJobId,
    isModalOpen: selectedJob !== null,
    onSelectJob: () => {},
    onOpenModal: handleJobClick,
    onCloseModal: () => setSelectedJobId(null),
    onToggleSave: handleToggleSave,
  });

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
              {(stats?.by_status?.saved ?? 0) > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-500 px-1.5 text-[10px] font-bold text-white tabular-nums">
                  {stats!.by_status.saved}
                </span>
              )}
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
        {/* Search context — what the user is looking for */}
        <div className="mb-5">
          {session ? (
            <div className="animate-hero-in flex items-start gap-3 sm:gap-4">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <div className="min-w-0 pt-0.5">
                <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-primary-950 tracking-tight leading-tight">
                  {session.keywords && session.keywords.length > 0
                    ? session.keywords.join(', ')
                    : 'Job Search'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-500">
                  {(session.locations ?? (session.location ? [session.location] : [])).map((loc) => (
                    <span key={loc} className="inline-flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {loc}
                    </span>
                  ))}
                  {session.remote && (
                    <span className="inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-600">
                      Remote
                    </span>
                  )}
                  {stats && (
                    <>
                      <span className="hidden sm:inline text-slate-300">&middot;</span>
                      <span>{stats.total} jobs across {Object.keys(stats.by_source).length} sources</span>
                    </>
                  )}
                  {stats?.last_updated && (
                    <>
                      <span className="hidden sm:inline text-slate-300">&middot;</span>
                      <span className="text-slate-400">Updated {formatDate(stats.last_updated)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-2xl bg-slate-200" />
              <div className="space-y-2.5 pt-1">
                <div className="h-7 w-48 rounded-lg bg-slate-200" />
                <div className="h-4 w-64 rounded-md bg-slate-100" />
              </div>
            </div>
          )}
        </div>

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

        {/* New jobs found banner */}
        {newJobsBanner !== null && (
          <div className="mt-4" style={{ animation: 'slide-in-up 0.3s ease-out' }}>
            <div className="flex items-center justify-between rounded-xl bg-primary-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold">
                  +{newJobsBanner}
                </span>
                <span>{newJobsBanner} new job{newJobsBanner !== 1 ? 's' : ''} found</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-xs text-white/70 hover:text-white transition-colors underline underline-offset-2"
                >
                  Scroll to top
                </button>
                <button
                  onClick={() => setNewJobsBanner(null)}
                  className="text-white/50 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
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
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex justify-end sm:hidden">
                <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} />
              </div>
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
                sessionLocations={session?.locations ?? (session?.location ? [session.location] : null)}
                detectedCities={detectedCities}
                includeRemote={session?.include_remote !== false}
                onLocationChange={(v) => { setLocationFilter(v); resetPage(); }}
                stats={stats ?? null}
              />
            </div>

            {/* Results count + search + view toggle */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
              <div className="hidden sm:block">
                <SearchBar value={searchQuery} onChange={(v) => { setSearchQuery(v); resetPage(); }} />
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
                onClearFilters={clearAllFilters}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
            ) : paginatedJobs.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 animate-fade-in">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                    <path d="M8 11h6" />
                  </svg>
                </div>
                <p className="mt-4 font-display text-lg font-bold text-slate-700">No jobs match your filters</p>
                <p className="mt-1 text-sm text-slate-500">Try removing some filters or broadening your search terms</p>
                <button onClick={clearAllFilters} className="mt-4 rounded-xl bg-primary-950 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-900 hover:-translate-y-0.5">
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3">
                {paginatedJobs.map((job, idx) => (
                  <LazyJobCard key={job.id} job={job} onUpdate={handleJobUpdate} onJobClick={handleJobClick} sessionCode={code} isFocused={job.id === focusedJobId} isSelected={selectedIds.has(job.id)} onToggleSelect={toggleSelect} animationIndex={idx} />
                ))}
              </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => setShowShortcuts(true)}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                title="Keyboard shortcuts (?)"
              >
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono font-semibold">?</kbd>
                <span>Shortcuts</span>
              </button>
            </div>

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

      {/* Bulk actions bar */}
      <BulkActions
        selectedIds={selectedIds}
        sessionCode={code}
        onComplete={handleJobUpdate}
        onClear={clearSelection}
      />

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

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
import { formatTimestamp, formatDate, fetcher } from '@/lib/utils';
import { extractCity, expandCity } from '@/lib/city-filter';
import { expandWithSynonyms } from '@/lib/synonyms';
import { ActionsMenu } from './ActionsMenu';
import Link from 'next/link';
import { ResumeUpload } from './ResumeUpload';
import { BackfillButton } from './BackfillButton';
import { useSession } from 'next-auth/react';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay';
import { BulkActions } from './BulkActions';
import { useToast } from '@/components/ui/Toast';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { Search, BarChart3, MapPin, List, LayoutGrid, X } from 'lucide-react';

interface DashboardClientProps {
  code: string;
  expiresAt: string;
}

export function DashboardClient({ code, expiresAt }: DashboardClientProps) {
  const {
    sourceFilter,
    setSourceFilter,
    statusFilter,
    setStatusFilter,
    remoteFilter,
    setRemoteFilter,
    experienceFilter,
    setExperienceFilter,
    jobTypeFilter,
    setJobTypeFilter,
    salaryMin,
    setSalaryMin,
    salaryMax,
    setSalaryMax,
    freshnessFilter,
    setFreshnessFilter,
    hideGhosts,
    setHideGhosts,
    companyFilter,
    setCompanyFilter,
    locationFilter,
    setLocationFilter,
    searchQuery,
    setSearchQuery,
    clearAll: clearUrlFilters,
  } = useUrlFilters();
  // Start with a stable SSR-safe default, then hydrate from localStorage/viewport
  // in useEffect below. Using `typeof window` in the initializer causes hydration
  // mismatches because server renders 'table' while client may render 'cards'.
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  useEffect(() => {
    const stored = localStorage.getItem('jobhunter_view_mode') as 'table' | 'cards' | null;
    if (stored === 'table' || stored === 'cards') {
      setViewMode(stored);
    } else if (window.innerWidth < 640) {
      setViewMode('cards');
    }
  }, []);
  const [sortField, setSortField] = useState<keyof Job>('relevance_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const { data: stats } = useSWR<JobStats>(`/api/jobs/stats?session=${code}`, fetcher, {
    refreshInterval,
    revalidateOnFocus: true,
  });

  // Fetch session preferences (for auto-scraping source list)
  const { data: session } = useSWR<Session>(`/api/session/${code}`, fetcher, {
    revalidateOnFocus: false,
  });

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
    [sortField],
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
    clearUrlFilters();
    setCurrentPage(1);
  }, [clearUrlFilters]);

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
    const REMOTE_RE =
      /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bworldwide\b|\bdistributed\b|\bglobal\b/i;
    const cityMap = new Map<string, number>();
    let remoteCount = 0;
    for (const job of primaryJobs) {
      const loc = job.location ?? '';
      if (REMOTE_RE.test(loc)) {
        remoteCount++;
        continue;
      }
      // Normalize separators before extracting — some locations use ";", " - ", "–"
      const normalized = loc.replace(/\s*[;–—]\s*/g, ', ').replace(/\s+-\s+/g, ', ');
      const city = extractCity(normalized);
      // Skip noisy entries: too long, contain numbers, country names, or "CA-" prefixed codes
      if (
        !city ||
        city.length > 25 ||
        city.length < 3 ||
        /\d/.test(city) ||
        /\bcanada\b|\bunited\b|\bstates\b/i.test(city) ||
        /^(ca|us|uk)\b/i.test(city)
      )
        continue;
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
          entry: [
            'entry',
            'entry level',
            'entry-level',
            'junior',
            'junior/entry',
            'associate',
            'new grad',
          ],
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
        // Split on " OR " (case-insensitive) for multi-term search
        const terms = searchQuery
          .split(/\s+OR\s+/i)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        // Expand each term with synonyms
        const expanded = terms.flatMap(expandWithSynonyms);
        const fields = [job.title, job.company, job.location, job.salary, job.description].map(
          (f) => (f ?? '').toLowerCase(),
        );
        return expanded.some((term) => fields.some((field) => field.includes(term)));
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [
    primaryJobs,
    remoteFilter,
    experienceFilter,
    jobTypeFilter,
    salaryMin,
    salaryMax,
    freshnessFilter,
    hideGhosts,
    companyFilter,
    locationFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

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
      (
        document as unknown as { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(() => {
        setSelectedJobId(jobId);
      });
    } else {
      setSelectedJobId(jobId);
    }
  }, []);

  const handleModalNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (selectedIndex === -1) return;
      const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
      if (newIndex >= 0 && newIndex < filteredJobs.length) {
        setSelectedJobId(filteredJobs[newIndex].id);
        // If navigating beyond current page, update page
        const newPage = Math.floor(newIndex / pageSize) + 1;
        if (newPage !== safePage) setCurrentPage(newPage);
      }
    },
    [selectedIndex, filteredJobs, pageSize, safePage],
  );

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

  const handleToggleSave = useCallback(
    async (jobId: number) => {
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
    },
    [filteredJobs, code, mutateJobs, toast],
  );

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
      <SiteHeader
        left={
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 sm:gap-2 sm:px-3">
            <span className="text-primary-800 font-mono text-xs font-semibold sm:text-sm">
              {code}
            </span>
            <CopyButton text={code} />
          </div>
        }
        right={
          <>
            <Link
              href="/saved"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
            >
              <BarChart3 size={14} />
              Tracker
              {(stats?.by_status?.saved ?? 0) > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-500 px-1.5 text-[10px] font-bold text-white tabular-nums">
                  {stats!.by_status.saved}
                </span>
              )}
            </Link>
            <div className="hidden text-right lg:block">
              <p className="text-xs text-slate-400">Expires {formatTimestamp(expiresAt)}</p>
            </div>
            {/* Desktop: show individual buttons */}
            <div className="hidden items-center gap-2 sm:flex">
              <RescanButton
                code={code}
                onRescanStart={handleRescanStart}
                onComplete={handleJobUpdate}
              />
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
          </>
        }
      />

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Search context — what the user is looking for */}
        <div className="mb-5">
          {session ? (
            <div className="animate-hero-in flex items-start gap-3 sm:gap-4">
              <div className="from-primary-500 to-primary-700 shadow-primary-500/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg sm:h-12 sm:w-12">
                <Search size={20} className="text-white" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h1 className="font-display text-primary-950 text-xl leading-tight font-bold tracking-tight sm:text-2xl lg:text-3xl">
                  {session.keywords && session.keywords.length > 0
                    ? session.keywords.join(', ')
                    : 'Job Search'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-500">
                  {(session.locations ?? (session.location ? [session.location] : [])).map(
                    (loc) => (
                      <span key={loc} className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        {loc}
                      </span>
                    ),
                  )}
                  {session.remote && (
                    <span className="bg-accent-100 text-accent-600 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                      Remote
                    </span>
                  )}
                  {stats && (
                    <>
                      <span className="hidden text-slate-300 sm:inline">&middot;</span>
                      <span>
                        {stats.total} jobs across {Object.keys(stats.by_source).length} sources
                      </span>
                    </>
                  )}
                  {stats?.last_updated && (
                    <>
                      <span className="hidden text-slate-300 sm:inline">&middot;</span>
                      <span className="text-slate-400">
                        Updated {formatDate(stats.last_updated)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex animate-pulse items-start gap-4">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        )}

        {/* New jobs found banner */}
        {newJobsBanner !== null && (
          <div className="mt-4" style={{ animation: 'slide-in-up 0.3s ease-out' }}>
            <div className="bg-primary-950 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg">
              <div className="flex items-center gap-2">
                <span className="bg-accent-500 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                  +{newJobsBanner}
                </span>
                <span>
                  {newJobsBanner} new job{newJobsBanner !== 1 ? 's' : ''} found
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-xs text-white/70 underline underline-offset-2 transition-colors hover:text-white"
                >
                  Scroll to top
                </button>
                <button
                  onClick={() => setNewJobsBanner(null)}
                  className="text-white/50 transition-colors hover:text-white"
                  aria-label="Dismiss"
                >
                  <X size={16} />
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

        {/* Backfill scores for older unscored jobs */}
        {hasJobs && (session?.resume_skills || authSession?.user) && (
          <BackfillButton sessionCode={code} onComplete={handleJobUpdate} />
        )}

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
                <SearchBar
                  value={searchQuery}
                  onChange={(v) => {
                    setSearchQuery(v);
                    resetPage();
                  }}
                />
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
                onSourceChange={(v) => {
                  setSourceFilter(v);
                  resetPage();
                }}
                onStatusChange={(v) => {
                  setStatusFilter(v);
                  resetPage();
                }}
                onRemoteChange={(v) => {
                  setRemoteFilter(v);
                  resetPage();
                }}
                onExperienceChange={(v) => {
                  setExperienceFilter(v);
                  resetPage();
                }}
                onJobTypeChange={(v) => {
                  setJobTypeFilter(v);
                  resetPage();
                }}
                onSalaryMinChange={(v) => {
                  setSalaryMin(v);
                  resetPage();
                }}
                onSalaryMaxChange={(v) => {
                  setSalaryMax(v);
                  resetPage();
                }}
                onFreshnessChange={(v) => {
                  setFreshnessFilter(v);
                  resetPage();
                }}
                onHideGhostsChange={(v) => {
                  setHideGhosts(v);
                  resetPage();
                }}
                onCompanyChange={(v) => {
                  setCompanyFilter(v);
                  resetPage();
                }}
                locationFilter={locationFilter}
                sessionLocations={
                  session?.locations ?? (session?.location ? [session.location] : null)
                }
                detectedCities={detectedCities}
                includeRemote={session?.include_remote !== false}
                onLocationChange={(v) => {
                  setLocationFilter(v);
                  resetPage();
                }}
                stats={stats ?? null}
              />
            </div>

            {/* Results count + search + view toggle */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-500" aria-live="polite" aria-atomic="true">
                Showing <span className="text-primary-900 font-bold">{filteredJobs.length}</span> of{' '}
                <span className="font-semibold">{primaryJobs.length}</span> jobs
                {filteredJobs.length !== primaryJobs.length && (
                  <span className="bg-primary-50 text-primary-600 ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    filtered
                  </span>
                )}
                {stats && stats.ghost_count > 0 && !hideGhosts && (
                  <span className="text-error-500 ml-2">{stats.ghost_count} possibly expired</span>
                )}
              </div>
              <div className="hidden sm:block">
                <SearchBar
                  value={searchQuery}
                  onChange={(v) => {
                    setSearchQuery(v);
                    resetPage();
                  }}
                />
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  onClick={() => {
                    setViewMode('table');
                    localStorage.setItem('jobhunter_view_mode', 'table');
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Table view"
                  aria-label="Switch to table view"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => {
                    setViewMode('cards');
                    localStorage.setItem('jobhunter_view_mode', 'cards');
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card view"
                  aria-label="Switch to card view"
                >
                  <LayoutGrid size={14} />
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
              <div className="animate-fade-in mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Search size={32} className="text-slate-400" />
                </div>
                <p className="font-display mt-4 text-lg font-bold text-slate-700">
                  No jobs match your filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try removing some filters or broadening your search terms
                </p>
                <button
                  onClick={clearAllFilters}
                  className="bg-primary-950 hover:bg-primary-900 mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 min-[500px]:grid-cols-2 lg:grid-cols-3">
                {paginatedJobs.map((job, idx) => (
                  <LazyJobCard
                    key={job.id}
                    job={job}
                    onUpdate={handleJobUpdate}
                    onJobClick={handleJobClick}
                    sessionCode={code}
                    isFocused={job.id === focusedJobId}
                    isSelected={selectedIds.has(job.id)}
                    onToggleSelect={toggleSelect}
                    animationIndex={idx}
                  />
                ))}
              </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => setShowShortcuts(true)}
                className="hidden items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600 sm:inline-flex"
                title="Keyboard shortcuts (?)"
              >
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  ?
                </kbd>
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
      {showShortcuts && <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

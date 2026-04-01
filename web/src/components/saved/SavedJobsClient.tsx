'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import type { Job } from '@/lib/types';
import { UserMenu } from '@/components/auth/UserMenu';
import { LazyJobCard } from '@/components/dashboard/LazyJobCard';
import { JobTable } from '@/components/dashboard/JobTable';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { JobDetailModal } from '@/components/dashboard/JobDetailModal';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SavedJobsClient() {
  const { data, mutate } = useSWR<{ jobs: Job[] }>('/api/user/saved-jobs', fetcher, {
    revalidateOnFocus: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return (localStorage.getItem('jobhunter_view_mode') as 'table' | 'cards')
      ?? (window.innerWidth < 640 ? 'cards' : 'cards');
  });
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<keyof Job>('scraped_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const jobs = data?.jobs ?? [];

  const sources = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      counts[job.source] = (counts[job.source] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        if (sourceFilter && job.source !== sourceFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            job.title.toLowerCase().includes(q) ||
            (job.company?.toLowerCase().includes(q) ?? false) ||
            (job.location?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [jobs, sourceFilter, searchQuery, sortField, sortDirection]);

  const handleJobUpdate = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleJobClick = useCallback((jobId: number) => {
    setSelectedJobId(jobId);
  }, []);

  const handleSort = useCallback((field: keyof Job) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const selectedJob = useMemo(
    () => filteredJobs.find((j) => j.id === selectedJobId) ?? null,
    [filteredJobs, selectedJobId],
  );
  const selectedIndex = selectedJob ? filteredJobs.indexOf(selectedJob) : -1;

  const handleModalNavigate = useCallback((direction: 'prev' | 'next') => {
    if (selectedIndex === -1) return;
    const newIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < filteredJobs.length) {
      setSelectedJobId(filteredJobs[newIndex].id);
    }
  }, [selectedIndex, filteredJobs]);

  const isLoading = data === undefined;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-950">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <span className="hidden sm:inline font-display text-lg font-bold text-primary-950">JobHunter</span>
            </Link>
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-display text-sm font-bold text-amber-800">Saved Jobs</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="hidden sm:inline">My Sessions</span>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero stats */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-primary-950 sm:text-3xl">
              Saved Jobs
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {jobs.length === 0 ? 'Bookmark jobs from any session to see them here.' : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} saved across your sessions`}
            </p>
          </div>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-16 text-center animate-fade-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="mt-6 font-display text-xl font-bold text-slate-800">No saved jobs yet</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              Click the bookmark icon on any job in your dashboard to save it here for quick access.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-950 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-950/20 transition-all hover:bg-primary-900 hover:-translate-y-0.5"
            >
              Browse Sessions
            </Link>
          </div>
        ) : (
          <>
            {/* Source filter pills + view toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSourceFilter(null)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    !sourceFilter
                      ? 'bg-primary-950 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  All ({jobs.length})
                </button>
                {sources.map(([source, count]) => (
                  <button
                    key={source}
                    onClick={() => setSourceFilter(sourceFilter === source ? null : source)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all ${
                      sourceFilter === source
                        ? 'bg-primary-950 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {source} ({count})
                  </button>
                ))}
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  onClick={() => { setViewMode('table'); localStorage.setItem('jobhunter_view_mode', 'table'); }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Table view"
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
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 mb-4">
              Showing <span className="font-semibold text-primary-800">{filteredJobs.length}</span> of{' '}
              <span className="font-semibold">{jobs.length}</span> saved jobs
            </p>

            {/* Jobs list */}
            {viewMode === 'table' ? (
              <JobTable
                jobs={filteredJobs}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onJobUpdate={handleJobUpdate}
                onJobClick={handleJobClick}
                sessionCode=""
              />
            ) : (
              <div className="grid gap-3 grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3">
                {filteredJobs.map((job) => (
                  <LazyJobCard
                    key={job.id}
                    job={job}
                    onUpdate={handleJobUpdate}
                    onJobClick={handleJobClick}
                    sessionCode={job.session_code}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Job detail modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onUpdate={handleJobUpdate}
          onNavigate={handleModalNavigate}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filteredJobs.length - 1}
          sessionCode={selectedJob.session_code}
        />
      )}
    </div>
  );
}

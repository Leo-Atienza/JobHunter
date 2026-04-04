'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { BarChart3, Home, List, LayoutGrid, Bookmark, Search, Download } from 'lucide-react';
import type { Job, JobStatus } from '@/lib/types';
import { LazyJobCard } from '@/components/dashboard/LazyJobCard';
import { JobTable } from '@/components/dashboard/JobTable';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { JobDetailModal } from '@/components/dashboard/JobDetailModal';
import { PipelineView } from './PipelineView';
import { SavedExportButton } from './SavedExportButton';
import { SiteHeader } from '@/components/layout/SiteHeader';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SavedJobsClient() {
  const { data, mutate } = useSWR<{ jobs: Job[] }>('/api/user/saved-jobs', fetcher, {
    revalidateOnFocus: true,
  });

  const [trackerView, setTrackerView] = useState<'pipeline' | 'list'>(() => {
    if (typeof window === 'undefined') return 'pipeline';
    return (localStorage.getItem('jobhunter_tracker_view') as 'pipeline' | 'list') ?? 'pipeline';
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

  const handleStatusChange = useCallback(async (jobId: number, sessionCode: string, newStatus: JobStatus) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Code': sessionCode },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        mutate();
      }
    } catch {
      // Will reflect actual state on next revalidation
    }
  }, [mutate]);

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
      <SiteHeader
        left={
          <div className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5">
            <BarChart3 size={14} className="text-primary-600" />
            <span className="font-display text-sm font-bold text-primary-800">Tracker</span>
          </div>
        }
        right={
          <>
            <SavedExportButton disabled={jobs.length === 0} />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300"
            >
              <Home size={14} />
              <span className="hidden sm:inline">My Sessions</span>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero + view toggle */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-primary-950 sm:text-3xl">
                Application Tracker
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {jobs.length === 0
                  ? 'Bookmark jobs from any session to start tracking applications.'
                  : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} tracked across your sessions`}
              </p>
            </div>
            {jobs.length > 0 && trackerView === 'list' && (
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            )}
          </div>

          {/* Pipeline / List toggle */}
          {jobs.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg bg-slate-100/60 p-0.5">
                <button
                  onClick={() => { setTrackerView('pipeline'); localStorage.setItem('jobhunter_tracker_view', 'pipeline'); }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    trackerView === 'pipeline'
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BarChart3 size={12} />
                  Pipeline
                </button>
                <button
                  onClick={() => { setTrackerView('list'); localStorage.setItem('jobhunter_tracker_view', 'list'); }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    trackerView === 'list'
                      ? 'bg-white text-primary-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <List size={12} />
                  List
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-16 text-center animate-fade-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-accent-100">
              <BarChart3 size={36} className="text-primary-500" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-extrabold text-primary-950">No tracked jobs yet</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Save jobs from any search session to build your application pipeline. Track status from saved through interview to offer.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-950 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-950/20 transition-all hover:bg-primary-900 hover:-translate-y-0.5"
            >
              <Search size={16} />
              Search for Jobs
            </Link>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Bookmark size={14} />
                Bookmark jobs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 size={14} />
                Track status
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Download size={14} />
                Export CSV
              </span>
            </div>
          </div>
        ) : trackerView === 'pipeline' ? (
          <PipelineView
            jobs={jobs}
            onJobClick={handleJobClick}
            onStatusChange={handleStatusChange}
          />
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
                  <List size={14} />
                </button>
                <button
                  onClick={() => { setViewMode('cards'); localStorage.setItem('jobhunter_view_mode', 'cards'); }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-primary-950 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Card view"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 mb-4">
              Showing <span className="font-semibold text-primary-800">{filteredJobs.length}</span> of{' '}
              <span className="font-semibold">{jobs.length}</span> tracked jobs
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

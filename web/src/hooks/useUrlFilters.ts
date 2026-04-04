'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';

export interface UrlFilters {
  sourceFilter: string | null;
  statusFilter: string | null;
  remoteFilter: boolean;
  experienceFilter: string | null;
  jobTypeFilter: string | null;
  salaryMin: string;
  salaryMax: string;
  freshnessFilter: string | null;
  hideGhosts: boolean;
  companyFilter: string | null;
  locationFilter: string | null;
  searchQuery: string;
}

// Short URL param names for shareability
const PARAM_MAP = {
  sourceFilter: 'src',
  statusFilter: 'st',
  remoteFilter: 'remote',
  experienceFilter: 'exp',
  jobTypeFilter: 'type',
  salaryMin: 'smin',
  salaryMax: 'smax',
  freshnessFilter: 'fresh',
  hideGhosts: 'ghost',
  companyFilter: 'co',
  locationFilter: 'loc',
  searchQuery: 'q',
} as const;

function readFilters(params: URLSearchParams): UrlFilters {
  return {
    sourceFilter: params.get(PARAM_MAP.sourceFilter),
    statusFilter: params.get(PARAM_MAP.statusFilter),
    remoteFilter: params.get(PARAM_MAP.remoteFilter) === '1',
    experienceFilter: params.get(PARAM_MAP.experienceFilter),
    jobTypeFilter: params.get(PARAM_MAP.jobTypeFilter),
    salaryMin: params.get(PARAM_MAP.salaryMin) ?? '',
    salaryMax: params.get(PARAM_MAP.salaryMax) ?? '',
    freshnessFilter: params.get(PARAM_MAP.freshnessFilter),
    hideGhosts: params.get(PARAM_MAP.hideGhosts) === '1',
    companyFilter: params.get(PARAM_MAP.companyFilter),
    locationFilter: params.get(PARAM_MAP.locationFilter),
    searchQuery: params.get(PARAM_MAP.searchQuery) ?? '',
  };
}

function buildSearchString(filters: Partial<UrlFilters>): string {
  const params = new URLSearchParams();

  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value);
  };

  set(PARAM_MAP.sourceFilter, filters.sourceFilter);
  set(PARAM_MAP.statusFilter, filters.statusFilter);
  if (filters.remoteFilter) params.set(PARAM_MAP.remoteFilter, '1');
  set(PARAM_MAP.experienceFilter, filters.experienceFilter);
  set(PARAM_MAP.jobTypeFilter, filters.jobTypeFilter);
  set(PARAM_MAP.salaryMin, filters.salaryMin);
  set(PARAM_MAP.salaryMax, filters.salaryMax);
  set(PARAM_MAP.freshnessFilter, filters.freshnessFilter);
  if (filters.hideGhosts) params.set(PARAM_MAP.hideGhosts, '1');
  set(PARAM_MAP.companyFilter, filters.companyFilter);
  set(PARAM_MAP.locationFilter, filters.locationFilter);
  set(PARAM_MAP.searchQuery, filters.searchQuery);

  const str = params.toString();
  return str ? `?${str}` : '';
}

export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const filters = readFilters(searchParams);

  const updateFilter = useCallback(
    <K extends keyof UrlFilters>(key: K, value: UrlFilters[K]) => {
      const current = readFilters(new URLSearchParams(window.location.search));
      const updated = { ...current, [key]: value };
      startTransition(() => {
        router.replace(pathname + buildSearchString(updated), { scroll: false });
      });
    },
    [router, pathname, startTransition],
  );

  const setSourceFilter = useCallback((v: string | null) => updateFilter('sourceFilter', v), [updateFilter]);
  const setStatusFilter = useCallback((v: string | null) => updateFilter('statusFilter', v), [updateFilter]);
  const setRemoteFilter = useCallback((v: boolean) => updateFilter('remoteFilter', v), [updateFilter]);
  const setExperienceFilter = useCallback((v: string | null) => updateFilter('experienceFilter', v), [updateFilter]);
  const setJobTypeFilter = useCallback((v: string | null) => updateFilter('jobTypeFilter', v), [updateFilter]);
  const setSalaryMin = useCallback((v: string) => updateFilter('salaryMin', v), [updateFilter]);
  const setSalaryMax = useCallback((v: string) => updateFilter('salaryMax', v), [updateFilter]);
  const setFreshnessFilter = useCallback((v: string | null) => updateFilter('freshnessFilter', v), [updateFilter]);
  const setHideGhosts = useCallback((v: boolean) => updateFilter('hideGhosts', v), [updateFilter]);
  const setCompanyFilter = useCallback((v: string | null) => updateFilter('companyFilter', v), [updateFilter]);
  const setLocationFilter = useCallback((v: string | null) => updateFilter('locationFilter', v), [updateFilter]);
  const setSearchQuery = useCallback((v: string) => updateFilter('searchQuery', v), [updateFilter]);

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [router, pathname, startTransition]);

  return {
    ...filters,
    setSourceFilter,
    setStatusFilter,
    setRemoteFilter,
    setExperienceFilter,
    setJobTypeFilter,
    setSalaryMin,
    setSalaryMax,
    setFreshnessFilter,
    setHideGhosts,
    setCompanyFilter,
    setLocationFilter,
    setSearchQuery,
    clearAll,
  };
}

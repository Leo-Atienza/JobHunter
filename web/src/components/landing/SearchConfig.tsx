'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { JOB_SOURCES, REMOTE_ONLY_SOURCES } from '@/lib/types';
import type { CreateSessionRequest, CreateSessionResponse } from '@/lib/types';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { MultiCityInput } from '@/components/ui/MultiCityInput';
import { JOB_TITLES, COMPANIES, LOCATIONS } from '@/lib/autocomplete-data';
import { SOURCE_LABELS_EXTENDED as SOURCE_LABELS } from '@/lib/utils';
import { inferCountryFromLocation, getCountryLabel } from '@/lib/country-filter';
import { extractCity } from '@/lib/city-filter';
import { FirecrawlCreditsBadge } from '@/components/dashboard/FirecrawlCreditsBadge';
import { ApifyCreditsBadge } from '@/components/dashboard/ApifyCreditsBadge';

const COUNTRY_FLAGS: Record<string, string> = {
  ca: '\u{1F1E8}\u{1F1E6}',
  us: '\u{1F1FA}\u{1F1F8}',
  uk: '\u{1F1EC}\u{1F1E7}',
  au: '\u{1F1E6}\u{1F1FA}',
  de: '\u{1F1E9}\u{1F1EA}',
  fr: '\u{1F1EB}\u{1F1F7}',
  in: '\u{1F1EE}\u{1F1F3}',
};

interface SearchConfigProps {
  onSessionCreated: (code: string, expiresAt: string) => void;
}

type ResumeState = 'idle' | 'extracting' | 'done' | 'error';

export function SearchConfig({ onSessionCreated }: SearchConfigProps) {
  const [keywords, setKeywords] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([...JOB_SOURCES]);
  const [companies, setCompanies] = useState('');
  const [includeRemote, setIncludeRemote] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume upload state
  const [resumeState, setResumeState] = useState<ResumeState>('idle');
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeDragOver, setResumeDragOver] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect country and city from first location
  const firstLocation = locations[0] ?? '';
  const inferredCountry = inferCountryFromLocation(firstLocation);
  const countryLabel = inferredCountry ? getCountryLabel(inferredCountry) : null;
  const inferredCity = extractCity(firstLocation);

  // Career page discovery state
  const [discoveredCareers, setDiscoveredCareers] = useState<Record<string, { url: string | null; loading: boolean; source: string | null }>>({});

  const discoverCareers = useCallback(async (companyName: string) => {
    const key = companyName.toLowerCase().trim();
    if (!key || key.length < 2) return;

    setDiscoveredCareers((prev) => ({ ...prev, [key]: { url: null, loading: true, source: null } }));
    try {
      const res = await fetch('/api/discover-careers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: companyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json() as { url: string | null; source: string | null };
        setDiscoveredCareers((prev) => ({ ...prev, [key]: { url: data.url, loading: false, source: data.source } }));
      } else {
        setDiscoveredCareers((prev) => ({ ...prev, [key]: { url: null, loading: false, source: null } }));
      }
    } catch {
      setDiscoveredCareers((prev) => ({ ...prev, [key]: { url: null, loading: false, source: null } }));
    }
  }, []);

  // Debounced career discovery when companies change
  useEffect(() => {
    const parsed = companies.split(',').map((c) => c.trim()).filter((c) => c.length >= 2);
    const timer = setTimeout(() => {
      for (const company of parsed) {
        const key = company.toLowerCase();
        if (!discoveredCareers[key]) {
          discoverCareers(company);
        }
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [companies, discoveredCareers, discoverCareers]);

  function toggleSource(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  function toggleAll() {
    if (selectedSources.length === JOB_SOURCES.length) {
      setSelectedSources([]);
    } else {
      setSelectedSources([...JOB_SOURCES]);
    }
  }

  async function handleResumeFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResumeState('error');
      setResumeError('Only PDF files are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeState('error');
      setResumeError('File too large (max 5MB)');
      return;
    }

    setResumeState('extracting');
    setResumeError(null);

    try {
      const { extractTextFromPdf } = await import('@/lib/pdf-extract');
      const text = await extractTextFromPdf(file);
      setResumeText(text);
      setResumeFileName(file.name);
      setResumeState('done');
    } catch (err) {
      setResumeState('error');
      setResumeError(err instanceof Error ? err.message : 'Failed to read PDF');
    }
  }

  function clearResume() {
    setResumeState('idle');
    setResumeText(null);
    setResumeFileName(null);
    setResumeError(null);
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.trim()) {
      setError('Please enter at least one keyword');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedCompanies = companies.split(',').map((c) => c.trim()).filter(Boolean);
      const body: CreateSessionRequest = {
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        locations: locations.length > 0 ? locations : undefined,
        sources: selectedSources.length < JOB_SOURCES.length ? selectedSources : undefined,
        include_remote: includeRemote,
        companies: parsedCompanies.length > 0 ? parsedCompanies : undefined,
        country: inferredCountry ?? undefined,
        resume_text: resumeText ?? undefined,
      };

      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to create session');
      }

      const data = (await res.json()) as CreateSessionResponse;

      // Save session to localStorage for recovery
      try {
        const stored = JSON.parse(localStorage.getItem('jobhunter_sessions') || '[]');
        stored.unshift({
          code: data.code,
          keywords: keywords.split(',').map((k: string) => k.trim()).filter(Boolean),
          created_at: new Date().toISOString(),
          expires_at: data.expires_at,
        });
        // Keep max 10 recent sessions
        localStorage.setItem('jobhunter_sessions', JSON.stringify(stored.slice(0, 10)));
      } catch {
        // localStorage unavailable — ignore
      }

      onSessionCreated(data.code, data.expires_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg text-left">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-primary-950/5 space-y-5">
        <div>
          <h3 className="font-display text-lg font-bold text-primary-950">
            Configure Your Search
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Set your preferences and search across multiple job boards instantly.
          </p>
        </div>

        {/* Keywords */}
        <AutocompleteInput
          id="keywords"
          value={keywords}
          onChange={setKeywords}
          suggestions={JOB_TITLES}
          placeholder="e.g. Software Engineer, Data Analyst"
          label="Job Keywords"
          required
          hint="Each comma-separated entry is searched as a separate role"
          multiValue
        />

        {/* Location — multi-city */}
        <div>
          <MultiCityInput
            cities={locations}
            onChange={setLocations}
            suggestions={LOCATIONS}
            placeholder="e.g. Toronto, Canada"
            label="Locations"
          />
          {inferredCountry && countryLabel && (
            <div className="mt-1.5 flex items-center gap-1.5 animate-fade-in">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-200">
                <span>{COUNTRY_FLAGS[inferredCountry] ?? ''}</span>
                Detected: {countryLabel}
              </span>
              <span className="text-[11px] text-slate-400">
                {locations.length > 1
                  ? `Searching ${locations.length} cities`
                  : inferredCity
                    ? `Jobs filtered to ${inferredCity.charAt(0).toUpperCase() + inferredCity.slice(1)}, ${countryLabel}`
                    : `Jobs will be filtered to ${countryLabel}`}
              </span>
            </div>
          )}
        </div>

        {/* Target Companies */}
        <div>
          <AutocompleteInput
            id="companies"
            value={companies}
            onChange={setCompanies}
            suggestions={COMPANIES}
            placeholder="e.g. Google, Shopify, Microsoft"
            label="Target Companies"
            hint="Leave empty to search all companies. Separate with commas."
            multiValue
          />
          {/* Career page discovery badges */}
          {Object.keys(discoveredCareers).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-fade-in">
              {Object.entries(discoveredCareers).map(([key, state]) => (
                <span key={key} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all">
                  {state.loading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary-400 border-t-transparent" />
                      <span className="text-slate-500 capitalize">{key}</span>
                    </>
                  ) : state.url ? (
                    <>
                      <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <a
                        href={state.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline capitalize"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {key} careers
                      </a>
                      <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span className="text-slate-400 capitalize">{key}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Resume Upload (optional) */}
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Upload Resume
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Optional
            </span>
          </label>

          {resumeState === 'idle' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setResumeDragOver(true); }}
              onDragLeave={() => setResumeDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setResumeDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleResumeFile(file);
              }}
              onClick={() => resumeInputRef.current?.click()}
              className={`mt-1.5 cursor-pointer rounded-lg border-2 border-dashed p-3 transition-colors ${
                resumeDragOver
                  ? 'border-primary-400 bg-primary-50/50'
                  : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    Drop your resume PDF for AI match scores
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Parsed in your browser — never uploaded as a file
                  </p>
                </div>
              </div>
            </div>
          )}

          {resumeState === 'extracting' && (
            <div className="mt-1.5 rounded-lg border border-primary-200 bg-primary-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                <p className="text-sm font-medium text-primary-700">Extracting resume text...</p>
              </div>
            </div>
          )}

          {resumeState === 'done' && (
            <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[260px]">
                    {resumeFileName}
                  </p>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Ready
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearResume}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {resumeState === 'error' && (
            <div className="mt-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <p className="text-xs text-red-600">{resumeError}</p>
                </div>
                <button
                  type="button"
                  onClick={clearResume}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          <input
            ref={resumeInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleResumeFile(file);
              if (resumeInputRef.current) resumeInputRef.current.value = '';
            }}
          />
        </div>

        {/* Include remote jobs toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={includeRemote}
            onClick={() => {
              const next = !includeRemote;
              setIncludeRemote(next);
              if (!next) {
                setSelectedSources((prev) => prev.filter((s) => !(REMOTE_ONLY_SOURCES as readonly string[]).includes(s)));
              } else {
                setSelectedSources((prev) => {
                  const toAdd = REMOTE_ONLY_SOURCES.filter((s) => !prev.includes(s));
                  return [...prev, ...toAdd];
                });
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
              includeRemote ? 'bg-accent-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                includeRemote ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-slate-700">Include remote jobs</span>
            {!includeRemote && (
              <p className="text-[11px] text-slate-400 animate-fade-in">Only local/hybrid jobs in your cities</p>
            )}
          </div>
        </label>

        {/* Sources */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Job Sources</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-800"
            >
              {selectedSources.length === JOB_SOURCES.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="relative mt-2">
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-100 p-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
              <div className="grid grid-cols-2 gap-2">
                {JOB_SOURCES.map((source) => {
                  const isRemoteOnly = (REMOTE_ONLY_SOURCES as readonly string[]).includes(source);
                  const isDisabled = isRemoteOnly && !includeRemote;
                  return (
                  <label
                    key={source}
                    title={isDisabled ? 'Enable "Include remote jobs" to use this source' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : selectedSources.includes(source)
                          ? 'border-primary-300 bg-primary-50 text-primary-800 cursor-pointer'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source)}
                      onChange={() => !isDisabled && toggleSource(source)}
                      disabled={isDisabled}
                      className="sr-only"
                    />
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isDisabled
                          ? 'border-slate-300 bg-slate-200'
                          : selectedSources.includes(source)
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-slate-300'
                      }`}
                    >
                      {selectedSources.includes(source) && !isDisabled && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {SOURCE_LABELS[source] ?? source}
                      {(['adzuna', 'jooble', 'jobbank', 'firecrawl'].includes(source)) && (
                        <span className="ml-1 text-xs text-slate-400" title={
                          source === 'adzuna' ? 'Requires free API key from developer.adzuna.com'
                            : source === 'jooble' ? 'Requires free API key from jooble.org/api/about'
                            : source === 'jobbank' ? 'Requires free Apify token from apify.com'
                            : 'Requires free API key from firecrawl.dev'
                        }>*</span>
                      )}
                    </span>
                  </label>
                  );
                })}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-lg bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">* Requires free API key</p>
          {selectedSources.includes('firecrawl') && (
            <div className="mt-2 flex items-center gap-2 animate-fade-in">
              <span className="text-xs text-slate-400">Firecrawl:</span>
              <FirecrawlCreditsBadge />
            </div>
          )}
          {selectedSources.includes('jobbank') && (
            <div className="mt-2 flex items-center gap-2 animate-fade-in">
              <span className="text-xs text-slate-400">Apify (JobBank):</span>
              <ApifyCreditsBadge />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm font-medium text-error-600 animate-fade-in">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-950 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-950/20 transition-all hover:bg-primary-900 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {resumeText ? 'Analyzing Resume & Creating Session...' : 'Generating Session...'}
            </span>
          ) : (
            'Search Jobs'
          )}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { JOB_SOURCES } from '@/lib/types';
import type { CreateSessionRequest, CreateSessionResponse } from '@/lib/types';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { JOB_TITLES, COMPANIES, LOCATIONS } from '@/lib/autocomplete-data';
import { SOURCE_LABELS_EXTENDED as SOURCE_LABELS } from '@/lib/utils';
import { inferCountryFromLocation, getCountryLabel } from '@/lib/country-filter';

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

export function SearchConfig({ onSessionCreated }: SearchConfigProps) {
  const [keywords, setKeywords] = useState('');
  const [dreamJob, setDreamJob] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([...JOB_SOURCES]);
  const [companies, setCompanies] = useState('');
  const [firecrawlUrls, setFirecrawlUrls] = useState('');
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect country from location input
  const inferredCountry = useMemo(() => inferCountryFromLocation(location), [location]);
  const countryLabel = useMemo(
    () => (inferredCountry ? getCountryLabel(inferredCountry) : null),
    [inferredCountry],
  );

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
      const parsedUrls = firecrawlUrls
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
        .slice(0, 10);
      const body: CreateSessionRequest = {
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        location: location.trim() || undefined,
        sources: selectedSources.length < JOB_SOURCES.length ? selectedSources : undefined,
        remote: remote || undefined,
        companies: parsedCompanies.length > 0 ? parsedCompanies : undefined,
        country: inferredCountry ?? undefined,
        firecrawl_urls: parsedUrls.length > 0 ? parsedUrls : undefined,
        dream_job: dreamJob.trim() || undefined,
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

        {/* Dream Job Description */}
        <div>
          <label htmlFor="dream-job" className="block text-sm font-semibold text-slate-700">
            Describe Your Dream Job
            <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-600">
              AI Powered
            </span>
          </label>
          <textarea
            id="dream-job"
            value={dreamJob}
            onChange={(e) => setDreamJob(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. I want a remote senior frontend role at a startup building developer tools, using React and TypeScript, with good work-life balance and competitive pay..."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none transition-colors"
          />
          <p className="mt-1 text-xs text-slate-400">
            AI will score every job against this description. More detail = better matches.
          </p>
        </div>

        {/* Location */}
        <div>
          <AutocompleteInput
            id="location"
            value={location}
            onChange={setLocation}
            suggestions={LOCATIONS}
            placeholder="e.g. Toronto, Canada"
            label="Location"
          />
          {inferredCountry && countryLabel && (
            <div className="mt-1.5 flex items-center gap-1.5 animate-fade-in">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-inset ring-accent-200">
                <span>{COUNTRY_FLAGS[inferredCountry] ?? ''}</span>
                Detected: {countryLabel}
              </span>
              <span className="text-[11px] text-slate-400">Jobs will be filtered to this country</span>
            </div>
          )}
        </div>

        {/* Target Companies */}
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

        {/* Career Page URLs (Firecrawl) */}
        <div>
          <label htmlFor="firecrawl-urls" className="block text-sm font-semibold text-slate-700">
            Career Page URLs
          </label>
          <textarea
            id="firecrawl-urls"
            value={firecrawlUrls}
            onChange={(e) => {
              setFirecrawlUrls(e.target.value);
              // Auto-select firecrawl source when URLs are entered
              const hasUrls = e.target.value.trim().length > 0;
              setSelectedSources((prev) =>
                hasUrls && !prev.includes('firecrawl')
                  ? [...prev, 'firecrawl']
                  : !hasUrls
                    ? prev.filter((s) => s !== 'firecrawl')
                    : prev
              );
            }}
            rows={3}
            placeholder={"https://stripe.com/jobs\nhttps://shopify.com/careers\nhttps://company.com/jobs"}
            aria-describedby="firecrawl-hint"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none transition-colors"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p id="firecrawl-hint" className="text-xs text-slate-400">
              Paste career page URLs (one per line, max 10). Scraped with Firecrawl AI.
            </p>
            <span
              className="text-xs font-medium tabular-nums text-slate-400 transition-colors"
              aria-live="polite"
            >
              {firecrawlUrls.split(/[\n,]/).map((u) => u.trim()).filter((u) => u.startsWith('http')).length}/10
            </span>
          </div>
        </div>

        {/* Remote toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={remote}
            onClick={() => setRemote(!remote)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
              remote ? 'bg-accent-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                remote ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-slate-700">Remote jobs only</span>
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            {JOB_SOURCES.map((source) => (
              <label
                key={source}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                  selectedSources.includes(source)
                    ? 'border-primary-300 bg-primary-50 text-primary-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source)}
                  onChange={() => toggleSource(source)}
                  className="sr-only"
                />
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    selectedSources.includes(source)
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-slate-300'
                  }`}
                >
                  {selectedSources.includes(source) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium">
                  {SOURCE_LABELS[source] ?? source}
                  {(source === 'adzuna' || source === 'jooble') && (
                    <span className="ml-1 text-xs text-slate-400" title={source === 'adzuna' ? 'Requires free API key from developer.adzuna.com' : 'Requires free API key from jooble.org/api/about'}>*</span>
                  )}
                  {source === 'firecrawl' && (
                    <span className="ml-1 text-xs text-slate-400" title="Scrapes any career page URL using AI — add URLs above to activate">**</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">* Requires free API key. ** Activates when Career Page URLs are provided above.</p>
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
              Generating Session...
            </span>
          ) : (
            'Search Jobs'
          )}
        </button>
      </div>
    </form>
  );
}

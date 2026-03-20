'use client';

import { useState } from 'react';
import { JOB_SOURCES } from '@/lib/types';
import type { CreateSessionRequest, CreateSessionResponse } from '@/lib/types';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { JOB_TITLES, COMPANIES, LOCATIONS } from '@/lib/autocomplete-data';

interface SearchConfigProps {
  onSessionCreated: (code: string, expiresAt: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  glassdoor: 'Glassdoor',
  jobbank: 'Job Bank (CA)',
  remotive: 'Remotive',
  adzuna: 'Adzuna',
  lever: 'Lever (Company Pages)',
  greenhouse: 'Greenhouse (Company Pages)',
  workday: 'Workday (Enterprise)',
};

export function SearchConfig({ onSessionCreated }: SearchConfigProps) {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([...JOB_SOURCES]);
  const [companies, setCompanies] = useState('');
  const [country, setCountry] = useState('');
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const body: CreateSessionRequest = {
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        location: location.trim() || undefined,
        sources: selectedSources.length < JOB_SOURCES.length ? selectedSources : undefined,
        remote: remote || undefined,
        companies: parsedCompanies.length > 0 ? parsedCompanies : undefined,
        country: country || undefined,
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
            Set your preferences, then run the generated command.
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

        {/* Location */}
        <AutocompleteInput
          id="location"
          value={location}
          onChange={setLocation}
          suggestions={LOCATIONS}
          placeholder="e.g. Toronto, Canada"
          label="Location"
        />

        {/* Country */}
        <div>
          <label htmlFor="country" className="block text-sm font-semibold text-slate-700">
            Country
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Any Country</option>
            <option value="ca">Canada</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="au">Australia</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="in">India</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">Strictly filter results to this country</p>
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
                  {source === 'adzuna' && (
                    <span className="ml-1 text-xs text-slate-400" title="Requires free API key from developer.adzuna.com">*</span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">* Adzuna requires free API keys from developer.adzuna.com</p>
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
            'Generate Session & Get Command'
          )}
        </button>
      </div>
    </form>
  );
}

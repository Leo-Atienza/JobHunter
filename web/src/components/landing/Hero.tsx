'use client';

import { useState, useEffect } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { SearchConfig } from './SearchConfig';

type FlowStep = 'initial' | 'configure' | 'ready';

interface SavedSession {
  code: string;
  keywords: string[];
  created_at: string;
  expires_at: string;
}

export function Hero() {
  const [step, setStep] = useState<FlowStep>('initial');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('jobhunter_sessions') || '[]') as SavedSession[];
      // Filter out expired sessions
      const now = new Date();
      const valid = stored.filter((s) => new Date(s.expires_at) > now);
      setRecentSessions(valid);
      // Clean up expired entries
      if (valid.length !== stored.length) {
        localStorage.setItem('jobhunter_sessions', JSON.stringify(valid));
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function clearHistory() {
    localStorage.removeItem('jobhunter_sessions');
    setRecentSessions([]);
  }

  function handleSessionCreated(code: string, expires: string) {
    setSessionCode(code);
    setExpiresAt(expires);
    setStep('ready');
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="absolute top-48 -left-32 h-72 w-72 rounded-full bg-accent-100/50 blur-3xl" />
        <div className="absolute right-1/4 top-1/3 h-4 w-4 rotate-45 bg-accent-400 opacity-20 animate-float" />
        <div className="absolute left-1/5 top-1/2 h-3 w-3 rounded-full bg-primary-400 opacity-20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute right-1/3 top-2/3 h-5 w-5 rotate-12 rounded bg-primary-300 opacity-15 animate-float" style={{ animationDelay: '4s' }} />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #1e1b4b 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-800">
          <span className="h-2 w-2 rounded-full bg-accent-500" />
          Open Source Job Aggregator
        </div>

        <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight text-primary-950 sm:text-6xl lg:text-7xl">
          Your Job Search,{' '}
          <span className="relative">
            <span className="relative z-10 bg-gradient-to-r from-primary-700 to-accent-500 bg-clip-text text-transparent">
              Supercharged
            </span>
            <span className="absolute -bottom-2 left-0 right-0 h-3 bg-accent-200/50 rounded" />
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
          Scrape jobs from LinkedIn, Indeed, Glassdoor, and more — all from your machine.
          View, filter, and track everything in one beautiful command center.
        </p>

        {step === 'initial' && (
          <div className="mt-10 space-y-8">
            <button
              onClick={() => setStep('configure')}
              className="group relative inline-flex items-center gap-3 rounded-xl bg-primary-950 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-primary-950/20 transition-all hover:bg-primary-900 hover:shadow-xl hover:shadow-primary-950/30 hover:-translate-y-0.5"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Get Started
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>

            {recentSessions.length > 0 && (
              <div className="mx-auto max-w-md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Sessions</p>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Clear history
                  </button>
                </div>
                <div className="space-y-2">
                  {recentSessions.map((s) => (
                    <a
                      key={s.code}
                      href={`/dashboard/${s.code}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <span className="font-mono text-sm font-bold text-primary-700">{s.code}</span>
                        <span className="text-sm text-slate-500 truncate max-w-48">
                          {s.keywords.join(', ')}
                        </span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'configure' && (
          <div className="mt-10 animate-slide-up">
            <SearchConfig onSessionCreated={handleSessionCreated} />
          </div>
        )}

        {step === 'ready' && sessionCode && (
          <div className="mt-10 animate-slide-up">
            <SessionReady code={sessionCode} expiresAt={expiresAt} />
          </div>
        )}

        <div className="mt-16 flex items-center justify-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            No account needed
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            48h sessions
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Open source
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionReady({ code, expiresAt }: { code: string; expiresAt: string | null }) {
  const apiUrl = typeof window !== 'undefined' ? window.location.origin : 'https://jobhunter.vercel.app';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Session code card */}
      <div className="rounded-2xl border border-primary-200 bg-white p-8 shadow-xl shadow-primary-950/5">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Your Session Code</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-widest text-primary-950">
            {code}
          </span>
          <CopyButton text={code} />
        </div>
        {expiresAt && (
          <p className="mt-3 text-xs text-slate-400">
            Expires {new Date(expiresAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-display text-base font-bold text-primary-950">Next Steps</h3>

        <div className="flex gap-3 items-start">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">1</span>
          <div className="text-sm text-slate-600 w-full">
            <p className="font-medium text-slate-800">Install the scraper &amp; browser engine</p>
            <div className="mt-1.5 rounded-lg bg-slate-900 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <code className="text-sm text-slate-300 font-mono">pip install jobhunter-scraper</code>
                <CopyButton text="pip install jobhunter-scraper" />
              </div>
              <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                <code className="text-sm text-slate-300 font-mono">python -m playwright install chromium</code>
                <CopyButton text="python -m playwright install chromium" />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">Only needed once. Requires Python 3.9+.</p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">2</span>
          <div className="text-sm text-slate-600 w-full">
            <p className="font-medium text-slate-800">Run the scraper</p>
            <ScraperCommand code={code} apiUrl={apiUrl} />
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">3</span>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">View results on your dashboard</p>
          </div>
        </div>
      </div>

      <a
        href={`/dashboard/${code}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-primary-950 shadow-md shadow-accent-500/20 transition-all hover:bg-accent-400 hover:-translate-y-0.5"
      >
        Open Dashboard
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

function ScraperCommand({ code, apiUrl }: { code: string; apiUrl: string }) {
  const cmd = `python -m scrape --session ${code} --api-url ${apiUrl}`;

  return (
    <div className="mt-1.5 rounded-lg bg-slate-900 p-3">
      <div className="flex items-start justify-between gap-2">
        <pre className="text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
          <code>{cmd}</code>
        </pre>
        <CopyButton text={cmd} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Your keywords and location are saved to the session. The scraper will fetch them automatically.
      </p>
    </div>
  );
}

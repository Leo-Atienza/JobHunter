'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SearchConfig } from './SearchConfig';

type FlowStep = 'initial' | 'configure';

interface SavedSession {
  code: string;
  keywords: string[];
  created_at: string;
  expires_at: string;
}

interface CloudSession {
  code: string;
  keywords: string[] | null;
  created_at: string;
  expires_at: string;
  job_count: number;
}

export function Hero() {
  const { data: authSession } = useSession();
  const [step, setStep] = useState<FlowStep>('initial');
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);
  const [cloudSessions, setCloudSessions] = useState<CloudSession[]>([]);

  // Load localStorage sessions
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('jobhunter_sessions') || '[]') as SavedSession[];
      const now = new Date();
      const valid = stored.filter((s) => new Date(s.expires_at) > now);
      setRecentSessions(valid);
      if (valid.length !== stored.length) {
        localStorage.setItem('jobhunter_sessions', JSON.stringify(valid));
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Load cloud sessions for signed-in users
  useEffect(() => {
    if (!authSession?.user) {
      setCloudSessions([]);
      return;
    }
    fetch('/api/user/sessions')
      .then((r) => r.json())
      .then((data) => setCloudSessions(data.sessions ?? []))
      .catch(() => {});
  }, [authSession?.user]);

  function clearHistory() {
    localStorage.removeItem('jobhunter_sessions');
    setRecentSessions([]);
  }

  function handleSessionCreated(code: string, _expires: string) {
    // Redirect directly to dashboard — server-side scraping starts automatically
    window.location.href = `/dashboard/${code}`;
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
          Search 12 job sources instantly — Remotive, Himalayas, Lever, Greenhouse, and more.
          AI-powered summaries, smart deduplication, and advanced filters. All free.
        </p>

        {/* CTA / Search Config area */}
        <div className="mt-10 space-y-8">
          {step === 'initial' ? (
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
          ) : (
            <div className="animate-slide-up">
              <button
                onClick={() => setStep('initial')}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <SearchConfig onSessionCreated={handleSessionCreated} />
            </div>
          )}

          {/* Cloud sessions for signed-in users — always visible */}
          {cloudSessions.length > 0 && (
            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">My Sessions</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    Saved
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {cloudSessions.map((s) => (
                  <Link
                    key={s.code}
                    href={`/dashboard/${s.code}`}
                    className="flex items-center justify-between rounded-xl border border-primary-100 bg-white px-4 py-3 shadow-sm transition-all hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-mono text-sm font-bold text-primary-700">{s.code}</span>
                      <span className="text-sm text-slate-500 truncate max-w-36">
                        {s.keywords?.join(', ') ?? 'No keywords'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.job_count} jobs</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Local sessions (anonymous) — always visible */}
          {recentSessions.length > 0 && (
            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  {cloudSessions.length > 0 ? 'Local History' : 'Recent Sessions'}
                </p>
                <button
                  onClick={clearHistory}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear history
                </button>
              </div>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <Link
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
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            No account needed
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Sign in to save forever
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


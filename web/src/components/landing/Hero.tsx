'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Wand2, ArrowLeft, ArrowRight, Shield, User, Code2, Globe, Sparkles } from 'lucide-react';
import { SearchConfig } from './SearchConfig';
import { JOB_SOURCES } from '@/lib/types';

const SOURCE_COUNT = JOB_SOURCES.length;

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
      const stored = JSON.parse(
        localStorage.getItem('jobhunter_sessions') || '[]',
      ) as SavedSession[];
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
        <div className="bg-primary-100/60 absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-accent-100/50 absolute top-48 -left-32 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-accent-400 animate-float absolute top-1/3 right-1/4 h-4 w-4 rotate-45 opacity-20" />
        <div
          className="bg-primary-400 animate-float absolute top-1/2 left-1/5 h-3 w-3 rounded-full opacity-20"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="bg-primary-300 animate-float absolute top-2/3 right-1/3 h-5 w-5 rotate-12 rounded opacity-15"
          style={{ animationDelay: '4s' }}
        />
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
        <div className="border-primary-200 bg-primary-50 text-primary-800 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
          <span className="bg-accent-500 h-2 w-2 rounded-full" />
          Open Source Job Aggregator
        </div>

        <h1 className="font-display text-primary-950 text-5xl leading-tight font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          Your Job Search,{' '}
          <span className="relative">
            <span className="from-primary-700 to-accent-500 relative z-10 bg-gradient-to-r bg-clip-text text-transparent">
              Supercharged
            </span>
            <span className="bg-accent-200/50 absolute right-0 -bottom-2 left-0 h-3 rounded" />
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
          Search {SOURCE_COUNT} job sources instantly — LinkedIn, Greenhouse, Ashby (OpenAI, Cohere,
          Notion), Lever, and more. AI-powered summaries, smart deduplication, and advanced filters.
          All free.
        </p>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <div className="stagger-1 border-primary-200 bg-primary-50 text-primary-800 animate-fade-in inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
            <Globe size={15} className="text-primary-600" />
            {SOURCE_COUNT} Job Sources
          </div>
          <div className="stagger-2 border-accent-200 bg-accent-50 text-accent-800 animate-fade-in inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
            <Sparkles size={15} className="text-accent-600" />
            AI-Powered Matching
          </div>
          <div className="stagger-3 animate-fade-in inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            <Shield size={15} className="text-emerald-600" />
            100% Free
          </div>
        </div>

        {/* CTA / Search Config area */}
        <div className="mt-10 space-y-8">
          {step === 'initial' ? (
            <button
              onClick={() => setStep('configure')}
              className="group bg-primary-950 shadow-primary-950/20 hover:bg-primary-900 hover:shadow-primary-950/30 relative inline-flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Wand2 size={20} />
              Get Started
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ) : (
            <div className="animate-slide-up">
              <button
                onClick={() => setStep('initial')}
                className="hover:text-primary-700 mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <SearchConfig onSessionCreated={handleSessionCreated} />
            </div>
          )}

          {/* Cloud sessions for signed-in users — always visible */}
          {cloudSessions.length > 0 && (
            <div className="mx-auto max-w-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
                    My Sessions
                  </p>
                  <span className="bg-primary-50 text-primary-700 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <User size={10} strokeWidth={2.5} />
                    Saved
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {cloudSessions.map((s) => (
                  <Link
                    key={s.code}
                    href={`/dashboard/${s.code}`}
                    className="border-primary-100 hover:border-primary-300 flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-primary-700 font-mono text-sm font-bold">{s.code}</span>
                      <span className="max-w-36 truncate text-sm text-slate-500">
                        {s.keywords?.join(', ') ?? 'No keywords'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.job_count} jobs</span>
                      <ArrowRight size={16} className="shrink-0 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Local sessions (anonymous) — always visible */}
          {recentSessions.length > 0 && (
            <div className="mx-auto max-w-md">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
                  {cloudSessions.length > 0 ? 'Local History' : 'Recent Sessions'}
                </p>
                <button
                  onClick={clearHistory}
                  className="text-xs text-slate-400 transition-colors hover:text-slate-600"
                >
                  Clear history
                </button>
              </div>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <Link
                    key={s.code}
                    href={`/dashboard/${s.code}`}
                    className="hover:border-primary-300 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-primary-700 font-mono text-sm font-bold">{s.code}</span>
                      <span className="max-w-48 truncate text-sm text-slate-500">
                        {s.keywords.join(', ')}
                      </span>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 sm:gap-8">
          <div className="flex items-center gap-2">
            <Shield size={16} />
            No account needed
          </div>
          <div className="flex items-center gap-2">
            <User size={16} />
            Sign in to save forever
          </div>
          <div className="flex items-center gap-2">
            <Code2 size={16} />
            Open source
          </div>
        </div>
      </div>
    </section>
  );
}

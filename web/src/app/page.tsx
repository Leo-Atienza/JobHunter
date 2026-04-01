import Link from 'next/link';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';

import { FAQ } from '@/components/landing/FAQ';
import { UserMenu } from '@/components/auth/UserMenu';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-950">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold text-primary-950">
              JobHunter
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/saved"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Saved
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-primary-700"
            >
              GitHub
            </a>
            <UserMenu />
          </div>
        </div>
      </nav>

      <Hero />
      <HowItWorks />
      <FAQ />

      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="font-display text-lg font-bold text-primary-950">JobHunter</p>
          <p className="mt-2 text-sm text-slate-500">
            Open source job search aggregator. Your data, your searches, your control.
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Anonymous sessions expire after 48 hours. Sign in with Google to save sessions permanently.
          </p>
        </div>
      </footer>
    </main>
  );
}

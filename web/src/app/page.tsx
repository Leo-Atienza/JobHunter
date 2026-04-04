import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FAQ } from '@/components/landing/FAQ';
import { SiteHeader } from '@/components/layout/SiteHeader';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader
        position="fixed"
        right={
          <>
            <Link
              href="/saved"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-700"
            >
              <BarChart3 size={14} />
              Tracker
            </Link>
          </>
        }
        mobileLinks={
          <>
            <Link href="/saved" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <BarChart3 size={16} />
              Application Tracker
            </Link>
          </>
        }
      />

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
          <p className="mt-2 text-xs text-slate-400">
            &copy; {new Date().getFullYear()} JobHunter &middot; Built with Next.js + Neon
          </p>
        </div>
      </footer>
    </main>
  );
}

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ScraperHealthDashboard } from '@/components/health/ScraperHealthDashboard';

export const metadata = {
  title: 'Scraper Health — JobHunter',
  description: 'Monitor scraper performance, error rates, and job source health.',
};

export default function ScraperHealthPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <Link
            href="/"
            className="transition-colors duration-150 hover:text-primary-600"
          >
            Home
          </Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="text-slate-600 font-medium">Scraper Health</span>
        </nav>

        {/* Hero header */}
        <div className="animate-hero-in mb-8">
          <h1 className="font-display text-3xl font-bold text-primary-950 sm:text-4xl">
            Scraper Health
          </h1>
          <p className="animate-fade-in mt-2 text-slate-500">
            Monitor error rates, response times, and which sources return results.
          </p>
        </div>

        <ScraperHealthDashboard />
      </div>
    </main>
  );
}

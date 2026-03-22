import { ScraperHealthDashboard } from '@/components/health/ScraperHealthDashboard';

export const metadata = {
  title: 'Scraper Health — JobHunter',
  description: 'Monitor scraper performance, error rates, and job source health.',
};

export default function ScraperHealthPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <a href="/" className="text-sm text-primary-600 hover:text-primary-700">&larr; Back to home</a>
          <h1 className="mt-2 font-display text-3xl font-bold text-primary-950">Scraper Health</h1>
          <p className="mt-1 text-slate-500">Monitor error rates, response times, and which sources return results.</p>
        </div>
        <ScraperHealthDashboard />
      </div>
    </main>
  );
}

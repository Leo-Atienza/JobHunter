'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Dashboard-level error boundary. Because the session code context may be
 * lost after a hard error, the primary recovery action is navigating home
 * rather than retrying, though retry is still offered.
 */
export default function DashboardError({ error, reset }: ErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="bg-error-100 mx-auto flex h-14 w-14 items-center justify-center rounded-full">
          <AlertCircle size={26} className="text-error-600" aria-hidden="true" />
        </div>

        <h1 className="font-display text-primary-950 mt-6 text-2xl font-bold">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          {error.message || 'An unexpected error occurred while loading your dashboard.'}
        </p>

        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">Error ID: {error.digest}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="bg-primary-950 hover:bg-primary-900 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5"
          >
            <RefreshCw size={15} strokeWidth={2.5} aria-hidden="true" />
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-50"
          >
            <ArrowLeft size={15} strokeWidth={2.5} aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

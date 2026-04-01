import { auth } from '@/lib/auth';
import { SavedJobsClient } from '@/components/saved/SavedJobsClient';
import Link from 'next/link';

export const metadata = {
  title: 'Saved Jobs — JobHunter',
  description: 'Your bookmarked job listings across all sessions.',
};

export default async function SavedJobsPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-primary-950">
            Saved Jobs
          </h1>
          <p className="mt-3 text-slate-500">
            Sign in to save jobs across sessions and access them anytime.
          </p>
          <Link
            href="/auth/signin"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-950 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-950/20 transition-all hover:bg-primary-900 hover:-translate-y-0.5"
          >
            Sign in to get started
          </Link>
        </div>
      </main>
    );
  }

  return <SavedJobsClient />;
}

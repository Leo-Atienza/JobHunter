import { auth } from '@/lib/auth';
import { SavedJobsClient } from '@/components/saved/SavedJobsClient';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export const metadata = {
  title: 'Application Tracker — JobHunter',
  description: 'Track your job applications from saved to offer.',
};

export default async function SavedJobsPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <BarChart3 size={28} className="text-primary-600" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-primary-950">
            Application Tracker
          </h1>
          <p className="mt-3 text-slate-500">
            Sign in to track your job applications from saved to offer.
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

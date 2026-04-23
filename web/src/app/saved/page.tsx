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
        <div className="animate-fade-in max-w-md text-center">
          <div className="bg-primary-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <BarChart3 size={28} className="text-primary-600" />
          </div>
          <h1 className="font-display text-primary-950 mt-6 text-2xl font-bold">
            Application Tracker
          </h1>
          <p className="mt-3 text-slate-500">
            Sign in to track your job applications from saved to offer.
          </p>
          <Link
            href="/auth/signin"
            className="bg-primary-950 shadow-primary-950/20 hover:bg-primary-900 mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
          >
            Sign in to get started
          </Link>
        </div>
      </main>
    );
  }

  return <SavedJobsClient />;
}

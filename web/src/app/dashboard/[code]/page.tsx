import { Suspense } from 'react';
import Link from 'next/link';
import { XCircle, ArrowLeft } from 'lucide-react';
import { getDb } from '@/lib/db';
import { isValidCodeFormat } from '@/lib/session';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

interface DashboardPageProps {
  params: Promise<{ code: string }>;
}

async function validateSession(
  code: string,
): Promise<{ valid: false; expiresAt: null } | { valid: true; expiresAt: string }> {
  if (!isValidCodeFormat(code)) {
    return { valid: false, expiresAt: null };
  }

  const sql = getDb();
  const rows = await sql(
    `SELECT expires_at FROM sessions
     WHERE code = $1 AND (expires_at > NOW() OR user_id IS NOT NULL)`,
    [code],
  );

  if (rows.length === 0 || !rows[0].expires_at) {
    return { valid: false, expiresAt: null };
  }

  return { valid: true, expiresAt: rows[0].expires_at as string };
}

export async function generateMetadata({ params }: DashboardPageProps) {
  const { code } = await params;
  return {
    title: `Dashboard ${code} — JobHunter`,
    description: `View and manage scraped job listings for session ${code}.`,
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { code } = await params;
  const { valid, expiresAt } = await validateSession(code);

  if (!valid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="animate-fade-in max-w-md text-center">
          <div className="bg-error-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <XCircle size={28} className="text-error-600" />
          </div>
          <h1 className="font-display text-primary-950 mt-6 text-2xl font-bold">
            Session Not Found
          </h1>
          <p className="mt-3 text-slate-500">
            The session code{' '}
            <span className="text-primary-700 font-mono font-semibold">{code}</span> is invalid or
            has expired. Sessions last 48 hours.
          </p>
          <Link
            href="/"
            className="bg-primary-950 shadow-primary-950/20 hover:bg-primary-900 mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
          >
            <ArrowLeft size={16} />
            Generate New Session
          </Link>
        </div>
      </main>
    );
  }

  return (
    <Suspense>
      <DashboardClient code={code} expiresAt={expiresAt} />
    </Suspense>
  );
}

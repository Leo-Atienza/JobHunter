'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { fetcher } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface AlertRow {
  id: number;
  session_code: string;
  frequency: string;
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
  keywords: string[] | null;
  locations: string[] | null;
}

export function AlertsList() {
  const enabled = process.env.NEXT_PUBLIC_ALERTS_ENABLED === '1';
  const { data, mutate } = useSWR<{ alerts: AlertRow[] }>(enabled ? '/api/alerts' : null, fetcher, {
    revalidateOnFocus: false,
  });
  const toast = useToast();

  if (!enabled) return null;
  const alerts = data?.alerts ?? [];
  if (alerts.length === 0) return null;

  async function handleDelete(id: number) {
    const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ message: 'Alert removed', type: 'success' });
      mutate();
    } else {
      toast({ message: 'Could not remove alert', type: 'error' });
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bell size={16} className="text-primary-600" />
        <h2 className="font-display text-primary-950 text-sm font-bold">Active email alerts</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {alerts.length}
        </span>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const keywords = a.keywords?.filter(Boolean) ?? [];
          const locations = a.locations?.filter(Boolean) ?? [];
          const summary = keywords.length > 0 ? keywords.slice(0, 3).join(', ') : 'Untitled search';
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/${a.session_code}`}
                  className="text-primary-800 font-medium hover:underline"
                >
                  {summary}
                </Link>
                <div className="mt-0.5 text-xs text-slate-500">
                  {locations.length > 0 ? locations.slice(0, 2).join(' · ') : 'All locations'}
                  {' · '}
                  {a.last_sent_at
                    ? `last sent ${new Date(a.last_sent_at).toLocaleDateString()}`
                    : 'pending first digest'}
                  {!a.enabled && <span className="text-error-500 ml-2">disabled</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Remove alert"
                title="Remove alert"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

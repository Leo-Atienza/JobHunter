'use client';

import { useState } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useSession } from 'next-auth/react';

interface AlertsButtonProps {
  sessionCode: string;
}

export function AlertsButton({ sessionCode }: AlertsButtonProps) {
  const { data: authSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const toast = useToast();

  // Hide entirely if feature is not yet enabled server-side
  const enabled = process.env.NEXT_PUBLIC_ALERTS_ENABLED === '1';
  if (!enabled) return null;

  // Only signed-in users can create alerts (needs email)
  if (!authSession?.user?.id) return null;

  async function handleClick() {
    if (busy || subscribed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_code: sessionCode }),
      });

      if (res.status === 503) {
        toast({ message: 'Email alerts are not enabled yet', type: 'info' });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ message: body.error ?? 'Could not create alert', type: 'error' });
        return;
      }

      setSubscribed(true);
      toast({
        message: 'Daily digest enabled — 9am ET delivery',
        type: 'success',
        action: { label: 'Manage', href: '/saved' },
      });
    } catch {
      toast({ message: 'Network error', type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || subscribed}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
      title={
        subscribed ? 'Daily alert subscribed' : 'Get a daily email of new jobs for this search'
      }
    >
      {subscribed ? (
        <>
          <Check size={14} className="text-emerald-600" />
          <span>Alert on</span>
        </>
      ) : busy ? (
        <>
          <BellRing size={14} className="animate-pulse" />
          <span>…</span>
        </>
      ) : (
        <>
          <Bell size={14} />
          <span>Daily alerts</span>
        </>
      )}
    </button>
  );
}

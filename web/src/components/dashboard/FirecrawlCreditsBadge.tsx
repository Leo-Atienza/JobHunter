'use client';

import { useState, useEffect } from 'react';

interface CreditsData {
  estimated_remaining: number;
  credits_used: number;
  runs_this_month: number;
  percent_used: number;
  monthly_limit: number;
}

export function FirecrawlCreditsBadge() {
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scraper-health/firecrawl-credits')
      .then((r) => r.json())
      .then((d: CreditsData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />;
  if (!data) return null;

  const colorClass =
    data.percent_used < 70
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
      : data.percent_used < 90
        ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
        : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${colorClass}`}
      title={`${data.credits_used}/${data.monthly_limit} Firecrawl credits used this month (${data.runs_this_month} scrapes)`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
      </svg>
      {data.estimated_remaining} credits
    </span>
  );
}

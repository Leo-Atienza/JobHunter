'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

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
      <Zap size={11} />
      {data.estimated_remaining} credits
    </span>
  );
}

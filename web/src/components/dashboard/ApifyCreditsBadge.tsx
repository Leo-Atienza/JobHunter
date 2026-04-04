'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface ApifyCreditsData {
  remaining: number;
  runs_this_month: number;
  monthly_limit: number;
  percent_used: number;
  is_exhausted: boolean;
}

export function ApifyCreditsBadge() {
  const [data, setData] = useState<ApifyCreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scraper-health/apify-credits')
      .then((r) => r.json())
      .then((d: ApifyCreditsData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />;
  if (!data) return null;

  const colorClass =
    data.remaining > 6
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
      : data.remaining > 2
        ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
        : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${colorClass}`}
      title={`${data.runs_this_month}/${data.monthly_limit} Apify runs used this month ($${(data.runs_this_month * 0.25).toFixed(2)} of $5.00 free tier)`}
    >
      <Calendar size={11} />
      {data.is_exhausted ? 'Limit reached' : `${data.remaining} runs left`}
    </span>
  );
}

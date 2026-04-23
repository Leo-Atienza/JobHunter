'use client';

import { Info } from 'lucide-react';
import type { MatchBreakdown } from '@/lib/match-scoring';

interface Props {
  score: number;
  breakdown: MatchBreakdown | null;
  id: string;
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="bg-primary-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-semibold text-slate-600 tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}

export function MatchScorePopover({ score, breakdown, id }: Props) {
  const popoverId = `match-popover-${id}`;

  const colorClass =
    score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-orange-500';

  const barColor = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-orange-400';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`text-[10px] font-bold ${colorClass}`}>{score}%</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <span
          className={`block h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </span>

      {breakdown && (
        <>
          <button
            popovertarget={popoverId}
            className="rounded-full p-0.5 text-slate-300 transition-colors hover:text-slate-500"
            aria-label="Why this score?"
          >
            <Info size={12} />
          </button>

          <div
            id={popoverId}
            popover="auto"
            className="m-0 w-72 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl [&::backdrop]:bg-transparent"
            style={{ animation: 'slide-in-up 0.2s ease-out' }}
          >
            <p className="mb-3 font-semibold text-slate-800">Why {score}% match?</p>
            <div className="space-y-2">
              <ScoreRow label="Skill overlap" value={breakdown.skill_score} max={50} />
              <ScoreRow label="Title relevance" value={breakdown.title_score} max={20} />
              <ScoreRow label="Description" value={breakdown.desc_score} max={20} />
              <ScoreRow label="Experience fit" value={breakdown.exp_score} max={10} />
            </div>

            {breakdown.matched_skills.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Matched skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {breakdown.matched_skills.slice(0, 12).map((s) => (
                    <span
                      key={s}
                      className="bg-primary-50 text-primary-700 border-primary-200 rounded border px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {breakdown.matched_title && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-[10px] text-slate-400">
                  Title match:{' '}
                  <span className="font-medium text-slate-600">{breakdown.matched_title}</span>
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

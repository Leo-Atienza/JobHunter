'use client';

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
          className="h-full rounded-full bg-primary-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-semibold tabular-nums text-slate-600">
        {value}/{max}
      </span>
    </div>
  );
}

export function MatchScorePopover({ score, breakdown, id }: Props) {
  const popoverId = `match-popover-${id}`;

  const colorClass =
    score >= 80
      ? 'text-emerald-600'
      : score >= 50
        ? 'text-amber-600'
        : 'text-orange-500';

  const barColor =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 50
        ? 'bg-amber-500'
        : 'bg-orange-400';

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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          <div
            id={popoverId}
            popover="auto"
            className="m-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xl w-72 text-sm [&::backdrop]:bg-transparent"
            style={{ animation: 'slide-in-up 0.2s ease-out' }}
          >
            <p className="font-semibold text-slate-800 mb-3">Why {score}% match?</p>
            <div className="space-y-2">
              <ScoreRow label="Skill overlap" value={breakdown.skill_score} max={50} />
              <ScoreRow label="Title relevance" value={breakdown.title_score} max={20} />
              <ScoreRow label="Description" value={breakdown.desc_score} max={20} />
              <ScoreRow label="Experience fit" value={breakdown.exp_score} max={10} />
            </div>

            {breakdown.matched_skills.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Matched skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {breakdown.matched_skills.slice(0, 12).map((s) => (
                    <span
                      key={s}
                      className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 border border-primary-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {breakdown.matched_title && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">
                  Title match: <span className="font-medium text-slate-600">{breakdown.matched_title}</span>
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

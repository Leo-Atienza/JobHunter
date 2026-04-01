interface AISummaryBlockProps {
  summary: string | null;
  loading: boolean;
  compact?: boolean;
}

export function AISummaryBlock({ summary, loading, compact }: AISummaryBlockProps) {
  if (!summary && !loading) return null;

  return (
    <div className={compact
      ? 'rounded-lg border border-primary-200 bg-primary-50/50 p-3'
      : 'rounded-xl border border-primary-200 bg-primary-50/50 p-4'
    }>
      <div className={compact ? 'flex items-center gap-2 mb-1' : 'flex items-center gap-2 mb-2'}>
        <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        <h4 className={compact
          ? 'text-[10px] font-semibold uppercase tracking-wider text-primary-600'
          : 'text-xs font-semibold uppercase tracking-wider text-primary-600'
        }>AI Summary</h4>
      </div>
      {loading ? (
        <div className={compact
          ? 'flex items-center gap-2 text-xs text-primary-500'
          : 'flex items-center gap-2 text-sm text-primary-500'
        }>
          <svg className={compact ? 'h-3 w-3 animate-spin' : 'h-4 w-4 animate-spin'} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {compact ? 'Generating...' : 'Generating summary...'}
        </div>
      ) : (
        <p className={compact
          ? 'text-xs leading-relaxed text-primary-900'
          : 'text-sm leading-relaxed text-primary-900'
        }>{summary}</p>
      )}
    </div>
  );
}

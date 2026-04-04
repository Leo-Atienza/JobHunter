import { Sparkles, RefreshCw } from 'lucide-react';

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
        <Sparkles size={compact ? 12 : 14} className="text-primary-600" />
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
          <RefreshCw size={compact ? 12 : 16} className="animate-spin" />
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

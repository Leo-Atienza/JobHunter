import { Sparkles, RefreshCw } from 'lucide-react';

interface AISummaryBlockProps {
  summary: string | null;
  loading: boolean;
  compact?: boolean;
}

export function AISummaryBlock({ summary, loading, compact }: AISummaryBlockProps) {
  if (!summary && !loading) return null;

  return (
    <div
      className={
        compact
          ? 'border-primary-200 bg-primary-50/50 rounded-lg border p-3'
          : 'border-primary-200 bg-primary-50/50 rounded-xl border p-4'
      }
    >
      <div className={compact ? 'mb-1 flex items-center gap-2' : 'mb-2 flex items-center gap-2'}>
        <Sparkles size={compact ? 12 : 14} className="text-primary-600" />
        <h4
          className={
            compact
              ? 'text-primary-600 text-[10px] font-semibold tracking-wider uppercase'
              : 'text-primary-600 text-xs font-semibold tracking-wider uppercase'
          }
        >
          AI Summary
        </h4>
      </div>
      {loading ? (
        <div
          className={
            compact
              ? 'text-primary-500 flex items-center gap-2 text-xs'
              : 'text-primary-500 flex items-center gap-2 text-sm'
          }
        >
          <RefreshCw size={compact ? 12 : 16} className="animate-spin" />
          {compact ? 'Generating...' : 'Generating summary...'}
        </div>
      ) : (
        <p
          className={
            compact
              ? 'text-primary-900 text-xs leading-relaxed'
              : 'text-primary-900 text-sm leading-relaxed'
          }
        >
          {summary}
        </p>
      )}
    </div>
  );
}

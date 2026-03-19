import type { JobStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: JobStatus;
}

const statusConfig: Record<JobStatus, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
  saved: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Saved' },
  applied: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Applied' },
  interview: { bg: 'bg-green-100', text: 'text-green-800', label: 'Interview' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  dismissed: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Dismissed' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.new;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

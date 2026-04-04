'use client';

import { useToast } from '@/components/ui/Toast';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  code: string;
  disabled: boolean;
}

export function ExportButton({ code, disabled }: ExportButtonProps) {
  const toast = useToast();

  return (
    <a
      href={disabled ? undefined : `/api/jobs/export?session=${code}`}
      download
      title="Export CSV"
      className={`inline-flex items-center gap-2 rounded-xl p-2 sm:px-4 sm:py-2 text-sm font-semibold transition-all ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
          : 'bg-primary-950 text-white shadow-md shadow-primary-950/10 hover:bg-primary-900 hover:-translate-y-0.5'
      }`}
      onClick={(e) => {
        if (disabled) { e.preventDefault(); return; }
        toast({ message: 'Exporting CSV...', type: 'success', duration: 2500 });
      }}
    >
      <Download size={16} />
      <span className="hidden sm:inline">Export CSV</span>
    </a>
  );
}

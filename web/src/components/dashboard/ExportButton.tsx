'use client';

interface ExportButtonProps {
  code: string;
  disabled: boolean;
}

export function ExportButton({ code, disabled }: ExportButtonProps) {
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
        if (disabled) e.preventDefault();
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span className="hidden sm:inline">Export CSV</span>
    </a>
  );
}

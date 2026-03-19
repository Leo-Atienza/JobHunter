'use client';

import { CopyButton } from '@/components/ui/CopyButton';

interface WaitingStateProps {
  code: string;
}

export function WaitingState({ code }: WaitingStateProps) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center text-center animate-fade-in">
      {/* Radar animation */}
      <div className="relative h-32 w-32">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary-200 animate-[spin_12s_linear_infinite]" />
        {/* Middle ring */}
        <div className="absolute inset-4 rounded-full border-2 border-primary-200/60" />
        {/* Inner ring */}
        <div className="absolute inset-8 rounded-full border-2 border-primary-200/40" />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-accent-500 animate-pulse-soft" />
        </div>
        {/* Scanning line */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-14 w-0.5 origin-bottom bg-gradient-to-t from-accent-500/80 to-transparent animate-[spin_3s_ease-in-out_infinite]"
            style={{ transformOrigin: '50% 100%', height: '50%', position: 'absolute', top: '0' }}
          />
        </div>
      </div>

      <h2 className="mt-8 font-display text-2xl font-bold text-primary-950">
        Waiting for scraper results...
      </h2>
      <p className="mt-3 max-w-md text-sm text-slate-500">
        Run the JobHunter scraper on your machine and jobs will appear here automatically.
        The dashboard refreshes every 10 seconds.
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Your Session Code</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-widest text-primary-950">{code}</span>
          <CopyButton text={code} />
        </div>
      </div>

      <div className="mt-8 max-w-sm rounded-xl bg-slate-900 p-4 text-left">
        <p className="mb-2 text-xs font-medium text-slate-400">Quick start:</p>
        <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
          <code>{`jobhunter scrape \\
  --session ${code} \\
  --keywords "your job title"`}</code>
        </pre>
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse-soft" />
        Listening for incoming data...
      </div>
    </div>
  );
}

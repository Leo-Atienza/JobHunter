'use client';

import { useState } from 'react';

interface ShareButtonProps {
  code: string;
  jobCount: number;
  disabled: boolean;
}

export function ShareButton({ code, jobCount, disabled }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (disabled) return;

    const url = `${window.location.origin}/dashboard/${code}`;
    const text = `I found ${jobCount} job${jobCount !== 1 ? 's' : ''} with JobHunter! Check them out:`;

    // Try native share API first (mobile + some desktops)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JobHunter Results', text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={disabled}
      title="Share"
      className={`inline-flex items-center gap-2 rounded-xl p-2 sm:px-4 sm:py-2 text-sm font-semibold transition-all ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
          : copied
            ? 'bg-success-500 text-white'
            : 'bg-primary-950 text-white shadow-md shadow-primary-950/10 hover:bg-primary-900 hover:-translate-y-0.5'
      }`}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="hidden sm:inline">Copied!</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  );
}

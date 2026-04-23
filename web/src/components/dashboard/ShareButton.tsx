'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Check, Share2 } from 'lucide-react';

interface ShareButtonProps {
  code: string;
  jobCount: number;
  disabled: boolean;
}

export function ShareButton({ code, jobCount, disabled }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

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
      toast({ message: 'Link copied to clipboard', type: 'success', duration: 2000 });
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={disabled}
      title="Share"
      className={`inline-flex items-center gap-2 rounded-xl p-2 text-sm font-semibold transition-all sm:px-4 sm:py-2 ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
          : copied
            ? 'bg-success-500 text-white'
            : 'bg-primary-950 shadow-primary-950/10 hover:bg-primary-900 text-white shadow-md hover:-translate-y-0.5'
      }`}
    >
      {copied ? (
        <>
          <Check size={16} />
          <span className="hidden sm:inline">Copied!</span>
        </>
      ) : (
        <>
          <Share2 size={16} />
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  );
}

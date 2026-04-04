'use client';

import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  variant?: 'light' | 'dark';
}

export function CopyButton({ text, variant = 'light' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  const baseClasses = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all';
  const variantClasses =
    variant === 'dark'
      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <button onClick={handleCopy} className={`${baseClasses} ${variantClasses}`}>
      {copied ? (
        <>
          <Check size={14} className="text-success-500" strokeWidth={2.5} />
          Copied!
        </>
      ) : (
        <>
          <Copy size={14} />
          Copy
        </>
      )}
    </button>
  );
}

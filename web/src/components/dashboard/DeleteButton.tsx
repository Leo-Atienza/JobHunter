'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteButtonProps {
  code: string;
}

export function DeleteButton({ code }: DeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete session ${code}? This will permanently remove the session and all its jobs.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/session/${code}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        throw new Error('Failed to delete session');
      }

      // Remove from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('jobhunter_sessions') || '[]');
        const filtered = stored.filter((s: { code: string }) => s.code !== code);
        localStorage.setItem('jobhunter_sessions', JSON.stringify(filtered));
      } catch {
        // localStorage unavailable
      }

      router.push('/');
    } catch {
      setDeleting(false);
      alert('Failed to delete session. Please try again.');
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
        deleting
          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
          : 'border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 hover:-translate-y-0.5'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      {deleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
  code: string;
}

export function DeleteButton({ code }: DeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setShowConfirm(false);
    setDeleting(true);
    setError(null);
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
      setError('Failed to delete session. Please try again.');
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={deleting}
        title="Delete session"
        className={`inline-flex items-center gap-2 rounded-xl p-2 text-sm font-semibold transition-all sm:px-4 sm:py-2 ${
          deleting
            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
            : 'border border-red-200 bg-white text-red-600 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50'
        }`}
      >
        <Trash2 size={16} />
        <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete'}</span>
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <ConfirmDialog
        open={showConfirm}
        title="Delete Session"
        message={`Delete session ${code}? This will permanently remove the session and all its jobs.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        destructive
      />
    </>
  );
}

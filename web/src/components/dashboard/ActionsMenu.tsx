'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, RefreshCw, Share2, Download, Trash2 } from 'lucide-react';
import { SERVER_SCRAPER_NAMES } from '@/lib/scrapers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ActionsMenuProps {
  code: string;
  hasJobs: boolean;
  jobCount: number;
  onRescanStart: () => void;
  onRescanComplete: () => void;
}

export function ActionsMenu({
  code,
  hasJobs,
  jobCount,
  onRescanStart,
  onRescanComplete,
}: ActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleRescan = useCallback(async () => {
    setOpen(false);
    if (scanning) return;
    setScanning(true);
    setScanDone(0);
    setScanTotal(SERVER_SCRAPER_NAMES.length);
    onRescanStart();

    const promises = SERVER_SCRAPER_NAMES.map(async (source) => {
      try {
        await fetch(`/api/scrape/${source}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_code: code }),
        });
      } catch {
        /* silent */
      }
      setScanDone((prev) => prev + 1);
    });

    await Promise.all(promises);
    setScanning(false);
    onRescanComplete();
  }, [scanning, code, onRescanStart, onRescanComplete]);

  async function handleShare() {
    setOpen(false);
    if (!hasJobs) return;
    const url = `${window.location.origin}/dashboard/${code}`;
    const text = `I found ${jobCount} job${jobCount !== 1 ? 's' : ''} with JobHunter! Check them out:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'JobHunter Results', text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleExport() {
    setOpen(false);
    if (!hasJobs) return;
    window.location.href = `/api/jobs/export?session=${code}`;
  }

  function handleDeleteClick() {
    setOpen(false);
    setShowDeleteConfirm(true);
  }

  async function handleDeleteConfirm() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/session/${code}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('Failed');
      try {
        const stored = JSON.parse(localStorage.getItem('jobhunter_sessions') || '[]');
        const filtered = stored.filter((s: { code: string }) => s.code !== code);
        localStorage.setItem('jobhunter_sessions', JSON.stringify(filtered));
      } catch {
        /* localStorage unavailable */
      }
      router.push('/');
    } catch {
      setDeleting(false);
      setDeleteError('Failed to delete session. Please try again.');
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        aria-label="Actions menu"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div className="animate-fade-in absolute top-full right-0 z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <button
            onClick={handleRescan}
            disabled={scanning}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              scanning ? 'cursor-not-allowed text-slate-400' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} />
            {scanning ? `Scanning ${scanDone}/${scanTotal}...` : 'Rescan'}
          </button>
          <button
            onClick={handleShare}
            disabled={!hasJobs}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              hasJobs ? 'text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Share2 size={15} />
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={handleExport}
            disabled={!hasJobs}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              hasJobs ? 'text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Download size={15} />
            Export CSV
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={handleDeleteClick}
            disabled={deleting}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 size={15} />
            {deleting ? 'Deleting...' : 'Delete Session'}
          </button>
        </div>
      )}
      {deleteError && (
        <p className="absolute top-full right-0 mt-1 text-xs whitespace-nowrap text-red-500">
          {deleteError}
        </p>
      )}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Session"
        message={`Delete session ${code}? This will permanently remove the session and all its jobs.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        destructive
      />
    </div>
  );
}

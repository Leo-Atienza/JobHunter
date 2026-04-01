'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SERVER_SCRAPER_NAMES } from '@/lib/scrapers';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ActionsMenuProps {
  code: string;
  hasJobs: boolean;
  jobCount: number;
  onRescanStart: () => void;
  onRescanComplete: () => void;
}

export function ActionsMenu({ code, hasJobs, jobCount, onRescanStart, onRescanComplete }: ActionsMenuProps) {
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
      } catch { /* silent */ }
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
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
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
      } catch { /* localStorage unavailable */ }
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-fade-in z-50">
          <button
            onClick={handleRescan}
            disabled={scanning}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              scanning ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={scanning ? 'animate-spin' : ''}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {scanning ? `Scanning ${scanDone}/${scanTotal}...` : 'Rescan'}
          </button>
          <button
            onClick={handleShare}
            disabled={!hasJobs}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              hasJobs ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={handleExport}
            disabled={!hasJobs}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
              hasJobs ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={handleDeleteClick}
            disabled={deleting}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {deleting ? 'Deleting...' : 'Delete Session'}
          </button>
        </div>
      )}
      {deleteError && (
        <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-red-500">{deleteError}</p>
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

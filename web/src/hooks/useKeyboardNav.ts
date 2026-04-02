'use client';

import { useEffect, useCallback, useState } from 'react';
import type { Job } from '@/lib/types';

interface UseKeyboardNavOptions {
  jobs: Job[];
  selectedJobId: number | null;
  isModalOpen: boolean;
  onSelectJob: (id: number | null) => void;
  onOpenModal: (id: number) => void;
  onCloseModal: () => void;
  onToggleSave?: (jobId: number) => void;
}

export function useKeyboardNav({
  jobs,
  selectedJobId,
  isModalOpen,
  onSelectJob,
  onOpenModal,
  onCloseModal,
  onToggleSave,
}: UseKeyboardNavOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Sync focused index when selectedJobId changes externally
  useEffect(() => {
    if (selectedJobId === null) return;
    const idx = jobs.findIndex((j) => j.id === selectedJobId);
    if (idx !== -1) setFocusedIndex(idx);
  }, [selectedJobId, jobs]);

  const focusedJobId = focusedIndex >= 0 && focusedIndex < jobs.length
    ? jobs[focusedIndex].id
    : null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
          break;

        case 'Escape':
          e.preventDefault();
          if (showShortcuts) {
            setShowShortcuts(false);
          } else if (isModalOpen) {
            onCloseModal();
          } else if (focusedIndex >= 0) {
            setFocusedIndex(-1);
            onSelectJob(null);
          }
          break;

        case 'j':
        case 'ArrowDown':
          if (isModalOpen) return;
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, jobs.length - 1);
            onSelectJob(jobs[next]?.id ?? null);
            return next;
          });
          break;

        case 'k':
        case 'ArrowUp':
          if (isModalOpen) return;
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            onSelectJob(jobs[next]?.id ?? null);
            return next;
          });
          break;

        case 'o':
        case 'Enter':
          if (isModalOpen) return;
          if (focusedJobId !== null) {
            e.preventDefault();
            onOpenModal(focusedJobId);
          }
          break;

        case 's':
          if (isModalOpen) return;
          if (focusedJobId !== null && onToggleSave) {
            e.preventDefault();
            onToggleSave(focusedJobId);
          }
          break;
      }
    },
    [jobs, focusedIndex, focusedJobId, isModalOpen, showShortcuts, onSelectJob, onOpenModal, onCloseModal, onToggleSave],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    focusedJobId,
    focusedIndex,
    showShortcuts,
    setShowShortcuts,
  };
}

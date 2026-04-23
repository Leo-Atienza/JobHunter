'use client';

import { useRef, useState, useEffect } from 'react';
import type { Job } from '@/lib/types';
import { JobCard } from './JobCard';

interface LazyJobCardProps {
  job: Job;
  onUpdate: () => void;
  onJobClick?: (jobId: number) => void;
  sessionCode: string;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  animationIndex?: number;
}

/**
 * Lazy-loads a JobCard using IntersectionObserver.
 * Shows a lightweight placeholder until the card scrolls into view.
 */
export function LazyJobCard({
  job,
  onUpdate,
  onJobClick,
  sessionCode,
  isFocused,
  isSelected,
  onToggleSelect,
  animationIndex,
}: LazyJobCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }, // pre-load 200px before viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!visible) {
    return (
      <div ref={ref} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
    );
  }

  const delay = animationIndex !== undefined ? Math.min(animationIndex * 40, 400) : 0;

  return (
    <div
      ref={ref}
      style={delay > 0 ? { animation: `slide-in-up 0.3s ease-out ${delay}ms both` } : undefined}
    >
      <JobCard
        job={job}
        onUpdate={onUpdate}
        onJobClick={onJobClick}
        sessionCode={sessionCode}
        isFocused={isFocused}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
}

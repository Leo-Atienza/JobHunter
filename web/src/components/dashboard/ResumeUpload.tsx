'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import type { ResumeProfile } from '@/lib/types';

interface ResumeUploadProps {
  sessionCode: string;
  onScored: () => void;
  isSignedIn: boolean;
  sessionResumeProfile?: ResumeProfile | null;
}

interface ResumeResponse {
  profile: ResumeProfile | null;
  filename: string | null;
  updated_at: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type UploadState = 'idle' | 'extracting' | 'analyzing' | 'scoring' | 'done' | 'error';

export function ResumeUpload({ sessionCode, onScored, isSignedIn, sessionResumeProfile }: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastScoredCount, setLastScoredCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch user-level resume data if signed in
  const { data: resumeData, mutate: mutateResume } = useSWR<ResumeResponse>(
    isSignedIn ? '/api/user/resume' : null,
    fetcher,
  );

  // Use session-level resume as fallback
  const activeProfile = resumeData?.profile ?? sessionResumeProfile ?? null;
  const hasResume = activeProfile !== null;

  // Reset to done state when we have resume data
  useEffect(() => {
    if (hasResume && state === 'idle') {
      setState('done');
    }
  }, [hasResume, state]);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setState('extracting');

      try {
        // Client-side PDF text extraction
        const { extractTextFromPdf } = await import('@/lib/pdf-extract');
        const text = await extractTextFromPdf(file);

        setState('analyzing');

        // Send text to server for Gemini extraction + scoring
        const res = await fetch('/api/user/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            session_code: sessionCode,
            filename: file.name,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to process resume');
        }

        const data = await res.json();
        setLastScoredCount(data.jobs_scored);
        setState('done');
        if (isSignedIn) await mutateResume();
        onScored();
      } catch (err) {
        setState('error');
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    },
    [sessionCode, onScored, mutateResume, isSignedIn],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    },
    [processFile],
  );

  const handleRemove = useCallback(async () => {
    try {
      await fetch(`/api/user/resume?session=${sessionCode}`, { method: 'DELETE' });
      setState('idle');
      setLastScoredCount(null);
      if (isSignedIn) await mutateResume();
      onScored();
    } catch {
      setError('Failed to remove resume');
    }
  }, [sessionCode, mutateResume, onScored, isSignedIn]);

  // Processing states
  if (state === 'extracting' || state === 'analyzing' || state === 'scoring') {
    const messages: Record<string, string> = {
      extracting: 'Extracting text from PDF...',
      analyzing: 'AI is analyzing your skills...',
      scoring: 'Scoring jobs against your profile...',
    };

    return (
      <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm font-medium text-primary-700">{messages[state]}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-500">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">Upload failed</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setState('idle');
              setError(null);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Complete state — resume available, show skills
  if (state === 'done' && hasResume && activeProfile) {
    const filename = resumeData?.filename ?? 'Resume uploaded';
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {filename}
                </p>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {activeProfile.skills.length} skills
                </span>
                {lastScoredCount !== null && (
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {lastScoredCount} jobs scored
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {activeProfile.skills.slice(0, 8).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200"
                  >
                    {skill}
                  </span>
                ))}
                {activeProfile.skills.length > 8 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    +{activeProfile.skills.length - 8} more
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Re-upload
            </button>
            <button
              onClick={handleRemove}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  // Default: dropzone (available to all users, no auth required)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition-colors ${
        dragOver
          ? 'border-primary-400 bg-primary-50/50'
          : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
          <Upload size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">
            Upload your resume for personalized match scores
          </p>
          <p className="text-xs text-slate-400">
            Drop a PDF here or click to browse. Parsed in your browser — never uploaded.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

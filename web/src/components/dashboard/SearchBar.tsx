'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Clock, Trash2 } from 'lucide-react';

const HISTORY_KEY = 'jobhunter_search_history';
const MAX_HISTORY = 10;

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [history, setHistory] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Hydrate history on mount (SSR-safe, matches SavedJobsClient pattern)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (Array.isArray(stored)) {
        setHistory(stored.filter((s): s is string => typeof s === 'string').slice(0, MAX_HISTORY));
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function persistHistory(next: string[]) {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable — ignore
    }
  }

  function pushHistory(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const filtered = history.filter((h) => h.toLowerCase() !== key);
    persistHistory([trimmed, ...filtered].slice(0, MAX_HISTORY));
  }

  function removeHistoryItem(q: string) {
    persistHistory(history.filter((h) => h !== q));
  }

  function clearHistory() {
    persistHistory([]);
  }

  function commitNow(v: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(v);
  }

  function handleChange(newValue: string) {
    setLocalValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, 250);
  }

  function handleClear() {
    setLocalValue('');
    commitNow('');
    setIsOpen(false);
  }

  function selectHistory(q: string) {
    setLocalValue(q);
    commitNow(q);
    pushHistory(q); // bump to top of recency list
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  // Dropdown shows only when focused with empty input and saved history exists
  const showDropdown = isOpen && localValue === '' && history.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
      return;
    }
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => (i < history.length - 1 ? i + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => (i > 0 ? i - 1 : history.length - 1));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        selectHistory(history[highlightIndex]);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = localValue.trim();
      if (v) {
        pushHistory(v);
        commitNow(v);
      }
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full sm:w-72">
      <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search jobs… (use OR for multiple)"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="focus:border-primary-400 focus:ring-primary-100 w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none focus:ring-2"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}

      {showDropdown && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <li className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Clock size={10} /> Recent searches
          </li>
          {history.map((q, i) => (
            <li
              key={q}
              onMouseDown={(e) => {
                e.preventDefault();
                selectHistory(q);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                i === highlightIndex
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{q}</span>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeHistoryItem(q);
                }}
                className="ml-2 rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-600"
                aria-label={`Remove ${q} from history`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-100 pt-1">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                clearHistory();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <Trash2 size={12} /> Clear history
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

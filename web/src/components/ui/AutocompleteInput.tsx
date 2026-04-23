'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AutocompleteInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  label: string;
  required?: boolean;
  hint?: string;
  multiValue?: boolean;
}

export function AutocompleteInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  required,
  hint,
  multiValue = false,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get the active segment (after last comma for multiValue, or full value)
  const getActiveSegment = useCallback((): string => {
    if (!multiValue) return value;
    const parts = value.split(',');
    return (parts[parts.length - 1] ?? '').trimStart();
  }, [value, multiValue]);

  // Filter suggestions against active segment
  const filtered = (() => {
    const segment = getActiveSegment().toLowerCase();
    if (!segment) return [];
    return suggestions
      .filter((s) => {
        const sLower = s.toLowerCase();
        // Don't suggest items already selected in multi-value
        if (multiValue) {
          const existing = value
            .split(',')
            .slice(0, -1)
            .map((p) => p.trim().toLowerCase());
          if (existing.includes(sLower)) return false;
        }
        return sLower.includes(segment) && sLower !== segment;
      })
      .slice(0, 8);
  })();

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  function selectSuggestion(suggestion: string) {
    if (multiValue) {
      const parts = value.split(',').slice(0, -1);
      parts.push(` ${suggestion}`);
      onChange(parts.join(',') + ', ');
    } else {
      onChange(suggestion);
    }
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(filtered[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-error-500"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightIndex(-1);
        }}
        onFocus={() => {
          if (getActiveSegment().length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="focus:border-primary-500 focus:ring-primary-500/20 mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((suggestion, i) => (
            <li
              key={suggestion}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlightIndex
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

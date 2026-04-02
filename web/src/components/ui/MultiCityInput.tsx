'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface MultiCityInputProps {
  cities: string[];
  onChange: (cities: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  label: string;
  maxCities?: number;
}

export function MultiCityInput({
  cities,
  onChange,
  suggestions,
  placeholder = 'e.g. Toronto, Canada',
  label,
  maxCities = 5,
}: MultiCityInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter suggestions: exclude already-selected, match input
  const filtered = (() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return [];
    const selectedSet = new Set(cities.map((c) => c.toLowerCase()));
    return suggestions
      .filter((s) => {
        const sLower = s.toLowerCase();
        return !selectedSet.has(sLower) && sLower.includes(q) && sLower !== q;
      })
      .slice(0, 8);
  })();

  // Close dropdown on outside click
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

  const addCity = useCallback(
    (city: string) => {
      const trimmed = city.trim();
      if (!trimmed) return;
      if (cities.length >= maxCities) {
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
        return;
      }
      // Don't add duplicates (case-insensitive)
      if (cities.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
      onChange([...cities, trimmed]);
      setInputValue('');
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [cities, maxCities, onChange],
  );

  const removeCity = useCallback(
    (index: number) => {
      setRemovingIndex(index);
      // Wait for exit animation before removing
      setTimeout(() => {
        onChange(cities.filter((_, i) => i !== index));
        setRemovingIndex(null);
      }, 150);
    },
    [cities, onChange],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && inputValue === '' && cities.length > 0) {
      e.preventDefault();
      removeCity(cities.length - 1);
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (isOpen && highlightIndex >= 0 && filtered.length > 0) {
        e.preventDefault();
        addCity(filtered[highlightIndex]);
        return;
      }
      if (inputValue.trim()) {
        e.preventDefault();
        addCity(inputValue);
        return;
      }
    }

    // Comma commits current value
    if (e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) addCity(inputValue);
      return;
    }

    if (!isOpen || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {/* Container mimics an input field */}
      <div
        className={`mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 transition-all cursor-text ${
          shaking ? 'border-error-500 ring-2 ring-error-500/20' : ''
        } ${
          focused
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        style={shaking ? { animation: 'input-shake 350ms linear' } : undefined}
        onClick={() => inputRef.current?.focus()}
      >
        {/* City chips */}
        {cities.map((city, i) => (
          <span
            key={city}
            className={`inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800 transition-all ${
              removingIndex === i
                ? 'opacity-0 scale-75'
                : ''
            }`}
            style={
              removingIndex === i
                ? { animation: 'chip-out 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards' }
                : { animation: 'chip-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }
            }
          >
            {city}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCity(i);
              }}
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-primary-600 transition-all hover:bg-primary-200 active:scale-90"
              aria-label={`Remove ${city}`}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            setFocused(true);
            if (inputValue.trim().length > 0) setIsOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={cities.length === 0 ? placeholder : cities.length >= maxCities ? `Max ${maxCities} cities` : 'Add city...'}
          autoComplete="off"
          disabled={cities.length >= maxCities}
          className="min-w-[120px] flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400"
        />
      </div>

      <p className="mt-1 text-xs text-slate-400">
        {cities.length > 0
          ? `${cities.length}/${maxCities} cities \u00b7 Press Enter or comma to add`
          : 'Type a city name and press Enter to add'}
      </p>

      {/* Autocomplete dropdown */}
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
                addCity(suggestion);
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

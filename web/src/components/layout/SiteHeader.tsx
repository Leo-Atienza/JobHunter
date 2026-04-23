'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Menu, X } from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';

interface SiteHeaderProps {
  /** 'fixed' for landing, 'sticky' for app pages */
  position?: 'fixed' | 'sticky';
  /** Content rendered after the logo (e.g., session code pill, tracker pill) */
  left?: React.ReactNode;
  /** Content rendered before UserMenu (e.g., nav links, action buttons) */
  right?: React.ReactNode;
  /** Links shown in the mobile hamburger drawer (landing only) */
  mobileLinks?: React.ReactNode;
}

export function SiteHeader({ position = 'sticky', left, right, mobileLinks }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={`${position === 'fixed' ? 'fixed' : 'sticky'} top-0 right-0 left-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + leftContent */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="bg-primary-950 flex h-8 w-8 items-center justify-center rounded-lg">
              <Search size={16} strokeWidth={2.5} className="text-accent-400" />
            </div>
            <span className="font-display text-primary-950 hidden text-lg font-bold sm:inline">
              JobHunter
            </span>
          </Link>
          {left}
        </div>

        {/* Right: rightContent + UserMenu */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {right}
          <div className="ml-1 border-l border-slate-200 pl-2">
            <UserMenu />
          </div>

          {/* Mobile hamburger (only when mobileLinks provided) */}
          {mobileLinks && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 sm:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileLinks && mobileOpen && (
        <div className="animate-slide-down border-t border-slate-100 bg-white px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-2" onClick={() => setMobileOpen(false)}>
            {mobileLinks}
          </nav>
        </div>
      )}
    </header>
  );
}

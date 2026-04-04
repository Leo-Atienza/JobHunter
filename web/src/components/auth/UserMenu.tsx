'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, ChevronDown, Home, BarChart3, LogOut } from 'lucide-react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />;
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn('google')}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
      >
        <LogIn size={14} />
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 transition-all hover:bg-slate-50 hover:border-slate-300"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-6 w-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
            {session.user.name?.[0] ?? '?'}
          </div>
        )}
        <span className="hidden sm:inline text-sm font-medium text-slate-700 max-w-24 truncate">
          {session.user.name?.split(' ')[0]}
        </span>
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg shadow-slate-200/50 animate-slide-up">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">{session.user.name}</p>
            <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home size={14} />
            My Sessions
          </Link>
          <Link
            href="/saved"
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <BarChart3 size={14} />
            Tracker
          </Link>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

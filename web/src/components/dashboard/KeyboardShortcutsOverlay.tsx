'use client';

const shortcuts = [
  { key: 'j / \u2193', description: 'Next job' },
  { key: 'k / \u2191', description: 'Previous job' },
  { key: 'o / Enter', description: 'Open job detail' },
  { key: 's', description: 'Save / unsave job' },
  { key: 'Esc', description: 'Close modal / deselect' },
  { key: '?', description: 'Toggle this overlay' },
];

interface KeyboardShortcutsOverlayProps {
  onClose: () => void;
}

export function KeyboardShortcutsOverlay({ onClose }: KeyboardShortcutsOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        style={{ animation: 'slide-in-up 0.25s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-primary-950">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600">{s.description}</span>
              <kbd className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-slate-400">
          Shortcuts are disabled when typing in an input field
        </p>
      </div>
    </div>
  );
}

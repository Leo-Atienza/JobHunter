/**
 * Dashboard loading skeleton. Mirrors the three main visual regions of
 * DashboardClient — sticky header bar, stats row, and the job results table —
 * so the layout does not shift when real content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="h-5 w-32 rounded-lg bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stats bar skeleton — 5 cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="mt-3 h-7 w-12 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>

        {/* Filter / search bar skeleton */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full max-w-sm rounded-xl bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-xl bg-slate-200" />
            <div className="h-9 w-24 rounded-xl bg-slate-200" />
          </div>
        </div>

        {/* Table row skeletons */}
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex h-16 items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 shadow-sm"
            >
              <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/5 rounded bg-slate-200" />
                <div className="h-3 w-1/4 rounded bg-slate-100" />
              </div>
              <div className="hidden h-4 w-20 rounded bg-slate-100 sm:block" />
              <div className="h-6 w-16 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

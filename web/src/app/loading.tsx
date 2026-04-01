/**
 * Root loading skeleton shown while the landing page (or any root-level route)
 * is suspended. Mirrors the rough visual weight of the page so the transition
 * feels instantaneous.
 */
export default function GlobalLoading() {
  return (
    <main className="min-h-screen animate-pulse">
      {/* Nav skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="h-7 w-36 rounded-lg bg-slate-200" />
          <div className="h-8 w-24 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Hero skeleton */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-20">
        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="mx-auto h-5 w-40 rounded-full bg-slate-200" />
          <div className="mt-6 space-y-3">
            <div className="mx-auto h-12 w-3/4 rounded-xl bg-slate-200" />
            <div className="mx-auto h-12 w-1/2 rounded-xl bg-slate-200" />
          </div>
          <div className="mt-6 space-y-2">
            <div className="mx-auto h-5 w-2/3 rounded-lg bg-slate-100" />
            <div className="mx-auto h-5 w-1/2 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="h-12 w-48 rounded-xl bg-slate-200" />
            <div className="h-12 w-36 rounded-xl bg-slate-100" />
          </div>
        </div>

        {/* Feature cards skeleton */}
        <div className="mt-20 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
              <div className="mt-4 h-5 w-3/4 rounded-lg bg-slate-200" />
              <div className="mt-2 space-y-1.5">
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

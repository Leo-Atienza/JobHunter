const steps = [
  {
    number: '01',
    title: 'Get Your Code',
    description:
      'Generate a unique session code with one click. No sign-up, no email, no hassle. Your code is your key to a 48-hour mission control session.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Run the Scraper',
    description:
      'Run the open-source scraper on your own machine. Your IP, your searches, your privacy. Supports LinkedIn, Indeed, Glassdoor, RapidAPI (JSearch + fallbacks), JobBank, Remotive, Adzuna, Himalayas, The Muse, Arbeitnow, Lever, Greenhouse, and Workday.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'View Your Results',
    description:
      'Jobs appear in your dashboard in real-time. Filter by source, track application status, add notes, and export to CSV — all from one unified command center.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-slate-100 bg-slate-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-primary-950 sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Three steps. Zero complexity.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:shadow-primary-950/5 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4">
                <span className="font-display text-4xl font-extrabold text-accent-500/30">
                  {step.number}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                  {step.icon}
                </div>
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-primary-950">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

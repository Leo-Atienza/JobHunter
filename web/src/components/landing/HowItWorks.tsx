import { Wand2, Terminal, LayoutGrid } from 'lucide-react';
import { JOB_SOURCES } from '@/lib/types';

const SOURCE_COUNT = JOB_SOURCES.length;

const steps = [
  {
    number: '01',
    title: 'Get Your Code',
    description:
      'Generate a unique session code with one click. No sign-up, no email, no hassle. Your code is your key to a 48-hour mission control session.',
    icon: <Wand2 size={28} strokeWidth={1.5} />,
  },
  {
    number: '02',
    title: 'Run the Scraper',
    description: `Scrapers run server-side — just click Search and results appear. Supports Job Bank (Canada), LinkedIn, Remotive, Adzuna, Himalayas, Lever, Greenhouse, Ashby (OpenAI, Cohere, Notion, Linear), Jooble, Jobicy, DevITjobs, Firecrawl, RemoteOK, and We Work Remotely — ${SOURCE_COUNT} sources.`,
    icon: <Terminal size={28} strokeWidth={1.5} />,
  },
  {
    number: '03',
    title: 'View Your Results',
    description:
      'Jobs appear in your dashboard in real-time. Filter by source, track application status, add notes, and export to CSV — all from one unified command center.',
    icon: <LayoutGrid size={28} strokeWidth={1.5} />,
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-slate-100 bg-slate-50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-display text-primary-950 text-3xl font-extrabold sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-slate-500">Three steps. Zero complexity.</p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, idx) => (
            <div
              key={step.number}
              className={`group hover:shadow-primary-950/5 animate-fade-in relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg stagger-${idx + 1}`}
            >
              {/* Connector line to next card (hidden on last card and mobile) */}
              {idx < steps.length - 1 && (
                <div
                  className="pointer-events-none absolute top-1/2 -right-4 hidden -translate-y-1/2 items-center md:flex"
                  aria-hidden="true"
                >
                  <div className="h-px w-8 bg-gradient-to-r from-slate-300 to-transparent" />
                  <div className="ml-0.5 h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-slate-300" />
                </div>
              )}
              <div className="flex items-center gap-4">
                <span className="font-display text-accent-500/30 text-4xl font-extrabold">
                  {step.number}
                </span>
                <div className="bg-primary-50 text-primary-700 group-hover:bg-primary-100 flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                  {step.icon}
                </div>
              </div>
              <h3 className="font-display text-primary-950 mt-6 text-xl font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

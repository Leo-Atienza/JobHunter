'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';

type Tab = 'python' | 'docker';

interface Step {
  label: string;
  code: string;
  note?: string;
}

const pythonSteps = [
  {
    label: 'Install the scraper',
    code: 'pip install jobhunter-scraper',
    note: 'Requires Python 3.9+. Download from python.org if you don\'t have it.',
  },
  {
    label: 'Install the browser engine',
    code: 'python -m playwright install chromium',
    note: 'This downloads a small browser used to scrape LinkedIn, Indeed, and Glassdoor.',
  },
  {
    label: 'Run the scraper with your session code',
    code: 'python -m scrape --session YOUR_CODE --keywords "software engineer" --location "New York"',
    note: 'Replace YOUR_CODE with the session code you generated above. Results appear on your dashboard automatically.',
  },
];

const dockerSteps = [
  {
    label: 'Download the scraper',
    code: 'git clone https://github.com/Leo-Atienza/JobHunter.git\ncd JobHunter/scraper',
    note: 'Don\'t have Git? Click "Code" → "Download ZIP" on GitHub and extract the scraper folder.',
  },
  {
    label: 'Create your config file',
    code: 'cp config.example.yaml config.yaml',
    note: 'Open config.yaml in any text editor and replace JH-XXXX with your session code.',
  },
  {
    label: 'Run with Docker Compose',
    code: 'docker compose run scraper',
    note: 'Requires Docker Desktop — download free from docker.com.',
  },
];

export function SetupInstructions() {
  const [activeTab, setActiveTab] = useState<Tab>('python');

  const steps: Step[] = activeTab === 'python' ? pythonSteps : dockerSteps;

  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-primary-950 sm:text-4xl">
            Quick Setup
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Get up and running in under a minute.
          </p>
        </div>

        <div className="mt-12">
          {/* Tab buttons */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 max-w-xs mx-auto">
            <button
              onClick={() => setActiveTab('python')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === 'python'
                  ? 'bg-white text-primary-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                Python
              </span>
            </button>
            <button
              onClick={() => setActiveTab('docker')}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === 'docker'
                  ? 'bg-white text-primary-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M12 12h.01" />
                </svg>
                Docker
              </span>
            </button>
          </div>

          {/* Code blocks */}
          <div className="mt-8 space-y-4">
            {steps.map((step, i) => (
              <div key={`${activeTab}-${i}`} className="animate-fade-in">
                <p className="mb-2 text-sm font-medium text-slate-600">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-700 mr-2">
                    {i + 1}
                  </span>
                  {step.label}
                </p>
                <div className="group relative rounded-xl bg-slate-900 p-4 overflow-x-auto">
                  <pre className="text-sm leading-relaxed text-slate-300 font-mono">
                    <code>{step.code}</code>
                  </pre>
                  <div className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <CopyButton text={step.code} variant="dark" />
                  </div>
                </div>
                {step.note && (
                  <p className="mt-1.5 text-xs text-slate-400 pl-7">
                    {step.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-accent-200 bg-accent-50 p-4">
            <div className="flex gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="text-sm text-accent-800">
                <span className="font-semibold">Why local?</span> Running the scraper on your machine means your
                searches come from your IP. No shared infrastructure, no bans, full privacy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Is this free?',
    answer:
      'Yes, completely free and open source. The web dashboard is hosted on Vercel and the scraper runs on your own machine. No hidden costs, no premium tiers.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Sessions automatically expire after 48 hours and all associated job data is permanently deleted. We only store job listing metadata (titles, URLs, companies) — never any personal information.',
  },
  {
    question: 'Why do I run the scraper locally?',
    answer:
      'Running the scraper on your own machine means job board requests come from your IP address. This avoids rate limiting and bans that would happen if everyone shared the same server. It also means your search queries stay completely private.',
  },
  {
    question: 'Which job boards are supported?',
    answer:
      'Currently supported: Job Bank (Canada), LinkedIn, Remotive, Adzuna, Himalayas, Lever, Greenhouse, Jooble, Jobicy, DevITjobs, and Firecrawl web search. More sources are being added — check the GitHub repo for the latest list.',
  },
  {
    question: 'Can I self-host the entire platform?',
    answer:
      'Absolutely. The web app is a standard Next.js application that can be deployed to any platform. You just need a PostgreSQL database (we recommend Neon for serverless). Full self-hosting instructions are in the GitHub repository.',
  },
];

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-primary-700"
      >
        <span className="pr-4 font-display text-lg font-semibold text-primary-950">
          {item.question}
        </span>
        <span
          className={`shrink-0 rounded-full bg-slate-100 p-1 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-sm leading-relaxed text-slate-500">{item.answer}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="border-t border-slate-100 bg-slate-50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-primary-950 sm:text-4xl">
            Questions? Answered.
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Everything you need to know about JobHunter.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white px-8">
          {faqItems.map((item) => (
            <FAQAccordionItem key={item.question} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

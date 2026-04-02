import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/globals.css';
import { SessionProvider } from '@/components/auth/SessionProvider';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://jobhunter.vercel.app',
  ),
  title: 'JobHunter — Your Job Search Command Center',
  description:
    'Aggregate job listings from Job Bank, LinkedIn, Remotive, and more into one unified dashboard. AI-powered summaries, smart deduplication, and advanced filters.',
  keywords: ['job search', 'job scraper', 'job aggregator', 'career', 'employment'],
  manifest: '/site.webmanifest',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'JobHunter — Your Job Search Command Center',
    description:
      'Aggregate job listings from multiple boards into one unified dashboard.',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobHunter — Your Job Search Command Center',
    description:
      'Aggregate job listings from multiple boards into one unified dashboard.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen bg-white antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-primary-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

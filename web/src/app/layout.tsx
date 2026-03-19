import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/globals.css';

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
  title: 'JobHunter — Your Job Search Command Center',
  description:
    'Aggregate job listings from LinkedIn, Indeed, Glassdoor, and more into one unified dashboard. Run the scraper locally, view results in the cloud.',
  keywords: ['job search', 'job scraper', 'job aggregator', 'career', 'employment'],
  openGraph: {
    title: 'JobHunter — Your Job Search Command Center',
    description:
      'Aggregate job listings from multiple boards into one unified dashboard.',
    type: 'website',
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
        {children}
      </body>
    </html>
  );
}

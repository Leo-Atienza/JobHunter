import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { tryHeuristicUrls, discoverViaFirecrawl } from '@/lib/career-discovery';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { company?: string };
    const company = body.company?.trim();

    if (!company || company.length < 2 || company.length > 100) {
      return NextResponse.json({ error: 'Company name must be 2-100 characters' }, { status: 400 });
    }

    // Rate limit: 10 discoveries per hour per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const allowed = await checkRateLimit(`career-discovery:${ip}`, 10, 3600000);
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
    }

    // 1. Try heuristic URL patterns first (free)
    const heuristicUrl = await tryHeuristicUrls(company);
    if (heuristicUrl) {
      return NextResponse.json({ url: heuristicUrl, source: 'heuristic' });
    }

    // 2. Fall back to Firecrawl search (costs credits)
    const firecrawlUrl = await discoverViaFirecrawl(company);
    if (firecrawlUrl) {
      return NextResponse.json({ url: firecrawlUrl, source: 'firecrawl' });
    }

    return NextResponse.json({ url: null, source: null });
  } catch (err) {
    console.error('Career discovery error:', err);
    return NextResponse.json({ error: 'Failed to discover career page' }, { status: 500 });
  }
}

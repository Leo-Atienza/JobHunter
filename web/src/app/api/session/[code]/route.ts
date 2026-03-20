import { NextRequest, NextResponse } from 'next/server';
import { isValidCodeFormat, getSession } from '@/lib/session';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!isValidCodeFormat(code)) {
      return NextResponse.json(
        { error: 'Invalid session code format' },
        { status: 400 }
      );
    }

    const session = await getSession(code);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    // Include API keys from server env vars so the scraper can use them
    const apiKeys: Record<string, string> = {};
    if (process.env.ADZUNA_APP_ID) apiKeys.adzuna_app_id = process.env.ADZUNA_APP_ID;
    if (process.env.ADZUNA_API_KEY) apiKeys.adzuna_api_key = process.env.ADZUNA_API_KEY;

    return NextResponse.json({
      code: session.code,
      expires_at: session.expires_at,
      keywords: session.keywords,
      location: session.location,
      sources: session.sources,
      remote: session.remote,
      companies: session.companies,
      country: session.country,
      ...(Object.keys(apiKeys).length > 0 && { api_keys: apiKeys }),
    });
  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

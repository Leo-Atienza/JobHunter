import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import type { CreateSessionRequest } from '@/lib/types';
import { JOB_SOURCES } from '@/lib/types';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests = 10, windowMs = 3600000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Max 10 sessions per hour.' },
        { status: 429 }
      );
    }

    // Parse optional preferences from request body
    let body: CreateSessionRequest = {};
    try {
      body = (await request.json()) as CreateSessionRequest;
    } catch {
      // Empty body is fine — preferences are optional
    }

    // Sanitize preferences
    const keywords = body.keywords?.length
      ? body.keywords.slice(0, 10).map((k) => sanitize(k, 100))
      : null;
    const location = body.location ? sanitize(body.location, 255) : null;
    const sources = body.sources?.length
      ? body.sources.filter((s) => (JOB_SOURCES as readonly string[]).includes(s))
      : null;
    const remote = body.remote === true;
    const companies = body.companies?.length
      ? body.companies.slice(0, 20).map((c) => sanitize(c, 100))
      : null;
    const country = body.country ? sanitize(body.country, 10) : null;

    const sql = getDb();
    let inserted = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!inserted && attempts < maxAttempts) {
      const code = generateCode();
      attempts++;
      try {
        const result = await sql(
          `INSERT INTO sessions (code, keywords, location, sources, remote, companies, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING code, expires_at`,
          [code, keywords, location, sources, remote, companies, country]
        );
        if (result.length > 0) {
          inserted = true;
          return NextResponse.json(
            { code: result[0].code, expires_at: result[0].expires_at },
            { status: 201 }
          );
        }
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === '23505') {
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate unique session code. Please try again.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

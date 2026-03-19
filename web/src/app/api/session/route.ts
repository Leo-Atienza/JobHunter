import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/session';

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

    const sql = getDb();
    let code: string = '';
    let inserted = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!inserted && attempts < maxAttempts) {
      code = generateCode();
      attempts++;
      try {
        const result = await sql(
          'INSERT INTO sessions (code) VALUES ($1) RETURNING code, expires_at',
          [code]
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
          // Unique violation — collision, retry
          continue;
        }
        throw err;
      }
    }

    if (!inserted) {
      return NextResponse.json(
        { error: 'Failed to generate unique session code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

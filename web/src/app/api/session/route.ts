import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { generateCode } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import type { CreateSessionRequest } from '@/lib/types';
import { JOB_SOURCES } from '@/lib/types';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { inferCountryFromLocation } from '@/lib/country-filter';

export async function POST(request: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';

    if (!(await checkRateLimit(`session:${ip}`, 10, 3600000))) {
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
    let country: string | null = null;
    try {
      country = body.country
        ? sanitize(body.country, 10)
        : (location ? inferCountryFromLocation(location) : null);
    } catch (e) {
      console.error('Country inference failed:', e);
    }
    const dreamJob = body.dream_job ? sanitize(body.dream_job, 2000) : null;
    const firecrawlUrls = body.firecrawl_urls?.length
      ? body.firecrawl_urls
          .slice(0, 10)
          .map((u) => sanitize(u, 2000))
          .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
      : null;

    // Check if user is authenticated — attach user_id for persistent sessions
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch (e) {
      console.error('Auth check failed (non-fatal):', e instanceof Error ? e.message : e);
    }

    let inserted = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!inserted && attempts < maxAttempts) {
      const code = generateCode();
      attempts++;
      try {
        // Logged-in users get no expiry (set far future); anonymous get 48h
        const expiryExpr = userId
          ? "NOW() + INTERVAL '10 years'"
          : "NOW() + INTERVAL '48 hours'";
        const result = await pool.query(
          `INSERT INTO sessions (code, dream_job, keywords, location, sources, remote, companies, country, user_id, firecrawl_urls, expires_at)
           VALUES ($1, $2, $3::TEXT[], $4, $5::TEXT[], $6::BOOLEAN, $7::TEXT[], $8, $9, $10::TEXT[], ${expiryExpr})
           RETURNING code, expires_at`,
          [code, dreamJob, keywords, location, sources, remote, companies, country, userId, firecrawlUrls]
        );
        if (result.rows.length > 0) {
          inserted = true;
          return NextResponse.json(
            { code: result.rows[0].code, expires_at: result.rows[0].expires_at },
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
    const errMsg = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : String(error);
    console.error('Session creation error:', errMsg);
    return NextResponse.json(
      { error: 'Internal server error', _dbg: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

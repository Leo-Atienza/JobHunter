import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/session';
import { sanitize } from '@/lib/utils';
import type { CreateSessionRequest, ResumeProfile } from '@/lib/types';
import { JOB_SOURCES } from '@/lib/types';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { inferCountryFromLocation } from '@/lib/country-filter';
import { extractResumeSkills } from '@/lib/resume-extract';

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';

    if (!(await checkRateLimit(`session:${ip}`, 10, 3600000))) {
      return NextResponse.json(
        { error: 'Too many requests. Max 10 sessions per hour.' },
        { status: 429 },
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
    // Multi-city: prefer locations array, fall back to single location
    const rawLocations = body.locations?.length
      ? body.locations.slice(0, 5).map((l) => sanitize(l, 255))
      : body.location
        ? [sanitize(body.location, 255)]
        : null;
    const location = rawLocations?.[0] ?? null;
    const locations = rawLocations;
    const sources = body.sources?.length
      ? body.sources.filter((s) => (JOB_SOURCES as readonly string[]).includes(s))
      : null;
    const remote = body.remote === true;
    const includeRemote = body.include_remote !== false;
    const companies = body.companies?.length
      ? body.companies.slice(0, 20).map((c) => sanitize(c, 100))
      : null;
    let country: string | null = null;
    try {
      if (body.country) {
        country = sanitize(body.country, 10);
      } else if (rawLocations?.length) {
        // Infer country per city — if all same country use it, if mixed disable filter
        const perCityCountries = rawLocations
          .map((l) => inferCountryFromLocation(l))
          .filter((c): c is string => c !== null);
        const uniqueCountries = [...new Set(perCityCountries)];
        country = uniqueCountries.length === 1 ? uniqueCountries[0] : null;
      }
    } catch (e) {
      console.error('Country inference failed:', e);
    }

    // Process resume text if provided (extract skills via Gemini)
    const resumeText = body.resume_text?.trim() ?? null;
    let resumeSkills: ResumeProfile | null = null;
    if (resumeText && resumeText.length >= 100) {
      try {
        const profile = await extractResumeSkills(resumeText.slice(0, 8000));
        if (profile.skills.length > 0) resumeSkills = profile;
      } catch (e) {
        // Non-fatal — session is created without resume skills
        console.error('Resume extraction failed (non-fatal):', e instanceof Error ? e.message : e);
      }
    }

    // Check if user is authenticated — attach user_id for persistent sessions
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch (e) {
      console.error('Auth check failed (non-fatal):', e instanceof Error ? e.message : e);
    }

    const sql = getDb();
    let inserted = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!inserted && attempts < maxAttempts) {
      const code = generateCode();
      attempts++;
      try {
        // Logged-in users get no expiry (set far future); anonymous get 48h
        const expiryExpr = userId ? "NOW() + INTERVAL '10 years'" : "NOW() + INTERVAL '48 hours'";
        const result = await sql(
          `INSERT INTO sessions (code, keywords, location, locations, sources, remote, include_remote, companies, country, user_id, resume_skills, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ${expiryExpr})
           RETURNING code, expires_at`,
          [
            code,
            keywords,
            location,
            locations,
            sources,
            remote,
            includeRemote,
            companies,
            country,
            userId,
            resumeSkills ? JSON.stringify(resumeSkills) : null,
          ],
        );
        if (result.length > 0) {
          inserted = true;
          return NextResponse.json(
            { code: result[0].code, expires_at: result[0].expires_at },
            { status: 201 },
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
      { status: 500 },
    );
  } catch (error) {
    console.error('Session creation error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

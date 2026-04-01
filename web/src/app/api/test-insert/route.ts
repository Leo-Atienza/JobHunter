import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { inferCountryFromLocation } from '@/lib/country-filter';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    // Test auth import
    try {
      const session = await auth();
      results.auth = session?.user?.id ?? 'no-user';
    } catch (e) {
      results.auth = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Test rate limit
    try {
      const ok = await checkRateLimit('test:debug', 100, 60000);
      results.rateLimit = ok;
    } catch (e) {
      results.rateLimit = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Test country inference
    try {
      results.countryInfer = inferCountryFromLocation('Toronto, Canada');
    } catch (e) {
      results.countryInfer = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Test INSERT with all the same imports loaded
    const sql = neon(process.env.DATABASE_URL!);
    try {
      const r = await sql(
        `INSERT INTO sessions (code, keywords, location, sources, remote, companies, country, user_id, firecrawl_urls, dream_job, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '1 minute')
         RETURNING code`,
        ['JH-DBG3', ['test'], 'Toronto', ['indeed'], false, null, 'ca', null, null, 'dream text']
      );
      results.insert = r[0]?.code ?? 'no-code';
      await sql('DELETE FROM sessions WHERE code = $1', ['JH-DBG3']);
    } catch (e) {
      results.insert = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

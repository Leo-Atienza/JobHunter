import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Test 1: simple query
    const t1 = await sql('SELECT 1 as ok');

    // Test 2: 9-param INSERT
    let t2result = 'skipped';
    try {
      const r = await sql(
        `INSERT INTO sessions (code, keywords, location, sources, remote, companies, country, user_id, firecrawl_urls, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 minute')
         RETURNING code`,
        ['JH-DBG1', ['test'], 'Toronto', ['indeed'], false, null, 'ca', null, null]
      );
      t2result = JSON.stringify(r);
      await sql('DELETE FROM sessions WHERE code = $1', ['JH-DBG1']);
    } catch (e) {
      t2result = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Test 3: 10-param INSERT
    let t3result = 'skipped';
    try {
      const r = await sql(
        `INSERT INTO sessions (code, keywords, location, sources, remote, companies, country, user_id, firecrawl_urls, dream_job, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '1 minute')
         RETURNING code`,
        ['JH-DBG2', ['test'], 'Toronto', ['indeed'], false, null, 'ca', null, null, 'dream']
      );
      t3result = JSON.stringify(r);
      await sql('DELETE FROM sessions WHERE code = $1', ['JH-DBG2']);
    } catch (e) {
      t3result = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json({
      test1_simple: t1[0]?.ok,
      test2_9params: t2result,
      test3_10params: t3result,
      driver_version: '0.10.4',
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

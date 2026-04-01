import { getDb } from './db';

/**
 * Serverless-safe rate limiting backed by Neon Postgres.
 * Uses upsert to atomically check and increment the counter.
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const sql = getDb();
  const windowSeconds = Math.floor(windowMs / 1000);

  const result = await sql(
    `INSERT INTO rate_limits (key, count, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.window_start + ($3 || ' seconds')::INTERVAL < NOW()
         THEN 1
         ELSE rate_limits.count + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start + ($3 || ' seconds')::INTERVAL < NOW()
         THEN NOW()
         ELSE rate_limits.window_start
       END
     RETURNING count`,
    [key, maxRequests, windowSeconds.toString()]
  );

  return result[0].count <= maxRequests;
}

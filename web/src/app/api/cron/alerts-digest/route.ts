import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isAlertsEnabled, sendDigestEmail, type DigestJob } from '@/lib/email/alerts-digest';

export const maxDuration = 60;

const MAX_JOBS_PER_EMAIL = 10;

interface AlertRow {
  id: number;
  session_code: string;
  unsubscribe_token: string;
  last_sent_at: string | null;
  email: string | null;
  keywords: string[] | null;
  locations: string[] | null;
}

function summarizeSearch(keywords: string[] | null, locations: string[] | null): string {
  const kw = keywords?.filter(Boolean) ?? [];
  const loc = locations?.filter(Boolean) ?? [];
  const kwPart = kw.length > 0 ? kw.slice(0, 3).join(', ') : 'your search';
  const locPart = loc.length > 0 ? ` in ${loc.slice(0, 2).join(', ')}` : '';
  return `${kwPart}${locPart}`;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAlertsEnabled()) {
      return NextResponse.json({ skipped: true, reason: 'disabled' });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://jobhunter.app');

    const sql = getDb();

    // Enabled alerts due for sending (>= 23h since last send, or never sent)
    const alerts = (await sql(
      `SELECT a.id, a.session_code, a.unsubscribe_token, a.last_sent_at,
              u.email, s.keywords, s.locations
       FROM job_alerts a
       JOIN users u ON a.user_id = u.id
       JOIN sessions s ON a.session_code = s.code
       WHERE a.enabled = true
         AND (a.last_sent_at IS NULL OR a.last_sent_at < NOW() - INTERVAL '23 hours')
         AND u.email IS NOT NULL
       LIMIT 100`,
    )) as AlertRow[];

    let emailsSent = 0;
    let noNewJobs = 0;
    const errors: string[] = [];

    for (const alert of alerts) {
      try {
        // Find new jobs scraped since last email (or since alert creation if never sent)
        const sinceClause = alert.last_sent_at
          ? 'scraped_at > $2'
          : "scraped_at > NOW() - INTERVAL '24 hours'";
        const args = alert.last_sent_at
          ? [alert.session_code, alert.last_sent_at]
          : [alert.session_code];

        const newJobs = (await sql(
          `SELECT id, title, company, location, url, relevance_score
           FROM jobs
           WHERE session_code = $1
             AND duplicate_of IS NULL
             AND is_ghost = false
             AND ${sinceClause}
           ORDER BY relevance_score DESC, scraped_at DESC
           LIMIT ${MAX_JOBS_PER_EMAIL}`,
          args,
        )) as DigestJob[];

        if (newJobs.length === 0) {
          noNewJobs++;
          // Still bump last_sent_at so we don't re-scan the same window tomorrow
          await sql('UPDATE job_alerts SET last_sent_at = NOW() WHERE id = $1', [alert.id]);
          continue;
        }

        if (!alert.email) {
          errors.push(`alert ${alert.id}: missing email`);
          continue;
        }

        const result = await sendDigestEmail({
          to: alert.email,
          searchSummary: summarizeSearch(alert.keywords, alert.locations),
          sessionCode: alert.session_code,
          jobs: newJobs,
          unsubscribeToken: alert.unsubscribe_token,
          baseUrl,
        });

        if (result.sent) {
          emailsSent++;
          await sql('UPDATE job_alerts SET last_sent_at = NOW() WHERE id = $1', [alert.id]);
        } else {
          errors.push(`alert ${alert.id}: ${result.error ?? 'unknown'}`);
        }
      } catch (err) {
        errors.push(`alert ${alert.id}: ${err instanceof Error ? err.message : 'error'}`);
      }
    }

    return NextResponse.json({
      alerts_processed: alerts.length,
      emails_sent: emailsSent,
      no_new_jobs: noNewJobs,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alerts digest cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

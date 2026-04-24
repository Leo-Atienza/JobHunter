/**
 * Job alerts — Resend email digest.
 *
 * Feature is env-gated: when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are unset,
 * `isAlertsEnabled()` returns false and no outbound emails are attempted. This
 * lets the alerts codepath ship safely before the Resend account is provisioned.
 */

import { Resend } from 'resend';
import { randomBytes } from 'node:crypto';

export function isAlertsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function makeUnsubscribeToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface DigestJob {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  relevance_score: number;
}

export interface DigestPayload {
  to: string;
  searchSummary: string;
  sessionCode: string;
  jobs: DigestJob[];
  unsubscribeToken: string;
  baseUrl: string;
}

export async function sendDigestEmail(
  payload: DigestPayload,
): Promise<{ sent: boolean; error?: string }> {
  if (!isAlertsEnabled()) return { sent: false, error: 'alerts-disabled' };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { to, searchSummary, sessionCode, jobs, unsubscribeToken, baseUrl } = payload;

  const subject = `${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching ${searchSummary} — JobHunter`;
  const dashboardUrl = `${baseUrl}/dashboard/${sessionCode}`;
  const unsubUrl = `${baseUrl}/api/alerts/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`;

  const html = buildHtml({
    searchSummary,
    jobs,
    dashboardUrl,
    unsubUrl,
  });

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
    });
    if (error) return { sent: false, error: error.message ?? 'send failed' };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(opts: {
  searchSummary: string;
  jobs: DigestJob[];
  dashboardUrl: string;
  unsubUrl: string;
}): string {
  const { searchSummary, jobs, dashboardUrl, unsubUrl } = opts;
  const jobCards = jobs
    .map(
      (j) => `
        <a href="${escapeHtml(j.url)}" style="display:block;padding:14px;margin-bottom:8px;border:1px solid #e2e8f0;border-radius:12px;text-decoration:none;color:inherit;">
          <div style="font-weight:600;font-size:15px;color:#0f172a;margin-bottom:4px;">${escapeHtml(j.title)}</div>
          <div style="font-size:13px;color:#64748b;">${escapeHtml(j.company ?? 'Unknown company')}${j.location ? ` · ${escapeHtml(j.location)}` : ''}</div>
          ${j.relevance_score > 0 ? `<div style="margin-top:8px;font-size:12px;color:#0891b2;"><strong>${j.relevance_score}</strong> / 100 match</div>` : ''}
        </a>`,
    )
    .join('');

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px 24px 8px;">
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">JobHunter</h1>
      <p style="margin:0;color:#64748b;font-size:14px;">${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching <strong>${escapeHtml(searchSummary)}</strong></p>
    </div>
    <div style="padding:8px 24px 16px;">${jobCards}</div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <a href="${dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View all jobs</a>
    </div>
    <div style="padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center;">
      <a href="${unsubUrl}" style="color:#94a3b8;">Unsubscribe from this alert</a>
    </div>
  </div>
</body></html>`;
}

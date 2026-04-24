import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

function renderPage(title: string, body: string, statusCode: number): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:48px 16px;}
.card{max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center;}
h1{margin:0 0 12px;font-size:20px;}
p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;}
a{color:#0f172a;font-weight:600;text-decoration:none;border-bottom:1px solid #cbd5e1;}
</style></head><body><div class="card">${body}</div></body></html>`;
  return new Response(html, {
    status: statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  if (!token) {
    return renderPage(
      'Invalid link',
      '<h1>Invalid unsubscribe link</h1><p>This link is missing its token.</p>',
      400,
    );
  }

  const sql = getDb();
  const rows = await sql(
    'UPDATE job_alerts SET enabled = false WHERE unsubscribe_token = $1 RETURNING id',
    [token],
  );

  if (rows.length === 0) {
    return renderPage(
      'Link expired',
      '<h1>Link expired</h1><p>This unsubscribe link is no longer valid. The alert may already be disabled.</p>',
      404,
    );
  }

  return renderPage(
    'Unsubscribed',
    "<h1>You're unsubscribed</h1><p>You will no longer receive emails for this job alert. You can re-enable alerts anytime from the JobHunter dashboard.</p>",
    200,
  );
}

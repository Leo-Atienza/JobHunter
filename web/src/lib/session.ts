import { getDb } from './db';
import type { ResumeProfile } from './types';

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const PREFIX = 'JH-';

export function generateCode(): string {
  let code = '';
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return `${PREFIX}${code}`;
}

export function isValidCodeFormat(code: string): boolean {
  const pattern = new RegExp(`^${PREFIX}[${CHARSET}]{${CODE_LENGTH}}$`);
  return pattern.test(code);
}

export async function sessionExists(code: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql(
    'SELECT 1 FROM sessions WHERE code = $1 AND (expires_at > NOW() OR user_id IS NOT NULL)',
    [code]
  );
  return rows.length > 0;
}

export async function getSession(code: string): Promise<{
  code: string;
  created_at: string;
  expires_at: string;
  keywords: string[] | null;
  location: string | null;
  locations: string[] | null;
  sources: string[] | null;
  remote: boolean;
  companies: string[] | null;
  country: string | null;
  user_id: string | null;
  resume_skills: ResumeProfile | null;
} | null> {
  const sql = getDb();
  const rows = await sql(
    'SELECT code, created_at, expires_at, keywords, location, locations, sources, remote, companies, country, user_id, resume_skills FROM sessions WHERE code = $1 AND (expires_at > NOW() OR user_id IS NOT NULL)',
    [code]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as {
    code: string;
    created_at: string;
    expires_at: string;
    keywords: string[] | null;
    location: string | null;
    locations: string[] | null;
    sources: string[] | null;
    remote: boolean;
    companies: string[] | null;
    country: string | null;
    user_id: string | null;
    resume_skills: ResumeProfile | null;
  };
  // Backward compat: synthesize locations from single location for old sessions
  if (!row.locations && row.location) {
    row.locations = [row.location];
  }
  return row;
}

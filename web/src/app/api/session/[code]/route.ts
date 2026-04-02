import { NextRequest, NextResponse } from 'next/server';
import { isValidCodeFormat, getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!isValidCodeFormat(code)) {
      return NextResponse.json(
        { error: 'Invalid session code format' },
        { status: 400 }
      );
    }

    const session = await getSession(code);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: session.code,
      expires_at: session.expires_at,
      keywords: session.keywords,
      location: session.location,
      locations: session.locations,
      sources: session.sources,
      remote: session.remote,
      companies: session.companies,
      country: session.country,
      resume_skills: session.resume_skills,
    });
  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!isValidCodeFormat(code)) {
      return NextResponse.json(
        { error: 'Invalid session code format' },
        { status: 400 }
      );
    }

    const sql = getDb();
    // CASCADE on foreign key will delete all associated jobs
    await sql('DELETE FROM sessions WHERE code = $1', [code]);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Session DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

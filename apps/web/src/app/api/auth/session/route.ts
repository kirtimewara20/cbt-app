import { NextResponse } from 'next/server';
import { isAdmin, normalizeRoles } from '@/lib/roles';
import { decodeJwtPayload } from '@/lib/jwt';

const MAX_AGE = 7 * 24 * 60 * 60;
const isProd = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: isProd,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';

  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
  }

  const payload = decodeJwtPayload<{ roles?: string[]; sub?: string }>(accessToken);
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
  }

  const roles = normalizeRoles(payload.roles);
  const admin = isAdmin(roles);

  const res = NextResponse.json({ ok: true, isAdmin: admin });
  res.cookies.set('cbt-auth', '1', cookieOptions());
  res.cookies.set('cbt-is-admin', admin ? '1' : '0', cookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const clear = { path: '/', maxAge: 0, httpOnly: true, secure: isProd, sameSite: 'lax' as const };
  res.cookies.set('cbt-auth', '', clear);
  res.cookies.set('cbt-is-admin', '', clear);
  return res;
}

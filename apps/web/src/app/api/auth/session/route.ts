import { NextResponse } from 'next/server';
import { isAdmin, normalizeRoles } from '@/lib/roles';

const MAX_AGE = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const roles = normalizeRoles(body.roles);
  const admin = isAdmin(roles);

  const res = NextResponse.json({ ok: true, isAdmin: admin });
  res.cookies.set('cbt-auth', '1', { path: '/', maxAge: MAX_AGE, sameSite: 'lax' });
  res.cookies.set('cbt-is-admin', admin ? '1' : '0', { path: '/', maxAge: MAX_AGE, sameSite: 'lax' });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('cbt-auth', '', { path: '/', maxAge: 0 });
  res.cookies.set('cbt-is-admin', '', { path: '/', maxAge: 0 });
  return res;
}

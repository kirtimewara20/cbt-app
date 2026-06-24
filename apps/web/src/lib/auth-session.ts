import { getSafeRedirectPath } from './safe-redirect';

export async function syncAuthSession(accessToken: string): Promise<boolean> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to sync session');
  const data = await res.json();
  return Boolean(data.isAdmin);
}

export async function clearAuthSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
}

export function redirectAfterLogin(
  isAdminUser: boolean,
  redirectTo?: string | null,
) {
  const safe = getSafeRedirectPath(redirectTo ?? null);
  const target = safe ?? (isAdminUser ? '/dashboard' : '/my-exams');
  window.location.assign(target);
}

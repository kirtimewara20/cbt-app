export async function syncAuthSession(roles: unknown): Promise<boolean> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to sync session');
  const data = await res.json();
  return Boolean(data.isAdmin);
}

export async function clearAuthSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
}

export function redirectAfterLogin(roles: unknown, isAdminUser: boolean) {
  const target = isAdminUser ? '/dashboard' : '/my-exams';
  window.location.assign(target);
}

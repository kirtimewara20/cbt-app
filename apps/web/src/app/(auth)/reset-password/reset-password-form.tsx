'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { Logo } from '@/components/layout/logo';
import { Lock } from 'lucide-react';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid reset link. Request a new one from the login page.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center mesh-bg p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        <Logo />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Reset password</h2>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>

        {done ? (
          <div className="glass-panel p-8 text-center">
            <p className="font-semibold text-emerald-600">Password updated successfully!</p>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-panel space-y-5 p-8">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              <Lock className="mr-2 h-4 w-4" />
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { Logo } from '@/components/layout/logo';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center mesh-bg p-6">
      <div className="w-full max-w-md space-y-8 animate-fade-in-up">
        <Logo />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Forgot password</h2>
          <p className="text-muted-foreground">We&apos;ll send you a reset link if the email exists</p>
        </div>

        {sent ? (
          <div className="glass-panel p-8 text-center">
            <p className="font-semibold">Check your email</p>
            <p className="mt-2 text-sm text-muted-foreground">
              If <strong>{email}</strong> is registered, a reset link has been sent.
              In dev mode, check the API server logs for the link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-panel space-y-5 p-8">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              <Mail className="mr-2 h-4 w-4" />
              {loading ? 'Sending...' : 'Send Reset Link'}
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

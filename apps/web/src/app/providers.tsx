'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { AuthHydrationGate } from '@/components/auth/auth-hydration-gate';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthHydrationGate>
          {children}
        </AuthHydrationGate>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

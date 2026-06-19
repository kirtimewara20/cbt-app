'use client';

import { useEffect } from 'react';
import { useAuthStore, syncSessionFromStore } from '@/stores/auth-store';

export function AuthHydrationGate({ children }: { children: React.ReactNode }) {
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  useEffect(() => {
    const markHydrated = async () => {
      try {
        await syncSessionFromStore();
      } catch {
        /* cookies sync is best-effort on hydrate */
      }
      setHasHydrated(true);
    };

    if (useAuthStore.persist.hasHydrated()) {
      void markHydrated();
      return;
    }

    return useAuthStore.persist.onFinishHydration(() => {
      void markHydrated();
    });
  }, [setHasHydrated]);

  return <>{children}</>;
}

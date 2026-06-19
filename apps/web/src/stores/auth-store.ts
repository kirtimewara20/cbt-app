import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@cbt/shared';
import { normalizeRoles, isAdmin } from '@/lib/roles';
import { syncAuthSession, clearAuthSession } from '@/lib/auth-session';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<boolean>;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      setAuth: async (user, accessToken, refreshToken) => {
        const roles = normalizeRoles(user.roles);
        const isAdminUser = await syncAuthSession(roles);
        set({
          user: { ...user, roles: roles as AuthUser['roles'] },
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
        return isAdminUser;
      },
      updateTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: async () => {
        await clearAuthSession();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'cbt-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export async function syncSessionFromStore() {
  const state = useAuthStore.getState();
  if (state.isAuthenticated && state.user?.roles) {
    return syncAuthSession(state.user.roles);
  }
  if (typeof document !== 'undefined' && document.cookie.includes('cbt-auth=1')) {
    return false;
  }
  await clearAuthSession();
  return false;
}

export function getPostLoginPath(roles: unknown) {
  return isAdmin(normalizeRoles(roles)) ? '/dashboard' : '/my-exams';
}

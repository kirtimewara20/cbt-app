'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Moon, Sun, LogOut, Bell, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { authApi, isAdmin } from '@/lib/api';
import { normalizeRoles } from '@/lib/roles';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/exams': 'Exams',
  '/dashboard/questions': 'Question Bank',
  '/dashboard/candidates': 'Candidates',
  '/dashboard/users': 'User Management',
  '/dashboard/results': 'Results',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/monitoring': 'Live Monitoring',
  '/dashboard/ai': 'AI Studio',
  '/dashboard/audit': 'Audit Logs',
  '/dashboard/settings': 'Settings',
};

export function Header() {
  const { user, logout, accessToken } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const pageTitle = pageTitles[pathname] || 'Administration';
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  async function handleLogout() {
    if (accessToken) {
      try { await authApi.logout(accessToken); } catch { /* ignore */ }
    }
    await logout();
    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-border/60 bg-card/60 px-6 backdrop-blur-xl lg:px-8">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{pageTitle}</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-2 hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 md:flex">
          <span className="status-dot scale-75" />
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">System Online</span>
        </div>

        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>

        <div className="mx-2 h-8 w-px bg-border" />

        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 py-1.5 pl-1.5 pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-white shadow-sm">
            {initials || 'U'}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{user?.roles?.[0]?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {!isAdmin(normalizeRoles(user?.roles)) && (
          <Button variant="outline" size="sm" onClick={() => router.push('/my-exams')}>My Exams</Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Logout">
          <LogOut className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </header>
  );
}

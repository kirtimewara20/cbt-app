'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, HelpCircle, Users, BarChart3, Eye,
  Settings, ScrollText, Award, UserCog, Shield, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { Logo } from './logo';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: Permission.ANALYTICS_VIEW },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, permission: Permission.ANALYTICS_VIEW },
    ],
  },
  {
    label: 'Examination',
    items: [
      { href: '/dashboard/exams', label: 'Exams', icon: FileText, permission: Permission.EXAM_READ },
      { href: '/dashboard/ai', label: 'AI Studio', icon: Sparkles, permission: Permission.QUESTION_CREATE },
      { href: '/dashboard/questions', label: 'Question Bank', icon: HelpCircle, permission: Permission.QUESTION_READ },
      { href: '/dashboard/results', label: 'Results', icon: Award, permission: Permission.RESULT_READ },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/dashboard/candidates', label: 'Candidates', icon: Users, permission: Permission.CANDIDATE_READ },
      { href: '/dashboard/users', label: 'Users', icon: UserCog, permission: Permission.USER_READ },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/dashboard/monitoring', label: 'Live Monitoring', icon: Eye, permission: Permission.PROCTORING_MONITOR },
      { href: '/dashboard/audit', label: 'Audit Logs', icon: ScrollText, permission: Permission.AUDIT_READ },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: Permission.TENANT_READ },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();

  return (
    <aside className="relative flex h-full w-[272px] flex-col bg-sidebar text-sidebar-foreground shadow-sidebar">
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-sidebar-border to-transparent" />

      <div className="flex h-[72px] items-center border-b border-sidebar-border px-6">
        <Logo variant="light" />
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => can(item.permission));
          if (!visibleItems.length) return null;
          return (
            <div key={group.label}>
              <p className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-muted/80">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                        isActive
                          ? 'bg-sidebar-accent text-white nav-active-glow'
                          : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground',
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
                      )}
                      <Icon className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        isActive ? 'text-white' : 'text-sidebar-muted group-hover:text-sidebar-foreground',
                      )} />
                      {item.label}
                      {item.href === '/dashboard/ai' && !isActive && (
                        <span className="ml-auto rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                          AI
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-sidebar-foreground">Proctoring Active</p>
                <span className="status-dot scale-75" />
              </div>
              <p className="text-[11px] text-sidebar-muted">AI-powered integrity monitoring</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Users, HelpCircle, Activity, AlertTriangle, Calendar, Clock,
  Sparkles, Eye, Plus, ArrowRight, Award, Shield,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { TableSkeleton } from '@/components/ui/skeleton';

const quickActions = [
  { href: '/dashboard/exams', label: 'Create Exam', icon: Plus, color: 'bg-blue-500/10 text-blue-600', permission: Permission.EXAM_CREATE },
  { href: '/dashboard/ai', label: 'AI Studio', icon: Sparkles, color: 'bg-violet-500/10 text-violet-600', permission: Permission.QUESTION_CREATE },
  { href: '/dashboard/monitoring', label: 'Live Monitor', icon: Eye, color: 'bg-emerald-500/10 text-emerald-600', permission: Permission.PROCTORING_MONITOR },
];

export default function DashboardPage() {
  const { accessToken } = useRequireAuth(true);
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const visibleQuickActions = quickActions.filter((action) => can(action.permission));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.stats(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const stats = (data as { stats?: Record<string, number> })?.stats;
  const recentSubmissions = (data as { recentSubmissions?: {
    id: string; candidateName: string; examTitle: string; percentage: number;
    score: number; maxScore: number; submittedAt: string;
  }[] })?.recentSubmissions || [];
  const recentViolations = (data as { recentViolations?: {
    id: string; label: string; severity: string; candidateName: string;
    examTitle: string; occurredAt: string;
  }[] })?.recentViolations || [];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="Real-time overview of your examination platform" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <TableSkeleton rows={4} cols={2} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="hero-banner">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.firstName}</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Your examination command center
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              Monitor live sessions, manage exams, and track performance — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleQuickActions.map((action) => (
              <Button key={action.href} variant="outline" size="sm" className="bg-card/80 backdrop-blur-sm" asChild>
                <Link href={action.href}>
                  <action.icon className="mr-2 h-3.5 w-3.5" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Published Exams" value={stats?.publishedExams ?? 0} icon={FileText} accent="blue" />
        <StatCard title="Total Candidates" value={stats?.totalCandidates ?? 0} icon={Users} accent="green" />
        <StatCard title="Active Sessions" value={stats?.activeSessions ?? 0} icon={Activity} accent="violet" trend="Live now" trendUp />
        <StatCard title="Violation Alerts" value={stats?.violationAlerts ?? 0} icon={AlertTriangle} accent="red" />
        <StatCard title="Questions" value={stats?.totalQuestions ?? 0} icon={HelpCircle} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              Upcoming Exams
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link href="/dashboard/exams">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {((data as { upcomingExams?: unknown[] })?.upcomingExams || []).map((exam: {
              id: string; title: string; code: string; startTime: string; _count: { registrations: number };
            }) => (
              <div key={exam.id} className="group flex items-center justify-between border-b border-border/40 px-6 py-4 transition-colors last:border-0 hover:bg-muted/20">
                <div>
                  <p className="font-semibold">{exam.title}</p>
                  <p className="text-sm text-muted-foreground">{exam.code}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(exam.startTime).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-primary">{exam._count.registrations}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">registered</p>
                </div>
              </div>
            ))}
            {!((data as { upcomingExams?: unknown[] })?.upcomingExams?.length) && (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">No upcoming exams scheduled</p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              Recent Exam Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link href="/dashboard/results">View results <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentSubmissions.length > 0 && (
              <div className="border-b border-border/40 px-6 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recent Submissions</p>
              </div>
            )}
            {recentSubmissions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between border-b border-border/40 px-6 py-4 transition-colors last:border-0 hover:bg-muted/20">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="text-foreground">{sub.candidateName}</span>
                    <span className="text-muted-foreground"> submitted </span>
                    <span className="text-foreground">{sub.examTitle}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(sub.submittedAt).toLocaleString()}</p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-bold tabular-nums text-primary">{sub.percentage.toFixed(0)}%</p>
                  <p className="text-[11px] text-muted-foreground">{sub.score}/{sub.maxScore}</p>
                </div>
              </div>
            ))}

            {recentViolations.length > 0 && (
              <div className="border-b border-border/40 px-6 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Latest Alerts</p>
              </div>
            )}
            {recentViolations.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-border/40 px-6 py-4 transition-colors last:border-0 hover:bg-muted/20">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <Shield className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {v.candidateName} · {v.examTitle} · {new Date(v.occurredAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant={v.severity === 'HIGH' || v.severity === 'CRITICAL' ? 'destructive' : 'warning'} className="ml-2 shrink-0">
                  {v.severity}
                </Badge>
              </div>
            ))}

            {!recentSubmissions.length && !recentViolations.length && (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No submissions or alerts yet. Activity will appear here as candidates take exams.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

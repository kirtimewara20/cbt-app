import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const accentStyles = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    bar: 'from-blue-500 to-blue-400',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    bar: 'from-emerald-500 to-emerald-400',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    bar: 'from-amber-500 to-amber-400',
  },
  red: {
    icon: 'bg-red-500/10 text-red-600 dark:text-red-400',
    bar: 'from-red-500 to-red-400',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    bar: 'from-violet-500 to-violet-400',
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accent?: keyof typeof accentStyles;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, accent = 'blue', trend, trendUp }: StatCardProps) {
  const style = accentStyles[accent];

  return (
    <Card className="group surface-card relative overflow-hidden">
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80', style.bar)} />
      <CardContent className="p-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2.5">
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            {trend && (
              <p className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                trendUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
              )}>
                {trendUp && <span className="text-emerald-500">↑</span>}
                {trend}
              </p>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105',
            style.icon,
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  badge?: string;
}

export function PageHeader({ title, description, children, className, badge }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
          {badge && (
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

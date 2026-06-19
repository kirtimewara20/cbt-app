import { cn } from '@/lib/utils';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTable({ children, className }: DataTableProps) {
  return (
    <div className={cn('surface-card overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border/60 bg-muted/30">{children}</tr>
    </thead>
  );
}

export function DataTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground', className)}>
      {children}
    </th>
  );
}

export function DataTableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn('border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20', className)}>
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-5 py-4 text-sm', className)}>{children}</td>;
}

export function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

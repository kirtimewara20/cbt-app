'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { candidatesApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, DataTableHeader, DataTableHead, DataTableRow, DataTableCell, EmptyState } from '@/components/layout/data-table';
import { StatCard } from '@/components/layout/stat-card';
import { CreateCandidateDialog } from '@/components/admin/create-candidate-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { Search, Users, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

type CandidateItem = {
  id: string;
  registrationNumber: string;
  kycStatus: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string; status: string };
};

const KYC_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'destructive',
  NOT_SUBMITTED: 'outline',
};

export default function CandidatesPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', search],
    queryFn: () => candidatesApi.list(accessToken!, 1, search),
    enabled: !!accessToken,
  });

  const kycMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      candidatesApi.verifyKyc(accessToken!, id, status),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast({
        title: status === 'VERIFIED' ? 'KYC verified' : 'KYC rejected',
        variant: 'success',
      });
    },
    onError: (e: Error) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <TableSkeleton rows={6} cols={6} />;

  const items = (data?.items || []) as CandidateItem[];
  const verified = items.filter((c) => c.kycStatus === 'VERIFIED').length;
  const pending = items.filter((c) => c.kycStatus === 'PENDING').length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidates"
        description="Manage candidate profiles, registration numbers, and KYC verification"
        badge={data?.total != null ? `${data.total} total` : undefined}
      >
        <div className="relative w-56">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {can(Permission.CANDIDATE_CREATE) && <CreateCandidateDialog accessToken={accessToken!} />}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Candidates" value={data?.total ?? items.length} icon={Users} accent="blue" />
        <StatCard title="KYC Verified" value={verified} icon={CheckCircle2} accent="green" />
        <StatCard title="Pending Review" value={pending} icon={Clock} accent="amber" trend={pending ? 'Action needed' : undefined} />
      </div>

      <DataTable>
        <table className="w-full">
          <DataTableHeader>
            <DataTableHead>Reg. No</DataTableHead>
            <DataTableHead>Name</DataTableHead>
            <DataTableHead>Email</DataTableHead>
            <DataTableHead>Account</DataTableHead>
            <DataTableHead>KYC Status</DataTableHead>
            <DataTableHead>Registered</DataTableHead>
            <DataTableHead>Actions</DataTableHead>
          </DataTableHeader>
          <tbody>
            {items.map((c) => (
              <DataTableRow key={c.id}>
                <DataTableCell className="font-mono text-xs font-semibold text-primary">
                  {c.registrationNumber}
                </DataTableCell>
                <DataTableCell className="font-medium">
                  {c.user.firstName} {c.user.lastName}
                </DataTableCell>
                <DataTableCell className="text-muted-foreground">{c.user.email}</DataTableCell>
                <DataTableCell>
                  <Badge variant={c.user.status === 'ACTIVE' ? 'success' : 'secondary'}>
                    {c.user.status}
                  </Badge>
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={KYC_VARIANTS[c.kycStatus] ?? 'outline'}>
                    {c.kycStatus.replace('_', ' ')}
                  </Badge>
                </DataTableCell>
                <DataTableCell className="text-muted-foreground text-xs">
                  {new Date(c.createdAt).toLocaleDateString()}
                </DataTableCell>
                <DataTableCell>
                  {can(Permission.CANDIDATE_KYC_VERIFY) ? (
                    <div className="flex gap-2">
                      {c.kycStatus !== 'VERIFIED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={kycMutation.isPending}
                          onClick={() => kycMutation.mutate({ id: c.id, status: 'VERIFIED' })}
                        >
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Verify
                        </Button>
                      )}
                      {c.kycStatus === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={kycMutation.isPending}
                          onClick={() => kycMutation.mutate({ id: c.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      )}
                      {c.kycStatus === 'VERIFIED' && (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <EmptyState
            icon={Users}
            title={search ? 'No candidates found' : 'No candidates yet'}
            description={search ? 'Try a different search term.' : 'Add your first candidate to get started.'}
          />
        )}
      </DataTable>
    </div>
  );
}

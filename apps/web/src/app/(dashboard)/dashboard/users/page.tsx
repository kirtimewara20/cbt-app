'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { usersApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';

export default function UsersPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list(accessToken!, page, search),
    enabled: !!accessToken,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.roles(accessToken!),
    enabled: !!accessToken,
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.removeRole(accessToken!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Role removed', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const roleList = (roles as { id: string; name: string }[]) || [];

  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.assignRole(accessToken!, userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Role assigned', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage organization users and role assignments</p>
        </div>
        <div className="flex items-center gap-3">
          {can(Permission.USER_CREATE) && (
            <CreateUserDialog accessToken={accessToken!} roles={(roles as { id: string; name: string }[]) || []} />
          )}
          <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4"><TableSkeleton /></div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Roles</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">MFA</th>
                  <th className="p-3 text-left">Last Login</th>
                  <th className="p-3 text-left">Assign Role</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((u: {
                  id: string; firstName: string; lastName: string; email: string;
                  status: string; mfaEnabled: boolean; lastLoginAt?: string;
                  userRoles: { role: { id: string; name: string } }[];
                }) => {
                  const assignedIds = new Set(u.userRoles.map((ur) => ur.role.id));
                  const availableRoles = roleList.filter((r) => !assignedIds.has(r.id));
                  return (
                  <tr key={u.id} className="border-b">
                    <td className="p-3 font-medium">{u.firstName} {u.lastName}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.userRoles.map((ur) => (
                          <Badge key={ur.role.id} variant="secondary" className="gap-1 pr-1">
                            {ur.role.name}
                            {can(Permission.USER_ASSIGN_ROLE) && (
                              <button
                                type="button"
                                className="ml-1 rounded px-1 hover:bg-muted"
                                title="Remove role"
                                onClick={() => removeMutation.mutate({ userId: u.id, roleId: ur.role.id })}
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3"><Badge variant={u.status === 'ACTIVE' ? 'success' : 'warning'}>{u.status}</Badge></td>
                    <td className="p-3">{u.mfaEnabled ? '✓' : '—'}</td>
                    <td className="p-3 text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td className="p-3">
                      <select
                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) assignMutation.mutate({ userId: u.id, roleId: e.target.value });
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Role</option>
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground">Page {page} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

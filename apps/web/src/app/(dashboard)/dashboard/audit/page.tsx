'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { auditApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AuditPage() {
  const { accessToken } = useRequireAuth(true);

  const { data, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.list(accessToken!),
    enabled: !!accessToken,
  });

  if (isLoading) return <div>Loading audit logs...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Security and compliance audit trail</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Time</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Resource</th><th className="p-3 text-left">IP</th></tr></thead>
            <tbody>
              {(data?.items || []).map((log: { id: string; action: string; resourceType: string; ipAddress?: string; createdAt: string; user?: { email: string } }) => (
                <tr key={log.id} className="border-b">
                  <td className="p-3">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-3">{log.user?.email || 'System'}</td>
                  <td className="p-3 font-mono text-xs">{log.action}</td>
                  <td className="p-3">{log.resourceType}</td>
                  <td className="p-3">{log.ipAddress || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

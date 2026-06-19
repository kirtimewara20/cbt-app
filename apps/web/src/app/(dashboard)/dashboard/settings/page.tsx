'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useRequireAuth } from '@/hooks/use-auth';
import { tenantsApi } from '@/lib/api';
import { Permission } from '@cbt/shared';
import { usePermissions } from '@/hooks/use-permissions';

export default function SettingsPage() {
  const { accessToken } = useRequireAuth(true);
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [saved, setSaved] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', user?.tenantId],
    queryFn: () => tenantsApi.get(accessToken!, user!.tenantId) as Promise<{ branding?: { primaryColor?: string } }>,
    enabled: !!accessToken && !!user?.tenantId && can(Permission.TENANT_READ),
  });

  useEffect(() => {
    const color = tenant?.branding?.primaryColor;
    if (color) setPrimaryColor(color);
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: () =>
      tenantsApi.updateBranding(accessToken!, user!.tenantId, { primaryColor }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Organization and account settings</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Name:</strong> {user?.firstName} {user?.lastName}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Roles:</strong> {user?.roles?.join(', ')}</p>
          <p><strong>Tenant:</strong> {user?.tenantId}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Primary Color</Label><Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-20" /></div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Branding'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

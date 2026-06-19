'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { candidatesApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface CreateCandidateDialogProps {
  accessToken: string;
}

export function CreateCandidateDialog({ accessToken }: CreateCandidateDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', registrationNumber: '',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      candidatesApi.create(accessToken, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        registrationNumber: form.registrationNumber || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast({ title: 'Candidate created', variant: 'success' });
      setOpen(false);
      setForm({ firstName: '', lastName: '', email: '', password: '', registrationNumber: '' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Candidate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Candidate</DialogTitle>
          <DialogDescription>Register a new candidate with login credentials.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label>Registration No. (optional)</Label><Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="Auto-generated if empty" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.email || !form.password || !form.firstName}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Candidate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

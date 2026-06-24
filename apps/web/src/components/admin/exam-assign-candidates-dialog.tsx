'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { candidatesApi, examsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ExamAssignCandidatesDialogProps {
  accessToken: string;
  examId: string;
  examTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExamAssignCandidatesDialog({
  accessToken, examId, examTitle, open, onOpenChange,
}: ExamAssignCandidatesDialogProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.get(accessToken, examId),
    enabled: open && !!accessToken,
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => candidatesApi.list(accessToken, 1, '', 200),
    enabled: open && !!accessToken,
  });

  const assignedIds = useMemo(
    () => new Set((exam?.registrations || []).map((r: { candidateId: string }) => r.candidateId)),
    [exam],
  );

  const available = useMemo(
    () => (candidates?.items || []).filter((c: { id: string }) => !assignedIds.has(c.id)),
    [candidates, assignedIds],
  );

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignMutation = useMutation({
    mutationFn: () => examsApi.assignCandidates(accessToken, examId, [...selected]),
    onSuccess: (data: { count?: number; skipped?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      const count = data.count ?? 0;
      const skipped = data.skipped ?? 0;
      if (count > 0) {
        toast({
          title: `${count} candidate${count === 1 ? '' : 's'} assigned`,
          description: skipped > 0 ? `${skipped} already assigned` : undefined,
          variant: 'success',
        });
      } else {
        toast({ title: 'No new assignments', description: 'Selected candidates are already assigned', variant: 'destructive' });
      }
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Failed to assign candidates', description: e.message, variant: 'destructive' }),
  });

  const loading = examLoading || candidatesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Candidates</DialogTitle>
          <DialogDescription>
            Select candidates for <span className="font-medium text-foreground">{examTitle}</span>.
            {assignedIds.size > 0 && ` ${assignedIds.size} already assigned.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          )}
          {!loading && !available.length && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {(candidates?.items || []).length === 0
                ? 'No candidates found. Create candidates on the Candidates page first.'
                : 'All candidates are already assigned to this exam.'}
            </p>
          )}
          {!loading && available.map((c: {
            id: string;
            registrationNumber: string;
            user: { firstName: string; lastName: string; email: string };
          }) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.user.firstName} {c.user.lastName}</p>
                <p className="text-xs text-muted-foreground">{c.registrationNumber} · {c.user.email}</p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!selected.size || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : `Assign ${selected.size || ''} candidate${selected.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

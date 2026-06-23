'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { examsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/data-table';
import { ExamAssignQuestionsDialog } from '@/components/admin/exam-assign-questions-dialog';
import { ExamAssignCandidatesDialog } from '@/components/admin/exam-assign-candidates-dialog';
import { ExamManageQuestionsDialog } from '@/components/admin/exam-manage-questions-dialog';
import { toast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_EXAM_TIMEZONE, localDateTimeToUtcIso } from '@cbt/shared';
import { EXAM_TIMEZONE_OPTIONS, formatExamTimeRange } from '@/lib/exam-dates';
import { FileText, Plus, Users, Clock, HelpCircle } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';

type ExamItem = {
  id: string;
  title: string;
  code: string;
  status: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  sections?: { id: string; _count?: { questions: number } }[];
  _count?: { registrations: number; sessions: number; results: number };
};

function questionCount(exam: ExamItem) {
  return (exam.sections || []).reduce((sum, s) => sum + (s._count?.questions ?? 0), 0);
}

export default function ExamsPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [questionsDialog, setQuestionsDialog] = useState<{ examId: string; sectionId: string; title: string } | null>(null);
  const [manageQuestionsDialog, setManageQuestionsDialog] = useState<{ examId: string; title: string } | null>(null);
  const [candidatesDialog, setCandidatesDialog] = useState<{ examId: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; code: string } | null>(null);
  const [form, setForm] = useState({
    title: '', code: '', type: 'RECRUITMENT', durationMinutes: 30,
    startTime: '', endTime: '', timezone: DEFAULT_EXAM_TIMEZONE,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () => examsApi.create(accessToken!, {
      title: form.title,
      code: form.code,
      type: form.type,
      timezone: form.timezone,
      startTime: localDateTimeToUtcIso(form.startTime, form.timezone),
      endTime: localDateTimeToUtcIso(form.endTime, form.timezone),
      settings: { durationMinutes: form.durationMinutes, passingScore: 40, negativeMarking: true, shuffleQuestions: false },
      securityPolicy: { proctoringEnabled: false, fullscreen: true, blockCopyPaste: true },
      sections: [{ name: 'Section A', orderIndex: 1, durationMinutes: form.durationMinutes }],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setShowCreate(false);
      setForm({ title: '', code: '', type: 'RECRUITMENT', durationMinutes: 30, startTime: '', endTime: '', timezone: DEFAULT_EXAM_TIMEZONE });
      toast({ title: 'Exam created', description: 'Add questions and assign candidates before publishing.', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Failed to create exam', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsApi.publish(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({ title: 'Exam published', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Cannot publish', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examsApi.remove(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setDeleteTarget(null);
      toast({ title: 'Exam deleted', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Cannot delete exam', description: e.message, variant: 'destructive' }),
  });

  function canDeleteExam(exam: ExamItem) {
    if (exam.status === 'COMPLETED') return false;
    if ((exam._count?.sessions ?? 0) > 0) return false;
    if ((exam._count?.results ?? 0) > 0) return false;
    return true;
  }

  if (isLoading) return <TableSkeleton rows={3} cols={1} />;

  const items: ExamItem[] = data?.items || [];

  return (
    <div className="space-y-8">
      <PageHeader title="Exams" description="Create, publish, and manage your examination lifecycle" badge="Core">
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? 'Cancel' : 'Create Exam'}
        </Button>
      </PageHeader>

      {showCreate && (
        <Card className="surface-card border-primary/20">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold">New Examination</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Aptitude Test 2026" /></div>
            <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DEMO-2026" /></div>
            <div className="space-y-2"><Label>Start Time</Label><Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div className="space-y-2"><Label>End Time</Label><Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {EXAM_TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Start and end times are interpreted in this timezone.</p>
            </div>
            <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })} /></div>
            <div className="flex items-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.title || !form.code || !form.startTime || !form.endTime}>
                {createMutation.isPending ? 'Creating...' : 'Create Exam'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((exam) => {
          const qCount = questionCount(exam);
          const cCount = exam._count?.registrations ?? 0;
          const sectionId = exam.sections?.[0]?.id;
          const readyToPublish = qCount > 0 && cCount > 0;

          return (
            <Card key={exam.id} className="surface-card group">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{exam.title}</h3>
                      <Badge variant={exam.status === 'PUBLISHED' ? 'success' : 'warning'}>{exam.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{exam.code}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{qCount} question{qCount === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{cCount} candidate{cCount === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatExamTimeRange(exam.startTime, exam.endTime, exam.timezone || DEFAULT_EXAM_TIMEZONE)}
                      </span>
                    </div>
                    {exam.status === 'DRAFT' && !readyToPublish && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        {qCount === 0 && cCount === 0 && 'Add questions and assign candidates to publish.'}
                        {qCount === 0 && cCount > 0 && 'Add at least one approved question to publish.'}
                        {qCount > 0 && cCount === 0 && 'Assign at least one candidate to publish.'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exam.status === 'DRAFT' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!sectionId}
                        onClick={() => sectionId && setQuestionsDialog({ examId: exam.id, sectionId, title: exam.title })}
                      >
                        Add Questions
                      </Button>
                      {qCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setManageQuestionsDialog({ examId: exam.id, title: exam.title })}
                        >
                          Manage Questions
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCandidatesDialog({ examId: exam.id, title: exam.title })}
                      >
                        Assign Candidates
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate(exam.id)}
                        disabled={!readyToPublish || publishMutation.isPending}
                      >
                        Publish
                      </Button>
                    </>
                  )}
                  {can(Permission.EXAM_DELETE) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!canDeleteExam(exam)}
                      title={
                        !canDeleteExam(exam)
                          ? 'Cannot delete: exam is completed or candidates have taken it'
                          : 'Permanently delete this exam'
                      }
                      onClick={() => setDeleteTarget({ id: exam.id, title: exam.title, code: exam.code })}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!items.length && (
          <Card className="surface-card">
            <EmptyState icon={FileText} title="No exams yet" description="Create your first examination to get started." />
          </Card>
        )}
      </div>

      {questionsDialog && accessToken && (
        <ExamAssignQuestionsDialog
          accessToken={accessToken}
          examId={questionsDialog.examId}
          sectionId={questionsDialog.sectionId}
          examTitle={questionsDialog.title}
          open={!!questionsDialog}
          onOpenChange={(open) => !open && setQuestionsDialog(null)}
        />
      )}

      {manageQuestionsDialog && accessToken && (
        <ExamManageQuestionsDialog
          accessToken={accessToken}
          examId={manageQuestionsDialog.examId}
          examTitle={manageQuestionsDialog.title}
          open={!!manageQuestionsDialog}
          onOpenChange={(open) => !open && setManageQuestionsDialog(null)}
        />
      )}

      {candidatesDialog && accessToken && (
        <ExamAssignCandidatesDialog
          accessToken={accessToken}
          examId={candidatesDialog.examId}
          examTitle={candidatesDialog.title}
          open={!!candidatesDialog}
          onOpenChange={(open) => !open && setCandidatesDialog(null)}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete exam?</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium text-foreground">{deleteTarget?.title}</span> ({deleteTarget?.code}).
              This removes all questions, candidate assignments, and exam settings. Questions in the bank are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete exam'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

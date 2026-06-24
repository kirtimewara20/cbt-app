'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { examsApi, resultsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, DataTableHeader, DataTableHead, DataTableRow, DataTableCell } from '@/components/layout/data-table';
import { Download, ClipboardCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type SubjectiveItem = {
  id: string;
  sessionId: string;
  questionId: string;
  answer: unknown;
  marksAwarded: number | null;
  question: { title: string; type: string; versions: { marks: number }[] };
  session: { candidate: { user: { firstName: string; lastName: string; email: string } } };
};

export default function ResultsPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = useState('');
  const [showGrading, setShowGrading] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<SubjectiveItem | null>(null);
  const [gradeMarks, setGradeMarks] = useState('');

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: results, isLoading, isError, error } = useQuery({
    queryKey: ['results', selectedExam],
    queryFn: () => resultsApi.byExam(accessToken!, selectedExam),
    enabled: !!accessToken && !!selectedExam,
  });

  const { data: subjective } = useQuery({
    queryKey: ['subjective', selectedExam],
    queryFn: () => resultsApi.subjective(accessToken!, selectedExam) as Promise<SubjectiveItem[]>,
    enabled: !!accessToken && !!selectedExam && showGrading,
  });

  const unpublishedCount = (results?.items || []).filter((r: { published: boolean }) => !r.published).length;
  const pendingGrading = (subjective || []).filter((r) => r.marksAwarded == null).length;

  const rankMutation = useMutation({
    mutationFn: (examId: string) => resultsApi.rank(accessToken!, examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results', selectedExam] }),
    onError: (e: Error) => toast({ title: 'Rank calculation failed', description: e.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) => resultsApi.publish(accessToken!, examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results', selectedExam] });
      toast({ title: 'Results published', description: 'Ranks were calculated automatically.', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Publish failed', description: e.message, variant: 'destructive' }),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ sessionId, questionId, marks }: { sessionId: string; questionId: string; marks: number }) =>
      resultsApi.grade(accessToken!, sessionId, questionId, marks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjective', selectedExam] });
      queryClient.invalidateQueries({ queryKey: ['results', selectedExam] });
      setGradeTarget(null);
      toast({ title: 'Response graded', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Grading failed', description: e.message, variant: 'destructive' }),
  });

  async function exportCsv() {
    if (!accessToken || !selectedExam) return;
    try {
      const blob = await resultsApi.exportCsv(accessToken, selectedExam);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-${selectedExam}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded', variant: 'success' });
    } catch (e) {
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  }

  function formatAnswer(answer: unknown): string {
    if (!answer) return '—';
    if (typeof answer === 'object' && answer !== null && 'value' in answer) {
      return String((answer as { value: unknown }).value);
    }
    return String(answer);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="View, rank, and publish examination results">
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm" value={selectedExam} onChange={(e) => { setSelectedExam(e.target.value); setShowGrading(false); }}>
          <option value="">Select exam...</option>
          {(exams?.items || []).map((e: { id: string; title: string; code: string }) => (
            <option key={e.id} value={e.id}>{e.code} — {e.title}</option>
          ))}
        </select>
        {selectedExam && (
          <>
            {can(Permission.RESULT_RANK) && (
              <Button variant="outline" onClick={() => rankMutation.mutate(selectedExam)}>Calculate Ranks</Button>
            )}
            {can(Permission.RESULT_PUBLISH) && (
              <Button onClick={() => publishMutation.mutate(selectedExam)}>Publish</Button>
            )}
            {can(Permission.RESULT_EVALUATE) && (
              <Button variant="outline" onClick={() => setShowGrading(!showGrading)}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Manual Grading{pendingGrading > 0 ? ` (${pendingGrading})` : ''}
              </Button>
            )}
            {can(Permission.RESULT_READ) && (
              <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export</Button>
            )}
          </>
        )}
      </PageHeader>

      {showGrading && selectedExam && can(Permission.RESULT_EVALUATE) && (
        <DataTable>
          <table className="w-full">
            <DataTableHeader>
              <DataTableHead>Candidate</DataTableHead>
              <DataTableHead>Question</DataTableHead>
              <DataTableHead>Type</DataTableHead>
              <DataTableHead>Answer</DataTableHead>
              <DataTableHead>Marks</DataTableHead>
              <DataTableHead>Action</DataTableHead>
            </DataTableHeader>
            <tbody>
              {(subjective || []).map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell className="font-medium">
                    {r.session.candidate.user.firstName} {r.session.candidate.user.lastName}
                  </DataTableCell>
                  <DataTableCell>{r.question.title}</DataTableCell>
                  <DataTableCell><Badge variant="outline">{r.question.type}</Badge></DataTableCell>
                  <DataTableCell className="max-w-xs truncate text-xs">{formatAnswer(r.answer)}</DataTableCell>
                  <DataTableCell>
                    {r.marksAwarded != null ? `${r.marksAwarded}/${r.question.versions[0]?.marks ?? '?'}` : 'Pending'}
                  </DataTableCell>
                  <DataTableCell>
                    <Button size="sm" variant="outline" onClick={() => {
                      setGradeTarget(r);
                      setGradeMarks(r.marksAwarded != null ? String(r.marksAwarded) : '');
                    }}>
                      Grade
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </table>
          {!subjective?.length && <p className="p-8 text-center text-muted-foreground">No subjective responses for this exam.</p>}
        </DataTable>
      )}

      {isLoading && selectedExam && <div>Loading results...</div>}
      {isError && selectedExam && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load results: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      )}

      {selectedExam && !isLoading && !isError && unpublishedCount > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          {unpublishedCount} result(s) are in draft. Click <strong>Publish</strong> so candidates can see them under My Exams → Results.
        </p>
      )}

      {selectedExam && !isLoading && !isError && !showGrading && (
        <DataTable>
          <table className="w-full">
            <DataTableHeader>
              <DataTableHead>Rank</DataTableHead>
              <DataTableHead>Candidate</DataTableHead>
              <DataTableHead>Score</DataTableHead>
              <DataTableHead>%</DataTableHead>
              <DataTableHead>Status</DataTableHead>
            </DataTableHeader>
            <tbody>
              {(results?.items || []).map((r: { id: string; rank?: number; totalScore: number; maxScore: number; percentage: number; published: boolean; candidate: { user: { firstName: string; lastName: string } } }) => (
                <DataTableRow key={r.id}>
                  <DataTableCell className="font-bold text-primary">{r.rank ?? '—'}</DataTableCell>
                  <DataTableCell className="font-medium">{r.candidate.user.firstName} {r.candidate.user.lastName}</DataTableCell>
                  <DataTableCell>{r.totalScore}/{r.maxScore}</DataTableCell>
                  <DataTableCell>{r.percentage.toFixed(1)}%</DataTableCell>
                  <DataTableCell><Badge variant={r.published ? 'success' : 'secondary'}>{r.published ? 'Published' : 'Draft'}</Badge></DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </table>
          {!results?.items?.length && <p className="p-8 text-center text-muted-foreground">No results yet.</p>}
        </DataTable>
      )}

      <Dialog open={!!gradeTarget} onOpenChange={(open) => !open && setGradeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade response</DialogTitle>
            <DialogDescription>
              {gradeTarget?.question.title} — max {gradeTarget?.question.versions[0]?.marks ?? 0} marks
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
            {gradeTarget ? formatAnswer(gradeTarget.answer) : ''}
          </div>
          <div className="space-y-2">
            <Label>Marks awarded</Label>
            <Input type="number" min={0} step={0.5} value={gradeMarks} onChange={(e) => setGradeMarks(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeTarget(null)}>Cancel</Button>
            <Button
              disabled={gradeMutation.isPending || !gradeTarget}
              onClick={() => gradeTarget && gradeMutation.mutate({
                sessionId: gradeTarget.sessionId,
                questionId: gradeTarget.questionId,
                marks: parseFloat(gradeMarks) || 0,
              })}
            >
              Save grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

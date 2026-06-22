'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { examsApi, resultsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, DataTableHeader, DataTableHead, DataTableRow, DataTableCell } from '@/components/layout/data-table';
import { Download } from 'lucide-react';

export default function ResultsPage() {
  const { accessToken } = useRequireAuth(true);
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = useState('');

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

  const unpublishedCount = (results?.items || []).filter((r: { published: boolean }) => !r.published).length;

  const rankMutation = useMutation({
    mutationFn: (examId: string) => resultsApi.rank(accessToken!, examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results', selectedExam] }),
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) => resultsApi.publish(accessToken!, examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results', selectedExam] });
      toast({ title: 'Results published', variant: 'success' });
    },
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

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="View, rank, and publish examination results">
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
          <option value="">Select exam...</option>
          {(exams?.items || []).map((e: { id: string; title: string; code: string }) => (
            <option key={e.id} value={e.id}>{e.code} — {e.title}</option>
          ))}
        </select>
        {selectedExam && (
          <>
            <Button variant="outline" onClick={() => rankMutation.mutate(selectedExam)}>Calculate Ranks</Button>
            <Button onClick={() => publishMutation.mutate(selectedExam)}>Publish</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export</Button>
          </>
        )}
      </PageHeader>

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

      {selectedExam && !isLoading && !isError && (
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
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { questionsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Search, Sparkles, Plus, HelpCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, DataTableHeader, DataTableHead, DataTableRow, DataTableCell, EmptyState } from '@/components/layout/data-table';
import { TableSkeleton } from '@/components/ui/skeleton';

export default function QuestionsPage() {
  const { accessToken } = useRequireAuth(true);
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [form, setForm] = useState({
    title: '', type: 'MCQ', difficulty: 'MEDIUM',
    content: '', optionA: '', optionB: '', optionC: '', optionD: '',
    correctAnswer: 'a', correctAnswers: [] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['questions', search],
    queryFn: () => questionsApi.list(accessToken!, 1, { search }),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () => questionsApi.create(accessToken!, {
      title: form.title,
      type: form.type,
      difficulty: form.difficulty,
      content: { text: form.content },
      options: { a: form.optionA, b: form.optionB, c: form.optionC, d: form.optionD },
      correctAnswer: form.type === 'MSQ'
        ? { value: form.correctAnswers }
        : { value: form.correctAnswer },
      marks: 2,
      negativeMarks: 0.5,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questions'] }); setShowCreate(false); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => questionsApi.approve(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast({ title: 'Question approved', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.remove(accessToken!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      setDeleteTarget(null);
      toast({ title: 'Question deleted from bank', variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Cannot delete', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <TableSkeleton rows={5} cols={5} />;

  const items = data?.items || [];

  return (
    <div className="space-y-8">
      <PageHeader title="Question Bank" description="MCQ & MSQ questions with approval workflow" badge={`${items.length} total`}>
        <div className="relative w-56">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search questions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/ai"><Sparkles className="mr-2 h-4 w-4" />Generate with AI</Link>
        </Button>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? 'Cancel' : 'Add Question'}
        </Button>
      </PageHeader>

      {showCreate && (
        <Card className="surface-card border-primary/20">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base font-bold">New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label>
                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="MCQ">MCQ (Single Answer)</option>
                  <option value="MSQ">MSQ (Multiple Answers)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Question Text</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              {(['A', 'B', 'C', 'D'] as const).map((l) => (
                <div key={l} className="space-y-2"><Label>Option {l}</Label><Input value={form[`option${l}` as keyof typeof form] as string} onChange={(e) => setForm({ ...form, [`option${l}`]: e.target.value })} /></div>
              ))}
            </div>
            {form.type === 'MSQ' ? (
              <div className="space-y-2"><Label>Correct Answers</Label>
                <div className="flex gap-4">
                  {(['a', 'b', 'c', 'd'] as const).map((l) => (
                    <label key={l} className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" className="rounded border-input" checked={form.correctAnswers.includes(l)}
                        onChange={(e) => setForm({
                          ...form,
                          correctAnswers: e.target.checked
                            ? [...form.correctAnswers, l]
                            : form.correctAnswers.filter((x) => x !== l),
                        })} />
                      {l.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2"><Label>Correct Answer</Label>
                <select className="form-select" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>
                  <option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>
                </select>
              </div>
            )}
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Save Question</Button>
          </CardContent>
        </Card>
      )}

      <DataTable>
        <table className="w-full">
          <DataTableHeader>
            <DataTableHead>Title</DataTableHead>
            <DataTableHead>Type</DataTableHead>
            <DataTableHead>Difficulty</DataTableHead>
            <DataTableHead>Status</DataTableHead>
            <DataTableHead>Approve</DataTableHead>
            <DataTableHead>Delete</DataTableHead>
          </DataTableHeader>
          <tbody>
            {items.map((q: { id: string; title: string; type: string; difficulty: string; status: string }) => (
              <DataTableRow key={q.id}>
                <DataTableCell className="font-medium">{q.title || 'Untitled'}</DataTableCell>
                <DataTableCell><Badge variant="outline">{q.type}</Badge></DataTableCell>
                <DataTableCell className="text-muted-foreground">{q.difficulty}</DataTableCell>
                <DataTableCell><Badge variant={q.status === 'APPROVED' ? 'success' : 'warning'}>{q.status}</Badge></DataTableCell>
                <DataTableCell>
                  {q.status !== 'APPROVED' ? (
                    <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(q.id)}>Approve</Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </DataTableCell>
                <DataTableCell>
                  {can(Permission.QUESTION_DELETE) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget({ id: q.id, title: q.title || 'Untitled' })}
                    >
                      Delete
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </table>
        {!items.length && <EmptyState icon={HelpCircle} title="No questions found" description="Add questions manually or generate with AI." />}
      </DataTable>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete question?</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium text-foreground">{deleteTarget?.title}</span> from the question bank.
              Cannot be undone if used in a published exam or already answered by candidates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete from bank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

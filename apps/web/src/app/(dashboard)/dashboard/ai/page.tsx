'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { aiApi, questionsApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Brain, Wand2, Zap, CheckCircle2 } from 'lucide-react';

export default function AiStudioPage() {
  const { accessToken } = useRequireAuth(true);
  const [topic, setTopic] = useState('General Aptitude');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [generated, setGenerated] = useState<{
    questions: { title: string; content: { text: string }; options: Record<string, string>; correctAnswer: { value: string }; type: string; difficulty: string; marks: number; negativeMarks: number }[];
    source: string;
  } | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateQuestions(accessToken!, { topic, count, difficulty, type: 'MCQ' }),
    onSuccess: (data) => {
      setGenerated(data as typeof generated);
      toast({ title: 'Questions generated', description: `Source: ${(data as { source: string }).source}`, variant: 'success' });
    },
    onError: (e: Error) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generated?.questions) return;
      for (const q of generated.questions) {
        await questionsApi.create(accessToken!, {
          title: q.title,
          type: q.type || 'MCQ',
          difficulty: q.difficulty || difficulty,
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer,
          marks: q.marks || 2,
          negativeMarks: q.negativeMarks || 0.5,
        });
      }
    },
    onSuccess: () => toast({ title: 'Saved to Question Bank', variant: 'success' }),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Studio"
        description="Generate questions, analyze exams, and power intelligent proctoring"
        badge="AI Powered"
      />

      <div className="hero-banner">
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
            <Sparkles className="h-7 w-7 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Intelligent Exam Content Engine</h3>
            <p className="text-sm text-muted-foreground">Generate production-ready questions in seconds — works with or without OpenAI API key.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Wand2, title: 'Question Generator', desc: 'MCQ & MSQ from any topic', color: 'text-violet-600 bg-violet-500/10' },
          { icon: Brain, title: 'Exam Insights', desc: 'AI performance analysis', color: 'text-blue-600 bg-blue-500/10' },
          { icon: Zap, title: 'Smart Proctoring', desc: 'Real-time risk scoring', color: 'text-amber-600 bg-amber-500/10' },
        ].map((f) => (
          <Card key={f.title} className="surface-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
                <f.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="surface-card border-violet-500/20">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            AI Question Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="JavaScript, Aptitude..." /></div>
            <div className="space-y-2"><Label>Count</Label><Input type="number" min={1} max={10} value={count} onChange={(e) => setCount(+e.target.value)} /></div>
            <div className="space-y-2"><Label>Difficulty</Label>
              <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>

          {generated && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Source: {generated.source === 'openai' ? 'OpenAI GPT' : 'AI Template Engine'}</Badge>
                <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Save All to Question Bank
                </Button>
              </div>
              {generated.questions.map((q, i) => (
                <Card key={i} className="border border-border/60 bg-muted/20">
                  <CardContent className="p-5">
                    <p className="font-medium">{q.title}</p>
                    <p className="mt-1 text-sm">{q.content.text}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                      {Object.entries(q.options).map(([k, v]) => (
                        <span key={k} className={q.correctAnswer.value === k ? 'font-semibold text-primary' : ''}>
                          {k.toUpperCase()}. {v}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

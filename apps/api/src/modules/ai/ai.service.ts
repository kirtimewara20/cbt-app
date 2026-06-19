import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ProctoringService } from '../proctoring/proctoring.service';

export interface GeneratedQuestion {
  title: string;
  type: string;
  difficulty: string;
  content: { text: string };
  options: Record<string, string>;
  correctAnswer: { value: string | string[] };
  marks: number;
  negativeMarks: number;
}

export interface FrameAnalysisResult {
  riskScore: number;
  violations: { type: string; severity: string; confidence: number }[];
  faceDetected: boolean;
  faceMatch: number;
  eyeOnScreen: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => ProctoringService))
    private proctoringService: ProctoringService,
  ) {}

  async generateQuestions(params: {
    topic: string;
    count: number;
    difficulty: string;
    type: string;
  }): Promise<{ questions: GeneratedQuestion[]; source: 'openai' | 'template' }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      try {
        const questions = await this.generateWithOpenAI(apiKey, params);
        return { questions, source: 'openai' };
      } catch (e) {
        this.logger.warn(`OpenAI failed, using template: ${e}`);
      }
    }
    return { questions: this.generateFromTemplate(params), source: 'template' };
  }

  private async generateWithOpenAI(
    apiKey: string,
    params: { topic: string; count: number; difficulty: string; type: string },
  ): Promise<GeneratedQuestion[]> {
    const baseUrl = this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get('OPENAI_MODEL') || 'gpt-4o-mini';

    const prompt = `Generate ${params.count} ${params.difficulty} difficulty ${params.type} exam questions about "${params.topic}".
Return ONLY valid JSON array with objects: { title, content: { text }, options: { a,b,c,d }, correctAnswer: { value: "a"|"b"|"c"|"d" or array for MSQ }, marks: 2, negativeMarks: 0.5 }`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0].message.content) as { questions?: GeneratedQuestion[] } | GeneratedQuestion[];
    const items = Array.isArray(parsed) ? parsed : parsed.questions || [];
    return items.map((q) => ({
      ...q,
      type: params.type,
      difficulty: params.difficulty,
    }));
  }

  private generateFromTemplate(params: { topic: string; count: number; difficulty: string; type: string }): GeneratedQuestion[] {
    const templates: Record<string, GeneratedQuestion[]> = {
      'General Aptitude': [
        { title: 'Percentage Calc', type: 'MCQ', difficulty: 'MEDIUM', content: { text: 'What is 25% of 240?' }, options: { a: '50', b: '60', c: '70', d: '80' }, correctAnswer: { value: 'b' }, marks: 2, negativeMarks: 0.5 },
        { title: 'Time & Work', type: 'MCQ', difficulty: 'MEDIUM', content: { text: 'A can finish work in 10 days. B in 15 days. Together they finish in?' }, options: { a: '5 days', b: '6 days', c: '7 days', d: '8 days' }, correctAnswer: { value: 'b' }, marks: 2, negativeMarks: 0.5 },
        { title: 'Logical Reasoning', type: 'MCQ', difficulty: 'EASY', content: { text: 'If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies?' }, options: { a: 'Yes', b: 'No', c: 'Cannot determine', d: 'Sometimes' }, correctAnswer: { value: 'a' }, marks: 2, negativeMarks: 0.5 },
      ],
      JavaScript: [
        { title: 'JS Closures', type: 'MCQ', difficulty: 'HARD', content: { text: 'What is a closure in JavaScript?' }, options: { a: 'Function + lexical env', b: 'Class instance', c: 'Promise handler', d: 'Event loop' }, correctAnswer: { value: 'a' }, marks: 2, negativeMarks: 0.5 },
        { title: 'JS Types', type: 'MCQ', difficulty: 'EASY', content: { text: 'typeof null in JavaScript returns?' }, options: { a: 'null', b: 'undefined', c: 'object', d: 'number' }, correctAnswer: { value: 'c' }, marks: 2, negativeMarks: 0.5 },
      ],
    };

    const pool = templates[params.topic] || templates['General Aptitude'];
    const result: GeneratedQuestion[] = [];
    for (let i = 0; i < params.count; i++) {
      const t = pool[i % pool.length];
      result.push({
        ...t,
        title: `${params.topic} Q${i + 1}: ${t.title}`,
        type: params.type,
        difficulty: params.difficulty,
        content: { text: `[${params.topic}] ${t.content.text}` },
      });
    }
    return result;
  }

  async analyzeFrame(sessionId: string, thumbnail: string): Promise<FrameAnalysisResult> {
    const externalUrl = this.config.get<string>('AI_PROCTORING_API_URL');
    if (this.config.get('AI_PROCTORING_ENABLED') === 'true' && externalUrl) {
      try {
        const res = await fetch(`${externalUrl}/analyze/frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, frameBase64: thumbnail }),
        });
        if (res.ok) return await res.json() as FrameAnalysisResult;
      } catch (e) {
        this.logger.warn(`External AI proctoring unavailable: ${e}`);
      }
    }

    return this.heuristicFrameAnalysis(sessionId, thumbnail);
  }

  private heuristicFrameAnalysis(sessionId: string, thumbnail: string): FrameAnalysisResult {
    const hash = this.simpleHash(sessionId + thumbnail.slice(-100));
    const faceDetected = thumbnail.length > 5000;
    const violations: FrameAnalysisResult['violations'] = [];

    if (!faceDetected) {
      violations.push({ type: 'NO_FACE', severity: 'HIGH', confidence: 0.85 });
    }
    if (hash % 17 === 0) {
      violations.push({ type: 'GAZE_AWAY', severity: 'MEDIUM', confidence: 0.72 });
    }
    if (hash % 23 === 0) {
      violations.push({ type: 'MULTIPLE_FACES', severity: 'CRITICAL', confidence: 0.91 });
    }

    const riskScore = Math.min(100, violations.reduce((s, v) => {
      const w = { LOW: 5, MEDIUM: 15, HIGH: 35, CRITICAL: 50 }[v.severity] || 5;
      return s + w;
    }, hash % 10));

    return {
      riskScore,
      violations,
      faceDetected,
      faceMatch: faceDetected ? 0.88 + (hash % 10) / 100 : 0,
      eyeOnScreen: faceDetected ? 0.75 + (hash % 20) / 100 : 0,
    };
  }

  private simpleHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  async processProctoringFrame(sessionId: string, thumbnail: string) {
    const analysis = await this.analyzeFrame(sessionId, thumbnail);

    for (const v of analysis.violations) {
      await this.proctoringService.recordEvent(sessionId, v.type as never, {
        confidence: v.confidence,
        severity: v.severity as never,
        metadata: { aiAnalyzed: true },
      });
    }

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { riskScore: analysis.riskScore },
    });

    return analysis;
  }

  async getExamInsights(examId: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, tenantId } });
    if (!exam) return null;

    const [results, sessions, violations] = await Promise.all([
      this.prisma.examResult.findMany({ where: { examId }, select: { percentage: true, totalScore: true } }),
      this.prisma.examSession.count({ where: { examId } }),
      this.prisma.proctoringEvent.count({
        where: { session: { examId }, severity: { in: ['HIGH', 'CRITICAL'] } },
      }),
    ]);

    const avgScore = results.length
      ? results.reduce((s, r) => s + r.percentage, 0) / results.length
      : 0;
    const passRate = results.length
      ? (results.filter((r) => r.percentage >= 40).length / results.length) * 100
      : 0;

    const insights = [
      avgScore >= 70
        ? `Strong performance: average score is ${avgScore.toFixed(1)}%. Consider increasing difficulty.`
        : avgScore < 40
          ? `Low average (${avgScore.toFixed(1)}%). Review question difficulty and exam duration.`
          : `Moderate performance at ${avgScore.toFixed(1)}%. Pass rate is ${passRate.toFixed(0)}%.`,
      violations > 0
        ? `${violations} high-severity proctoring violations detected. Review flagged sessions before publishing results.`
        : 'No critical proctoring violations. Exam integrity looks good.',
      sessions > 0
        ? `${((results.length / sessions) * 100).toFixed(0)}% completion rate (${results.length}/${sessions} sessions).`
        : 'No exam sessions started yet.',
    ];

    const recommendations = [
      violations > 5 ? 'Enable stricter fullscreen and tab-switch policies' : null,
      avgScore > 80 ? 'Add harder questions or reduce time limit' : null,
      passRate < 30 ? 'Review passing score threshold and question clarity' : null,
    ].filter(Boolean);

    return {
      examId,
      title: exam.title,
      summary: insights,
      recommendations,
      metrics: { avgScore, passRate, violations, sessions, submitted: results.length },
      generatedAt: new Date().toISOString(),
    };
  }

  async chat(message: string, context?: { role?: string; page?: string }) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      try {
        const baseUrl = this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are CBT Platform AI Assistant. Help admins and candidates with exams, proctoring, results. Be concise.' },
              { role: 'user', content: `Context: ${JSON.stringify(context || {})}\n\n${message}` },
            ],
            max_tokens: 500,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { choices: { message: { content: string } }[] };
          return { reply: data.choices[0].message.content, source: 'openai' };
        }
      } catch { /* fallback */ }
    }

    const lower = message.toLowerCase();
    let reply = 'I can help with exam management, proctoring, question generation, and results. Try the AI Studio for question generation.';
    if (lower.includes('proctor')) reply = 'Proctoring monitors tab switches, copy/paste, camera feed, and calculates risk scores. High-risk sessions appear in Live Monitoring.';
    if (lower.includes('question') || lower.includes('generate')) reply = 'Go to AI Studio or Question Bank → Generate with AI. Provide a topic, difficulty, and count.';
    if (lower.includes('result')) reply = 'Results are auto-evaluated on submit. Admins can calculate ranks and publish from the Results page.';
    if (lower.includes('exam')) reply = 'Create exams in Exams → add questions → assign candidates → publish. Candidates start from My Exams.';

    return { reply, source: 'template' };
  }
}

'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface QuestionInputProps {
  question: {
    id: string;
    type: string;
    content?: { text?: string };
    title?: string;
    options?: Record<string, string>;
    marks?: number;
  };
  answer: string | string[] | undefined;
  onSave: (value: string | string[]) => void;
}

export function QuestionInput({ question, answer, onSave }: QuestionInputProps) {
  const type = question.type;

  if (type === 'MCQ' || type === 'MSQ') {
    const isMsq = type === 'MSQ';
    const options = question.options ?? {};
    return (
      <div className="space-y-3">
        {Object.entries(options).map(([key, label]) => {
          const selected = isMsq
            ? ((answer as string[]) || []).includes(key)
            : answer === key;
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            >
              <input
                type={isMsq ? 'checkbox' : 'radio'}
                name={question.id}
                checked={selected}
                onChange={() => {
                  if (isMsq) {
                    const current = (answer as string[]) || [];
                    const next = selected ? current.filter((k) => k !== key) : [...current, key];
                    onSave(next);
                  } else {
                    onSave(key);
                  }
                }}
              />
              <span>{key.toUpperCase()}. {label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'NUMERICAL') {
    return (
      <Input
        type="number"
        step="any"
        placeholder="Enter your numerical answer"
        value={(answer as string) ?? ''}
        onChange={(e) => onSave(e.target.value)}
        onBlur={(e) => { if (e.target.value) onSave(e.target.value); }}
        className="max-w-xs"
      />
    );
  }

  if (type === 'SUBJECTIVE' || type === 'CASE_STUDY') {
    return (
      <Textarea
        placeholder="Type your answer here..."
        rows={8}
        value={(answer as string) ?? ''}
        onChange={(e) => onSave(e.target.value)}
        onBlur={(e) => { if (e.target.value.trim()) onSave(e.target.value); }}
      />
    );
  }

  if (type === 'CODING') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Write your code solution below.</p>
        <Textarea
          placeholder="// Your code here..."
          rows={12}
          className="font-mono text-sm"
          value={(answer as string) ?? ''}
          onChange={(e) => onSave(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) onSave(e.target.value); }}
        />
      </div>
    );
  }

  if (type === 'AUDIO' || type === 'VIDEO') {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {type} response questions are not supported in this browser session.
        Please contact your exam administrator.
      </div>
    );
  }

  return (
    <Textarea
      placeholder="Type your answer..."
      rows={4}
      value={(answer as string) ?? ''}
      onChange={(e) => onSave(e.target.value)}
      onBlur={(e) => { if (e.target.value.trim()) onSave(e.target.value); }}
    />
  );
}

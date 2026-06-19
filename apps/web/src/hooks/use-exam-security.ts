'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { proctoringApi } from '@/lib/api';
import type { ExamSecurityPolicy } from '@cbt/shared';

interface UseExamSecurityOptions {
  sessionId: string;
  accessToken: string;
  policy?: Partial<ExamSecurityPolicy>;
  candidateLabel?: string;
  enabled?: boolean;
}

export function useExamSecurity({
  sessionId,
  accessToken,
  policy = {},
  candidateLabel = '',
  enabled = true,
}: UseExamSecurityOptions) {
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reportedRef = useRef(new Set<string>());

  const report = useCallback(async (
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    metadata?: Record<string, unknown>,
  ) => {
    const key = `${eventType}-${Date.now()}`;
    if (reportedRef.current.has(eventType) && severity === 'LOW') return;
    reportedRef.current.add(eventType);
    setViolations((v) => v + 1);
    try {
      await proctoringApi.recordEvent(accessToken, { sessionId, eventType, severity, metadata });
    } catch { /* silent */ }
    setTimeout(() => reportedRef.current.delete(eventType), 5000);
  }, [accessToken, sessionId]);

  const enterFullscreen = useCallback(async () => {
    if (!policy.fullscreen) return true;
    if (document.fullscreenElement) {
      setIsFullscreen(true);
      return true;
    }
    try {
      const el = document.documentElement;
      const request = el.requestFullscreen
        ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
      if (!request) return false;
      await request.call(el);
      setIsFullscreen(true);
      return true;
    } catch {
      return false;
    }
  }, [policy.fullscreen]);

  useEffect(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.hidden) {
        report('TAB_SWITCH', 'HIGH', { action: 'tab_hidden' });
      }
    };

    const onBlur = () => report('WINDOW_BLUR', 'MEDIUM', { action: 'window_blur' });

    const onCopy = (e: ClipboardEvent) => {
      if (policy.blockCopyPaste) {
        e.preventDefault();
        report('COPY_ATTEMPT', 'MEDIUM');
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (policy.blockCopyPaste) {
        e.preventDefault();
        report('PASTE_ATTEMPT', 'MEDIUM');
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (policy.blockRightClick) {
        e.preventDefault();
        report('RIGHT_CLICK', 'LOW');
      }
    };

    const onFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && policy.fullscreen) {
        report('FULLSCREEN_EXIT', 'HIGH');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (policy.blockCopyPaste && (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        report('COPY_ATTEMPT', 'MEDIUM', { key: e.key });
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        if (policy.detectDevTools) report('DEVTOOLS', 'HIGH');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, policy, report]);

  const watermarkEnabled = policy.watermark?.enabled ?? false;

  return { violations, isFullscreen, enterFullscreen, watermarkEnabled, candidateLabel };
}

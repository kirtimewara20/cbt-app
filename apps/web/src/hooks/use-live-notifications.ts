'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';
import { getProctoringSocket } from '@/lib/socket';
import { dashboardApi } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { Permission } from '@cbt/shared';

export function useLiveNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const add = useNotificationStore((s) => s.add);
  const { can } = usePermissions();
  const seenSubmissions = useRef(new Set<string>());
  const submissionsInitialized = useRef(false);

  useEffect(() => {
    if (!accessToken || !can(Permission.PROCTORING_MONITOR)) return;

    const socket = getProctoringSocket();
    socket.connect();
    socket.emit('proctoring:join-monitoring');

    const onViolation = (data: { sessionId: string; type: string; severity: string; timestamp: string }) => {
      add({
        type: 'violation',
        title: `Proctoring alert: ${data.type}`,
        message: `Session ${data.sessionId.slice(0, 8)} · ${data.severity}`,
        timestamp: data.timestamp,
      });
    };

    socket.on('proctoring:violation', onViolation);

    return () => {
      socket.off('proctoring:violation', onViolation);
    };
  }, [accessToken, can, add]);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    async function pollSubmissions() {
      try {
        const data = await dashboardApi.stats(accessToken!) as {
          recentSubmissions?: { id: string; candidateName: string; examTitle: string; submittedAt: string }[];
        };
        if (cancelled) return;
        for (const sub of data.recentSubmissions || []) {
          if (!submissionsInitialized.current) {
            seenSubmissions.current.add(sub.id);
            continue;
          }
          if (seenSubmissions.current.has(sub.id)) continue;
          seenSubmissions.current.add(sub.id);
          if (seenSubmissions.current.size > 100) {
            const first = seenSubmissions.current.values().next().value;
            if (first) seenSubmissions.current.delete(first);
          }
          add({
            type: 'submission',
            title: `${sub.candidateName} submitted`,
            message: sub.examTitle,
            timestamp: sub.submittedAt,
          });
        }
        submissionsInitialized.current = true;
      } catch {
        /* retry on next interval */
      }
    }

    pollSubmissions();
    const interval = setInterval(pollSubmissions, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, add]);
}

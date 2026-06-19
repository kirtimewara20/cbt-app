import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { PRODUCTION_WS_ORIGIN } from './production-api';

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
    return PRODUCTION_WS_ORIGIN;
  }
  return 'http://localhost:4000';
}

let proctoringSocket: Socket | null = null;

export function getProctoringSocket(): Socket {
  if (proctoringSocket?.connected) return proctoringSocket;

  const { accessToken, user } = useAuthStore.getState();
  proctoringSocket = io(`${getWsUrl()}/proctoring`, {
    auth: {
      token: accessToken,
      tenantId: user?.tenantId || 'default',
      role: user?.roles?.includes('CANDIDATE') ? 'candidate' : 'admin',
    },
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });

  return proctoringSocket;
}

export function disconnectSockets() {
  proctoringSocket?.disconnect();
  proctoringSocket = null;
}

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

let proctoringSocket: Socket | null = null;

export function getProctoringSocket(): Socket {
  if (proctoringSocket?.connected) return proctoringSocket;

  const { accessToken, user } = useAuthStore.getState();
  proctoringSocket = io(`${WS_URL}/proctoring`, {
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

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    if (hostname.endsWith('.vercel.app')) {
      return 'wss://cbt-api-ktkr.onrender.com';
    }
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${hostname}`;
  }

  return 'http://localhost:4000';
}

let proctoringSocket: Socket | null = null;
let examSocket: Socket | null = null;

function socketAuth() {
  const { accessToken, user } = useAuthStore.getState();
  return {
    token: accessToken,
    tenantId: user?.tenantId || 'default',
    role: user?.roles?.some((r) => r === 'CANDIDATE') ? 'candidate' : 'admin',
  };
}

function applySocketAuth(socket: Socket) {
  socket.auth = socketAuth();
}

export function getProctoringSocket(): Socket {
  if (proctoringSocket) {
    applySocketAuth(proctoringSocket);
    return proctoringSocket;
  }

  proctoringSocket = io(`${getWsUrl()}/proctoring`, {
    auth: socketAuth(),
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
  });

  proctoringSocket.on('connect_error', () => applySocketAuth(proctoringSocket!));

  return proctoringSocket;
}

export function getExamSocket(): Socket {
  if (examSocket) {
    applySocketAuth(examSocket);
    return examSocket;
  }

  examSocket = io(`${getWsUrl()}/exam`, {
    auth: socketAuth(),
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
  });

  examSocket.on('connect_error', () => applySocketAuth(examSocket!));

  return examSocket;
}

export function disconnectExamSocket() {
  examSocket?.disconnect();
  examSocket = null;
}

export function disconnectSockets() {
  proctoringSocket?.disconnect();
  proctoringSocket = null;
  disconnectExamSocket();
}

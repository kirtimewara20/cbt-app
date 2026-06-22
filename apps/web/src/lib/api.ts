import { useAuthStore } from '@/stores/auth-store';
import { isAdmin, isCandidate, normalizeRoles } from './roles';

const PRODUCTION_API =
  process.env.NEXT_PUBLIC_API_URL || 'https://cbt-api-ktkr.onrender.com/api/v1';

/** Browser calls Render directly (CORS allows *.vercel.app). Server-side uses the Vercel proxy route. */
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    }
    return PRODUCTION_API.replace(/\/$/, '');
  }
  const base = process.env.API_PROXY_URL || 'https://cbt-api-ktkr.onrender.com';
  return `${base.replace(/\/$/, '')}/api/v1`;
}

function isHtmlResponse(raw: string): boolean {
  const trimmed = raw.trimStart();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

function formatNonJsonError(raw: string, ok: boolean): string {
  if (ok) return 'Invalid response from server';
  const lower = raw.toLowerCase();
  if (lower.includes('vercel.com/login') || lower.includes('authentication required')) {
    return 'This preview link requires Vercel login. Use https://cbt-app-jade.vercel.app instead.';
  }
  if (lower.includes('currently unavailable') || lower.includes('onrender.com')) {
    return 'API is waking up (free tier). Wait 30–60 seconds, then try again.';
  }
  return 'API unavailable. Wait 30 seconds and try again.';
}

const COLD_START_RETRY_MS = 15_000;
const COLD_START_MAX_ATTEMPTS = 3;

async function fetchWithColdStartRetry(url: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < COLD_START_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, init);
      lastResponse = response;
      if (response.ok) return response;
      const raw = await response.clone().text();
      const retryable =
        response.status >= 502 ||
        response.status === 503 ||
        isHtmlResponse(raw);
      if (!retryable || attempt === COLD_START_MAX_ATTEMPTS - 1) return response;
    } catch {
      if (attempt === COLD_START_MAX_ATTEMPTS - 1) throw new Error(formatNonJsonError('', false));
    }
    await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_MS));
  }
  return lastResponse!;
}

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_TENANT_ID || 'default';

function getTenantId(): string {
  return DEFAULT_TENANT;
}

function getAuthTenantId(): string {
  if (typeof window !== 'undefined') {
    const tenantId = useAuthStore.getState().user?.tenantId;
    if (tenantId) return tenantId;
  }
  return DEFAULT_TENANT;
}

export interface ApiOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, updateTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${getApiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getAuthTenantId() },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Refresh failed');
    const payload = data.data ?? data;
    updateTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    useAuthStore.getState().logout().finally(() => {
      if (typeof window !== 'undefined') window.location.href = '/login';
    });
    return null;
  }
}

export async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, skipAuth, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let authToken = token;
  if (!skipAuth && !authToken) {
    authToken = useAuthStore.getState().accessToken ?? undefined;
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  headers['X-Tenant-ID'] = skipAuth ? getTenantId() : getAuthTenantId();

  const requestUrl = `${getApiUrl()}${endpoint}`;
  const useColdStartRetry =
    typeof window !== 'undefined' &&
    (endpoint.startsWith('/auth/') || endpoint.includes('/health'));

  let response = useColdStartRetry
    ? await fetchWithColdStartRetry(requestUrl, { ...fetchOptions, headers })
    : await fetch(requestUrl, { ...fetchOptions, headers });

  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/refresh')) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    const newToken = await refreshPromise;
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(requestUrl, { ...fetchOptions, headers });
    }
  }

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(formatNonJsonError(raw, response.ok));
  }
  if (!response.ok) {
    throw new Error(formatApiError(data));
  }
  return (data as { data?: T }).data ?? (data as T);
}

function formatApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed';
  const record = data as Record<string, unknown>;
  const nested =
    record.error && typeof record.error === 'object'
      ? (record.error as Record<string, unknown>).message
      : undefined;
  const message = nested ?? record.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.length > 0) return message;
  return 'Request failed';
}

function authHeaders(token: string) {
  return { token, headers: { 'X-Device-Fingerprint': getFingerprint() } };
}

export function getFingerprint() {
  if (typeof window === 'undefined') return 'server';
  let fp = localStorage.getItem('device-fp');
  if (!fp) {
    fp = `fp-${navigator.userAgent.slice(0, 30)}-${Date.now()}`;
    localStorage.setItem('device-fp', fp);
  }
  return fp;
}

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ...body, deviceFingerprint: getFingerprint() }),
      skipAuth: true,
    }),
  register: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...body, deviceFingerprint: getFingerprint() }),
      skipAuth: true,
    }),
  verifyMfa: (body: { mfaToken: string; totpCode: string }) =>
    apiFetch('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(body),
      skipAuth: true,
    }),
  refresh: (refreshToken: string) =>
    apiFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }),
  forgotPassword: (email: string) =>
    apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, tenantId: DEFAULT_TENANT }),
      skipAuth: true,
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
      skipAuth: true,
    }),
  logout: (token: string) =>
    apiFetch('/auth/logout', { method: 'POST', ...authHeaders(token) }),
  sessions: (token: string) => apiFetch('/auth/sessions', authHeaders(token)),
  loginHistory: (token: string) => apiFetch('/auth/login-history', authHeaders(token)),
};

export const dashboardApi = {
  stats: (token: string) => apiFetch('/analytics/dashboard', authHeaders(token)),
};

export const examsApi = {
  list: (token: string, page = 1, search = '') =>
    apiFetch(`/exams?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`, authHeaders(token)),
  get: (token: string, id: string) => apiFetch(`/exams/${id}`, authHeaders(token)),
  create: (token: string, body: unknown) =>
    apiFetch('/exams', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  publish: (token: string, id: string) =>
    apiFetch(`/exams/${id}/publish`, { method: 'POST', ...authHeaders(token) }),
  assignCandidates: (token: string, id: string, candidateIds: string[]) =>
    apiFetch(`/exams/${id}/candidates`, {
      method: 'POST',
      body: JSON.stringify({ candidateIds }),
      ...authHeaders(token),
    }),
  addQuestions: (token: string, id: string, sectionId: string, questionIds: string[]) =>
    apiFetch(`/exams/${id}/questions`, {
      method: 'POST',
      body: JSON.stringify({ sectionId, questionIds }),
      ...authHeaders(token),
    }),
  removeQuestion: (token: string, examId: string, questionId: string) =>
    apiFetch(`/exams/${examId}/questions/${questionId}`, { method: 'DELETE', ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/exams/${id}`, { method: 'DELETE', ...authHeaders(token) }),
  myExams: (token: string) => apiFetch('/exams/my/available', authHeaders(token)),
};

export const questionsApi = {
  list: (token: string, page = 1, filters: { search?: string; type?: string; status?: string; limit?: number } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(filters.limit ?? 20) });
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    return apiFetch(`/questions?${params}`, authHeaders(token));
  },
  create: (token: string, body: unknown) =>
    apiFetch('/questions', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  approve: (token: string, id: string) =>
    apiFetch(`/questions/${id}/approve`, { method: 'POST', ...authHeaders(token) }),
  remove: (token: string, id: string) =>
    apiFetch(`/questions/${id}`, { method: 'DELETE', ...authHeaders(token) }),
};

export const candidatesApi = {
  list: (token: string, page = 1, search = '') =>
    apiFetch(`/candidates?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`, authHeaders(token)),
  create: (token: string, body: { email: string; password: string; firstName: string; lastName: string; registrationNumber?: string }) =>
    apiFetch('/candidates', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  dashboard: (token: string) => apiFetch('/candidates/me/dashboard', authHeaders(token)),
  admitCard: (token: string, examId: string) =>
    apiFetch(`/candidates/me/admit-card/${examId}`, authHeaders(token)),
  verifyKyc: (token: string, id: string, status: 'VERIFIED' | 'REJECTED') =>
    apiFetch(`/candidates/${id}/kyc/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      ...authHeaders(token),
    }),
};

export const usersApi = {
  list: (token: string, page = 1, search = '') =>
    apiFetch(`/users?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`, authHeaders(token)),
  create: (token: string, body: { email: string; password: string; firstName: string; lastName: string; roleIds?: string[] }) =>
    apiFetch('/users', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  get: (token: string, id: string) => apiFetch(`/users/${id}`, authHeaders(token)),
  roles: (token: string) => apiFetch('/users/meta/roles', authHeaders(token)),
  assignRole: (token: string, userId: string, roleId: string) =>
    apiFetch(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
      ...authHeaders(token),
    }),
  removeRole: (token: string, userId: string, roleId: string) =>
    apiFetch(`/users/${userId}/roles/${roleId}`, { method: 'DELETE', ...authHeaders(token) }),
};

export const resultsApi = {
  byExam: (token: string, examId: string) => apiFetch(`/results/exam/${examId}`, authHeaders(token)),
  exportCsv: async (token: string, examId: string) => {
    const res = await fetch(`${getApiUrl()}/results/exam/${examId}/export`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': getAuthTenantId() },
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
  my: (token: string) => apiFetch('/results/my', authHeaders(token)),
  certificate: (token: string, resultId: string) =>
    apiFetch(`/results/my/${resultId}/certificate`, authHeaders(token)),
  evaluate: (token: string, sessionId: string) =>
    apiFetch(`/results/evaluate/${sessionId}`, { method: 'POST', ...authHeaders(token) }),
  rank: (token: string, examId: string) =>
    apiFetch(`/results/rank/${examId}`, { method: 'POST', ...authHeaders(token) }),
  publish: (token: string, examId: string) =>
    apiFetch(`/results/publish/${examId}`, { method: 'POST', ...authHeaders(token) }),
};

export const examSessionApi = {
  start: (token: string, examId: string) =>
    apiFetch('/exam-sessions/start', {
      method: 'POST',
      body: JSON.stringify({ examId }),
      ...authHeaders(token),
    }),
  get: (token: string, sessionId: string) =>
    apiFetch(`/exam-sessions/${sessionId}`, authHeaders(token)),
  saveAnswer: (token: string, sessionId: string, body: unknown) =>
    apiFetch(`/exam-sessions/${sessionId}/responses`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
  markReview: (token: string, sessionId: string, questionId: string, marked: boolean) =>
    apiFetch(`/exam-sessions/${sessionId}/mark-review`, {
      method: 'POST',
      body: JSON.stringify({ questionId, marked }),
      ...authHeaders(token),
    }),
  submit: (token: string, sessionId: string) =>
    apiFetch(`/exam-sessions/${sessionId}/submit`, { method: 'POST', ...authHeaders(token) }),
  heartbeat: (token: string, sessionId: string) =>
    apiFetch(`/exam-sessions/${sessionId}/heartbeat`, { method: 'POST', ...authHeaders(token) }),
};

export const proctoringApi = {
  recordEvent: (token: string, body: {
    sessionId: string;
    eventType: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }) =>
    apiFetch('/proctoring/events', {
      method: 'POST',
      body: JSON.stringify(body),
      ...authHeaders(token),
    }),
  live: (token: string, examId: string) =>
    apiFetch(`/proctoring/sessions/${examId}/live`, authHeaders(token)),
  intervene: (token: string, sessionId: string, type: string, message?: string) =>
    apiFetch(`/proctoring/sessions/${sessionId}/intervene`, {
      method: 'POST',
      body: JSON.stringify({ type, message }),
      ...authHeaders(token),
    }),
};

export const auditApi = {
  list: (token: string, page = 1) => apiFetch(`/audit/logs?page=${page}&limit=20`, authHeaders(token)),
};

export const analyticsApi = {
  exam: (token: string, examId: string) => apiFetch(`/analytics/exam/${examId}`, authHeaders(token)),
};

export const aiApi = {
  status: (token: string) => apiFetch('/ai/status', authHeaders(token)),
  generateQuestions: (token: string, body: { topic: string; count?: number; difficulty?: string; type?: string }) =>
    apiFetch('/ai/questions/generate', { method: 'POST', body: JSON.stringify(body), ...authHeaders(token) }),
  examInsights: (token: string, examId: string) =>
    apiFetch(`/ai/insights/exam/${examId}`, authHeaders(token)),
  chat: (token: string, message: string, context?: { page?: string }) =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, context }), ...authHeaders(token) }),
};

export const tenantsApi = {
  get: (token: string, id: string) => apiFetch(`/tenants/${id}`, authHeaders(token)),
  updateBranding: (token: string, id: string, branding: unknown) =>
    apiFetch(`/tenants/${id}/branding`, {
      method: 'PATCH',
      body: JSON.stringify(branding),
      ...authHeaders(token),
    }),
};

export { isAdmin, isCandidate, normalizeRoles };


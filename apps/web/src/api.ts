import type {
  Host,
  HostInput,
  Project,
  ProjectInput,
  HistoryEntry,
  DashboardData,
  ActiveSession,
  LoginResponse,
} from '@mah/shared';

const TOKEN_KEY = 'mah_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError(401, 'No autenticado');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  // Dashboard
  dashboard: () => request<DashboardData>('/api/dashboard'),
  activeSessions: () => request<ActiveSession[]>('/api/sessions'),

  // Hosts
  hosts: () => request<Host[]>('/api/hosts'),
  host: (id: string) => request<Host>(`/api/hosts/${id}`),
  createHost: (data: HostInput) =>
    request<Host>('/api/hosts', { method: 'POST', body: JSON.stringify(data) }),
  updateHost: (id: string, data: Partial<HostInput>) =>
    request<Host>(`/api/hosts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHost: (id: string) => request<void>(`/api/hosts/${id}`, { method: 'DELETE' }),
  checkHost: (id: string) =>
    request<{ online: boolean; error?: string }>(`/api/hosts/${id}/check`, { method: 'POST' }),

  // Projects
  projects: (hostId?: string) =>
    request<Project[]>(`/api/projects${hostId ? `?hostId=${hostId}` : ''}`),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (data: ProjectInput) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<ProjectInput>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  logQuickCommand: (id: string, command: string, name?: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/quick-command`, {
      method: 'POST',
      body: JSON.stringify({ command, name }),
    }),
  killSession: (id: string) =>
    request<{ ok: boolean }>(`/api/projects/${id}/kill-session`, { method: 'POST' }),

  // History
  history: (limit = 50) => request<HistoryEntry[]>(`/api/history?limit=${limit}`),
  clearHistory: () => request<void>('/api/history', { method: 'DELETE' }),
};

// URL del WebSocket de terminal (token por query).
export function terminalWsUrl(projectId: string, cols: number, rows: number): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const token = getToken() ?? '';
  return `${proto}://${location.host}/api/terminal/${projectId}?token=${encodeURIComponent(
    token,
  )}&cols=${cols}&rows=${rows}`;
}

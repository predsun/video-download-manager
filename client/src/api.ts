import type {
  AppSettings,
  DashboardStats,
  ParseResult,
  SystemInfo,
  Task,
} from './types';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'UNKNOWN', status = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body != null) headers['Content-Type'] = 'application/json';

  // 客户端超时保护：避免服务端异常时页面无限等待
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('请求超时，请稍后重试', 'TIMEOUT', 408);
    }
    throw new ApiError('无法连接到服务器，请确认后端已启动', 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => ({}))) as T & ErrorBody;
  if (!res.ok) {
    const message = data.error?.message ?? `请求失败 (${res.status})`;
    throw new ApiError(message, data.error?.code ?? 'UNKNOWN', res.status);
  }
  return data;
}

export const api = {
  health: () => request<{ ok: boolean; version: string }>('/health'),

  // 解析需要拉取元数据，服务端上限约 120s，这里给 150s 余量
  parse: (url: string) =>
    request<ParseResult>('/tasks/parse', { method: 'POST', body: JSON.stringify({ url }) }, 150000),

  createTask: (url: string, quality?: string, format?: string) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify({ url, quality, format }) }),

  getTasks: () => request<Task[]>('/tasks'),
  getTask: (id: string) => request<Task>(`/tasks/${id}`),

  pause: (id: string) => request<Task>(`/tasks/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => request<Task>(`/tasks/${id}/resume`, { method: 'POST' }),
  cancel: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: 'POST' }),
  retry: (id: string) => request<Task>(`/tasks/${id}/retry`, { method: 'POST' }),
  remove: (id: string, deleteFile = false) =>
    request<{ ok: boolean }>(`/tasks/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' }),
  openFolder: (id: string) => request<{ ok: boolean }>(`/tasks/${id}/open`, { method: 'POST' }),

  getDashboard: () => request<DashboardStats>('/dashboard'),
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  getSystem: () => request<SystemInfo>('/system'),
};

export function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

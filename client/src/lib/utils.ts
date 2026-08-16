import type { TaskStatus } from '../types';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null || bytesPerSec <= 0) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours(),
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface PlatformMeta {
  label: string;
  color: string;
  ring: string;
}

export const PLATFORMS: Record<string, PlatformMeta> = {
  youtube: { label: 'YouTube', color: 'bg-red-500/10 text-red-600 dark:text-red-400', ring: 'ring-red-500/20' },
  bilibili: { label: 'Bilibili', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20' },
  vimeo: { label: 'Vimeo', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-500/20' },
  x: { label: 'X (Twitter)', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300', ring: 'ring-slate-500/20' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/20' },
  instagram: { label: 'Instagram', color: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400', ring: 'ring-fuchsia-500/20' },
  direct: { label: 'Direct Link', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
};

export function platformLabel(id: string): string {
  return PLATFORMS[id]?.label ?? id;
}

export interface StatusMeta {
  label: string;
  badge: string;
  dot: string;
  bar: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  waiting: {
    label: '等待中',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  parsing: {
    label: '解析中',
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
  },
  downloading: {
    label: '下载中',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
  },
  paused: {
    label: '已暂停',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
  },
  completed: {
    label: '已完成',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  failed: {
    label: '失败',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
  },
  cancelled: {
    label: '已取消',
    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
  },
};

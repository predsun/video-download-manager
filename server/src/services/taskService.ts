import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { getSettings } from './settings';
import { queue } from './queue';
import { broadcast, broadcastTask } from './broadcast';
import { detectPlatform } from '../platform/detect';
import { AppError, ErrorMessages } from '../errors';
import { Task, TaskStatus } from '../types';

const ACTIVE_STATUSES: TaskStatus[] = ['waiting', 'parsing', 'downloading', 'paused'];

// 创建任务：立即入队（不做网络解析），由队列工作线程异步完成「解析 → 下载」。
export async function createTask(input: { url: string; quality?: string; format?: string }): Promise<Task> {
  const url = input.url.trim();
  const platform = detectPlatform(url);
  if (!platform) {
    throw new AppError('UNSUPPORTED_PLATFORM', ErrorMessages.UNSUPPORTED_PLATFORM, 400);
  }

  const settings = getSettings();
  const quality = input.quality || settings.defaultQuality;
  const format = input.format || settings.defaultFormat;
  const db = getDb();

  // 重复下载检测：同一 URL 处于活跃状态时拒绝再次加入
  const dup = db
    .allTasks()
    .find((t) => t.url === url && ACTIVE_STATUSES.includes(t.status as TaskStatus));
  if (dup) {
    throw new AppError('DUPLICATE', ErrorMessages.DUPLICATE, 409);
  }

  const id = randomUUID();
  const now = Date.now();

  const task: Task = {
    id,
    url,
    platform: platform.id,
    title: url,
    thumbnail: null,
    duration: null,
    uploader: null,
    quality,
    format,
    filesize: null,
    downloadedBytes: 0,
    progress: 0,
    speed: null,
    eta: null,
    status: 'waiting',
    error: null,
    outputDir: settings.downloadDir,
    filePath: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };

  db.insertTask(task);
  broadcastTask(task);
  queue.enqueue(id);

  return db.getTask(id)!;
}

export function getTask(id: string): Task | null {
  return getDb().getTask(id);
}

export function listTasks(): Task[] {
  return getDb().listTasks();
}

export interface HistoryQuery {
  search?: string;
  platform?: string;
  status?: string;
  sort?: string;
}

export function listHistory(query: HistoryQuery): Task[] {
  let tasks = getDb()
    .listTasks()
    .filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status));

  if (query.search) {
    const s = query.search.toLowerCase();
    tasks = tasks.filter(
      (t) => (t.title ?? '').toLowerCase().includes(s) || t.url.toLowerCase().includes(s),
    );
  }
  if (query.platform && query.platform !== 'all') {
    tasks = tasks.filter((t) => t.platform === query.platform);
  }
  if (query.status && query.status !== 'all') {
    tasks = tasks.filter((t) => t.status === query.status);
  }
  if (query.sort === 'oldest') {
    tasks = [...tasks].sort((a, b) => a.createdAt - b.createdAt);
  } else if (query.sort === 'size') {
    tasks = [...tasks].sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0));
  }
  // 默认按时间倒序（listTasks 已排序）
  return tasks;
}

export function removeTask(id: string, deleteFile: boolean): void {
  const db = getDb();
  const t = db.getTask(id);
  if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);

  // 若在队列/下载中，先取消
  if (ACTIVE_STATUSES.includes(t.status as TaskStatus)) {
    queue.cancel(id);
  }

  // 删除任务记录与真实文件严格区分
  if (deleteFile) {
    queue.removeFile(id);
  }

  db.deleteTask(id);
  broadcast('task-deleted', { id });
}

import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getDb } from '../db';
import { getSettings } from './settings';
import { broadcastTask } from './broadcast';
import { ActiveDownload, runDownload } from './downloader';
import { parseUrl } from './parser';
import { ErrorMessages } from '../errors';
import { ProgressEvent, Task } from '../types';

function fileSizeOf(fp: string | null): number | null {
  if (!fp) return null;
  try {
    const s = statSync(fp);
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

function partialFiles(outputDir: string, taskId: string): string[] {
  try {
    return readdirSync(outputDir).filter((f) => f.includes(`[VDM-${taskId}]`)).map((f) => path.join(outputDir, f));
  } catch {
    return [];
  }
}

// 下载完成后，从输出目录中找出最终产物（排除 .part 临时文件），返回最大的文件
function findFinalFile(outputDir: string, taskId: string): string | null {
  try {
    const files = readdirSync(outputDir)
      .filter((f) => f.includes(`[VDM-${taskId}]`) && !f.endsWith('.part') && !f.endsWith('.ytdl'))
      .map((f) => path.join(outputDir, f));
    if (files.length === 0) return null;
    let best = files[0];
    let bestSize = -1;
    for (const f of files) {
      try {
        const s = statSync(f).size;
        if (s > bestSize) {
          bestSize = s;
          best = f;
        }
      } catch {
        /* ignore */
      }
    }
    return best;
  } catch {
    return null;
  }
}

class TaskQueue {
  // running：正在处理中的任务（解析中 + 下载中），用于并发限制
  private running = new Set<string>();
  // active：正在下载的任务（持有进程控制句柄，用于暂停/取消）
  private active = new Map<string, ActiveDownload>();
  private waiting: string[] = [];
  private lastPersist = new Map<string, number>();
  private lastBroadcast = new Map<string, number>();

  get activeCount(): number {
    return this.running.size;
  }

  get waitingCount(): number {
    return this.waiting.length;
  }

  isActive(taskId: string): boolean {
    return this.active.has(taskId) || this.running.has(taskId);
  }

  enqueue(taskId: string): void {
    if (!this.waiting.includes(taskId) && !this.active.has(taskId) && !this.running.has(taskId)) {
      this.waiting.push(taskId);
    }
    this.schedule();
  }

  private schedule(): void {
    const settings = getSettings();
    // 关键：用 running 集合做并发限制，且同步登记，避免异步解析阶段突破并发上限
    while (this.running.size < settings.maxConcurrency && this.waiting.length > 0) {
      const id = this.waiting.shift()!;
      this.running.add(id);
      void this.startTask(id);
    }
  }

  private async startTask(taskId: string): Promise<void> {
    const db = getDb();
    const task = db.getTask(taskId);
    if (!task) {
      this.running.delete(taskId);
      this.schedule();
      return;
    }
    if (task.status === 'completed' || task.status === 'cancelled') {
      this.running.delete(taskId);
      this.schedule();
      return;
    }

    const settings = getSettings();
    mkdirSync(task.outputDir, { recursive: true });

    // 解析阶段：获取元数据（标题/缩略图/时长/作者/大小）
    db.updateTask(taskId, {
      status: 'parsing',
      error: null,
      startedAt: task.startedAt ?? Date.now(),
      speed: null,
      eta: null,
    });
    broadcastTask(db.getTask(taskId)!);

    let meta;
    try {
      meta = await parseUrl(task.url);
    } catch (err) {
      const e = err as { message?: string };
      db.updateTask(taskId, {
        status: 'failed',
        error: e.message || ErrorMessages.DOWNLOAD_FAILED,
        speed: null,
        eta: null,
      });
      broadcastTask(db.getTask(taskId)!);
      this.running.delete(taskId);
      this.schedule();
      return;
    }

    // 解析期间可能被暂停/取消，需中止后续下载
    const current = db.getTask(taskId);
    if (!current || current.status === 'paused' || current.status === 'cancelled') {
      this.running.delete(taskId);
      this.schedule();
      return;
    }

    const estSize = meta.qualities.find((q) => q.value === task.quality)?.filesize ?? null;
    db.updateTask(taskId, {
      platform: meta.platform.id,
      title: meta.meta.title,
      thumbnail: meta.meta.thumbnail,
      duration: meta.meta.duration,
      uploader: meta.meta.uploader,
      filesize: estSize,
      status: 'downloading',
    });
    broadcastTask(db.getTask(taskId)!);

    const handle = runDownload({
      taskId,
      url: task.url,
      quality: task.quality,
      format: task.format,
      outputDir: task.outputDir,
      settings,
      onProgress: (p: ProgressEvent) => this.onProgress(taskId, p),
    });

    this.active.set(taskId, handle);

    const outcome = await handle.promise;
    this.active.delete(taskId);
    this.running.delete(taskId);
    this.lastPersist.delete(taskId);
    this.lastBroadcast.delete(taskId);

    const after = db.getTask(taskId);
    if (!after) {
      this.schedule();
      return;
    }

    switch (outcome.status) {
      case 'completed': {
        const realPath = findFinalFile(task.outputDir, taskId);
        const size = fileSizeOf(realPath) ?? after.filesize ?? after.downloadedBytes;
        db.updateTask(taskId, {
          status: 'completed',
          filePath: realPath,
          filesize: size,
          downloadedBytes: size,
          progress: 100,
          speed: null,
          eta: null,
          error: null,
          completedAt: Date.now(),
        });
        break;
      }
      case 'paused': {
        db.updateTask(taskId, { status: 'paused', speed: null, eta: null });
        break;
      }
      case 'cancelled': {
        this.deletePartial(taskId);
        db.updateTask(taskId, {
          status: 'cancelled',
          speed: null,
          eta: null,
          downloadedBytes: 0,
          progress: 0,
        });
        break;
      }
      case 'failed': {
        db.updateTask(taskId, {
          status: 'failed',
          error: outcome.error?.message ?? ErrorMessages.DOWNLOAD_FAILED,
          speed: null,
          eta: null,
        });
        break;
      }
    }

    broadcastTask(db.getTask(taskId)!);
    this.schedule();
  }

  private onProgress(taskId: string, p: ProgressEvent): void {
    const db = getDb();
    const now = Date.now();
    const total = p.totalBytes;
    const progress = total && total > 0 ? Math.min(100, (p.downloadedBytes / total) * 100) : 0;

    const patch: Partial<Task> = {
      downloadedBytes: p.downloadedBytes,
      speed: p.speed,
      eta: p.eta,
    };
    if (total) patch.filesize = total;
    if (progress > 0) patch.progress = progress;

    const lp = this.lastPersist.get(taskId) ?? 0;
    if (now - lp >= 1000) {
      this.lastPersist.set(taskId, now);
      db.updateTask(taskId, patch);
    }

    const lb = this.lastBroadcast.get(taskId) ?? 0;
    if (now - lb >= 250) {
      this.lastBroadcast.set(taskId, now);
      const t = db.getTask(taskId);
      if (t) broadcastTask({ ...t, ...patch });
    }
  }

  pause(taskId: string): void {
    const db = getDb();
    const handle = this.active.get(taskId);
    if (handle) {
      handle.controller.stop();
      return;
    }
    // 解析中或等待中 → 直接标记暂停
    const idx = this.waiting.indexOf(taskId);
    if (idx >= 0) this.waiting.splice(idx, 1);
    const t = db.getTask(taskId);
    if (t && (t.status === 'waiting' || t.status === 'parsing')) {
      db.updateTask(taskId, { status: 'paused' });
      broadcastTask(db.getTask(taskId)!);
    }
  }

  resume(taskId: string): void {
    const db = getDb();
    const t = db.getTask(taskId);
    if (!t || t.status !== 'paused') return;
    db.updateTask(taskId, { status: 'waiting', error: null });
    broadcastTask(db.getTask(taskId)!);
    this.enqueue(taskId);
  }

  cancel(taskId: string): void {
    const db = getDb();
    const handle = this.active.get(taskId);
    if (handle) {
      handle.controller.kill();
      return;
    }
    const idx = this.waiting.indexOf(taskId);
    if (idx >= 0) this.waiting.splice(idx, 1);
    const t = db.getTask(taskId);
    if (t && ['waiting', 'parsing', 'paused', 'failed'].includes(t.status)) {
      this.deletePartial(taskId);
      db.updateTask(taskId, { status: 'cancelled', downloadedBytes: 0, progress: 0, speed: null, eta: null });
      broadcastTask(db.getTask(taskId)!);
    }
  }

  retry(taskId: string): void {
    const db = getDb();
    const t = db.getTask(taskId);
    if (!t) return;
    if (this.active.has(taskId) || this.running.has(taskId)) return;
    db.updateTask(taskId, { status: 'waiting', error: null, speed: null, eta: null });
    broadcastTask(db.getTask(taskId)!);
    this.enqueue(taskId);
  }

  private deletePartial(taskId: string): void {
    const db = getDb();
    const t = db.getTask(taskId);
    if (!t) return;
    for (const f of partialFiles(t.outputDir, taskId)) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }

  removeFile(taskId: string): void {
    const db = getDb();
    const t = db.getTask(taskId);
    if (!t) return;
    if (t.filePath && existsSync(t.filePath)) {
      try {
        unlinkSync(t.filePath);
      } catch {
        /* ignore */
      }
    }
    for (const f of partialFiles(t.outputDir, taskId)) {
      try {
        unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }

  reschedule(): void {
    this.schedule();
  }

  recover(): void {
    const db = getDb();
    for (const t of db.allTasks()) {
      if (t.status === 'downloading' || t.status === 'parsing') {
        db.updateTask(t.id, { status: 'waiting', speed: null, eta: null, error: null });
        broadcastTask(db.getTask(t.id)!);
        this.enqueue(t.id);
      } else if (t.status === 'waiting') {
        this.enqueue(t.id);
      }
      // paused 保持原状，等待用户手动继续
    }
    this.schedule();
  }

  shutdown(): void {
    const db = getDb();
    for (const [, handle] of this.active) {
      handle.controller.stop();
    }
    // 解析中的任务重置为等待，待下次启动恢复
    for (const id of this.running) {
      if (!this.active.has(id)) {
        db.updateTask(id, { status: 'waiting', speed: null, eta: null });
      }
    }
  }
}

export const queue = new TaskQueue();

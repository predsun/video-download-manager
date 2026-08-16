import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { findFfmpeg, findYtdlp } from './ytdlp';
import { AppError, ErrorMessages, classifyYtdlpError } from '../errors';
import { AppSettings, ProgressEvent } from '../types';

export interface DownloadContext {
  taskId: string;
  url: string;
  quality: string;
  format: string;
  outputDir: string;
  settings: AppSettings;
  onProgress: (p: ProgressEvent) => void;
}

export interface DownloadController {
  stop: () => void;
  kill: () => void;
}

export type DownloadOutcome =
  | { status: 'completed'; filePath: string | null }
  | { status: 'paused'; filePath: string | null }
  | { status: 'cancelled'; filePath: string | null }
  | { status: 'failed'; filePath: string | null; error: { code: string; message: string } };

export interface ActiveDownload {
  controller: DownloadController;
  promise: Promise<DownloadOutcome>;
}

function buildFormatSelector(quality: string, format: string, hasFfmpeg: boolean): string {
  const heightFilter = quality === 'best' ? '' : `[height<=${quality}]`;

  if (quality === 'audio') {
    if (format === 'm4a') return 'bestaudio[ext=m4a]/bestaudio/best';
    return 'bestaudio/best';
  }

  if (!hasFfmpeg) {
    if (format === 'mp4') return `b${heightFilter}[ext=mp4]/b${heightFilter}/best[ext=mp4]/best`;
    if (format === 'webm') return `b${heightFilter}[ext=webm]/b${heightFilter}/best[ext=webm]/best`;
    return `b${heightFilter}/best`;
  }

  if (format === 'mkv') return `bv*${heightFilter}+ba/b${heightFilter}/best`;
  if (format === 'best') return `bv*${heightFilter}+ba/b${heightFilter}/best`;
  return `bv*${heightFilter}[ext=${format}]+ba[ext=m4a]/b${heightFilter}[ext=${format}]/bv*${heightFilter}+ba/b${heightFilter}/best`;
}

function buildArgs(ctx: DownloadContext, hasFfmpeg: boolean): { args: string[]; extractAudio: boolean; mergeFormat: string | null } {
  const { taskId, url, quality, format, outputDir, settings } = ctx;
  const selector = buildFormatSelector(quality, format, hasFfmpeg);

  let extractAudio = false;
  let mergeFormat: string | null = null;

  if (quality === 'audio') {
    if (format === 'mp3') {
      if (!hasFfmpeg) {
        throw new AppError('FFMPEG_NOT_FOUND', ErrorMessages.FFMPEG_NOT_FOUND, 400);
      }
      extractAudio = true;
    }
  } else if (hasFfmpeg) {
    if (format === 'mkv') mergeFormat = 'mkv';
    else if (format === 'webm') mergeFormat = 'webm';
    else mergeFormat = 'mp4'; // best / mp4 → mp4 容器
  }

  const args: string[] = [
    '--no-warnings',
    '--newline',
    '--no-playlist',
    '--no-mtime',
    '--continue',
    '--socket-timeout',
    String(settings.timeoutSec),
    '--retries',
    String(settings.retries),
    '--fragment-retries',
    String(settings.retries),
    '-f',
    selector,
    '--progress-template',
    'PROGRESS %(progress)j',
    '-o',
    path.join(outputDir, `[VDM-${taskId}] %(title).120B.%(ext)s`),
  ];

  if (extractAudio) {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (mergeFormat) {
    args.push('--merge-output-format', mergeFormat);
  }

  if (settings.maxSpeed > 0) {
    args.push('--limit-rate', `${Math.round(settings.maxSpeed)}`);
  }

  const ffmpeg = findFfmpeg();
  if (ffmpeg && ffmpeg !== 'ffmpeg') {
    args.push('--ffmpeg-location', path.dirname(ffmpeg));
  }

  args.push(url.trim());

  return { args, extractAudio, mergeFormat };
}

function killProcessTree(child: ChildProcess, force: boolean): Promise<void> {
  return new Promise((resolve) => {
    const pid = child.pid;
    if (!pid) return resolve();
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        resolve();
      });
      killer.on('close', () => resolve());
    } else {
      child.kill(force ? 'SIGKILL' : 'SIGTERM');
      if (force) return resolve();
      const t = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        resolve();
      }, 3000);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
    }
  });
}

function parseProgress(line: string): ProgressEvent | null {
  const marker = 'PROGRESS ';
  if (!line.startsWith(marker)) return null;
  const jsonStr = line.slice(marker.length);
  try {
    const obj = JSON.parse(jsonStr) as {
      status?: string;
      downloaded_bytes?: number;
      total_bytes?: number;
      speed?: number;
      eta?: number;
    };
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      status: obj.status ?? 'downloading',
      downloadedBytes: num(obj.downloaded_bytes) ?? 0,
      totalBytes: num(obj.total_bytes),
      speed: num(obj.speed),
      eta: num(obj.eta),
    };
  } catch {
    return null;
  }
}

export function runDownload(ctx: DownloadContext): ActiveDownload {
  const bin = findYtdlp();
  if (!bin) {
    const failed: DownloadOutcome = {
      status: 'failed',
      filePath: null,
      error: { code: 'YTDLP_NOT_FOUND', message: ErrorMessages.YTDLP_NOT_FOUND },
    };
    return { controller: { stop: () => {}, kill: () => {} }, promise: Promise.resolve(failed) };
  }

  const hasFfmpeg = findFfmpeg() !== null;

  let args: string[];
  try {
    ({ args } = buildArgs(ctx, hasFfmpeg));
  } catch (err) {
    const e = err as AppError;
    const failed: DownloadOutcome = {
      status: 'failed',
      filePath: null,
      error: { code: e.code, message: e.message },
    };
    return { controller: { stop: () => {}, kill: () => {} }, promise: Promise.resolve(failed) };
  }

  let mode: 'running' | 'stopping' | 'killing' = 'running';
  let filePath: string | null = null;
  let stderrTail = '';
  let lastActivity = Date.now();
  let watchdog: NodeJS.Timeout | null = null;

  const child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  const controller: DownloadController = {
    stop: () => {
      if (mode === 'running') {
        mode = 'stopping';
        void killProcessTree(child, false);
      }
    },
    kill: () => {
      if (mode === 'running' || mode === 'stopping') {
        mode = 'killing';
        void killProcessTree(child, true);
      }
    },
  };

  const promise = new Promise<DownloadOutcome>((resolve) => {
    const settle = (outcome: DownloadOutcome) => {
      if (watchdog) clearInterval(watchdog);
      resolve(outcome);
    };

    watchdog = setInterval(() => {
      if (mode !== 'running') return;
      const stallMs = ctx.settings.timeoutSec * 1000 * 3;
      if (Date.now() - lastActivity > stallMs) {
        mode = 'killing';
        void killProcessTree(child, true);
        settle({
          status: 'failed',
          filePath,
          error: { code: 'TIMEOUT', message: ErrorMessages.TIMEOUT },
        });
      }
    }, 1000);

    child.stdout.on('data', (d: Buffer) => {
      lastActivity = Date.now();
      for (const rawLine of d.toString().split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const p = parseProgress(line);
        if (p) ctx.onProgress(p);
      }
    });

    child.stderr.on('data', (d: Buffer) => {
      lastActivity = Date.now();
      stderrTail = (stderrTail + d.toString()).slice(-8000);
    });

    child.on('error', (err) => {
      if (mode === 'running') mode = 'killing';
      settle({
        status: 'failed',
        filePath,
        error: { code: 'NETWORK_ERROR', message: err.message || ErrorMessages.NETWORK_ERROR },
      });
    });

    child.on('close', (code) => {
      if (mode === 'killing') {
        settle({ status: 'cancelled', filePath });
        return;
      }
      if (mode === 'stopping') {
        settle({ status: 'paused', filePath });
        return;
      }
      if (code === 0) {
        settle({ status: 'completed', filePath });
        return;
      }
      const { code: errCode, message } = classifyYtdlpError(stderrTail);
      settle({ status: 'failed', filePath, error: { code: errCode, message } });
    });
  });

  return { controller, promise };
}

import { spawn } from 'node:child_process';
import path from 'node:path';
import { findFfmpeg, findYtdlp } from './ytdlp';
import { killProcessTree } from '../util/proc';
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

// 下载结果：最终文件路径由队列在输出目录中扫描得到（见 queue.findFinalFile），
// 因此这里不再回传路径，避免出现永远为 null 的冗余字段。
export type DownloadOutcome =
  | { status: 'completed' }
  | { status: 'paused' }
  | { status: 'cancelled' }
  | { status: 'failed'; error: { code: string; message: string } };

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

  // mkv / best（自动）：mkv 容器支持 VP9/AV1/Opus 等所有编码，是「最高质量」的最稳妥选择
  if (format === 'mkv' || format === 'best') {
    return `bv*${heightFilter}+ba/b${heightFilter}/best`;
  }
  // mp4：只选 mp4 视频 + m4a 音频，避免把 VP9/AV1/Opus 塞进 mp4 导致合并失败
  if (format === 'mp4') {
    return `bv*${heightFilter}[ext=mp4]+ba[ext=m4a]/b${heightFilter}[ext=mp4]/bv*${heightFilter}[ext=mp4]+ba/b${heightFilter}[ext=mp4]/best[ext=mp4]/best`;
  }
  // webm：只选 webm 视频(VP9/AV1) + webm 音频(Opus)
  if (format === 'webm') {
    return `bv*${heightFilter}[ext=webm]+ba[ext=webm]/b${heightFilter}[ext=webm]/bv*${heightFilter}[ext=webm]+ba/b${heightFilter}[ext=webm]/best[ext=webm]/best`;
  }
  return `bv*${heightFilter}+ba/b${heightFilter}/best`;
}

function buildArgs(ctx: DownloadContext, hasFfmpeg: boolean): string[] {
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
    if (format === 'mp4') mergeFormat = 'mp4';
    else if (format === 'webm') mergeFormat = 'webm';
    else mergeFormat = 'mkv'; // best / mkv → mkv 容器（兼容 VP9/AV1/Opus 等所有编码）
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

  return args;
}

// 结束 yt-dlp 进程树（实现见 util/proc，解析与下载共用）
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
      error: { code: 'YTDLP_NOT_FOUND', message: ErrorMessages.YTDLP_NOT_FOUND },
    };
    return { controller: { stop: () => {}, kill: () => {} }, promise: Promise.resolve(failed) };
  }

  const hasFfmpeg = findFfmpeg() !== null;

  let args: string[];
  try {
    args = buildArgs(ctx, hasFfmpeg);
  } catch (err) {
    const e = err as AppError;
    const failed: DownloadOutcome = {
      status: 'failed',
      error: { code: e.code, message: e.message },
    };
    return { controller: { stop: () => {}, kill: () => {} }, promise: Promise.resolve(failed) };
  }

  let mode: 'running' | 'stopping' | 'killing' = 'running';
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
    let settled = false;
    const settle = (outcome: DownloadOutcome) => {
      if (settled) return; // watchdog 与 close 事件可能同时触发，只结算一次
      settled = true;
      if (watchdog) clearInterval(watchdog);
      resolve(outcome);
    };

    watchdog = setInterval(() => {
      if (mode !== 'running') return;
      const stallMs = ctx.settings.timeoutSec * 1000 * 3;
      if (Date.now() - lastActivity > stallMs) {
        mode = 'killing';
        void killProcessTree(child, true);
        settle({ status: 'failed', error: { code: 'TIMEOUT', message: ErrorMessages.TIMEOUT } });
      }
    }, 1000);

    // yt-dlp 的进度行是完整 JSON，但可能被数据分块切断，这里做行缓冲避免丢行
    let stdoutBuf = '';
    child.stdout.on('data', (d: Buffer) => {
      lastActivity = Date.now();
      stdoutBuf += d.toString();
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const p = parseProgress(line.trim());
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
        error: { code: 'NETWORK_ERROR', message: err.message || ErrorMessages.NETWORK_ERROR },
      });
    });

    child.on('close', (code) => {
      // 冲刷最后一段没有换行结尾的进度行
      if (stdoutBuf.trim()) {
        const p = parseProgress(stdoutBuf.trim());
        if (p) ctx.onProgress(p);
        stdoutBuf = '';
      }
      if (mode === 'killing') return settle({ status: 'cancelled' });
      if (mode === 'stopping') return settle({ status: 'paused' });
      if (code === 0) return settle({ status: 'completed' });
      const { code: errCode, message } = classifyYtdlpError(stderrTail);
      settle({ status: 'failed', error: { code: errCode, message } });
    });
  });

  return { controller, promise };
}

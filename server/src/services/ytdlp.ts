import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config';

function onPath(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 8000 });
    return r.error === undefined && r.status !== null;
  } catch {
    return false;
  }
}

let ytdlpCache: string | null | undefined;
export function findYtdlp(): string | null {
  if (ytdlpCache !== undefined) return ytdlpCache;
  const win = process.platform === 'win32';
  const candidates: string[] = [];
  if (config.ytdlpPath) candidates.push(config.ytdlpPath);
  candidates.push(
    path.join(config.rootDir, 'bin', win ? 'yt-dlp.exe' : 'yt-dlp'),
    path.join(config.rootDir, 'bin', 'yt-dlp.exe'),
    path.join(config.rootDir, 'bin', 'yt-dlp'),
    path.join(process.cwd(), 'bin', win ? 'yt-dlp.exe' : 'yt-dlp'),
  );
  for (const c of candidates) {
    if (existsSync(c)) {
      ytdlpCache = c;
      return c;
    }
  }
  if (onPath('yt-dlp')) {
    ytdlpCache = 'yt-dlp';
    return ytdlpCache;
  }
  ytdlpCache = null;
  return null;
}

let ffmpegCache: string | null | undefined;
export function findFfmpeg(): string | null {
  if (ffmpegCache !== undefined) return ffmpegCache;
  const win = process.platform === 'win32';
  const candidates: string[] = [];
  if (config.ffmpegPath) candidates.push(config.ffmpegPath);
  if (win) {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'));
    }
    candidates.push(path.join(config.rootDir, 'bin', 'ffmpeg.exe'));
  } else {
    candidates.push(path.join(config.rootDir, 'bin', 'ffmpeg'));
  }
  for (const c of candidates) {
    if (existsSync(c)) {
      ffmpegCache = c;
      return c;
    }
  }
  if (onPath('ffmpeg')) {
    ffmpegCache = 'ffmpeg';
    return ffmpegCache;
  }
  ffmpegCache = null;
  return null;
}

export interface YtdlpResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

// 运行 yt-dlp 并捕获输出（用于元数据解析）
export function runYtdlp(args: string[], timeoutMs: number): Promise<YtdlpResult> {
  const bin = findYtdlp();
  if (!bin) {
    return Promise.resolve({ stdout: '', stderr: 'yt-dlp not found', code: 127 });
  }
  return new Promise((resolve) => {
    const child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, code: null });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// 加载本地 .env（开发用）；生产环境由容器或进程直接注入环境变量
function loadEnvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* ignore malformed env file */
      }
    }
  }
}
loadEnvFiles();

// 向上寻找 monorepo 根目录（含 workspaces 的 package.json）
function resolveRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, 'utf8')) as { workspaces?: unknown };
        if (json.workspaces) return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface ServerConfig {
  port: number;
  host: string;
  rootDir: string;
  dataDir: string;
  downloadDir: string;
  dbPath: string;
  ytdlpPath: string;
  ffmpegPath: string;
  version: string;
  defaults: {
    maxConcurrency: number;
    maxSpeed: number;
    timeoutSec: number;
    retries: number;
    defaultQuality: string;
    defaultFormat: string;
  };
}

const rootDir = resolveRoot();

export const config: ServerConfig = {
  port: intEnv('PORT', 8787),
  host: process.env.HOST ?? '0.0.0.0',
  rootDir,
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(rootDir, 'data')),
  downloadDir: path.resolve(process.env.DOWNLOAD_DIR ?? path.join(rootDir, 'downloads')),
  dbPath: '',
  ytdlpPath: process.env.YTDLP_PATH ?? '',
  ffmpegPath: process.env.FFMPEG_PATH ?? '',
  version: '1.0.0',
  defaults: {
    maxConcurrency: intEnv('MAX_CONCURRENCY', 3),
    maxSpeed: intEnv('MAX_SPEED', 0),
    timeoutSec: intEnv('TIMEOUT_SEC', 60),
    retries: intEnv('RETRIES', 3),
    defaultQuality: process.env.DEFAULT_QUALITY ?? 'best',
    defaultFormat: process.env.DEFAULT_FORMAT ?? 'mp4',
  },
};

config.dbPath = path.join(config.dataDir, 'app.db');

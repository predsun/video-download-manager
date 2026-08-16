export type TaskStatus =
  | 'waiting'
  | 'parsing'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  height: number | null;
  fps: number | null;
  vcodec: string;
  acodec: string;
  filesize: number | null;
  filesizeApprox: number | null;
  note: string;
}

export interface VideoMeta {
  id: string;
  title: string;
  thumbnail: string;
  duration: number | null;
  uploader: string | null;
  webpageUrl: string;
  extractor: string;
  formats: VideoFormat[];
}

export interface PlatformInfo {
  id: string;
  name: string;
}

export interface QualityOption {
  value: string;
  label: string;
  height: number | null;
  filesize: number | null;
}

export interface FormatOption {
  value: string;
  label: string;
}

export interface ParseResult {
  platform: PlatformInfo;
  meta: VideoMeta;
  qualities: QualityOption[];
  formats: FormatOption[];
}

export interface Task {
  id: string;
  url: string;
  platform: string;
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  quality: string;
  format: string;
  filesize: number | null;
  downloadedBytes: number;
  progress: number;
  speed: number | null;
  eta: number | null;
  status: TaskStatus;
  error: string | null;
  outputDir: string;
  filePath: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface AppSettings {
  defaultQuality: string;
  defaultFormat: string;
  maxConcurrency: number;
  downloadDir: string;
  maxSpeed: number;
  timeoutSec: number;
  retries: number;
  theme: ThemeMode;
}

export interface DashboardStats {
  todayTasks: number;
  completed: number;
  downloading: number;
  failed: number;
  totalDownloadedBytes: number;
  totalTasks: number;
  recentTasks: Task[];
  platformCounts: { platform: string; count: number }[];
  dailyDownloads: { date: string; count: number; bytes: number }[];
  successRate: number;
}

export interface SystemInfo {
  version: string;
  dbStatus: { ok: boolean; path: string; sizeBytes: number };
  downloadDir: { ok: boolean; path: string; writable: boolean };
  disk: { total: number; free: number; used: number };
  engine: { ytdlp: string | null; ffmpeg: string | null };
}

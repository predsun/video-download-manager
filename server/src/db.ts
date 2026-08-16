import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { Task, TaskStatus } from './types';

interface TaskRow {
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
  downloaded_bytes: number;
  progress: number;
  speed: number | null;
  eta: number | null;
  status: TaskStatus;
  error: string | null;
  output_dir: string;
  file_path: string | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    url: r.url,
    platform: r.platform,
    title: r.title,
    thumbnail: r.thumbnail,
    duration: r.duration,
    uploader: r.uploader,
    quality: r.quality,
    format: r.format,
    filesize: r.filesize,
    downloadedBytes: r.downloaded_bytes,
    progress: r.progress,
    speed: r.speed,
    eta: r.eta,
    status: r.status,
    error: r.error,
    outputDir: r.output_dir,
    filePath: r.file_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

class Database {
  private db: DatabaseSync;

  constructor() {
    mkdirSync(config.dataDir, { recursive: true });
    this.db = new DatabaseSync(config.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        title TEXT,
        thumbnail TEXT,
        duration INTEGER,
        uploader TEXT,
        quality TEXT NOT NULL DEFAULT 'best',
        format TEXT NOT NULL DEFAULT 'mp4',
        filesize INTEGER,
        downloaded_bytes INTEGER NOT NULL DEFAULT 0,
        progress REAL NOT NULL DEFAULT 0,
        speed REAL,
        eta INTEGER,
        status TEXT NOT NULL DEFAULT 'waiting',
        error TEXT,
        output_dir TEXT NOT NULL,
        file_path TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  insertTask(t: Task): void {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, url, platform, title, thumbnail, duration, uploader, quality, format,
          filesize, downloaded_bytes, progress, speed, eta, status, error, output_dir,
          file_path, created_at, updated_at, started_at, completed_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        t.id, t.url, t.platform, t.title, t.thumbnail, t.duration, t.uploader, t.quality, t.format,
        t.filesize, t.downloadedBytes, t.progress, t.speed, t.eta, t.status, t.error, t.outputDir,
        t.filePath, t.createdAt, t.updatedAt, t.startedAt, t.completedAt,
      );
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }

  listTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as unknown as TaskRow[];
    return rows.map(rowToTask);
  }

  updateTask(id: string, patch: Partial<Task>): void {
    const current = this.getTask(id);
    if (!current) return;
    const next: Task = { ...current, ...patch, updatedAt: Date.now() };
    this.db
      .prepare(
        `UPDATE tasks SET url=?, platform=?, title=?, thumbnail=?, duration=?, uploader=?, quality=?,
         format=?, filesize=?, downloaded_bytes=?, progress=?, speed=?, eta=?, status=?, error=?,
         output_dir=?, file_path=?, created_at=?, updated_at=?, started_at=?, completed_at=? WHERE id=?`,
      )
      .run(
        next.url, next.platform, next.title, next.thumbnail, next.duration, next.uploader, next.quality,
        next.format, next.filesize, next.downloadedBytes, next.progress, next.speed, next.eta, next.status,
        next.error, next.outputDir, next.filePath, next.createdAt, next.updatedAt, next.startedAt,
        next.completedAt, id,
      );
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  allTasks(): Task[] {
    return this.listTasks();
  }

  countByStatus(): Record<string, number> {
    const rows = this.db.prepare('SELECT status, COUNT(*) AS c FROM tasks GROUP BY status').all() as unknown as {
      status: string;
      c: number;
    }[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = r.c;
    return out;
  }

  close(): void {
    this.db.close();
  }
}

let instance: Database | null = null;
export function getDb(): Database {
  if (!instance) instance = new Database();
  return instance;
}

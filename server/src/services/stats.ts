import { getDb } from '../db';
import { DashboardStats } from '../types';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDashboard(): DashboardStats {
  const db = getDb();
  const tasks = db.allTasks();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayTasks = tasks.filter((t) => t.createdAt >= startOfToday).length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const downloading = tasks.filter((t) => t.status === 'downloading').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const totalDownloadedBytes = tasks
    .filter((t) => t.status === 'completed')
    .reduce((s, t) => s + (t.filesize ?? 0), 0);
  const totalTasks = tasks.length;

  const recentTasks = tasks.slice(0, 8);

  const pc = new Map<string, number>();
  for (const t of tasks) pc.set(t.platform, (pc.get(t.platform) ?? 0) + 1);
  const platformCounts = [...pc.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  const daily = new Map<string, { count: number; bytes: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    daily.set(dateKey(d), { count: 0, bytes: 0 });
  }
  for (const t of tasks) {
    const key = dateKey(new Date(t.createdAt));
    const bucket = daily.get(key);
    if (bucket) {
      bucket.count++;
      if (t.status === 'completed') bucket.bytes += t.filesize ?? 0;
    }
  }
  const dailyDownloads = [...daily.entries()].map(([date, v]) => ({
    date,
    count: v.count,
    bytes: v.bytes,
  }));

  const finished = completed + failed;
  const successRate = finished > 0 ? Math.round((completed / finished) * 1000) / 10 : 100;

  return {
    todayTasks,
    completed,
    downloading,
    failed,
    totalDownloadedBytes,
    totalTasks,
    recentTasks,
    platformCounts,
    dailyDownloads,
    successRate,
  };
}

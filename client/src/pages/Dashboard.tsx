import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, CheckCircle2, Download, HardDrive, ListChecks, XCircle } from 'lucide-react';
import { api } from '../api';
import { useTasks } from '../hooks/useTasks';
import { StatCard } from '../components/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { PlatformBadge } from '../components/PlatformBadge';
import { StatusBadge } from '../components/StatusBadge';
import { PLATFORMS, formatBytes, formatDate, platformLabel } from '../lib/utils';
import type { DashboardStats } from '../types';

const PLATFORM_COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'];

export default function Dashboard() {
  const { version } = useTasks();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.getDashboard());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [load, version]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const chartData = stats.dailyDownloads.map((d) => ({ name: d.date.slice(5), 下载任务: d.count }));

  const maxPlatform = Math.max(1, ...stats.platformCounts.map((p) => p.count));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">下载数据总览与统计</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="今日任务" value={stats.todayTasks} icon={<Activity className="h-5 w-5" />} accent="bg-indigo-500/10 text-indigo-500" />
        <StatCard label="已完成" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-emerald-500/10 text-emerald-500" />
        <StatCard label="下载中" value={stats.downloading} icon={<Download className="h-5 w-5" />} accent="bg-blue-500/10 text-blue-500" />
        <StatCard label="失败" value={stats.failed} icon={<XCircle className="h-5 w-5" />} accent="bg-red-500/10 text-red-500" />
        <StatCard label="累计下载" value={formatBytes(stats.totalDownloadedBytes)} icon={<HardDrive className="h-5 w-5" />} accent="bg-violet-500/10 text-violet-500" />
        <StatCard label="累计任务" value={stats.totalTasks} icon={<ListChecks className="h-5 w-5" />} accent="bg-amber-500/10 text-amber-500" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 每日下载量 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>每日下载量</CardTitle>
            <span className="text-xs text-slate-400">近 14 天</span>
          </CardHeader>
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="下载任务" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* 成功率 + 平台分布 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>成功率</CardTitle>
            </CardHeader>
            <CardBody className="flex items-center gap-5">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="3.6" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.6"
                    strokeDasharray={`${stats.successRate} ${100 - stats.successRate}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">
                  {stats.successRate}%
                </span>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p>完成 {stats.completed} 个任务</p>
                <p>失败 {stats.failed} 个任务</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>各平台下载数量</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {stats.platformCounts.length === 0 ? (
                <p className="text-sm text-slate-400">暂无数据</p>
              ) : (
                stats.platformCounts.map((p, i) => (
                  <div key={p.platform}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{platformLabel(p.platform)}</span>
                      <span className="text-slate-400">{p.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(p.count / maxPlatform) * 100}%`,
                          backgroundColor: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 最近下载任务 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>最近下载任务</CardTitle>
        </CardHeader>
        <CardBody>
          {stats.recentTasks.length === 0 ? (
            <EmptyState title="暂无任务" description="下载任务会显示在这里。" />
          ) : (
            <div className="space-y-2">
              {stats.recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="h-9 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                    {t.thumbnail && <img src={t.thumbnail} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.title ?? t.url}</p>
                    <p className="text-xs text-slate-400">
                      {formatBytes(t.filesize)} · {formatDate(t.createdAt)}
                    </p>
                  </div>
                  <PlatformBadge platform={t.platform} />
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

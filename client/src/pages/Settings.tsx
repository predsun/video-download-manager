import { useEffect, useState } from 'react';
import { Database, Download, Gauge, Monitor, Moon, Save, Server, Sun, Wifi } from 'lucide-react';
import { api } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../hooks/useToast';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { cn, formatBytes } from '../lib/utils';
import type { AppSettings, SystemInfo, ThemeMode } from '../types';

const SPEED_OPTIONS = [
  { value: 0, label: '无限制' },
  { value: 1, label: '1 MB/s' },
  { value: 2, label: '2 MB/s' },
  { value: 5, label: '5 MB/s' },
  { value: 10, label: '10 MB/s' },
  { value: 20, label: '20 MB/s' },
  { value: 50, label: '50 MB/s' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([api.getSettings(), api.getSystem()]).then(([s, sys]) => {
      setSettings(s);
      setSystem(sys);
    });
  }, []);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await api.updateSettings(settings);
      setSettings(next);
      toast('success', '设置已保存');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onThemeChange = (t: ThemeMode) => {
    setTheme(t);
    set('theme', t);
  };

  if (!settings) {
    return <div className="skeleton h-96 rounded-2xl" />;
  }

  const speedValue = settings.maxSpeed / (1024 * 1024);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">设置</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">自定义下载、网络与外观偏好</p>
      </div>

      <div className="space-y-6">
        {/* 下载设置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-indigo-500" />
              <CardTitle>下载设置</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">默认下载质量</span>
              <Select value={settings.defaultQuality} onChange={(e) => set('defaultQuality', e.target.value)}>
                <option value="best">最佳质量</option>
                <option value="2160">2160p</option>
                <option value="1440">1440p</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
                <option value="360">360p</option>
                <option value="audio">仅音频</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">默认文件格式</span>
              <Select value={settings.defaultFormat} onChange={(e) => set('defaultFormat', e.target.value)}>
                <option value="best">自动 (推荐)</option>
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="mkv">MKV</option>
                <option value="m4a">M4A</option>
                <option value="mp3">MP3</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">最大并发任务</span>
              <Select value={settings.maxConcurrency} onChange={(e) => set('maxConcurrency', Number(e.target.value))}>
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">默认保存目录</span>
              <Input value={settings.downloadDir} onChange={(e) => set('downloadDir', e.target.value)} />
            </label>
          </CardBody>
        </Card>

        {/* 网络设置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-violet-500" />
              <CardTitle>网络设置</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">最大下载速度</span>
              <Select
                value={SPEED_OPTIONS.some((o) => o.value === speedValue) ? speedValue : 0}
                onChange={(e) => set('maxSpeed', Number(e.target.value) * 1024 * 1024)}
              >
                {SPEED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">请求超时 (秒)</span>
              <Input
                type="number"
                min={5}
                max={600}
                value={settings.timeoutSec}
                onChange={(e) => set('timeoutSec', Math.max(1, Number(e.target.value) || 60))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">自动重试次数</span>
              <Input
                type="number"
                min={0}
                max={20}
                value={settings.retries}
                onChange={(e) => set('retries', Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </CardBody>
        </Card>

        {/* 外观 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-sky-500" />
              <CardTitle>外观</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: 'light', label: 'Light Mode', icon: Sun },
                  { value: 'dark', label: 'Dark Mode', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onThemeChange(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition',
                    theme === opt.value
                      ? 'border-indigo-500 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                  )}
                >
                  <opt.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* 系统 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-emerald-500" />
              <CardTitle>系统</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Gauge className="h-4 w-4" /> 当前版本
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">v{system?.version ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Database className="h-4 w-4" /> 数据库状态
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {system?.dbStatus.ok ? `正常 (${formatBytes(system.dbStatus.sizeBytes)})` : '初始化中'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Download className="h-4 w-4" /> 下载目录状态
              </span>
              <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                {system?.downloadDir.writable ? '可写' : '不可写'} · {settings.downloadDir}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <HardDriveIcon /> 磁盘剩余空间
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {system ? formatBytes(system.disk.free) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">下载引擎</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {system?.engine.ytdlp ? 'yt-dlp ✓' : 'yt-dlp ✗'}
                {' · '}
                {system?.engine.ffmpeg ? 'ffmpeg ✓' : 'ffmpeg ✗'}
              </span>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" loading={saving} onClick={save}>
            <Save className="h-5 w-5" /> 保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}

function HardDriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" x2="2" y1="12" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" x2="6.01" y1="16" y2="16" />
      <line x1="10" x2="10.01" y1="16" y2="16" />
    </svg>
  );
}

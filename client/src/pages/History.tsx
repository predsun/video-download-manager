import { useMemo, useState } from 'react';
import { FolderOpen, History as HistoryIcon, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useTasks } from '../hooks/useTasks';
import { useToast } from '../hooks/useToast';
import { PlatformBadge } from '../components/PlatformBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { PLATFORMS, formatBytes, formatDate, platformLabel } from '../lib/utils';
import type { Task } from '../types';

export default function History() {
  const { tasks, loading } = useTasks();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [target, setTarget] = useState<Task | null>(null);
  const [deleteFile, setDeleteFile] = useState(false);
  const [busy, setBusy] = useState(false);

  const terminal = useMemo(() => tasks.filter((t) => ['completed', 'failed', 'cancelled'].includes(t.status)), [tasks]);

  const filtered = useMemo(() => {
    let list = terminal;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((t) => (t.title ?? '').toLowerCase().includes(s) || t.url.toLowerCase().includes(s));
    }
    if (platform !== 'all') list = list.filter((t) => t.platform === platform);
    if (status !== 'all') list = list.filter((t) => t.status === status);

    if (sort === 'oldest') list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    else if (sort === 'size') list = [...list].sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0));
    return list;
  }, [terminal, search, platform, status, sort]);

  const platformOptions = useMemo(() => {
    const set = new Set(terminal.map((t) => t.platform));
    return [...set].map((p) => ({ value: p, label: platformLabel(p) }));
  }, [terminal]);

  const doDelete = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.remove(target.id, deleteFile);
      toast('success', '已删除历史记录');
      setTarget(null);
      setDeleteFile(false);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">下载历史</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">搜索、筛选并管理已完成的下载记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="搜索视频名称或链接" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">全部平台</option>
          {platformOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="cancelled">已取消</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">按时间倒序</option>
          <option value="oldest">按时间正序</option>
          <option value="size">按文件大小</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="h-7 w-7" />}
          title="暂无历史记录"
          description="完成或取消的下载任务会显示在这里。"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t.title ?? t.url}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <PlatformBadge platform={t.platform} />
                  <span>{formatBytes(t.filesize)}</span>
                  <span>{formatDate(t.completedAt ?? t.createdAt)}</span>
                  {t.filePath && <span className="truncate text-slate-400 dark:text-slate-500">{t.filePath}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={t.status} />
                {t.status === 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      api.openFolder(t.id).catch(() => toast('error', '无法打开文件夹'))
                    }
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> 打开
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-600" onClick={() => setTarget(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!target} onClose={() => setTarget(null)} title="删除历史记录">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          确定删除该记录吗？删除历史记录<strong>不会</strong>自动删除已下载的视频文件。
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={deleteFile}
            onChange={(e) => setDeleteFile(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          同时删除已下载的视频文件
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTarget(null)}>
            取消
          </Button>
          <Button variant="danger" loading={busy} onClick={doDelete}>
            删除
          </Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { FolderOpen, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { cn, formatBytes, formatDate, formatDuration, formatEta, formatSpeed, STATUS_META } from '../lib/utils';
import type { Task } from '../types';
import { PlatformBadge } from './PlatformBadge';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ProgressBar } from './ui/ProgressBar';

interface TaskItemProps {
  task: Task;
}

export function TaskItem({ task }: TaskItemProps) {
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFile, setDeleteFile] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast('success', success);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  const meta = STATUS_META[task.status];
  const isDownloading = task.status === 'downloading';

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4">
        {/* 缩略图 */}
        <div className="hidden h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block dark:bg-slate-800">
          {task.thumbnail ? (
            <img src={task.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">无封面</div>
          )}
        </div>

        {/* 信息区 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={task.title ?? task.url}>
                {task.title ?? task.url}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <PlatformBadge platform={task.platform} />
                <span className="uppercase">{task.quality === 'audio' ? '音频' : task.quality === 'best' ? '最佳' : `${task.quality}p`}</span>
                <span>·</span>
                <span className="uppercase">{task.format}</span>
                {task.duration != null && (
                  <>
                    <span>·</span>
                    <span>{formatDuration(task.duration)}</span>
                  </>
                )}
                {task.filesize != null && (
                  <>
                    <span>·</span>
                    <span>{formatBytes(task.filesize)}</span>
                  </>
                )}
              </div>
            </div>
            <StatusBadge status={task.status} />
          </div>

          {/* 进度 */}
          {(isDownloading || task.status === 'paused') && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">{Math.round(task.progress)}%</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatBytes(task.downloadedBytes)}
                  {task.filesize ? ` / ${formatBytes(task.filesize)}` : ''}
                </span>
              </div>
              <ProgressBar value={task.progress} barClassName={meta.bar} />
              <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>速度：{formatSpeed(task.speed)}</span>
                <span>剩余：{isDownloading ? formatEta(task.eta) : '—'}</span>
              </div>
            </div>
          )}

          {task.error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {task.error}
            </p>
          )}

          {task.status === 'completed' && task.filePath && (
            <p className="mt-2 truncate rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" title={task.filePath}>
              已保存：{task.filePath}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">创建于 {formatDate(task.createdAt)}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(task.status === 'downloading' || task.status === 'waiting' || task.status === 'parsing') && (
                <Button variant="outline" size="sm" loading={busy === 'pause'} onClick={() => act('pause', () => api.pause(task.id))}>
                  <Pause className="h-3.5 w-3.5" /> 暂停
                </Button>
              )}
              {task.status === 'paused' && (
                <Button variant="outline" size="sm" loading={busy === 'resume'} onClick={() => act('resume', () => api.resume(task.id), '已继续')}>
                  <Play className="h-3.5 w-3.5" /> 继续
                </Button>
              )}
              {(task.status === 'downloading' || task.status === 'waiting' || task.status === 'parsing' || task.status === 'paused') && (
                <Button variant="outline" size="sm" loading={busy === 'cancel'} onClick={() => act('cancel', () => api.cancel(task.id), '已取消')}>
                  <X className="h-3.5 w-3.5" /> 取消
                </Button>
              )}
              {task.status === 'failed' && (
                <Button variant="outline" size="sm" loading={busy === 'retry'} onClick={() => act('retry', () => api.retry(task.id), '已重新加入队列')}>
                  <RotateCcw className="h-3.5 w-3.5" /> 重试
                </Button>
              )}
              {task.status === 'completed' && (
                <Button variant="outline" size="sm" onClick={() => act('open', () => api.openFolder(task.id))}>
                  <FolderOpen className="h-3.5 w-3.5" /> 打开文件夹
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="删除任务">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          确定删除该任务吗？删除任务记录<strong>不会</strong>自动删除已下载的视频文件。
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
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            loading={busy === 'delete'}
            onClick={() =>
              act('delete', async () => {
                await api.remove(task.id, deleteFile);
                setConfirmDelete(false);
                setDeleteFile(false);
              }, '已删除')
            }
          >
            删除
          </Button>
        </div>
      </Modal>
    </div>
  );
}

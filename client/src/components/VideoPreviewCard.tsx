import { useState } from 'react';
import { Clock, Download, User } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { formatBytes, formatDuration } from '../lib/utils';
import type { ParseResult } from '../types';
import { PlatformBadge } from './PlatformBadge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Select } from './ui/Select';

interface VideoPreviewCardProps {
  result: ParseResult;
  url: string;
  onAdded: () => void;
}

export function VideoPreviewCard({ result, url, onAdded }: VideoPreviewCardProps) {
  const { toast } = useToast();
  const [quality, setQuality] = useState(result.qualities[0]?.value ?? 'best');
  const [format, setFormat] = useState(
    result.formats.some((f) => f.value === 'mp4') ? 'mp4' : result.formats[0]?.value ?? 'best',
  );
  const [adding, setAdding] = useState(false);

  const isAudio = quality === 'audio';
  const visibleFormats = isAudio
    ? result.formats.filter((f) => ['m4a', 'mp3', 'best'].includes(f.value))
    : result.formats.filter((f) => !['m4a', 'mp3'].includes(f.value));

  const estSize = result.qualities.find((q) => q.value === quality)?.filesize ?? null;

  const onQualityChange = (v: string) => {
    setQuality(v);
    if (v === 'audio' && !['m4a', 'mp3', 'best'].includes(format)) {
      setFormat('m4a');
    }
    if (v !== 'audio' && ['m4a', 'mp3'].includes(format)) {
      setFormat(result.formats.some((f) => f.value === 'mp4') ? 'mp4' : 'best');
    }
  };

  const addToQueue = async () => {
    setAdding(true);
    try {
      await api.createTask(url, quality, format);
      toast('success', '已加入下载队列');
      onAdded();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '加入队列失败');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="animate-slide-up overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-100 sm:w-72 dark:bg-slate-800">
          {result.meta.thumbnail ? (
            <img src={result.meta.thumbnail} alt={result.meta.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">无封面</div>
          )}
          {result.meta.duration != null && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {formatDuration(result.meta.duration)}
            </span>
          )}
        </div>

        <div className="flex-1 p-5">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={result.platform.id} />
            <span className="text-xs text-slate-400">{result.platform.name}</span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-slate-900 dark:text-white">
            {result.meta.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            {result.meta.uploader && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" /> {result.meta.uploader}
              </span>
            )}
            {result.meta.duration != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {formatDuration(result.meta.duration)}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">视频质量</span>
              <Select value={quality} onChange={(e) => onQualityChange(e.target.value)}>
                {result.qualities.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                    {q.filesize ? ` · ${formatBytes(q.filesize)}` : ''}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">文件格式</span>
              <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                {visibleFormats.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" loading={adding} onClick={addToQueue}>
              <Download className="h-5 w-5" /> 加入下载队列
            </Button>
            {estSize != null && (
              <span className="text-sm text-slate-500 dark:text-slate-400">预计大小 {formatBytes(estSize)}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

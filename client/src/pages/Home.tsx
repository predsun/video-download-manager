import { useRef, useState, type DragEvent } from 'react';
import { ArrowRight, Link2, Search, Sparkles } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import { VideoPreviewCard } from '../components/VideoPreviewCard';
import { Button } from '../components/ui/Button';
import { PLATFORMS, platformLabel } from '../lib/utils';
import type { ParseResult } from '../types';

export default function Home() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parse = async (target: string) => {
    const value = target.trim();
    if (!value) {
      toast('error', '请先粘贴视频链接');
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      toast('error', 'URL 格式错误，请输入以 http(s):// 开头的合法链接');
      return;
    }
    setParsing(true);
    setResult(null);
    try {
      const res = await api.parse(value);
      setResult(res);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text) {
      setUrl(text.split('\n')[0].trim());
      void parse(text.split('\n')[0].trim());
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <div className="pt-8 text-center sm:pt-14">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400">
          <Sparkles className="h-3.5 w-3.5" />
          支持 6 大主流平台
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          在线视频下载管理器
        </h1>
        <p className="mt-3 text-base text-slate-500 sm:text-lg dark:text-slate-400">
          统一管理你的在线视频下载任务
        </p>
      </div>

      {/* 输入区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-8 rounded-2xl border-2 border-dashed p-2 transition ${
          dragging
            ? 'border-indigo-500 bg-indigo-500/5'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && parse(url)}
              placeholder="粘贴视频链接"
              className="h-12 w-full rounded-xl border-0 bg-transparent pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <Button size="lg" className="shrink-0" loading={parsing} onClick={() => parse(url)}>
            <Search className="h-5 w-5" /> 解析视频
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">支持直接拖拽链接到输入框</p>

      {/* 支持的平台 */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {Object.keys(PLATFORMS)
          .filter((k) => k !== 'direct')
          .map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {platformLabel(k)}
            </span>
          ))}
      </div>

      {/* 预览卡片 */}
      {parsing && (
        <div className="mt-8 space-y-4">
          <div className="skeleton h-48 w-full rounded-2xl" />
        </div>
      )}

      {result && !parsing && (
        <div className="mt-8">
          <VideoPreviewCard
            result={result}
            url={url}
            onAdded={() => {
              setResult(null);
              setUrl('');
            }}
          />
          <div className="mt-3 text-center">
            <button
              onClick={() => {
                setResult(null);
                setUrl('');
                inputRef.current?.focus();
              }}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400"
            >
              解析另一个视频 <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

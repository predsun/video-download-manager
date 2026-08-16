import { useMemo, useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import { TaskItem } from '../components/TaskItem';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

type Filter = 'all' | 'active' | 'completed' | 'failed' | 'cancelled';

const ACTIVE = ['waiting', 'parsing', 'downloading', 'paused'];

export default function Tasks() {
  const { tasks, loading } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');

  const counts: Record<Filter, number> = {
    all: tasks.length,
    active: tasks.filter((t) => ACTIVE.includes(t.status)).length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'active') return tasks.filter((t) => ACTIVE.includes(t.status));
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '进行中' },
    { key: 'completed', label: '已完成' },
    { key: 'failed', label: '失败' },
    { key: 'cancelled', label: '已取消' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">下载任务</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">实时查看并管理所有下载任务</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              filter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {f.label}
            <span className={cn('rounded-full px-1.5 text-xs', filter === f.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800')}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="h-7 w-7" />}
          title={tasks.length === 0 ? '还没有下载任务' : '没有匹配的任务'}
          description={tasks.length === 0 ? '前往首页粘贴视频链接，开始你的第一个下载任务。' : '尝试切换筛选条件。'}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

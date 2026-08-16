import type { ReactNode } from 'react';
import { Card } from './ui/Card';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', accent ?? 'bg-indigo-500/10 text-indigo-500')}>
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
    </Card>
  );
}

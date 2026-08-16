import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}>
      <div
        className={cn('h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

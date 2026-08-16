import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500',
        className,
      )}
      {...rest}
    />
  );
}

import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/20 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  ghost:
    'text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-500 disabled:opacity-60',
  outline:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-offset-slate-900',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

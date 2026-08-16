import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, type, message }].slice(-5));
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur',
              'border-slate-200 dark:border-slate-700 dark:bg-slate-900/95',
            )}
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.type]}</div>
            <p className="flex-1 text-sm leading-5 text-slate-700 dark:text-slate-200">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

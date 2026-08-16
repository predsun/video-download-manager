import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeMode } from '../types';

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: 'light' | 'dark';
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolved: 'light',
  setTheme: () => {},
});

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

const STORAGE_KEY = 'vdm-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(theme));

  useEffect(() => {
    setResolved(resolveTheme(theme));
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => setResolved(resolveTheme('system'));
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

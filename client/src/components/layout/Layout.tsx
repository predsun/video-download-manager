import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Clapperboard, History, Home, LayoutDashboard, Menu, Settings, X } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/tasks', label: '下载任务', icon: Clapperboard },
  { to: '/history', label: '下载历史', icon: History },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/settings', label: '设置', icon: Settings },
];

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { tasks } = useTasks();
  const location = useLocation();
  const activeCount = tasks.filter((t) => ['downloading', 'waiting', 'parsing', 'paused'].includes(t.status)).length;

  const nav = (
    <nav className="flex-1 space-y-1 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
          {item.to === '/tasks' && activeCount > 0 && (
            <span className="ml-auto rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white">
              {activeCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30">
        <Clapperboard className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900 dark:text-white">视频下载管理器</p>
        <p className="text-[11px] text-slate-400">Video Download Manager</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* 桌面侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white py-5 lg:flex dark:border-slate-800 dark:bg-slate-900">
        {brand}
        <div className="my-5 h-px bg-slate-100 dark:bg-slate-800" />
        {nav}
        <div className="px-6 py-3 text-[11px] text-slate-400 dark:text-slate-500">v1.0.0</div>
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
            <Clapperboard className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">视频下载管理器</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white py-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between pr-4">
              {brand}
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-500" aria-label="关闭菜单">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="my-5 h-px bg-slate-100 dark:bg-slate-800" />
            {nav}
          </aside>
        </div>
      )}

      <main className="lg:pl-60">
        <div key={location.pathname} className="mx-auto w-full max-w-6xl animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

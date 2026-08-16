import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { TasksProvider } from './hooks/useTasks';
import Home from './pages/Home';
import Tasks from './pages/Tasks';
import History from './pages/History';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TasksProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/history" element={<History />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </TasksProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

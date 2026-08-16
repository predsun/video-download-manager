import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, wsUrl } from '../api';
import type { Task } from '../types';

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  version: number;
  refresh: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue>({
  tasks: [],
  loading: true,
  version: 0,
  refresh: async () => {},
});

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch {
      /* 静默：由 toast 层提示 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let closed = false;
    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(wsUrl());
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data) as {
              type: string;
              payload: Task | { id: string };
            };
            if (msg.type === 'task') {
              const t = msg.payload as Task;
              setTasks((prev) => {
                const idx = prev.findIndex((x) => x.id === t.id);
                if (idx === -1) return [t, ...prev];
                const next = [...prev];
                next[idx] = t;
                return next;
              });
              setVersion((v) => v + 1);
            } else if (msg.type === 'task-deleted') {
              const { id } = msg.payload as { id: string };
              setTasks((prev) => prev.filter((x) => x.id !== id));
              setVersion((v) => v + 1);
            }
          } catch {
            /* ignore malformed frame */
          }
        };

        ws.onclose = () => {
          if (!closed) {
            reconnectTimer.current = window.setTimeout(connect, 2000);
          }
        };
        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!closed) reconnectTimer.current = window.setTimeout(connect, 2000);
      }
    };
    connect();

    return () => {
      closed = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <TasksContext.Provider value={{ tasks, loading, version, refresh }}>
      {children}
    </TasksContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTasks(): TasksContextValue {
  return useContext(TasksContext);
}

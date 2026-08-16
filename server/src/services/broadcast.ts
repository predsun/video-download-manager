import { Task } from '../types';

export interface WsClient {
  send: (data: string) => void;
  readyState: number;
  close: () => void;
}

const clients = new Set<WsClient>();

export function addClient(client: WsClient): void {
  clients.add(client);
}

export function removeClient(client: WsClient): void {
  clients.delete(client);
}

export function broadcast(type: string, payload: unknown): void {
  const msg = JSON.stringify({ type, payload, ts: Date.now() });
  for (const c of clients) {
    try {
      if (c.readyState === 1) c.send(msg);
    } catch {
      /* ignore broken socket */
    }
  }
}

export function broadcastTask(task: Task): void {
  broadcast('task', task);
}

export function broadcastSettings(settings: unknown): void {
  broadcast('settings', settings);
}

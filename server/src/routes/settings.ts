import { FastifyInstance } from 'fastify';
import { getSettings, updateSettings } from '../services/settings';
import { broadcastSettings } from '../services/broadcast';
import { queue } from '../services/queue';
import { AppSettings } from '../types';

export default async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async () => getSettings());

  fastify.put('/', async (req, reply) => {
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};
    const keys = ['defaultQuality', 'defaultFormat', 'maxConcurrency', 'downloadDir', 'maxSpeed', 'timeoutSec', 'retries', 'theme'];
    for (const k of keys) {
      if (k in patch) allowed[k] = patch[k];
    }
    const next = updateSettings(allowed as unknown as Partial<AppSettings>);
    // 并发数变化时立即重新调度，保证等待中的任务尽快启动
    queue.reschedule();
    broadcastSettings(next);
    return reply.send(next);
  });
}

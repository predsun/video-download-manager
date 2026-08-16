import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { getDb } from './db';
import { AppError } from './errors';
import { addClient, removeClient, WsClient } from './services/broadcast';
import { queue } from './services/queue';

import taskRoutes from './routes/tasks';
import historyRoutes from './routes/history';
import settingsRoutes from './routes/settings';
import dashboardRoutes from './routes/dashboard';
import systemRoutes from './routes/system';

async function main(): Promise<void> {
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.downloadDir, { recursive: true });
  getDb();

  const fastify = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

  // 必须在注册路由之前设置，Fastify 的钩子/错误处理器按封装上下文与注册顺序生效
  fastify.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    const e = err as { statusCode?: number; message?: string };
    const statusCode = typeof e.statusCode === 'number' && e.statusCode >= 400 ? e.statusCode : 500;
    return reply.status(statusCode).send({
      error: { code: 'INTERNAL', message: e.message || 'Internal Server Error' },
    });
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(websocket, { options: { maxPayload: 1024 * 1024 } });

  fastify.get('/ws', { websocket: true }, (socket) => {
    const client = socket as unknown as WsClient;
    addClient(client);
    socket.on('close', () => removeClient(client));
    socket.on('error', () => removeClient(client));
  });

  await fastify.register(
    async (api) => {
      await api.register(taskRoutes, { prefix: '/tasks' });
      await api.register(historyRoutes, { prefix: '/history' });
      await api.register(settingsRoutes, { prefix: '/settings' });
      await api.register(dashboardRoutes, { prefix: '/dashboard' });
      await api.register(systemRoutes, { prefix: '/system' });
    },
    { prefix: '/api' },
  );

  fastify.get('/api/health', async () => ({ ok: true, version: config.version }));

  // 生产模式：托管前端构建产物
  const dist = path.join(config.rootDir, 'client', 'dist');
  if (existsSync(dist)) {
    await fastify.register(fastifyStatic, { root: dist, prefix: '/' });
    fastify.setNotFoundHandler((req, reply) => {
      const url = req.url ?? '';
      if (url.startsWith('/api') || url.startsWith('/ws')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
      }
      return reply.sendFile('index.html');
    });
  }

  // 服务重启后恢复任务
  queue.recover();

  await fastify.listen({ port: config.port, host: config.host });
  console.log(`[server] 在线视频下载管理器后端已启动 http://${config.host}:${config.port}`);
  console.log(`[server] 下载目录: ${config.downloadDir}`);
  console.log(`[server] 数据目录: ${config.dataDir}`);

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[server] 正在关闭…');
    queue.shutdown();
    await fastify.close();
    getDb().close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});

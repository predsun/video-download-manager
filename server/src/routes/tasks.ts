import { spawn } from 'node:child_process';
import path from 'node:path';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError, ErrorMessages, badRequest } from '../errors';
import { detectPlatform, validateUrl } from '../platform/detect';
import { parseUrl } from '../services/parser';
import { queue } from '../services/queue';
import { createTask, getTask, listTasks, removeTask } from '../services/taskService';

function openFolder(filePath: string | null, fallbackDir: string): void {
  const dir = filePath ? path.dirname(filePath) : fallbackDir;
  if (process.platform === 'win32') {
    const args = filePath ? ['/select,', filePath] : [dir];
    spawn('explorer', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', filePath ? ['-R', filePath] : [dir], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref();
  }
}

interface CreateBody {
  url?: string;
  quality?: string;
  format?: string;
}

export default async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // 解析视频元数据（预览卡片）
  fastify.post('/parse', async (req, reply) => {
    const body = req.body as CreateBody;
    if (!body?.url) throw badRequest('INVALID_URL');
    const v = validateUrl(body.url);
    if (!v.ok) throw badRequest('INVALID_URL');
    if (!detectPlatform(body.url)) {
      throw new AppError('UNSUPPORTED_PLATFORM', ErrorMessages.UNSUPPORTED_PLATFORM, 400);
    }
    const result = await parseUrl(body.url);
    return reply.send(result);
  });

  // 任务列表
  fastify.get('/', async () => listTasks());

  // 创建任务并加入队列
  fastify.post('/', async (req, reply) => {
    const body = req.body as CreateBody;
    if (!body?.url) throw badRequest('INVALID_URL');
    const v = validateUrl(body.url);
    if (!v.ok) throw badRequest('INVALID_URL');
    const task = await createTask({ url: body.url, quality: body.quality, format: body.format });
    return reply.code(201).send(task);
  });

  fastify.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    return reply.send(t);
  });

  fastify.post('/:id/pause', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    queue.pause(req.params.id);
    return reply.send(getTask(req.params.id));
  });

  fastify.post('/:id/resume', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    queue.resume(req.params.id);
    return reply.send(getTask(req.params.id));
  });

  fastify.post('/:id/cancel', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    queue.cancel(req.params.id);
    return reply.send(getTask(req.params.id));
  });

  fastify.post('/:id/retry', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    queue.retry(req.params.id);
    return reply.send(getTask(req.params.id));
  });

  fastify.delete('/:id', async (req: FastifyRequest<{ Params: { id: string }; Querystring: { deleteFile?: string } }>, reply) => {
    const deleteFile = req.query.deleteFile === 'true' || req.query.deleteFile === '1';
    removeTask(req.params.id, deleteFile);
    return reply.send({ ok: true });
  });

  fastify.post('/:id/open', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const t = getTask(req.params.id);
    if (!t) throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    openFolder(t.filePath, t.outputDir);
    return reply.send({ ok: true });
  });
}

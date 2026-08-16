import { FastifyInstance, FastifyRequest } from 'fastify';
import { listHistory, removeTask } from '../services/taskService';
import { AppError, ErrorMessages } from '../errors';

interface HistoryQuery {
  search?: string;
  platform?: string;
  status?: string;
  sort?: string;
}

export default async function historyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req: FastifyRequest<{ Querystring: HistoryQuery }>) => {
    return listHistory({
      search: req.query.search,
      platform: req.query.platform,
      status: req.query.status,
      sort: req.query.sort,
    });
  });

  fastify.delete('/:id', async (req: FastifyRequest<{ Params: { id: string }; Querystring: { deleteFile?: string } }>, reply) => {
    const deleteFile = req.query.deleteFile === 'true' || req.query.deleteFile === '1';
    try {
      removeTask(req.params.id, deleteFile);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('NOT_FOUND', ErrorMessages.NOT_FOUND, 404);
    }
    return reply.send({ ok: true });
  });
}

import { FastifyInstance } from 'fastify';
import { getSystemInfo } from '../services/system';

export default async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async () => getSystemInfo());
}

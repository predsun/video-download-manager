import { FastifyInstance } from 'fastify';
import { getDashboard } from '../services/stats';

export default async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async () => getDashboard());
}

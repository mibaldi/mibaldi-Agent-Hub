import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { serializeHistory } from '../services.js';

export async function historyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Querystring: { limit?: string } }>('/api/history', async (req) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 200);
    const entries = await prisma.history.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return entries.map(serializeHistory);
  });

  app.delete('/api/history', async (_req, reply) => {
    await prisma.history.deleteMany({});
    return reply.code(204).send();
  });
}

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config.js';
import { registerAuth } from './auth.js';
import { prisma } from './db.js';
import { authRoutes } from './routes/auth.js';
import { hostRoutes } from './routes/hosts.js';
import { projectRoutes } from './routes/projects.js';
import { historyRoutes } from './routes/history.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { registerTerminalWs } from './terminal/ws.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  await app.register(cookie);
  await app.register(websocket);

  registerAuth(app);

  // Salud (sin auth).
  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(authRoutes);
  await app.register(hostRoutes);
  await app.register(projectRoutes);
  await app.register(historyRoutes);
  await app.register(dashboardRoutes);
  registerTerminalWs(app);

  // Servir el frontend compilado en producción (SPA fallback a index.html).
  const webDist = config.webDist || resolve(process.cwd(), '../web/dist');
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'No encontrado' });
        return;
      }
      reply.sendFile('index.html');
    });
    app.log.info(`Sirviendo frontend desde ${webDist}`);
  } else {
    app.log.warn(`No se encontró el frontend en ${webDist} (modo solo-API)`);
  }

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Mibaldi Agent Hub API escuchando en ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();

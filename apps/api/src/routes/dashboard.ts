import type { FastifyInstance } from 'fastify';
import type { ActiveSession, DashboardData } from '@mah/shared';
import { prisma } from '../db.js';
import { serializeHost, serializeProject, serializeHistory, hostSecrets } from '../services.js';
import { buildListSessions } from '../terminal/tmux.js';
import { runSshCommand } from '../terminal/ssh.js';
import { runLocalCommand } from '../terminal/local.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/dashboard', async () => {
    const [hosts, projects, recent] = await Promise.all([
      prisma.host.findMany({ orderBy: { name: 'asc' } }),
      prisma.project.findMany({ orderBy: { lastOpenedAt: 'desc' } }),
      prisma.history.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    const lastProject = projects.find((p) => p.lastOpenedAt) ?? null;
    const favorites = projects.filter((p) => p.favorite);

    const data: DashboardData = {
      hosts: hosts.map(serializeHost),
      // Las sesiones activas se consultan por separado (endpoint /sessions) para
      // no bloquear el dashboard con conexiones lentas.
      activeSessions: [],
      lastProject: lastProject ? serializeProject(lastProject) : null,
      favorites: favorites.map(serializeProject),
      recent: recent.map(serializeHistory),
    };
    return data;
  });

  // Lista las sesiones tmux activas consultando cada host (best-effort).
  app.get('/api/sessions', async () => {
    const hosts = await prisma.host.findMany();
    const projects = await prisma.project.findMany();
    const result: ActiveSession[] = [];

    await Promise.all(
      hosts.map(async (host) => {
        let out = '';
        try {
          if (host.type === 'ssh') {
            out = await runSshCommand(host, hostSecrets(host), buildListSessions());
          } else {
            out = await runLocalCommand(host, buildListSessions());
          }
        } catch {
          return;
        }
        const sessions = new Set(
          out
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        for (const p of projects.filter((p) => p.hostId === host.id)) {
          if (sessions.has(p.tmuxSession)) {
            result.push({
              projectId: p.id,
              projectName: p.name,
              hostId: host.id,
              hostName: host.name,
              tmuxSession: p.tmuxSession,
            });
          }
        }
      }),
    );

    return result;
  });
}

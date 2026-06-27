import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { serializeProject, hostSecrets } from '../services.js';
import { sanitizeSessionName, buildKillSession } from '../terminal/tmux.js';
import { runSshCommand } from '../terminal/ssh.js';
import { runLocalCommand } from '../terminal/local.js';

const quickCommandSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  command: z.string().min(1),
  description: z.string().optional(),
  confirm: z.boolean().default(false),
});

const projectSchema = z.object({
  hostId: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  initialCommand: z.string().nullish(),
  defaultAgent: z.enum(['claude', 'codex', 'shell', 'custom']).optional(),
  tmuxSession: z.string().optional(),
  quickCommands: z.array(quickCommandSchema).optional(),
  favorite: z.boolean().optional(),
});

function withIds(cmds?: z.infer<typeof quickCommandSchema>[]) {
  return (cmds ?? []).map((c) => ({ ...c, id: c.id ?? randomUUID(), confirm: c.confirm ?? false }));
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Querystring: { hostId?: string } }>('/api/projects', async (req) => {
    const projects = await prisma.project.findMany({
      where: req.query.hostId ? { hostId: req.query.hostId } : undefined,
      orderBy: { name: 'asc' },
    });
    return projects.map(serializeProject);
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    return serializeProject(project);
  });

  app.post('/api/projects', async (req, reply) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const d = parsed.data;
    const session = sanitizeSessionName(d.tmuxSession || d.name);
    const project = await prisma.project.create({
      data: {
        hostId: d.hostId,
        name: d.name,
        path: d.path,
        initialCommand: d.initialCommand ?? null,
        defaultAgent: d.defaultAgent ?? 'shell',
        tmuxSession: session,
        quickCommands: withIds(d.quickCommands),
        favorite: d.favorite ?? false,
      },
    });
    return reply.code(201).send(serializeProject(project));
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const d = parsed.data;
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        hostId: d.hostId ?? undefined,
        name: d.name ?? undefined,
        path: d.path ?? undefined,
        initialCommand: d.initialCommand === undefined ? undefined : d.initialCommand,
        defaultAgent: d.defaultAgent ?? undefined,
        tmuxSession: d.tmuxSession ? sanitizeSessionName(d.tmuxSession) : undefined,
        quickCommands: d.quickCommands === undefined ? undefined : withIds(d.quickCommands),
        favorite: d.favorite === undefined ? undefined : d.favorite,
      },
    });
    return serializeProject(project);
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    await prisma.project.delete({ where: { id: req.params.id } }).catch(() => {});
    return reply.code(204).send();
  });

  // Registrar ejecución de un comando rápido en el historial.
  app.post<{ Params: { id: string }; Body: { command: string; name?: string } }>(
    '/api/projects/:id/quick-command',
    async (req, reply) => {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: { host: true },
      });
      if (!project) return reply.code(404).send({ error: 'Proyecto no encontrado' });
      await prisma.history.create({
        data: {
          kind: 'quick_command',
          hostId: project.hostId,
          hostName: project.host.name,
          projectId: project.id,
          projectName: project.name,
          command: req.body.name ? `${req.body.name}: ${req.body.command}` : req.body.command,
        },
      });
      return { ok: true };
    },
  );

  // Matar explícitamente la sesión tmux del proyecto.
  app.post<{ Params: { id: string } }>('/api/projects/:id/kill-session', async (req, reply) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { host: true },
    });
    if (!project) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    const cmd = buildKillSession(project.tmuxSession);
    try {
      if (project.host.type === 'ssh') {
        await runSshCommand(project.host, hostSecrets(project.host), cmd);
      } else {
        await runLocalCommand(project.host, cmd);
      }
      await prisma.history.create({
        data: {
          kind: 'session_kill',
          hostId: project.hostId,
          hostName: project.host.name,
          projectId: project.id,
          projectName: project.name,
          command: `tmux kill-session -t ${project.tmuxSession}`,
        },
      });
      return { ok: true };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });
}

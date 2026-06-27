import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { encrypt } from '../crypto.js';
import { serializeHost, hostSecrets } from '../services.js';
import { runSshCommand } from '../terminal/ssh.js';
import { runLocalCommand } from '../terminal/local.js';

const hostSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['local', 'ssh', 'docker', 'wsl']),
  hostname: z.string().nullish(),
  port: z.number().int().positive().nullish(),
  username: z.string().nullish(),
  authMethod: z.enum(['password', 'key', 'none']),
  password: z.string().nullish(),
  privateKey: z.string().nullish(),
  passphrase: z.string().nullish(),
  basePath: z.string().nullish(),
  container: z.string().nullish(),
  tags: z.array(z.string()).optional(),
});

export async function hostRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/hosts', async () => {
    const hosts = await prisma.host.findMany({ orderBy: { name: 'asc' } });
    return hosts.map(serializeHost);
  });

  app.get<{ Params: { id: string } }>('/api/hosts/:id', async (req, reply) => {
    const host = await prisma.host.findUnique({ where: { id: req.params.id } });
    if (!host) return reply.code(404).send({ error: 'Host no encontrado' });
    return serializeHost(host);
  });

  app.post('/api/hosts', async (req, reply) => {
    const parsed = hostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const d = parsed.data;
    const host = await prisma.host.create({
      data: {
        name: d.name,
        type: d.type,
        hostname: d.hostname ?? null,
        port: d.port ?? (d.type === 'ssh' ? 22 : null),
        username: d.username ?? null,
        authMethod: d.authMethod,
        passwordEnc: encrypt(d.password),
        privateKeyEnc: encrypt(d.privateKey),
        passphraseEnc: encrypt(d.passphrase),
        basePath: d.basePath ?? null,
        container: d.container ?? null,
        tags: d.tags ?? [],
      },
    });
    return reply.code(201).send(serializeHost(host));
  });

  app.put<{ Params: { id: string } }>('/api/hosts/:id', async (req, reply) => {
    const parsed = hostSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const d = parsed.data;
    const existing = await prisma.host.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: 'Host no encontrado' });
    const host = await prisma.host.update({
      where: { id: req.params.id },
      data: {
        name: d.name ?? undefined,
        type: d.type ?? undefined,
        hostname: d.hostname === undefined ? undefined : d.hostname,
        port: d.port === undefined ? undefined : d.port,
        username: d.username === undefined ? undefined : d.username,
        authMethod: d.authMethod ?? undefined,
        // Sólo re-cifrar si se envía un valor (string vacío = borrar secreto).
        passwordEnc: d.password === undefined ? undefined : encrypt(d.password),
        privateKeyEnc: d.privateKey === undefined ? undefined : encrypt(d.privateKey),
        passphraseEnc: d.passphrase === undefined ? undefined : encrypt(d.passphrase),
        basePath: d.basePath === undefined ? undefined : d.basePath,
        container: d.container === undefined ? undefined : d.container,
        tags: d.tags ?? undefined,
      },
    });
    return serializeHost(host);
  });

  app.delete<{ Params: { id: string } }>('/api/hosts/:id', async (req, reply) => {
    await prisma.host.delete({ where: { id: req.params.id } }).catch(() => {});
    return reply.code(204).send();
  });

  // Comprobar estado online ejecutando un comando trivial.
  app.post<{ Params: { id: string } }>('/api/hosts/:id/check', async (req, reply) => {
    const host = await prisma.host.findUnique({ where: { id: req.params.id } });
    if (!host) return reply.code(404).send({ error: 'Host no encontrado' });
    try {
      if (host.type === 'ssh') {
        await runSshCommand(host, hostSecrets(host), 'echo ok');
      } else {
        await runLocalCommand(host, 'echo ok');
      }
      await prisma.host.update({ where: { id: host.id }, data: { lastConnectedAt: new Date() } });
      return { online: true };
    } catch (err) {
      return { online: false, error: (err as Error).message };
    }
  });
}

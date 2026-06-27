import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signToken, verifyCredentials } from '../auth.js';
import { config } from '../config.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const { username, password } = parsed.data;
    const ok = await verifyCredentials(username, password);
    if (!ok) return reply.code(401).send({ error: 'Credenciales incorrectas' });
    const token = signToken(username);
    reply.setCookie('mah_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return { token, username };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('mah_token', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: app.authenticate }, async (req) => {
    const user = (req as typeof req & { user?: { sub: string } }).user;
    return { username: user?.sub };
  });
}

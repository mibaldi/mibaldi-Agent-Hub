import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface TokenPayload {
  sub: string; // username
}

let cachedHash: string | null = null;

async function adminHash(): Promise<string> {
  if (cachedHash) return cachedHash;
  if (config.admin.passwordHash) {
    cachedHash = config.admin.passwordHash;
  } else if (config.admin.password) {
    cachedHash = await bcrypt.hash(config.admin.password, 10);
  } else {
    throw new Error('No hay ADMIN_PASSWORD ni ADMIN_PASSWORD_HASH configurados');
  }
  return cachedHash;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (username !== config.admin.username) return false;
  const hash = await adminHash();
  return bcrypt.compare(password, hash);
}

export function signToken(username: string): string {
  return jwt.sign({ sub: username } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.mah_token;
  if (cookie) return cookie;
  // Para el WebSocket aceptamos token por query string.
  const q = (req.query as Record<string, string> | undefined)?.token;
  if (q) return q;
  return null;
}

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    reply.code(401).send({ error: 'No autenticado' });
    return;
  }
  (req as FastifyRequest & { user?: TokenPayload }).user = payload;
}

// Registra un decorator de autenticación reutilizable.
export function registerAuth(app: FastifyInstance): void {
  app.decorate('authenticate', authHook);
}

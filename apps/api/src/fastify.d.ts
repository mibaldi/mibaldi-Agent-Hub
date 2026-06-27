import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TokenPayload } from './auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

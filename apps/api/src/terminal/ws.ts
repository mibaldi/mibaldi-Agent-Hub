import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientTerminalMessage, ServerTerminalMessage } from '@mah/shared';
import { prisma } from '../db.js';
import { verifyToken } from '../auth.js';
import { hostSecrets } from '../services.js';
import { buildAttachOrCreate } from './tmux.js';
import { openSshSession } from './ssh.js';
import { openLocalSession } from './local.js';
import type { TerminalSession } from './types.js';

function send(ws: WebSocket, msg: ServerTerminalMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Registra GET /api/terminal/:projectId (WebSocket).
export function registerTerminalWs(app: FastifyInstance): void {
  app.get<{ Params: { projectId: string }; Querystring: { token?: string; cols?: string; rows?: string } }>(
    '/api/terminal/:projectId',
    { websocket: true },
    async (socket, req) => {
      const ws = socket as unknown as WebSocket;

      // Autenticación por token en query (los WS no llevan cabeceras Authorization).
      const token = req.query.token;
      if (!token || !verifyToken(token)) {
        send(ws, { type: 'error', message: 'No autenticado' });
        ws.close();
        return;
      }

      const project = await prisma.project.findUnique({
        where: { id: req.params.projectId },
        include: { host: true },
      });
      if (!project) {
        send(ws, { type: 'error', message: 'Proyecto no encontrado' });
        ws.close();
        return;
      }

      const cols = parseInt(req.query.cols ?? '80', 10) || 80;
      const rows = parseInt(req.query.rows ?? '24', 10) || 24;
      const host = project.host;
      const script = buildAttachOrCreate({
        session: project.tmuxSession,
        cwd: project.path || host.basePath,
        initialCommand: project.initialCommand,
      });

      let term: TerminalSession;
      try {
        if (host.type === 'ssh') {
          term = await openSshSession(host, hostSecrets(host), script, cols, rows);
        } else {
          term = await openLocalSession(host, script, cols, rows);
        }
      } catch (err) {
        send(ws, { type: 'error', message: `No se pudo conectar: ${(err as Error).message}` });
        ws.close();
        return;
      }

      // Registrar apertura de sesión + marcar host como conectado.
      await Promise.all([
        prisma.history.create({
          data: {
            kind: 'session_open',
            hostId: host.id,
            hostName: host.name,
            projectId: project.id,
            projectName: project.name,
            command: null,
          },
        }),
        prisma.host.update({ where: { id: host.id }, data: { lastConnectedAt: new Date() } }),
        prisma.project.update({ where: { id: project.id }, data: { lastOpenedAt: new Date() } }),
      ]).catch(() => {});

      send(ws, { type: 'ready', session: project.tmuxSession });

      term.onData((data) => send(ws, { type: 'data', data }));
      term.onExit((code) => {
        send(ws, { type: 'exit', code });
        ws.close();
      });

      ws.on('message', (raw: Buffer) => {
        let msg: ClientTerminalMessage;
        try {
          msg = JSON.parse(raw.toString('utf8'));
        } catch {
          return;
        }
        if (msg.type === 'input') term.write(msg.data);
        else if (msg.type === 'resize') term.resize(msg.cols, msg.rows);
        else if (msg.type === 'ping') send(ws, { type: 'pong' });
      });

      ws.on('close', () => {
        // Cerrar la pestaña/socket NO mata tmux: sólo se hace detach.
        term.close();
      });
    },
  );
}

import { Client } from 'ssh2';
import type { ClientChannel } from 'ssh2';
import type { Host } from '@prisma/client';
import type { HostSecrets, TerminalSession } from './types.js';

export function openSshSession(
  host: Host,
  secrets: HostSecrets,
  command: string,
  cols: number,
  rows: number,
): Promise<TerminalSession> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stream: ClientChannel | null = null;
    const dataCbs: Array<(d: string) => void> = [];
    const exitCbs: Array<(c: number | null) => void> = [];

    conn.on('ready', () => {
      conn.exec(
        command,
        { pty: { cols, rows, term: 'xterm-256color' } },
        (err, ch) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          stream = ch;
          ch.on('data', (d: Buffer) => dataCbs.forEach((cb) => cb(d.toString('utf8'))));
          ch.stderr.on('data', (d: Buffer) => dataCbs.forEach((cb) => cb(d.toString('utf8'))));
          ch.on('close', (code: number | null) => {
            exitCbs.forEach((cb) => cb(code));
            conn.end();
          });

          resolve({
            write: (data: string) => stream?.write(data),
            resize: (c: number, r: number) => stream?.setWindow(r, c, 0, 0),
            onData: (cb) => dataCbs.push(cb),
            onExit: (cb) => exitCbs.push(cb),
            close: () => {
              // Cierra la conexión SSH: detach de tmux pero NO mata la sesión.
              try {
                stream?.end();
              } catch {
                /* noop */
              }
              conn.end();
            },
          });
        },
      );
    });

    conn.on('error', (err) => reject(err));

    const connectConfig: Parameters<Client['connect']>[0] = {
      host: host.hostname ?? 'localhost',
      port: host.port ?? 22,
      username: host.username ?? undefined,
      readyTimeout: 15000,
      keepaliveInterval: 10000,
    };

    if (host.authMethod === 'key' && secrets.privateKey) {
      connectConfig.privateKey = secrets.privateKey;
      if (secrets.passphrase) connectConfig.passphrase = secrets.passphrase;
    } else if (host.authMethod === 'password' && secrets.password) {
      connectConfig.password = secrets.password;
    }

    conn.connect(connectConfig);
  });
}

// Ejecuta un comando puntual por SSH y devuelve stdout (para kill-session, list, etc.).
export function runSshCommand(
  host: Host,
  secrets: HostSecrets,
  command: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    conn.on('ready', () => {
      conn.exec(command, (err, ch) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }
        ch.on('data', (d: Buffer) => (out += d.toString('utf8')));
        ch.stderr.on('data', () => {});
        ch.on('close', () => {
          conn.end();
          resolve(out);
        });
      });
    });
    conn.on('error', reject);
    const cfg: Parameters<Client['connect']>[0] = {
      host: host.hostname ?? 'localhost',
      port: host.port ?? 22,
      username: host.username ?? undefined,
      readyTimeout: 10000,
    };
    if (host.authMethod === 'key' && secrets.privateKey) {
      cfg.privateKey = secrets.privateKey;
      if (secrets.passphrase) cfg.passphrase = secrets.passphrase;
    } else if (host.authMethod === 'password' && secrets.password) {
      cfg.password = secrets.password;
    }
    conn.connect(cfg);
  });
}

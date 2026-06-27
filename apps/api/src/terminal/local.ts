import { spawn as cpSpawn } from 'node:child_process';
import type { Host } from '@prisma/client';
import type { TerminalSession } from './types.js';

// node-pty es opcional (requiere build nativo). Si no está disponible, las
// sesiones locales/docker/wsl no funcionarán pero la API sigue corriendo
// perfectamente para hosts SSH.
type PtyModule = typeof import('node-pty');
let ptyMod: PtyModule | null = null;
let ptyLoaded = false;

async function loadPty(): Promise<PtyModule | null> {
  if (ptyLoaded) return ptyMod;
  ptyLoaded = true;
  try {
    ptyMod = await import('node-pty');
  } catch {
    ptyMod = null;
    // eslint-disable-next-line no-console
    console.warn('[terminal] node-pty no disponible: hosts local/docker/wsl deshabilitados');
  }
  return ptyMod;
}

// Construye el argv para envolver el script de shell según el tipo de host.
function buildArgv(host: Host, command: string): { file: string; args: string[] } {
  switch (host.type) {
    case 'docker': {
      const container = host.container ?? host.hostname ?? '';
      return {
        file: 'docker',
        args: ['exec', '-it', container, 'sh', '-lc', command],
      };
    }
    case 'wsl': {
      const distro = host.container ?? host.hostname;
      const args = distro ? ['-d', distro, '--', 'sh', '-lc', command] : ['--', 'sh', '-lc', command];
      return { file: 'wsl', args };
    }
    case 'local':
    default:
      return { file: 'sh', args: ['-lc', command] };
  }
}

export async function openLocalSession(
  host: Host,
  command: string,
  cols: number,
  rows: number,
): Promise<TerminalSession> {
  const pty = await loadPty();
  const { file, args } = buildArgv(host, command);

  if (pty) {
    const term = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: host.basePath ?? process.env.HOME ?? '/',
      env: process.env as Record<string, string>,
    });
    const exitCbs: Array<(c: number | null) => void> = [];
    return {
      write: (data) => term.write(data),
      resize: (c, r) => {
        try {
          term.resize(c, r);
        } catch {
          /* noop */
        }
      },
      onData: (cb) => term.onData(cb),
      onExit: (cb) => exitCbs.push(cb),
      close: () => {
        // Cierra el PTY local sin matar tmux: tmux corre en segundo plano (-d)
        // y attach es lo único que termina. Matamos solo el proceso de attach.
        try {
          term.kill();
        } catch {
          /* noop */
        }
      },
    };
  }

  // Fallback sin PTY (sin redimensionado real). Útil sólo para pruebas básicas.
  const child = cpSpawn(file, args, { cwd: host.basePath ?? undefined });
  const dataCbs: Array<(d: string) => void> = [];
  const exitCbs: Array<(c: number | null) => void> = [];
  child.stdout.on('data', (d: Buffer) => dataCbs.forEach((cb) => cb(d.toString('utf8'))));
  child.stderr.on('data', (d: Buffer) => dataCbs.forEach((cb) => cb(d.toString('utf8'))));
  child.on('exit', (code) => exitCbs.forEach((cb) => cb(code)));
  return {
    write: (data) => child.stdin.write(data),
    resize: () => {},
    onData: (cb) => dataCbs.push(cb),
    onExit: (cb) => exitCbs.push(cb),
    close: () => child.kill(),
  };
}

// Ejecuta un comando puntual local y devuelve stdout.
export function runLocalCommand(host: Host, command: string): Promise<string> {
  const { file, args } = buildArgv(host, command);
  return new Promise((resolve, reject) => {
    const child = cpSpawn(file, args);
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')));
    child.on('error', reject);
    child.on('close', () => resolve(out));
  });
}

import type { Host } from '@prisma/client';

// Abstracción de una sesión de terminal sobre cualquier transporte (SSH/local).
export interface TerminalSession {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (code: number | null) => void): void;
  close(): void; // cierra la conexión SIN matar tmux
}

export interface OpenTerminalParams {
  host: Host;
  command: string; // script de shell a ejecutar dentro del PTY
  cols: number;
  rows: number;
}

// Secretos descifrados que necesita el transporte (no se persisten).
export interface HostSecrets {
  password?: string | null;
  privateKey?: string | null;
  passphrase?: string | null;
}

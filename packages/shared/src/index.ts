// Tipos compartidos entre la API y el frontend de Mibaldi Agent Hub.

export type HostType = 'local' | 'ssh' | 'docker' | 'wsl';
export type AuthMethod = 'password' | 'key' | 'none';
export type AgentType = 'claude' | 'codex' | 'shell' | 'custom';

export interface Host {
  id: string;
  name: string;
  type: HostType;
  hostname: string | null;
  port: number | null;
  username: string | null;
  authMethod: AuthMethod;
  // Nunca se devuelven secretos al cliente; sólo si los hay configurados.
  hasPassword: boolean;
  hasPrivateKey: boolean;
  basePath: string | null;
  // Para docker: nombre/ID del contenedor. Para wsl: nombre de la distro.
  container: string | null;
  tags: string[];
  online: boolean;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HostInput {
  name: string;
  type: HostType;
  hostname?: string | null;
  port?: number | null;
  username?: string | null;
  authMethod: AuthMethod;
  // Secretos en texto plano sólo en el momento de crear/editar.
  password?: string | null;
  privateKey?: string | null;
  passphrase?: string | null;
  basePath?: string | null;
  container?: string | null;
  tags?: string[];
}

export interface QuickCommand {
  id: string;
  name: string;
  command: string;
  description?: string;
  confirm: boolean;
}

export interface Project {
  id: string;
  hostId: string;
  name: string;
  path: string;
  initialCommand: string | null;
  defaultAgent: AgentType;
  tmuxSession: string;
  quickCommands: QuickCommand[];
  favorite: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  hostId: string;
  name: string;
  path: string;
  initialCommand?: string | null;
  defaultAgent?: AgentType;
  tmuxSession?: string;
  quickCommands?: Omit<QuickCommand, 'id'>[];
  favorite?: boolean;
}

export type HistoryKind = 'session_open' | 'quick_command' | 'session_kill';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  hostId: string | null;
  hostName: string | null;
  projectId: string | null;
  projectName: string | null;
  command: string | null;
  createdAt: string;
}

export interface DashboardData {
  hosts: Host[];
  activeSessions: ActiveSession[];
  lastProject: Project | null;
  favorites: Project[];
  recent: HistoryEntry[];
}

export interface ActiveSession {
  projectId: string;
  projectName: string;
  hostId: string;
  hostName: string;
  tmuxSession: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
}

// Protocolo del WebSocket de terminal (envoltura JSON).
export type ClientTerminalMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' };

export type ServerTerminalMessage =
  | { type: 'data'; data: string }
  | { type: 'ready'; session: string }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }
  | { type: 'pong' };

import type { Host as DbHost, Project as DbProject, History as DbHistory } from '@prisma/client';
import type { Host, Project, HistoryEntry, QuickCommand } from '@mah/shared';
import { decrypt } from './crypto.js';
import type { HostSecrets } from './terminal/types.js';

export function serializeHost(h: DbHost): Host {
  return {
    id: h.id,
    name: h.name,
    type: h.type as Host['type'],
    hostname: h.hostname,
    port: h.port,
    username: h.username,
    authMethod: h.authMethod as Host['authMethod'],
    hasPassword: !!h.passwordEnc,
    hasPrivateKey: !!h.privateKeyEnc,
    basePath: h.basePath,
    container: h.container,
    tags: h.tags,
    // El estado online se calcula bajo demanda; por defecto false.
    online: false,
    lastConnectedAt: h.lastConnectedAt ? h.lastConnectedAt.toISOString() : null,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

export function hostSecrets(h: DbHost): HostSecrets {
  return {
    password: decrypt(h.passwordEnc),
    privateKey: decrypt(h.privateKeyEnc),
    passphrase: decrypt(h.passphraseEnc),
  };
}

export function serializeProject(p: DbProject): Project {
  return {
    id: p.id,
    hostId: p.hostId,
    name: p.name,
    path: p.path,
    initialCommand: p.initialCommand,
    defaultAgent: p.defaultAgent as Project['defaultAgent'],
    tmuxSession: p.tmuxSession,
    quickCommands: (p.quickCommands as unknown as QuickCommand[]) ?? [],
    favorite: p.favorite,
    lastOpenedAt: p.lastOpenedAt ? p.lastOpenedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeHistory(h: DbHistory): HistoryEntry {
  return {
    id: h.id,
    kind: h.kind as HistoryEntry['kind'],
    hostId: h.hostId,
    hostName: h.hostName,
    projectId: h.projectId,
    projectName: h.projectName,
    command: h.command,
    createdAt: h.createdAt.toISOString(),
  };
}

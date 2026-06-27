// Construcción del script de shell que adjunta o crea una sesión tmux persistente.

export interface TmuxOptions {
  session: string;
  cwd?: string | null;
  initialCommand?: string | null;
}

// Escapado para uso dentro de comillas simples en sh.
function shSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// Nombres de sesión tmux: sólo permitimos caracteres seguros.
export function sanitizeSessionName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return clean || 'session';
}

/**
 * Devuelve un comando de shell que:
 *  - si la sesión existe -> se adjunta
 *  - si no existe -> la crea en cwd, lanza el comando inicial y se adjunta
 * Idéntico para local y SSH (ambos ejecutan `sh -lc <script>` en un PTY).
 */
export function buildAttachOrCreate(opts: TmuxOptions): string {
  const session = sanitizeSessionName(opts.session);
  const sq = shSingleQuote(session);
  const cwdPart = opts.cwd ? ` -c ${shSingleQuote(opts.cwd)}` : '';
  const lines: string[] = [];
  lines.push(`if tmux has-session -t ${sq} 2>/dev/null; then`);
  lines.push(`  tmux attach-session -t ${sq};`);
  lines.push(`else`);
  lines.push(`  tmux new-session -d -s ${sq}${cwdPart};`);
  if (opts.initialCommand && opts.initialCommand.trim()) {
    const cmd = shSingleQuote(opts.initialCommand.trim());
    lines.push(`  tmux send-keys -t ${sq} ${cmd} C-m;`);
  }
  lines.push(`  tmux attach-session -t ${sq};`);
  lines.push(`fi`);
  return lines.join('\n');
}

export function buildKillSession(session: string): string {
  const sq = shSingleQuote(sanitizeSessionName(session));
  return `tmux kill-session -t ${sq} 2>/dev/null || true`;
}

export function buildListSessions(): string {
  return `tmux list-sessions -F '#{session_name}' 2>/dev/null || true`;
}

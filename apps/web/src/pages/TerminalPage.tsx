import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Project, QuickCommand } from '@mah/shared';
import { api } from '../api';
import { TerminalConnection, type ConnStatus } from '../terminalConnection';
import { TerminalView } from '../components/TerminalView';
import { ChatView } from '../components/ChatView';

export function TerminalPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [view, setView] = useState<'terminal' | 'chat'>('terminal');
  const connRef = useRef<TerminalConnection | null>(null);

  const conn = useMemo(() => {
    if (!projectId) return null;
    const c = new TerminalConnection(projectId);
    connRef.current = c;
    return c;
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    api.project(projectId).then(setProject);
  }, [projectId]);

  useEffect(() => {
    if (!conn) return;
    const off = conn.onStatus(setStatus);
    conn.connect();
    return () => {
      off();
      // Cerrar la vista hace detach: NO mata tmux.
      conn.close();
    };
  }, [conn]);

  const runQuick = async (qc: QuickCommand) => {
    if (qc.confirm && !confirm(`¿Ejecutar "${qc.name}"?\n\n${qc.command}`)) return;
    conn?.input(qc.command + '\r');
    if (projectId) api.logQuickCommand(projectId, qc.command, qc.name).catch(() => {});
  };

  const killSession = async () => {
    if (!projectId || !project) return;
    if (!confirm(`¿Matar la sesión tmux "${project.tmuxSession}"? Se perderá lo que esté corriendo.`))
      return;
    await api.killSession(projectId).catch((e) => alert(e.message));
    conn?.close();
    navigate(-1);
  };

  const closeOnly = () => {
    // Detach: vuelve atrás dejando tmux vivo.
    conn?.close();
    navigate(-1);
  };

  if (!conn) return null;

  return (
    <div className="terminal-page">
      <div className="terminal-header">
        <button className="ghost small" onClick={closeOnly} title="Cerrar (deja tmux vivo)">
          ✕
        </button>
        <div className="title">
          {project?.name ?? 'Terminal'}
          {project ? ` · ${project.tmuxSession}` : ''}
        </div>
        <span className={`conn-status ${status === 'connected' ? 'connected' : 'disconnected'}`}>
          {status === 'connected' ? '● online' : status === 'connecting' ? '… conectando' : '○ offline'}
        </span>
        <button
          className="ghost small"
          onClick={() => setView((v) => (v === 'terminal' ? 'chat' : 'terminal'))}
        >
          {view === 'terminal' ? '💬 Chat' : '🖥️ Terminal'}
        </button>
      </div>

      <div className="terminal-body">
        <TerminalView conn={conn} visible={view === 'terminal'} />
        <ChatView conn={conn} visible={view === 'chat'} />
      </div>

      <div className="terminal-toolbar">
        {/* Atajos útiles para móvil (teclas difíciles de teclear). */}
        <button onClick={() => conn.input('\t')}>Tab</button>
        <button onClick={() => conn.input('\x1b')}>Esc</button>
        <button onClick={() => conn.input('\x03')}>Ctrl-C</button>
        <button onClick={() => conn.input('\x04')}>Ctrl-D</button>
        <button onClick={() => conn.input('\x1a')}>Ctrl-Z</button>
        <button onClick={() => conn.input('\x12')}>Ctrl-R</button>
        <button onClick={() => conn.input('\x1b[A')}>↑</button>
        <button onClick={() => conn.input('\x1b[B')}>↓</button>
        {(project?.quickCommands ?? []).map((qc) => (
          <button key={qc.id} className="primary" onClick={() => runQuick(qc)} title={qc.description}>
            {qc.name}
          </button>
        ))}
        <button className="danger" onClick={killSession}>
          Matar tmux
        </button>
      </div>
    </div>
  );
}

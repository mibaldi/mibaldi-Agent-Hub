import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@mah/shared';
import { api } from '../api';

const kindLabel: Record<HistoryEntry['kind'], string> = {
  session_open: '▸ Sesión abierta',
  quick_command: '⚡ Comando rápido',
  session_kill: '✕ Sesión terminada',
};

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .history(100)
      .then(setEntries)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const clear = async () => {
    if (!confirm('¿Borrar todo el historial?')) return;
    await api.clearHistory();
    load();
  };

  if (loading) return <div className="spinner">Cargando…</div>;

  return (
    <>
      <div className="topbar">
        <h1>Historial</h1>
        {entries.length > 0 && (
          <button className="ghost small danger" onClick={clear}>
            Borrar
          </button>
        )}
      </div>
      {entries.length === 0 && <div className="empty">Sin actividad registrada.</div>}
      {entries.map((h) => (
        <div key={h.id} className="card">
          <div className="card-row">
            <div className="title" style={{ fontSize: 14 }}>
              {kindLabel[h.kind]}
            </div>
            <span className="sub">{new Date(h.createdAt).toLocaleString()}</span>
          </div>
          <div className="sub">
            {[h.projectName, h.hostName].filter(Boolean).join(' · ') || '—'}
          </div>
          {h.command && (
            <div className="sub" style={{ fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>
              {h.command}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

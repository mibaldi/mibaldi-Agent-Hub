import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DashboardData, ActiveSession } from '@mah/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { usePwaInstall } from '../usePwaInstall';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [error, setError] = useState('');
  const { logout } = useAuth();
  const { canInstall, installed, install, isIos } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message));
    // Sesiones activas: best-effort, en paralelo.
    api.activeSessions().then(setSessions).catch(() => {});
  }, []);

  if (error) return <div className="empty">Error: {error}</div>;
  if (!data) return <div className="spinner">Cargando…</div>;

  return (
    <>
      <div className="topbar">
        <h1>⚡ Agent Hub</h1>
        <button className="ghost small" onClick={() => logout().then(() => navigate('/login'))}>
          Salir
        </button>
      </div>

      {!installed && (canInstall || isIos) && (
        <div className="card card-row" style={{ borderColor: 'var(--accent)' }}>
          <div>
            <div className="title">📲 Instalar Agent Hub</div>
            <div className="sub">Añádela a tu pantalla de inicio como app.</div>
          </div>
          {canInstall ? (
            <button className="primary small" onClick={install}>
              Instalar
            </button>
          ) : (
            <button className="small" onClick={() => setShowIosHelp((v) => !v)}>
              ¿Cómo?
            </button>
          )}
        </div>
      )}
      {showIosHelp && (
        <div className="card sub">
          En iPhone: pulsa el botón <b>Compartir</b> de Safari y elige{' '}
          <b>Añadir a pantalla de inicio</b>.
        </div>
      )}

      {data.lastProject && (
        <>
          <h2>Continuar</h2>
          <div
            className="card card-row"
            role="button"
            onClick={() => navigate(`/terminal/${data.lastProject!.id}`)}
          >
            <div>
              <div className="title">{data.lastProject.name}</div>
              <div className="sub">tmux: {data.lastProject.tmuxSession}</div>
            </div>
            <button className="primary small">Abrir ▸</button>
          </div>
        </>
      )}

      <h2>Sesiones activas ({sessions.length})</h2>
      {sessions.length === 0 ? (
        <div className="card sub">No hay sesiones tmux activas detectadas.</div>
      ) : (
        sessions.map((s) => (
          <div
            key={s.projectId}
            className="card card-row"
            role="button"
            onClick={() => navigate(`/terminal/${s.projectId}`)}
          >
            <div>
              <div className="title">{s.projectName}</div>
              <div className="sub">
                {s.hostName} · {s.tmuxSession}
              </div>
            </div>
            <span className="badge online">
              <span className="dot" /> activa
            </span>
          </div>
        ))
      )}

      {data.favorites.length > 0 && (
        <>
          <h2>Favoritos</h2>
          {data.favorites.map((p) => (
            <div
              key={p.id}
              className="card card-row"
              role="button"
              onClick={() => navigate(`/terminal/${p.id}`)}
            >
              <div>
                <div className="title">⭐ {p.name}</div>
                <div className="sub">{p.path}</div>
              </div>
              <button className="primary small">Abrir ▸</button>
            </div>
          ))}
        </>
      )}

      <h2>Hosts ({data.hosts.length})</h2>
      {data.hosts.length === 0 ? (
        <div className="card sub">
          No hay hosts. <Link to="/hosts/new">Añade el primero</Link>.
        </div>
      ) : (
        data.hosts.map((h) => (
          <Link key={h.id} to={`/projects?hostId=${h.id}`} className="card card-row">
            <div>
              <div className="title">{h.name}</div>
              <div className="sub">
                {h.type}
                {h.hostname ? ` · ${h.username ? h.username + '@' : ''}${h.hostname}` : ''}
              </div>
            </div>
            <span className="badge">{h.type}</span>
          </Link>
        ))
      )}

      <h2>Reciente</h2>
      {data.recent.length === 0 ? (
        <div className="card sub">Sin actividad todavía.</div>
      ) : (
        data.recent.map((h) => (
          <div key={h.id} className="card">
            <div className="card-row">
              <div className="title" style={{ fontSize: 14 }}>
                {h.projectName ?? h.hostName ?? '—'}
              </div>
              <span className="sub">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
            {h.command && <div className="sub">{h.command}</div>}
          </div>
        ))
      )}
    </>
  );
}

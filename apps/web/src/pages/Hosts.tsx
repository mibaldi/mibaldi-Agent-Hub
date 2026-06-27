import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Host } from '@mah/shared';
import { api } from '../api';

export function Hosts() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const load = () =>
    api
      .hosts()
      .then(setHosts)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const check = async (id: string) => {
    setChecking(id);
    try {
      const res = await api.checkHost(id);
      setStatus((s) => ({ ...s, [id]: res.online }));
    } finally {
      setChecking(null);
    }
  };

  const remove = async (h: Host) => {
    if (!confirm(`¿Borrar el host "${h.name}" y sus proyectos?`)) return;
    await api.deleteHost(h.id);
    load();
  };

  if (loading) return <div className="spinner">Cargando…</div>;

  return (
    <>
      <div className="topbar">
        <h1>Hosts</h1>
      </div>
      {hosts.length === 0 && <div className="empty">Aún no hay hosts. Pulsa + para añadir uno.</div>}
      {hosts.map((h) => (
        <div key={h.id} className="card">
          <div className="card-row">
            <div>
              <div className="title">{h.name}</div>
              <div className="sub">
                {h.type}
                {h.hostname ? ` · ${h.username ? h.username + '@' : ''}${h.hostname}` : ''}
                {h.port ? `:${h.port}` : ''}
              </div>
            </div>
            {status[h.id] !== undefined && (
              <span className={`badge ${status[h.id] ? 'online' : 'offline'}`}>
                <span className="dot" /> {status[h.id] ? 'online' : 'offline'}
              </span>
            )}
          </div>
          {h.tags.length > 0 && (
            <div className="tags">
              {h.tags.map((t) => (
                <span key={t} className="badge">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="small" onClick={() => check(h.id)} disabled={checking === h.id}>
              {checking === h.id ? 'Comprobando…' : 'Comprobar'}
            </button>
            <Link className="btn small" to={`/projects?hostId=${h.id}`}>
              Proyectos
            </Link>
            <button className="small" onClick={() => navigate(`/hosts/${h.id}/edit`)}>
              Editar
            </button>
            <button className="small danger" onClick={() => remove(h)}>
              Borrar
            </button>
          </div>
        </div>
      ))}
      <button className="fab" onClick={() => navigate('/hosts/new')}>
        +
      </button>
    </>
  );
}

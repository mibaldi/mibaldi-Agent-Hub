import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Host, Project } from '@mah/shared';
import { api } from '../api';

export function Projects() {
  const [params] = useSearchParams();
  const hostId = params.get('hostId') ?? undefined;
  const [projects, setProjects] = useState<Project[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () =>
    Promise.all([api.projects(hostId), api.hosts()])
      .then(([p, h]) => {
        setProjects(p);
        setHosts(h);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    load();
  }, [hostId]);

  const hostName = (id: string) => hosts.find((h) => h.id === id)?.name ?? '—';

  const remove = async (p: Project) => {
    if (!confirm(`¿Borrar el proyecto "${p.name}"?`)) return;
    await api.deleteProject(p.id);
    load();
  };

  const toggleFav = async (p: Project) => {
    await api.updateProject(p.id, { favorite: !p.favorite });
    load();
  };

  if (loading) return <div className="spinner">Cargando…</div>;

  return (
    <>
      <div className="topbar">
        <h1>Proyectos{hostId ? ` · ${hostName(hostId)}` : ''}</h1>
      </div>
      {projects.length === 0 && <div className="empty">No hay proyectos. Pulsa + para crear uno.</div>}
      {projects.map((p) => (
        <div key={p.id} className="card">
          <div className="card-row">
            <div role="button" style={{ flex: 1 }} onClick={() => navigate(`/terminal/${p.id}`)}>
              <div className="title">
                {p.favorite ? '⭐ ' : ''}
                {p.name}
              </div>
              <div className="sub">
                {hostName(p.hostId)} · {p.path}
              </div>
              <div className="sub">
                agente: {p.defaultAgent} · tmux: {p.tmuxSession}
              </div>
            </div>
            <button className="primary small" onClick={() => navigate(`/terminal/${p.id}`)}>
              Abrir ▸
            </button>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="small" onClick={() => toggleFav(p)}>
              {p.favorite ? 'Quitar ⭐' : 'Favorito ⭐'}
            </button>
            <button className="small" onClick={() => navigate(`/projects/${p.id}/edit`)}>
              Editar
            </button>
            <button className="small danger" onClick={() => remove(p)}>
              Borrar
            </button>
          </div>
        </div>
      ))}
      {hosts.length === 0 ? (
        <div className="empty">
          Primero crea un <Link to="/hosts/new">host</Link>.
        </div>
      ) : (
        <button
          className="fab"
          onClick={() => navigate(`/projects/new${hostId ? `?hostId=${hostId}` : ''}`)}
        >
          +
        </button>
      )}
    </>
  );
}

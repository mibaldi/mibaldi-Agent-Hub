import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AgentType, Host, ProjectInput, QuickCommand } from '@mah/shared';
import { api } from '../api';

type QC = Omit<QuickCommand, 'id'>;

export function ProjectForm() {
  const { id } = useParams();
  const editing = !!id;
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostId, setHostId] = useState(params.get('hostId') ?? '');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [initialCommand, setInitialCommand] = useState('');
  const [defaultAgent, setDefaultAgent] = useState<AgentType>('shell');
  const [tmuxSession, setTmuxSession] = useState('');
  const [quickCommands, setQuickCommands] = useState<QC[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.hosts().then((h) => {
      setHosts(h);
      if (!hostId && h.length && !editing) setHostId(h[0].id);
    });
    if (id) {
      api.project(id).then((p) => {
        setHostId(p.hostId);
        setName(p.name);
        setPath(p.path);
        setInitialCommand(p.initialCommand ?? '');
        setDefaultAgent(p.defaultAgent);
        setTmuxSession(p.tmuxSession);
        setQuickCommands(p.quickCommands.map(({ id: _id, ...rest }) => rest));
      });
    }
  }, [id]);

  const addQc = () =>
    setQuickCommands((q) => [...q, { name: '', command: '', description: '', confirm: false }]);
  const updateQc = (i: number, patch: Partial<QC>) =>
    setQuickCommands((q) => q.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeQc = (i: number) => setQuickCommands((q) => q.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload: ProjectInput = {
      hostId,
      name,
      path,
      initialCommand: initialCommand || null,
      defaultAgent,
      tmuxSession: tmuxSession || undefined,
      quickCommands: quickCommands.filter((q) => q.name && q.command),
    };
    try {
      if (editing) await api.updateProject(id!, payload);
      else await api.createProject(payload);
      navigate(`/projects?hostId=${hostId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>{editing ? 'Editar proyecto' : 'Nuevo proyecto'}</h1>
        <button className="ghost small" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Host</label>
          <select value={hostId} onChange={(e) => setHostId(e.target.value)} required>
            <option value="" disabled>
              Selecciona host…
            </option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.type})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Nombre del proyecto</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Ruta del proyecto</label>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/home/usuario/mi-proyecto"
            autoCapitalize="none"
            required
          />
        </div>
        <div className="field">
          <label>Agente por defecto</label>
          <select value={defaultAgent} onChange={(e) => setDefaultAgent(e.target.value as AgentType)}>
            <option value="shell">shell</option>
            <option value="claude">claude</option>
            <option value="codex">codex</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div className="field">
          <label>Comando inicial (opcional)</label>
          <input
            value={initialCommand}
            onChange={(e) => setInitialCommand(e.target.value)}
            placeholder="claude   ó   npm run dev"
            autoCapitalize="none"
          />
        </div>
        <div className="field">
          <label>Nombre de sesión tmux (opcional)</label>
          <input
            value={tmuxSession}
            onChange={(e) => setTmuxSession(e.target.value)}
            placeholder="se genera desde el nombre si se deja vacío"
            autoCapitalize="none"
          />
        </div>

        <h2>Comandos rápidos</h2>
        {quickCommands.map((q, i) => (
          <div key={i} className="card">
            <div className="field">
              <label>Nombre</label>
              <input value={q.name} onChange={(e) => updateQc(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Comando</label>
              <input
                value={q.command}
                onChange={(e) => updateQc(i, { command: e.target.value })}
                autoCapitalize="none"
              />
            </div>
            <div className="field">
              <label>Descripción (opcional)</label>
              <input
                value={q.description ?? ''}
                onChange={(e) => updateQc(i, { description: e.target.value })}
              />
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={q.confirm}
                onChange={(e) => updateQc(i, { confirm: e.target.checked })}
                id={`qc-confirm-${i}`}
              />
              <label htmlFor={`qc-confirm-${i}`} style={{ margin: 0 }}>
                Requiere confirmación
              </label>
            </div>
            <button type="button" className="small danger" style={{ marginTop: 10 }} onClick={() => removeQc(i)}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="small" onClick={addQc}>
          + Añadir comando rápido
        </button>

        {error && <div className="error">{error}</div>}
        <button className="primary" style={{ width: '100%', marginTop: 16 }} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar proyecto'}
        </button>
      </form>
    </>
  );
}

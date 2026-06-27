import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { HostInput, HostType, AuthMethod } from '@mah/shared';
import { api } from '../api';

const emptyForm: HostInput & { tagsText: string } = {
  name: '',
  type: 'ssh',
  hostname: '',
  port: 22,
  username: '',
  authMethod: 'key',
  password: '',
  privateKey: '',
  passphrase: '',
  basePath: '',
  container: '',
  tags: [],
  tagsText: '',
};

export function HostForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.host(id).then((h) => {
      setForm({
        name: h.name,
        type: h.type,
        hostname: h.hostname ?? '',
        port: h.port ?? 22,
        username: h.username ?? '',
        authMethod: h.authMethod,
        password: '',
        privateKey: '',
        passphrase: '',
        basePath: h.basePath ?? '',
        container: h.container ?? '',
        tags: h.tags,
        tagsText: h.tags.join(', '),
      });
    });
  }, [id]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: Partial<HostInput> = {
      name: form.name,
      type: form.type,
      hostname: form.hostname || null,
      port: form.port ? Number(form.port) : null,
      username: form.username || null,
      authMethod: form.authMethod,
      basePath: form.basePath || null,
      container: form.container || null,
      tags,
    };
    // Sólo enviar secretos si el usuario escribió algo (no pisar lo guardado).
    if (form.password) payload.password = form.password;
    if (form.privateKey) payload.privateKey = form.privateKey;
    if (form.passphrase) payload.passphrase = form.passphrase;
    try {
      if (editing) await api.updateHost(id!, payload);
      else await api.createHost(payload as HostInput);
      navigate('/hosts');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isSsh = form.type === 'ssh';
  const isContainer = form.type === 'docker' || form.type === 'wsl';

  return (
    <>
      <div className="topbar">
        <h1>{editing ? 'Editar host' : 'Nuevo host'}</h1>
        <button className="ghost small" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label>Nombre</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="field">
          <label>Tipo</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value as HostType)}>
            <option value="local">local</option>
            <option value="ssh">ssh</option>
            <option value="docker">docker</option>
            <option value="wsl">wsl</option>
          </select>
        </div>

        {isSsh && (
          <>
            <div className="row">
              <div className="field" style={{ flex: 2 }}>
                <label>Hostname / IP</label>
                <input
                  value={form.hostname ?? ''}
                  onChange={(e) => set('hostname', e.target.value)}
                  autoCapitalize="none"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Puerto</label>
                <input
                  type="number"
                  value={form.port ?? 22}
                  onChange={(e) => set('port', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="field">
              <label>Usuario</label>
              <input
                value={form.username ?? ''}
                onChange={(e) => set('username', e.target.value)}
                autoCapitalize="none"
              />
            </div>
            <div className="field">
              <label>Método de autenticación</label>
              <select
                value={form.authMethod}
                onChange={(e) => set('authMethod', e.target.value as AuthMethod)}
              >
                <option value="key">Clave privada</option>
                <option value="password">Contraseña</option>
              </select>
            </div>
            {form.authMethod === 'password' && (
              <div className="field">
                <label>Contraseña {editing && '(dejar vacío para no cambiar)'}</label>
                <input
                  type="password"
                  value={form.password ?? ''}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}
            {form.authMethod === 'key' && (
              <>
                <div className="field">
                  <label>Clave privada {editing && '(dejar vacío para no cambiar)'}</label>
                  <textarea
                    value={form.privateKey ?? ''}
                    onChange={(e) => set('privateKey', e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  />
                </div>
                <div className="field">
                  <label>Passphrase (opcional)</label>
                  <input
                    type="password"
                    value={form.passphrase ?? ''}
                    onChange={(e) => set('passphrase', e.target.value)}
                  />
                </div>
              </>
            )}
          </>
        )}

        {isContainer && (
          <div className="field">
            <label>{form.type === 'docker' ? 'Contenedor (nombre o ID)' : 'Distro WSL'}</label>
            <input
              value={form.container ?? ''}
              onChange={(e) => set('container', e.target.value)}
              autoCapitalize="none"
            />
          </div>
        )}

        <div className="field">
          <label>Ruta base por defecto</label>
          <input
            value={form.basePath ?? ''}
            onChange={(e) => set('basePath', e.target.value)}
            placeholder="/home/usuario"
            autoCapitalize="none"
          />
        </div>
        <div className="field">
          <label>Etiquetas (separadas por comas)</label>
          <input
            value={form.tagsText}
            onChange={(e) => set('tagsText', e.target.value)}
            placeholder="prod, casa, vps"
          />
        </div>

        {error && <div className="error">{error}</div>}
        <button className="primary" style={{ width: '100%' }} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar host'}
        </button>
      </form>
    </>
  );
}

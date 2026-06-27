# ⚡ Mibaldi Agent Hub

Web/PWA privada para **móvil y escritorio** que permite gestionar hosts remotos,
abrir **terminales persistentes con tmux** y ejecutar agentes tipo **Claude Code,
Codex, GitHub CLI** o comandos personalizados desde una interfaz cómoda.

Pensado **mobile-first**: ideal para lanzar y supervisar Claude Code / Codex
desde el móvil. La terminal **persiste aunque cierres el navegador**: cerrar la
pestaña hace _detach_ de tmux, no mata el proceso. La sesión sólo muere si la
matas explícitamente.

---

## ✨ Funcionalidades

- **Hosts**: CRUD de hosts `local`, `ssh`, `docker`, `wsl` (con etiquetas, estado online/offline y comprobación de conexión).
- **Proyectos**: cada host tiene proyectos con ruta, comando inicial, agente por defecto, sesión tmux y comandos rápidos.
- **tmux persistente**: al abrir un proyecto se hace _attach_ a la sesión si existe, o se crea (entra en la ruta + lanza el comando inicial).
- **Terminal web (xterm.js)**: WebSocket en tiempo real, resize, reconexión automática, atajos de teclas para móvil (Tab, Esc, Ctrl-C…), copiar/pegar.
- **Vista chat opcional**: salida del agente en texto legible encima de la terminal, con botón para volver a la terminal completa.
- **Comandos rápidos**: botones por proyecto (con confirmación opcional) que se envían a la sesión tmux activa y se registran en el historial.
- **Dashboard móvil**: continuar último proyecto, sesiones activas, favoritos, hosts y actividad reciente.
- **Historial**: sesiones abiertas, comandos lanzados y sesiones terminadas.
- **Seguridad**: login obligatorio (JWT), secretos cifrados (AES-256-GCM) en BD, recomendado tras Tailscale.
- **PWA instalable** en móvil y escritorio.

## 🧱 Stack

| Capa        | Tecnología                                   |
| ----------- | -------------------------------------------- |
| Frontend    | React + Vite + PWA + xterm.js                |
| Backend     | Node.js + Fastify + WebSocket                |
| SSH remoto  | `ssh2`                                        |
| PTY local   | `node-pty` (opcional)                          |
| Persistencia| PostgreSQL + Prisma                          |
| Despliegue  | Docker Compose                               |
| Acceso      | Recomendado tras **Tailscale**               |

## 📁 Estructura

```
/apps/web        Frontend React + Vite (PWA, xterm.js)
/apps/api        Backend Fastify (REST + WebSocket, ssh2, node-pty, Prisma)
/packages/shared Tipos TypeScript compartidos
/docker-compose.yml
/Dockerfile
/README.md
```

---

## 🚀 Despliegue con Docker (recomendado)

Requisitos: Docker + Docker Compose.

```bash
# 1. Copia y edita las variables de entorno
cp .env.example .env

# 2. Genera secretos seguros
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 32   # -> APP_ENCRYPTION_KEY (debe tener 64 chars hex)
# Edita .env: ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, APP_ENCRYPTION_KEY

# 3. Levanta todo (postgres + app con frontend servido por la API)
docker compose up -d --build

# 4. Abre la app
#    http://localhost:8080   (o la IP de Tailscale del servidor)
```

La API sirve el frontend ya compilado, por lo que **un solo puerto (8080)**
expone toda la aplicación.

### Tras Tailscale (recomendado)

No expongas la app a Internet. Opciones:

1. En `docker-compose.yml`, cambia el mapeo de puerto a `127.0.0.1:8080:8080`
   y accede mediante la IP de Tailscale de la máquina.
2. O usa `tailscale serve` / un proxy interno para publicarla sólo en tu tailnet.

---

## 🛠️ Desarrollo local (sin Docker)

Requisitos: Node.js ≥ 20, PostgreSQL en marcha, `tmux` instalado (para hosts locales).

```bash
# 1. Instala dependencias (monorepo con workspaces)
npm install

# 2. Variables de entorno
cp .env.example .env
#   Ajusta DATABASE_URL a tu Postgres local, p.ej:
#   DATABASE_URL=postgresql://mah:mah@localhost:5432/mibaldi_agent_hub?schema=public

# 3. Compila los tipos compartidos y prepara la BD
npm run build:shared
npm run prisma:generate
npm run prisma:migrate           # o: npx prisma db push -w @mah/api

# 4. Arranca API (8080) y web (5173) a la vez
npm run dev
#   Web:  http://localhost:5173   (proxy /api -> 8080, incluido WebSocket)
#   API:  http://localhost:8080
```

> `node-pty` es opcional. Si no compila en tu sistema, la API seguirá
> funcionando para hosts **SSH**; sólo se deshabilitan los hosts
> `local`/`docker`/`wsl`.

### Scripts útiles

| Comando                    | Descripción                                  |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | API + Web en paralelo (hot reload)           |
| `npm run dev:api`          | Sólo API                                     |
| `npm run dev:web`          | Sólo Web                                      |
| `npm run build`            | Compila shared + web + api                    |
| `npm run prisma:migrate`   | Aplica migraciones (`migrate deploy`)        |
| `npm run start`            | Arranca la API compilada                     |

---

## 🔐 Seguridad

- **Login obligatorio**: usuario/contraseña → JWT (cookie httpOnly + Bearer).
  Configura `ADMIN_USERNAME` y `ADMIN_PASSWORD` (o `ADMIN_PASSWORD_HASH` bcrypt).
- **Secretos cifrados**: las contraseñas y claves SSH se guardan cifradas con
  **AES-256-GCM** usando `APP_ENCRYPTION_KEY`. Nunca se devuelven al cliente.
- **Validación**: los comandos rápidos requieren confirmación opcional; los
  nombres de sesión tmux se sanean.
- **Logs sin secretos**.
- **No publiques la app**: úsala tras **Tailscale** o una VPN.
- **Claves privadas**: puedes guardarlas cifradas en la BD o montarlas como
  volumen de sólo lectura en `./secrets`.

> ⚠️ Si pierdes `APP_ENCRYPTION_KEY`, los secretos guardados serán ilegibles.
> Si cambias la clave, deberás reintroducir las credenciales de los hosts.

---

## 🧩 Cómo funciona la persistencia tmux

Al abrir un proyecto, la API ejecuta (en local vía `node-pty` o remoto vía SSH)
un script equivalente a:

```sh
if tmux has-session -t <session> 2>/dev/null; then
  tmux attach-session -t <session>
else
  tmux new-session -d -s <session> -c <project_path>
  tmux send-keys -t <session> '<initial_command>' C-m   # si está configurado
  tmux attach-session -t <session>
fi
```

- **Cerrar la pestaña / pulsar ✕** → _detach_ (la sesión sigue viva).
- **Botón "Matar tmux"** → `tmux kill-session -t <session>` (mata el proceso).

---

## 🤖 Agentes extensibles

El campo `defaultAgent` (`claude` | `codex` | `shell` | `custom`) y el
**comando inicial** del proyecto definen qué se lanza al crear la sesión.
Ejemplos de comando inicial:

- Claude Code → `claude`
- Codex → `codex`
- Shell → _(vacío)_
- Personalizado → cualquier comando

Para añadir un nuevo tipo de agente basta con extender el enum `AgentType` en
`packages/shared` y, si quieres, predefinir comandos rápidos en el proyecto.

---

## 🗺️ Roadmap (post-MVP)

- PWA offline más completa y notificaciones push.
- Métricas de host (CPU/RAM/disco).
- Historial avanzado y búsqueda.
- Integraciones (Hermes / GitHub CLI / Claude) como comandos rápidos predefinidos.
- Multiusuario y roles.

---

## ⚖️ Licencia

Uso privado.

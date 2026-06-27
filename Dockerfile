# ---- Build stage ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Dependencias de compilación para node-pty (módulo nativo).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiamos manifiestos primero para aprovechar la caché de capas.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm install

# Código fuente.
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

# Generar cliente Prisma y compilar todo (shared -> web -> api).
RUN npm run prisma:generate \
    && npm run build:shared \
    && npm run build:web \
    && npm run build:api

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tmux: para hosts tipo "local" (el propio contenedor). openssh-client opcional.
# docker-cli si se usan hosts tipo "docker" desde dentro (requiere montar el socket).
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiamos node_modules ya construidos (incluye node-pty compilado y Prisma client).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

ENV WEB_DIST=/app/apps/web/dist
WORKDIR /app/apps/api

EXPOSE 8080

# Sincroniza el esquema (db push) y arranca la API.
CMD npx prisma db push --skip-generate --accept-data-loss && node dist/index.js

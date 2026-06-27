import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.API_PORT ?? '8080', 10),
  host: process.env.API_HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  encryptionKey: required('APP_ENCRYPTION_KEY'),
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? '',
    passwordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
  },
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  // Carpeta con los estáticos del frontend compilado (producción).
  webDist: process.env.WEB_DIST ?? '',
  isProd: process.env.NODE_ENV === 'production',
};

if (config.encryptionKey.length !== 64) {
  // 32 bytes en hex.
  // eslint-disable-next-line no-console
  console.warn(
    '[config] APP_ENCRYPTION_KEY deberia tener 64 caracteres hex (32 bytes). Genera uno con: openssl rand -hex 32',
  );
}

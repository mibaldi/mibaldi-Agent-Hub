import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.js';

// Cifrado simétrico AES-256-GCM para secretos en reposo (passwords/claves SSH).
// Formato almacenado: base64(iv).base64(authTag).base64(ciphertext)

function key(): Buffer {
  // La clave es hex de 32 bytes. Si no es hex válido, derivamos por longitud.
  const buf = Buffer.from(config.encryptionKey, 'hex');
  if (buf.length === 32) return buf;
  // Fallback: rellenar/recortar a 32 bytes desde utf8 (evita crash en dev).
  return Buffer.alloc(32, config.encryptionKey);
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;
  const parts = stored.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

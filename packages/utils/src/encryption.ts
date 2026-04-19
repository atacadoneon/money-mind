/**
 * AES-256-GCM encrypt/decrypt helpers para credenciais de API.
 * Formato do ciphertext: base64( iv(12) || tag(16) || cipher )
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(key?: string | Buffer): Buffer {
  const raw = key ?? process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY não definida');
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    // permite string hex de 64 chars
    if (typeof raw === 'string' && /^[0-9a-f]{64}$/i.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    throw new Error(`ENCRYPTION_KEY deve ter 32 bytes (recebido ${buf.length})`);
  }
  return buf;
}

/** Retorna Buffer pronto para ser armazenado em coluna BYTEA. */
export function encrypt(plaintext: string, key?: string | Buffer): Buffer {
  const k = resolveKey(key);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, k, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decrypt(payload: Buffer | string, key?: string | Buffer): string {
  const k = resolveKey(key);
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, k, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/** Para colunas que esperam base64 em vez de BYTEA. */
export function encryptToBase64(plaintext: string, key?: string | Buffer): string {
  return encrypt(plaintext, key).toString('base64');
}

export function decryptFromBase64(payload: string, key?: string | Buffer): string {
  return decrypt(Buffer.from(payload, 'base64'), key);
}

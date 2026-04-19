import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption for sensitive tokens (Tiny, ContaSimples, Pagarme).
 * Key loaded from ENCRYPTION_KEY env (hex, 32 bytes).
 * Output format: base64(iv(12) + authTag(16) + ciphertext).
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger('Encryption');
  private readonly key: Buffer;
  private readonly ALGO = 'aes-256-gcm';

  constructor(private readonly config: ConfigService) {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const hex = this.config.get<string>('ENCRYPTION_KEY')?.trim();
    if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
      this.key = Buffer.from(hex, 'hex');
      return;
    }
    if (hex && hex.length >= 64) {
      throw new Error('ENCRYPTION_KEY deve conter apenas caracteres hexadecimais (64 chars = 32 bytes). Gere com: openssl rand -hex 32');
    }
    if (nodeEnv === 'production') {
      throw new Error('ENCRYPTION_KEY é obrigatória em produção (64 caracteres hex).');
    }
    this.logger.warn('ENCRYPTION_KEY não configurada ou inválida; usando chave derivada apenas para desenvolvimento');
    this.key = crypto.createHash('sha256').update('money-mind-dev-key').digest();
  }

  encrypt(plaintext: string): string {
    if (plaintext == null) throw new InternalServerErrorException('encrypt: plaintext required');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(this.ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

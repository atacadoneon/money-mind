import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

const makeService = async (key?: string) => {
  const mod = await Test.createTestingModule({
    providers: [
      EncryptionService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(key) },
      },
    ],
  }).compile();
  return mod.get(EncryptionService);
};

describe('EncryptionService', () => {
  it('should be defined with valid key', async () => {
    const key = 'a'.repeat(64); // 32 bytes hex
    const svc = await makeService(key);
    expect(svc).toBeDefined();
  });

  it('should be defined with dev fallback when no key', async () => {
    const svc = await makeService(undefined);
    expect(svc).toBeDefined();
  });

  it('encrypt then decrypt round-trip', async () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex'); // 32 bytes
    const svc = await makeService(key);
    const plaintext = 'my-secret-token-12345';
    const encrypted = svc.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = svc.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('each encrypt call produces different ciphertext (random IV)', async () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');
    const svc = await makeService(key);
    const e1 = svc.encrypt('same');
    const e2 = svc.encrypt('same');
    expect(e1).not.toBe(e2);
  });

  it('decrypt fails on tampered ciphertext', async () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');
    const svc = await makeService(key);
    const encrypted = svc.encrypt('data');
    // Tamper last byte
    const buf = Buffer.from(encrypted, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('encrypt throws when plaintext is null', async () => {
    const svc = await makeService(undefined);
    expect(() => svc.encrypt(null as unknown as string)).toThrow(InternalServerErrorException);
  });

  it('handles long plaintext', async () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');
    const svc = await makeService(key);
    const long = 'x'.repeat(10_000);
    expect(svc.decrypt(svc.encrypt(long))).toBe(long);
  });

  it('handles unicode plaintext', async () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('hex');
    const svc = await makeService(key);
    const text = 'ção-áéíóú-中文-🔐';
    expect(svc.decrypt(svc.encrypt(text))).toBe(text);
  });
});

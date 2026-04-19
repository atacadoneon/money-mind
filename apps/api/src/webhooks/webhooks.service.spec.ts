import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(() => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    service = new WebhooksService(repo as never);
  });

  it('verifySignature should return true for valid signature', () => {
    const secret = 'test-secret';
    const body = '{"event":"conta.criada"}';
    const { createHmac } = require('crypto') as typeof import('crypto');
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(service.verifySignature(body, sig, secret)).toBe(true);
  });

  it('verifySignature should return false for invalid signature', () => {
    expect(service.verifySignature('body', 'sha256=invalid', 'secret')).toBe(false);
  });

  it('emit should not throw when no subscriptions match', async () => {
    await expect(service.emit('conta.criada', { id: 'test' }, 'org-uuid')).resolves.not.toThrow();
  });
});

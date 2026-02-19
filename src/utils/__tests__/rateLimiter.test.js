'use strict';

const { checkRateLimit, _reset } = require('../rateLimiter');

describe('rateLimiter', () => {
  beforeEach(() => _reset());

  test('allows up to 6 calls per hour', () => {
    const tenantId = 'tenant-1';
    for (let i = 0; i < 6; i++) {
      expect(checkRateLimit(tenantId)).toBe(true);
    }
    expect(checkRateLimit(tenantId)).toBe(false);
  });

  test('different tenants have independent limits', () => {
    for (let i = 0; i < 6; i++) checkRateLimit('a');
    expect(checkRateLimit('a')).toBe(false);
    expect(checkRateLimit('b')).toBe(true);
  });
});

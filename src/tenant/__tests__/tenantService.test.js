'use strict';

jest.mock('../../database/supabase', () => {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
  };
  return { supabase: chain };
});

jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn((v) => v ? `enc_${v}` : null),
  decrypt: jest.fn((v) => {
    const parts = (v || '').split(':');
    return parts[parts.length - 1].replace('enc_', '');
  }),
}));

const { supabase } = require('../../database/supabase');
const tenantService = require('../tenantService');

describe('tenantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mockReturnThis after clearAllMocks (clearAllMocks doesn't reset implementations)
    supabase.from.mockReturnThis();
    supabase.select.mockReturnThis();
    supabase.insert.mockReturnThis();
    supabase.update.mockReturnThis();
    supabase.eq.mockReturnThis();
    supabase.order.mockReturnThis();
  });

  test('createTenant encrypts API keys', async () => {
    supabase.single.mockResolvedValue({
      data: { id: 'uuid-1', name: 'Test' },
      error: null,
    });

    const result = await tenantService.createTenant({
      name: 'Test',
      bot_token: 'tok',
      chat_id: '123',
      gemini_api_key: 'gem',
      brave_search_key: 'brave',
      fal_key: 'fal',
    });

    expect(result.id).toBe('uuid-1');
    // Verify insert was called with encrypted keys
    const insertCall = supabase.insert.mock.calls[0][0];
    expect(insertCall.gemini_api_key).toBe('enc_gem');
    expect(insertCall.brave_search_key).toBe('enc_brave');
    expect(insertCall.fal_key).toBe('enc_fal');
    expect(insertCall.bot_token).toBe('tok'); // not encrypted
  });

  test('getActiveTenants decrypts keys', async () => {
    supabase.eq.mockResolvedValue({
      data: [{ id: '1', gemini_api_key: 'iv:tag:enc_gem', brave_search_key: 'iv:tag:enc_brave', fal_key: 'iv:tag:enc_fal' }],
      error: null,
    });

    const tenants = await tenantService.getActiveTenants();
    expect(tenants[0].gemini_api_key).toBe('gem');
    expect(tenants[0].brave_search_key).toBe('brave');
    expect(tenants[0].fal_key).toBe('fal');
  });

  test('getTenantByChatId returns null when not found', async () => {
    supabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await tenantService.getTenantByChatId('999');
    expect(result).toBeNull();
  });

  test('deactivateTenant sets active to false', async () => {
    supabase.single.mockResolvedValue({ data: { id: '1', active: false }, error: null });
    const result = await tenantService.deactivateTenant('1');
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });
});

'use strict';

jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('../../database/supabase');
const { createAgent, deactivateAgent, getNextPosition } = require('../agentFactory');

describe('agentFactory', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createAgent', () => {
    it('inserts agent and returns row', async () => {
      const fakeAgent = { id: 'uuid-1', name: 'revisor', display_name: 'Revisor' };
      const single = jest.fn().mockResolvedValue({ data: fakeAgent, error: null });
      const select = jest.fn().mockReturnValue({ single });
      const insert = jest.fn().mockReturnValue({ select });
      supabase.from.mockReturnValue({ insert });

      const result = await createAgent({
        name: 'revisor',
        display_name: 'Revisor',
        role: 'Revisar conteudo',
        system_prompt: 'Voce e um revisor.',
        position_in_flow: null,
      });

      expect(supabase.from).toHaveBeenCalledWith('agents');
      expect(result).toEqual(fakeAgent);
    });

    it('throws on supabase error', async () => {
      const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
      const select = jest.fn().mockReturnValue({ single });
      const insert = jest.fn().mockReturnValue({ select });
      supabase.from.mockReturnValue({ insert });

      await expect(createAgent({ name: 'x', display_name: 'X', role: 'y', system_prompt: 'z' }))
        .rejects.toThrow('db error');
    });
  });

  describe('deactivateAgent', () => {
    it('sets is_active false', async () => {
      const eq = jest.fn().mockResolvedValue({ error: null });
      const update = jest.fn().mockReturnValue({ eq });
      supabase.from.mockReturnValue({ update });

      await deactivateAgent('uuid-1');

      expect(update).toHaveBeenCalledWith({ is_active: false, position_in_flow: null });
      expect(eq).toHaveBeenCalledWith('id', 'uuid-1');
    });
  });

  describe('getNextPosition', () => {
    it('returns max position + 1', async () => {
      const single = jest.fn().mockResolvedValue({ data: { position_in_flow: 3 }, error: null });
      const limit = jest.fn().mockReturnValue({ single });
      const order = jest.fn().mockReturnValue({ limit });
      const not = jest.fn().mockReturnValue({ order });
      const select = jest.fn().mockReturnValue({ not });
      supabase.from.mockReturnValue({ select });

      const pos = await getNextPosition();
      expect(pos).toBe(4);
    });

    it('returns 1 when no agents', async () => {
      const single = jest.fn().mockResolvedValue({ data: null, error: null });
      const limit = jest.fn().mockReturnValue({ single });
      const order = jest.fn().mockReturnValue({ limit });
      const not = jest.fn().mockReturnValue({ order });
      const select = jest.fn().mockReturnValue({ not });
      supabase.from.mockReturnValue({ select });

      const pos = await getNextPosition();
      expect(pos).toBe(1);
    });
  });
});

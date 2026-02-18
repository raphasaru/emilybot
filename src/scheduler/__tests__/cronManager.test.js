jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
}));
jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('../../flows/contentCreation', () => ({
  runResearch: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const cron = require('node-cron');
const { supabase } = require('../../database/supabase');

describe('cronManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('init loads active schedules and registers crons', async () => {
    jest.mock('node-cron', () => ({
      schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
    }));
    jest.mock('../../database/supabase', () => ({
      supabase: { from: jest.fn() },
    }));
    jest.mock('../../flows/contentCreation', () => ({ runResearch: jest.fn() }));
    jest.mock('../../utils/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const mockCron = require('node-cron');
    const { supabase: mockSupabase } = require('../../database/supabase');

    const mockSchedules = [
      {
        id: 'abc',
        name: 'Daily',
        cron_expression: '0 8 * * *',
        timezone: 'America/Sao_Paulo',
        topics: ['IA'],
        format: 'post_unico',
        is_active: true,
      },
    ];

    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: mockSchedules, error: null }),
    });

    const cronManager = require('../cronManager');
    const onReady = jest.fn();
    await cronManager.init({}, '123', onReady);

    expect(mockCron.schedule).toHaveBeenCalledWith(
      '0 8 * * *',
      expect.any(Function),
      { timezone: 'America/Sao_Paulo' }
    );
  });

  test('pause stops cron task and marks inactive in DB', async () => {
    jest.mock('node-cron', () => ({
      schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
    }));
    jest.mock('../../database/supabase', () => ({
      supabase: { from: jest.fn() },
    }));
    jest.mock('../../flows/contentCreation', () => ({ runResearch: jest.fn() }));
    jest.mock('../../utils/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const { supabase: mockSupabase } = require('../../database/supabase');
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from = jest.fn().mockReturnValue({ update: mockUpdate });

    const cronManager = require('../cronManager');
    const fakeTask = { stop: jest.fn() };
    cronManager._activeCrons.set('abc', fakeTask);

    await cronManager.pause('abc');

    expect(fakeTask.stop).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    expect(mockEq).toHaveBeenCalledWith('id', 'abc');
    expect(cronManager._activeCrons.has('abc')).toBe(false);
  });

  test('createSchedule inserts into DB and registers cron', async () => {
    jest.mock('node-cron', () => ({
      schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
    }));
    jest.mock('../../database/supabase', () => ({
      supabase: { from: jest.fn() },
    }));
    jest.mock('../../flows/contentCreation', () => ({ runResearch: jest.fn() }));
    jest.mock('../../utils/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));

    const mockCron = require('node-cron');
    const { supabase: mockSupabase } = require('../../database/supabase');

    const newSchedule = {
      id: 'new-id',
      name: 'Test',
      cron_expression: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
      topics: ['Meta Ads'],
      format: 'carrossel',
      is_active: true,
    };

    mockSupabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: newSchedule, error: null }),
    });

    const cronManager = require('../cronManager');
    const onReady = jest.fn();
    cronManager._setOnReady(onReady);

    const result = await cronManager.createSchedule({}, '123', {
      name: 'Test',
      cron_expression: '0 9 * * 1',
      topics: ['Meta Ads'],
      format: 'carrossel',
    });

    expect(result.id).toBe('new-id');
    expect(mockCron.schedule).toHaveBeenCalledWith(
      '0 9 * * 1',
      expect.any(Function),
      { timezone: 'America/Sao_Paulo' }
    );
  });
});

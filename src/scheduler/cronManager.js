const cron = require('node-cron');
const { supabase } = require('../database/supabase');
const { runResearch } = require('../flows/contentCreation');
const { logger } = require('../utils/logger');

const _activeCrons = new Map(); // scheduleId -> cron task instance
let _onReady = null;

function _setOnReady(fn) {
  _onReady = fn;
}

function _registerCron(bot, chatId, schedule) {
  const task = cron.schedule(
    schedule.cron_expression,
    async () => {
      logger.info('Cron fired', { name: schedule.name });
      try {
        const topics = (schedule.topics || []).join(', ') || 'IA e marketing digital';
        const { researchText, remainingAgents } = await runResearch(topics);

        if (_onReady) {
          await _onReady(bot, chatId, schedule, researchText, remainingAgents);
        }

        await supabase
          .from('schedules')
          .update({ last_run: new Date().toISOString() })
          .eq('id', schedule.id);
      } catch (err) {
        logger.error('Cron job failed', { name: schedule.name, error: err.message });
      }
    },
    { timezone: schedule.timezone || 'America/Sao_Paulo' }
  );

  _activeCrons.set(schedule.id, task);
  logger.info('Cron registered', { name: schedule.name, expression: schedule.cron_expression });
}

async function init(bot, chatId, onReady) {
  _onReady = onReady;

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Failed to load schedules', { error: error.message });
    return;
  }

  for (const schedule of schedules || []) {
    _registerCron(bot, chatId, schedule);
  }

  logger.info('CronManager initialized', { count: (schedules || []).length });
}

async function pause(id) {
  const task = _activeCrons.get(id);
  if (task) {
    task.stop();
    _activeCrons.delete(id);
  }

  await supabase.from('schedules').update({ is_active: false }).eq('id', id);
  logger.info('Cron paused', { id });
}

async function createSchedule(bot, chatId, scheduleData) {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      name: scheduleData.name,
      cron_expression: scheduleData.cron_expression,
      timezone: scheduleData.timezone || 'America/Sao_Paulo',
      topics: scheduleData.topics || [],
      format: scheduleData.format || 'post_unico',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);

  _registerCron(bot, chatId, data);
  return data;
}

async function list() {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('created_at');

  if (error) throw new Error(`Failed to list schedules: ${error.message}`);
  return data || [];
}

module.exports = { init, pause, createSchedule, list, _activeCrons, _setOnReady };

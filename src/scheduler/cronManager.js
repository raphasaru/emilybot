'use strict';

const cron = require('node-cron');
const { supabase } = require('../database/supabase');
const { runResearch } = require('../flows/contentCreation');
const { logger } = require('../utils/logger');

const _activeCrons = new Map(); // scheduleId -> { cronTask, tenantId }
let _onReady = null;

function _setOnReady(fn) {
  _onReady = fn;
}

function _registerCron(bot, chatId, schedule, onReady, tenant) {
  const handler = onReady || _onReady;
  const tenantKeys = tenant
    ? {
        geminiApiKey: tenant.gemini_api_key,
        braveSearchKey: tenant.brave_search_key,
        falKey: tenant.fal_key,
        tenantId: tenant.id,
      }
    : undefined;

  const task = cron.schedule(
    schedule.cron_expression,
    async () => {
      logger.info('Cron fired', { name: schedule.name });
      try {
        const topics = (schedule.topics || []).join(', ') || 'IA e marketing digital';
        const { researchText, remainingAgents } = await runResearch(topics, tenantKeys);

        if (handler) {
          await handler(bot, chatId, schedule, researchText, remainingAgents);
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

  _activeCrons.set(schedule.id, { cronTask: task, tenantId: tenant?.id || null });
  logger.info('Cron registered', { name: schedule.name, expression: schedule.cron_expression });
}

// Legacy single-tenant init (backwards compat)
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
    _registerCron(bot, chatId, schedule, onReady, null);
  }

  logger.info('CronManager initialized', { count: (schedules || []).length });
}

// Per-tenant init — loads and registers crons for one tenant
async function initForTenant(bot, tenant, onReady) {
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true)
    .eq('tenant_id', tenant.id);

  if (error) {
    logger.error('Failed to load schedules for tenant', { tenantId: tenant.id, error: error.message });
    return;
  }

  for (const schedule of schedules || []) {
    _registerCron(bot, tenant.chat_id, schedule, onReady, tenant);
  }

  logger.info('Crons initialized for tenant', { tenantId: tenant.id, count: (schedules || []).length });
}

// Stop all crons for a tenant
function stopForTenant(tenantId) {
  for (const [id, entry] of _activeCrons.entries()) {
    if (entry.tenantId === tenantId) {
      entry.cronTask.stop();
      _activeCrons.delete(id);
    }
  }
  logger.info('Crons stopped for tenant', { tenantId });
}

async function pause(id) {
  const entry = _activeCrons.get(id);
  if (entry) {
    entry.cronTask.stop();
    _activeCrons.delete(id);
  }

  await supabase.from('schedules').update({ is_active: false }).eq('id', id);
  logger.info('Cron paused', { id });
}

async function createSchedule(bot, chatId, scheduleData) {
  const payload = {
    name: scheduleData.name,
    cron_expression: scheduleData.cron_expression,
    timezone: scheduleData.timezone || 'America/Sao_Paulo',
    topics: scheduleData.topics || [],
    format: scheduleData.format || 'post_unico',
  };
  if (scheduleData.tenant_id) payload.tenant_id = scheduleData.tenant_id;

  const { data, error } = await supabase
    .from('schedules')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);

  if (!cron.validate(data.cron_expression)) {
    throw new Error(`Invalid cron expression: ${data.cron_expression}`);
  }

  _registerCron(bot, chatId, data, _onReady, null);
  return data;
}

async function list(tenantId) {
  let query = supabase.from('schedules').select('*');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  query = query.order('created_at');

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list schedules: ${error.message}`);
  return data || [];
}

module.exports = { init, initForTenant, stopForTenant, pause, createSchedule, list, _activeCrons, _setOnReady };

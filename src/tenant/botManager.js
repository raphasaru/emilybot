'use strict';

const { createBot } = require('../telegram/bot');
const tenantService = require('./tenantService');
const { setTenantCache, clearTenantCache } = require('../telegram/middleware');
const cronManager = require('../scheduler/cronManager');
const { onCronResearchReady } = require('../telegram/handlers');
const { logger } = require('../utils/logger');

const botInstances = new Map(); // tenantId -> { bot, tenant }

async function startBot(tenant) {
  if (botInstances.has(tenant.id)) {
    logger.warn('Bot already running', { tenantId: tenant.id });
    return;
  }

  const bot = createBot(tenant);

  // Listen for auto-deactivation signal from polling_error counter
  bot.on('tenant_deactivate', async (tenantId) => {
    await stopBot(tenantId);
    await tenantService.deactivateTenant(tenantId);

    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      try {
        const anyInstance = [...botInstances.values()][0];
        if (anyInstance) {
          await anyInstance.bot.sendMessage(adminChatId, `⚠️ Tenant "${tenant.name}" desativado — polling falhou 4x.`);
        }
      } catch {}
    }
  });

  setTenantCache(tenant.chat_id, tenant);
  botInstances.set(tenant.id, { bot, tenant });

  await cronManager.initForTenant(bot, tenant, onCronResearchReady);

  logger.info('Bot started', { tenantId: tenant.id, name: tenant.name });
  return bot;
}

async function stopBot(tenantId) {
  const instance = botInstances.get(tenantId);
  if (!instance) return;

  try {
    await instance.bot.stopPolling();
  } catch {}

  clearTenantCache(instance.tenant.chat_id);
  cronManager.stopForTenant(tenantId);
  botInstances.delete(tenantId);
  logger.info('Bot stopped', { tenantId });
}

async function startAll() {
  const tenants = await tenantService.getActiveTenants();
  logger.info('Starting all bots', { count: tenants.length });

  for (const tenant of tenants) {
    try {
      await startBot(tenant);
    } catch (err) {
      logger.error('Failed to start bot', { tenantId: tenant.id, error: err.message });
    }
  }
}

function getInstances() {
  return botInstances;
}

module.exports = { startBot, stopBot, startAll, getInstances };

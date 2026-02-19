'use strict';

// In-memory tenant cache — populated by BotManager on boot
const tenantCache = new Map(); // chatId (string) -> tenant object

function setTenantCache(chatId, tenant) {
  tenantCache.set(String(chatId), tenant);
}

function getTenantFromCache(chatId) {
  return tenantCache.get(String(chatId)) || null;
}

function clearTenantCache(chatId) {
  tenantCache.delete(String(chatId));
}

module.exports = { setTenantCache, getTenantFromCache, clearTenantCache };

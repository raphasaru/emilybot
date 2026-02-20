'use strict';
const { supabase } = require('../database/supabase');
const { encrypt, decrypt } = require('../utils/crypto');
const { logger } = require('../utils/logger');

const ENC_KEY = process.env.ENCRYPTION_KEY;

function encryptKeys(data) {
  return {
    ...data,
    gemini_api_key: encrypt(data.gemini_api_key, ENC_KEY),
    brave_search_key: encrypt(data.brave_search_key, ENC_KEY),
    fal_key: encrypt(data.fal_key, ENC_KEY),
    apify_key: data.apify_key ? encrypt(data.apify_key, ENC_KEY) : data.apify_key,
  };
}

// Handles both encrypted (iv:authTag:ciphertext) and legacy plain-text values
function safeDecrypt(value) {
  if (!value) return value;
  const parts = value.split(':');
  if (parts.length !== 3) return value; // not encrypted
  try {
    return decrypt(value, ENC_KEY);
  } catch {
    return value; // fallback — return as-is if decrypt fails
  }
}

function decryptKeys(tenant) {
  return {
    ...tenant,
    gemini_api_key: safeDecrypt(tenant.gemini_api_key),
    brave_search_key: safeDecrypt(tenant.brave_search_key),
    fal_key: safeDecrypt(tenant.fal_key),
    apify_key: safeDecrypt(tenant.apify_key),
  };
}

async function createTenant({ name, bot_token, chat_id, gemini_api_key, brave_search_key, fal_key, apify_key, branding, emily_tone, owner_name, niche, specialization, dashboard_password_hash }) {
  const encrypted = encryptKeys({ gemini_api_key, brave_search_key, fal_key, apify_key });
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name, bot_token, chat_id, ...encrypted, branding, emily_tone, owner_name, niche, specialization, dashboard_password_hash })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tenant: ${error.message}`);
  logger.info('Tenant created', { id: data.id, name });
  return data;
}

async function getActiveTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('active', true);

  if (error) throw new Error(`Failed to load tenants: ${error.message}`);
  return (data || []).map(decryptKeys);
}

async function getTenantByChatId(chatId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('chat_id', String(chatId))
    .eq('active', true)
    .single();

  if (error || !data) return null;
  return decryptKeys(data);
}

async function updateTenant(id, updates) {
  const toUpdate = { ...updates };
  if (toUpdate.gemini_api_key) toUpdate.gemini_api_key = encrypt(toUpdate.gemini_api_key, ENC_KEY);
  if (toUpdate.brave_search_key) toUpdate.brave_search_key = encrypt(toUpdate.brave_search_key, ENC_KEY);
  if (toUpdate.fal_key) toUpdate.fal_key = encrypt(toUpdate.fal_key, ENC_KEY);
  if (toUpdate.apify_key) toUpdate.apify_key = encrypt(toUpdate.apify_key, ENC_KEY);

  const { data, error } = await supabase
    .from('tenants')
    .update(toUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update tenant: ${error.message}`);
  return data;
}

async function deactivateTenant(id) {
  return updateTenant(id, { active: false });
}

module.exports = { createTenant, getActiveTenants, getTenantByChatId, updateTenant, deactivateTenant, decryptKeys, encryptKeys };

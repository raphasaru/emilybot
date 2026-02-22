'use strict';

const axios = require('axios');
const cron = require('node-cron');
const { supabase } = require('../database/supabase');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/crypto');

const ENC_KEY = process.env.ENCRYPTION_KEY;
const IG_TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';

function safeDecrypt(value) {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length !== 3) return value;
  try { return decrypt(value, ENC_KEY); } catch { return value; }
}

async function refreshTokenForTenant(tenant) {
  const { id, ig_app_id, ig_app_secret, instagram_token } = tenant;
  if (!ig_app_id || !ig_app_secret || !instagram_token) return null;

  const plainToken = safeDecrypt(instagram_token);

  try {
    const { data } = await axios.get(IG_TOKEN_URL, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: ig_app_id,
        client_secret: ig_app_secret,
        fb_exchange_token: plainToken,
      },
      timeout: 15000,
    });

    if (!data.access_token) throw new Error('No access_token in response');

    const encryptedToken = encrypt(data.access_token, ENC_KEY);
    await supabase
      .from('tenants')
      .update({ instagram_token: encryptedToken, ig_token_refreshed_at: new Date().toISOString() })
      .eq('id', id);

    logger.info('IG token refreshed', { tenantId: id, expiresIn: data.expires_in });
    return data.access_token;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('IG token refresh failed', { tenantId: id, error: msg });
    return null;
  }
}

async function refreshAllTokens(notifyFn) {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, chat_id, ig_app_id, ig_app_secret, instagram_token')
    .eq('is_active', true)
    .not('instagram_token', 'is', null)
    .not('ig_app_id', 'is', null);

  if (!tenants?.length) return;

  for (const tenant of tenants) {
    const newToken = await refreshTokenForTenant(tenant);
    if (!newToken && notifyFn) {
      notifyFn(tenant.chat_id, '⚠️ Falha ao renovar token do Instagram. Gere um novo token manualmente via /instagram.');
    }
  }
}

// Runs every Monday at 3am BRT
function startAutoRefresh(notifyFn) {
  cron.schedule('0 3 * * 1', () => {
    logger.info('Running weekly IG token refresh');
    refreshAllTokens(notifyFn);
  }, { timezone: 'America/Sao_Paulo' });
  logger.info('IG token auto-refresh cron registered (weekly Mon 3am)');
}

module.exports = { refreshTokenForTenant, refreshAllTokens, startAutoRefresh };

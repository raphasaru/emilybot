#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { createHash } = require('crypto');
const tenantService = require('../src/tenant/tenantService');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace(/^--/, '')] = args[i + 1];
}

const required = ['name', 'bot_token', 'chat_id', 'gemini_key', 'dashboard_password'];
for (const r of required) {
  if (!flags[r]) {
    console.error(`Missing --${r}`);
    console.error('\nUsage: node scripts/register-tenant.js \\');
    console.error('  --name "Tenant Name" \\');
    console.error('  --bot_token "123456:ABC..." \\');
    console.error('  --chat_id "123456789" \\');
    console.error('  --gemini_key "AIza..." \\');
    console.error('  --dashboard_password "senha123" \\');
    console.error('  [--owner_name "João Silva"] \\');
    console.error('  [--niche "fotografia de casamentos"] \\');
    console.error('  [--specialization "Instagram, gestão de agenda"] \\');
    console.error('  [--brave_key "BSK-..."] \\');
    console.error('  [--fal_key "fal-..."] \\');
    console.error('  [--apify_key "apify_..."] \\');
  console.error('  [--instagram_user_id "123456789"] \\');
  console.error('  [--instagram_token "EAAxxxxx"]');
    process.exit(1);
  }
}

(async () => {
  try {
    const passwordHash = createHash('sha256').update(flags.dashboard_password).digest('hex');
    const tenant = await tenantService.createTenant({
      name: flags.name,
      bot_token: flags.bot_token,
      chat_id: flags.chat_id,
      gemini_api_key: flags.gemini_key,
      brave_search_key: flags.brave_key || null,
      fal_key: flags.fal_key || null,
      apify_key: flags.apify_key || null,
      instagram_user_id: flags.instagram_user_id || null,
      instagram_token: flags.instagram_token || null,
      owner_name: flags.owner_name || null,
      niche: flags.niche || null,
      specialization: flags.specialization || null,
      dashboard_password_hash: passwordHash,
    });
    console.log(`\nTenant created successfully!`);
    console.log(`  ID:   ${tenant.id}`);
    console.log(`  Name: ${tenant.name}`);
    console.log(`\nRestart the bot to activate: pm2 restart emilybot`);
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();

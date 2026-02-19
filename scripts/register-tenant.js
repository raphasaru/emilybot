#!/usr/bin/env node
'use strict';

require('dotenv').config();
const tenantService = require('../src/tenant/tenantService');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace(/^--/, '')] = args[i + 1];
}

const required = ['name', 'bot_token', 'chat_id', 'gemini_key'];
for (const r of required) {
  if (!flags[r]) {
    console.error(`Missing --${r}`);
    console.error('\nUsage: node scripts/register-tenant.js \\');
    console.error('  --name "Tenant Name" \\');
    console.error('  --bot_token "123456:ABC..." \\');
    console.error('  --chat_id "123456789" \\');
    console.error('  --gemini_key "AIza..." \\');
    console.error('  [--brave_key "BSK-..."] \\');
    console.error('  [--fal_key "fal-..."]');
    process.exit(1);
  }
}

(async () => {
  try {
    const tenant = await tenantService.createTenant({
      name: flags.name,
      bot_token: flags.bot_token,
      chat_id: flags.chat_id,
      gemini_api_key: flags.gemini_key,
      brave_search_key: flags.brave_key || null,
      fal_key: flags.fal_key || null,
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

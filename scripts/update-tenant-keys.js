#!/usr/bin/env node
'use strict';

require('dotenv').config();
const tenantService = require('../src/tenant/tenantService');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace(/^--/, '')] = args[i + 1];
}

if (!flags.tenant_id) {
  console.error('Missing --tenant_id');
  console.error('\nUsage: node scripts/update-tenant-keys.js \\');
  console.error('  --tenant_id "uuid" \\');
  console.error('  [--brave_key "BSK-..."] \\');
  console.error('  [--fal_key "fal-..."] \\');
  console.error('  [--gemini_key "AIza..."]');
  process.exit(1);
}

(async () => {
  try {
    const updates = {};
    if (flags.brave_key) updates.brave_search_key = flags.brave_key;
    if (flags.fal_key) updates.fal_key = flags.fal_key;
    if (flags.gemini_key) updates.gemini_api_key = flags.gemini_key;

    if (Object.keys(updates).length === 0) {
      console.error('No keys provided to update.');
      process.exit(1);
    }

    await tenantService.updateTenant(flags.tenant_id, updates);
    console.log('Keys updated successfully. Restart the bot: pm2 restart emilybot');
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();

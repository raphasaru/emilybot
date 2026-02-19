# Multi-Tenant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform single-tenant EmilyBot into multi-tenant system where each beta tester runs their own bot on one shared VPS.

**Architecture:** Single Node.js process manages N Telegram bots via polling. Each tenant has own bot token, API keys (encrypted), and isolated data via `tenant_id` column. BotManager handles lifecycle, middleware injects tenant context into every request.

**Tech Stack:** Node.js (CommonJS), node-telegram-bot-api, Supabase, node-cron, crypto (AES-256-GCM native)

---

### Task 1: Database Migration — tenants table + tenant_id columns

**Files:**
- Create: `src/database/migrations/002_multi_tenant.sql`

**Step 1: Write migration SQL**

```sql
-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  gemini_api_key TEXT NOT NULL,
  brave_search_key TEXT,
  fal_key TEXT,
  chat_id TEXT NOT NULL,
  branding JSONB DEFAULT '{"primary_color":"#FF5722","secondary_color":"#1A1A2E","font":"Montserrat","template_preset":"modern","text_color":"#FFFFFF"}',
  emily_tone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add tenant_id to existing tables
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_drafts_tenant ON content_drafts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(active);
CREATE INDEX IF NOT EXISTS idx_tenants_chat_id ON tenants(chat_id);
```

**Step 2: Run migration via Supabase MCP**

Run the SQL via `mcp__supabase__apply_migration`.

**Step 3: Create default tenant for current user**

Insert a tenant row for Raphael using existing .env values. Then UPDATE all existing rows in agents, conversations, content_drafts, schedules to set `tenant_id` to this new tenant's id.

**Step 4: Commit**

```bash
git add src/database/migrations/002_multi_tenant.sql
git commit -m "feat: add tenants table + tenant_id to all tables"
```

---

### Task 2: Crypto Utility — encrypt/decrypt API keys

**Files:**
- Create: `src/utils/crypto.js`
- Create: `src/utils/__tests__/crypto.test.js`

**Step 1: Write test**

```js
const { encrypt, decrypt } = require('../crypto');

describe('crypto', () => {
  const key = 'a'.repeat(64); // 32 bytes hex

  test('encrypts and decrypts back to original', () => {
    const original = 'AIzaSyBR0vtef8yx7po46XU2GqJIoxkdFdRi3i0';
    const encrypted = encrypt(original, key);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext
    expect(decrypt(encrypted, key)).toBe(original);
  });

  test('different inputs produce different ciphertexts', () => {
    const a = encrypt('key-a', key);
    const b = encrypt('key-b', key);
    expect(a).not.toBe(b);
  });

  test('returns null for empty input', () => {
    expect(encrypt(null, key)).toBeNull();
    expect(encrypt('', key)).toBeNull();
    expect(decrypt(null, key)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/__tests__/crypto.test.js`
Expected: FAIL — module not found

**Step 3: Implement**

```js
'use strict';
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function encrypt(text, hexKey) {
  if (!text) return null;
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

function decrypt(text, hexKey) {
  if (!text) return null;
  const [ivHex, tagHex, enc] = text.split(':');
  const key = Buffer.from(hexKey, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/__tests__/crypto.test.js`
Expected: PASS

**Step 5: Add ENCRYPTION_KEY to .env**

Generate a random 32-byte hex key and add to `.env`:
```
ENCRYPTION_KEY=<64 hex chars>
```

**Step 6: Commit**

```bash
git add src/utils/crypto.js src/utils/__tests__/crypto.test.js
git commit -m "feat: AES-256-GCM crypto utility for tenant API keys"
```

---

### Task 3: Tenant Service — CRUD + key encryption

**Files:**
- Create: `src/tenant/tenantService.js`
- Create: `src/tenant/__tests__/tenantService.test.js`

**Step 1: Write test**

```js
jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn((v) => `enc_${v}`),
  decrypt: jest.fn((v) => v.replace('enc_', '')),
}));

const { supabase } = require('../../database/supabase');
const tenantService = require('../tenantService');

describe('tenantService', () => {
  test('createTenant encrypts API keys', async () => {
    supabase.from().insert().select().single.mockResolvedValue({
      data: { id: 'uuid-1', name: 'Test' },
      error: null,
    });

    const result = await tenantService.createTenant({
      name: 'Test',
      bot_token: 'tok',
      chat_id: '123',
      gemini_api_key: 'gem',
      brave_search_key: 'brave',
      fal_key: 'fal',
    });

    expect(result.id).toBe('uuid-1');
    const insertCall = supabase.from().insert.mock.calls[0][0];
    expect(insertCall.gemini_api_key).toBe('enc_gem');
    expect(insertCall.brave_search_key).toBe('enc_brave');
    expect(insertCall.fal_key).toBe('enc_fal');
  });

  test('getActiveTenants decrypts keys', async () => {
    supabase.from().select().eq.mockResolvedValue({
      data: [{ id: '1', gemini_api_key: 'enc_gem', brave_search_key: 'enc_brave', fal_key: 'enc_fal' }],
      error: null,
    });

    const tenants = await tenantService.getActiveTenants();
    expect(tenants[0].gemini_api_key).toBe('gem');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

```js
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
  };
}

function decryptKeys(tenant) {
  return {
    ...tenant,
    gemini_api_key: decrypt(tenant.gemini_api_key, ENC_KEY),
    brave_search_key: decrypt(tenant.brave_search_key, ENC_KEY),
    fal_key: decrypt(tenant.fal_key, ENC_KEY),
  };
}

async function createTenant({ name, bot_token, chat_id, gemini_api_key, brave_search_key, fal_key, branding, emily_tone }) {
  const encrypted = encryptKeys({ gemini_api_key, brave_search_key, fal_key });
  const { data, error } = await supabase
    .from('tenants')
    .insert({ name, bot_token, chat_id, ...encrypted, branding, emily_tone })
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
  // Re-encrypt if keys are being updated
  if (toUpdate.gemini_api_key) toUpdate.gemini_api_key = encrypt(toUpdate.gemini_api_key, ENC_KEY);
  if (toUpdate.brave_search_key) toUpdate.brave_search_key = encrypt(toUpdate.brave_search_key, ENC_KEY);
  if (toUpdate.fal_key) toUpdate.fal_key = encrypt(toUpdate.fal_key, ENC_KEY);

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
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/tenant/tenantService.js src/tenant/__tests__/tenantService.test.js
git commit -m "feat: tenant service with encrypted API keys"
```

---

### Task 4: Refactor agentRunner — accept API key as parameter

**Files:**
- Modify: `src/agents/agentRunner.js`
- Modify: `src/agents/__tests__/agentRunner.test.js`

**Step 1: Update agentRunner to accept `geminiApiKey` option**

Change `runAgent` signature to accept optional `{ geminiApiKey }` in the options object. If provided, use it; otherwise fall back to `process.env.GEMINI_API_KEY` (backwards compat during migration).

```js
async function runAgent(systemPrompt, input, { model = 'haiku', maxTokens = 4096, geminiApiKey } = {}) {
  const message = extractText(input);
  const modelId = MODEL_MAP[model] || model;
  const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  logger.debug('Running agent via Gemini', { model: modelId, messageLength: message.length });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  // ... rest unchanged
}
```

**Step 2: Update existing test if needed — ensure backwards compat**

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add src/agents/agentRunner.js
git commit -m "feat: agentRunner accepts geminiApiKey param"
```

---

### Task 5: Refactor contentCreation — accept tenant keys

**Files:**
- Modify: `src/flows/contentCreation.js`

**Step 1: Add `tenantKeys` parameter to searchBrave, runResearch, runContentFromResearch, runContentFlow, loadPipeline**

Each function gets an optional `tenantKeys` object `{ geminiApiKey, braveSearchKey, falKey, tenantId }`. Pass it down the chain.

Key changes:
- `searchBrave(topic, braveSearchKey)` — use param instead of `process.env`
- `loadPipeline(tenantId)` — add `.eq('tenant_id', tenantId)` if provided
- `runAgent(prompt, input, { geminiApiKey })` — pass through
- `runContentFromResearch(...)` — add `tenantId` to draft insert
- `runContentFlow(...)` — pass keys through

Maintain backwards compat: if `tenantKeys` is not provided, fall back to `process.env` values and no tenant filter.

**Step 2: Run existing tests — expect PASS (backwards compat)**

**Step 3: Commit**

```bash
git add src/flows/contentCreation.js
git commit -m "feat: contentCreation accepts tenant keys"
```

---

### Task 6: Refactor handlers — tenant-aware state + DB queries

**Files:**
- Modify: `src/telegram/handlers.js`

This is the biggest change. Key refactors:

**Step 1: Convert global pending flows to Maps keyed by chatId**

```js
// Before: let pendingCronFlow = null;
// After:
const pendingCronFlows = new Map();  // chatId -> flow data
const pendingAgentFlows = new Map();
const pendingFormatFlows = new Map();
const pendingImageFlows = new Map();
const pendingResearchFlows = new Map();
```

Replace all reads/writes:
- `pendingCronFlow` → `pendingCronFlows.get(chatId)` / `pendingCronFlows.set(chatId, ...)` / `pendingCronFlows.delete(chatId)`
- Same pattern for all 5 flows

**Step 2: Add `tenant` parameter to all handler functions**

Every handler signature changes from `(bot, msg)` to `(bot, msg, tenant)`. The tenant object contains: `{ id, gemini_api_key, brave_search_key, fal_key, branding, emily_tone, chat_id }`.

Build a `tenantKeys` helper from tenant:
```js
function tenantKeys(tenant) {
  return {
    geminiApiKey: tenant.gemini_api_key,
    braveSearchKey: tenant.brave_search_key,
    falKey: tenant.fal_key,
    tenantId: tenant.id,
  };
}
```

**Step 3: Add `tenant_id` to all Supabase queries**

Every `.from('agents').select(...)` gets `.eq('tenant_id', tenant.id)`.
Every `.insert({...})` gets `tenant_id: tenant.id`.

**Step 4: Pass tenantKeys to runAgent, runContentFlow, runResearch, etc.**

**Step 5: Update EMILY_SYSTEM_PROMPT to use `tenant.emily_tone` if set**

If `tenant.emily_tone` is provided, append it to the base prompt.

**Step 6: Update exported test setters to work with Maps**

**Step 7: Run tests — fix any broken ones**

**Step 8: Commit**

```bash
git add src/telegram/handlers.js
git commit -m "feat: handlers tenant-aware with per-chatId state"
```

---

### Task 7: Refactor middleware — tenant resolution

**Files:**
- Modify: `src/telegram/middleware.js`

**Step 1: Replace isAuthorized with resolveTenant**

```js
const tenantService = require('../tenant/tenantService');
const { logger } = require('../utils/logger');

// Cache tenants in memory, refreshed on bot start
const tenantCache = new Map(); // chatId -> tenant

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
```

**Step 2: Commit**

```bash
git add src/telegram/middleware.js
git commit -m "feat: middleware tenant cache for fast resolution"
```

---

### Task 8: Refactor bot.js — multi-tenant bot factory

**Files:**
- Modify: `src/telegram/bot.js`

**Step 1: Rewrite createBot to accept tenant**

```js
function createBot(tenant) {
  const bot = new TelegramBot(tenant.bot_token, { polling: true });

  function guard(chatId) {
    if (String(chatId) !== String(tenant.chat_id)) {
      logger.warn('Unauthorized access attempt', { chatId, tenantId: tenant.id });
      bot.sendMessage(chatId, 'Acesso nao autorizado.');
      return false;
    }
    return true;
  }

  // All onText handlers pass tenant as 3rd arg
  bot.onText(/\/start/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStart(bot, msg, tenant);
  });

  // ... same pattern for all commands

  // Polling error with failure counter for auto-deactivation
  let pollingFailures = 0;
  bot.on('polling_error', (err) => {
    pollingFailures++;
    logger.error('Telegram polling error', { error: err.message, tenantId: tenant.id, failures: pollingFailures });
    if (pollingFailures >= 4) {
      logger.error('Too many polling failures — deactivating tenant', { tenantId: tenant.id });
      // Emit event for botManager to handle
      bot.emit('tenant_deactivate', tenant.id);
    }
  });

  // Reset counter on successful poll
  bot.on('message', () => { pollingFailures = 0; });
  bot.on('callback_query', () => { pollingFailures = 0; });

  logger.info('Bot started for tenant', { tenantId: tenant.id, name: tenant.name });
  return bot;
}
```

**Step 2: Commit**

```bash
git add src/telegram/bot.js
git commit -m "feat: bot factory accepts tenant, tracks polling failures"
```

---

### Task 9: BotManager — multi-bot lifecycle

**Files:**
- Create: `src/tenant/botManager.js`

**Step 1: Implement BotManager**

```js
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

  // Listen for auto-deactivation
  bot.on('tenant_deactivate', async (tenantId) => {
    await stopBot(tenantId);
    await tenantService.deactivateTenant(tenantId);
    // Notify admin (your chat_id from env)
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      try {
        // Use any active bot to notify admin
        const anyBot = [...botInstances.values()][0]?.bot;
        if (anyBot) {
          await anyBot.sendMessage(adminChatId, `⚠️ Tenant "${tenant.name}" desativado — polling falhou 4x.`);
        }
      } catch {}
    }
  });

  setTenantCache(tenant.chat_id, tenant);
  botInstances.set(tenant.id, { bot, tenant });

  // Init cron for this tenant
  await cronManager.initForTenant(bot, tenant, onCronResearchReady);

  // Send welcome if first time (optional)
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
```

**Step 2: Commit**

```bash
git add src/tenant/botManager.js
git commit -m "feat: botManager multi-bot lifecycle"
```

---

### Task 10: Refactor cronManager — per-tenant crons

**Files:**
- Modify: `src/scheduler/cronManager.js`

**Step 1: Add per-tenant methods**

Keep existing `init` for backwards compat during migration. Add:

```js
// Per-tenant init — loads schedules for one tenant
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
    _registerCron(bot, tenant.chat_id, schedule, onReady);
  }

  logger.info('Crons initialized for tenant', { tenantId: tenant.id, count: (schedules || []).length });
}

// Stop all crons for a tenant
function stopForTenant(tenantId) {
  for (const [id, task] of _activeCrons.entries()) {
    // We need to track tenantId in the map — change Map value to { task, tenantId }
    if (task.tenantId === tenantId) {
      task.cronTask.stop();
      _activeCrons.delete(id);
    }
  }
}
```

Update `_registerCron` to store `tenantId` alongside the cron task.
Update `createSchedule` to accept and insert `tenant_id`.

**Step 2: Run tests — fix broken ones**

**Step 3: Commit**

```bash
git add src/scheduler/cronManager.js
git commit -m "feat: cronManager per-tenant cron management"
```

---

### Task 11: Refactor index.js — boot via BotManager

**Files:**
- Modify: `src/index.js`

**Step 1: Replace single bot creation with BotManager.startAll()**

```js
require('dotenv').config();
const express = require('express');
const { logger } = require('./utils/logger');
const botManager = require('./tenant/botManager');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason?.message || String(reason) });
});

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  const instances = botManager.getInstances();
  res.json({
    status: 'ok',
    activeBots: instances.size,
    timestamp: new Date().toISOString(),
  });
});

// Boot all tenant bots
botManager.startAll().catch((err) => {
  logger.error('BotManager startAll failed', { error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

**Step 2: Add ADMIN_CHAT_ID to .env**

```
ADMIN_CHAT_ID=7927874218
```

**Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: boot via BotManager, multi-tenant entry point"
```

---

### Task 12: Rate Limiter — 6 pipelines/hour per tenant

**Files:**
- Create: `src/utils/rateLimiter.js`
- Create: `src/utils/__tests__/rateLimiter.test.js`

**Step 1: Write test**

```js
const { checkRateLimit, _reset } = require('../rateLimiter');

describe('rateLimiter', () => {
  beforeEach(() => _reset());

  test('allows up to 6 calls per hour', () => {
    const tenantId = 'tenant-1';
    for (let i = 0; i < 6; i++) {
      expect(checkRateLimit(tenantId)).toBe(true);
    }
    expect(checkRateLimit(tenantId)).toBe(false);
  });

  test('different tenants have independent limits', () => {
    for (let i = 0; i < 6; i++) checkRateLimit('a');
    expect(checkRateLimit('a')).toBe(false);
    expect(checkRateLimit('b')).toBe(true);
  });
});
```

**Step 2: Implement**

```js
'use strict';

const LIMIT = 6;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const buckets = new Map(); // tenantId -> [timestamps]

function checkRateLimit(tenantId) {
  const now = Date.now();
  const timestamps = buckets.get(tenantId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= LIMIT) {
    buckets.set(tenantId, recent);
    return false;
  }

  recent.push(now);
  buckets.set(tenantId, recent);
  return true;
}

function _reset() { buckets.clear(); }

module.exports = { checkRateLimit, _reset };
```

**Step 3: Run test — expect PASS**

**Step 4: Integrate into handlers**

In `handleConteudo`, `handleFormatCallback`, and `handleFreeMessage` (when detecting `[ACAO:CONTEUDO]`), add rate limit check before running pipeline:

```js
const { checkRateLimit } = require('../utils/rateLimiter');

// Before starting pipeline:
if (!checkRateLimit(tenant.id)) {
  return bot.sendMessage(chatId, '⚠️ Limite de 6 conteudos por hora atingido. Tente novamente mais tarde.');
}
```

**Step 5: Commit**

```bash
git add src/utils/rateLimiter.js src/utils/__tests__/rateLimiter.test.js src/telegram/handlers.js
git commit -m "feat: rate limiter 6 pipelines/hour per tenant"
```

---

### Task 13: Register Tenant CLI Script

**Files:**
- Create: `scripts/register-tenant.js`

**Step 1: Implement CLI**

```js
#!/usr/bin/env node
'use strict';
require('dotenv').config();

const tenantService = require('../src/tenant/tenantService');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  flags[args[i].replace('--', '')] = args[i + 1];
}

const required = ['name', 'bot_token', 'chat_id', 'gemini_key'];
for (const r of required) {
  if (!flags[r]) {
    console.error(`Missing --${r}`);
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
    console.log(`Tenant created: ${tenant.id} (${tenant.name})`);
    console.log('Restart the bot to activate: pm2 restart emilybot');
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
```

**Step 2: Commit**

```bash
git add scripts/register-tenant.js
git commit -m "feat: CLI script to register new tenants"
```

---

### Task 14: Branding Command — /branding

**Files:**
- Modify: `src/telegram/handlers.js`
- Modify: `src/telegram/bot.js`

**Step 1: Add handleBranding to handlers.js**

```js
async function handleBranding(bot, msg, tenant, args) {
  const chatId = msg.chat.id;

  if (!args) {
    // Show current branding
    const b = tenant.branding || {};
    const lines = [
      `🎨 *Branding atual:*`,
      `Preset: ${b.template_preset || 'modern'}`,
      `Cor primaria: ${b.primary_color || '#FF5722'}`,
      `Cor secundaria: ${b.secondary_color || '#1A1A2E'}`,
      `Cor texto: ${b.text_color || '#FFFFFF'}`,
      `Fonte: ${b.font || 'Montserrat'}`,
      `Logo: ${b.logo_url || 'nenhum'}`,
      '',
      'Para alterar: /branding <campo> <valor>',
      'Campos: cor, cor2, texto_cor, fonte, logo, preset',
    ];
    return bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
  }

  const [field, ...rest] = args.split(' ');
  const value = rest.join(' ').trim();
  if (!value) return bot.sendMessage(chatId, 'Use: /branding <campo> <valor>');

  const branding = { ...(tenant.branding || {}) };
  const fieldMap = {
    cor: 'primary_color',
    cor2: 'secondary_color',
    texto_cor: 'text_color',
    fonte: 'font',
    logo: 'logo_url',
    preset: 'template_preset',
  };

  const key = fieldMap[field];
  if (!key) return bot.sendMessage(chatId, `Campo invalido: ${field}\nValidos: cor, cor2, texto_cor, fonte, logo, preset`);

  if (key === 'template_preset' && !['modern', 'clean', 'bold'].includes(value)) {
    return bot.sendMessage(chatId, 'Presets disponiveis: modern, clean, bold');
  }

  branding[key] = value;

  const tenantService = require('../tenant/tenantService');
  await tenantService.updateTenant(tenant.id, { branding });
  // Update in-memory cache
  tenant.branding = branding;
  const { setTenantCache } = require('./middleware');
  setTenantCache(tenant.chat_id, tenant);

  await bot.sendMessage(chatId, `✅ ${field} atualizado para: ${value}`);
}
```

**Step 2: Register `/branding` in bot.js**

```js
bot.onText(/\/branding(?:\s+(.+))?/, (msg, match) => {
  if (!guard(msg.chat.id)) return;
  handleBranding(bot, msg, tenant, match?.[1]?.trim());
});
```

**Step 3: Commit**

```bash
git add src/telegram/handlers.js src/telegram/bot.js
git commit -m "feat: /branding command for tenant visual customization"
```

---

### Task 15: Integration Test — full boot + smoke test

**Step 1: Manual smoke test**

1. Run `npm run dev`
2. Verify your bot starts (check logs for "Bot started for tenant")
3. Send `/start` — expect welcome
4. Send `/status` — expect stats
5. Send `/branding` — expect current config
6. Check `/health` endpoint — expect `{ activeBots: 1 }`

**Step 2: Register a test tenant (optional)**

Use `scripts/register-tenant.js` with a second bot token to verify multi-tenant works.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: multi-tenant MVP complete"
```

---

## Execution Order

Tasks 1-3 are foundational (DB, crypto, tenant service).
Task 4-5 are refactors with backwards compat (agentRunner, contentCreation).
Tasks 6-8 are the core rewrite (handlers, middleware, bot).
Task 9 is the orchestrator (botManager).
Task 10-11 are infra (cronManager, index.js).
Tasks 12-14 are features (rate limiter, CLI, branding).
Task 15 is validation.

**Dependency chain:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15

# Instagram Direct Posting — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After images + caption are generated, offer tenant a button to post directly to their Instagram (single post or carousel) via the Graph API using a manually-supplied long-lived token.

**Architecture:** New `instagramPublisher.js` service wraps the 2-step IG Graph API flow (create container → publish). `handlers.js` threads `imageUrls` through `pendingCaptionFlows` and adds a post-caption "Post to Instagram?" button. Token stored encrypted in `tenants` table, set via `register-tenant.js` or new `/instagram` command.

**Tech Stack:** axios (already installed), Instagram Graph API v21.0, Supabase (migration), AES-256-GCM encryption (existing `crypto.js`)

---

## Key Constraints

- IG Graph API requires **publicly accessible image URLs** — the bot already saves images locally and generates URLs from `process.env.EXTERNAL_URL`. This must be set on the VPS.
- Only works for **Business or Creator** Instagram accounts linked to a Facebook Page.
- Tenant must be added as **Tester** in the Meta Developer App first.
- Carousel: max 10 items, min 2. Single: `post_unico` format.
- Token format: long-lived User Access Token (~60 days) starting with `EAA...`

---

## Task 1: DB Migration

**Files:**
- Create: `src/database/migrations/005_instagram.sql`

**Step 1: Write migration**

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS instagram_token TEXT;
```

**Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `005_instagram` and the SQL above.

**Step 3: Verify columns exist**

Run `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name IN ('instagram_user_id', 'instagram_token');
```
Expected: 2 rows returned.

**Step 4: Commit**
```bash
git add src/database/migrations/005_instagram.sql
git commit -m "feat: add instagram_user_id and instagram_token columns to tenants"
```

---

## Task 2: Instagram Publisher Service

**Files:**
- Create: `src/services/instagramPublisher.js`

**Step 1: Write the service**

```js
'use strict';
const axios = require('axios');
const { logger } = require('../utils/logger');

const IG_BASE = 'https://graph.facebook.com/v21.0';

async function createMediaContainer(userId, token, imageUrl, caption = null, isCarouselItem = false) {
  const params = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = true;
  if (caption && !isCarouselItem) params.caption = caption;
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: no container id returned');
  return data.id;
}

async function createCarouselContainer(userId, token, childrenIds, caption) {
  const params = {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    caption,
    access_token: token,
  };
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: no carousel container id returned');
  return data.id;
}

async function publishContainer(userId, token, creationId) {
  const params = { creation_id: creationId, access_token: token };
  const { data } = await axios.post(`${IG_BASE}/${userId}/media_publish`, null, { params, timeout: 30000 });
  if (!data.id) throw new Error('IG: publish returned no post id');
  return data.id;
}

// Polls until container status is FINISHED (up to 60s)
async function waitForContainer(userId, token, containerId) {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`${IG_BASE}/${containerId}`, {
      params: { fields: 'status_code', access_token: token },
      timeout: 15000,
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('IG: container processing failed');
  }
  throw new Error('IG: container processing timed out');
}

async function postSingleImage(userId, token, imageUrl, caption) {
  logger.info('IG: posting single image', { userId });
  const containerId = await createMediaContainer(userId, token, imageUrl, caption);
  await waitForContainer(userId, token, containerId);
  return publishContainer(userId, token, containerId);
}

async function postCarousel(userId, token, imageUrls, caption) {
  logger.info('IG: posting carousel', { userId, slides: imageUrls.length });
  const childIds = [];
  for (const url of imageUrls) {
    const id = await createMediaContainer(userId, token, url, null, true);
    await waitForContainer(userId, token, id);
    childIds.push(id);
  }
  const carouselId = await createCarouselContainer(userId, token, childIds, caption);
  return publishContainer(userId, token, carouselId);
}

module.exports = { postSingleImage, postCarousel };
```

**Step 2: Verify syntax**
```bash
node -e "require('./src/services/instagramPublisher')"
```
Expected: no output, no error.

**Step 3: Commit**
```bash
git add src/services/instagramPublisher.js
git commit -m "feat: instagram publisher service (single + carousel)"
```

---

## Task 3: Encrypt instagram_token in tenantService

**Files:**
- Modify: `src/tenant/tenantService.js`

**Step 1: Add `instagram_token` to `encryptKeys`**

In `encryptKeys`, add:
```js
instagram_token: data.instagram_token ? encrypt(data.instagram_token, ENC_KEY) : data.instagram_token,
```

**Step 2: Add `instagram_token` to `decryptKeys`**

In `decryptKeys`, add:
```js
instagram_token: safeDecrypt(tenant.instagram_token),
```

**Step 3: Add `instagram_token` to `updateTenant` selective encryption block**

After the `apify_key` line:
```js
if (toUpdate.instagram_token) toUpdate.instagram_token = encrypt(toUpdate.instagram_token, ENC_KEY);
```

**Step 4: Add `instagram_user_id` and `instagram_token` to `createTenant` signature and insert**

Signature:
```js
async function createTenant({ ..., instagram_user_id, instagram_token })
```

In `encryptKeys` call, pass `instagram_token`. In insert, spread result and add `instagram_user_id`.

**Step 5: Verify syntax**
```bash
node -e "require('./src/tenant/tenantService')"
```

**Step 6: Commit**
```bash
git add src/tenant/tenantService.js
git commit -m "feat: encrypt/decrypt instagram_token in tenantService"
```

---

## Task 4: Wire Instagram flow into handlers.js

**Files:**
- Modify: `src/telegram/handlers.js`

This is the core task. Four changes:

### 4a: Import instagramPublisher

At top with other requires:
```js
const { postSingleImage, postCarousel } = require('../services/instagramPublisher');
```

### 4b: Thread imageUrls through pendingCaptionFlows

Everywhere `pendingCaptionFlows.set(chatIdStr, ...)` is called, add `imageUrls`:

- In `post_unico` block (after `imgBuf` is generated):
  - The local URL is already computed: capture it in a variable `imageUrl` and pass `imageUrls: [imageUrl]`
  - Currently: `pendingCaptionFlows.set(chatIdStr, { format, final_content: sourceContent, draft_id })`
  - Change to: `pendingCaptionFlows.set(chatIdStr, { format, final_content: sourceContent, draft_id, imageUrls: [localUrl] })`
  - Note: `localUrl` is the value returned by `saveImageLocally(...)` — refactor that block to capture it.

- In `carrossel` block:
  - `uploadedUrls` is already built. Pass: `imageUrls: uploadedUrls`

- In `carrossel_noticias` block:
  - Same: `imageUrls: uploadedUrls`

- In cron flow (`handleFreeMessage`):
  - No images there — pass `imageUrls: []`

### 4c: Add Instagram button to caption callback

In `handleCaptionCallback`, after generating and sending the caption, check if tenant has Instagram configured:

```js
// After: await bot.sendMessage(chatId, caption);

const { imageUrls, draft_id: cDraftId } = pendingCaptionData; // save before deleting
if (tenant?.instagram_user_id && tenant?.instagram_token && imageUrls?.length) {
  pendingCaptionFlows.set(chatIdStr, { format, final_content, draft_id: cDraftId, imageUrls, caption });
  await bot.sendMessage(chatId, '📸 Postar no Instagram?', {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Postar agora', callback_data: 'instagram:post' },
        { text: '❌ Não', callback_data: 'instagram:skip' },
      ]],
    },
  });
}
```

Note: `pendingCaptionFlows` is deleted before caption send — adjust order so we keep a reference to the data first.

### 4d: Add handleInstagramCallback

New function:
```js
async function handleInstagramCallback(bot, query, tenant) {
  const chatId = query.message.chat.id;
  const chatIdStr = String(chatId);
  await bot.answerCallbackQuery(query.id);
  await bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: query.message.message_id }
  );

  if (query.data === 'instagram:skip') {
    pendingCaptionFlows.delete(chatIdStr);
    return;
  }

  if (!pendingCaptionFlows.has(chatIdStr)) {
    return bot.sendMessage(chatId, '❌ Nenhum conteudo pendente para postar.');
  }

  const { format, imageUrls, caption } = pendingCaptionFlows.get(chatIdStr);
  pendingCaptionFlows.delete(chatIdStr);

  const userId = tenant.instagram_user_id;
  const token = tenant.instagram_token;

  if (!userId || !token) {
    return bot.sendMessage(chatId, '❌ Instagram nao configurado. Use /instagram para configurar.');
  }

  await bot.sendMessage(chatId, '📸 Postando no Instagram...');

  try {
    let postId;
    if (format === 'post_unico' || imageUrls.length === 1) {
      postId = await postSingleImage(userId, token, imageUrls[0], caption);
    } else {
      postId = await postCarousel(userId, token, imageUrls, caption);
    }
    await bot.sendMessage(chatId, `✅ Postado no Instagram! ID: ${postId}`);
  } catch (err) {
    logger.error('Instagram post failed', { error: err.message });
    await bot.sendMessage(chatId, `❌ Erro ao postar: ${err.message}`);
  }
}
```

### 4e: Add /instagram command handler

```js
async function handleInstagram(bot, msg, tenant, args) {
  const chatId = msg.chat.id;

  if (!tenant) return bot.sendMessage(chatId, '❌ Tenant nao identificado.');

  if (!args) {
    const hasConfig = tenant.instagram_user_id && tenant.instagram_token;
    return bot.sendMessage(
      chatId,
      hasConfig
        ? `✅ Instagram configurado (User ID: ${tenant.instagram_user_id})\n\nPara atualizar:\n/instagram <user_id> <token>`
        : '❌ Instagram nao configurado.\n\nUso: /instagram <user_id> <access_token>\n\nObtanha o token em: Meta Graph API Explorer'
    );
  }

  const parts = args.split(' ');
  if (parts.length < 2) {
    return bot.sendMessage(chatId, 'Uso: /instagram <user_id> <access_token>');
  }

  const [instagram_user_id, instagram_token] = parts;
  const tenantService = require('../tenant/tenantService');
  await tenantService.updateTenant(tenant.id, { instagram_user_id, instagram_token });
  tenant.instagram_user_id = instagram_user_id;
  tenant.instagram_token = instagram_token;

  const { setTenantCache } = require('./middleware');
  setTenantCache(tenant.chat_id, tenant);

  await bot.sendMessage(chatId, '✅ Instagram configurado com sucesso!');
}
```

### 4f: Export and wire in bot.js

In `module.exports`, add `handleInstagramCallback` and `handleInstagram`.

In `src/telegram/bot.js`, register:
- `/instagram` command → `handleInstagram(bot, msg, tenant, args)`
- callback `instagram:post` and `instagram:skip` → `handleInstagramCallback(bot, query, tenant)`

**Step: Verify syntax**
```bash
node -e "require('./src/telegram/handlers')"
```

**Step: Commit**
```bash
git add src/telegram/handlers.js
git commit -m "feat: instagram posting flow in telegram handlers"
```

---

## Task 5: Update register-tenant.js

**Files:**
- Modify: `scripts/register-tenant.js`

**Step 1: Add optional flags to usage message**

Add to usage output:
```
  [--instagram_user_id "123456789"] \
  [--instagram_token "EAAxxxxx"]
```

**Step 2: Pass to createTenant**

```js
instagram_user_id: flags.instagram_user_id || null,
instagram_token: flags.instagram_token || null,
```

**Step 3: Commit**
```bash
git add scripts/register-tenant.js
git commit -m "feat: add instagram_user_id and instagram_token to register-tenant CLI"
```

---

## Task 6: Update bot.js routing

**Files:**
- Modify: `src/telegram/bot.js`

Read this file first. Then:

1. Import `handleInstagram` and `handleInstagramCallback` from handlers.
2. Add command handler for `/instagram`.
3. In the callback_query handler block, add routing for `instagram:post` and `instagram:skip` → `handleInstagramCallback`.

**Step: Verify**
```bash
node -e "require('./src/telegram/bot')" 2>&1 | head -5
```
Expected: no error.

**Step: Commit**
```bash
git add src/telegram/bot.js
git commit -m "feat: wire /instagram command and instagram callback in bot.js"
```

---

## Task 7: Update /ajuda command

In `handleAjuda`, add:
```
/instagram — Configurar conta do Instagram
```

Commit:
```bash
git add src/telegram/handlers.js
git commit -m "docs: add /instagram to /ajuda help menu"
```

---

## Testing Checklist

1. `node -e "require('./src/services/instagramPublisher')"` — no error
2. `node -e "require('./src/tenant/tenantService')"` — no error
3. `node -e "require('./src/telegram/handlers')"` — no error
4. `/instagram` command: shows "not configured" message when no token
5. `/instagram <user_id> <token>`: saves and caches token
6. Generate a post → get image → get caption → see "Postar no Instagram?" button
7. Confirm post → `✅ Postado no Instagram! ID: ...`
8. Token encrypted: check Supabase `tenants` table directly — `instagram_token` should look like `iv:authTag:ciphertext`

## Notes on EXTERNAL_URL

For posting to work, `EXTERNAL_URL` must be set in `.env` to a publicly accessible URL (e.g. `https://yourdomain.com`). On local dev, IG can't reach `localhost`. Use ngrok or test only on VPS.

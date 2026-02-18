# Phase 4 — Polimento

## Status
In progress. Format selection (step 1) complete.

## Steps

### ✅ 1. Inline format selection
User picks format via Telegram inline buttons before pipeline runs.

**Flow:** `/conteudo tema` → 5 format buttons appear → user clicks → pipeline runs with chosen format.

**Formats:** post_unico, carrossel, tweet, thread, reels_roteiro

**Files changed:**
- `src/telegram/handlers.js` — `FORMAT_BUTTONS`, `askForFormat()`, `handleFormatCallback()`, `runContentAndSend()`, updated `handleConteudo` + Emily `[ACAO:CONTEUDO]` match
- `src/telegram/bot.js` — added `callback_query` handler

**State:** `pendingFormatFlow = { topic, chatId }` (same pattern as pendingCronFlow/pendingAgentFlow)

---

### ⬜ 2. Content history listing
Command `/historico` to browse past drafts from `content_drafts` table.

### ⬜ 3. Daily health report
Cron job at 7am Brasília sending system summary to Telegram (agent count, drafts today, schedules active, any errors).

### ⬜ 4. Docs
README with setup, commands, and architecture overview.

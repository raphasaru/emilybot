# Emily Agent System — MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working Telegram bot where Emily (COO agent) receives messages, orchestrates 3 sub-agents (Pesquisador, Redator, Formatador), and returns formatted content — all persisted to Supabase.

**Architecture:** Express server receives Telegram webhook POSTs. Messages are routed through auth middleware (chat_id whitelist), then to Emily orchestrator which delegates to sub-agents via Anthropic SDK. Supabase stores agents config, conversations, and content drafts. CommonJS throughout (`node-telegram-bot-api` is CJS-only).

**Tech Stack:** Node.js (CommonJS), Express, @anthropic-ai/sdk, node-telegram-bot-api, @supabase/supabase-js, dotenv, winston

---

## Task 1: Project Scaffold & Dependencies

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/index.js` (empty entry)

**Step 1: Initialize project**

```bash
cd /Users/charbellelopes/emilybot
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk node-telegram-bot-api @supabase/supabase-js express dotenv winston axios
```

**Step 3: Install dev dependencies**

```bash
npm install -D jest nodemon
```

**Step 4: Create `.gitignore`**

```
node_modules/
.env
*.log
```

**Step 5: Create `.env.example`**

```env
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_ID=...
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
SERPER_API_KEY=...
PORT=3000
NODE_ENV=development
TIMEZONE=America/Sao_Paulo
```

**Step 6: Update `package.json` scripts**

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest"
  }
}
```

**Step 7: Create empty entry point `src/index.js`**

```js
// Entry point — will be implemented in Task 4
```

**Step 8: Init git & commit**

```bash
git init
git add package.json package-lock.json .gitignore .env.example src/index.js
git commit -m "chore: scaffold project with deps"
```

---

## Task 2: Supabase Client & Migrations

**Files:**
- Create: `src/database/supabase.js`
- Create: `src/database/migrations/001_initial_schema.sql`

**Step 1: Create Supabase client — `src/database/supabase.js`**

```js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
```

**Step 2: Create initial migration — `src/database/migrations/001_initial_schema.sql`**

```sql
-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tools JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  position_in_flow INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Content drafts table
CREATE TABLE IF NOT EXISTS content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  format TEXT,
  research JSONB,
  draft TEXT,
  final_content TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default agents
INSERT INTO agents (name, display_name, role, system_prompt, position_in_flow)
VALUES
  ('pesquisador', 'Pesquisador Estrategista', 'researcher',
   'Voce e um pesquisador e estrategista de conteudo especializado em:
- Inteligencia Artificial (LLMs, automacao, agentes de IA)
- Meta Ads e Google Ads
- Gestao de trafego e marketing digital
- Automacoes de marketing

Sua missao: pesquisar o que esta em alta agora nesses temas, identificar tendencias, novidades e oportunidades de conteudo. Entregue 3 a 5 sugestoes de pauta com:
- Titulo / gancho
- Por que esta em alta agora
- Publico-alvo principal
- Angulo diferenciado para o Raphael abordar

Responda SEMPRE em JSON com a estrutura:
{
  "ideas": [
    {
      "title": "...",
      "why_trending": "...",
      "target_audience": "...",
      "angle": "..."
    }
  ]
}', 1),

  ('redator', 'Redator Copywriter', 'writer',
   'Voce e o redator e copywriter do Raphael, um gestor de trafego e criador de conteudo sobre IA, Meta Ads, Google Ads e marketing digital.

Estilo de escrita do Raphael:
- Tom direto, sem enrolacao
- Linguagem acessivel mas autoridade tecnica
- Foca em resultados praticos e aplicacao real
- Usa exemplos do dia a dia do gestor de trafego
- Nao e guru motivacional — e tecnico e pratico

Sua missao: transformar a pesquisa recebida em conteudo com a voz do Raphael.
Entregue em JSON:
{
  "title": "...",
  "body": "...",
  "key_points": ["..."],
  "cta": "..."
}', 2),

  ('formatador', 'Formatador Adaptador', 'formatter',
   'Voce e o especialista em formatos de conteudo para redes sociais.
Sua missao: adaptar o conteudo recebido para o formato solicitado.

Formatos disponiveis:
- carrossel: slides numerados com capa, desenvolvimento e CTA
- post_unico: caption completa com emojis estrategicos e hashtags
- tweet: mensagem impactante em ate 280 caracteres
- thread: sequencia de tweets numerados (1/N)
- reels_roteiro: gancho (3s) + desenvolvimento (ate 55s) + CTA (5s)

Entregue SEMPRE em JSON:
{
  "format": "...",
  "content": "...",
  "publishing_notes": "..."
}', 3)
ON CONFLICT (name) DO NOTHING;
```

**Step 3: Run migration on Supabase**

Run the SQL above in Supabase SQL editor or via the Neon MCP tool if using Neon.

**Step 4: Commit**

```bash
git add src/database/
git commit -m "feat: supabase client + initial schema with seed agents"
```

---

## Task 3: Logger Utility

**Files:**
- Create: `src/utils/logger.js`

**Step 1: Create logger — `src/utils/logger.js`**

```js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${extra}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = { logger };
```

**Step 2: Commit**

```bash
git add src/utils/logger.js
git commit -m "feat: add winston logger"
```

---

## Task 4: Agent Runner (core Anthropic integration)

**Files:**
- Create: `src/agents/agentRunner.js`
- Create: `src/agents/__tests__/agentRunner.test.js`

**Step 1: Write test — `src/agents/__tests__/agentRunner.test.js`**

```js
const { buildMessages } = require('../agentRunner');

describe('buildMessages', () => {
  test('wraps user content with system prompt context', () => {
    const msgs = buildMessages('You are a bot.', 'Hello');
    expect(msgs).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  test('accepts conversation history array', () => {
    const history = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ];
    const msgs = buildMessages('Prompt', history);
    expect(msgs).toEqual(history);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/charbellelopes/emilybot && npx jest src/agents/__tests__/agentRunner.test.js
```
Expected: FAIL — module not found.

**Step 3: Implement — `src/agents/agentRunner.js`**

```js
const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');
require('dotenv').config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildMessages(systemPrompt, input) {
  if (Array.isArray(input)) return input;
  return [{ role: 'user', content: input }];
}

async function runAgent(systemPrompt, input, { model = 'claude-sonnet-4-5-20250514', maxTokens = 4096 } = {}) {
  const messages = buildMessages(systemPrompt, input);
  logger.debug(`Running agent`, { model, messageCount: messages.length });

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  logger.debug(`Agent response`, { length: text.length });
  return text;
}

module.exports = { runAgent, buildMessages };
```

**Step 4: Run test to verify it passes**

```bash
npx jest src/agents/__tests__/agentRunner.test.js
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/
git commit -m "feat: agentRunner — core Anthropic SDK wrapper"
```

---

## Task 5: Content Creation Flow

**Files:**
- Create: `src/flows/contentCreation.js`
- Create: `src/flows/__tests__/contentCreation.test.js`

**Step 1: Write test — `src/flows/__tests__/contentCreation.test.js`**

```js
const { buildFlowPipeline } = require('../contentCreation');

describe('buildFlowPipeline', () => {
  test('returns ordered agents by position_in_flow', () => {
    const agents = [
      { name: 'formatador', position_in_flow: 3, system_prompt: 'p3' },
      { name: 'pesquisador', position_in_flow: 1, system_prompt: 'p1' },
      { name: 'redator', position_in_flow: 2, system_prompt: 'p2' },
    ];
    const pipeline = buildFlowPipeline(agents);
    expect(pipeline.map((a) => a.name)).toEqual(['pesquisador', 'redator', 'formatador']);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
npx jest src/flows/__tests__/contentCreation.test.js
```

**Step 3: Implement — `src/flows/contentCreation.js`**

```js
const { supabase } = require('../database/supabase');
const { runAgent } = require('../agents/agentRunner');
const { logger } = require('../utils/logger');

function buildFlowPipeline(agents) {
  return [...agents].sort((a, b) => a.position_in_flow - b.position_in_flow);
}

async function runContentFlow(topic, format = 'post_unico') {
  logger.info(`Starting content flow`, { topic, format });

  // 1. Load active agents with position in flow
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('is_active', true)
    .not('position_in_flow', 'is', null)
    .order('position_in_flow');

  if (error) throw new Error(`Failed to load agents: ${error.message}`);
  if (!agents.length) throw new Error('No active agents in pipeline');

  const pipeline = buildFlowPipeline(agents);
  let currentInput = `Tema: ${topic}\nFormato desejado: ${format}`;
  const results = {};

  // 2. Run each agent in sequence, chaining output -> input
  for (const agent of pipeline) {
    logger.info(`Running agent: ${agent.display_name}`);
    const output = await runAgent(agent.system_prompt, currentInput);
    results[agent.name] = output;
    currentInput = output; // output of one becomes input of next
  }

  // 3. Save draft to Supabase
  const { data: draft, error: saveError } = await supabase
    .from('content_drafts')
    .insert({
      topic,
      format,
      research: results.pesquisador ? JSON.parse(results.pesquisador).ideas : null,
      draft: results.redator || null,
      final_content: results.formatador || results.redator || null,
      status: 'completed',
    })
    .select()
    .single();

  if (saveError) logger.error(`Failed to save draft`, { error: saveError.message });

  return {
    draft_id: draft?.id,
    final_content: results[pipeline[pipeline.length - 1].name],
    all_results: results,
  };
}

module.exports = { runContentFlow, buildFlowPipeline };
```

**Step 4: Run test — expect PASS**

```bash
npx jest src/flows/__tests__/contentCreation.test.js
```

**Step 5: Commit**

```bash
git add src/flows/
git commit -m "feat: content creation flow — sequential agent pipeline"
```

---

## Task 6: Telegram Bot + Auth Middleware

**Files:**
- Create: `src/telegram/bot.js`
- Create: `src/telegram/middleware.js`
- Create: `src/telegram/handlers.js`

**Step 1: Create auth middleware — `src/telegram/middleware.js`**

```js
const { logger } = require('../utils/logger');

function isAuthorized(chatId) {
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!allowed) {
    logger.warn('TELEGRAM_ALLOWED_CHAT_ID not set — rejecting all');
    return false;
  }
  return String(chatId) === String(allowed);
}

module.exports = { isAuthorized };
```

**Step 2: Create handlers — `src/telegram/handlers.js`**

```js
const { runContentFlow } = require('../flows/contentCreation');
const { supabase } = require('../database/supabase');
const { runAgent } = require('../agents/agentRunner');
const { logger } = require('../utils/logger');

const EMILY_SYSTEM_PROMPT = `Voce e Emily, COO e orquestradora de uma equipe de agentes de IA que trabalha para Raphael, um gestor de trafego e criador de conteudo especializado em Meta Ads, Google Ads, IA e marketing digital.

Suas responsabilidades:
1. Entender o que Raphael precisa e acionar os subagentes corretos
2. Coordenar o fluxo de trabalho entre agentes
3. Criar novos subagentes quando solicitado, coletando: nome, funcao, tom de voz, instrucoes especificas
4. Reportar resultados de forma clara e objetiva
5. Gerenciar agendamentos e automacoes

Seja direta, profissional e proativa. Quando acionar multiplos agentes, informe o progresso.

IMPORTANTE: Quando o usuario pedir para criar conteudo, responda EXATAMENTE com:
[ACAO:CONTEUDO] tema: <tema extraido> | formato: <formato ou post_unico>

Quando for uma conversa normal, responda normalmente.`;

async function handleStart(bot, msg) {
  await bot.sendMessage(msg.chat.id,
    'Ola! Sou Emily, sua COO virtual.\n\n' +
    'Posso criar conteudo, gerenciar agentes e muito mais.\n\n' +
    'Use /ajuda para ver os comandos disponiveis.'
  );
}

async function handleAgentes(bot, msg) {
  const { data: agents } = await supabase
    .from('agents')
    .select('display_name, role, is_active')
    .order('position_in_flow');

  if (!agents?.length) {
    return bot.sendMessage(msg.chat.id, 'Nenhum agente cadastrado.');
  }

  const list = agents.map((a) =>
    `${a.is_active ? '✅' : '⏸️'} *${a.display_name}* — ${a.role}`
  ).join('\n');

  await bot.sendMessage(msg.chat.id, `*Agentes ativos:*\n\n${list}`, { parse_mode: 'Markdown' });
}

async function handleConteudo(bot, msg, topic) {
  if (!topic) {
    return bot.sendMessage(msg.chat.id, 'Use: /conteudo <tema>\nEx: /conteudo novidades Meta Ads 2025');
  }

  await bot.sendMessage(msg.chat.id, '🔄 Iniciando fluxo de criacao de conteudo...');

  try {
    const result = await runContentFlow(topic);
    const content = result.final_content;

    // Telegram message limit is 4096 chars
    if (content.length > 4000) {
      const chunks = content.match(/.{1,4000}/gs);
      for (const chunk of chunks) {
        await bot.sendMessage(msg.chat.id, chunk);
      }
    } else {
      await bot.sendMessage(msg.chat.id, content);
    }

    await bot.sendMessage(msg.chat.id, `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`);
  } catch (err) {
    logger.error('Content flow failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro no fluxo: ${err.message}`);
  }
}

async function handleAjuda(bot, msg) {
  await bot.sendMessage(msg.chat.id,
    '*Comandos disponiveis:*\n\n' +
    '/start — Apresentacao\n' +
    '/agentes — Lista agentes ativos\n' +
    '/conteudo <tema> — Criar conteudo\n' +
    '/status — Status do sistema\n' +
    '/ajuda — Este menu',
    { parse_mode: 'Markdown' }
  );
}

async function handleStatus(bot, msg) {
  const { count } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { count: drafts } = await supabase.from('content_drafts').select('*', { count: 'exact', head: true });

  await bot.sendMessage(msg.chat.id,
    `*Status do sistema:*\n\n` +
    `🤖 Agentes ativos: ${count || 0}\n` +
    `📝 Conteudos gerados: ${drafts || 0}\n` +
    `✅ Sistema operacional`,
    { parse_mode: 'Markdown' }
  );
}

async function handleFreeMessage(bot, msg) {
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    const response = await runAgent(EMILY_SYSTEM_PROMPT, msg.text);

    // Check if Emily wants to trigger content flow
    const actionMatch = response.match(/\[ACAO:CONTEUDO\]\s*tema:\s*(.+?)\s*\|\s*formato:\s*(.+)/);
    if (actionMatch) {
      const [, tema, formato] = actionMatch;
      await bot.sendMessage(msg.chat.id, `📋 Entendido! Criando conteudo sobre: *${tema.trim()}*`, { parse_mode: 'Markdown' });
      return handleConteudo(bot, msg, tema.trim());
    }

    // Normal Emily response
    await bot.sendMessage(msg.chat.id, response);

    // Save conversation
    await supabase.from('conversations').insert([
      { chat_id: String(msg.chat.id), role: 'user', content: msg.text },
      { chat_id: String(msg.chat.id), role: 'assistant', content: response, agent_name: 'emily' },
    ]);
  } catch (err) {
    logger.error('Emily response failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

module.exports = { handleStart, handleAgentes, handleConteudo, handleAjuda, handleStatus, handleFreeMessage };
```

**Step 3: Create bot setup — `src/telegram/bot.js`**

```js
const TelegramBot = require('node-telegram-bot-api');
const { isAuthorized } = require('./middleware');
const { handleStart, handleAgentes, handleConteudo, handleAjuda, handleStatus, handleFreeMessage } = require('./handlers');
const { logger } = require('../utils/logger');
require('dotenv').config();

function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const bot = new TelegramBot(token, { polling: true });

  // Auth middleware — reject unauthorized users
  bot.on('message', (msg) => {
    if (!isAuthorized(msg.chat.id)) {
      logger.warn(`Unauthorized access attempt`, { chatId: msg.chat.id });
      bot.sendMessage(msg.chat.id, 'Acesso nao autorizado.');
      return;
    }
  });

  // Commands
  bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    handleStart(bot, msg);
  });

  bot.onText(/\/agentes/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    handleAgentes(bot, msg);
  });

  bot.onText(/\/conteudo(?:\s+(.+))?/, (msg, match) => {
    if (!isAuthorized(msg.chat.id)) return;
    handleConteudo(bot, msg, match?.[1]);
  });

  bot.onText(/\/ajuda/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    handleAjuda(bot, msg);
  });

  bot.onText(/\/status/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    handleStatus(bot, msg);
  });

  // Free messages (not commands)
  bot.on('message', (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    if (msg.text?.startsWith('/')) return; // skip commands
    handleFreeMessage(bot, msg);
  });

  logger.info('Telegram bot started (polling mode)');
  return bot;
}

module.exports = { createBot };
```

**Step 4: Commit**

```bash
git add src/telegram/
git commit -m "feat: telegram bot with auth, commands, and Emily handler"
```

---

## Task 7: Express Server + Entry Point

**Files:**
- Modify: `src/index.js`

**Step 1: Implement `src/index.js`**

```js
require('dotenv').config();
const express = require('express');
const { createBot } = require('./telegram/bot');
const { logger } = require('./utils/logger');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start bot
const bot = createBot();

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

**Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: express server + entry point"
```

---

## Task 8: Create `.env` and Manual Integration Test

**Step 1: Create `.env` from `.env.example`**

Copy `.env.example` to `.env` and fill in real values:
- `ANTHROPIC_API_KEY` — from Anthropic console
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_ALLOWED_CHAT_ID` — send a message to the bot, check logs for chat_id
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` — from Supabase dashboard

**Step 2: Run migrations on Supabase**

Execute `src/database/migrations/001_initial_schema.sql` in Supabase SQL editor.

**Step 3: Start the bot**

```bash
npm run dev
```

**Step 4: Test in Telegram**

1. Send `/start` — should get welcome message
2. Send `/agentes` — should list 3 agents
3. Send `/conteudo tendencias IA 2025` — should trigger full pipeline
4. Send `/status` — should show agent/draft counts
5. Send free message like "Oi Emily" — should get Emily response

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: MVP complete — Emily + 3 agents + Telegram integration"
```

---

## Unresolved Questions

1. **Supabase project** — already exists or need to create? What's the project ID/URL?
https://supabase.com/dashboard/project/lpvhhbiofqjgipxovyfd
https://mcp.supabase.com/mcp?project_ref=lpvhhbiofqjgipxovyfd (irei)
Irei configurar o MCP depois
2. **Telegram bot** — already created via @BotFather? Token available?
Sim: 7689056759:AAFzzIpyuYQOQguYYtjCUaCWPi96Q4sjpVo
3. **Anthropic API key** — available? Which plan/rate limits?
Vamos usar o setup-token, tenho o plano Max: sk-ant-oat01-cWpQh5oxEkz1y3C6ARGmYGsMBfHRG1O9L7_tTJf9_ev9AMTAo2NfebyofO6383ukxsjDgqDrdiQ-KaVviRGYyA-vguj
iAAA
4. **Hosting** — Railway, Fly.io, or local for now? (affects webhook vs polling)
Por enquanto Localhost, depois iremos configurar uma VPS da hostinger
5. **Serper API** — needed for MVP or skip web search for now (Pesquisador uses Claude's knowledge only)?
Vamos usar a API do Brave Search API, só garanta que nao usemos muito a ponto de estourar o free tier: BSALkZG6DGvowMlrEmRjKYy8m6GqvLV
6. **Format default** — `post_unico` as default when user doesn't specify? Or always ask?
pode ser post_unico como padrao

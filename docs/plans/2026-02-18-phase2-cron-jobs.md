# Phase 2 — Cron Jobs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scheduled content creation via Telegram — Emily sets up cron jobs, they fire automatically, present research options to user, then write on chosen topic.

**Architecture:** Split `runContentFlow` into `runResearch` + `runContentFromResearch`. `cronManager` loads schedules from Supabase on boot and registers node-cron instances. When cron fires, sends research options to Telegram and sets `pendingCronFlow` state. Next free message from user is treated as the pauta choice.

**Tech Stack:** node-cron, node-telegram-bot-api, @supabase/supabase-js, jest

---

## Task 1: Install node-cron + apply DB migration

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/database/migrations/002_schedules.sql`

**Step 1: Install node-cron**

```bash
cd /Users/charbellelopes/emilybot && npm install node-cron
```

Expected: `node-cron` appears in `package.json` dependencies.

**Step 2: Create migration file**

Create `src/database/migrations/002_schedules.sql`:

```sql
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  format TEXT DEFAULT 'post_unico',
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 3: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `create_schedules_table` and the SQL above.

**Step 4: Verify table exists**

Use `mcp__supabase__execute_sql` with `SELECT column_name FROM information_schema.columns WHERE table_name = 'schedules' ORDER BY ordinal_position;`

Expected: columns id, name, cron_expression, timezone, topics, format, is_active, last_run, created_at.

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/database/migrations/002_schedules.sql package.json package-lock.json && git commit -m "feat: install node-cron, add schedules table migration"
```

---

## Task 2: Split contentCreation.js into runResearch + runContentFromResearch

**Files:**
- Modify: `src/flows/contentCreation.js`
- Modify: `src/flows/__tests__/contentCreation.test.js`

**Step 1: Write failing tests**

Add to `src/flows/__tests__/contentCreation.test.js`:

```js
const { runAgent } = require('../../agents/agentRunner');
const { supabase } = require('../../database/supabase');

describe('runResearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls only the pesquisador agent and returns researchText + pipeline', async () => {
    const mockAgents = [
      { id: '1', name: 'pesquisador', display_name: 'Pesquisador', system_prompt: 'sp1', position_in_flow: 1, is_active: true },
      { id: '2', name: 'redator', display_name: 'Redator', system_prompt: 'sp2', position_in_flow: 2, is_active: true },
      { id: '3', name: 'formatador', display_name: 'Formatador', system_prompt: 'sp3', position_in_flow: 3, is_active: true },
    ];

    supabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockAgents, error: null }),
    });

    runAgent.mockResolvedValue('1. Ideia A\n2. Ideia B\n3. Ideia C');

    const { runResearch } = require('../contentCreation');
    const result = await runResearch('IA');

    expect(runAgent).toHaveBeenCalledTimes(1); // only pesquisador
    expect(runAgent).toHaveBeenCalledWith('sp1', expect.stringContaining('IA'));
    expect(result.researchText).toBe('1. Ideia A\n2. Ideia B\n3. Ideia C');
    expect(result.remainingAgents).toHaveLength(2); // redator + formatador
  });
});

describe('runContentFromResearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('runs remaining agents and saves draft', async () => {
    const remainingAgents = [
      { id: '2', name: 'redator', display_name: 'Redator', system_prompt: 'sp2', position_in_flow: 2 },
      { id: '3', name: 'formatador', display_name: 'Formatador', system_prompt: 'sp3', position_in_flow: 3 },
    ];

    const mockDraft = { id: 'draft-123' };
    supabase.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockDraft, error: null }),
    });

    runAgent
      .mockResolvedValueOnce('texto do redator')
      .mockResolvedValueOnce('conteudo final formatado');

    const { runContentFromResearch } = require('../contentCreation');
    const result = await runContentFromResearch(
      'pesquisa texto aqui',
      'Ideia A sobre IA',
      'post_unico',
      remainingAgents
    );

    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(result.final_content).toBe('conteudo final formatado');
    expect(result.draft_id).toBe('draft-123');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/charbellelopes/emilybot && npm test -- --testPathPattern=contentCreation 2>&1 | tail -30
```

Expected: FAIL — `runResearch` and `runContentFromResearch` not exported yet.

**Step 3: Implement the split in contentCreation.js**

Replace the entire file with:

```js
const axios = require('axios');
const { supabase } = require('../database/supabase');
const { runAgent } = require('../agents/agentRunner');
const { logger } = require('../utils/logger');

function buildFlowPipeline(agents) {
  return [...agents].sort((a, b) => a.position_in_flow - b.position_in_flow);
}

function extractJsonFromText(text) {
  try {
    return JSON.parse(text.trim());
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

async function searchBrave(topic) {
  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key) {
    logger.warn('BRAVE_SEARCH_KEY not set — skipping web search');
    return null;
  }

  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      params: { q: topic, count: 5 },
      headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' },
      timeout: 8000,
    });

    const results = response.data?.web?.results || [];
    return results.map((r) => `- ${r.title}: ${r.description || r.url}`).join('\n');
  } catch (err) {
    logger.warn('Brave Search failed', { error: err.message });
    return null;
  }
}

async function loadPipeline() {
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .eq('is_active', true)
    .not('position_in_flow', 'is', null)
    .order('position_in_flow');

  if (error) throw new Error(`Failed to load agents: ${error.message}`);
  if (!agents || !agents.length) throw new Error('No active agents in pipeline');
  return buildFlowPipeline(agents);
}

// Runs only the pesquisador (first agent). Returns research text + remaining agents.
async function runResearch(topics) {
  logger.info('Running research phase', { topics });

  const pipeline = await loadPipeline();
  const [researcher, ...remainingAgents] = pipeline;

  const searchResults = await searchBrave(topics);
  const searchContext = searchResults
    ? `\n\nContexto de tendencias atual (pesquisa web):\n${searchResults}`
    : '';

  const input = `Tema: ${topics}${searchContext}`;
  const researchText = await runAgent(researcher.system_prompt, input);

  return { researchText, remainingAgents };
}

// Runs redator + formatador on a chosen idea. Saves draft. Returns { draft_id, final_content }.
async function runContentFromResearch(researchText, chosenIdea, format, remainingAgents) {
  logger.info('Running content from research', { chosenIdea, format });

  let currentInput = `Ideia escolhida: ${chosenIdea}\n\nContexto de pesquisa:\n${researchText}\n\nFormato desejado: ${format}`;
  const results = {};

  for (const agent of remainingAgents) {
    logger.info(`Running agent: ${agent.display_name}`);
    const output = await runAgent(agent.system_prompt, currentInput);
    results[agent.name] = output;
    currentInput = output;
  }

  const finalContent = results[remainingAgents[remainingAgents.length - 1]?.name] || '';

  const { data: draft, error: saveError } = await supabase
    .from('content_drafts')
    .insert({
      topic: chosenIdea,
      format,
      draft: results.redator || null,
      final_content: finalContent,
      status: 'completed',
    })
    .select()
    .single();

  if (saveError) logger.error('Failed to save draft', { error: saveError.message });

  return { draft_id: draft?.id, final_content: finalContent };
}

// Full pipeline (used by /conteudo command). Kept for backwards compatibility.
async function runContentFlow(topic, format = 'post_unico') {
  logger.info('Starting content flow', { topic, format });

  const { researchText, remainingAgents } = await runResearch(topic);
  const researchParsed = extractJsonFromText(researchText);

  // Save research + run rest of pipeline
  const { draft_id, final_content } = await runContentFromResearch(
    researchText,
    researchParsed?.ideas?.[0]?.title || topic,
    format,
    remainingAgents
  );

  return { draft_id, final_content, all_results: { pesquisador: researchText } };
}

module.exports = {
  runContentFlow,
  runResearch,
  runContentFromResearch,
  buildFlowPipeline,
  extractJsonFromText,
};
```

**Step 4: Run tests**

```bash
cd /Users/charbellelopes/emilybot && npm test -- --testPathPattern=contentCreation 2>&1 | tail -30
```

Expected: all tests PASS (existing + new).

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/flows/contentCreation.js src/flows/__tests__/contentCreation.test.js && git commit -m "feat: split runContentFlow into runResearch + runContentFromResearch"
```

---

## Task 3: Create cronManager.js

**Files:**
- Create: `src/scheduler/cronManager.js`
- Create: `src/scheduler/__tests__/cronManager.test.js`

**Step 1: Write failing tests**

Create `src/scheduler/__tests__/cronManager.test.js`:

```js
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
}));
jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('../../flows/contentCreation', () => ({
  runResearch: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const cron = require('node-cron');
const { supabase } = require('../../database/supabase');

describe('cronManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('init loads active schedules and registers crons', async () => {
    const mockSchedules = [
      { id: 'abc', name: 'Daily', cron_expression: '0 8 * * *', timezone: 'America/Sao_Paulo', topics: ['IA'], format: 'post_unico', is_active: true },
    ];

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: mockSchedules, error: null }),
    });

    const cronManager = require('../cronManager');
    const onReady = jest.fn();
    await cronManager.init({}, '123', onReady);

    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule).toHaveBeenCalledWith(
      '0 8 * * *',
      expect.any(Function),
      { timezone: 'America/Sao_Paulo' }
    );
  });

  test('pause stops cron and marks inactive in DB', async () => {
    const mockUpdate = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ update: mockUpdate, eq: mockEq });

    // Re-require after setting up a fake activeCrons entry
    const cronManager = require('../cronManager');
    // Register a fake cron manually
    const fakeTask = { stop: jest.fn() };
    cronManager._activeCrons.set('abc', fakeTask);

    await cronManager.pause('abc');

    expect(fakeTask.stop).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    expect(mockEq).toHaveBeenCalledWith('id', 'abc');
    expect(cronManager._activeCrons.has('abc')).toBe(false);
  });

  test('createSchedule inserts into DB and registers cron', async () => {
    const newSchedule = { id: 'new-id', name: 'Test', cron_expression: '0 9 * * 1', timezone: 'America/Sao_Paulo', topics: ['Meta Ads'], format: 'carrossel', is_active: true };

    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: newSchedule, error: null }),
    });

    const cronManager = require('../cronManager');
    const onReady = jest.fn();
    cronManager._setOnReady(onReady);

    const result = await cronManager.createSchedule({}, '123', {
      name: 'Test',
      cron_expression: '0 9 * * 1',
      topics: ['Meta Ads'],
      format: 'carrossel',
    });

    expect(result.id).toBe('new-id');
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * 1', expect.any(Function), { timezone: 'America/Sao_Paulo' });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/charbellelopes/emilybot && npm test -- --testPathPattern=cronManager 2>&1 | tail -20
```

Expected: FAIL — module not found.

**Step 3: Create src/scheduler/cronManager.js**

```js
const cron = require('node-cron');
const { supabase } = require('../database/supabase');
const { runResearch } = require('../flows/contentCreation');
const { logger } = require('../utils/logger');

const _activeCrons = new Map(); // scheduleId -> cron task instance
let _onReady = null; // callback(bot, chatId, schedule, researchText, remainingAgents)

function _setOnReady(fn) {
  _onReady = fn;
}

function _registerCron(bot, chatId, schedule) {
  const task = cron.schedule(
    schedule.cron_expression,
    async () => {
      logger.info('Cron fired', { name: schedule.name });
      try {
        const topics = (schedule.topics || []).join(', ') || 'IA e marketing digital';
        const { researchText, remainingAgents } = await runResearch(topics);

        if (_onReady) {
          await _onReady(bot, chatId, schedule, researchText, remainingAgents);
        }

        await supabase
          .from('schedules')
          .update({ last_run: new Date().toISOString() })
          .eq('id', schedule.id);
      } catch (err) {
        logger.error('Cron job failed', { name: schedule.name, error: err.message });
      }
    },
    { timezone: schedule.timezone || 'America/Sao_Paulo' }
  );

  _activeCrons.set(schedule.id, task);
  logger.info('Cron registered', { name: schedule.name, expression: schedule.cron_expression });
}

async function init(bot, chatId, onReady) {
  _onReady = onReady;

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Failed to load schedules', { error: error.message });
    return;
  }

  for (const schedule of schedules || []) {
    _registerCron(bot, chatId, schedule);
  }

  logger.info('CronManager initialized', { count: (schedules || []).length });
}

async function pause(id) {
  const task = _activeCrons.get(id);
  if (task) {
    task.stop();
    _activeCrons.delete(id);
  }

  await supabase.from('schedules').update({ is_active: false }).eq('id', id);
  logger.info('Cron paused', { id });
}

async function createSchedule(bot, chatId, scheduleData) {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      name: scheduleData.name,
      cron_expression: scheduleData.cron_expression,
      timezone: scheduleData.timezone || 'America/Sao_Paulo',
      topics: scheduleData.topics || [],
      format: scheduleData.format || 'post_unico',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);

  _registerCron(bot, chatId, data);
  return data;
}

async function list() {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('created_at');

  if (error) throw new Error(`Failed to list schedules: ${error.message}`);
  return data || [];
}

module.exports = { init, pause, createSchedule, list, _activeCrons, _setOnReady };
```

**Step 4: Run tests**

```bash
cd /Users/charbellelopes/emilybot && npm test -- --testPathPattern=cronManager 2>&1 | tail -20
```

Expected: all PASS.

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/scheduler/ && git commit -m "feat: cronManager — load, register, pause, create schedules"
```

---

## Task 4: Update handlers.js — scheduling intent + pendingCronFlow

**Files:**
- Modify: `src/telegram/handlers.js`

**Step 1: Replace handlers.js with the updated version**

Replace the entire file content:

```js
const { runContentFlow, runContentFromResearch } = require('../flows/contentCreation');
const { supabase } = require('../database/supabase');
const { runAgent } = require('../agents/agentRunner');
const { logger } = require('../utils/logger');
const cronManager = require('../scheduler/cronManager');

// In-memory state for interactive cron flows
let pendingCronFlow = null;
// { schedule, researchText, remainingAgents, options: string[] }

const EMILY_SYSTEM_PROMPT = `Voce e Emily, COO e orquestradora de uma equipe de agentes de IA que trabalha para Raphael, um gestor de trafego e criador de conteudo especializado em Meta Ads, Google Ads, IA e marketing digital.

Suas responsabilidades:
1. Entender o que Raphael precisa e acionar os subagentes corretos
2. Coordenar o fluxo de trabalho entre agentes
3. Criar novos subagentes quando solicitado, coletando: nome, funcao, tom de voz, instrucoes especificas
4. Reportar resultados de forma clara e objetiva
5. Gerenciar agendamentos e automacoes

Seja direta, profissional e proativa. Quando acionar multiplos agentes, informe o progresso.

IMPORTANTE — quando o usuario pedir para criar CONTEUDO, responda EXATAMENTE com:
[ACAO:CONTEUDO] tema: <tema extraido> | formato: <formato ou post_unico>

IMPORTANTE — quando o usuario pedir para AGENDAR criacao de conteudo, colete as informacoes e responda EXATAMENTE com:
[ACAO:AGENDAR] nome: <nome do agendamento> | cron: "<expressao cron>" | topics: "<tema1,tema2>" | format: <formato>

Expressoes cron comuns:
- Todo dia as 8h: "0 8 * * *"
- Seg e Qui as 9h: "0 9 * * 1,4"
- A cada 6h: "0 */6 * * *"
- Dias uteis as 7h: "0 7 * * 1-5"

Se o usuario nao especificar topics, use "IA,Meta Ads,marketing digital". Se nao especificar formato, use "post_unico".

Quando for uma conversa normal, responda normalmente como Emily, em portugues.`;

function parseResearchOptions(researchText) {
  // Extract numbered items: "1. ...", "2. ...", etc.
  const lines = researchText.split('\n');
  const options = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)/);
    if (match && match[1].trim().length > 10) {
      options.push(match[1].trim());
    }
  }
  // Fallback: return first 3 non-empty lines if no numbered items found
  if (!options.length) {
    return lines.filter((l) => l.trim().length > 20).slice(0, 3);
  }
  return options.slice(0, 5); // max 5 options
}

async function handleStart(bot, msg) {
  await bot.sendMessage(
    msg.chat.id,
    'Ola! Sou Emily, sua COO virtual.\n\n' +
    'Posso criar conteudo, gerenciar agentes, agendar tarefas e muito mais.\n\n' +
    'Use /ajuda para ver os comandos disponiveis.'
  );
}

async function handleAgentes(bot, msg) {
  const { data: agents } = await supabase
    .from('agents')
    .select('display_name, role, is_active, position_in_flow')
    .order('position_in_flow');

  if (!agents?.length) {
    return bot.sendMessage(msg.chat.id, 'Nenhum agente cadastrado.');
  }

  const list = agents
    .map((a) => `${a.is_active ? '✅' : '⏸️'} *${a.display_name}* — ${a.role}`)
    .join('\n');

  await bot.sendMessage(msg.chat.id, `*Agentes no pipeline:*\n\n${list}`, {
    parse_mode: 'Markdown',
  });
}

async function handleConteudo(bot, msg, topic, format = 'post_unico') {
  if (!topic) {
    return bot.sendMessage(
      msg.chat.id,
      'Use: /conteudo <tema>\nEx: /conteudo novidades Meta Ads 2025'
    );
  }

  await bot.sendMessage(msg.chat.id, '🔄 Iniciando fluxo de criacao de conteudo...');

  try {
    const result = await runContentFlow(topic, format);
    const content = result.final_content || 'Conteudo nao gerado';

    const chunks = content.match(/.{1,4000}/gs) || [content];
    for (const chunk of chunks) {
      await bot.sendMessage(msg.chat.id, chunk);
    }

    await bot.sendMessage(
      msg.chat.id,
      `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`
    );
  } catch (err) {
    logger.error('Content flow failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro no fluxo: ${err.message}`);
  }
}

async function handleAgendamentos(bot, msg) {
  try {
    const schedules = await cronManager.list();

    if (!schedules.length) {
      return bot.sendMessage(msg.chat.id, 'Nenhum agendamento cadastrado.');
    }

    const list = schedules
      .map(
        (s) =>
          `${s.is_active ? '✅' : '⏸️'} *${s.name}*\n` +
          `   Cron: \`${s.cron_expression}\`\n` +
          `   Temas: ${(s.topics || []).join(', ') || 'automatico'}\n` +
          `   Formato: ${s.format}\n` +
          `   ID: \`${s.id}\``
      )
      .join('\n\n');

    await bot.sendMessage(msg.chat.id, `*Agendamentos:*\n\n${list}`, {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.error('List schedules failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

async function handlePausar(bot, msg, scheduleId) {
  if (!scheduleId) {
    return bot.sendMessage(
      msg.chat.id,
      'Use: /pausar <id>\nVeja os IDs com /agendamentos'
    );
  }

  try {
    await cronManager.pause(scheduleId);
    await bot.sendMessage(msg.chat.id, `⏸️ Agendamento \`${scheduleId}\` pausado.`, {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.error('Pause schedule failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

async function handleAjuda(bot, msg) {
  await bot.sendMessage(
    msg.chat.id,
    '*Comandos disponiveis:*\n\n' +
    '/start — Apresentacao\n' +
    '/agentes — Lista agentes ativos\n' +
    '/conteudo <tema> — Criar conteudo\n' +
    '/agendamentos — Lista cron jobs\n' +
    '/pausar <id> — Pausa um agendamento\n' +
    '/status — Status do sistema\n' +
    '/ajuda — Este menu',
    { parse_mode: 'Markdown' }
  );
}

async function handleStatus(bot, msg) {
  const [{ count: agentCount }, { count: draftCount }, { count: scheduleCount }] =
    await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('content_drafts').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

  await bot.sendMessage(
    msg.chat.id,
    `*Status do sistema:*\n\n` +
    `🤖 Agentes ativos: ${agentCount || 0}\n` +
    `📝 Conteudos gerados: ${draftCount || 0}\n` +
    `⏰ Agendamentos ativos: ${scheduleCount || 0}\n` +
    `✅ Sistema operacional`,
    { parse_mode: 'Markdown' }
  );
}

// Called by cronManager when research is ready — presents options to user
async function onCronResearchReady(bot, chatId, schedule, researchText, remainingAgents) {
  const options = parseResearchOptions(researchText);

  pendingCronFlow = { schedule, researchText, remainingAgents, options };

  if (!options.length) {
    // No parseable options — send full research and ask user to describe choice
    await bot.sendMessage(
      chatId,
      `🔔 *${schedule.name}* — Pesquisa pronta:\n\n${researchText.slice(0, 1500)}\n\nQual pauta voce quer? Descreva brevemente.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
  await bot.sendMessage(
    chatId,
    `🔔 *${schedule.name}* — Pautas de hoje:\n\n${optionsList}\n\nQual voce quer? (responda o numero)`,
    { parse_mode: 'Markdown' }
  );
}

async function handleFreeMessage(bot, msg) {
  // Intercept if waiting for pauta choice from a cron flow
  if (pendingCronFlow) {
    const text = msg.text.trim();
    const choiceNum = parseInt(text, 10);
    const { schedule, researchText, remainingAgents, options } = pendingCronFlow;

    let chosenIdea;
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= options.length) {
      chosenIdea = options[choiceNum - 1];
    } else if (text.length > 5) {
      // User typed a custom idea / described what they want
      chosenIdea = text;
    } else {
      await bot.sendMessage(msg.chat.id, `Escolha invalida. Responda com um numero de 1 a ${options.length}.`);
      return;
    }

    pendingCronFlow = null;
    await bot.sendMessage(msg.chat.id, `✅ Pauta selecionada! Escrevendo conteudo...`);

    try {
      const result = await runContentFromResearch(researchText, chosenIdea, schedule.format, remainingAgents);
      const content = result.final_content || 'Conteudo nao gerado';
      const chunks = content.match(/.{1,4000}/gs) || [content];
      for (const chunk of chunks) {
        await bot.sendMessage(msg.chat.id, chunk);
      }
      await bot.sendMessage(msg.chat.id, `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`);
    } catch (err) {
      logger.error('Content from research failed', { error: err.message });
      await bot.sendMessage(msg.chat.id, `❌ Erro ao escrever conteudo: ${err.message}`);
    }
    return;
  }

  // Normal Emily flow
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    const response = await runAgent(
      EMILY_SYSTEM_PROMPT,
      msg.text,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 2048 }
    );

    // Detect content creation intent
    const contentMatch = response.match(
      /\[ACAO:CONTEUDO\]\s*tema:\s*(.+?)\s*\|\s*formato:\s*(.+)/
    );
    if (contentMatch) {
      const [, tema, formato] = contentMatch;
      await bot.sendMessage(
        msg.chat.id,
        `📋 Entendido! Criando conteudo sobre: *${tema.trim()}*`,
        { parse_mode: 'Markdown' }
      );
      return handleConteudo(bot, msg, tema.trim(), formato.trim());
    }

    // Detect scheduling intent
    const scheduleMatch = response.match(
      /\[ACAO:AGENDAR\]\s*nome:\s*(.+?)\s*\|\s*cron:\s*"(.+?)"\s*\|\s*topics:\s*"(.+?)"\s*\|\s*format:\s*(.+)/
    );
    if (scheduleMatch) {
      const [, nome, cronExpr, topicsStr, format] = scheduleMatch;
      const topics = topicsStr.split(',').map((t) => t.trim()).filter(Boolean);

      await bot.sendMessage(msg.chat.id, `⏰ Criando agendamento *${nome.trim()}*...`, {
        parse_mode: 'Markdown',
      });

      try {
        const schedule = await cronManager.createSchedule(bot, String(msg.chat.id), {
          name: nome.trim(),
          cron_expression: cronExpr.trim(),
          topics,
          format: format.trim(),
        });

        await bot.sendMessage(
          msg.chat.id,
          `✅ Agendamento *${schedule.name}* criado!\n` +
          `⏰ Expressao: \`${schedule.cron_expression}\`\n` +
          `📌 Temas: ${topics.join(', ')}\n` +
          `📄 Formato: ${schedule.format}\n\n` +
          `Use /agendamentos para ver todos.`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        logger.error('Create schedule failed', { error: err.message });
        await bot.sendMessage(msg.chat.id, `❌ Erro ao criar agendamento: ${err.message}`);
      }
      return;
    }

    await bot.sendMessage(msg.chat.id, response);

    supabase.from('conversations').insert([
      { chat_id: String(msg.chat.id), role: 'user', content: msg.text },
      { chat_id: String(msg.chat.id), role: 'assistant', content: response, agent_name: 'emily' },
    ]).then(({ error }) => {
      if (error) logger.error('Failed to save conversation', { error: error.message });
    });
  } catch (err) {
    logger.error('Emily response failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

module.exports = {
  handleStart,
  handleAgentes,
  handleConteudo,
  handleAgendamentos,
  handlePausar,
  handleAjuda,
  handleStatus,
  handleFreeMessage,
  onCronResearchReady,
  _setPendingCronFlow: (v) => { pendingCronFlow = v; }, // for testing
};
```

**Step 2: Run all tests to verify nothing broken**

```bash
cd /Users/charbellelopes/emilybot && npm test 2>&1 | tail -20
```

Expected: all existing tests PASS.

**Step 3: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/handlers.js && git commit -m "feat: scheduling intent detection, pendingCronFlow, /agendamentos and /pausar handlers"
```

---

## Task 5: Wire up bot.js + index.js

**Files:**
- Modify: `src/telegram/bot.js`
- Modify: `src/index.js`

**Step 1: Update bot.js — add new command routes**

Replace the entire `bot.js` file:

```js
const TelegramBot = require('node-telegram-bot-api');
const { isAuthorized } = require('./middleware');
const {
  handleStart,
  handleAgentes,
  handleConteudo,
  handleAgendamentos,
  handlePausar,
  handleAjuda,
  handleStatus,
  handleFreeMessage,
} = require('./handlers');
const { logger } = require('../utils/logger');
require('dotenv').config();

function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const bot = new TelegramBot(token, { polling: true });

  function guard(chatId) {
    if (!isAuthorized(chatId)) {
      logger.warn('Unauthorized access attempt', { chatId });
      bot.sendMessage(chatId, 'Acesso nao autorizado.');
      return false;
    }
    return true;
  }

  bot.onText(/\/start/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStart(bot, msg);
  });

  bot.onText(/\/agentes/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgentes(bot, msg);
  });

  bot.onText(/\/conteudo(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handleConteudo(bot, msg, match?.[1]?.trim());
  });

  bot.onText(/\/agendamentos/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAgendamentos(bot, msg);
  });

  bot.onText(/\/pausar(?:\s+(.+))?/, (msg, match) => {
    if (!guard(msg.chat.id)) return;
    handlePausar(bot, msg, match?.[1]?.trim());
  });

  bot.onText(/\/ajuda/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleAjuda(bot, msg);
  });

  bot.onText(/\/status/, (msg) => {
    if (!guard(msg.chat.id)) return;
    handleStatus(bot, msg);
  });

  // Free messages — skip commands
  bot.on('message', (msg) => {
    if (!guard(msg.chat.id)) return;
    if (!msg.text || msg.text.startsWith('/')) return;
    handleFreeMessage(bot, msg);
  });

  bot.on('polling_error', (err) => {
    logger.error('Telegram polling error', { error: err.message });
  });

  logger.info('Telegram bot started (polling mode)');
  return bot;
}

module.exports = { createBot };
```

**Step 2: Update index.js — init cronManager on boot**

Replace the entire `index.js` file:

```js
require('dotenv').config();
const express = require('express');
const { createBot } = require('./telegram/bot');
const { logger } = require('./utils/logger');
const cronManager = require('./scheduler/cronManager');
const { onCronResearchReady } = require('./telegram/handlers');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const bot = createBot();

// Init cron jobs — load from DB and register
const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
if (chatId) {
  cronManager.init(bot, chatId, onCronResearchReady).catch((err) => {
    logger.error('CronManager init failed', { error: err.message });
  });
} else {
  logger.warn('TELEGRAM_ALLOWED_CHAT_ID not set — cron notifications disabled');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

**Step 3: Run full test suite**

```bash
cd /Users/charbellelopes/emilybot && npm test 2>&1 | tail -20
```

Expected: all tests PASS.

**Step 4: Smoke test — start the bot and verify it boots without errors**

```bash
cd /Users/charbellelopes/emilybot && timeout 5 npm start 2>&1 | head -20 || true
```

Expected: logs show "Telegram bot started", "Server running on port 3000", "CronManager initialized".

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/bot.js src/index.js && git commit -m "feat: wire up /agendamentos, /pausar commands and cronManager boot in index.js"
```

---

## Done ✅

Phase 2 Cron Jobs implemented:
- `schedules` table in Supabase
- `cronManager` loads + registers crons on boot
- Emily detects scheduling intent via `[ACAO:AGENDAR]` and creates crons via Telegram
- Crons fire → pesquisador runs → options sent to Telegram → user picks → content written
- `/agendamentos` lists all scheduled jobs
- `/pausar <id>` pauses a job

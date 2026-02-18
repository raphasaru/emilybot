# Dynamic Agent Creation (Phase 3) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create new AI agents via Telegram conversation, with Emily auto-generating the system prompt and optionally inserting the agent into the content pipeline.

**Architecture:** A `pendingAgentFlow` state machine (same pattern as `pendingCronFlow`) intercepts free messages during 4-step onboarding. `agentFactory.js` handles Supabase CRUD. Emily detects creation intent via `[ACAO:CRIAR_AGENTE]` tag or `/criar_agente` command.

**Tech Stack:** Node.js (CommonJS), Supabase, Gemini via agentRunner, node-telegram-bot-api, jest

---

### Task 1: Create `agentFactory.js`

**Files:**
- Create: `src/agents/agentFactory.js`
- Create: `src/agents/__tests__/agentFactory.test.js`

**Step 1: Write the failing test**

Create `src/agents/__tests__/agentFactory.test.js`:

```js
'use strict';

jest.mock('../../database/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('../../database/supabase');
const { createAgent, deactivateAgent, getNextPosition } = require('../agentFactory');

describe('agentFactory', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createAgent', () => {
    it('inserts agent and returns row', async () => {
      const fakeAgent = { id: 'uuid-1', name: 'revisor', display_name: 'Revisor' };
      const single = jest.fn().mockResolvedValue({ data: fakeAgent, error: null });
      const select = jest.fn().mockReturnValue({ single });
      const insert = jest.fn().mockReturnValue({ select });
      supabase.from.mockReturnValue({ insert });

      const result = await createAgent({
        name: 'revisor',
        display_name: 'Revisor',
        role: 'Revisar conteudo',
        system_prompt: 'Voce e um revisor.',
        position_in_flow: null,
      });

      expect(supabase.from).toHaveBeenCalledWith('agents');
      expect(result).toEqual(fakeAgent);
    });

    it('throws on supabase error', async () => {
      const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
      const select = jest.fn().mockReturnValue({ single });
      const insert = jest.fn().mockReturnValue({ select });
      supabase.from.mockReturnValue({ insert });

      await expect(createAgent({ name: 'x', display_name: 'X', role: 'y', system_prompt: 'z' }))
        .rejects.toThrow('db error');
    });
  });

  describe('deactivateAgent', () => {
    it('sets is_active false', async () => {
      const eq = jest.fn().mockResolvedValue({ error: null });
      const update = jest.fn().mockReturnValue({ eq });
      supabase.from.mockReturnValue({ update });

      await deactivateAgent('uuid-1');

      expect(update).toHaveBeenCalledWith({ is_active: false, position_in_flow: null });
      expect(eq).toHaveBeenCalledWith('id', 'uuid-1');
    });
  });

  describe('getNextPosition', () => {
    it('returns max position + 1', async () => {
      const single = jest.fn().mockResolvedValue({ data: { position_in_flow: 3 }, error: null });
      const order = jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ single }) });
      const not = jest.fn().mockReturnValue({ order });
      const select = jest.fn().mockReturnValue({ not });
      supabase.from.mockReturnValue({ select });

      const pos = await getNextPosition();
      expect(pos).toBe(4);
    });

    it('returns 1 when no agents', async () => {
      const single = jest.fn().mockResolvedValue({ data: null, error: null });
      const order = jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ single }) });
      const not = jest.fn().mockReturnValue({ order });
      const select = jest.fn().mockReturnValue({ not });
      supabase.from.mockReturnValue({ select });

      const pos = await getNextPosition();
      expect(pos).toBe(1);
    });
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd /Users/charbellelopes/emilybot && npx jest src/agents/__tests__/agentFactory.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '../agentFactory'"

**Step 3: Implement `src/agents/agentFactory.js`**

```js
'use strict';

const { supabase } = require('../database/supabase');

async function createAgent({ name, display_name, role, system_prompt, position_in_flow = null }) {
  const { data, error } = await supabase
    .from('agents')
    .insert({ name, display_name, role, system_prompt, position_in_flow, is_active: true })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function deactivateAgent(id) {
  const { error } = await supabase
    .from('agents')
    .update({ is_active: false, position_in_flow: null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

async function getNextPosition() {
  const { data } = await supabase
    .from('agents')
    .select('position_in_flow')
    .not('position_in_flow', 'is', null)
    .order('position_in_flow', { ascending: false })
    .limit(1)
    .single();

  return data ? data.position_in_flow + 1 : 1;
}

module.exports = { createAgent, deactivateAgent, getNextPosition };
```

**Step 4: Run to verify it passes**

```bash
cd /Users/charbellelopes/emilybot && npx jest src/agents/__tests__/agentFactory.test.js --no-coverage 2>&1 | tail -20
```

Expected: PASS — 5 tests

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/agents/agentFactory.js src/agents/__tests__/agentFactory.test.js && git commit -m "feat: agentFactory — create/deactivate/getNextPosition"
```

---

### Task 2: Add `[ACAO:CRIAR_AGENTE]` to Emily's system prompt

**Files:**
- Modify: `src/telegram/handlers.js` — `EMILY_SYSTEM_PROMPT` constant (lines ~11–36)

**Step 1: Update the system prompt**

In `EMILY_SYSTEM_PROMPT`, append after the `[ACAO:AGENDAR]` block:

```
IMPORTANTE — quando o usuario pedir para CRIAR um novo agente ou subagente, responda EXATAMENTE com:
[ACAO:CRIAR_AGENTE]

Exemplos de pedidos que ativam isso: "cria um agente", "quero um novo agente", "adiciona um agente revisor", "criar subagente".
```

**Step 2: No test needed** (Emily's prompt is integration-level; tag detection is tested in Task 3)

**Step 3: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/handlers.js && git commit -m "feat: Emily detects [ACAO:CRIAR_AGENTE] intent"
```

---

### Task 3: Add `pendingAgentFlow` state machine to `handlers.js`

**Files:**
- Modify: `src/telegram/handlers.js`

This task adds the full onboarding logic. No isolated unit test — covered by integration behavior. Add all new code before the `handleFreeMessage` function.

**Step 1: Add state variable** (after `let pendingCronFlow = null;` on line 8):

```js
// { step: 'nome'|'funcao'|'instrucoes'|'pipeline', data: {} }
let pendingAgentFlow = null;
```

**Step 2: Add helper to generate system prompt via Gemini**

Add after the `pendingAgentFlow` declaration:

```js
async function generateAgentSystemPrompt(displayName, role, instructions) {
  const prompt = `Voce e um especialista em criacao de instrucoes para agentes de IA.

Crie um system prompt profissional e completo para um agente com as seguintes caracteristicas:
- Nome: ${displayName}
- Funcao: ${role}
- Instrucoes especificas: ${instructions || 'Nenhuma instrucao adicional'}

O system prompt deve:
1. Definir claramente o papel e missao do agente
2. Especificar o tom e estilo de resposta
3. Listar as responsabilidades principais
4. Ser escrito em portugues

Retorne APENAS o system prompt, sem explicacoes adicionais.`;

  return runAgent(prompt, 'Gere o system prompt agora.', { model: 'sonnet', maxTokens: 1024 });
}
```

**Step 3: Add `startAgentOnboarding` function**

```js
async function startAgentOnboarding(bot, chatId) {
  pendingAgentFlow = { step: 'nome', data: {} };
  await bot.sendMessage(chatId, 'Otimo! Vou criar um novo agente. Como ele se chama?');
}
```

**Step 4: Add `handleAgentOnboardingStep` function**

```js
async function handleAgentOnboardingStep(bot, msg) {
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const { step, data } = pendingAgentFlow;

  if (step === 'nome') {
    data.display_name = text;
    data.name = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    pendingAgentFlow.step = 'funcao';
    await bot.sendMessage(chatId, `Perfeito! Qual e a funcao principal do ${data.display_name}?\n\nDescreva o que ele deve fazer.`);
    return;
  }

  if (step === 'funcao') {
    data.role = text;
    pendingAgentFlow.step = 'instrucoes';
    await bot.sendMessage(chatId, 'Tem alguma instrucao especifica ou estilo que ele deve seguir?\n\n(Responda "nenhuma" para pular)');
    return;
  }

  if (step === 'instrucoes') {
    data.instructions = text.toLowerCase() === 'nenhuma' ? '' : text;
    pendingAgentFlow.step = 'pipeline';

    const { data: agents } = await supabase
      .from('agents')
      .select('display_name, position_in_flow')
      .eq('is_active', true)
      .not('position_in_flow', 'is', null)
      .order('position_in_flow');

    const pipelineList = agents?.length
      ? agents.map((a) => `  ${a.position_in_flow}. ${a.display_name}`).join('\n')
      : '  (pipeline vazio)';

    await bot.sendMessage(
      chatId,
      `Quer que o ${data.display_name} entre no pipeline de criacao de conteudo?\n\n` +
      `Pipeline atual:\n${pipelineList}\n\n` +
      `Responda "sim" para adicionar ao final, um numero para inserir na posicao, ou "nao" para nao adicionar.`
    );
    return;
  }

  if (step === 'pipeline') {
    let position_in_flow = null;

    if (text.toLowerCase() !== 'nao') {
      if (!isNaN(parseInt(text, 10))) {
        position_in_flow = parseInt(text, 10);
      } else {
        position_in_flow = await getNextPosition();
      }
    }

    pendingAgentFlow = null;

    await bot.sendMessage(chatId, `Gerando system prompt para o ${data.display_name}...`);

    try {
      const system_prompt = await generateAgentSystemPrompt(data.display_name, data.role, data.instructions);
      const agent = await createAgent({ ...data, system_prompt, position_in_flow });

      const pipelineMsg = position_in_flow
        ? `\nPosicao no pipeline: ${position_in_flow}`
        : '\nNao adicionado ao pipeline de conteudo.';

      await bot.sendMessage(
        chatId,
        `Agente ${agent.display_name} criado com sucesso!\n` +
        `Funcao: ${agent.role}${pipelineMsg}\n\n` +
        `Use /agentes para ver todos os agentes.`
      );
    } catch (err) {
      logger.error('Agent creation failed', { error: err.message });
      await bot.sendMessage(chatId, `Erro ao criar agente: ${err.message}`);
    }
    return;
  }
}
```

**Step 5: Add imports at top of handlers.js**

After existing requires, add:

```js
const { createAgent, getNextPosition } = require('../agents/agentFactory');
```

**Step 6: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/handlers.js && git commit -m "feat: pendingAgentFlow onboarding state machine"
```

---

### Task 4: Wire onboarding into `handleFreeMessage` and add `/criar_agente` command

**Files:**
- Modify: `src/telegram/handlers.js` — `handleFreeMessage` and new `handleCriarAgente`

**Step 1: Add `/criar_agente` handler function** (before `module.exports`):

```js
async function handleCriarAgente(bot, msg) {
  await startAgentOnboarding(bot, msg.chat.id);
}
```

**Step 2: Add `pendingAgentFlow` interception to `handleFreeMessage`**

At the very top of `handleFreeMessage`, before the `pendingCronFlow` check, add:

```js
// Intercept if in agent onboarding flow
if (pendingAgentFlow) {
  return await handleAgentOnboardingStep(bot, msg);
}
```

**Step 3: Add `[ACAO:CRIAR_AGENTE]` detection in `handleFreeMessage`**

After the `scheduleMatch` block (and before `await bot.sendMessage(msg.chat.id, response)`), add:

```js
// Detect agent creation intent
if (response.includes('[ACAO:CRIAR_AGENTE]')) {
  return await startAgentOnboarding(bot, msg.chat.id);
}
```

**Step 4: Export new handler**

Add to `module.exports`:

```js
handleCriarAgente,
_setPendingAgentFlow: (v) => { pendingAgentFlow = v; },
```

**Step 5: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/handlers.js && git commit -m "feat: wire /criar_agente and [ACAO:CRIAR_AGENTE] into handlers"
```

---

### Task 5: Register `/criar_agente` command in bot.js

**Files:**
- Modify: `src/telegram/bot.js`

**Step 1: Read bot.js to find where commands are registered**

Check current command registration pattern.

**Step 2: Add the command**

Register `/criar_agente` similarly to other commands, calling `handleCriarAgente`.

**Step 3: Update `/ajuda` handler in handlers.js**

Add to the ajuda message:

```
'/criar_agente — Criar novo agente\n' +
```

**Step 4: Commit**

```bash
cd /Users/charbellelopes/emilybot && git add src/telegram/bot.js src/telegram/handlers.js && git commit -m "feat: register /criar_agente command, update /ajuda"
```

---

### Task 6: Smoke test end-to-end

**Step 1: Start the bot**

```bash
cd /Users/charbellelopes/emilybot && npm run dev
```

**Step 2: Test via Telegram**

1. Send `/criar_agente` → Emily asks for name
2. Reply "Revisor" → Emily asks for function
3. Reply "Revisar o conteudo antes de publicar, checando clareza e tom" → Emily asks for instructions
4. Reply "Ser rigoroso com clareza, sem linguagem formal" → Emily shows pipeline + asks position
5. Reply "nao" → Emily generates system prompt + saves + confirms
6. Send `/agentes` → Revisor should appear
7. Send free message "cria um agente tradutor" → Emily detects intent, starts flow

**Step 3: Verify in Supabase**

Run in Supabase SQL editor:
```sql
SELECT name, display_name, role, position_in_flow, is_active FROM agents ORDER BY position_in_flow;
```

New agent should appear with correct fields.

**Step 4: Run full test suite**

```bash
cd /Users/charbellelopes/emilybot && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests still pass.

**Step 5: Commit if anything was fixed**

```bash
cd /Users/charbellelopes/emilybot && git add -A && git commit -m "fix: smoke test fixes"
```

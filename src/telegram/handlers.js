'use strict';

const { runContentFlow, runContentFromResearch, runResearch, loadPipeline } = require('../flows/contentCreation');
const { supabase } = require('../database/supabase');
const { runAgent } = require('../agents/agentRunner');
const { logger } = require('../utils/logger');
const cronManager = require('../scheduler/cronManager');
const { createAgent, getNextPosition } = require('../agents/agentFactory');
const { generatePostUnico, generateCarouselImages, parseCarouselCards } = require('../services/imageGenerator');
const { checkRateLimit } = require('../utils/rateLimiter');

// Per-chatId state Maps (supports multiple concurrent tenants)
const pendingCronFlows = new Map();     // chatId -> flow data
const pendingAgentFlows = new Map();    // chatId -> flow data
const pendingFormatFlows = new Map();   // chatId -> flow data
const pendingImageFlows = new Map();    // chatId -> flow data
const pendingResearchFlows = new Map(); // chatId -> flow data

const FORMAT_BUTTONS = [
  [
    { text: '📱 Post único', callback_data: 'format:post_unico' },
    { text: '🎠 Carrossel', callback_data: 'format:carrossel' },
  ],
  [
    { text: '🐦 Tweet', callback_data: 'format:tweet' },
    { text: '🧵 Thread', callback_data: 'format:thread' },
  ],
  [
    { text: '🎬 Reels', callback_data: 'format:reels_roteiro' },
  ],
];

const BASE_EMILY_PROMPT = `Voce e Emily, COO e orquestradora de uma equipe de agentes de IA que trabalha para Raphael, um gestor de trafego e criador de conteudo especializado em Meta Ads, Google Ads, IA e marketing digital.

Suas responsabilidades:
1. Entender o que Raphael precisa e acionar os subagentes corretos
2. Coordenar o fluxo de trabalho entre agentes
3. Criar novos subagentes quando solicitado, coletando: nome, funcao, tom de voz, instrucoes especificas
4. Reportar resultados de forma clara e objetiva
5. Gerenciar agendamentos e automacoes

Seja direta, profissional e proativa. Quando acionar multiplos agentes, informe o progresso.

IMPORTANTE — quando o usuario pedir para criar CONTEUDO e ja souber o tema, responda EXATAMENTE com:
[ACAO:CONTEUDO] tema: <tema extraido> | formato: <formato ou post_unico>

IMPORTANTE — quando o usuario quiser criar conteudo MAS NAO SOUBER O TEMA, ou pedir que o pesquisador sugira um tema, responda EXATAMENTE com:
[ACAO:PESQUISAR]

IMPORTANTE — quando o usuario pedir para AGENDAR criacao de conteudo, colete as informacoes e responda EXATAMENTE com:
[ACAO:AGENDAR] nome: <nome do agendamento> | cron: "<expressao cron>" | topics: "<tema1,tema2>" | format: <formato>

Expressoes cron comuns:
- Todo dia as 8h: "0 8 * * *"
- Seg e Qui as 9h: "0 9 * * 1,4"
- A cada 6h: "0 */6 * * *"
- Dias uteis as 7h: "0 7 * * 1-5"

Se o usuario nao especificar topics, use "IA,Meta Ads,marketing digital". Se nao especificar formato, use "post_unico".

IMPORTANTE — quando o usuario pedir para CRIAR um novo agente ou subagente, responda EXATAMENTE com:
[ACAO:CRIAR_AGENTE]

Exemplos de pedidos que ativam isso: "cria um agente", "quero um novo agente", "adiciona um agente revisor", "criar subagente".

IMPORTANTE — quando o usuario quiser gerar uma imagem de post com uma FRASE EXATA que ele mesmo escreveu (sem reescrever, sem pipeline de criacao), responda EXATAMENTE com:
[ACAO:POST_DIRETO] texto: <frase exata copiada literalmente da mensagem do usuario>

Exemplos que ativam isso: "quero um post com exatamente essa frase: ...", "gera imagem com esse texto exato: ...", "cria um post com o texto que escrevi: ...", "quero um conteudo novo de um unico post com exatamente essa frase: ...".

IMPORTANTE — quando o usuario mandar um BLOCO DE TEXTO/CONTEXTO e quiser criar conteudo baseado nele (sem pesquisa nova), responda EXATAMENTE com:
[ACAO:CONTEXTO] topic: <titulo curto extraido do contexto> | texto: <texto de contexto copiado literalmente da mensagem>

Exemplos que ativam isso: "usa esse contexto para criar um carrossel: ...", "cria conteudo com esse texto: ...", "aqui esta a explicacao, faz um post sobre isso: ...", "pega essa resposta do Claude e faz um carrossel: ...", "com base nisso aqui cria um carrossel: ...".

Quando for uma conversa normal, responda normalmente como Emily, em portugues.`;

function getEmilyPrompt(tenant) {
  let base = BASE_EMILY_PROMPT;

  if (tenant?.owner_name || tenant?.niche || tenant?.specialization) {
    const ownerName = tenant.owner_name || 'seu usuario';
    const niche = tenant.niche || 'marketing digital';
    const specialization = tenant.specialization || 'criacao de conteudo e gestao de trafego';

    base = `Voce e Emily, COO e orquestradora de uma equipe de agentes de IA que trabalha para ${ownerName}, especializado em ${niche}.

Suas responsabilidades:
1. Entender o que ${ownerName} precisa e acionar os subagentes corretos
2. Coordenar o fluxo de trabalho entre agentes
3. Criar novos subagentes quando solicitado, coletando: nome, funcao, tom de voz, instrucoes especificas
4. Reportar resultados de forma clara e objetiva
5. Gerenciar agendamentos e automacoes

Areas de atuacao: ${specialization}.

Seja direta, profissional e proativa. Quando acionar multiplos agentes, informe o progresso.

IMPORTANTE — quando o usuario pedir para criar CONTEUDO e ja souber o tema, responda EXATAMENTE com:
[ACAO:CONTEUDO] tema: <tema extraido> | formato: <formato ou post_unico>

IMPORTANTE — quando o usuario quiser criar conteudo MAS NAO SOUBER O TEMA, ou pedir que o pesquisador sugira um tema, responda EXATAMENTE com:
[ACAO:PESQUISAR]

IMPORTANTE — quando o usuario pedir para AGENDAR criacao de conteudo, colete as informacoes e responda EXATAMENTE com:
[ACAO:AGENDAR] nome: <nome do agendamento> | cron: "<expressao cron>" | topics: "<tema1,tema2>" | format: <formato>

Expressoes cron comuns:
- Todo dia as 8h: "0 8 * * *"
- Seg e Qui as 9h: "0 9 * * 1,4"
- A cada 6h: "0 */6 * * *"
- Dias uteis as 7h: "0 7 * * 1-5"

Se o usuario nao especificar topics, use os temas do nicho: "${niche}". Se nao especificar formato, use "post_unico".

IMPORTANTE — quando o usuario pedir para CRIAR um novo agente ou subagente, responda EXATAMENTE com:
[ACAO:CRIAR_AGENTE]

Exemplos de pedidos que ativam isso: "cria um agente", "quero um novo agente", "adiciona um agente revisor", "criar subagente".

IMPORTANTE — quando o usuario quiser gerar uma imagem de post com uma FRASE EXATA que ele mesmo escreveu (sem reescrever, sem pipeline de criacao), responda EXATAMENTE com:
[ACAO:POST_DIRETO] texto: <frase exata copiada literalmente da mensagem do usuario>

Exemplos que ativam isso: "quero um post com exatamente essa frase: ...", "gera imagem com esse texto exato: ...", "cria um post com o texto que escrevi: ...", "quero um conteudo novo de um unico post com exatamente essa frase: ...".

IMPORTANTE — quando o usuario mandar um BLOCO DE TEXTO/CONTEXTO e quiser criar conteudo baseado nele (sem pesquisa nova), responda EXATAMENTE com:
[ACAO:CONTEXTO] topic: <titulo curto extraido do contexto> | texto: <texto de contexto copiado literalmente da mensagem>

Exemplos que ativam isso: "usa esse contexto para criar um carrossel: ...", "cria conteudo com esse texto: ...", "aqui esta a explicacao, faz um post sobre isso: ...", "pega essa resposta do Claude e faz um carrossel: ...", "com base nisso aqui cria um carrossel: ...".

Quando for uma conversa normal, responda normalmente como Emily, em portugues.`;
  }

  if (tenant?.emily_tone) {
    base += `\n\nTOM DE VOZ PERSONALIZADO: ${tenant.emily_tone}`;
  }

  return base;
}

function mkTenantKeys(tenant) {
  return {
    geminiApiKey: tenant?.gemini_api_key,
    braveSearchKey: tenant?.brave_search_key,
    falKey: tenant?.fal_key,
    tenantId: tenant?.id,
  };
}

async function generateAgentSystemPrompt(displayName, role, instructions, geminiApiKey) {
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

  return runAgent(prompt, 'Gere o system prompt agora.', { model: 'sonnet', maxTokens: 1024, geminiApiKey });
}

async function startAgentOnboarding(bot, chatId) {
  pendingAgentFlows.set(String(chatId), { step: 'nome', data: {} });
  await bot.sendMessage(chatId, 'Otimo! Vou criar um novo agente. Como ele se chama?');
}

async function handleAgentOnboardingStep(bot, msg, tenant) {
  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  const flowData = pendingAgentFlows.get(chatIdStr);
  if (!flowData) return;

  const { step, data } = flowData;

  if (step === 'nome') {
    data.display_name = text;
    data.name = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    pendingAgentFlows.set(chatIdStr, { step: 'funcao', data });
    await bot.sendMessage(chatId, `Perfeito! Qual e a funcao principal do ${data.display_name}?\n\nDescreva o que ele deve fazer.`);
    return;
  }

  if (step === 'funcao') {
    data.role = text;
    pendingAgentFlows.set(chatIdStr, { step: 'instrucoes', data });
    await bot.sendMessage(chatId, 'Tem alguma instrucao especifica ou estilo que ele deve seguir?\n\n(Responda "nenhuma" para pular)');
    return;
  }

  if (step === 'instrucoes') {
    data.instructions = text.toLowerCase() === 'nenhuma' ? '' : text;
    pendingAgentFlows.set(chatIdStr, { step: 'pipeline', data });

    let query = supabase
      .from('agents')
      .select('display_name, position_in_flow')
      .eq('is_active', true)
      .not('position_in_flow', 'is', null);

    if (tenant?.id) query = query.eq('tenant_id', tenant.id);

    const { data: agents } = await query.order('position_in_flow');

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
        position_in_flow = await getNextPosition(tenant?.id);
      }
    }

    pendingAgentFlows.delete(chatIdStr);

    await bot.sendMessage(chatId, `Gerando system prompt para o ${data.display_name}...`);

    try {
      const system_prompt = await generateAgentSystemPrompt(data.display_name, data.role, data.instructions, tenant?.gemini_api_key);
      const agent = await createAgent({ ...data, system_prompt, position_in_flow, tenant_id: tenant?.id });

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

function parseResearchOptions(researchText) {
  // Try JSON first — pesquisador often returns array or {ideas:[]} with "title" fields
  try {
    const raw = researchText.trim();
    const jsonStr = raw.startsWith('[') || raw.startsWith('{') ? raw : (raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)?.[0] || '');
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const items = Array.isArray(parsed) ? parsed : (parsed.ideas || parsed.suggestions || parsed.pautas || []);
      const titles = items
        .map((item) => item.title || item.titulo || item.gancho || item.headline || Object.values(item)[0])
        .filter((t) => typeof t === 'string' && t.length > 10)
        .slice(0, 5);
      if (titles.length) return titles;
    }
  } catch {}

  // Fallback: look for "title" values in the raw text
  const titleMatches = [...researchText.matchAll(/"title"\s*:\s*"([^"]{10,})"/g)];
  if (titleMatches.length) {
    return titleMatches.map((m) => m[1]).slice(0, 5);
  }

  // Last resort: numbered lines that look like idea titles (long enough, not JSON fields)
  const lines = researchText.split('\n');
  const options = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.{20,})/);
    if (match && !match[1].includes('":')) {
      options.push(match[1].trim());
    }
  }
  return options.slice(0, 5);
}

async function handleStart(bot, msg, tenant) {
  await bot.sendMessage(
    msg.chat.id,
    'Ola! Sou Emily, sua COO virtual.\n\n' +
    'Posso criar conteudo, gerenciar agentes, agendar tarefas e muito mais.\n\n' +
    'Use /ajuda para ver os comandos disponiveis.'
  );
}

async function handleAgentes(bot, msg, tenant) {
  let query = supabase
    .from('agents')
    .select('display_name, role, is_active, position_in_flow');

  if (tenant?.id) query = query.eq('tenant_id', tenant.id);

  const { data: agents } = await query.order('position_in_flow');

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

async function askForFormat(bot, chatId, topic, directText = null, contextText = null) {
  pendingFormatFlows.set(String(chatId), { topic, chatId, directText, contextText });
  const keyboard = contextText
    ? [...FORMAT_BUTTONS, [{ text: '📋 Usar texto como está', callback_data: 'format:contexto_direto' }]]
    : FORMAT_BUTTONS;
  await bot.sendMessage(
    chatId,
    `🎨 Qual formato para *"${topic || 'seu texto'}"*?`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }
  );
}

async function uploadImageToStorage(buf, draftId, filename) {
  const path = `${draftId}/${filename}`;
  const { error } = await supabase.storage
    .from('draft-images')
    .upload(path, buf, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from('draft-images').getPublicUrl(path);
  return data.publicUrl;
}

function buildEditLink(draftId) {
  if (!draftId) return null;
  const base = process.env.DASHBOARD_URL || 'http://localhost:3001';
  return `${base}/drafts/${draftId}`;
}

function extractCleanPreview(finalContent, format) {
  if (format === 'post_unico') {
    try {
      const jsonStr = finalContent.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      const parsed = JSON.parse(jsonStr);
      const raw = typeof parsed.content === 'string' ? parsed.content : finalContent;
      return raw.replace(/\*\*(.*?)\*\*/gs, '$1').replace(/\*(.*?)\*/gs, '$1');
    } catch {}
    return finalContent;
  }

  if (format === 'carrossel') {
    try {
      const jsonStr = finalContent.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      const parsed = JSON.parse(jsonStr);
      const cards = Array.isArray(parsed.content) ? parsed.content : (Array.isArray(parsed) ? parsed : null);
      if (cards) {
        return cards
          .map((c, i) => {
            const title = c.headline || c.title || c.titulo || c.gancho || Object.values(c)[0] || '';
            const body = c.body || c.texto || c.content || '';
            return `*Card ${i + 1}:* ${title}${body ? `\n${body}` : ''}`;
          })
          .join('\n\n');
      }
    } catch {}
    return finalContent;
  }

  return finalContent;
}

async function runContentAndSend(bot, chatId, topic, format, tenant) {
  await bot.sendMessage(chatId, '🔄 Iniciando fluxo de criacao de conteudo...');
  try {
    const result = await runContentFlow(topic, format, mkTenantKeys(tenant));
    await bot.sendMessage(chatId, `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`);

    const preview = extractCleanPreview(result.final_content || '', format);
    if (preview) {
      const chunks = preview.match(/.{1,4000}/gs) || [preview];
      for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
    }

    const editLink = buildEditLink(result.draft_id);
    if (editLink) await bot.sendMessage(chatId, `✏️ Editar: ${editLink}`);

    if (['post_unico', 'carrossel'].includes(format)) {
      pendingImageFlows.set(String(chatId), { format, final_content: result.final_content, draft_id: result.draft_id, chatId });
      await bot.sendMessage(chatId, '🎨 Quer gerar as imagens?', {
        reply_markup: {
          inline_keyboard: [[{ text: '🖼️ Gerar imagem', callback_data: 'image:generate' }]],
        },
      });
    }
  } catch (err) {
    logger.error('Content flow failed', { error: err.message });
    await bot.sendMessage(chatId, `❌ Erro no fluxo: ${err.message}`);
  }
}

async function runResearchContentAndSend(bot, chatId, topic, format, researchText, remainingAgents, tenant) {
  await bot.sendMessage(chatId, '🔄 Iniciando fluxo de criacao de conteudo...');
  try {
    const result = await runContentFromResearch(researchText, topic, format, remainingAgents, mkTenantKeys(tenant));
    await bot.sendMessage(chatId, `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`);

    const preview = extractCleanPreview(result.final_content || '', format);
    if (preview) {
      const chunks = preview.match(/.{1,4000}/gs) || [preview];
      for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
    }

    const editLink = buildEditLink(result.draft_id);
    if (editLink) await bot.sendMessage(chatId, `✏️ Editar: ${editLink}`);

    if (['post_unico', 'carrossel'].includes(format)) {
      pendingImageFlows.set(String(chatId), { format, final_content: result.final_content, draft_id: result.draft_id, chatId });
      await bot.sendMessage(chatId, '🎨 Quer gerar as imagens?', {
        reply_markup: {
          inline_keyboard: [[{ text: '🖼️ Gerar imagem', callback_data: 'image:generate' }]],
        },
      });
    }
  } catch (err) {
    logger.error('Research content flow failed', { error: err.message });
    await bot.sendMessage(chatId, `❌ Erro no fluxo: ${err.message}`);
  }
}

async function handleImageCallback(bot, query, tenant) {
  if (query.data !== 'image:generate') return;
  const chatId = query.message.chat.id;
  const chatIdStr = String(chatId);
  await bot.answerCallbackQuery(query.id);

  await bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: query.message.message_id }
  );

  if (!pendingImageFlows.has(chatIdStr)) {
    return bot.sendMessage(chatId, '❌ Nenhum conteudo pendente para gerar imagem.');
  }

  const { format, final_content, draft_id } = pendingImageFlows.get(chatIdStr);
  pendingImageFlows.delete(chatIdStr);

  if (format === 'post_unico') {
    await bot.sendMessage(chatId, '🖼️ Gerando imagem do post...');
    try {
      let postText = final_content;
      try {
        const jsonStr = final_content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
        const parsed = JSON.parse(jsonStr);
        let raw = typeof parsed.content === 'string' ? parsed.content : final_content;
        raw = raw.replace(/\*\*(.*?)\*\*/gs, '$1').replace(/\*(.*?)\*/gs, '$1');
        postText = raw;
      } catch {}
      const imgBuf = await generatePostUnico(postText, tenant?.branding);
      await bot.sendPhoto(chatId, imgBuf, { caption: '📱 Post único gerado com IDV2' }, { filename: 'post.png', contentType: 'image/png' });
      if (draft_id) {
        try {
          const url = await uploadImageToStorage(imgBuf, draft_id, 'post.png');
          await supabase.from('content_drafts').update({ image_urls: [url] }).eq('id', draft_id);
        } catch (upErr) {
          logger.warn('Image upload to storage failed', { error: upErr.message });
        }
      }
    } catch (err) {
      logger.error('Post unico image failed', { error: err.message });
      await bot.sendMessage(chatId, `❌ Erro ao gerar imagem: ${err.message}`);
    }
    return;
  }

  if (format === 'carrossel') {
    await bot.sendMessage(chatId, '🎠 Gerando cards do carrossel...');
    try {
      const cards = parseCarouselCards(final_content);
      await bot.sendMessage(chatId, `📋 ${cards.length} cards encontrados. Gerando imagens...`);
      const images = await generateCarouselImages(cards);
      const uploadedUrls = [];
      for (let i = 0; i < images.length; i++) {
        const { buf, caption } = images[i];
        await bot.sendPhoto(chatId, buf, { caption }, { filename: `card_${i + 1}.png`, contentType: 'image/png' });
        if (draft_id) {
          try {
            const url = await uploadImageToStorage(buf, draft_id, `card_${i + 1}.png`);
            uploadedUrls.push(url);
          } catch (upErr) {
            logger.warn('Card upload to storage failed', { error: upErr.message, index: i });
          }
        }
      }
      if (draft_id && uploadedUrls.length) {
        await supabase.from('content_drafts').update({ image_urls: uploadedUrls }).eq('id', draft_id);
      }
      await bot.sendMessage(chatId, '✅ Carrossel gerado!');
    } catch (err) {
      logger.error('Carousel image failed', { error: err.message });
      await bot.sendMessage(chatId, `❌ Erro ao gerar carrossel: ${err.message}`);
    }
  }
}

async function handlePesquisarAction(bot, chatId, tenant) {
  await bot.sendMessage(chatId, '🔍 Pesquisando tendencias para sugerir temas...');
  try {
    const { researchText, remainingAgents } = await runResearch('marketing digital, IA, Meta Ads, Google Ads', mkTenantKeys(tenant));
    const options = parseResearchOptions(researchText);

    if (!options.length) {
      await bot.sendMessage(chatId, `📊 Pesquisa concluida:\n\n${researchText.slice(0, 1500)}\n\nQual tema voce quer? Use /conteudo <tema>.`);
      return;
    }

    pendingResearchFlows.set(String(chatId), { options, researchText, remainingAgents });

    const buttons = options.map((opt, i) => [{
      text: opt.length > 50 ? opt.slice(0, 47) + '...' : opt,
      callback_data: `research:${i}`,
    }]);

    await bot.sendMessage(chatId, '📊 *Temas em alta para voce:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err) {
    logger.error('Pesquisar action failed', { error: err.message });
    await bot.sendMessage(chatId, `❌ Erro ao pesquisar: ${err.message}`);
  }
}

async function handleResearchCallback(bot, query, tenant) {
  const chatId = query.message.chat.id;
  const chatIdStr = String(chatId);
  const idx = parseInt(query.data.replace('research:', ''), 10);

  await bot.answerCallbackQuery(query.id);

  if (!pendingResearchFlows.has(chatIdStr)) {
    return bot.sendMessage(chatId, '❌ Nenhuma pesquisa pendente.');
  }

  const { options, researchText, remainingAgents } = pendingResearchFlows.get(chatIdStr);
  const topic = options[idx];
  pendingResearchFlows.delete(chatIdStr);

  if (!topic) {
    return bot.sendMessage(chatId, '❌ Opcao invalida.');
  }

  await bot.editMessageText(
    `✅ Tema selecionado: *${topic}*`,
    { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
  );

  pendingFormatFlows.set(chatIdStr, { topic, chatId, researchData: { researchText, remainingAgents } });
  await bot.sendMessage(chatId, `🎨 Qual formato para *"${topic}"*?`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: FORMAT_BUTTONS },
  });
}

async function handleConteudo(bot, msg, topic, tenant) {
  if (!topic) {
    return bot.sendMessage(
      msg.chat.id,
      'Use: /conteudo <tema>\nEx: /conteudo novidades Meta Ads 2025'
    );
  }
  await askForFormat(bot, msg.chat.id, topic);
}

async function handleFormatCallback(bot, query, tenant) {
  const chatId = query.message.chat.id;
  const chatIdStr = String(chatId);
  const data = query.data;

  if (!data.startsWith('format:')) return;
  const format = data.replace('format:', '');

  await bot.answerCallbackQuery(query.id);

  if (!pendingFormatFlows.has(chatIdStr)) {
    return bot.sendMessage(chatId, '❌ Nenhum conteudo pendente. Use /conteudo <tema>.');
  }

  const { topic, researchData, directText, contextText } = pendingFormatFlows.get(chatIdStr);
  pendingFormatFlows.delete(chatIdStr);

  const formatLabels = {
    post_unico: 'Post único',
    carrossel: 'Carrossel',
    tweet: 'Tweet',
    thread: 'Thread',
    reels_roteiro: 'Reels',
  };

  await bot.editMessageText(
    `🎨 Formato escolhido: *${formatLabels[format] || format}*`,
    { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
  );

  // Direct text mode: skip pipeline, generate image from exact text
  if (directText) {
    if (format === 'post_unico') {
      await bot.sendMessage(chatId, '🖼️ Gerando imagem do post...');
      try {
        const imgBuf = await generatePostUnico(directText, tenant?.branding);
        await bot.sendPhoto(chatId, imgBuf, { caption: '📱 Post único' }, { filename: 'post.png', contentType: 'image/png' });
      } catch (err) {
        logger.error('Direct post image failed', { error: err.message });
        await bot.sendMessage(chatId, `❌ Erro ao gerar imagem: ${err.message}`);
      }
    } else {
      await bot.sendMessage(chatId, `📝 Texto para ${formatLabels[format] || format}:\n\n${directText}`);
    }
    return;
  }

  // Context mode: skip pesquisador, run redator+formatador with user-provided text
  if (contextText) {
    // "Usar como está" — skip pipeline entirely, use context as final_content
    if (format === 'contexto_direto') {
      try {
        const { data: draft } = await supabase
          .from('content_drafts')
          .insert({ topic: topic || 'contexto direto', format: 'post_unico', draft: null, final_content: contextText, status: 'completed', tenant_id: tenant?.id })
          .select().single();
        await bot.sendMessage(chatId, `✅ Conteudo salvo (ID: ${draft?.id || 'N/A'})`);
        const chunks = contextText.match(/.{1,4000}/gs) || [contextText];
        for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
        const editLink = buildEditLink(draft?.id);
        if (editLink) await bot.sendMessage(chatId, `✏️ Editar: ${editLink}`);
        pendingImageFlows.set(chatIdStr, { format: 'post_unico', final_content: contextText, draft_id: draft?.id, chatId });
        await bot.sendMessage(chatId, '🎨 Quer gerar as imagens?', {
          reply_markup: { inline_keyboard: [[{ text: '🖼️ Gerar imagem', callback_data: 'image:generate' }]] },
        });
      } catch (err) {
        logger.error('Context direct flow failed', { error: err.message });
        await bot.sendMessage(chatId, `❌ Erro: ${err.message}`);
      }
      return;
    }

    // Rate limit check before running pipeline
    if (tenant?.id && !checkRateLimit(tenant.id)) {
      return bot.sendMessage(chatId, '⚠️ Limite de 6 conteudos por hora atingido. Tente novamente mais tarde.');
    }

    // Normal context mode: run redator+formatador with fidelity instruction
    const contextWithInstructions =
      `INSTRUCAO: mantenha maxima fidelidade ao conteudo, ideias e estrutura do texto abaixo. ` +
      `Adapte APENAS o que for estritamente necessario para o formato "${format}".\n\n` +
      `TEXTO DO USUARIO:\n${contextText}`;
    try {
      const pipeline = await loadPipeline(mkTenantKeys(tenant));
      const remainingAgents = pipeline.slice(1); // skip pesquisador (position 1)
      await runResearchContentAndSend(bot, chatId, topic, format, contextWithInstructions, remainingAgents, tenant);
    } catch (err) {
      logger.error('Context content flow failed', { error: err.message });
      await bot.sendMessage(chatId, `❌ Erro ao processar contexto: ${err.message}`);
    }
    return;
  }

  // Rate limit check before running pipeline
  if (tenant?.id && !checkRateLimit(tenant.id)) {
    return bot.sendMessage(chatId, '⚠️ Limite de 6 conteudos por hora atingido. Tente novamente mais tarde.');
  }

  if (researchData) {
    await runResearchContentAndSend(bot, chatId, topic, format, researchData.researchText, researchData.remainingAgents, tenant);
  } else {
    await runContentAndSend(bot, chatId, topic, format, tenant);
  }
}

async function handleAgendamentos(bot, msg, tenant) {
  try {
    const schedules = await cronManager.list(tenant?.id);

    if (!schedules.length) {
      return bot.sendMessage(msg.chat.id, 'Nenhum agendamento cadastrado.');
    }

    const list = schedules
      .map(
        (s) =>
          `${s.is_active ? '✅' : '⏸️'} ${s.name}\n` +
          `   Cron: ${s.cron_expression}\n` +
          `   Temas: ${(s.topics || []).join(', ') || 'automatico'}\n` +
          `   Formato: ${s.format}\n` +
          `   ID: ${s.id}`
      )
      .join('\n\n');

    await bot.sendMessage(msg.chat.id, `Agendamentos:\n\n${list}`);
  } catch (err) {
    logger.error('List schedules failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

async function handlePausar(bot, msg, scheduleId, tenant) {
  if (!scheduleId) {
    return bot.sendMessage(
      msg.chat.id,
      'Use: /pausar <id>\nVeja os IDs com /agendamentos'
    );
  }

  try {
    await cronManager.pause(scheduleId);
    await bot.sendMessage(msg.chat.id, `⏸️ Agendamento pausado: ${scheduleId}`);
  } catch (err) {
    logger.error('Pause schedule failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

async function handleDisparar(bot, msg, scheduleId, tenant) {
  if (!scheduleId) {
    return bot.sendMessage(msg.chat.id, 'Use: /disparar <id>\nVeja os IDs com /agendamentos');
  }

  let query = supabase.from('schedules').select('*').eq('id', scheduleId);
  if (tenant?.id) query = query.eq('tenant_id', tenant.id);

  const { data: schedule, error } = await query.single();

  if (error || !schedule) {
    return bot.sendMessage(msg.chat.id, `❌ Agendamento nao encontrado: ${scheduleId}`);
  }

  await bot.sendMessage(msg.chat.id, `🔄 Disparando "${schedule.name}"...`);

  try {
    const topics = (schedule.topics || []).join(', ') || 'IA e marketing digital';
    const { researchText, remainingAgents } = await runResearch(topics, mkTenantKeys(tenant));
    await onCronResearchReady(bot, String(msg.chat.id), schedule, researchText, remainingAgents);
  } catch (err) {
    logger.error('Manual trigger failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro ao disparar: ${err.message}`);
  }
}

async function handleAjuda(bot, msg, tenant) {
  await bot.sendMessage(
    msg.chat.id,
    'Comandos disponiveis:\n\n' +
    '/start — Apresentacao\n' +
    '/agentes — Lista agentes ativos\n' +
    '/criar\\_agente — Criar novo agente\n' +
    '/conteudo \\<tema\\> — Criar conteudo\n' +
    '/agendamentos — Lista cron jobs\n' +
    '/pausar \\<id\\> — Pausa um agendamento\n' +
    '/status — Status do sistema\n' +
    '/branding — Ver ou alterar visual\n' +
    '/ajuda — Este menu',
    { parse_mode: 'MarkdownV2' }
  );
}

async function handleStatus(bot, msg, tenant) {
  let agentQuery = supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true);
  let draftQuery = supabase.from('content_drafts').select('*', { count: 'exact', head: true });
  let scheduleQuery = supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('is_active', true);

  if (tenant?.id) {
    agentQuery = agentQuery.eq('tenant_id', tenant.id);
    draftQuery = draftQuery.eq('tenant_id', tenant.id);
    scheduleQuery = scheduleQuery.eq('tenant_id', tenant.id);
  }

  const [{ count: agentCount }, { count: draftCount }, { count: scheduleCount }] =
    await Promise.all([agentQuery, draftQuery, scheduleQuery]);

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

async function handleBranding(bot, msg, tenant, args) {
  const chatId = msg.chat.id;

  if (!tenant) {
    return bot.sendMessage(chatId, '❌ Tenant nao identificado.');
  }

  if (!args) {
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
      `*IDV2 (Post único):*`,
      `Nome: ${b.display_name || 'Rapha Saru'}`,
      `Username: ${b.username ? '@' + b.username.replace(/^@/, '') : '@raphasaru'}`,
      `Foto de perfil: ${b.profile_pic_url || 'padrao (saru-profile.png)'}`,
      '',
      'Para alterar: /branding <campo> <valor>',
      'Campos: cor, cor2, texto\\_cor, fonte, logo, preset, nome, username, profile\\_pic',
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
    nome: 'display_name',
    username: 'username',
    profile_pic: 'profile_pic_url',
  };

  const key = fieldMap[field];
  if (!key) return bot.sendMessage(chatId, `Campo invalido: ${field}\nValidos: cor, cor2, texto_cor, fonte, logo, preset, nome, username, profile_pic`);

  if (key === 'template_preset' && !['modern', 'clean', 'bold'].includes(value)) {
    return bot.sendMessage(chatId, 'Presets disponiveis: modern, clean, bold');
  }

  branding[key] = value;

  const tenantService = require('../tenant/tenantService');
  await tenantService.updateTenant(tenant.id, { branding });
  tenant.branding = branding;

  const { setTenantCache } = require('./middleware');
  setTenantCache(tenant.chat_id, tenant);

  await bot.sendMessage(chatId, `✅ ${field} atualizado para: ${value}`);
}

// Called by cronManager when research is ready — presents options to user
async function onCronResearchReady(bot, chatId, schedule, researchText, remainingAgents) {
  const options = parseResearchOptions(researchText);

  pendingCronFlows.set(String(chatId), { schedule, researchText, remainingAgents, options });

  if (!options.length) {
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

async function handleFreeMessage(bot, msg, tenant) {
  const chatIdStr = String(msg.chat.id);

  // Intercept if in agent onboarding flow
  if (pendingAgentFlows.has(chatIdStr)) {
    return await handleAgentOnboardingStep(bot, msg, tenant);
  }

  // Intercept if waiting for pauta choice from a cron flow
  if (pendingCronFlows.has(chatIdStr)) {
    const text = msg.text.trim();
    const choiceNum = parseInt(text, 10);
    const { schedule, researchText, remainingAgents, options } = pendingCronFlows.get(chatIdStr);

    let chosenIdea;
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= options.length) {
      chosenIdea = options[choiceNum - 1];
    } else if (text.length > 5) {
      chosenIdea = text;
    } else {
      if (options.length > 0) {
        await bot.sendMessage(msg.chat.id, `Escolha invalida. Responda com um numero de 1 a ${options.length}.`);
      } else {
        chosenIdea = text;
      }
      if (!chosenIdea) return;
    }

    pendingCronFlows.delete(chatIdStr);

    // Rate limit check
    if (tenant?.id && !checkRateLimit(tenant.id)) {
      return bot.sendMessage(msg.chat.id, '⚠️ Limite de 6 conteudos por hora atingido. Tente novamente mais tarde.');
    }

    await bot.sendMessage(msg.chat.id, `✅ Pauta selecionada! Escrevendo conteudo...`);

    try {
      const result = await runContentFromResearch(researchText, chosenIdea, schedule.format, remainingAgents, mkTenantKeys(tenant));
      await bot.sendMessage(msg.chat.id, `✅ Conteudo salvo (ID: ${result.draft_id || 'N/A'})`);

      const preview = extractCleanPreview(result.final_content || '', schedule.format);
      if (preview) {
        const chunks = preview.match(/.{1,4000}/gs) || [preview];
        for (const chunk of chunks) await bot.sendMessage(msg.chat.id, chunk);
      }

      const editLink = buildEditLink(result.draft_id);
      if (editLink) await bot.sendMessage(msg.chat.id, `✏️ Editar: ${editLink}`);

      if (['post_unico', 'carrossel'].includes(schedule.format)) {
        pendingImageFlows.set(chatIdStr, { format: schedule.format, final_content: result.final_content, draft_id: result.draft_id, chatId: msg.chat.id });
        await bot.sendMessage(msg.chat.id, '🎨 Quer gerar as imagens?', {
          reply_markup: { inline_keyboard: [[{ text: '🖼️ Gerar imagem', callback_data: 'image:generate' }]] },
        });
      }
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
      getEmilyPrompt(tenant),
      msg.text,
      { model: 'haiku', maxTokens: 2048, geminiApiKey: tenant?.gemini_api_key }
    );

    // Detect research intent (no topic specified)
    if (response.includes('[ACAO:PESQUISAR]')) {
      return await handlePesquisarAction(bot, msg.chat.id, tenant);
    }

    // Detect content creation intent
    const contentMatch = response.match(
      /\[ACAO:CONTEUDO\]\s*tema:\s*(.+?)(?:\s*\|.*)?$/m
    );
    if (contentMatch) {
      const tema = contentMatch[1].trim();
      await bot.sendMessage(
        msg.chat.id,
        `📋 Entendido! Vamos criar conteudo sobre: *${tema}*`,
        { parse_mode: 'Markdown' }
      );
      return await askForFormat(bot, msg.chat.id, tema);
    }

    // Detect scheduling intent
    const scheduleMatch = response.match(
      /\[ACAO:AGENDAR\]\s*nome:\s*(.+?)\s*\|\s*cron:\s*"(.+?)"\s*\|\s*topics:\s*"(.+?)"\s*\|\s*format:\s*(.+)/
    );
    if (scheduleMatch) {
      const [, nome, cronExpr, topicsStr, format] = scheduleMatch;
      const topics = topicsStr.split(',').map((t) => t.trim()).filter(Boolean);

      await bot.sendMessage(msg.chat.id, `⏰ Criando agendamento "${nome.trim()}"...`);

      try {
        const schedule = await cronManager.createSchedule(bot, String(msg.chat.id), {
          name: nome.trim(),
          cron_expression: cronExpr.trim(),
          topics,
          format: format.trim(),
          tenant_id: tenant?.id,
        });

        await bot.sendMessage(
          msg.chat.id,
          `✅ Agendamento "${schedule.name}" criado!\n` +
          `⏰ Expressao: ${schedule.cron_expression}\n` +
          `📌 Temas: ${topics.join(', ')}\n` +
          `📄 Formato: ${schedule.format}\n\n` +
          `Use /agendamentos para ver todos.`
        );
      } catch (err) {
        logger.error('Create schedule failed', { error: err.message });
        await bot.sendMessage(msg.chat.id, `❌ Erro ao criar agendamento: ${err.message}`);
      }
      return;
    }

    // Detect agent creation intent
    if (response.includes('[ACAO:CRIAR_AGENTE]')) {
      return await startAgentOnboarding(bot, msg.chat.id);
    }

    // Detect direct text post intent
    const directMatch = response.match(/\[ACAO:POST_DIRETO\]\s*texto:\s*([\s\S]+)$/m);
    if (directMatch) {
      const directText = directMatch[1].trim();
      await bot.sendMessage(msg.chat.id, '✏️ Entendido! Qual formato para o seu texto?');
      return await askForFormat(bot, msg.chat.id, null, directText);
    }

    // Detect context-based content intent (skip pesquisador, use provided text)
    const contextMatch = response.match(/\[ACAO:CONTEXTO\]\s*topic:\s*(.+?)\s*\|\s*texto:\s*([\s\S]+)$/m);
    if (contextMatch) {
      const topic = contextMatch[1].trim();
      const contextText = contextMatch[2].trim();
      await bot.sendMessage(msg.chat.id, `📋 Contexto recebido! Qual formato deseja?`);
      return await askForFormat(bot, msg.chat.id, topic, null, contextText);
    }

    await bot.sendMessage(msg.chat.id, response);

    supabase.from('conversations').insert([
      { chat_id: chatIdStr, role: 'user', content: msg.text, tenant_id: tenant?.id },
      { chat_id: chatIdStr, role: 'assistant', content: response, agent_name: 'emily', tenant_id: tenant?.id },
    ]).then(({ error }) => {
      if (error) logger.error('Failed to save conversation', { error: error.message });
    });
  } catch (err) {
    logger.error('Emily response failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro: ${err.message}`);
  }
}

async function handleCriarAgente(bot, msg, tenant) {
  await startAgentOnboarding(bot, msg.chat.id);
}

module.exports = {
  handleStart,
  handleAgentes,
  handleConteudo,
  handleFormatCallback,
  handleImageCallback,
  handleResearchCallback,
  handleAgendamentos,
  handlePausar,
  handleAjuda,
  handleStatus,
  handleBranding,
  handleDisparar,
  handleFreeMessage,
  onCronResearchReady,
  handleCriarAgente,
  _setPendingCronFlow: (chatId, v) => v ? pendingCronFlows.set(String(chatId), v) : pendingCronFlows.delete(String(chatId)),
  _setPendingAgentFlow: (chatId, v) => v ? pendingAgentFlows.set(String(chatId), v) : pendingAgentFlows.delete(String(chatId)),
  _setPendingFormatFlow: (chatId, v) => v ? pendingFormatFlows.set(String(chatId), v) : pendingFormatFlows.delete(String(chatId)),
  _setPendingImageFlow: (chatId, v) => v ? pendingImageFlows.set(String(chatId), v) : pendingImageFlows.delete(String(chatId)),
  _setPendingResearchFlow: (chatId, v) => v ? pendingResearchFlows.set(String(chatId), v) : pendingResearchFlows.delete(String(chatId)),
};

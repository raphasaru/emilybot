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

async function handlePausar(bot, msg, scheduleId) {
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

async function handleDisparar(bot, msg, scheduleId) {
  if (!scheduleId) {
    return bot.sendMessage(msg.chat.id, 'Use: /disparar <id>\nVeja os IDs com /agendamentos');
  }

  const { data: schedule, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error || !schedule) {
    return bot.sendMessage(msg.chat.id, `❌ Agendamento nao encontrado: ${scheduleId}`);
  }

  await bot.sendMessage(msg.chat.id, `🔄 Disparando "${schedule.name}"...`);

  try {
    const { runResearch } = require('../flows/contentCreation');
    const topics = (schedule.topics || []).join(', ') || 'IA e marketing digital';
    const { researchText, remainingAgents } = await runResearch(topics);
    await onCronResearchReady(bot, String(msg.chat.id), schedule, researchText, remainingAgents);
  } catch (err) {
    logger.error('Manual trigger failed', { error: err.message });
    await bot.sendMessage(msg.chat.id, `❌ Erro ao disparar: ${err.message}`);
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
      chosenIdea = text;
    } else {
      if (options.length > 0) {
        await bot.sendMessage(msg.chat.id, `Escolha invalida. Responda com um numero de 1 a ${options.length}.`);
      } else {
        chosenIdea = text;
      }
      if (!chosenIdea) return;
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
      { model: 'haiku', maxTokens: 2048 }
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
      return await handleConteudo(bot, msg, tema.trim(), formato.trim());
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
  handleDisparar,
  handleFreeMessage,
  onCronResearchReady,
  _setPendingCronFlow: (v) => { pendingCronFlow = v; },
};

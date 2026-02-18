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

Quando for uma conversa normal, responda normalmente como Emily, em portugues.`;

async function handleStart(bot, msg) {
  await bot.sendMessage(
    msg.chat.id,
    'Ola! Sou Emily, sua COO virtual.\n\n' +
    'Posso criar conteudo, gerenciar agentes e muito mais.\n\n' +
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

    // Telegram has a 4096 char limit per message
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

async function handleAjuda(bot, msg) {
  await bot.sendMessage(
    msg.chat.id,
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
  const [{ count: agentCount }, { count: draftCount }] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('content_drafts').select('*', { count: 'exact', head: true }),
  ]);

  await bot.sendMessage(
    msg.chat.id,
    `*Status do sistema:*\n\n` +
    `🤖 Agentes ativos: ${agentCount || 0}\n` +
    `📝 Conteudos gerados: ${draftCount || 0}\n` +
    `✅ Sistema operacional`,
    { parse_mode: 'Markdown' }
  );
}

async function handleFreeMessage(bot, msg) {
  try {
    await bot.sendChatAction(msg.chat.id, 'typing');

    const response = await runAgent(
      EMILY_SYSTEM_PROMPT,
      msg.text,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 2048 }
    );

    // Check if Emily wants to trigger content flow
    const actionMatch = response.match(
      /\[ACAO:CONTEUDO\]\s*tema:\s*(.+?)\s*\|\s*formato:\s*(.+)/
    );
    if (actionMatch) {
      const [, tema, formato] = actionMatch;
      await bot.sendMessage(
        msg.chat.id,
        `📋 Entendido! Criando conteudo sobre: *${tema.trim()}*`,
        { parse_mode: 'Markdown' }
      );
      return handleConteudo(bot, msg, tema.trim(), formato.trim());
    }

    await bot.sendMessage(msg.chat.id, response);

    // Persist conversation (fire and forget)
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
  handleAjuda,
  handleStatus,
  handleFreeMessage,
};

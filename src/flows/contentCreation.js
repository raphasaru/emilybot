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

async function searchBrave(topic, braveSearchKey) {
  const key = braveSearchKey || process.env.BRAVE_SEARCH_KEY;
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
    const urls = results.map((r) => ({ url: r.url, title: r.title }));
    const text = results.map((r) => `- ${r.title} (${r.url})${r.description ? ': ' + r.description : ''}`).join('\n');
    return { text, urls };
  } catch (err) {
    logger.warn('Brave Search failed', { error: err.message });
    return null;
  }
}

async function searchGoogleNews(topic, apifyKey) {
  if (!apifyKey) {
    logger.warn('APIFY_KEY not set — skipping Google News search');
    return null;
  }

  const actorId = 'scrapestorm~google-news-scraper-fast-cheap-pay-per-results';
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyKey}&timeout=60&memory=256`;

  try {
    const response = await axios.post(
      url,
      { keyword: topic, language: 'Portuguese', country: 'Brazil 🇧🇷', maxitems: 8, time_filter: 'Recent 🔥' },
      { timeout: 70000 }
    );

    const items = Array.isArray(response.data) ? response.data : [];
    if (!items.length) return null;

    const urls = items.map((r) => ({ url: r.Link, title: r.Title }));
    const text = items
      .map((r) => `- ${r.Title} (${r['Source Name']}, ${r.Published_time || r.Date})\n  URL: ${r.Link}${r.Description ? '\n  ' + r.Description : ''}`)
      .join('\n');
    return { text, urls };
  } catch (err) {
    logger.warn('Google News (Apify) search failed', { error: err.message });
    return null;
  }
}

async function loadPipeline(tenantId) {
  let query = supabase
    .from('agents')
    .select('*')
    .eq('is_active', true)
    .not('position_in_flow', 'is', null)
    .order('position_in_flow');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data: agents, error } = await query;

  if (error) throw new Error(`Failed to load agents: ${error.message}`);
  if (!agents || !agents.length) throw new Error('No active agents in pipeline');
  return buildFlowPipeline(agents);
}

// Runs only the pesquisador (first agent). Returns research text + remaining agents.
async function runResearch(topics, tenantKeys, format) {
  logger.info('Running research phase', { topics, format });

  const pipeline = await loadPipeline(tenantKeys?.tenantId);
  const [researcher, ...remainingAgents] = pipeline;

  let searchData = null;
  if (format === 'carrossel_noticias' && tenantKeys?.apifyKey) {
    searchData = await searchGoogleNews(topics, tenantKeys.apifyKey);
    if (!searchData) searchData = await searchBrave(topics, tenantKeys?.braveSearchKey);
  } else {
    searchData = await searchBrave(topics, tenantKeys?.braveSearchKey);
  }

  const searchContext = searchData?.text
    ? `\n\nContexto de noticias recentes (Google News):\n${searchData.text}`
    : '';

  const input = `Tema: ${topics}${searchContext}`;
  const researchText = await runAgent(researcher.system_prompt, input, { geminiApiKey: tenantKeys?.geminiApiKey });

  return { researchText, remainingAgents, sourceUrls: searchData?.urls || [] };
}

// Runs redator + formatador on a chosen idea. Saves draft.
async function runContentFromResearch(researchText, chosenIdea, format, remainingAgents, tenantKeys) {
  logger.info('Running content from research', { chosenIdea, format });

  const formatNotes = {
    post_unico: '\n\nIMPORTANTE: Post unico para imagem. Maximo 400 caracteres. Sem hashtags. Conciso e impactante.',
    thread: '\n\nIMPORTANTE: Gere um array JSON de tweets. Cada tweet max 280 caracteres. Minimo 4 tweets. Ex: {"format":"thread","content":["1/4 texto...","2/4 texto..."],"publishing_notes":"..."}',
    reels_roteiro: '\n\nIMPORTANTE: Roteiro com secoes GANCHO (0-3s), DESENVOLVIMENTO (3-58s) e CTA (58-63s) separadas por linha em branco.',
    carrossel_noticias:
      '\n\nREGRA CRITICA: Use APENAS fatos que aparecem no contexto de pesquisa acima. NAO invente dados, versoes, datas ou comparacoes. Se a pesquisa nao menciona algo, NAO inclua. Precisao factual e obrigatoria em noticias.\n\n' +
      'IMPORTANTE: Carrossel de NOTICIA. Gere um JSON com 5-7 slides. Estrutura obrigatoria:\n' +
      '{"format":"carrossel_noticias","source_url":"URL da fonte principal","content":[\n' +
      '  {"type":"capa","headline":"titulo impactante da noticia","source":"nome do site fonte"},\n' +
      '  {"type":"resumo","title":"O que e?","body":"resumo claro da novidade em 2-3 frases"},\n' +
      '  {"type":"pontos","title":"Pontos-chave","items":["ponto 1","ponto 2","ponto 3","ponto 4"]},\n' +
      '  {"type":"impacto","title":"Por que importa?","body":"analise do impacto para o publico"},\n' +
      '  {"type":"cta","question":"pergunta engajante","action":"Siga para mais novidades"}\n' +
      '],"publishing_notes":"..."}\n' +
      'Pode ter 5-7 slides. Tipos extras permitidos: resumo, pontos, impacto (repita conforme necessario). Capa sempre primeiro, CTA sempre ultimo.',
  };
  const charLimitNote = formatNotes[format] || '';

  let currentInput = `Ideia escolhida: ${chosenIdea}\n\nContexto de pesquisa:\n${researchText}\n\nFormato desejado: ${format}${charLimitNote}`;
  const results = {};

  for (const agent of remainingAgents) {
    logger.info(`Running agent: ${agent.display_name}`);
    const output = await runAgent(agent.system_prompt, currentInput, { geminiApiKey: tenantKeys?.geminiApiKey });
    results[agent.name] = output;
    currentInput = `${output}\n\nFormato desejado: ${format}${charLimitNote}`;
  }

  const finalContent = results[remainingAgents[remainingAgents.length - 1]?.name] || '';

  const insertPayload = {
    topic: chosenIdea,
    format,
    draft: results.redator || null,
    final_content: finalContent,
    status: 'completed',
  };
  if (tenantKeys?.tenantId) insertPayload.tenant_id = tenantKeys.tenantId;

  const { data: draft, error: saveError } = await supabase
    .from('content_drafts')
    .insert(insertPayload)
    .select()
    .single();

  if (saveError) logger.error('Failed to save draft', { error: saveError.message });

  return { draft_id: draft?.id, final_content: finalContent };
}

// Full pipeline used by /conteudo command — backwards compatible.
async function runContentFlow(topic, format = 'post_unico', tenantKeys) {
  logger.info('Starting content flow', { topic, format });

  const { researchText, remainingAgents, sourceUrls } = await runResearch(topic, tenantKeys, format);
  const researchParsed = extractJsonFromText(researchText);

  const { draft_id, final_content } = await runContentFromResearch(
    researchText,
    researchParsed?.ideas?.[0]?.title || topic,
    format,
    remainingAgents,
    tenantKeys
  );

  return { draft_id, final_content, all_results: { pesquisador: researchText }, sourceUrls };
}

module.exports = {
  runContentFlow,
  runResearch,
  runContentFromResearch,
  buildFlowPipeline,
  extractJsonFromText,
  loadPipeline,
};

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

// Runs redator + formatador on a chosen idea. Saves draft.
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

// Full pipeline used by /conteudo command — backwards compatible.
async function runContentFlow(topic, format = 'post_unico') {
  logger.info('Starting content flow', { topic, format });

  const { researchText, remainingAgents } = await runResearch(topic);
  const researchParsed = extractJsonFromText(researchText);

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

'use strict';

const { supabase } = require('../database/supabase');

async function createAgent({ name, display_name, role, system_prompt, position_in_flow = null, tenant_id }) {
  const payload = { name, display_name, role, system_prompt, position_in_flow, is_active: true };
  if (tenant_id) payload.tenant_id = tenant_id;

  const { data, error } = await supabase
    .from('agents')
    .insert(payload)
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

async function getNextPosition(tenantId) {
  let query = supabase
    .from('agents')
    .select('position_in_flow')
    .not('position_in_flow', 'is', null);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  query = query.order('position_in_flow', { ascending: false }).limit(1).single();

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data ? data.position_in_flow + 1 : 1;
}

function defaultPipelineAgents(tenant) {
  const owner = tenant.owner_name || 'o usuario';
  const niche = tenant.niche || 'marketing digital';
  const spec = tenant.specialization || 'criacao de conteudo e gestao de trafego';
  return [
    {
      name: 'pesquisador',
      display_name: 'Pesquisador Estrategista',
      role: 'researcher',
      position_in_flow: 1,
      system_prompt: `Voce e um pesquisador e estrategista de conteudo especializado em ${niche} (${spec}).

Sua missao: pesquisar o que esta em alta agora nesses temas, identificar tendencias, novidades e oportunidades de conteudo. Entregue 3 a 5 sugestoes de pauta com:
- Titulo / gancho
- Por que esta em alta agora
- Publico-alvo principal
- Angulo diferenciado para ${owner} abordar

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
}`,
    },
    {
      name: 'redator',
      display_name: 'Redator Copywriter',
      role: 'writer',
      position_in_flow: 2,
      system_prompt: `Voce e o redator e copywriter de ${owner}, especializado em ${niche}.

Estilo de escrita:
- Tom direto, sem enrolacao
- Linguagem acessivel mas autoridade tecnica
- Foca em resultados praticos e aplicacao real
- Usa exemplos do dia a dia
- Nao e guru motivacional — e tecnico e pratico

Sua missao: transformar a pesquisa recebida em conteudo com a voz de ${owner}.
Entregue em JSON:
{
  "title": "...",
  "body": "...",
  "key_points": ["..."],
  "cta": "..."
}`,
    },
    {
      name: 'formatador',
      display_name: 'Formatador Adaptador',
      role: 'formatter',
      position_in_flow: 3,
      system_prompt: `Voce e o especialista em formatos de conteudo para redes sociais.
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
}`,
    },
  ];
}

async function seedDefaultPipeline(tenant) {
  if (!tenant?.id) throw new Error('Tenant ID required');

  // Check if tenant already has pipeline agents
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('tenant_id', tenant.id)
    .not('position_in_flow', 'is', null)
    .eq('is_active', true)
    .limit(1);

  if (existing?.length) {
    throw new Error('Pipeline ja existe. Use /agentes para ver.');
  }

  const agents = defaultPipelineAgents(tenant);
  const created = [];
  for (const a of agents) {
    created.push(await createAgent({ ...a, tenant_id: tenant.id }));
  }
  return created;
}

module.exports = { createAgent, deactivateAgent, getNextPosition, seedDefaultPipeline };

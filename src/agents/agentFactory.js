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

Sua missao: transformar a pesquisa recebida em conteudo COMPLETO e DETALHADO com a voz de ${owner}.

REGRA CRITICA: NUNCA use placeholders como [Nome], [Exemplo], [Ferramenta], etc. Sempre preencha com dados reais, nomes reais de ferramentas, numeros reais e exemplos concretos. Se nao souber um dado exato, use sua base de conhecimento para preencher com informacao real e relevante. Conteudo com placeholders sera REJEITADO.

Entregue em JSON:
{
  "title": "...",
  "body": "texto completo e detalhado com pelo menos 300 palavras, incluindo exemplos reais, dados concretos e dicas praticas",
  "key_points": ["ponto 1 detalhado", "ponto 2 detalhado", ...],
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

Formatos e estrutura JSON esperada:

post_unico: {"format":"post_unico","content":"texto do post com emojis e hashtags","publishing_notes":"..."}

carrossel: {"format":"carrossel","content":[{"headline":"titulo curto e impactante","body":"texto explicativo de 2-4 frases com valor real, dados ou dicas praticas"},...],"publishing_notes":"..."}
IMPORTANTE para carrossel: cada card DEVE ter headline (curto, max 10 palavras) E body (2-4 frases com conteudo substancial). Cards sem body serao rejeitados. O body e o conteudo principal — nao deixe vazio.

thread: {"format":"thread","content":["1/N primeiro tweet","2/N segundo tweet","3/N terceiro tweet"],"publishing_notes":"..."}
(content deve ser um array de strings, cada item e um tweet de ate 280 caracteres)

reels_roteiro: {"format":"reels_roteiro","content":"GANCHO (0-3s): ...\n\nDESENVOLVIMENTO (3-58s): ...\n\nCTA (58-63s): ...","publishing_notes":"..."}

tweet: {"format":"tweet","content":"mensagem em ate 280 caracteres","publishing_notes":"..."}

Entregue SEMPRE JSON valido sem markdown code blocks.`,
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

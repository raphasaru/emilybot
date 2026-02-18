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

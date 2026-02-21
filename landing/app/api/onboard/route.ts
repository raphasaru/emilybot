import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseServer';
import { encrypt } from '../../../lib/crypto';
import { createHash } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, bot_name, bot_token, chat_id, password, gemini_key, brave_key, fal_key } = body;

  // 1. Validate token
  const { data: lead } = await supabaseAdmin
    .from('waitlist_leads')
    .select('*')
    .eq('onboard_token', token)
    .single();

  if (!lead) return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  if (lead.status !== 'approved') return NextResponse.json({ error: 'Token já utilizado ou inválido' }, { status: 400 });

  // Check expiration (7 days)
  const approvedAt = new Date(lead.approved_at);
  const now = new Date();
  if (now.getTime() - approvedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Token expirado' }, { status: 400 });
  }

  // 2. Hash password (SHA-256, same as register-tenant.js)
  const passwordHash = createHash('sha256').update(password).digest('hex');

  // 3. Encrypt API keys (AES-256-GCM)
  const ENC_KEY = process.env.ENCRYPTION_KEY!;
  const encryptedGemini = encrypt(gemini_key, ENC_KEY);
  const encryptedBrave = brave_key ? encrypt(brave_key, ENC_KEY) : null;
  const encryptedFal = fal_key ? encrypt(fal_key, ENC_KEY) : null;

  // 4. Create tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: bot_name,
      bot_token: bot_token,
      chat_id: String(chat_id),
      gemini_api_key: encryptedGemini,
      brave_search_key: encryptedBrave,
      fal_key: encryptedFal,
      dashboard_password_hash: passwordHash,
      active: true,
    })
    .select()
    .single();

  if (tenantError) {
    return NextResponse.json({ error: `Erro ao criar bot: ${tenantError.message}` }, { status: 500 });
  }

  // 5. Seed default agents for new tenant
  const defaultAgents = [
    {
      tenant_id: tenant.id,
      name: 'pesquisador',
      display_name: 'Pesquisador Estrategista',
      role: 'researcher',
      system_prompt: `Voce e um pesquisador e estrategista de conteudo.

Sua missao: pesquisar o que esta em alta, identificar tendencias, novidades e oportunidades de conteudo. Entregue 3 a 5 sugestoes de pauta com:
- Titulo / gancho
- Por que esta em alta agora
- Publico-alvo principal
- Angulo diferenciado

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
      position_in_flow: 1,
    },
    {
      tenant_id: tenant.id,
      name: 'redator',
      display_name: 'Redator Copywriter',
      role: 'writer',
      system_prompt: `Voce e um redator e copywriter profissional.

Sua missao: transformar a pesquisa recebida em conteudo envolvente e de alta qualidade.
Entregue em JSON:
{
  "title": "...",
  "body": "...",
  "key_points": ["..."],
  "cta": "..."
}`,
      position_in_flow: 2,
    },
    {
      tenant_id: tenant.id,
      name: 'formatador',
      display_name: 'Formatador Adaptador',
      role: 'formatter',
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
      position_in_flow: 3,
    },
  ];

  await supabaseAdmin.from('agents').insert(defaultAgents);

  // 6. Update lead status
  await supabaseAdmin
    .from('waitlist_leads')
    .update({ status: 'onboarded' })
    .eq('id', lead.id);

  return NextResponse.json({
    success: true,
    botName: bot_name,
    message: 'Bot configurado com sucesso!',
  });
}

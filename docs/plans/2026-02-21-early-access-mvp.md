# EmilyBot Early Access MVP

## Visão Geral

3 peças:
- **Landing page** — Next.js separado, deploy Vercel, domínio `emilybot.com.br`. Copy PT-BR focada na dor do criador de conteúdo. Formulário de waitlist.
- **Tabelas Supabase** (projeto existente `lpvhhbiofqjgipxovyfd`) — `waitlist_leads` e `invite_codes`. Landing page fala direto com Supabase client (anon key).
- **Dashboard** (existente) — nova tela `/leads` pra listar e aprovar. Aprovação gera link único de onboarding.

## Fluxo

```
Lead chega na landing → preenche waitlist → salva no Supabase
  ↓
Admin vê no dashboard → aprova → gera link de onboarding
  ↓
Manda o link pro lead (Telegram/WhatsApp/manual)
  ↓
Lead acessa link → configura bot token + API keys → vira tenant
  ↓
Tenant ativo pode gerar até 3 códigos de convite via /invite
  ↓
Amigo usa código → entra na waitlist com prioridade (priority=true)
```

## Landing Page

**Stack:** Next.js 14 (App Router), Tailwind CSS, deploy Vercel.

**Seções:**

1. **Hero** — headline + subtítulo + CTA
   - "Conteúdo profissional no piloto automático"
   - "IA que pesquisa, escreve e cria imagens para suas redes sociais. Você só aprova e publica."
   - Botão: "Quero acesso antecipado"

2. **Dor → Solução** — 3 cards
   - "Sem tempo pra criar" → "IA pesquisa e escreve pra você"
   - "Design caro e lento" → "Imagens e carrosséis gerados em segundos"
   - "Sem consistência" → "Agendamento automático, todo dia tem conteúdo"

3. **Como funciona** — 3 steps visuais
   - 1) Descreva o tema → 2) IA cria rascunho + imagem → 3) Aprove e publique

4. **Formatos suportados** — ícones
   - Post, carrossel, thread, reels script, stories

5. **Social proof** (placeholder) — "Usado por X criadores no beta fechado"

6. **Waitlist CTA** — formulário (nome, email, Instagram handle opcional)

7. **Footer** — links básicos

**Copy:** PT-BR, tom direto e confiante, sem jargão técnico. Foco em resultado.

## Tabelas Supabase

### waitlist_leads
```sql
CREATE TABLE waitlist_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text UNIQUE NOT NULL,
  instagram     text,
  status        text DEFAULT 'pending',  -- pending | approved | onboarded | rejected
  priority      boolean DEFAULT false,   -- true = veio por convite
  invite_code   text,                    -- código usado
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  onboard_token text UNIQUE              -- gerado na aprovação, usado no link
);
```

### invite_codes
```sql
CREATE TABLE invite_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  code          text UNIQUE NOT NULL,    -- ex: "EMB-a3f8x2"
  used_by       uuid REFERENCES waitlist_leads(id),
  created_at    timestamptz DEFAULT now(),
  used_at       timestamptz
);
```

### RLS Policies

**waitlist_leads:**
- anon: INSERT only (signup)
- authenticated: SELECT, UPDATE (dashboard admin)

**invite_codes:**
- anon: SELECT where code match (validação de ref)
- authenticated: SELECT, INSERT, UPDATE (dashboard + bot)

## Dashboard — Tela /leads

**Lista:**
- Tabela: nome, email, instagram, status, prioridade, data
- Leads `priority=true` no topo com badge "Indicado"
- Filtros: todos | pendentes | aprovados | onboarded
- Ordenação: prioridade primeiro, depois data

**Ações:**
- **Aprovar** → status=approved, gera onboard_token, modal com link copiável
- Link: `https://emilybot.com.br/onboard?token=abc123`
- **Rejeitar** → status=rejected
- Contador: "12 pendentes | 5 aprovados | 3 ativos"

## Onboarding (rota na landing page)

**Rota:** `/onboard?token=xxx`

**Validação:** token existe, não expirado (7 dias), status=approved

**Formulário:**
- Nome do bot
- Bot token (BotFather)
- Chat ID
- Gemini API key
- Brave API key
- fal.ai API key

**Submit:** cria tenant (mesma lógica de register-tenant.js), muda lead status → onboarded.

**Sucesso:** instruções de como começar a usar.

## Sistema de Convites

**Geração:**
- Comando `/invite` no Telegram
- Bot gera código único (ex: `EMB-a3f8x2`) + link: `https://emilybot.com.br?ref=EMB-a3f8x2`
- Máximo 3 códigos por tenant
- Tenant precisa 24h ativo pra acessar `/invite`

**Uso:**
- `?ref=CODE` na URL da landing → campo hidden no form
- Lead salvo com `priority=true` e `invite_code=CODE`

**Status:**
- Comando `/invites` mostra status dos 3 códigos

**Regras:**
- Código one-time use
- Convite dá prioridade na fila, não acesso direto

## Fora do MVP

- Email automático
- Analytics
- Convites no dashboard (só Telegram por agora)
- Landing page em inglês
- A/B testing
- Payment/billing

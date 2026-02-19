# Design — Multi-Tenant MVP (Beta Testers)

**Data:** 2026-02-19
**Status:** Aprovado
**Objetivo:** Tornar EmilyBot replicável para beta testers, cada um com bot próprio, rodando numa única VPS.

---

## Decisões

| Decisão | Escolha |
|---------|---------|
| Bot por tester | Cada um cria no BotFather, token próprio |
| Hospedagem | VPS Hostinger KVM2 (2vCPU, 8GB RAM, 100GB NVMe) |
| API keys | Cada tester traz as suas (Gemini, Brave, fal.ai) |
| Onboarding | Registro manual via CLI por você |
| Isolamento de dados | `tenant_id` em todas as tabelas, mesmo Supabase |
| Customização | Agentes próprios + branding (cores, logo, fonte, preset) |
| Templates visuais | 3 presets base (modern, clean, bold) + customização via `/branding` |

---

## 1. Arquitetura Multi-Tenant

Um único processo Node.js gerencia N bots simultâneos via polling.

### Tabela `tenants` (nova)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | Identificador |
| name | text | Nome do tester |
| bot_token | text | Token do BotFather |
| gemini_api_key | text | Key Gemini do tester |
| brave_search_key | text | Key Brave do tester |
| fal_key | text | Key fal.ai do tester |
| chat_id | text | Telegram chat_id do tester |
| branding | jsonb | Cores, logo, fonte, preset |
| emily_tone | text | Tom de voz customizado (opcional) |
| active | boolean | Bot ativo ou pausado |
| created_at | timestamptz | Data de criação |

### Tabelas existentes

`agents`, `conversations`, `content_drafts`, `schedules` ganham coluna `tenant_id` (FK → tenants.id).

Todo SELECT/INSERT inclui `WHERE tenant_id = ?`. Um tester nunca vê dados de outro.

---

## 2. BotManager

Novo módulo `src/tenant/botManager.js`.

Responsável pelo ciclo de vida dos bots:
- No boot, carrega tenants ativos e chama `startBot(tenant)` pra cada
- Cada bot é um `node-telegram-bot-api` em polling, guardado num `Map<tenantId, bot>`
- Hot reload: registrar/pausar tenant tem efeito imediato sem restart

### Comandos admin (só você)

- `registrar(tenantData)` — insere tenant, inicia polling
- `pausar(tenantId)` — desativa, para polling
- `reativar(tenantId)` — reativa, reinicia polling
- `listar()` — mostra todos os tenants e status

### Fluxo de request

```
Mensagem Telegram → identifica bot_token → resolve tenant
→ middleware injeta tenant no ctx → handlers usam ctx.tenant
→ agentRunner usa ctx.tenant.gemini_api_key
→ contentCreation usa ctx.tenant.branding
```

---

## 3. Branding e Templates

### Campo `branding` (JSON)

```json
{
  "logo_url": "https://...",
  "primary_color": "#FF5722",
  "secondary_color": "#1A1A2E",
  "font": "Montserrat",
  "template_preset": "modern",
  "text_color": "#FFFFFF"
}
```

### Presets visuais (3 iniciais)

- **modern** — fundo escuro, cores vibrantes, sans-serif
- **clean** — fundo claro, minimalista
- **bold** — cores fortes, tipografia grande

### Comandos de customização

- `/branding` — mostra config atual
- `/branding cor #FF5722` — muda cor primária
- `/branding logo <url>` — muda logo
- `/branding preset modern` — troca preset
- `/branding fonte Roboto` — troca fonte

---

## 4. Deploy na VPS

### Stack

- Node.js (nvm)
- PM2 (process manager)
- Nginx (reverse proxy pro health endpoint)
- Git pull pra deploy

### Estrutura

```
/home/emilybot/
├── app/              ← git clone
├── .env              ← keys admin (Supabase, suas)
├── ecosystem.config.js  ← config PM2
└── logs/
```

### Processo

Um único processo Node.js. Polling de 10-20 bots consome ~100-200MB RAM. 8GB sobram.

### Deploy flow

```
ssh vps → cd app → git pull → pm2 restart emilybot
```

### Segurança

- `.env` com permissão 600, fora do repo
- Tokens dos testers no Supabase (HTTPS)
- Firewall: só porta 443 e 22

---

## 5. Migração do Código

### Módulos novos

- `src/tenant/botManager.js` — ciclo de vida dos bots
- `src/tenant/tenantService.js` — CRUD de tenants
- `scripts/register-tenant.js` — CLI de registro

### Módulos que mudam

| Módulo | Mudança |
|--------|---------|
| `src/index.js` | Chama `botManager.startAll()` em vez de criar 1 bot |
| `src/telegram/bot.js` | Factory recebe tenant, usa token do tenant |
| `src/telegram/middleware.js` | Injeta `ctx.tenant` em toda mensagem |
| `src/telegram/handlers.js` | Passa `tenant_id` em toda operação de banco |
| `src/agents/agentRunner.js` | Usa `tenant.gemini_api_key` em vez de `process.env` |
| `src/flows/contentCreation.js` | Usa keys e branding do tenant |
| `src/scheduler/cronManager.js` | Gerencia crons por tenant |
| `src/database/supabase.js` | Queries filtram por `tenant_id` |

### O que NÃO muda

- Lógica dos agentes, pipeline, formatos
- Supabase project (mesmo banco)
- Estrutura de pastas

---

## 6. Onboarding de Beta Tester

### Tester faz

1. Cria bot no @BotFather → recebe token
2. Cria conta Gemini → copia API key
3. Cria conta Brave Search → copia key
4. Cria conta fal.ai → copia key
5. Manda tudo + chat_id pra você

### Você faz

```bash
node scripts/register-tenant.js \
  --name "João" \
  --bot_token "123:ABC" \
  --chat_id "99999" \
  --gemini_key "AIza..." \
  --brave_key "BSA..." \
  --fal_key "xxx"
```

Bot do tester fica online imediatamente.

### Tester recebe

- Mensagem de boas-vindas automática
- Pode usar todos os comandos
- `/branding` pra personalizar visual

---

## Decisões Complementares

| Questão | Decisão |
|---------|---------|
| Limite de testers | Sem limite fixo, monitorar uso |
| Backup | Backup automático do Supabase (suficiente pro beta) |
| Criptografia de keys | Criptografar com AES-256 + master key na VPS (simples, `crypto` nativo do Node) |
| Rate limiting | Máximo 6 pipelines/hora por tenant |
| Bot token revogado | 4 falhas de polling seguidas → desativa tenant + notifica admin |

gs# PRD — Sistema de Agentes de IA: Emily COO

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Autor:** Raphael (via Claude)  
**Stack:** Claude Code · Node.js · Telegram Bot API · Anthropic SDK · Supabase · Cron Jobs

---

## 1. Visão Geral

Construir um sistema de agentes de IA orquestrado por uma COO virtual chamada **Emily**, acessível via Telegram. Emily gerencia e delega tarefas para subagentes especializados criados dinamicamente pelo usuário. O sistema suporta execução sob demanda (via chat) e execução agendada (Cron Jobs), com monitoramento via heartbeat.

O caso de uso principal inicial é a **criação automatizada de conteúdo para redes sociais** sobre os temas: Inteligência Artificial, Meta Ads, Google Ads, Gestão de Tráfego, Marketing Digital e Automações.

---

## 2. Objetivos do Produto

- Substituir o Openclaw por uma solução própria, com controle total do código e menor custo operacional
- Permitir que o usuário interaja com Emily via Telegram pelo celular
- Permitir criação dinâmica de novos subagentes através de conversa com Emily
- Suportar fluxos automáticos agendados (Cron Jobs) para criação de conteúdo diário
- Implementar heartbeat para monitoramento da saúde do sistema
- Ser expansível: novos agentes e habilidades podem ser adicionados sem refatorar a base

---

## 3. Arquitetura do Sistema

```
Telegram (usuário)
       │
       ▼
  Telegram Bot (webhook)
       │
       ▼
  Emily - Orquestradora (COO)
  ├── Interpreta intenção do usuário
  ├── Decide qual(is) subagente(s) acionar
  ├── Cria/configura novos subagentes quando solicitado
  └── Retorna resposta consolidada ao Telegram
       │
  ┌────┴──────────────────────────────────────┐
  │             Subagentes                     │
  │  ┌──────────────┐  ┌──────────────────┐   │
  │  │ Pesquisador  │  │    Redator       │   │
  │  │ Estrategista │  │  (Copywriter)    │   │
  │  └──────────────┘  └──────────────────┘   │
  │  ┌──────────────┐  ┌──────────────────┐   │
  │  │  Formatador  │  │  [+ novos que    │   │
  │  │  Adaptador   │  │   user criar]    │   │
  │  └──────────────┘  └──────────────────┘   │
  └────────────────────────────────────────────┘
       │
  ┌────┴────────────────┐
  │  Supabase           │
  │  ├── agents         │  (configurações dos agentes)
  │  ├── conversations  │  (histórico de conversas)
  │  ├── content_drafts │  (conteúdos gerados)
  │  └── schedules      │  (Cron Jobs configurados)
  └─────────────────────┘
       │
  ┌────┴──────────────┐
  │  Cron Service     │
  │  + Heartbeat      │
  └───────────────────┘
```

---

## 4. Agentes

### 4.1 Emily — COO (Orquestradora Principal)

**Responsabilidades:**
- Receber e interpretar todas as mensagens do usuário via Telegram
- Decidir quais subagentes acionar e em que sequência
- Orquestrar o fluxo entre múltiplos subagentes (output de um vira input do próximo)
- Criar novos subagentes: fazer onboarding interativo com o usuário (nome, função, tom, instruções específicas)
- Reportar progresso e resultado final ao usuário
- Gerenciar agendamentos (criar, editar, pausar Cron Jobs) por comando de voz/texto
- Responder perguntas sobre o status do sistema

**System Prompt base de Emily:**
```
Você é Emily, COO e orquestradora de uma equipe de agentes de IA que trabalha para Raphael, 
um gestor de tráfego e criador de conteúdo especializado em Meta Ads, Google Ads, IA e marketing digital.

Suas responsabilidades:
1. Entender o que Raphael precisa e acionar os subagentes corretos
2. Coordenar o fluxo de trabalho entre agentes
3. Criar novos subagentes quando solicitado, coletando: nome, função, tom de voz, instruções específicas
4. Reportar resultados de forma clara e objetiva
5. Gerenciar agendamentos e automações

Seja direta, profissional e proativa. Quando acionar múltiplos agentes, informe o progresso.
```

---

### 4.2 Pesquisador Estrategista

**Nome padrão:** `pesquisador`  
**Função:** Pesquisar tendências, novidades e ideias sobre os temas do usuário. Sugerir pautas e ângulos de conteúdo com base no que está em alta.

**Capacidades:**
- Busca web por tendências (via web search tool ou Serper API)
- Análise de concorrentes e temas em alta
- Sugestão de 3–5 ideias de conteúdo com justificativa
- Retorna dados estruturados para o Redator

**Inputs:** tema solicitado ou temas configurados  
**Outputs:** lista de ideias com contexto de tendência, fontes relevantes, gancho sugerido

**System Prompt:**
```
Você é um pesquisador e estrategista de conteúdo especializado em:
- Inteligência Artificial (LLMs, automação, agentes de IA)
- Meta Ads e Google Ads
- Gestão de tráfego e marketing digital
- Automações de marketing

Sua missão: pesquisar o que está em alta agora nesses temas, identificar tendências, 
novidades e oportunidades de conteúdo. Entregue 3 a 5 sugestões de pauta com:
- Título / gancho
- Por que está em alta agora
- Público-alvo principal
- Ângulo diferenciado para o Raphael abordar
```

---

### 4.3 Redator (Copywriter)

**Nome padrão:** `redator`  
**Função:** Recebe a pesquisa do Pesquisador e transforma em rascunho de conteúdo com a voz e estilo do Raphael.

**Capacidades:**
- Criar roteiro/texto base para o conteúdo
- Adaptar tom: educativo, direto, provocativo, storytelling
- Manter consistência com a voz do Raphael (experiente, prático, sem enrolação)
- Indicar pontos-chave e CTAs sugeridos

**Inputs:** pesquisa estruturada do Pesquisador + tema/formato desejado  
**Outputs:** texto base do conteúdo, pontos principais, CTA

**System Prompt:**
```
Você é o redator e copywriter do Raphael, um gestor de tráfego e criador de conteúdo sobre 
IA, Meta Ads, Google Ads e marketing digital.

Estilo de escrita do Raphael:
- Tom direto, sem enrolação
- Linguagem acessível mas autoridade técnica
- Foca em resultados práticos e aplicação real
- Usa exemplos do dia a dia do gestor de tráfego
- Não é guru motivacional — é técnico e prático

Sua missão: transformar a pesquisa recebida em conteúdo com a voz do Raphael. 
Entregue: texto corrido do conteúdo, principais pontos, CTA sugerido.
```

---

### 4.4 Formatador / Adaptador

**Nome padrão:** `formatador`  
**Função:** Pega o conteúdo do Redator e adapta para o formato final de publicação.

**Formatos suportados:**
- **Carrossel** (Instagram/LinkedIn): slides 1 a N com título, corpo, CTA final
- **Post único** (Instagram/Facebook): caption otimizada com hashtags
- **Post para X (Twitter):** tweet de até 280 caracteres
- **Thread para X:** sequência numerada de tweets
- **Reels/Short:** roteiro com gancho, desenvolvimento e CTA em até 60s

**Inputs:** texto base do Redator + formato desejado  
**Outputs:** conteúdo pronto para publicar, formatado e com instruções de design/publicação se necessário

**System Prompt:**
```
Você é o especialista em formatos de conteúdo para redes sociais.
Sua missão: adaptar o conteúdo recebido para o formato solicitado.

Formatos disponíveis:
- carrossel: slides numerados com capa, desenvolvimento e CTA
- post_unico: caption completa com emojis estratégicos e hashtags
- tweet: mensagem impactante em até 280 caracteres
- thread: sequência de tweets numerados (1/N)
- reels_roteiro: gancho (3s) + desenvolvimento (até 55s) + CTA (5s)

Entregue sempre: conteúdo formatado + instruções de publicação.
```

---

## 5. Criação Dinâmica de Subagentes

### 5.1 Fluxo de Onboarding via Telegram

Quando o usuário pedir para criar um novo agente, Emily conduz o seguinte fluxo:

```
Usuário: "Emily, quero criar um novo agente"

Emily: "Ótimo! Vou te fazer algumas perguntas para configurar o novo agente.
        1. Qual o nome desse agente?"

Usuário: "Revisor"

Emily: "Perfeito. Qual é a função principal do Revisor?
        O que ele deve fazer?"

Usuário: "Revisar o conteúdo final antes de publicar, checar gramática, 
          coerência e se está no tom certo"

Emily: "Entendido. Tem alguma instrução específica ou estilo que ele deve seguir?"

Usuário: "Ser rigoroso com clareza. Nada de linguagem muito formal."

Emily: "Configurando o Revisor agora..."
[Salva no banco e ativa o agente]
Emily: "Pronto! O agente Revisor foi criado e já está disponível na equipe. 
        Deseja que eu acione ele no fluxo de criação de conteúdo?"
```

### 5.2 Schema do Agente no Supabase

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tools JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  position_in_flow INTEGER,   -- ordem no pipeline de criação de conteúdo
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Integração com Telegram

### 6.1 Configuração

- Criar bot via @BotFather
- Configurar webhook para o servidor (Railway, Fly.io ou VPS)
- Restringir acesso ao chat_id do Raphael (segurança)
- Suportar mensagens de texto e comandos (/)

### 6.2 Comandos disponíveis

| Comando | Função |
|---|---|
| `/start` | Apresentação do sistema |
| `/agentes` | Lista todos os agentes ativos |
| `/criar_agente` | Inicia onboarding de novo agente |
| `/conteudo [tema]` | Dispara fluxo de criação manual |
| `/agendamentos` | Lista Cron Jobs ativos |
| `/pausar [job_id]` | Pausa um agendamento |
| `/status` | Status do sistema e heartbeat |
| `/ajuda` | Lista todos os comandos |

### 6.3 Mensagens livres

Qualquer mensagem não-comando vai direto para Emily interpretar. Exemplos:

- *"Cria um post sobre as novidades do Meta Ads de 2025"*
- *"Faz uma thread pra minha audiência sobre agentes de IA"*
- *"Agenda criação de conteúdo todo dia às 8h"*
- *"Adiciona o Revisor no fluxo depois do Redator"*

---

## 7. Agendamentos (Cron Jobs)

### 7.1 Configuração via Telegram

O usuário pode configurar agendamentos em linguagem natural. Emily interpreta e cria o Cron:

```
Usuário: "Emily, quero que você crie conteúdo todo dia às 8h da manhã"

Emily: "Entendido! Vou criar um agendamento diário às 8h. 
        Qual tema padrão devo usar? Ou prefere que eu escolha baseado 
        nas tendências do dia?"

Usuário: "Escolhe você com base nas tendências"

Emily: "Perfeito. Agendamento criado: todos os dias às 08:00 (horário de Brasília)
        o Pesquisador vai identificar a melhor pauta do dia e o fluxo completo 
        vai rodar automaticamente. Você recebe o resultado aqui no Telegram."
```

### 7.2 Schema no Supabase

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,       -- ex: "0 8 * * *"
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  flow_type TEXT NOT NULL,             -- 'content_creation', 'custom'
  flow_config JSONB,                   -- agentes a usar, tema padrão, formato
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.3 Exemplos de Cron Expressions

| Frequência | Expressão |
|---|---|
| Diário às 8h | `0 8 * * *` |
| Segunda e Quinta às 9h | `0 9 * * 1,4` |
| A cada 6 horas | `0 */6 * * *` |
| Dias úteis às 7h | `0 7 * * 1-5` |

---

## 8. Heartbeat e Monitoramento

### 8.1 O que é

Sistema de "batimento cardíaco" que verifica periodicamente se todos os componentes do sistema estão funcionando e notifica o usuário se algo falhar.

### 8.2 Verificações

| Componente | Verificação | Frequência |
|---|---|---|
| Bot do Telegram | Conexão ativa | A cada 5 min |
| Anthropic API | Resposta ao endpoint | A cada 10 min |
| Supabase | Query de teste | A cada 5 min |
| Cron Jobs | Último run vs esperado | A cada 15 min |
| Agentes | Configurações válidas | A cada hora |

### 8.3 Notificações

- **Falha crítica:** mensagem imediata no Telegram do usuário
- **Falha recuperada:** notificação de restauração
- **Relatório diário:** resumo de saúde do sistema às 7h

```
Emily → Telegram:
"⚠️ Alerta: o Cron Job 'Conteúdo Diário' falhou às 08:00.
Motivo: timeout na API de pesquisa.
Tentando reexecutar em 15 minutos..."
```

### 8.4 Schema no Supabase

```sql
CREATE TABLE heartbeat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'ok', 'warning', 'error'
  message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Fluxo Completo de Criação de Conteúdo

```
1. Trigger (manual via Telegram OU Cron Job)
         │
2. Emily recebe e interpreta a solicitação
         │
3. Emily aciona o Pesquisador Estrategista
   → Input: tema(s) configurados ou livre
   → Output: 3-5 ideias com contexto
         │
4. Emily apresenta ideias ao usuário (se manual)
   OU escolhe automaticamente (se Cron)
         │
5. Emily aciona o Redator
   → Input: ideia escolhida + pesquisa
   → Output: texto base + pontos-chave + CTA
         │
6. Emily aciona o Formatador
   → Input: texto base + formato desejado
   → Output: conteúdo formatado e pronto
         │
7. [Opcional] Emily aciona agentes extras configurados
   → Ex: Revisor, Tradutor, etc.
         │
8. Emily entrega o resultado no Telegram
   → Conteúdo pronto para copiar/publicar
   → Salva draft no Supabase
```

---

## 10. Estrutura de Arquivos do Projeto

```
emily-agent-system/
├── src/
│   ├── agents/
│   │   ├── emily.js              # Orquestradora principal
│   │   ├── researcher.js         # Pesquisador Estrategista
│   │   ├── writer.js             # Redator
│   │   ├── formatter.js          # Formatador/Adaptador
│   │   └── agentFactory.js       # Criação dinâmica de agentes
│   ├── telegram/
│   │   ├── bot.js                # Setup do bot e webhook
│   │   ├── handlers.js           # Handlers de mensagens e comandos
│   │   └── middleware.js         # Auth por chat_id
│   ├── scheduler/
│   │   ├── cronManager.js        # Gerenciamento de Cron Jobs
│   │   └── heartbeat.js          # Sistema de heartbeat
│   ├── database/
│   │   ├── supabase.js           # Client Supabase
│   │   └── migrations/           # Migrations SQL
│   ├── flows/
│   │   └── contentCreation.js    # Fluxo de criação de conteúdo
│   └── utils/
│       ├── logger.js
│       └── prompts.js            # Templates de prompts
├── .env.example
├── package.json
└── README.md
```

---

## 11. Variáveis de Ambiente

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_ID=...    # Seu chat_id pessoal

# Supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...

# Busca Web (opcional - para o Pesquisador)
SERPER_API_KEY=...               # ou BRAVE_SEARCH_KEY

# App
PORT=3000
NODE_ENV=production
TIMEZONE=America/Sao_Paulo
```

---

## 12. Stack e Dependências

| Dependência | Uso |
|---|---|
| `@anthropic-ai/sdk` | SDK oficial da Anthropic (Claude) |
| `node-telegram-bot-api` | Integração com Telegram |
| `@supabase/supabase-js` | Banco de dados e persistência |
| `node-cron` | Cron Jobs nativos em Node.js |
| `express` | Servidor para webhook do Telegram |
| `dotenv` | Variáveis de ambiente |
| `axios` | Chamadas HTTP (ex: Serper API) |
| `winston` | Logging |

---

## 13. Fases de Desenvolvimento

### Fase 1 — MVP (Semana 1-2)
- [ ] Setup do projeto Node.js e variáveis de ambiente
- [ ] Conexão com Supabase e migrations iniciais
- [ ] Emily básica: recebe mensagem → aciona agente → retorna resposta
- [ ] Telegram bot com autenticação por chat_id
- [ ] Pesquisador, Redator e Formatador funcionando em sequência
- [ ] Comando `/conteudo` funcionando

### Fase 2 — Automações (Semana 3)
- [ ] Cron Jobs via `node-cron`
- [ ] Comandos de agendamento no Telegram
- [ ] Heartbeat básico com notificação de falha
- [ ] Logs no Supabase

### Fase 3 — Criação Dinâmica de Agentes (Semana 3-4)
- [ ] Fluxo de onboarding de novo agente via Telegram
- [ ] AgentFactory: cria, salva e ativa agentes dinamicamente
- [ ] Edição e desativação de agentes existentes
- [ ] Emily consegue inserir novos agentes no pipeline

### Fase 4 — Polimento (Semana 4+)
- [ ] Relatório diário de saúde do sistema
- [ ] Interface de listagem de conteúdos gerados
- [ ] Suporte a múltiplos formatos de output
- [ ] Documentação de uso

---

## 14. Critérios de Aceite

- ✅ Raphael consegue pedir conteúdo via Telegram e receber o resultado em menos de 2 minutos
- ✅ Emily cria novos subagentes via conversa no Telegram sem necessidade de código
- ✅ Cron Jobs rodam no horário correto (fuso de Brasília) e entregam no Telegram
- ✅ Heartbeat notifica falhas em menos de 10 minutos
- ✅ Sistema reinicia automaticamente em caso de crash (via PM2 ou Railway)
- ✅ Todo conteúdo gerado é salvo no Supabase com timestamp e metadados
- ✅ Acesso restrito ao chat_id do Raphael

---

## 15. Considerações de Segurança

- Whitelist de `chat_id` no middleware do Telegram (ninguém além de Raphael acessa)
- Variáveis sensíveis nunca no código — sempre em `.env`
- Service key do Supabase apenas no backend, nunca exposta
- Rate limiting nas chamadas à Anthropic API para controle de custos
- Logs sem dados sensíveis

---

*PRD criado para ser utilizado diretamente pelo Claude Code como briefing de implementação.*

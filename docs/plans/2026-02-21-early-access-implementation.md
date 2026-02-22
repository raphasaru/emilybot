# EmilyBot Early Access — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Landing page + waitlist + invite system for beta tester onboarding.

**Architecture:** Landing page (Next.js, Vercel, `emilybot.com.br`) → Supabase (existing project, new tables with RLS) → Dashboard (new `/leads` route) → Bot (new `/invite` `/invites` commands). Onboarding page on landing creates tenant via API route that replicates `register-tenant.js` logic.

**Tech Stack:** Next.js 14, Tailwind CSS, @supabase/supabase-js, existing dashboard (Next.js/TS), existing bot (Node.js/CommonJS)

**Design doc:** `docs/plans/2026-02-21-early-access-mvp.md`

---

## Task 1: Supabase Migration — waitlist_leads & invite_codes

**Files:**
- Create: `src/database/migrations/007_waitlist.sql`

**Step 1: Write migration**

```sql
-- 007_waitlist.sql

CREATE TABLE IF NOT EXISTS waitlist_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text UNIQUE NOT NULL,
  instagram     text,
  status        text DEFAULT 'pending',
  priority      boolean DEFAULT false,
  invite_code   text,
  created_at    timestamptz DEFAULT now(),
  approved_at   timestamptz,
  onboard_token text UNIQUE
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  code          text UNIQUE NOT NULL,
  used_by       uuid REFERENCES waitlist_leads(id),
  created_at    timestamptz DEFAULT now(),
  used_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_leads(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_priority ON waitlist_leads(priority);
CREATE INDEX IF NOT EXISTS idx_waitlist_token ON waitlist_leads(onboard_token);
CREATE INDEX IF NOT EXISTS idx_invite_codes_tenant ON invite_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- RLS
ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- waitlist_leads: anon can INSERT only (signup form)
CREATE POLICY waitlist_anon_insert ON waitlist_leads
  FOR INSERT TO anon
  WITH CHECK (true);

-- waitlist_leads: anon can SELECT own row by email (duplicate check)
CREATE POLICY waitlist_anon_select ON waitlist_leads
  FOR SELECT TO anon
  USING (true);

-- waitlist_leads: service_role bypasses RLS automatically

-- invite_codes: anon can SELECT by code (ref validation)
CREATE POLICY invite_anon_select ON invite_codes
  FOR SELECT TO anon
  USING (true);
```

**Step 2: Run migration on Supabase**

Go to Supabase SQL Editor → paste and run. Verify tables exist with `SELECT * FROM waitlist_leads LIMIT 1;` and `SELECT * FROM invite_codes LIMIT 1;`.

**Step 3: Commit**

```bash
git add src/database/migrations/007_waitlist.sql
git commit -m "feat: add waitlist_leads and invite_codes tables with RLS"
```

---

## Task 2: Landing Page — Project Setup

**Files:**
- Create: `landing/` directory (new Next.js project, separate from `dashboard/`)

**Step 1: Scaffold Next.js project**

```bash
cd /Users/charbellelopes/emilybot
npx create-next-app@14 landing --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
```

**Step 2: Install Supabase client**

```bash
cd /Users/charbellelopes/emilybot/landing
npm install @supabase/supabase-js
```

**Step 3: Create env file**

Create `landing/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://lpvhhbiofqjgipxovyfd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
```

**Step 4: Create Supabase client**

Create `landing/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Step 5: Clean up defaults**

- Delete `landing/app/page.tsx` default content (will be replaced in Task 3)
- Delete `landing/public/` default SVGs
- Update `landing/app/layout.tsx`: set lang="pt-BR", title="EmilyBot — Conteúdo no Piloto Automático", add Google Fonts (Syne + Inter)

**Step 6: Configure Tailwind**

Update `landing/tailwind.config.ts` — extend with brand colors:
```ts
theme: {
  extend: {
    colors: {
      brand: { purple: '#A78BFA', dark: '#09090B', card: '#13131A', border: '#1C1C22' },
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      display: ['Syne', 'sans-serif'],
    },
  },
},
```

**Step 7: Commit**

```bash
git add landing/
git commit -m "feat: scaffold landing page Next.js project"
```

---

## Task 3: Landing Page — Hero + Pain/Solution + How It Works

**Files:**
- Create: `landing/app/page.tsx`
- Create: `landing/app/components/Hero.tsx`
- Create: `landing/app/components/PainSolution.tsx`
- Create: `landing/app/components/HowItWorks.tsx`
- Create: `landing/app/components/Formats.tsx`
- Create: `landing/app/components/SocialProof.tsx`
- Create: `landing/app/components/Footer.tsx`

**Step 1: Build page.tsx as composition of sections**

```tsx
// landing/app/page.tsx
import Hero from './components/Hero';
import PainSolution from './components/PainSolution';
import HowItWorks from './components/HowItWorks';
import Formats from './components/Formats';
import SocialProof from './components/SocialProof';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main className="bg-brand-dark text-white min-h-screen">
      <Hero />
      <PainSolution />
      <HowItWorks />
      <Formats />
      <SocialProof />
      <Footer />
    </main>
  );
}
```

**Step 2: Build Hero component**

- Headline: "Conteúdo profissional no piloto automático"
- Subtitle: "IA que pesquisa, escreve e cria imagens para suas redes sociais. Você só aprova e publica."
- CTA button scrolls to waitlist form (anchor `#waitlist`)
- Read `?ref=` from URL and store in state (pass to WaitlistForm)

**Step 3: Build PainSolution — 3 cards**

Cards with icon + pain + arrow + solution:
1. "Sem tempo pra criar" → "IA pesquisa e escreve pra você"
2. "Design caro e lento" → "Imagens e carrosséis gerados em segundos"
3. "Sem consistência" → "Agendamento automático, todo dia tem conteúdo"

**Step 4: Build HowItWorks — 3 numbered steps**

1. Descreva o tema
2. IA cria rascunho + imagem
3. Aprove e publique

**Step 5: Build Formats — icon grid**

Post, Carrossel, Thread, Reels Script, Stories — simple icon + label cards.

**Step 6: Build SocialProof placeholder**

"Usado por criadores no beta fechado" — minimal section, can be updated later.

**Step 7: Build Footer**

Simple footer with EmilyBot logo/name, copyright, maybe link to Instagram.

**Step 8: Run dev server and visually verify**

```bash
cd /Users/charbellelopes/emilybot/landing && npm run dev
```

**Step 9: Commit**

```bash
git add landing/app/
git commit -m "feat: landing page sections — hero, pain/solution, how it works, formats, footer"
```

---

## Task 4: Landing Page — Waitlist Form

**Files:**
- Create: `landing/app/components/WaitlistForm.tsx`
- Modify: `landing/app/page.tsx` (add WaitlistForm section)

**Step 1: Build WaitlistForm component**

```tsx
'use client';
// Form fields: name, email, instagram (optional)
// Hidden field: ref (from URL ?ref=CODE)
// On submit:
//   1. Check if invite_code is valid (if ref provided): supabase.from('invite_codes').select('id,used_by').eq('code', ref).single()
//      - If used_by is not null → show "Código já utilizado"
//   2. Insert into waitlist_leads: { name, email, instagram, priority: !!ref, invite_code: ref || null }
//   3. If ref valid → update invite_codes: set used_by = lead.id, used_at = now()
//   4. Show success message: "Você está na lista! Avisaremos quando sua vez chegar."
//   5. Handle duplicate email error → show "Este email já está cadastrado"
```

**Step 2: Style — dark theme matching dashboard aesthetic**

Use brand colors from tailwind config. Purple CTA button. Inputs with dark bg + border.

**Step 3: Add to page.tsx**

Add `<WaitlistForm />` section with `id="waitlist"` anchor.

**Step 4: Test manually**

- Submit form → verify row in Supabase `waitlist_leads`
- Submit with `?ref=INVALID` → should still work, just no priority
- Submit duplicate email → error message

**Step 5: Commit**

```bash
git add landing/app/components/WaitlistForm.tsx landing/app/page.tsx
git commit -m "feat: waitlist form with ref code tracking"
```

---

## Task 5: Dashboard — Leads Page

**Files:**
- Create: `dashboard/src/app/leads/page.tsx`
- Create: `dashboard/src/app/leads/LeadsList.tsx`
- Modify: `dashboard/middleware.ts` (no change needed — `/leads` already protected)

**Step 1: Create server component page**

```tsx
// dashboard/src/app/leads/page.tsx
export const dynamic = 'force-dynamic';
import { getSupabase, getTenantId } from '../lib/supabase';
import LeadsList from './LeadsList';

export default async function LeadsPage() {
  const tenantId = await getTenantId();
  if (!tenantId) redirect('/login');
  const supabase = getSupabase();
  const { data: leads } = await supabase
    .from('waitlist_leads')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });
  return <LeadsList leads={leads || []} />;
}
```

Note: This is an admin-only page. Only the main admin (Raphael) manages leads. No tenant_id filter needed on waitlist_leads — it's a global table.

**Step 2: Build LeadsList client component**

Features:
- Stats bar: pendentes | aprovados | onboarded counters
- Filter tabs: Todos | Pendentes | Aprovados | Onboarded
- Table columns: nome, email, instagram, status badge, prioridade badge ("Indicado"), data
- Priority leads at top
- **Approve button** → POST `/api/leads/[id]/approve`
- **Reject button** → POST `/api/leads/[id]/reject`
- Modal after approve: shows copyable onboarding link `https://emilybot.com.br/onboard?token=xxx`

Style: match existing dashboard aesthetic (dark theme, Syne font, purple accent, same table patterns as DraftsList).

**Step 3: Create approve API route**

Create `dashboard/src/app/api/leads/[id]/approve/route.ts`:
```ts
// POST /api/leads/[id]/approve
// 1. getTenantId() for auth check
// 2. Generate onboard_token (crypto.randomUUID())
// 3. Update waitlist_leads: status='approved', approved_at=now(), onboard_token
// 4. Return { onboard_token, link: `https://emilybot.com.br/onboard?token=${token}` }
```

**Step 4: Create reject API route**

Create `dashboard/src/app/api/leads/[id]/reject/route.ts`:
```ts
// POST /api/leads/[id]/reject
// Update waitlist_leads: status='rejected'
```

**Step 5: Add nav link to /leads**

Add "Leads" link in the dashboard navigation (check where existing nav links are — likely in layout or a shared component).

**Step 6: Test manually**

- Insert test lead via Supabase SQL: `INSERT INTO waitlist_leads (name, email) VALUES ('Teste', 'test@test.com');`
- Visit `/leads` → see lead
- Click Approve → get link
- Click Reject → status changes

**Step 7: Commit**

```bash
git add dashboard/src/app/leads/ dashboard/src/app/api/leads/
git commit -m "feat: dashboard leads management page with approve/reject"
```

---

## Task 6: Landing Page — Onboarding Page

**Files:**
- Create: `landing/app/onboard/page.tsx`
- Create: `landing/app/api/onboard/route.ts`

**Step 1: Build onboarding page**

```tsx
// landing/app/onboard/page.tsx
'use client';
// 1. Read ?token= from URL
// 2. Validate token: supabase.from('waitlist_leads').select('*').eq('onboard_token', token).single()
//    - If not found → "Link inválido"
//    - If status != 'approved' → "Link já utilizado" or "Ainda não aprovado"
//    - If approved_at + 7 days < now → "Link expirado"
// 3. Show form:
//    - Nome do bot (text)
//    - Bot Token (text, from BotFather)
//    - Chat ID (text)
//    - Senha do dashboard (password + confirm)
//    - Gemini API Key (text)
//    - Brave API Key (text)
//    - fal.ai API Key (text)
//    - Helper text under each field explaining how to get the value
// 4. Submit → POST /api/onboard
```

**Step 2: Build onboarding API route**

```ts
// landing/app/api/onboard/route.ts
// This route needs SUPABASE_SERVICE_KEY (server-side, not anon)
// Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (separate from NEXT_PUBLIC_ vars)
//
// 1. Validate token (same checks as client)
// 2. Hash dashboard password (SHA-256, same as register-tenant.js)
// 3. Encrypt API keys (replicate crypto.js AES-256-GCM logic)
//    - Need ENCRYPTION_KEY in landing/.env.local
// 4. Insert into tenants table (replicate tenantService.createTenant logic):
//    { name, bot_token, chat_id, gemini_api_key (encrypted), brave_search_key (encrypted),
//      fal_key (encrypted), dashboard_password_hash, active: true }
// 5. Seed default agents for new tenant (pesquisador, redator, formatador)
//    - Copy from 001_initial_schema.sql seed data, but with new tenant_id
// 6. Update waitlist_leads: status='onboarded'
// 7. Return success + instructions
```

**Step 3: Add env vars to landing/.env.local**

```
SUPABASE_URL=https://lpvhhbiofqjgipxovyfd.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
ENCRYPTION_KEY=<same-key-as-bot-.env>
```

**Step 4: Create server Supabase client**

Create `landing/lib/supabaseServer.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

**Step 5: Create encrypt utility**

Create `landing/lib/crypto.ts` — port of `src/utils/crypto.js` to TypeScript:
```ts
import crypto from 'crypto';
const ALGO = 'aes-256-gcm';

export function encrypt(text: string, hexKey: string): string | null {
  if (!text) return null;
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}
```

**Step 6: Test manually**

- Approve a lead in dashboard → get link
- Open link → fill form → submit
- Verify tenant created in Supabase `tenants` table
- Verify lead status = 'onboarded'
- Verify agents seeded for new tenant

**Step 7: Commit**

```bash
git add landing/app/onboard/ landing/app/api/onboard/ landing/lib/supabaseServer.ts landing/lib/crypto.ts
git commit -m "feat: self-service onboarding page creates tenant from approved lead"
```

---

## Task 7: Bot — /invite and /invites Commands

**Files:**
- Modify: `src/telegram/handlers.js` (add handleInvite, handleInvites)
- Modify: `src/telegram/bot.js` (register new commands)

**Step 1: Add handleInvite to handlers.js**

```js
async function handleInvite(bot, msg, tenant) {
  const chatId = msg.chat.id;

  // Check 24h active rule
  const tenantCreated = new Date(tenant.created_at);
  const now = new Date();
  if (now - tenantCreated < 24 * 60 * 60 * 1000) {
    return bot.sendMessage(chatId, '⏳ Você poderá convidar amigos após 24h de uso.');
  }

  // Count existing codes
  const { data: existing } = await supabase
    .from('invite_codes')
    .select('id')
    .eq('tenant_id', tenant.id);

  if (existing && existing.length >= 3) {
    return bot.sendMessage(chatId, '🎫 Você já usou seus 3 convites. Use /invites pra ver o status.');
  }

  // Generate unique code
  const code = 'EMB-' + crypto.randomBytes(4).toString('hex').slice(0, 6);

  await supabase.from('invite_codes').insert({
    tenant_id: tenant.id,
    code,
  });

  const link = `https://emilybot.com.br?ref=${code}`;
  bot.sendMessage(chatId,
    `🎫 Convite gerado!\n\nCódigo: ${code}\nLink: ${link}\n\nEnvie este link para um amigo. Ele terá prioridade na fila de acesso.`,
    { parse_mode: 'HTML' }
  );
}
```

**Step 2: Add handleInvites to handlers.js**

```js
async function handleInvites(bot, msg, tenant) {
  const chatId = msg.chat.id;

  const { data: codes } = await supabase
    .from('invite_codes')
    .select('code, used_by, used_at, created_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: true });

  if (!codes || codes.length === 0) {
    return bot.sendMessage(chatId, 'Você ainda não gerou convites. Use /invite para criar um.');
  }

  let msg_text = '🎫 Seus convites:\n\n';
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    const status = c.used_by ? '✅ usado' : '🟢 disponível';
    msg_text += `${i + 1}. ${c.code} — ${status}\n`;
  }

  const remaining = 3 - codes.length;
  if (remaining > 0) {
    msg_text += `\n${remaining} convite(s) restante(s). Use /invite para gerar.`;
  }

  bot.sendMessage(chatId, msg_text);
}
```

**Step 3: Export from handlers.js**

Add `handleInvite` and `handleInvites` to `module.exports`.

**Step 4: Register in bot.js**

```js
const { handleInvite, handleInvites, /* ...existing */ } = require('./handlers');

// In createBot(tenant):
bot.onText(/\/invite$/, (msg) => {
  if (!guard(msg.chat.id)) return;
  handleInvite(bot, msg, tenant);
});

bot.onText(/\/invites/, (msg) => {
  if (!guard(msg.chat.id)) return;
  handleInvites(bot, msg, tenant);
});
```

Note: `/invite$` with `$` anchor so it doesn't match `/invites`.

**Step 5: Test manually**

- Send `/invite` → get code + link
- Send `/invites` → see status
- Send `/invite` 3 more times → should block at 4th
- Open link in browser → verify ref param shows in landing

**Step 6: Commit**

```bash
git add src/telegram/handlers.js src/telegram/bot.js
git commit -m "feat: /invite and /invites commands for referral system"
```

---

## Task 8: Deploy & Smoke Test

**Step 1: Run migration on Supabase production**

Paste `007_waitlist.sql` in Supabase SQL Editor.

**Step 2: Deploy bot to VPS**

```bash
./deploy.sh
```

**Step 3: Deploy landing to Vercel**

- Create project on Vercel, connect GitHub repo, set root directory to `landing/`
- Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, ENCRYPTION_KEY
- Configure custom domain: `emilybot.com.br`
- Deploy

**Step 4: Deploy dashboard**

```bash
./deploy.sh full
```

**Step 5: End-to-end smoke test**

1. Visit `emilybot.com.br` → landing loads
2. Fill waitlist form → check Supabase for row
3. Go to dashboard `/leads` → see lead
4. Approve → get onboarding link
5. Open onboarding link → fill form → submit
6. Verify tenant created + agents seeded
7. In Telegram, send `/invite` → get code
8. Visit `emilybot.com.br?ref=CODE` → submit waitlist
9. Check lead has `priority=true`
10. Send `/invites` → see status

---

## Summary

| Task | What | Where |
|------|------|-------|
| 1 | SQL migration + RLS | Supabase |
| 2 | Landing project setup | `landing/` |
| 3 | Landing page sections | `landing/app/` |
| 4 | Waitlist form | `landing/app/components/` |
| 5 | Dashboard leads page | `dashboard/src/app/leads/` |
| 6 | Onboarding page | `landing/app/onboard/` |
| 7 | /invite /invites commands | `src/telegram/` |
| 8 | Deploy + smoke test | All |

Tasks 1 must be first. Tasks 2-4 (landing) and 5 (dashboard) and 7 (bot) are independent and can be parallelized. Task 6 depends on 2 (landing exists) + 5 (approve generates token). Task 8 is last.

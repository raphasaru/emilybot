# Instagram Caption + Post — Dashboard

**Goal:** Edit caption and post to Instagram directly from the draft editor.

**Architecture:** Add `caption` column to `content_drafts`. Telegram saves caption after generating. Dashboard adds caption textarea + two new API routes (generate caption, post to IG).

---

## Task 1: DB Migration

**Files:** `src/database/migrations/006_caption.sql`

**Step 1:** Write migration:
```sql
ALTER TABLE content_drafts ADD COLUMN IF NOT EXISTS caption TEXT;
```

**Step 2:** Apply via `mcp__supabase__apply_migration` (name: `006_caption`)

**Step 3:** Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'content_drafts' AND column_name = 'caption';
```
Expected: 1 row.

**Step 4:** Commit:
```bash
git add src/database/migrations/006_caption.sql
git commit -m "feat: add caption column to content_drafts"
```

---

## Task 2: Save caption in Telegram handler

**Files:** `src/telegram/handlers.js`

In `handleCaptionCallback`, after generating and sending the caption, save it to the draft:

```js
// After: await bot.sendMessage(chatId, caption);
if (cDraftId) {
  supabase.from('content_drafts').update({ caption }).eq('id', cDraftId).then(({ error }) => {
    if (error) logger.warn('Failed to save caption to draft', { error: error.message });
  });
}
```

Place this before the Instagram button check block.

**Verify:**
```bash
node -e "require('./src/telegram/handlers')"
```

**Commit:**
```bash
git add src/telegram/handlers.js
git commit -m "feat: save generated caption to content_drafts"
```

---

## Task 3: API route — generate caption

**Files:** `dashboard/src/app/api/drafts/[id]/actions/caption/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../../../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();

  const { data: draft, error: draftErr } = await supabase
    .from('content_drafts')
    .select('final_content, format')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (draftErr || !draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('gemini_api_key')
    .eq('id', tenantId)
    .single();

  if (tenantErr || !tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  // gemini_api_key may be encrypted — use safeDecrypt
  const apiKey = safeDecrypt(tenant.gemini_api_key);

  const isCarousel = draft.format === 'carrossel' || draft.format === 'carrossel_noticias';
  const prompt = isCarousel
    ? `Com base nesse carrossel, escreva uma legenda envolvente para Instagram. Inclua: gancho forte, descricao do conteudo, CTA claro e hashtags relevantes. Use emojis. Retorne APENAS a legenda pronta.\n\nConteudo:\n${draft.final_content}`
    : `Com base nesse post, escreva uma legenda envolvente para Instagram. Inclua: gancho forte, emojis, CTA claro e hashtags relevantes. Retorne APENAS a legenda pronta.\n\nConteudo:\n${draft.final_content}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const caption = result.response.text();

  await supabase.from('content_drafts').update({ caption }).eq('id', params.id).eq('tenant_id', tenantId);

  return NextResponse.json({ caption });
}

function safeDecrypt(value: string | null): string {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length !== 3) return value;
  try {
    const crypto = require('crypto');
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return value;
  }
}
```

**Commit:**
```bash
git add dashboard/src/app/api/drafts/[id]/actions/caption/route.ts
git commit -m "feat: dashboard API route to generate caption via Gemini"
```

---

## Task 4: API route — post to Instagram

**Files:** `dashboard/src/app/api/drafts/[id]/actions/instagram/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../../../lib/supabase';
import axios from 'axios';

const IG_BASE = 'https://graph.facebook.com/v21.0';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { caption } = await req.json();

  const supabase = getSupabase();

  const { data: draft } = await supabase
    .from('content_drafts')
    .select('image_urls, format')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (!draft?.image_urls?.length) return NextResponse.json({ error: 'No images found' }, { status: 400 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('instagram_user_id, instagram_token')
    .eq('id', tenantId)
    .single();

  if (!tenant?.instagram_user_id || !tenant?.instagram_token) {
    return NextResponse.json({ error: 'Instagram not configured' }, { status: 400 });
  }

  const userId = tenant.instagram_user_id;
  const token = safeDecrypt(tenant.instagram_token);

  try {
    let postId: string;
    if (draft.format === 'post_unico' || draft.image_urls.length === 1) {
      postId = await postSingle(userId, token, draft.image_urls[0], caption);
    } else {
      postId = await postCarousel(userId, token, draft.image_urls, caption);
    }
    return NextResponse.json({ postId });
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    return NextResponse.json({ error: e.response?.data ?? e.message }, { status: 500 });
  }
}

async function createContainer(userId: string, token: string, imageUrl: string, caption?: string, isCarouselItem = false) {
  const params: Record<string, unknown> = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) params.is_carousel_item = true;
  if (caption && !isCarouselItem) params.caption = caption;
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, { params, timeout: 30000 });
  return data.id as string;
}

async function waitForContainer(userId: string, token: string, containerId: string) {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`${IG_BASE}/${containerId}`, {
      params: { fields: 'status_code', access_token: token }, timeout: 15000,
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('IG container processing failed');
  }
  throw new Error('IG container timed out');
}

async function publish(userId: string, token: string, creationId: string) {
  const { data } = await axios.post(`${IG_BASE}/${userId}/media_publish`, null, {
    params: { creation_id: creationId, access_token: token }, timeout: 30000,
  });
  return data.id as string;
}

async function postSingle(userId: string, token: string, imageUrl: string, caption: string) {
  const id = await createContainer(userId, token, imageUrl, caption);
  await waitForContainer(userId, token, id);
  return publish(userId, token, id);
}

async function postCarousel(userId: string, token: string, imageUrls: string[], caption: string) {
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const id = await createContainer(userId, token, url, undefined, true);
    await waitForContainer(userId, token, id);
    childIds.push(id);
  }
  const { data } = await axios.post(`${IG_BASE}/${userId}/media`, null, {
    params: { media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: token }, timeout: 30000,
  });
  return publish(userId, token, data.id);
}

function safeDecrypt(value: string): string {
  const parts = value.split(':');
  if (parts.length !== 3) return value;
  try {
    const crypto = require('crypto');
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return value;
  }
}
```

**Commit:**
```bash
git add dashboard/src/app/api/drafts/[id]/actions/instagram/route.ts
git commit -m "feat: dashboard API route to post to Instagram"
```

---

## Task 5: Update PATCH /api/drafts/[id] to accept caption

**Files:** `dashboard/src/app/api/drafts/[id]/route.ts`

Add to the `updates` block:
```ts
if (body.caption !== undefined) updates.caption = body.caption;
```

**Commit:**
```bash
git add dashboard/src/app/api/drafts/[id]/route.ts
git commit -m "feat: allow caption updates via PATCH /api/drafts/[id]"
```

---

## Task 6: Update DraftEditor with caption section

**Files:** `dashboard/src/app/drafts/[id]/DraftEditor.tsx`

**Step 1:** Add to Draft interface:
```ts
caption: string | null;
instagram_user_id?: string | null;
```

**Step 2:** Add state:
```ts
const [caption, setCaption] = useState(draft.caption ?? '');
const [captionStatus, setCaptionStatus] = useState('');
const [generatingCaption, setGeneratingCaption] = useState(false);
const [igStatus, setIgStatus] = useState('');
const [igPosted, setIgPosted] = useState(false);
const [posting, setPosting] = useState(false);
```

**Step 3:** Add handlers:
```ts
async function handleGenerateCaption() {
  setGeneratingCaption(true);
  setCaptionStatus('');
  try {
    const res = await fetch(`/api/drafts/${draft.id}/actions/caption`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const { caption: generated } = await res.json();
    setCaption(generated);
    setCaptionStatus('Gerada ✓');
  } catch (err) {
    setCaptionStatus('Erro ao gerar');
  } finally {
    setGeneratingCaption(false);
    setTimeout(() => setCaptionStatus(''), 3000);
  }
}

async function handlePostInstagram() {
  setPosting(true);
  setIgStatus('');
  try {
    const res = await fetch(`/api/drafts/${draft.id}/actions/instagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(JSON.stringify(err.error));
    }
    const { postId } = await res.json();
    setIgPosted(true);
    setIgStatus(`✅ Postado! ID: ${postId}`);
  } catch (err) {
    setIgStatus(`❌ Erro: ${(err as Error).message}`);
  } finally {
    setPosting(false);
  }
}
```

**Step 4:** Add caption section after image gallery (only when `imgUrls.length > 0`):
```tsx
{imgUrls.length > 0 && (
  <div className="mt-6 space-y-3 border-t border-gray-800 pt-6">
    <p className="text-xs text-gray-500 uppercase tracking-widest">Legenda para Instagram</p>
    <textarea
      value={caption}
      onChange={(e) => setCaption(e.target.value)}
      rows={6}
      placeholder="Legenda com hashtags..."
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
    />
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleGenerateCaption}
        disabled={generatingCaption}
        className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded px-4 py-2 text-sm"
      >
        {generatingCaption ? 'Gerando...' : caption ? 'Regenerar legenda' : 'Gerar legenda'}
      </button>
      {draft.instagram_user_id && (
        <button
          onClick={handlePostInstagram}
          disabled={posting || igPosted || !caption}
          className="bg-pink-600 hover:bg-pink-700 disabled:opacity-50 rounded px-4 py-2 text-sm"
        >
          {posting ? 'Postando...' : igPosted ? '✅ Postado' : '📸 Postar no Instagram'}
        </button>
      )}
      {captionStatus && <span className="text-sm text-gray-400">{captionStatus}</span>}
      {igStatus && <span className="text-sm text-gray-400">{igStatus}</span>}
    </div>
  </div>
)}
```

**Step 5:** Update the page that renders DraftEditor to pass `caption` and `instagram_user_id` in the draft object (query Supabase for these fields).

**Verify:** `npm run build` in dashboard dir — no TS errors.

**Commit:**
```bash
git add dashboard/src/app/drafts/[id]/DraftEditor.tsx
git commit -m "feat: caption editor and instagram post button in DraftEditor"
```

---

## Task 7: Update draft page query

**Files:** `dashboard/src/app/drafts/[id]/page.tsx`

Add `caption` and `instagram_user_id` to the Supabase select. The `instagram_user_id` comes from the `tenants` table — query it separately and pass as prop.

**Commit:**
```bash
git add dashboard/src/app/drafts/[id]/page.tsx
git commit -m "feat: pass caption and instagram_user_id to DraftEditor"
```

---

## Testing Checklist

1. Open a draft with images → caption section appears
2. "Gerar legenda" → textarea popula, status "Gerada ✓"
3. Edit caption → edições refletem no textarea
4. "Postar no Instagram" → status "✅ Postado! ID: ..."
5. Postar de novo → botão fica desabilitado após sucesso
6. Tenant sem IG configurado → botão não aparece
7. Check Supabase: `caption` salvo no draft após gerar pelo Telegram

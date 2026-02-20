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

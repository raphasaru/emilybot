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

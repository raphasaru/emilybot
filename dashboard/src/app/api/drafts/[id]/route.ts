import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.final_content !== undefined) updates.final_content = body.final_content;
  if (body.topic !== undefined) updates.topic = body.topic;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('content_drafts')
    .update(updates)
    .eq('id', params.id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from('content_drafts')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

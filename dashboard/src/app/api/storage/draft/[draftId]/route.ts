import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../../lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { draftId } = params;
  const supabase = getSupabase();

  // Verify draft belongs to this tenant
  const { data: draft } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('id', draftId)
    .eq('tenant_id', tenantId)
    .single();

  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: files, error: listErr } = await supabase.storage
    .from('draft-images')
    .list(draftId);

  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  if (files && files.length > 0) {
    const paths = files.map((f) => `${draftId}/${f.name}`);
    const { error: removeErr } = await supabase.storage
      .from('draft-images')
      .remove(paths);
    if (removeErr) return NextResponse.json({ error: removeErr.message }, { status: 500 });
  }

  await supabase
    .from('content_drafts')
    .update({ image_urls: null })
    .eq('id', draftId)
    .eq('tenant_id', tenantId);

  return NextResponse.json({ ok: true, deleted: files?.length ?? 0 });
}

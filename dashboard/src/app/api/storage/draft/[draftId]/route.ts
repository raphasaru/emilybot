import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  const { draftId } = params;
  const supabase = getSupabase();

  // List all files under this draft's folder
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

  // Clear image_urls on the draft (if it still exists)
  await supabase
    .from('content_drafts')
    .update({ image_urls: null })
    .eq('id', draftId);

  return NextResponse.json({ ok: true, deleted: files?.length ?? 0 });
}

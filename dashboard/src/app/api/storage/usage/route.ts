import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabase();

  // Per-draft usage from storage.objects via RPC
  const { data: rows, error } = await supabase.rpc('get_storage_usage');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Join with content_drafts to get topic + format
  const draftIds = (rows ?? []).map((r: { draft_id: string }) => r.draft_id);
  const { data: drafts } = draftIds.length
    ? await supabase
        .from('content_drafts')
        .select('id, topic, format, created_at')
        .in('id', draftIds)
    : { data: [] };

  const draftMap = Object.fromEntries((drafts ?? []).map((d) => [d.id, d]));

  const items = (rows ?? []).map((r: { draft_id: string; file_count: number; total_bytes: number }) => ({
    draft_id:   r.draft_id,
    file_count: Number(r.file_count),
    total_bytes: Number(r.total_bytes),
    topic:  draftMap[r.draft_id]?.topic   ?? '(draft removido)',
    format: draftMap[r.draft_id]?.format  ?? null,
    created_at: draftMap[r.draft_id]?.created_at ?? null,
  }));

  const total_bytes = items.reduce((s: number, r: { total_bytes: number }) => s + r.total_bytes, 0);

  return NextResponse.json({ total_bytes, items });
}

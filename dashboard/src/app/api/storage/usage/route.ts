import { NextResponse } from 'next/server';
import { getSupabase, getTenantId } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();

  // Get tenant's draft IDs first
  const { data: tenantDrafts } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('tenant_id', tenantId);

  const tenantDraftIds = new Set((tenantDrafts ?? []).map((d: { id: string }) => d.id));

  const { data: rows, error } = await supabase.rpc('get_storage_usage');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter to only this tenant's drafts
  const filteredRows = (rows ?? []).filter((r: { draft_id: string }) =>
    tenantDraftIds.has(r.draft_id)
  );

  const draftIds = filteredRows.map((r: { draft_id: string }) => r.draft_id);
  const { data: drafts } = draftIds.length
    ? await supabase
        .from('content_drafts')
        .select('id, topic, format, created_at')
        .in('id', draftIds)
    : { data: [] };

  const draftMap = Object.fromEntries((drafts ?? []).map((d) => [d.id, d]));

  const items = filteredRows.map((r: { draft_id: string; file_count: number; total_bytes: number }) => ({
    draft_id:    r.draft_id,
    file_count:  Number(r.file_count),
    total_bytes: Number(r.total_bytes),
    topic:       draftMap[r.draft_id]?.topic      ?? '(draft removido)',
    format:      draftMap[r.draft_id]?.format     ?? null,
    created_at:  draftMap[r.draft_id]?.created_at ?? null,
  }));

  const total_bytes = items.reduce((s: number, r: { total_bytes: number }) => s + r.total_bytes, 0);
  return NextResponse.json({ total_bytes, items });
}

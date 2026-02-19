import { redirect } from 'next/navigation';
import { getSupabase, getTenantId } from '../lib/supabase';
import StorageManager from './StorageManager';
import LogoutButton from '../drafts/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const supabase = getSupabase();
  const tenantId = await getTenantId();
  if (!tenantId) redirect('/login');

  const { data: rows, error } = await supabase.rpc('get_storage_usage');
  if (error) {
    return <div className="p-8 text-red-400">Erro ao buscar uso: {error.message}</div>;
  }

  // Get tenant's draft IDs to filter storage rows
  const { data: tenantDrafts } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('tenant_id', tenantId);

  const tenantDraftIds = new Set((tenantDrafts ?? []).map((d: { id: string }) => d.id));
  const filteredRows = (rows ?? []).filter((r: { draft_id: string }) => tenantDraftIds.has(r.draft_id));

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

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <a href="/drafts" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Drafts
          </a>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Storage
          </h1>
        </div>
        <LogoutButton />
      </div>
      <StorageManager initialTotal={total_bytes} initialItems={items} />
    </div>
  );
}

import { getSupabase, getTenantId } from '../lib/supabase';
import LogoutButton from './LogoutButton';
import DraftsList from './DraftsList';

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { data: drafts, error } = await supabase
    .from('content_drafts')
    .select('id, topic, format, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return <div className="p-8 text-red-400">Erro ao buscar drafts: {error.message}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Drafts</h1>
        <div className="flex items-center gap-4">
          <a
            href="/storage"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Storage
          </a>
          <LogoutButton />
        </div>
      </div>
      <DraftsList drafts={drafts ?? []} tenantId={tenantId} />
    </div>
  );
}

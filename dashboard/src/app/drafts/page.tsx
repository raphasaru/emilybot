import { getSupabase } from '../lib/supabase';
import LogoutButton from './LogoutButton';
import DraftsList from './DraftsList';

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const supabase = getSupabase();
  const { data: drafts, error } = await supabase
    .from('content_drafts')
    .select('id, topic, format, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return <div className="p-8 text-red-400">Erro ao buscar drafts: {error.message}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Drafts</h1>
        <LogoutButton />
      </div>
      <DraftsList drafts={drafts ?? []} />
    </div>
  );
}

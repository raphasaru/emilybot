import { notFound, redirect } from 'next/navigation';
import { getSupabase, getTenantId } from '../../lib/supabase';
import DraftEditor from './DraftEditor';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function DraftPage({ params }: Props) {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  if (!tenantId) redirect('/login');
  const { data: draft, error } = await supabase
    .from('content_drafts')
    .select('id, topic, format, draft, final_content, image_urls, created_at')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !draft) notFound();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-4">
        <a href="/drafts" className="text-sm text-gray-400 hover:text-gray-200">
          ← Drafts
        </a>
      </div>
      <h1 className="text-xl font-bold mb-1">{draft.topic}</h1>
      <p className="text-xs text-gray-500 mb-6">
        {draft.format ?? 'sem formato'} · {new Date(draft.created_at).toLocaleString('pt-BR')}
      </p>
      <DraftEditor draft={draft} />
    </div>
  );
}

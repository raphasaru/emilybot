import Link from 'next/link';
import { getSupabase } from '../lib/supabase';
import LogoutButton from './LogoutButton';

export const dynamic = 'force-dynamic';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  status: string;
  created_at: string;
}

export default async function DraftsPage() {
  const supabase = getSupabase();
  const { data: drafts, error } = await supabase
    .from('content_drafts')
    .select('id, topic, format, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return <div className="p-8 text-red-400">Erro ao buscar drafts: {error.message}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content Drafts</h1>
        <LogoutButton />
      </div>
      {!drafts?.length ? (
        <p className="text-gray-500">Nenhum draft encontrado.</p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d: Draft) => (
            <Link
              key={d.id}
              href={`/drafts/${d.id}`}
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-lg px-4 py-3 transition"
            >
              <div>
                <p className="font-medium">{d.topic}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {d.format ?? 'sem formato'} · {new Date(d.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  d.status === 'completed'
                    ? 'bg-green-900 text-green-300'
                    : 'bg-yellow-900 text-yellow-300'
                }`}
              >
                {d.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

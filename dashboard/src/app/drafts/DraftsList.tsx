'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  status: string;
  created_at: string;
}

export default function DraftsList({ drafts }: { drafts: Draft[] }) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? drafts.filter(
        (d) =>
          d.topic.toLowerCase().includes(query.toLowerCase()) ||
          (d.format ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : drafts;

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Pesquisar por tema ou formato..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
      />
      {!filtered.length ? (
        <p className="text-gray-500 text-sm">Nenhum resultado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseForEdit, buildForSave } from '../../lib/draftParser';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  final_content: string | null;
  draft: string | null;
  image_urls: string[] | null;
}

export default function DraftEditor({ draft }: { draft: Draft }) {
  const router = useRouter();
  const raw = draft.final_content ?? draft.draft ?? '';
  const initial = parseForEdit(raw);

  const [text, setText] = useState(initial.text);
  const [notes, setNotes] = useState(initial.notes);
  const [parsed] = useState(initial.parsed);
  const [saveStatus, setSaveStatus] = useState('');
  const [imgUrls, setImgUrls] = useState<string[]>(draft.image_urls ?? []);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);

  const canGenerate = draft.format === 'post_unico' || draft.format === 'carrossel';
  const isCarousel = draft.format === 'carrossel';

  async function handleDownloadZip() {
    setZipping(true);
    try {
      const res = await fetch('/api/image/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: imgUrls, topic: draft.topic }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${draft.topic.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao zipar: ' + (err as Error).message);
    } finally {
      setZipping(false);
    }
  }

  function getSavedJson() {
    return buildForSave(text, notes, parsed, raw);
  }

  async function handleSave() {
    setSaveStatus('Salvando...');
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_content: getSavedJson() }),
    });
    setSaveStatus(res.ok ? 'Salvo ✓' : 'Erro ao salvar');
    setTimeout(() => setSaveStatus(''), 2000);
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      if (!isCarousel) {
        const res = await fetch('/api/image/post-unico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, draft_id: draft.id }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { urls } = await res.json();
        setImgUrls(urls);
        router.refresh();
      } else {
        const res = await fetch('/api/image/carrossel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ final_content: getSavedJson(), draft_id: draft.id }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { urls } = await res.json();
        setImgUrls(urls);
        router.refresh();
      }
    } catch (err) {
      alert('Erro ao gerar imagem: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Format hint */}
      {isCarousel && (
        <p className="text-xs text-gray-500 bg-gray-900 rounded px-3 py-2">
          Carrossel — cada slide começa com <code className="text-gray-300">[1/5 · capa]</code> e tem campos como <code className="text-gray-300">título:</code>, <code className="text-gray-300">corpo:</code>, etc.
        </p>
      )}
      {draft.format === 'thread' && (
        <p className="text-xs text-gray-500 bg-gray-900 rounded px-3 py-2">
          Thread — separe os tweets com uma linha <code className="text-gray-300">---</code>
        </p>
      )}

      {/* Main text editor */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        placeholder="Conteúdo..."
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
      />

      {/* Publishing notes */}
      {(notes || parsed) && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notas de publicação</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas de publicação..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500 resize-y"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-gray-700 hover:bg-gray-600 rounded px-4 py-2 text-sm"
        >
          Salvar
        </button>
        {canGenerate && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded px-4 py-2 text-sm"
          >
            {loading ? 'Gerando...' : imgUrls.length > 0 ? 'Regenerar imagem' : 'Gerar imagem'}
          </button>
        )}
        {saveStatus && <span className="text-sm text-gray-400">{saveStatus}</span>}
      </div>

      {/* Image gallery */}
      {imgUrls.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              {isCarousel ? `${imgUrls.length} slides gerados` : 'Imagem gerada'}
            </p>
            {isCarousel && (
              <button
                onClick={handleDownloadZip}
                disabled={zipping}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-400 disabled:opacity-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {zipping ? 'Gerando ZIP...' : 'Download ZIP'}
              </button>
            )}
          </div>
          <div className={isCarousel ? 'flex flex-wrap gap-3' : ''}>
            {imgUrls.map((url, i) => (
              <div
                key={url}
                className={isCarousel ? 'w-48' : 'max-w-sm'}
              >
                <img
                  src={url}
                  alt={isCarousel ? `Slide ${i + 1}` : 'Post gerado'}
                  className="w-full rounded-lg border border-gray-800 object-cover"
                />
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-400 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {isCarousel ? `Slide ${i + 1}` : 'Download PNG'}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

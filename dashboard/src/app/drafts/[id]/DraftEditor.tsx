'use client';

import { useState } from 'react';
import { parseForEdit, buildForSave } from '../../lib/draftParser';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  final_content: string | null;
  draft: string | null;
}

export default function DraftEditor({ draft }: { draft: Draft }) {
  const raw = draft.final_content ?? draft.draft ?? '';
  const initial = parseForEdit(raw);

  const [text, setText] = useState(initial.text);
  const [notes, setNotes] = useState(initial.notes);
  const [parsed] = useState(initial.parsed);
  const [saveStatus, setSaveStatus] = useState('');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canGenerate = draft.format === 'post_unico' || draft.format === 'carrossel';
  const isCarousel = draft.format === 'carrossel';

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
    setImgSrc(null);
    try {
      if (!isCarousel) {
        // post_unico: send plain text
        const res = await fetch('/api/image/post-unico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        setImgSrc(URL.createObjectURL(blob));
      } else {
        // carrossel: rebuild JSON before sending
        const res = await fetch('/api/image/carrossel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ final_content: getSavedJson() }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carrossel-${draft.id}.zip`;
        a.click();
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
            {loading ? 'Gerando...' : 'Gerar imagem'}
          </button>
        )}
        {saveStatus && <span className="text-sm text-gray-400">{saveStatus}</span>}
      </div>

      {imgSrc && (
        <div className="mt-4">
          <img src={imgSrc} alt="post gerado" className="max-w-sm rounded-lg border border-gray-700" />
          <a
            href={imgSrc}
            download={`post-${draft.id}.png`}
            className="mt-2 inline-block text-sm text-purple-400 hover:underline"
          >
            Download PNG
          </a>
        </div>
      )}
    </div>
  );
}

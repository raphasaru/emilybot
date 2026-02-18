'use client';

import { useState } from 'react';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  final_content: string | null;
  draft: string | null;
}

export default function DraftEditor({ draft }: { draft: Draft }) {
  const initialContent = draft.final_content ?? draft.draft ?? '';
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState('');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canGenerate = draft.format === 'post_unico' || draft.format === 'carrossel';

  async function handleSave() {
    setSaveStatus('Salvando...');
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_content: content }),
    });
    setSaveStatus(res.ok ? 'Salvo ✓' : 'Erro ao salvar');
    setTimeout(() => setSaveStatus(''), 2000);
  }

  async function handleGenerate() {
    setLoading(true);
    setImgSrc(null);
    try {
      if (draft.format === 'post_unico') {
        const res = await fetch('/api/image/post-unico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        setImgSrc(URL.createObjectURL(blob));
      } else if (draft.format === 'carrossel') {
        const res = await fetch('/api/image/carrossel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ final_content: content }),
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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-500 resize-y"
      />
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

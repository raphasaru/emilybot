'use client';

import { useState } from 'react';

const FREE_TIER_BYTES = 1_073_741_824; // 1 GB

interface StorageItem {
  draft_id: string;
  topic: string;
  format: string | null;
  file_count: number;
  total_bytes: number;
  created_at: string | null;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

const FMT_COLOR: Record<string, string> = {
  post_unico: '#6EE7B7',
  carrossel: '#FCD34D',
  tweet: '#7DD3FC',
  thread: '#C4B5FD',
  reels_roteiro: '#FDA4AF',
};

export default function StorageManager({
  initialTotal,
  initialItems,
}: {
  initialTotal: number;
  initialItems: StorageItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [totalBytes, setTotalBytes] = useState(initialTotal);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const pct = Math.min((totalBytes / FREE_TIER_BYTES) * 100, 100);
  const barColor = pct > 80 ? '#FB7185' : pct > 60 ? '#FBBF24' : '#34D399';

  async function deleteImages(draftId: string) {
    setBusyIds((p) => new Set(p).add(draftId));
    const res = await fetch(`/api/storage/draft/${draftId}`, { method: 'DELETE' });
    if (res.ok) {
      const removed = items.find((i) => i.draft_id === draftId);
      setItems((p) => p.filter((i) => i.draft_id !== draftId));
      setTotalBytes((p) => p - (removed?.total_bytes ?? 0));
    } else {
      alert('Erro ao deletar imagens');
    }
    setBusyIds((p) => { const n = new Set(p); n.delete(draftId); return n; });
    setDeletingId(null);
  }

  return (
    <div style={{ fontFamily: "'Syne', sans-serif" }}>

      {/* Usage bar card */}
      <div style={{
        background: '#0F0F13',
        border: '1px solid #1C1C22',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#FAFAFA' }}>
              {fmtBytes(totalBytes)}
            </span>
            <span style={{ fontSize: 14, color: '#52525B', marginLeft: 10 }}>
              de 1 GB (free tier)
            </span>
          </div>
          <span style={{ fontSize: 13, color: pct > 80 ? '#FB7185' : '#52525B', fontWeight: 500 }}>
            {pct.toFixed(1)}% usado
          </span>
        </div>

        {/* Bar */}
        <div style={{ height: 6, background: '#1C1C22', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 99,
            transition: 'width 600ms ease',
            boxShadow: `0 0 10px ${barColor}66`,
          }} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
          {[
            { label: 'drafts com imagens', value: items.length },
            { label: 'total de arquivos', value: items.reduce((s, i) => s + i.file_count, 0) },
            { label: 'espaço livre', value: fmtBytes(Math.max(FREE_TIER_BYTES - totalBytes, 0)) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#E4E4EF' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#3A3A47', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#3A3A47', fontSize: 14 }}>
          Nenhuma imagem armazenada.
        </div>
      ) : (
        <div style={{ border: '1px solid #1C1C22', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 80px 100px 100px',
            background: '#0B0B0F',
            borderBottom: '1px solid #1C1C22',
            padding: '0 16px',
          }}>
            {['DRAFT', 'FORMATO', 'SLIDES', 'TAMANHO', ''].map((h) => (
              <div key={h} style={{ padding: '11px 8px', fontSize: 10.5, letterSpacing: '0.1em', fontWeight: 700, color: '#3A3A47' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows sorted by size desc */}
          {[...items].sort((a, b) => b.total_bytes - a.total_bytes).map((item, i, arr) => {
            const isDeleting = deletingId === item.draft_id;
            const isBusy = busyIds.has(item.draft_id);
            const color = FMT_COLOR[item.format ?? ''] ?? '#71717A';

            return (
              <div
                key={item.draft_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 80px 100px 100px',
                  padding: '0 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid #13131A' : 'none',
                  background: isBusy ? 'rgba(251,113,133,0.04)' : undefined,
                  opacity: isBusy ? 0.6 : 1,
                  transition: 'opacity 200ms',
                  alignItems: 'center',
                }}
              >
                {/* Topic */}
                <div style={{ padding: '14px 8px' }}>
                  <div style={{ fontSize: 13.5, color: '#DEDED8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.topic}
                  </div>
                  <div style={{ fontSize: 11, color: '#3A3A47', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDate(item.created_at)}
                  </div>
                </div>

                {/* Format */}
                <div style={{ padding: '14px 8px' }}>
                  <span style={{ fontSize: 11.5, color, background: `${color}18`, padding: '2px 8px', borderRadius: 4 }}>
                    {item.format ?? '—'}
                  </span>
                </div>

                {/* File count */}
                <div style={{ padding: '14px 8px', fontSize: 13.5, color: '#71717A' }}>
                  {item.file_count}
                </div>

                {/* Size */}
                <div style={{ padding: '14px 8px', fontSize: 13, color: '#DEDED8', fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtBytes(item.total_bytes)}
                </div>

                {/* Actions */}
                <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isDeleting ? (
                    <>
                      <button
                        onClick={() => deleteImages(item.draft_id)}
                        style={{ fontSize: 12, color: '#FB7185', background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        confirmar
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{ fontSize: 12, color: '#52525B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeletingId(item.draft_id)}
                      disabled={isBusy}
                      style={{
                        fontSize: 12, color: '#52525B', background: 'none',
                        border: '1px solid #1C1C22', borderRadius: 5,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'color 100ms, border-color 100ms',
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = '#FB7185'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(251,113,133,0.3)'; }}
                      onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = '#52525B'; (e.target as HTMLButtonElement).style.borderColor = '#1C1C22'; }}
                    >
                      apagar imagens
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../lib/supabaseClient';

interface Draft {
  id: string;
  topic: string;
  format: string | null;
  status: string;
  created_at: string;
}

const FMT: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  post_unico:    { label: 'post único',   dot: '#10B981', bg: 'rgba(16,185,129,0.10)', text: '#6EE7B7' },
  carrossel:     { label: 'carrossel',    dot: '#F59E0B', bg: 'rgba(245,158,11,0.10)', text: '#FCD34D' },
  tweet:         { label: 'tweet',        dot: '#38BDF8', bg: 'rgba(56,189,248,0.10)', text: '#7DD3FC' },
  thread:        { label: 'thread',       dot: '#A78BFA', bg: 'rgba(167,139,250,0.10)', text: '#C4B5FD' },
  reels_roteiro: { label: 'reels',        dot: '#FB7185', bg: 'rgba(251,113,133,0.10)', text: '#FDA4AF' },
};

function getFmt(f: string | null) {
  return FMT[f ?? ''] ?? { label: f ?? '—', dot: '#52525B', bg: 'rgba(82,82,91,0.10)', text: '#71717A' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function DraftsList({ drafts: initial, tenantId }: { drafts: Draft[]; tenantId: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initial);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? drafts.filter(
        (d) =>
          d.topic.toLowerCase().includes(query.toLowerCase()) ||
          (d.format ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : drafts;

  const selCount = [...selected].filter((id) => filtered.find((d) => d.id === id)).length;
  const allSel = filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('content_drafts_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'content_drafts', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as Draft;
          setDrafts((prev) => [row, ...prev]);
        }
      )
      .subscribe();

    return () => { supabaseBrowser.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function toggleAll() {
    if (allSel) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function startEdit(draft: Draft, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(null);
    setEditingId(draft.id);
    setEditValue(draft.topic);
  }

  async function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingId(null); return; }
    setBusyIds((p) => new Set(p).add(id));
    const res = await fetch(`/api/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: trimmed }),
    });
    if (res.ok) setDrafts((p) => p.map((d) => (d.id === id ? { ...d, topic: trimmed } : d)));
    setBusyIds((p) => { const n = new Set(p); n.delete(id); return n; });
    setEditingId(null);
  }

  async function doDelete(id: string) {
    setBusyIds((p) => new Set(p).add(id));
    const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDrafts((p) => p.filter((d) => d.id !== id));
      setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
    }
    setBusyIds((p) => { const n = new Set(p); n.delete(id); return n; });
    setDeletingId(null);
  }

  async function deleteSelected() {
    const ids = [...selected].filter((id) => filtered.find((d) => d.id === id));
    await Promise.all(ids.map(doDelete));
    setSelected(new Set());
  }

  return (
    <div className="dt">
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#3A3A45" strokeWidth="2.2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              className="dt-search"
              style={{ paddingLeft: 34 }}
              placeholder="buscar por título ou formato…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {selCount > 0 && (
            <div
              className="dt-bulk"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 13, color: '#52525B', whiteSpace: 'nowrap' }}>
                {selCount} sel.
              </span>
              <button
                onClick={deleteSelected}
                style={{
                  fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 500,
                  color: '#FDA4AF', background: 'rgba(251,113,133,0.08)',
                  border: '1px solid rgba(251,113,133,0.18)',
                  borderRadius: 5, padding: '5px 12px', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'background 100ms',
                }}
              >
                excluir selecionados
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ border: '1px solid #1C1C22', borderRadius: 10, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 134px 112px 144px 80px',
            background: '#0B0B0F',
            borderBottom: '1px solid #1C1C22',
            padding: '0 4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0' }}>
              <input
                type="checkbox"
                className="dt-chk"
                checked={allSel}
                onChange={toggleAll}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {['TÍTULO', 'FORMATO', 'STATUS', 'CRIADO EM', ''].map((h, i) => (
              <div
                key={i}
                style={{
                  padding: '11px 10px',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  color: '#3A3A47',
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#3A3A47', fontSize: 15 }}>
              nenhum draft encontrado
            </div>
          ) : (
            filtered.map((d) => {
              const f = getFmt(d.format);
              const isEditing = editingId === d.id;
              const isDeleting = deletingId === d.id;
              const isBusy = busyIds.has(d.id);
              const isSel = selected.has(d.id);

              return (
                <div
                  key={d.id}
                  className={`dt-row${isSel ? ' dt-row-selected' : ''}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 134px 112px 144px 80px',
                    padding: '0 4px',
                    opacity: isBusy ? 0.4 : 1,
                    transition: 'opacity 200ms',
                  }}
                  onClick={() => !isEditing && !isDeleting && !isBusy && router.push(`/drafts/${d.id}`)}
                >
                  {/* Checkbox — full cell clickable */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); toggleOne(d.id); }}
                  >
                    <input
                      type="checkbox"
                      className="dt-chk"
                      checked={isSel}
                      onChange={() => {}}
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>

                  {/* Topic */}
                  <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        className="dt-topic-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(d.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(d.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{
                        fontSize: 14.5, color: '#DEDED8', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.topic}
                      </span>
                    )}
                  </div>

                  {/* Format */}
                  <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12.5, fontWeight: 500, color: f.text,
                      background: f.bg, padding: '3px 9px', borderRadius: 5,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: f.dot, flexShrink: 0,
                      }} />
                      {f.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: d.status === 'completed' ? '#34D399' : '#FBBF24',
                      boxShadow: d.status === 'completed'
                        ? '0 0 6px rgba(52,211,153,0.4)'
                        : '0 0 6px rgba(251,191,36,0.4)',
                    }} />
                    <span style={{ fontSize: 13.5, color: '#52525B' }}>{d.status}</span>
                  </div>

                  {/* Date */}
                  <div style={{ padding: '13px 10px', display: 'flex', alignItems: 'center' }}>
                    <span className="dt-mono" style={{ fontSize: 12.5, color: '#3A3A47', letterSpacing: '0.02em' }}>
                      {fmtDate(d.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div
                    className={`dt-actions${isDeleting ? ' dt-actions-visible' : ''}`}
                    style={{ padding: '0 6px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isDeleting ? (
                      <>
                        <button
                          className="dt-confirm-btn"
                          style={{ color: '#34D399' }}
                          onClick={() => doDelete(d.id)}
                        >
                          sim
                        </button>
                        <button
                          className="dt-confirm-btn"
                          style={{ color: '#52525B' }}
                          onClick={() => setDeletingId(null)}
                        >
                          não
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="dt-icon-btn"
                          title="Editar título"
                          onClick={(e) => startEdit(d, e)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="dt-icon-btn"
                          title="Excluir"
                          onClick={() => { setDeletingId(d.id); setEditingId(null); }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="dt-mono" style={{ marginTop: 10, fontSize: 12, color: '#2D2D38', letterSpacing: '0.04em' }}>
          {filtered.length} draft{filtered.length !== 1 ? 's' : ''}
          {query && ` — filtrado de ${drafts.length}`}
        </div>
      </div>
  );
}

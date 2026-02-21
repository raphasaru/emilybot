'use client';

import { useState } from 'react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  instagram: string | null;
  status: string;
  priority: boolean;
  created_at: string;
  approved_at: string | null;
  onboard_token: string | null;
}

type Filter = 'all' | 'pending' | 'approved' | 'onboarded';

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(82,82,91,0.20)',    text: '#A1A1AA', label: 'Pendente' },
  approved:  { bg: 'rgba(59,130,246,0.15)',   text: '#60A5FA', label: 'Aprovado' },
  onboarded: { bg: 'rgba(16,185,129,0.15)',   text: '#6EE7B7', label: 'Onboarded' },
  rejected:  { bg: 'rgba(239,68,68,0.15)',    text: '#FCA5A5', label: 'Rejeitado' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function LeadsList({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const counts = {
    pending:   leads.filter((l) => l.status === 'pending').length,
    approved:  leads.filter((l) => l.status === 'approved').length,
    onboarded: leads.filter((l) => l.status === 'onboarded').length,
  };

  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Approve failed');
      const { lead, onboardLink } = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...lead } : l)));
      setModal({ link: onboardLink });
    } catch {
      alert('Erro ao aprovar lead');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Rejeitar esse lead?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Reject failed');
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'rejected' } : l)));
    } catch {
      alert('Erro ao rejeitar lead');
    } finally {
      setBusyId(null);
    }
  }

  function copyLink() {
    if (!modal) return;
    navigator.clipboard.writeText(modal.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'approved', label: 'Aprovados' },
    { key: 'onboarded', label: 'Onboarded' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <a href="/drafts" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            &larr; Drafts
          </a>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>
            Leads
          </h1>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 mb-6">
        {([
          { label: 'Pendentes', value: counts.pending, color: '#A1A1AA' },
          { label: 'Aprovados', value: counts.approved, color: '#60A5FA' },
          { label: 'Onboarded', value: counts.onboarded, color: '#6EE7B7' },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ background: '#0F0F13', border: '1px solid #1C1C22' }}
          >
            <span className="text-xl font-semibold" style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {s.value}
            </span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: '#0B0B0F' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              filter === t.key
                ? 'bg-purple-600 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#0B0B0F', border: '1px solid #1C1C22' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1C1C22' }}>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Instagram</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-600">
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const badge = STATUS_BADGE[lead.status] ?? STATUS_BADGE.pending;
              const isBusy = busyId === lead.id;
              return (
                <tr key={lead.id} className="hover:bg-[#0F0F13] transition-colors" style={{ borderBottom: '1px solid #1C1C22' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#FAFAFA' }}>{lead.name}</td>
                  <td className="px-4 py-3" style={{ color: '#DEDED8' }}>{lead.email ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#DEDED8' }}>{lead.instagram ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.priority && (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D' }}
                      >
                        Indicado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDate(lead.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lead.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(lead.id)}
                          disabled={isBusy}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded px-3 py-1.5 text-xs text-white transition-colors"
                        >
                          {isBusy ? '...' : 'Aprovar'}
                        </button>
                        <button
                          onClick={() => handleReject(lead.id)}
                          disabled={isBusy}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-3 py-1.5 text-xs text-white transition-colors"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Copy link modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModal(null)}>
          <div
            className="rounded-xl p-6 max-w-lg w-full mx-4"
            style={{ background: '#13131A', border: '1px solid #2A2A35' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: '#FAFAFA' }}>
              Lead aprovado
            </h2>
            <p className="text-sm text-gray-400 mb-4">Envie o link de onboarding:</p>
            <div
              className="flex items-center gap-2 p-3 rounded-lg"
              style={{ background: '#0B0B0F', border: '1px solid #1C1C22' }}
            >
              <code className="flex-1 text-xs break-all" style={{ color: '#A78BFA', fontFamily: "'JetBrains Mono', monospace" }}>
                {modal.link}
              </code>
              <button
                onClick={copyLink}
                className="bg-purple-600 hover:bg-purple-700 rounded px-4 py-2 text-sm text-white transition-colors shrink-0"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={() => setModal(null)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

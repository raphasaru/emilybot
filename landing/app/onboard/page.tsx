'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type PageState = 'loading' | 'invalid' | 'used' | 'pending' | 'expired' | 'form' | 'submitting' | 'success' | 'error';

interface Lead {
  id: string;
  name: string;
  email: string;
  status: string;
  approved_at: string;
}

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-brand-dark border border-brand-border text-white placeholder:text-brand-muted/50 focus:border-brand-purple focus:outline-none transition-colors';

function OnboardFormInner() {
  const searchParams = useSearchParams();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [lead, setLead] = useState<Lead | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [botNameResult, setBotNameResult] = useState('');

  // form fields
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [falKey, setFalKey] = useState('');

  useEffect(() => {
    async function validate() {
      const token = searchParams.get('token');
      if (!token) { setPageState('invalid'); return; }

      const { data, error } = await supabase
        .from('waitlist_leads')
        .select('*')
        .eq('onboard_token', token)
        .single();

      if (error || !data) { setPageState('invalid'); return; }

      if (data.status === 'onboarded') { setPageState('used'); return; }
      if (data.status !== 'approved') { setPageState('pending'); return; }

      const approvedAt = new Date(data.approved_at);
      if (Date.now() - approvedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
        setPageState('expired');
        return;
      }

      setLead(data as Lead);
      setPageState('form');
    }
    validate();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem');
      return;
    }

    setPageState('submitting');

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: searchParams.get('token'),
          bot_name: botName,
          bot_token: botToken,
          chat_id: chatId,
          password,
          gemini_key: geminiKey,
          brave_key: braveKey || undefined,
          fal_key: falKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Erro inesperado');
        setPageState('error');
        return;
      }

      setBotNameResult(data.botName);
      setPageState('success');
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
      setPageState('error');
    }
  }

  // --- status screens ---

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
      </div>
    );
  }

  if (pageState === 'invalid') {
    return <StatusScreen title="Link inválido" subtitle="Verifique o link que você recebeu." />;
  }

  if (pageState === 'used') {
    return <StatusScreen title="Este link já foi utilizado" subtitle="Cada link de onboarding pode ser usado apenas uma vez." />;
  }

  if (pageState === 'pending') {
    return <StatusScreen title="Ainda não aprovado" subtitle="Sua solicitação está sendo analisada. Aguarde a aprovação." />;
  }

  if (pageState === 'expired') {
    return <StatusScreen title="Link expirado" subtitle="Entre em contato para um novo link." />;
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-brand-border bg-brand-card p-10 text-center">
          <div className="text-brand-purple mb-4">
            <svg className="w-14 h-14 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold mb-3">Seu bot está configurado!</h2>
          <div className="text-brand-muted space-y-3 text-sm">
            <p>Abra o Telegram e envie <strong className="text-white">/start</strong> para <strong className="text-white">@{botNameResult}</strong></p>
            <p>Acesse o dashboard em <strong className="text-white">31.97.160.106:3001</strong> com o nome do bot e a senha que você criou</p>
          </div>
        </div>
      </div>
    );
  }

  // --- form ---

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Configure seu bot</h1>
          {lead && <p className="text-brand-muted">Olá, {lead.name}!</p>}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-border bg-brand-card p-8 space-y-5">
          <Field label="Nome do bot" helper="Como seu bot vai se chamar no Telegram" required>
            <input type="text" required value={botName} onChange={e => setBotName(e.target.value)} className={inputClass} placeholder="MeuBot" />
          </Field>

          <Field label="Bot Token" helper="Crie um bot no @BotFather e cole o token aqui" required>
            <input type="text" required value={botToken} onChange={e => setBotToken(e.target.value)} className={inputClass} placeholder="123456:ABC-DEF..." />
          </Field>

          <Field label="Chat ID" helper="Envie /start para @userinfobot para descobrir" required>
            <input type="text" required value={chatId} onChange={e => setChatId(e.target.value)} className={inputClass} placeholder="123456789" />
          </Field>

          <Field label="Senha do dashboard" helper="Usada para acessar o painel de edição" required>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" minLength={6} />
          </Field>

          <Field label="Confirmar senha" required>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Repita a senha" minLength={6} />
          </Field>

          <hr className="border-brand-border" />

          <Field label="Gemini API Key" helper="Obtenha em aistudio.google.com" required>
            <input type="text" required value={geminiKey} onChange={e => setGeminiKey(e.target.value)} className={inputClass} placeholder="AIza..." />
          </Field>

          <Field label="Brave API Key" helper="Para pesquisa web. Obtenha em brave.com/search/api" optional>
            <input type="text" value={braveKey} onChange={e => setBraveKey(e.target.value)} className={inputClass} placeholder="BSA..." />
          </Field>

          <Field label="fal.ai API Key" helper="Para geração de imagens. Obtenha em fal.ai" optional>
            <input type="text" value={falKey} onChange={e => setFalKey(e.target.value)} className={inputClass} placeholder="fal-..." />
          </Field>

          <button
            type="submit"
            disabled={pageState === 'submitting'}
            className="w-full py-4 rounded-full bg-brand-purple text-white font-semibold text-lg transition-all duration-300 hover:bg-brand-purple-dark hover:shadow-[0_0_40px_rgba(167,139,250,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pageState === 'submitting' ? 'Configurando...' : 'Criar meu bot'}
          </button>

          {(pageState === 'error' || errorMsg) && (
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({ label, helper, required, optional, children }: {
  label: string;
  helper?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}
        {optional && <span className="text-brand-muted text-xs ml-1">(opcional)</span>}
      </label>
      {children}
      {helper && <p className="text-brand-muted text-xs mt-1">{helper}</p>}
    </div>
  );
}

function StatusScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-2xl border border-brand-border bg-brand-card p-10 text-center">
        <h2 className="font-display text-2xl font-bold mb-3">{title}</h2>
        <p className="text-brand-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
      </div>
    }>
      <OnboardFormInner />
    </Suspense>
  );
}

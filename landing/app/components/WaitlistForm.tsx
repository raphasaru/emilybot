'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

function WaitlistFormInner() {
  const searchParams = useSearchParams();
  const [refCode, setRefCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setRefCode(ref);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState('submitting');
    setErrorMsg('');

    try {
      let validRef: string | null = null;

      // Validate ref code if present
      if (refCode) {
        const { data: code } = await supabase
          .from('invite_codes')
          .select('code, used_by')
          .eq('code', refCode)
          .single();

        if (code && code.used_by) {
          setErrorMsg('Este código de convite já foi utilizado');
          setFormState('error');
          return;
        }
        if (code) validRef = code.code;
      }

      // Insert lead
      const { data: lead, error: insertError } = await supabase
        .from('waitlist_leads')
        .insert({
          name,
          email,
          instagram: instagram || null,
          priority: !!validRef,
          invite_code: validRef || null,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setErrorMsg('Este email já está cadastrado');
          setFormState('error');
          return;
        }
        throw insertError;
      }

      // Mark invite code as used
      if (validRef && lead) {
        await supabase
          .from('invite_codes')
          .update({ used_by: lead.id, used_at: new Date().toISOString() })
          .eq('code', validRef);
      }

      setFormState('success');
    } catch {
      setErrorMsg('Algo deu errado. Tente novamente.');
      setFormState('error');
    }
  }

  if (formState === 'success') {
    return (
      <section id="waitlist" className="py-24 px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="rounded-2xl border border-brand-border bg-brand-card p-10">
            <div className="text-brand-purple mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-display text-2xl font-bold mb-3">Você está na lista!</h3>
            <p className="text-brand-muted">Avisaremos quando sua vez chegar.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="waitlist" className="py-24 px-6">
      <div className="max-w-md mx-auto text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
          Garanta seu acesso antecipado
        </h2>
        <p className="text-brand-muted mb-10">
          Deixe seus dados e avisaremos quando sua vez chegar
        </p>

        {refCode && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple/30 bg-brand-purple/10 mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-purple" />
            <span className="text-sm text-brand-purple font-medium">Convite: {refCode}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-border bg-brand-card p-8 text-left space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">Nome</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-dark border border-brand-border text-white placeholder:text-brand-muted/50 focus:border-brand-purple focus:outline-none transition-colors"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-dark border border-brand-border text-white placeholder:text-brand-muted/50 focus:border-brand-purple focus:outline-none transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="instagram" className="block text-sm font-medium mb-1.5">Instagram <span className="text-brand-muted text-xs">(opcional)</span></label>
            <input
              id="instagram"
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-brand-dark border border-brand-border text-white placeholder:text-brand-muted/50 focus:border-brand-purple focus:outline-none transition-colors"
              placeholder="@seuuser"
            />
          </div>

          <button
            type="submit"
            disabled={formState === 'submitting'}
            className="w-full py-4 rounded-full bg-brand-purple text-white font-semibold text-lg transition-all duration-300 hover:bg-brand-purple-dark hover:shadow-[0_0_40px_rgba(167,139,250,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {formState === 'submitting' ? 'Enviando...' : 'Garantir minha vaga'}
          </button>

          {formState === 'error' && (
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          )}
        </form>
      </div>
    </section>
  );
}

export default function WaitlistForm() {
  return (
    <Suspense fallback={
      <section id="waitlist" className="py-24 px-6">
        <div className="max-w-md mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Garanta seu acesso antecipado
          </h2>
          <p className="text-brand-muted mb-10">
            Deixe seus dados e avisaremos quando sua vez chegar
          </p>
          <div className="rounded-2xl border border-brand-border bg-brand-card p-8">
            <div className="h-64 animate-pulse rounded-lg bg-brand-border/20" />
          </div>
        </div>
      </section>
    }>
      <WaitlistFormInner />
    </Suspense>
  );
}

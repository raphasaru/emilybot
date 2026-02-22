'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useReveal } from '../../lib/useReveal';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

function WaitlistFormInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = useReveal();
  const [refCode, setRefCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const r = searchParams.get('ref');
    if (r) setRefCode(r);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState('submitting');
    setErrorMsg('');

    try {
      let validRef: string | null = null;

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

      const { data: lead, error: insertError } = await supabase
        .from('waitlist_leads')
        .insert({
          name,
          email,
          whatsapp,
          instagram: instagram || null,
          priority: !!validRef,
          invite_code: validRef || null,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setErrorMsg('Este e-mail já está cadastrado');
          setFormState('error');
          return;
        }
        throw insertError;
      }

      if (validRef && lead) {
        await supabase
          .from('invite_codes')
          .update({ used_by: lead.id, used_at: new Date().toISOString() })
          .eq('code', validRef);
      }

      router.push('/obrigado');
      return;
    } catch {
      setErrorMsg('Algo deu errado. Tente novamente.');
      setFormState('error');
    }
  }

  return (
    <section id="waitlist" className="py-16 sm:py-28 px-6 relative" ref={ref}>
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent-violet/[0.04] blur-[120px] pointer-events-none" />

      <div className="relative max-w-md mx-auto">
        <div className="text-center mb-10">
          <p className="reveal text-sm font-medium uppercase tracking-[0.2em] text-accent-violet mb-4">
            Lista de espera
          </p>
          <h2 className="reveal font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Garanta seu acesso antecipado
          </h2>
          <p className="reveal text-text-muted">
            Deixe seus dados e avisaremos quando sua vez chegar
          </p>
        </div>

        {refCode && (
          <div className="reveal flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-violet/10 border border-accent-violet/20">
              <span className="w-2 h-2 rounded-full bg-accent-violet" />
              <span className="text-sm text-accent-violet font-medium">
                Convite: {refCode}
              </span>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="reveal gradient-border rounded-2xl"
        >
          <div className="rounded-2xl bg-surface-raised p-8 space-y-5">
            <div>
              <label
                htmlFor="wl-name"
                className="block text-sm font-medium mb-2 text-text-muted"
              >
                Nome
              </label>
              <input
                id="wl-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface border border-surface-border text-text placeholder:text-text-subtle focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 focus:outline-none transition-all duration-300"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label
                htmlFor="wl-email"
                className="block text-sm font-medium mb-2 text-text-muted"
              >
                Email
              </label>
              <input
                id="wl-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface border border-surface-border text-text placeholder:text-text-subtle focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 focus:outline-none transition-all duration-300"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="wl-whatsapp"
                className="block text-sm font-medium mb-2 text-text-muted"
              >
                WhatsApp
              </label>
              <input
                id="wl-whatsapp"
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface border border-surface-border text-text placeholder:text-text-subtle focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 focus:outline-none transition-all duration-300"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label
                htmlFor="wl-instagram"
                className="block text-sm font-medium mb-2 text-text-muted"
              >
                Instagram{' '}
                <span className="text-text-subtle text-xs">(opcional)</span>
              </label>
              <input
                id="wl-instagram"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-surface border border-surface-border text-text placeholder:text-text-subtle focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 focus:outline-none transition-all duration-300"
                placeholder="@seuuser"
              />
            </div>

            <button
              type="submit"
              disabled={formState === 'submitting'}
              className="btn-glow w-full py-4 rounded-xl bg-gradient-to-r from-accent-violet to-accent-indigo text-white font-semibold text-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {formState === 'submitting'
                ? 'Enviando...'
                : 'Garantir minha vaga'}
            </button>

            {formState === 'error' && (
              <p className="text-red-400 text-sm text-center">{errorMsg}</p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function WaitlistForm() {
  return (
    <Suspense
      fallback={
        <section id="waitlist" className="py-16 sm:py-28 px-6">
          <div className="max-w-md mx-auto text-center">
            <h2 className="font-display text-3xl font-bold mb-4">
              Garanta seu acesso antecipado
            </h2>
            <div className="rounded-2xl bg-surface-raised border border-surface-border p-8">
              <div className="h-64 animate-pulse rounded-xl bg-surface-overlay" />
            </div>
          </div>
        </section>
      }
    >
      <WaitlistFormInner />
    </Suspense>
  );
}

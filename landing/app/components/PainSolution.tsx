'use client';

import { useReveal } from '../../lib/useReveal';

const cards = [
  {
    pain: 'Sem tempo pra criar',
    solution: 'IA pesquisa e escreve pra você',
    detail:
      'Diga o tema e receba textos prontos com pesquisa atualizada, hashtags e CTA.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    gradient: 'from-accent-violet/10 to-accent-indigo/5',
    accent: 'text-accent-violet',
  },
  {
    pain: 'Design caro e lento',
    solution: 'Imagens e carrosséis gerados em segundos',
    detail:
      'IA gera imagens únicas para cada conteúdo. Carrosséis com até 10 slides prontos.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    ),
    gradient: 'from-accent-indigo/10 to-accent-cyan/5',
    accent: 'text-accent-indigo',
  },
  {
    pain: 'Sem consistência',
    solution: 'Agendamento automático, todo dia tem conteúdo',
    detail:
      'Configure uma vez e receba conteúdo novo automaticamente, no horário que você definir.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    gradient: 'from-accent-cyan/10 to-accent-violet/5',
    accent: 'text-accent-cyan',
  },
];

export default function PainSolution() {
  const ref = useReveal();

  return (
    <section className="py-16 sm:py-28 px-6 relative" ref={ref}>
      {/* Subtle divider line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-surface-border to-transparent" />

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="reveal text-sm font-medium uppercase tracking-[0.2em] text-accent-violet mb-4">
            O problema
          </p>
          <h2 className="reveal font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Criar conteúdo não deveria
            <br />
            ser{' '}
            <span className="text-text-subtle line-through decoration-text-subtle/30">
              tão difícil
            </span>
          </h2>
        </div>

        <div className="stagger grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <div
              key={i}
              className={`reveal group relative rounded-2xl bg-gradient-to-b ${card.gradient} p-[1px]`}
            >
              <div className="rounded-2xl bg-surface-raised p-7 h-full flex flex-col transition-all duration-500 group-hover:-translate-y-1">
                {/* Icon */}
                <div
                  className={`${card.accent} w-11 h-11 rounded-xl bg-surface-overlay flex items-center justify-center mb-5 border border-surface-border`}
                >
                  {card.icon}
                </div>

                {/* Pain — struck through */}
                <p className="text-text-subtle text-sm line-through decoration-text-subtle/30 mb-2">
                  {card.pain}
                </p>

                {/* Solution */}
                <h3 className="font-display text-lg font-semibold leading-snug mb-3">
                  {card.solution}
                </h3>

                {/* Detail */}
                <p className="text-text-muted text-sm leading-relaxed mt-auto">
                  {card.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useReveal } from '../hooks/useReveal';

const steps = [
  {
    number: '01',
    title: 'Descreva o tema',
    description:
      'Diga o que quer criar — um post, carrossel ou thread. A IA pesquisa tendencias e novidades sobre o tema em tempo real.',
  },
  {
    number: '02',
    title: 'IA cria o conteudo',
    description:
      'Em segundos, voce recebe texto + imagem prontos. Pesquisador, redator e designer trabalham juntos, automaticamente.',
  },
  {
    number: '03',
    title: 'Aprove e publique',
    description:
      'Revise no painel, edite o que quiser e publique direto para o Instagram. Ou agende para o melhor horario.',
  },
];

export default function HowItWorks() {
  const ref = useReveal();

  return (
    <section className="py-28 px-6 relative" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <p className="reveal text-sm font-medium uppercase tracking-[0.2em] text-accent-cyan mb-4">
            Como funciona
          </p>
          <h2 className="reveal font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Tres passos. Conteudo pronto.
          </h2>
        </div>

        <div className="stagger relative">
          {/* Connecting gradient line — desktop only */}
          <div className="hidden md:block absolute top-[44px] left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-accent-violet via-accent-indigo to-accent-cyan opacity-20 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="reveal relative text-center">
                {/* Number circle */}
                <div className="relative z-10 w-[56px] h-[56px] mx-auto mb-8">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-violet to-accent-cyan opacity-10" />
                  <div className="absolute inset-[1px] rounded-full bg-surface flex items-center justify-center">
                    <span className="font-display text-lg font-bold gradient-text">
                      {step.number}
                    </span>
                  </div>
                </div>

                <h3 className="font-display text-xl font-semibold mb-3">
                  {step.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed max-w-[260px] mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

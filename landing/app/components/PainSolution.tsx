const cards = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    pain: "Sem tempo pra criar",
    solution: "IA pesquisa e escreve pra você",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    pain: "Design caro e lento",
    solution: "Imagens e carrosséis gerados em segundos",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    pain: "Sem consistência",
    solution: "Agendamento automático, todo dia tem conteúdo",
  },
];

export default function PainSolution() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-4">
          Chega de sofrer pra postar
        </h2>
        <p className="text-brand-muted text-center mb-16 max-w-lg mx-auto">
          Os problemas que todo criador enfrenta — resolvidos com IA.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-brand-border bg-brand-card p-8 transition-all duration-300 hover:border-brand-purple/30 hover:shadow-[0_0_30px_rgba(167,139,250,0.06)]"
            >
              <div className="text-brand-purple mb-6">{card.icon}</div>

              <p className="text-brand-muted line-through decoration-brand-muted/40 text-sm mb-3">
                {card.pain}
              </p>

              <p className="text-white font-semibold text-lg leading-snug">
                {card.solution}
              </p>

              {/* Subtle top-border glow on hover */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-purple/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

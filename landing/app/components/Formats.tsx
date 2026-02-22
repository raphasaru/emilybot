'use client';

import { useReveal } from '../../lib/useReveal';

const formats = [
  { label: 'Post', emoji: '📝', color: 'from-accent-violet/20 to-accent-violet/5', border: 'border-accent-violet/15' },
  { label: 'Carrossel', emoji: '🎠', color: 'from-accent-indigo/20 to-accent-indigo/5', border: 'border-accent-indigo/15' },
  { label: 'Thread', emoji: '🧵', color: 'from-accent-cyan/20 to-accent-cyan/5', border: 'border-accent-cyan/15' },
  { label: 'Reels Script', emoji: '🎬', color: 'from-accent-amber/20 to-accent-amber/5', border: 'border-accent-amber/15' },
  { label: 'Stories', emoji: '📱', color: 'from-accent-violet/15 to-accent-cyan/5', border: 'border-accent-violet/10' },
];

export default function Formats() {
  const ref = useReveal();

  return (
    <section className="py-16 sm:py-28 px-6 relative" ref={ref}>
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-violet/[0.02] to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="reveal text-sm font-medium uppercase tracking-[0.2em] text-accent-amber mb-4">
            Formatos
          </p>
          <h2 className="reveal font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Tudo que suas redes precisam
          </h2>
        </div>

        <div className="stagger flex flex-wrap justify-center gap-4">
          {formats.map((fmt, i) => (
            <div
              key={i}
              className={`reveal group flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-b ${fmt.color} border ${fmt.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent-violet/5 cursor-default`}
            >
              <span className="text-2xl" role="img" aria-label={fmt.label}>
                {fmt.emoji}
              </span>
              <span className="font-display font-semibold text-[15px]">
                {fmt.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useReveal } from '../hooks/useReveal';

const stats = [
  { value: '50+', label: 'Conteudos gerados no beta' },
  { value: '< 30s', label: 'Tempo medio por conteudo' },
  { value: '5', label: 'Formatos diferentes' },
];

export default function SocialProof() {
  const ref = useReveal();

  return (
    <section className="py-20 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <div className="reveal rounded-2xl glass p-8 sm:p-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={`text-center ${
                  i < stats.length - 1
                    ? 'sm:border-r sm:border-surface-border'
                    : ''
                }`}
              >
                <div className="font-display text-3xl sm:text-4xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <p className="text-text-muted text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import MascotAvatar from './MascotAvatar';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        scrolled
          ? 'glass border-none shadow-[0_1px_20px_rgba(6,6,10,0.8)] py-2 sm:py-3'
          : 'bg-transparent py-3 sm:py-5'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Logo with mascot */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-accent-violet/20 to-accent-indigo/20 border border-accent-violet/20 flex items-center justify-center overflow-hidden">
            <MascotAvatar className="w-10 h-10 sm:w-9 sm:h-9 -mb-0.5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">
            EmilyBot
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
          className="btn-glow px-5 py-2 rounded-full bg-surface-overlay border border-surface-border text-sm font-medium text-text-muted hover:text-text transition-colors duration-300"
        >
          Entrar na lista
        </button>
      </div>
    </header>
  );
}

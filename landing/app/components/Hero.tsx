"use client";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-6">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-purple/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-purple-dark/8 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-border bg-brand-card/60 backdrop-blur-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse" />
          <span className="text-sm text-brand-muted">Beta fechado — vagas limitadas</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          Conteúdo profissional no{" "}
          <span className="text-brand-purple">piloto automático</span>
        </h1>

        <p className="text-lg sm:text-xl text-brand-muted max-w-xl mx-auto mb-10 leading-relaxed">
          IA que pesquisa, escreve e cria imagens para suas redes sociais.
          Você só aprova e publica.
        </p>

        <button
          onClick={() => {
            document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brand-purple text-white font-semibold text-lg transition-all duration-300 hover:bg-brand-purple-dark hover:shadow-[0_0_40px_rgba(167,139,250,0.3)] hover:scale-105 active:scale-[0.98]"
        >
          Quero acesso antecipado
          <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        {/* Subtle scroll indicator */}
        <div className="mt-16 animate-bounce">
          <svg className="w-6 h-6 mx-auto text-brand-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </div>
    </section>
  );
}

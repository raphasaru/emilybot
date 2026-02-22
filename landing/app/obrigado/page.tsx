import Link from 'next/link';

export const metadata = {
  title: 'Obrigado — EmilyBot',
};

export default function ObrigadoPage() {
  return (
    <>
      <div className="noise" />

      <main className="min-h-screen flex items-center justify-center px-6 py-20 relative">
        {/* Ambient blobs */}
        <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-accent-violet/8 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] rounded-full bg-accent-cyan/6 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-lg w-full text-center">
          {/* Check icon */}
          <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-accent-violet/20 to-accent-cyan/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-accent-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Você está na lista!
          </h1>

          <p className="text-text-muted text-lg leading-relaxed mb-6">
            Obrigado pelo interesse no EmilyBot. Nossa equipe vai entrar em contato pelo
            WhatsApp para te apresentar a ferramenta e agendar seu acesso.
          </p>

          <div className="glass rounded-2xl p-6 mb-10 text-left space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 w-6 h-6 rounded-full bg-accent-violet/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold gradient-text">1</span>
              </span>
              <p className="text-text-muted text-sm leading-relaxed">
                Vamos te chamar no WhatsApp nos próximos dias
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 w-6 h-6 rounded-full bg-accent-violet/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold gradient-text">2</span>
              </span>
              <p className="text-text-muted text-sm leading-relaxed">
                Faremos uma apresentação rápida de como o EmilyBot funciona
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 w-6 h-6 rounded-full bg-accent-violet/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold gradient-text">3</span>
              </span>
              <p className="text-text-muted text-sm leading-relaxed">
                Você recebe acesso e começa a criar conteúdo no piloto automático
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Voltar para o início
          </Link>
        </div>
      </main>
    </>
  );
}

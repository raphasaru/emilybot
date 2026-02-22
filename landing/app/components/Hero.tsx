'use client';

import Mascot from './Mascot';
import MascotAvatar from './MascotAvatar';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Ambient gradient blobs */}
      <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-accent-violet/8 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-accent-indigo/6 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-accent-cyan/4 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-20 sm:pt-32 pb-16 sm:pb-20 w-full">
        {/* Mobile mascot — first element */}
        <div
          className="flex lg:hidden justify-center opacity-0 animate-fade-up mb-2"
          style={{ animationDelay: '0ms' }}
        >
          <Mascot className="w-[180px] sm:w-[220px]" />
        </div>

        <div className="grid lg:grid-cols-[1fr,auto,auto] gap-10 lg:gap-8 items-center">
          {/* Left — Copy */}
          <div className="max-w-xl text-center lg:text-left mx-auto lg:mx-0">
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass mb-8 opacity-0 animate-fade-up"
              style={{ animationDelay: '0ms' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan" />
              </span>
              <span className="text-sm text-text-muted">
                Beta fechado &mdash; vagas limitadas
              </span>
            </div>

            <h1
              className="font-display text-[clamp(2.5rem,5.5vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight mb-7 opacity-0 animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              Conteúdo profissional
              <br />
              no{' '}
              <span className="gradient-text">piloto automático</span>
            </h1>

            <p
              className="text-lg sm:text-xl text-text-muted leading-relaxed max-w-lg mb-10 opacity-0 animate-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              IA que pesquisa, escreve e cria imagens para suas redes sociais.
              Você só aprova e publica.
            </p>

            <div
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 opacity-0 animate-fade-up"
              style={{ animationDelay: '300ms' }}
            >
              <button
                onClick={() =>
                  document
                    .getElementById('waitlist')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="btn-glow group relative px-8 py-4 rounded-full bg-gradient-to-r from-accent-violet to-accent-indigo text-white font-semibold text-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Quero acesso antecipado
                  <svg
                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </span>
              </button>

            </div>
          </div>

          {/* Center — Mascot (desktop: between text & chat) */}
          <div
            className="hidden lg:flex justify-center opacity-0 animate-fade-up"
            style={{ animationDelay: '350ms' }}
          >
            <Mascot className="w-[200px] xl:w-[240px]" />
          </div>

          {/* Right — Mock Telegram conversation */}
          <div
            className="opacity-0 animate-fade-up flex justify-center lg:justify-end"
            style={{ animationDelay: '400ms' }}
          >
            <div className="relative">
              <div className="w-[280px] sm:w-[320px] rounded-3xl bg-surface-raised border border-surface-border overflow-hidden shadow-2xl shadow-accent-violet/5">
                {/* Telegram header */}
                <div className="bg-surface-overlay px-4 py-3 flex items-center gap-3 border-b border-surface-border">
                  <div className="w-11 h-11 rounded-full bg-surface overflow-hidden flex items-center justify-center">
                    <MascotAvatar className="w-14 h-14 -mb-1" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">EmilyBot</div>
                    <div className="text-xs text-accent-cyan">online</div>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="p-4 space-y-3 min-h-[380px]">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[220px] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-accent-violet/20 border border-accent-violet/10">
                      <p className="text-sm leading-relaxed">
                        /criar post sobre tendências de IA em 2026
                      </p>
                    </div>
                  </div>

                  {/* Bot searching */}
                  <div className="flex justify-start">
                    <div className="max-w-[240px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
                      <p className="text-xs text-accent-cyan mb-1.5 font-medium">
                        Pesquisando...
                      </p>
                      <p className="text-sm text-text-muted leading-relaxed">
                        Encontrei 5 tendências em alta. Gerando conteúdo...
                      </p>
                    </div>
                  </div>

                  {/* Bot draft response */}
                  <div className="flex justify-start">
                    <div className="max-w-[260px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
                      <p className="text-sm leading-relaxed mb-2">
                        Pronto! Seu post sobre{' '}
                        <span className="text-accent-violet font-medium">
                          Agentes de IA
                        </span>{' '}
                        está no rascunho.
                      </p>
                      <div className="rounded-lg bg-surface/60 border border-surface-border-subtle p-2.5">
                        <p className="text-xs text-text-muted mb-1">
                          Rascunho gerado
                        </p>
                        <p className="text-sm font-medium leading-snug">
                          2026: O ano dos agentes autônomos
                        </p>
                        <p className="text-xs text-text-subtle mt-1">
                          847 caracteres &middot; 3 hashtags
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bot image */}
                  <div className="flex justify-start">
                    <div className="max-w-[260px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
                      <div className="rounded-lg overflow-hidden mb-2 h-28 bg-gradient-to-br from-accent-violet/20 via-accent-indigo/15 to-accent-cyan/10 flex items-center justify-center">
                        <div className="text-center">
                          <svg
                            className="w-8 h-8 mx-auto text-accent-violet/60 mb-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                            />
                          </svg>
                          <p className="text-[10px] text-accent-violet/50">
                            Imagem gerada por IA
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-text-muted">
                        Imagem criada para o post. Acesse o painel para editar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating decorations */}
              <div
                className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl bg-accent-cyan/5 border border-accent-cyan/10 animate-float"
                style={{ animationDelay: '1s' }}
              />
              <div
                className="absolute -bottom-3 -left-3 w-14 h-14 rounded-xl bg-accent-violet/5 border border-accent-violet/10 animate-float"
                style={{ animationDelay: '2.5s' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
    </section>
  );
}

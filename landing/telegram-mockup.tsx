<div className="relative">
  <div className="w-[320px] rounded-3xl bg-surface-raised border border-surface-border overflow-hidden shadow-2xl shadow-accent-violet/5">
    {/* Telegram header */}
    <div className="bg-surface-overlay px-4 py-3 flex items-center gap-3 border-b border-surface-border">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-violet to-accent-indigo flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
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
            /criar post sobre tendencias de IA em 2026
          </p>
        </div>
      </div>

      {/* Bot searching */}
      <div className="flex justify-start">
        <div className="max-w-[240px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
          <p className="text-xs text-accent-cyan mb-1.5 font-medium">Pesquisando...</p>
          <p className="text-sm text-text-muted leading-relaxed">
            Encontrei 5 tendencias em alta. Gerando conteudo...
          </p>
        </div>
      </div>

      {/* Bot draft response */}
      <div className="flex justify-start">
        <div className="max-w-[260px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
          <p className="text-sm leading-relaxed mb-2">
            Pronto! Seu post sobre <span className="text-accent-violet font-medium">Agentes de IA</span> esta no rascunho.
          </p>
          <div className="rounded-lg bg-surface/60 border border-surface-border-subtle p-2.5">
            <p className="text-xs text-text-muted mb-1">Rascunho gerado</p>
            <p className="text-sm font-medium leading-snug">2026: O ano dos agentes autonomos</p>
            <p className="text-xs text-text-subtle mt-1">847 caracteres · 3 hashtags</p>
          </div>
        </div>
      </div>

      {/* Bot image */}
      <div className="flex justify-start">
        <div className="max-w-[260px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-overlay border border-surface-border">
          <div className="rounded-lg overflow-hidden mb-2 h-28 bg-gradient-to-br from-accent-violet/20 via-accent-indigo/15 to-accent-cyan/10 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto text-accent-violet/60 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <p className="text-[10px] text-accent-violet/50">Imagem gerada por IA</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">Imagem criada para o post. Acesse o painel para editar.</p>
        </div>
      </div>
    </div>
  </div>

  {/* Floating decorations */}
  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl bg-accent-cyan/5 border border-accent-cyan/10 animate-float" style={{ animationDelay: '1s' }} />
  <div className="absolute -bottom-3 -left-3 w-14 h-14 rounded-xl bg-accent-violet/5 border border-accent-violet/10 animate-float" style={{ animationDelay: '2.5s' }} />
</div>

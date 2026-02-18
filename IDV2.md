# IDV2.md — Identidade Visual: Post Único (estilo X / Threads)

Estilo minimalista que simula um print/screenshot de post no X (Twitter) ou Threads.
Transmite autenticidade e proximidade — parece que o Saru postou algo real.

## Estilo Geral
- **Tema:** Minimalista, fundo branco ou cinza muito claro (`#F7F7F7` ou `#FFFFFF`)
- **Formato:** 3:4 quadrado (Instagram feed)
- **Estética:** Clean, flat, sem efeitos — parece um print real de rede social

## Estrutura do Card (simular post do X ou Threads)
```
┌─────────────────────────────────────────┐
│  [foto perfil] @raphasaru  ·            │
│                                         │
│  Texto do post aqui, casual e direto.   │
│  Pode ter quebras de linha naturais.    │
└─────────────────────────────────────────┘
```

## Elementos
- **Foto de perfil:** circular, canto superior esquerdo — usar `saru-profile.jpg`
- **Username:** `@raphasaru` em negrito
- **Texto:** fonte sans-serif escura, tamanho de leitura confortável, sem negrito excessivo
- **Engajamento:** nenhum — sem likes, reposts ou comentários no rodapé
- **Logo da plataforma:** nenhum — topo direito vazio
- **Sem bordas coloridas** — fundo neutro, zero ruído visual

## Cores
- Fundo: `#FFFFFF` ou `#F5F5F5`
- Texto: `#0F1419` (preto suave do Twitter)
- Username: `#536471` (cinza médio)
- Sem nenhum elemento neon ou gradiente escuro — é o oposto da IDV1

## Tom do Texto
- Parece um pensamento real, opinião forte ou insight rápido
- **Máximo 4-5 linhas curtas** — conciso como um tweet de verdade
- Pode ter uma quebra de linha dramática pra impacto
- ⚠️ Texto longo distorce na geração — sempre usar frases curtas e diretas

## Prompt Base para Gemini Nano Banana
> "Realistic social media post screenshot mockup, 3:4 rectangle, white background (#FFFFFF).
> Top row: circular profile photo on left, bold username '@raphasaru' center-left.
> Large readable dark text body (#0F1419), casual tone.
> Flat design, no gradients, no glow, ultra minimal. Looks like a real screenshot."

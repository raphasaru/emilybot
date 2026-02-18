# IDV.md — Identidade Visual do Carrossel

Sempre que solicitar geração de imagens via Gemini Nano Banana (nano-banana-pro),
use esta identidade visual como base para todos os cards.

## Estilo Geral
- **Tema:** Dark moderno — fundo preto ou gradiente escuro (preto → roxo escuro)
- **Resolução:** 1K (padrão), 2K para posts premium
- **Formato:** 3:4 retangulo (Instagram carrossel)
- **Estética:** Tech, premium, limpo, sem poluição visual

## Cores
- **Fundo:** `#000000` a `#1a0030` (preto para roxo muito escuro)
- **Texto principal:** Branco puro `#FFFFFF` — bold, sans-serif
- **Texto secundário:** Branco levemente acinzentado
- **Destaque / Glow:** Roxo `#7B2FFF` e Azul `#00BFFF` e Ciano `#00FFFF`
- **Labels / Badges:** Fundo roxo escuro com borda roxa brilhante

## Tipografia
- **Títulos:** Extra bold / black weight, tamanho grande, centralizado ou alinhado à esquerda
- **Subtítulos:** Regular ou medium, menor, com espaçamento generoso
- **Labels:** Pequenos, em capslock ou sentence case, dentro de badges arredondados

## Elementos Recorrentes
- Linha divisória com glow roxo/azul (fina, horizontal ou vertical)
- Bordas arredondadas com brilho sutil nos cards internos
- Detalhes de circuito eletrônico no fundo (sutil, não dominante)
- Efeito de brilho/glow nos números e elementos de destaque
- Numeração de slide no canto inferior esquerdo (ex: `01/06`)

## Estrutura de Cards
- **Capa (01):** Frase de impacto grande, centralizada. Glow no fundo.
- **Conceito (02):** Badge de label no topo, título central, subtítulo menor abaixo
- **Dados (03):** Métricas grandes com glow colorido, label no topo
- **Equipe/Recursos (04):** Cards internos em linha com ícone + nome + cargo
- **Comparação (05):** Duas colunas separadas por linha de glow vertical
- **CTA (06):** Pergunta grande + instrução de ação menor, glow no fundo

## Prompt Base para Gemini Nano Banana
Sempre incluir no início do prompt:
> "Instagram carousel card, dark modern aesthetic, 3:4 rectangle format.
> Deep black background with subtle dark purple gradient (#000 to #1a0030).
> Bold white sans-serif typography. Purple and blue neon glow accents.
> Premium tech style, minimal, clean, no clutter."

E no final:
> "Bottom left corner: slide number (ex: 01/06)."

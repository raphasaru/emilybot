# Image Generation — Design

## Goal
Generate images for `post_unico` (IDV2) and `carrossel` (IDV1) formats via Gemini API, triggered by inline button after content text is delivered.

## Model
`gemini-2.5-flash-image` via Google AI Studio REST API (`GEMINI_API_KEY`)

## Files Changed
- `src/services/imageGenerator.js` — new, Gemini API calls + prompt builders
- `src/telegram/handlers.js` — pendingImageFlow, button post-content, callback handler
- `src/telegram/bot.js` — register `image:generate` callback
- Supabase `agents.system_prompt` for `formatador` — carrossel structured JSON output

## Flow
```
format selected (post_unico | carrossel)
  → text pipeline runs
  → text sent to user
  → inline button "🖼️ Gerar imagem" shown
  → pendingImageFlow = { format, final_content, draft_id, chatId }
  → user clicks
      post_unico → 1 Gemini call → sendPhoto
      carrossel  → parse cards from final_content → N Gemini calls → N sendPhoto (sequential)
```

## Formatador Update
When format = carrossel, `content` field becomes array of 5–8 cards:
```json
[
  { "slide": "01/06", "type": "capa", "title": "...", "body": "..." },
  { "slide": "02/06", "type": "conceito", "label": "...", "title": "...", "body": "..." },
  { "slide": "03/06", "type": "dados", "label": "...", "metric": "...", "context": "..." },
  { "slide": "04/06", "type": "conteudo", "title": "...", "body": "..." },
  { "slide": "05/06", "type": "comparacao", "left": "...", "right": "..." },
  { "slide": "06/06", "type": "cta", "question": "...", "action": "..." }
]
```

## IDV Mapping
- `post_unico` → IDV2: white bg, X/Threads mockup, @raphasaru, dark text
- `carrossel` → IDV1: dark gradient bg, neon glow, 3:4, numbered slides

## State
```js
let pendingImageFlow = null;
// { format, final_content, draft_id, chatId }
```

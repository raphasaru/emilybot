# Adicionar novo tester

## 1. Tester cria o bot no Telegram
- Abrir [@BotFather](https://t.me/BotFather) → `/newbot` → anotar o token
- Abrir o bot criado → mandar qualquer mensagem → anotar o chat_id
  (ou usar [@userinfobot](https://t.me/userinfobot))

## 2. Tester provê as API keys
- **Gemini**: [aistudio.google.com](https://aistudio.google.com) → Get API Key (obrigatório)
- **Brave Search**: [brave.com/search/api](https://api.search.brave.com) → free tier (opcional)
- **fal.ai**: [fal.ai](https://fal.ai) → para geração de imagens (opcional)

## 3. Registrar no servidor (VPS)
```bash
node scripts/register-tenant.js \
  --name "nome_identificador" \
  --bot_token "123456:ABC..." \
  --chat_id "987654321" \
  --gemini_key "AIza..." \
  --owner_name "Nome do Tester" \
  --niche "nicho de atuação" \
  --specialization "área1, área2, área3" \
  --brave_key "BSK-..." \
  --fal_key "fal-..."
```

## 4. Reiniciar o bot
```bash
pm2 restart emilybot
```

O bot do tester já estará ativo e isolado dos demais.

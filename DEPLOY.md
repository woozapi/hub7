# 🚀 Deploy Guide - Fly.io + Vercel

## Arquitetura
- **Vercel** → Frontend (gratuito)
- **Fly.io** → Baileys Server (gratuito)

---

## 1. Fly.io (Baileys Server)

### Instalação
```bash
npm install -g flyctl
flyctl auth login
```

### Configurar secrets
```bash
flyctl secrets set VITE_SUPABASE_URL=https://seu-supabase.co
flyctl secrets set VITE_SUPABASE_ANON_KEY=sua-chave
flyctl secrets set GEMINI_API_KEY=sua-chave
flyctl secrets set ALLOWED_ORIGINS=https://sua-app.vercel.app
```

### Deploy
```bash
# Criar volume persistente
flyctl volumes create whatsapp_auth --size 1 --region gru

# Deploy
flyctl deploy
```

### URL do servidor
```
https://lumen-crm.fly.dev
```

---

## 2. Vercel (Frontend)

### Deploy
1. Acesse https://vercel.com
2. Importar repositório
3. Configurar variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automático

---

## 3. Configurar no Frontend

No Vercel, adicione a variável:
```
VITE_WHATSAPP_API_URL=https://lumen-crm.fly.dev
```

No código, altere as chamadas API para usar esse URL.

---

## 📊 Custo
| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby | Grátis |
| Fly.io | Free | Grátis (3 apps) |
| Supabase | Free | Grátis |
| **Total** | | **R$0** |

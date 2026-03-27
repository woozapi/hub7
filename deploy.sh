#!/bin/bash

# ================================================================================
# Deploy Script - Fly.io (Baileys Server)
# ================================================================================

echo "🚀 Deploying to Fly.io..."

# Verificar se flyctl está instalado
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl não instalado. Instale com: npm install -g flyctl"
    exit 1
fi

# Criar volume para auth do WhatsApp
echo "📦 Creating persistent volume..."
flyctl volumes create whatsapp_auth --size 1 --region gru || true

# Deploy
echo "🚀 Deploying app..."
flyctl deploy

echo "✅ Deploy completo!"
echo "🌐 URL: $(flyctl apps list | grep lumen-crm | awk '{print $2}')"

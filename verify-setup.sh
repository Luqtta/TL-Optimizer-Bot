#!/bin/bash

echo "🔍 Checklist de Verificação - LS Optimizer Discord Bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar dependências
echo ""
echo "📦 Verificando dependências..."
npm list better-sqlite3 > /dev/null 2>&1 && echo "✅ better-sqlite3 instalado" || echo "❌ better-sqlite3 NÃO instalado"

# Verificar variáveis de ambiente
echo ""
echo "🔐 Verificando variáveis de ambiente (.env)..."

check_env() {
  if grep -q "^$1=" .env 2>/dev/null; then
    echo "✅ $1 configurado"
  else
    echo "❌ $1 NÃO configurado"
  fi
}

check_env "DISCORD_TOKEN"
check_env "LS_API_URL"
check_env "DISCORD_BOT_API_KEY"
check_env "LS_WEBHOOK_SECRET"
check_env "ROLE_MONTHLY_ID"
check_env "ROLE_YEARLY_ID"
check_env "ROLE_LIFETIME_ID"
check_env "DISCORD_SYNC_LOG_CHANNEL_ID"

# Verificar arquivos de serviço
echo ""
echo "📁 Verificando arquivos de serviço..."
check_file() {
  if [ -f "src/services/$1" ]; then
    echo "✅ $1 existe"
  else
    echo "❌ $1 NÃO encontrado"
  fi
}

check_file "database.service.ts"
check_file "dm.service.ts"
check_file "sync.service.ts"
check_file "reconcile.service.ts"
check_file "lsWebhook.service.ts"

# Verificar tipos
echo ""
echo "📚 Verificando tipos..."
if [ -f "src/types/index.ts" ]; then
  echo "✅ tipos definidos"
else
  echo "❌ tipos NÃO encontrados"
fi

# Verificar banco de dados
echo ""
echo "💾 Verificando banco de dados..."
if [ -f "data/bot.db" ]; then
  echo "✅ Banco de dados existe"
  echo "   Tamanho: $(du -h data/bot.db | cut -f1)"
else
  echo "⚠️  Banco de dados será criado na primeira execução"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Verificação concluída!"
echo ""
echo "📝 Próximas etapas:"
echo "   1. npm install (se ainda não fez)"
echo "   2. npm run build"
echo "   3. npm start"
echo ""

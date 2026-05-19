#!/bin/bash

echo "🚀 Quick Start - LS Optimizer Discord Bot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Instalar dependências
echo ""
echo "📦 Passo 1: Instalando dependências..."
npm install

# 2. Configurar variáveis de ambiente
echo ""
echo "🔐 Passo 2: Configurar .env"
echo "   Copie .env.example para .env e preencha os valores:"
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "   ✅ .env criado (edite-o com suas credenciais)"
else
  echo "   ✅ .env já existe"
fi

# 3. Build TypeScript
echo ""
echo "🔨 Passo 3: Compilando TypeScript..."
npm run build

if [ $? -eq 0 ]; then
  echo "   ✅ Build bem-sucedido!"
else
  echo "   ❌ Erro na compilação!"
  exit 1
fi

# 4. Deploy de comandos
echo ""
echo "📝 Passo 4: Registrando comandos no Discord..."
npm run deploy

if [ $? -eq 0 ]; then
  echo "   ✅ Comandos registrados!"
else
  echo "   ⚠️  Erro ao registrar comandos (pode ser problema de credenciais)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Setup concluído!"
echo ""
echo "🎯 Próximas etapas:"
echo "   1. npm start (para iniciar o bot)"
echo "   2. Verifique que o bot está online no Discord"
echo "   3. Teste os comandos: /ping"
echo ""
echo "📚 Documentação:"
echo "   - SYSTEM_DOCUMENTATION.md (arquitetura detalhada)"
echo "   - TROUBLESHOOTING.md (resolução de problemas)"
echo ""

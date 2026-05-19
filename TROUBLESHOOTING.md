# Troubleshooting - LS Optimizer Discord Bot

## 🔴 Problemas Comuns

### 1. Bot não inicia

**Erro: `Error: Database not initialized`**

```bash
# Solução: Crie o diretório de dados
mkdir -p data
npm start
```

**Erro: `Cannot find module 'better-sqlite3'`**

```bash
# Solução: Instale a dependência
npm install better-sqlite3
# Se falhar, tente:
npm install --build-from-source
```

### 2. Webhook não recebendo eventos

**Sintoma: Nenhum evento chegando, mas sem erro**

```bash
# 1. Verifique o port está aberto
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# 2. Verifique LS_WEBHOOK_SECRET está correto
# Compare com o secret configurado no backend

# 3. Verifique WEBHOOK_PORT está correto no .env
```

**Erro: `Unauthorized (401)`**

- Assinatura HMAC inválida
- Verificar `LS_WEBHOOK_SECRET` exato
- Backend está usando o mesmo secret?

**Erro: `Timestamp expired`**

- Relógio do servidor está fora de sincronia
- Sincronize com NTP: `ntpdate -u pool.ntp.org`

### 3. Cargos não sincronizando

**Sintoma: Usuário vinculado, mas sem cargo**

```bash
# 1. Verifique os IDs dos cargos no .env
# Vá em Discord > Server > Roles > Botão direito > Copy Role ID

ROLE_MONTHLY_ID=123456789
ROLE_YEARLY_ID=987654321
ROLE_LIFETIME_ID=555666777

# 2. Verifique permissões do bot
# O bot tem permissão "Manage Roles"?
# Os cargos do bot estão acima dos cargos de plano?

# 3. Teste manualmente
/sync @user monthly
# Deve funcionar no /stats depois
```

**Erro: `Missing Access`**

- Bot não tem permissão "Manage Roles"
- Role do bot está muito baixa na hierarquia
- Cargo a atribuir está acima do cargo do bot

### 4. DM não chegando

**Sintoma: Usuário não recebe notificações**

- Usuário bloqueou o bot?
- DMs bloqueadas por padrão?
- Checar logs em `DISCORD_SYNC_LOG_CHANNEL_ID`

**Log: `Failed to send DM to user`**

- Não é possível forçar DM aberta
- Enviar mensagem no canal público notificando

### 5. Reconciliação não funcionando

**Sintoma: `RECONCILE: Erro na reconciliação`**

```bash
# Verifique LS_API_URL
echo $LS_API_URL
# Deve ser algo como: http://localhost:3000

# Verifique DISCORD_BOT_API_KEY
# Deve estar correto no backend

# Teste endpoint manualmente
curl -X POST http://localhost:3000/discord/link/sync \
  -H "Content-Type: application/json" \
  -H "X-Bot-Api-Key: YOUR_KEY" \
  -d '{"email": "test@example.com"}'
```

### 6. Banco de dados corrompido

**Sintoma: `database disk image malformed`**

```bash
# 1. Fazer backup
cp data/bot.db data/bot.db.backup

# 2. Remover banco
rm data/bot.db

# 3. Reiniciar bot (vai recriar)
npm start
```

### 7. Comandos não aparecem

**Sintoma: `/ping` não funciona**

```bash
# 1. Registre os comandos
npm run deploy

# 2. Aguarde até 1 hora se foram globais
# Se guild-only, deve aparecer em segundos

# 3. Verifique CLIENT_ID está correto
# Vá em Developer Portal > Application ID
```

**Erro: `Invalid token`**

- `DISCORD_TOKEN` está incorreto
- Token expirou (gere novo)

### 8. Performance / Lag

**Sintoma: Reconciliação está lenta**

```bash
# 1. Aumentar tamanho do batch
# Editar em src/services/reconcile.service.ts
const BATCH_SIZE = 5;  // Aumente para 10

# 2. Aumentar intervalo
const RECONCILE_INTERVAL = 30 * 60 * 1000; // 30 min, aumentar para 60
```

**Memoria crescendo demais**

- Limpar logs antigos
- Backup e limpar tabela `sync_logs`

```bash
# No banco SQLite
DELETE FROM sync_logs WHERE timestamp < datetime('now', '-7 days');
```

## 🟢 Verificação de Saúde

```bash
# Script para verificar tudo
bash verify-setup.sh
```

### Checklist Manual

- [ ] `npm list better-sqlite3` - Dependência instalada?
- [ ] `cat .env | grep DISCORD_TOKEN` - Token configurado?
- [ ] `cat .env | grep LS_WEBHOOK_SECRET` - Secret configurado?
- [ ] `npm run build` - TypeScript compila?
- [ ] `npm run deploy` - Comandos registram?
- [ ] `npm start` - Bot inicia?
- [ ] Bot está online no Discord?
- [ ] Cargos estão criados no servidor?
- [ ] Bot tem permissão de gerenciar roles?

## 🔍 Debug

### Verbosidade de Logs

Todos os logs têm prefixo para rastreabilidade:

- `[DATABASE]` - Operações de banco
- `[WEBHOOK]` - Eventos recebidos
- `[SYNC]` - Sincronização de cargos
- `[DM]` - Notificações enviadas
- `[RECONCILE]` - Reconciliação automática
- `[LOGS]` - Registros em canal
- `[DISCORD]` - Discord.js
- `[GITHUB]` - GitHub webhook

### Monitorar Logs em Tempo Real

```bash
# Seguir logs conforme aparecem
npm start | grep -E "\[WEBHOOK\]|\[SYNC\]"

# Ou filtrar por evento específico
npm start | grep "WEBHOOK"
```

### Inspecionar Banco de Dados

```bash
# Instalar sqlite3
sudo apt install sqlite3  # Ubuntu/Debian
brew install sqlite3     # macOS

# Abrir banco
sqlite3 data/bot.db

# Comandos úteis no sqlite3
SELECT COUNT(*) FROM linked_users;  -- Usuários vinculados
SELECT * FROM linked_users;          -- Lista todos
SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 10;  -- Últimas 10 ações
.headers on
.mode column
```

## 📞 Suporte

Se o problema persistir:

1. Verificar logs no canal `DISCORD_SYNC_LOG_CHANNEL_ID`
2. Editar `.env` para debug mode (adicionar variável)
3. Executar `verify-setup.sh`
4. Comparar com `SYSTEM_DOCUMENTATION.md`

## 🚨 Checklist de Segurança

- [ ] `DISCORD_TOKEN` não está no git
- [ ] `LS_WEBHOOK_SECRET` é forte (min 32 chars)
- [ ] `DISCORD_BOT_API_KEY` é seguro
- [ ] `.env` está em `.gitignore`
- [ ] Banco de dados (`data/`) está em `.gitignore`
- [ ] Nenhum token em logs públicos
- [ ] HTTPS em produção para webhooks

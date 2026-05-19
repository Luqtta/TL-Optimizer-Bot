# LS Optimizer Discord Bot - Sistema Enterprise

## 🎯 Visão Geral

Sistema enterprise de sincronização Discord ↔ LS Optimizer com automação completa, persistência local, e reconciliação automática.

## 🏗️ Arquitetura

### Serviços Principais

#### 1. **Database Service** (`database.service.ts`)
- Persistência em SQLite
- Tabelas: `linked_users`, `webhook_events`, `sync_logs`
- Operações: CRUD de usuários vinculados, logs de sincronização

#### 2. **DM Service** (`dm.service.ts`)
- Envia notificações automáticas via DM
- Embeds profissionais com cores por evento
- Eventos suportados: LINKED, UNLINKED, UPGRADED, DOWNGRADED, RENEWED, CANCELED, REACTIVATED, EXPIRED, REFUNDED

#### 3. **Sync Service** (`sync.service.ts`)
- Sincronização de cargos em um ou múltiplos servidores
- Logs administrativos automáticos
- Tratamento de erros robusto

#### 4. **LS Webhook Service** (`lsWebhook.service.ts`)
- Receiver de eventos do backend
- Validação HMAC timing-safe
- Deduplicação de eventos
- Processamento automático de 9 tipos de eventos

#### 5. **Reconcile Service** (`reconcile.service.ts`)
- Scheduler automático a cada 30 minutos
- Sincronização em batches (5 usuários por lote)
- Correção automática de inconsistências
- Logs de reconciliação

## 🔄 Fluxos de Eventos

### LINKED
```
Backend emite evento
↓
Bot recebe webhook
↓
Sincroniza cargo em todas guilds
↓
Salva em banco de dados
↓
Envia DM automática
↓
Log administrativo
```

### UPGRADED / DOWNGRADED
```
Backend emite evento
↓
Bot valida usuário
↓
Remove cargo anterior
↓
Adiciona novo cargo
↓
Atualiza banco de dados
↓
Envia DM com detalhes
↓
Log administrativo
```

### EXPIRED
```
Backend emite evento
↓
Remove todos os cargos premium
↓
Atualiza status em banco
↓
Envia DM informando expiração
↓
Log administrativo
```

## 🔐 Segurança

### Validação Webhook
- **HMAC SHA256 Timing-Safe**: Comparação segura de assinaturas
- **Timestamp Validation**: Máximo 5 minutos de diferença
- **Deduplicação**: Detecta e ignora eventos duplicados
- **Payload Validation**: Validação obrigatória de campos

## 📊 Reconciliação Automática

Executa a cada 30 minutos:

1. Busca todos usuários vinculados
2. Para cada usuário em lotes de 5:
   - Consulta backend via API
   - Compara plano/status
   - Corrige inconsistências (cargos, status)
   - Registra correções em log

**Cenários corrigidos:**
- Usuário perdeu cargo → Devolver
- Assinatura expirou → Remover cargo
- Upgrade não sincronizou → Corrigir
- Downgrade não sincronizou → Corrigir

## 💾 Banco de Dados

### Tabelas

#### `linked_users`
```sql
discord_id      TEXT PRIMARY KEY
email           TEXT UNIQUE NOT NULL
plan            TEXT (MONTHLY|YEARLY|LIFETIME|FREE)
status          TEXT (ACTIVE|CANCELED|EXPIRED)
updated_at      INTEGER
created_at      INTEGER
```

#### `webhook_events`
```sql
id              INTEGER PRIMARY KEY
event_type      TEXT
discord_id      TEXT
email           TEXT
previous_plan   TEXT
new_plan        TEXT
processed       INTEGER
timestamp       INTEGER
created_at      INTEGER
```

#### `sync_logs`
```sql
id              INTEGER PRIMARY KEY
discord_id      TEXT
action          TEXT
reason          TEXT
success         INTEGER
timestamp       INTEGER
```

## 📝 Variáveis de Ambiente

```env
# Discord Bot
DISCORD_TOKEN=

# LS Optimizer API
LS_API_URL=http://localhost:3000
DISCORD_BOT_API_KEY=
LS_WEBHOOK_SECRET=
WEBHOOK_PORT=3001

# Cargos
ROLE_MONTHLY_ID=
ROLE_YEARLY_ID=
ROLE_LIFETIME_ID=

# Canais de Log
FEATURE_CHANNEL_ID=
DISCORD_SYNC_LOG_CHANNEL_ID=

# GitHub
GITHUB_WEBHOOK_SECRET=
```

## 🚀 Inicialização

```bash
# Instalar dependências
npm install

# Build
npm run build

# Iniciar
npm start
```

### Sequência de Inicialização

1. ✅ Carrega variáveis de ambiente
2. ✅ Inicializa banco de dados SQLite
3. ✅ Conecta ao Discord
4. ✅ Inicia webhook server do LS Optimizer (porta 3001)
5. ✅ Inicia webhook server do GitHub
6. ✅ Inicia scheduler de reconciliação (30min)

## 📱 Comandos

### /vincular `<email>`
Inicia processo de vinculação de conta

### /codigo `<codigo>`
Confirma vinculação com código recebido via email

### /desvincular
Remove vinculação da conta

## 📊 Logs Administrativos

Canal configurável: `DISCORD_SYNC_LOG_CHANNEL_ID`

Registra:
- ✅ Webhooks recebidos
- ✅ Cargos adicionados/removidos
- ✅ Upgrade/Downgrade
- ✅ Sincronização bem-sucedida
- ❌ Erros de sincronização
- 🔄 Resultados de reconciliação
- ⚠️ Falhas de DM

## 🛡️ Tratamento de Erros

### DM Fechada
- Tenta enviar, registra em log
- Não trava o fluxo
- Notifica no canal de logs

### Webhook Inválido
- Retorna 401 Unauthorized
- Registra tentativa inválida
- Não processa payload

### API Indisponível
- Retry automático na reconciliação
- Registra falha em log
- Próxima execução tenta novamente

### Rate Limit Discord
- Processamento em batches (5 por lote)
- Delay entre batches
- Não bloqueia event loop

## 🔍 Monitoramento

### Métricas de Reconciliação
- Usuários processados
- Correções aplicadas
- Tempo total de execução
- Taxa de sucesso

### Logs Estruturados
- Timestamp em todos os eventos
- Discord ID para rastreabilidade
- Motivo de cada ação
- Status de sucesso/falha

## 🔄 Multi-Guild Ready

Sistema preparado para múltiplas guilds:
- Sincroniza em todas as guilds onde o bot está
- Remove duplicação de cargos
- Suporte futuro para configuração por guild

## 📦 Estrutura de Pastas

```
src/
├── commands/           # Comandos slash
├── events/            # Listeners de eventos
├── interactions/      # Interações (buttons, modals)
├── services/          # Serviços principais
│   ├── database.service.ts
│   ├── dm.service.ts
│   ├── sync.service.ts
│   ├── lsWebhook.service.ts
│   ├── reconcile.service.ts
│   ├── planRole.service.ts (deprecated)
│   ├── lsApi.service.ts
│   └── githubWebhookServer.ts
├── types/            # Tipos TypeScript
├── index.ts          # Entry point
└── deploy-commands.ts # Deploy de comandos
```

## 🚨 Troubleshooting

### Webhook não recebendo eventos
1. Verificar `LS_WEBHOOK_SECRET` está correto
2. Verificar `WEBHOOK_PORT` está aberto
3. Backend está enviando para endereço correto?

### Cargos não sincronizando
1. Verificar `ROLE_MONTHLY_ID`, `ROLE_YEARLY_ID`, `ROLE_LIFETIME_ID`
2. Bot tem permissão de gerenciar cargos?
3. Cargos estão acima do cargo do bot na hierarquia?

### DM não chegando
1. Usuário bloqueou o bot?
2. Checar logs no canal `DISCORD_SYNC_LOG_CHANNEL_ID`
3. Reentente manualmente com comando

### Reconciliação não funcionando
1. `LS_API_URL` está correto?
2. `DISCORD_BOT_API_KEY` está correto?
3. Backend está respondendo em `/discord/link/sync`?

## 📚 Desenvolvimento Futuro

- [ ] Dashboard de monitoramento
- [ ] Configuração por guild
- [ ] Histórico de mudanças
- [ ] Retry automático de falhas
- [ ] Notificações de erro admin
- [ ] Backup automático de banco de dados
- [ ] API para status de sincronização

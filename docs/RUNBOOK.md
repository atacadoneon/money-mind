# Runbook — MONEY MIND

> Procedimentos de emergência. Mantenha este documento **curto e acionável**. Atualize após cada incidente.

---

## Contatos

| Papel | Pessoa | Contato |
|---|---|---|
| Owner técnico | Everton Lauxen | — |
| DPO | DPO Grupo Lauxen | dpo@grupolauxen.com.br |
| Suporte Supabase | — | https://supabase.com/support |
| Suporte Render | — | https://render.com/support |
| Suporte Vercel | — | https://vercel.com/support |

---

## Severidade

| Sev | Exemplo | SLA resposta |
|---|---|---|
| SEV1 | API fora do ar / dados expostos | imediato |
| SEV2 | Feature crítica quebrada (conciliação, AP) | 1h |
| SEV3 | Degradação parcial | 4h |
| SEV4 | Cosmético / workaround disponível | próximo dia útil |

---

## 1. API fora do ar

**Sintoma:** `/health` retornando 5xx, Sentry disparando, usuários não conseguem logar.

1. Confirmar: `curl https://api.moneymind.com.br/health`
2. Render Dashboard → service → **Logs**
3. Checar eventos recentes:
   - Deploy recente? → **Rollback** (botão no dashboard)
   - DB connection errors? → ver seção 3
   - OOM? → upgrade de plano ou investigar leak
4. Se rollback imediato não resolver: escalar para SEV1 e avisar usuários via status page

### Rollback Render

1. Service → **Deploys**
2. Selecionar deploy anterior (verde)
3. **Rollback to this deploy**
4. Aguardar ~3 min, rodar `bash scripts/healthcheck.sh`

---

## 2. Web fora do ar

**Sintoma:** app.moneymind.com.br não carrega.

1. `curl -I https://app.moneymind.com.br`
2. Vercel Dashboard → project → **Deployments**
3. Rollback: deployment anterior → **... → Promote to Production**
4. Se DNS: checar Cloudflare / provedor

---

## 3. Banco lento ou travado

**Sintoma:** queries timeout, p95 > 2s, filas BullMQ acumulando.

1. Supabase Dashboard → **Database** → **Query performance**
2. Identificar top queries via `pg_stat_statements`
3. Verificar locks:

   ```sql
   SELECT pid, state, query, wait_event, wait_event_type, xact_start
   FROM pg_stat_activity
   WHERE state <> 'idle' AND xact_start < now() - interval '2 minutes';
   ```

4. Matar query travada (com cuidado):

   ```sql
   SELECT pg_cancel_backend(<pid>);   -- tenta gentil
   SELECT pg_terminate_backend(<pid>); -- força
   ```

5. Se pool exhausted: aumentar `pool_max` ou upar plano Supabase
6. Pós-incidente: abrir issue para criar índice / refactor da query

---

## 4. Restore de banco (rollback de migration destrutiva)

### Opção A — PITR (Supabase Pro)

1. Supabase Dashboard → **Database** → **Backups** → **Point in Time**
2. Escolher timestamp ANTES da migration
3. Restore em projeto novo (staging) → validar → swap de DNS se OK

### Opção B — Restore do dump pg_dump

1. Baixar artifact `db-backup-pre-migrate` do workflow `db-migrate.yml`
2. Em ambiente staging primeiro:

   ```bash
   createdb money_mind_restore
   pg_restore --clean --if-exists --no-owner \
     -d postgresql://.../money_mind_restore backup.dump
   ```

3. Validar smoke queries
4. Promover para prod (via Supabase support para swap atômico)

---

## 5. Rotate secrets (vazamento ou rotação programada)

### `JWT_SECRET` (invalida todas as sessões)

1. Gerar novo: `openssl rand -hex 32`
2. Atualizar em Render (api + worker) → deploy
3. Atualizar em Vercel se aplicável → redeploy
4. Comunicar: usuários precisarão relogar

### `ENCRYPTION_KEY` (tokens de integração)

**Cuidado extremo** — invalida todos os tokens cifrados. Rotação correta:

1. Implementar esquema de key-versioning (migration) — ver ADR
2. Deploy com **duas chaves** (nova + antiga) ativas
3. Rodar job que re-cifra tokens com a nova
4. Após 100%, remover chave antiga

### `SUPABASE_SERVICE_ROLE_KEY`

1. Supabase Dashboard → **Settings** → **API** → **Reveal service_role** → **Rotate**
2. Atualizar Render + GitHub Environment Secrets
3. Redeploy

### Credenciais de integração (Tiny, Pagar.me, etc.)

- Por tenant, armazenadas cifradas no banco
- Sem rotação global; cada tenant rotaciona pelo painel `/settings/integrations`

---

## 6. Fila BullMQ entupida

**Sintoma:** jobs acumulando, workers idle ou travados.

1. Inspecionar (Bull Board em `/admin/queues` ou CLI):

   ```bash
   redis-cli -u $REDIS_URL LLEN bull:reconcile:wait
   ```

2. Worker ainda rodando? Render → worker service → logs
3. Se jobs com erro em loop: **retirar failed jobs** depois de corrigir code path
4. Se lock antigo: `redis-cli DEL bull:<queue>:<job-id>:lock`
5. Último recurso — FLUSH da fila (perde jobs):

   ```bash
   redis-cli KEYS 'bull:reconcile:*' | xargs redis-cli DEL
   ```

   **Nunca** `FLUSHDB` em Redis compartilhado.

---

## 7. Vazamento de dados (incidente LGPD)

1. **Contenção imediata:**
   - Bloquear acesso afetado (revogar tokens / desativar user)
   - Se API key vazou: rotacionar
2. **Avaliar escopo:** quantos titulares? quais dados? (CPF, saldo, transações?)
3. **Registrar** em `incidents/YYYY-MM-DD.md` (detalhes, timeline, causa)
4. **DPO decide** se comunica ANPD e titulares (Art. 48 LGPD — "em prazo razoável" — alvo <72h)
5. **Comunicação:**
   - Titulares: email individual
   - ANPD: formulário oficial https://www.gov.br/anpd
6. **Postmortem** em 7 dias úteis

---

## 8. Alerta Sentry — spike de erro

1. Abrir grupo no Sentry
2. Reproduzir em staging se possível
3. Se regressão recente → rollback
4. Se config/env missing → ver `docs/DEPLOYMENT.md` seção secrets
5. Criar issue com link do Sentry + owner

---

## 9. Esgotamento de disco (Render/Supabase)

- Render: ver plano, upgrade se necessário
- Supabase: dashboard → Database → Disk usage
- Se growth descontrolado: identificar tabela (`pg_total_relation_size`) e arquivar / particionar

---

## 10. Teste de restore (rodar trimestralmente)

1. Pegar dump recente do Supabase backup
2. Restaurar em projeto Supabase free separado
3. Rodar smoke queries:

   ```sql
   SELECT count(*) FROM tenants;
   SELECT count(*) FROM accounts_payable WHERE status='paid';
   SELECT max(created_at) FROM audit_log;
   ```

4. Comparar contagens com prod (±1%)
5. Registrar resultado em `docs/restore-tests.md`

---

## 11. Post-mortem template

```
# Incident YYYY-MM-DD — <título curto>

## Impact
- Usuários afetados:
- Duração:
- Severidade:

## Timeline (UTC-3)
- HH:MM — alerta disparou
- HH:MM — engenheiro on-call assumiu
- HH:MM — causa raiz identificada
- HH:MM — fix aplicado / rollback
- HH:MM — resolução confirmada

## Root cause
(1 parágrafo)

## Resolution
(1 parágrafo)

## Action items
- [ ] Proprietário — descrição — prazo
- [ ] ...
```

---

## 12. Redis down — BullMQ sem processar

**Sintoma:** jobs na fila não processam, reconciliações não iniciam, LGPD workers parados.

1. Verificar Redis: `redis-cli -u $REDIS_URL ping` → deve retornar `PONG`
2. Se Upstash: verificar dashboard em https://console.upstash.com
3. **Impact assessment:** quais filas afetadas?
   - `reconcile` → reconciliações pausadas (usuários não recebem resultado)
   - `extrato-parse` → OFX uploads ficam na fila
   - `notify` → notificações atrasadas
   - `lgpd-export` → exportações de dados pausadas
4. **BullMQ retry:** jobs com retry automático irão processar quando Redis voltar
5. Se Redis não voltar em 15 min → comunicar usuários sobre lentidão
6. Se perda de dados suspeita → verificar jobs `failed` após recovery:
   ```bash
   redis-cli -u $REDIS_URL LLEN bull:reconcile:failed
   ```
7. Pós-incidente: adicionar Redis health ao `/health/ready`

---

## 13. Stripe webhook missed — reprocessar

**Sintoma:** assinatura ativa no Stripe mas não refletida no sistema.

1. Stripe Dashboard → **Webhooks** → selecionar endpoint → **Event log**
2. Identificar evento não processado (ex: `customer.subscription.created`)
3. Clicar **Resend** no evento
4. Verificar log da API: `GET /api/v1/webhooks/logs?type=stripe&limit=20`
5. Se webhook secret errado: ver `docs/SECRETS_ROTATION.md` → seção Stripe
6. Verificar `audit_log` para confirmar processamento:
   ```sql
   SELECT * FROM audit_logs WHERE entity = 'billing' ORDER BY created_at DESC LIMIT 10;
   ```

---

## 14. Tiny API down — sync pausado

**Sintoma:** Tiny sync jobs falhando, `tiny-sync` queue com erros.

1. Verificar status: https://status.tiny.com.br
2. Se downtime confirmado: jobs têm retry exponencial — aguardar recovery
3. **Configurar delay** para não sobrecarregar Tiny ao voltar:
   ```bash
   redis-cli -u $REDIS_URL LRANGE bull:tiny-sync:wait 0 -1 | wc -l
   ```
4. Comunicar usuários se downtime > 2h via banner na app
5. Após Tiny voltar: jobs processarão automaticamente (deduplication via tinyId)
6. Verificar se dados ficaram desatualizados: comparar contagens CP/CR vs Tiny

---

## 15. Rate limit excedido por cliente

**Sintoma:** cliente recebendo 429 Too Many Requests.

1. Identificar org/IP: verificar logs na Render com filtro `429`
2. Verificar padrão — legítimo (uso intenso) ou abusivo (scraper/bug):
   ```bash
   grep "429" /var/log/api.log | awk '{print $5}' | sort | uniq -c | sort -rn | head -20
   ```
3. Se legítimo (ex: importação em massa):
   - Contato com cliente para usar endpoints batch
   - Ajuste temporário via `THROTTLER_LIMIT` env
4. Se suspeito/abusivo:
   - Revogar token temporariamente
   - Bloquear IP no nível do Render ou Cloudflare
5. Documentar no log de segurança

---

## 16. Vazamento de PII detectado — resposta LGPD

**Sintoma:** log/Sentry contendo CPF, email, ou dados financeiros em texto claro.

**Resposta imediata (< 1h):**
1. Identificar vetor: qual endpoint/log expôs?
2. Corrigir imediatamente: adicionar redact no logger/Sentry beforeSend
3. Deploy emergencial
4. Revogar tokens potencialmente comprometidos

**Avaliação (< 4h):**
5. Quantos titulares afetados?
6. Quais dados expostos? (CPF, conta bancária, transações?)
7. Por quanto tempo ficaram expostos?
8. Houve acesso não autorizado confirmado?

**Resposta legal (< 72h se notificação obrigatória):**
9. DPO avalia obrigação de notificação (Art. 48 LGPD)
10. Se sim: notificar ANPD + titulares afetados
    - ANPD: https://www.gov.br/anpd/pt-br/assuntos/incidentes
    - Titulares: email individual com template aprovado pelo DPO
11. Registrar incidente em `incidents/YYYY-MM-DD-pii-leak.md`
12. Postmortem em 7 dias

**Checklist de prevenção pós-incidente:**
- [ ] Revisar todos os `console.log` e `logger.log` que podem conter dados do usuário
- [ ] Verificar Sentry beforeSend filtra todos PII
- [ ] Auditar Pino redact paths
- [ ] Adicionar teste automatizado que valida redação de PII nos logs

# Secrets Rotation — MONEY MIND BPO Financeiro

Guia passo-a-passo para rotacionar cada secret crítico sem downtime.

---

## Pré-requisitos

- Acesso ao painel Render (ou Kubernetes/ECS)
- Acesso ao painel Supabase
- Acesso ao painel Stripe
- Acesso ao Redis (Render Redis ou Upstash)
- Git access para atualizar `.env.staging` / `.env.production` templates

---

## 1. DATABASE_URL (PostgreSQL)

**Quando rotacionar:** suspeita de vazamento, auditoria trimestral, offboarding de dev com acesso.

```bash
# 1. Criar nova senha no Supabase Dashboard → Settings → Database
# 2. Gerar nova connection string
# 3. Testar conexão localmente:
psql "postgresql://USER:NEW_PASS@HOST:5432/DB?sslmode=require" -c "\l"

# 4. Atualizar no Render:
render-cli env set DATABASE_URL="postgres://USER:NEW_PASS@HOST/DB" --service money-mind-api

# 5. Restart gracioso (zero downtime no Render):
render-cli deploy --service money-mind-api

# 6. Verificar saúde:
curl https://api.moneymind.com.br/health/ready
```

**Rollback:** manter senha anterior por 24h antes de revogar.

---

## 2. JWT_SECRET / SUPABASE_JWT_SECRET

**Quando rotacionar:** suspeita de comprometimento, rotação semestral obrigatória.

> ATENÇÃO: rotacionar este secret invalida TODOS os tokens de sessão ativos.
> Planejar janela de manutenção ou aceitar re-login de todos os usuários.

```bash
# 1. Gerar novo secret (min 32 bytes):
openssl rand -hex 64

# 2. Atualizar no Supabase Dashboard → Settings → Auth → JWT Secret
# 3. Atualizar variável no Render:
render-cli env set SUPABASE_JWT_SECRET="NEW_SECRET" --service money-mind-api

# 4. Deploy (invalida sessões ativas):
render-cli deploy --service money-mind-api

# 5. Comunicar usuários via email (template em docs/templates/maintenance-email.md)
```

---

## 3. ENCRYPTION_KEY (AES-256-GCM para tokens integração)

**Quando rotacionar:** se suspeitar que a chave foi exposta.

> CRÍTICO: dados em repouso cifrados com a chave antiga precisam ser re-cifrados.
> NÃO rotacionar sem script de migração.

```bash
# 1. Gerar nova chave:
openssl rand -hex 32

# 2. Criar script de migração para re-cifrar tokens:
# Ver: scripts/maintenance/reencrypt-tokens.ts

# 3. Executar script de migração com old key + new key como parâmetros
# 4. Atualizar ENCRYPTION_KEY no Render
# 5. Deploy
# 6. Verificar que integrações (Tiny, ContaSimples, Pagarme) funcionam
```

---

## 4. Stripe Webhook Secret

**Quando rotacionar:** rotação preventiva ou após suspeita de comprometimento.

```bash
# 1. Stripe Dashboard → Webhooks → Selecionar endpoint
# 2. Gerar novo signing secret (Stripe gera automaticamente)
# 3. Atualizar no Render:
render-cli env set STRIPE_WEBHOOK_SECRET="whsec_NEW_SECRET" --service money-mind-api

# 4. Deploy imediato (sem downtime — Stripe aceita período de transição)
# 5. Verificar webhook test no Stripe Dashboard
```

---

## 5. Tiny API Token (por empresa)

**Quando rotacionar:** offboarding de cliente, token comprometido.

```bash
# Tokens Tiny ficam cifrados no banco (tabela companies).
# Rotacionar via interface ou API:

# 1. Solicitar novo token no painel Tiny ERP
# 2. Atualizar via API MONEY MIND:
curl -X PATCH https://api.moneymind.com.br/api/v1/companies/COMPANY_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "x-org-id: ORG_ID" \
  -d '{"tinyToken": "NEW_TOKEN"}'

# 3. Verificar sync: POST /api/v1/integrations/tiny/sync
```

---

## 6. REDIS_URL

```bash
# 1. Gerar nova senha no Redis provider
# 2. Atualizar no Render:
render-cli env set REDIS_URL="redis://:NEW_PASS@HOST:6379" --service money-mind-api

# 3. Deploy — BullMQ reconnects automaticamente
# 4. Verificar fila: GET /health/ready
```

---

## 7. SENTRY_DSN

```bash
# 1. Sentry Dashboard → Settings → Projects → Client Keys
# 2. Revogar DSN antigo
# 3. Criar novo DSN
# 4. Atualizar SENTRY_DSN no Render e nos env vars de build do Next.js (NEXT_PUBLIC_SENTRY_DSN)
# 5. Deploy API + deploy Web
```

---

## Checklist pós-rotação

- [ ] Health check `/health/ready` retorna 200
- [ ] Autenticação funciona (login de teste)
- [ ] Webhooks Stripe processando (checar logs)
- [ ] Sync Tiny funcionando
- [ ] Sem erros no Sentry nas primeiras 15 min
- [ ] Audit log registrando eventos
- [ ] Jobs BullMQ processando

---

## Contatos em caso de incidente

- DPO: [definir]
- On-call: [definir]
- Render Support: support@render.com
- Supabase Support: https://supabase.com/support

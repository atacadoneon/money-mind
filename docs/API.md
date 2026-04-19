# API — MONEY MIND

> Referência rápida dos endpoints principais. Referência **autoritativa** é o Swagger em runtime.

---

## Base

- **Prod:** `https://api.moneymind.com.br`
- **Dev:** `http://localhost:3333`
- **Swagger UI:** `GET /docs`
- **OpenAPI JSON:** `GET /docs-json`
- **Health:** `GET /health` (200 se DB+Redis respondendo)

Todas as rotas (exceto `/health`, `/docs`, `/auth/*`, `/webhooks/*`) exigem:

```
Authorization: Bearer <JWT>
```

O JWT carrega `tenant_id` usado pelo middleware `TenantInterceptor` para setar `app.tenant_id` na transação.

---

## Convenções

- Versionamento: prefixo `/v1/`
- Formato: JSON (UTF-8)
- Datas: ISO 8601 (`2026-04-14T12:00:00-03:00`)
- Paginação: `?page=1&pageSize=20` → `{ data, total, page, pageSize }`
- Ordenação: `?sort=field,-other_field`
- Filtros: querystring com sintaxe simples (`?status=open&due_date_gte=2026-04-01`)
- Erros: RFC 7807 (`application/problem+json`)

---

## Módulos (visão)

| Módulo | Prefixo | Descrição |
|---|---|---|
| Auth | `/auth` | Login, refresh, logout (proxy p/ Supabase) |
| Tenants | `/v1/tenants` | Admin multi-empresa |
| Users | `/v1/users` | CRUD usuários, convites, roles |
| Accounts (plano) | `/v1/chart-of-accounts` | Plano de contas |
| Categories | `/v1/categories` | Categorias rec/desp |
| Cost Centers | `/v1/cost-centers` | Centros de custo |
| Contacts | `/v1/contacts` | Clientes e fornecedores |
| Accounts Payable | `/v1/accounts-payable` | Contas a pagar |
| Accounts Receivable | `/v1/accounts-receivable` | Contas a receber |
| Bank Accounts | `/v1/bank-accounts` | Contas bancárias |
| Bank Statements | `/v1/bank-statements` | Upload OFX/CSV, extrato |
| Reconciliation | `/v1/reconciliation` | Conciliação + sugestões |
| Reports | `/v1/reports` | DRE, fluxo de caixa, DFC |
| Integrations | `/v1/integrations` | Tiny, Conta Simples, Pagar.me |
| Webhooks | `/webhooks/:provider` | Ingest externo (HMAC) |
| LGPD | `/v1/lgpd` | Export + erasure |

---

## Exemplos

### Criar conta a pagar

```http
POST /v1/accounts-payable
Content-Type: application/json
Authorization: Bearer ...

{
  "contact_id": "c0ffee00-...",
  "description": "NF 1234 - Fornecedor X",
  "amount_cents": 125000,
  "due_date": "2026-04-30",
  "category_id": "cat-...",
  "cost_center_id": null
}
```

### Listar com filtro

```
GET /v1/accounts-payable?status=open&due_date_lte=2026-04-30&page=1&pageSize=50
```

### Upload extrato

```http
POST /v1/bank-statements/import
Content-Type: multipart/form-data

file=@extrato.ofx
bank_account_id=...
```

Resposta: `202 Accepted` + `{ job_id }` → poll em `/v1/jobs/:id`.

### Confirmar conciliação

```http
POST /v1/reconciliation/confirm
{
  "bank_transaction_id": "...",
  "matches": [{ "type": "accounts_payable", "id": "...", "amount_cents": 125000 }]
}
```

---

## Webhooks (recebimento)

```
POST /webhooks/tiny
POST /webhooks/pagarme
POST /webhooks/conta-simples
```

Headers obrigatórios:

```
X-Signature: sha256=<hmac>
X-Timestamp: <unix-ts>
X-Idempotency-Key: <uuid>
```

---

## Erros — formato

```json
{
  "type": "https://moneymind.com.br/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "amount_cents deve ser > 0",
  "instance": "/v1/accounts-payable",
  "errors": [
    { "field": "amount_cents", "message": "must be positive" }
  ]
}
```

Códigos comuns:

| Status | Significado |
|---|---|
| 400 | Request malformado |
| 401 | JWT inválido/expirado |
| 403 | Sem permissão (role) |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex.: nº documento duplicado) |
| 422 | Validação falhou |
| 429 | Rate limit |
| 500 | Erro interno |

---

## Rate limits

| Escopo | Limite |
|---|---|
| Default (autenticado) | 100 req/min |
| `/auth/*` | 10 req/min |
| `/v1/reports/*` (pesados) | 20 req/min |
| Webhooks | sem limite rígido (assinatura obrigatória) |

Header de resposta: `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Swagger em runtime

A referência completa, com schemas, exemplos e "try it out", está em:

- Dev: http://localhost:3333/docs
- Prod: https://api.moneymind.com.br/docs (acesso autenticado)

OpenAPI JSON baixável em `/docs-json` para gerar clientes:

```bash
npx openapi-typescript https://api.moneymind.com.br/docs-json -o packages/api-client/schema.ts
```

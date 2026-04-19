# Monitoring & Alerts — MONEY MIND

> Checklist de alertas e SLOs. Implementação progressiva — MVP foca em 1-5.

---

## SLOs (alvo MVP)

| Indicador | Alvo | Janela |
|---|---|---|
| Disponibilidade `/health` (API) | 99.5% | 30d |
| Latência p95 rotas GET | < 400ms | 30d |
| Latência p95 rotas POST | < 800ms | 30d |
| Taxa de erro 5xx | < 0.5% | 30d |
| Jobs BullMQ com sucesso | > 98% | 7d |
| Conciliação — falha de parse | < 2% de uploads | 7d |

---

## Alertas — ordenados por prioridade

### 1. SEV1 — API down

- **Métrica:** healthcheck `/health` falha 3x consecutivas (1min cada)
- **Fonte:** UptimeRobot / Better Stack / Grafana
- **Destino:** Slack #alerts + SMS on-call
- **Runbook:** `docs/RUNBOOK.md` §1

### 2. SEV1 — Taxa de 5xx alta

- **Métrica:** `(5xx_rate) > 2%` por 5 min
- **Fonte:** Sentry / Render metrics
- **Destino:** Slack #alerts + email
- **Runbook:** §1 + §8

### 3. SEV2 — Latência p95 alta

- **Métrica:** `http_request_duration_p95 > 1.5s` por 10 min
- **Fonte:** OpenTelemetry → Grafana Cloud (ou Sentry Performance)
- **Destino:** Slack #alerts

### 4. SEV2 — DB connections saturadas

- **Métrica:** `pool_in_use / pool_max > 0.85` por 5 min
- **Fonte:** Supabase metrics / app-level gauge
- **Destino:** Slack #alerts
- **Runbook:** §3

### 5. SEV2 — BullMQ queue depth

- **Métrica:** `waiting_jobs > 500` por 10 min em qualquer fila
- **Fonte:** custom exporter → Prometheus
- **Destino:** Slack #alerts
- **Runbook:** §6

### 6. SEV3 — Jobs falhando em loop

- **Métrica:** mesmo `job_name` falhando > 10 vezes em 1h
- **Fonte:** Sentry + BullMQ failed events
- **Destino:** Slack #alerts-low

### 7. SEV3 — Auth brute-force

- **Métrica:** > 50 falhas de login do mesmo IP em 5 min
- **Fonte:** Supabase logs / rate-limiter middleware
- **Destino:** Slack #security + opcional block automático

### 8. SEV3 — Taxa de import OFX com falha

- **Métrica:** `parse_failure_rate > 5%` em 24h
- **Fonte:** métrica custom do worker
- **Destino:** Slack #ops

### 9. SEV4 — Dependabot security advisory

- **Métrica:** GitHub security alert `severity=high+`
- **Destino:** Slack #security + auto-PR

### 10. SEV4 — Certificado / DNS perto de expirar

- **Métrica:** TLS expira em < 14 dias
- **Fonte:** Vercel/Render gerenciam — apenas double check manual mensal

---

## Métricas de negócio (dashboard)

Não são alertas, mas dashboard visível:

- Tenants ativos nos últimos 7d
- Uploads de extrato / dia
- Conciliações pendentes por tenant
- Contas a pagar vencendo hoje / semana
- MRR / churn (quando billing entrar)

---

## Stack sugerida (MVP → escala)

| Componente | MVP | Escala |
|---|---|---|
| Uptime | UptimeRobot free | Better Stack |
| Errors | Sentry free/Team | Sentry Business |
| Logs | Render/Vercel nativo | Grafana Loki ou BetterStack Logs |
| Métricas | Sentry Performance | Grafana Cloud + OTel |
| Paging | Slack + email | PagerDuty ou Opsgenie |

---

## Canais Slack sugeridos

- `#alerts` — SEV1/SEV2 com @here
- `#alerts-low` — SEV3/SEV4 sem paging
- `#security` — security advisories
- `#ops` — operacional (jobs, imports)
- `#deploys` — notifications de deploy

---

## Responder a um alerta — checklist rápido

1. Ack no canal (`:eyes:` + thread)
2. Abrir runbook da seção correspondente
3. Mitigar primeiro (rollback / bloqueio), investigar depois
4. Atualizar thread a cada 15 min
5. Ao resolver, anotar na thread: causa, fix, AI (action items)
6. Se SEV1/SEV2 → agendar post-mortem (template em `RUNBOOK.md` §11)

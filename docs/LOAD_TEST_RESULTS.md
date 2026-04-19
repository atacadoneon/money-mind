# Load Test Results — MONEY MIND BPO Financeiro

Template para documentar resultados de testes de carga em staging.

---

## Como executar

### Pré-requisitos
- k6 instalado: https://k6.io/docs/getting-started/installation/
- Staging rodando em https://api.staging.moneymind.com.br
- Token de teste: obter com `pnpm --filter api test:token`

### Scripts disponíveis (em `scripts/load/`)

```bash
# Smoke — validação básica (1 min, 10 req/s)
k6 run scripts/load/k6-smoke.js --env BASE_URL=https://api.staging.moneymind.com.br

# Load — carga normal (22 min, 100 VUs sustentados)
k6 run scripts/load/k6-load.js \
  --env BASE_URL=https://api.staging.moneymind.com.br \
  --env TOKEN=<bearer> \
  --env ORG_ID=<org-id>

# Stress — encontrar ponto de quebra (escalada até 1000 VUs)
k6 run scripts/load/k6-stress.js --env BASE_URL=... --env TOKEN=...

# Spike — teste de pico repentino (3 min, pico 500 VUs)
k6 run scripts/load/k6-spike.js --env BASE_URL=... --env TOKEN=...

# Soak — vazamento de memória (2h, 100 VUs)
k6 run scripts/load/k6-soak.js --env BASE_URL=... --env TOKEN=...
```

### Via pnpm (raiz do monorepo)
```bash
pnpm load:smoke      # alias para k6-smoke
pnpm load:full       # load + stress sequencial
```

---

## Resultados — [DATA: PREENCHER]

### Smoke Test

| Métrica | Resultado | Threshold |
|---------|-----------|-----------|
| p95 latência | XXX ms | < 200ms |
| Error rate | X.X% | < 1% |
| Requests total | XXX | — |

**Status:** PASSOU / FALHOU

---

### Load Test (100 VUs, 15 min sustentado)

| Endpoint | p50 | p95 | p99 | Erros |
|----------|-----|-----|-----|-------|
| GET /contas-pagar | — ms | — ms | — ms | X% |
| POST /reconciliation/run | — ms | — ms | — ms | X% |
| GET /relatorios/dre | — ms | — ms | — ms | X% |

| Métrica geral | Valor | Threshold |
|---------------|-------|-----------|
| p95 geral | — ms | < 1000ms |
| p99 geral | — ms | < 2000ms |
| Error rate | —% | < 5% |
| Throughput máximo | — req/s | — |

**Status:** PASSOU / FALHOU

**Observações:**
- 

---

### Stress Test — Ponto de Quebra

| VUs | Error rate | p95 latência | Observação |
|-----|-----------|-------------|------------|
| 100 | —% | — ms | Baseline |
| 300 | —% | — ms | — |
| 600 | —% | — ms | — |
| 1000 | —% | — ms | — |

**Ponto de quebra estimado:** XXX VUs
**Comportamento após quebra:** [descrever — timeout, 503, OOM?]

---

### Spike Test

| Fase | VUs | p95 | Erros |
|------|-----|-----|-------|
| Baseline (50 VUs) | 50 | — ms | —% |
| Spike (500 VUs) | 500 | — ms | —% |
| Recovery (50 VUs) | 50 | — ms | —% |

**Recovery time:** XXX segundos
**Status:** PASSOU / FALHOU

---

### Soak Test (2h, 100 VUs)

| Tempo | p95 | Error rate | Memória API |
|-------|-----|-----------|-------------|
| 0 min | — ms | —% | — MB |
| 30 min | — ms | —% | — MB |
| 60 min | — ms | —% | — MB |
| 90 min | — ms | —% | — MB |
| 120 min | — ms | —% | — MB |

**Memory leak detectado:** SIM / NÃO
**Degradação de latência:** SIM (X%) / NÃO

---

## Ações corretivas identificadas

| Problema | Endpoint | Ação | Responsável |
|---------|---------|------|-------------|
| — | — | — | — |

---

## Infraestrutura durante o teste

- **API:** Render [Starter/Standard/Pro] — X instâncias
- **DB:** Supabase [Free/Pro] — pool size X
- **Redis:** [Upstash/Render Redis] — max connections X
- **Região:** [São Paulo/us-east]

---

*Última execução: [DATA]*
*Próxima execução programada: [DATA]*

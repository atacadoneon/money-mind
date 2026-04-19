# Security Policy — MONEY MIND

## Versões suportadas

Apenas a versão `main` recebe patches de segurança durante o MVP.

## Reportando vulnerabilidades

Se você encontrou uma vulnerabilidade no MONEY MIND, **não abra uma issue pública**.

Envie um email para: **security@grupolauxen.com.br** (ou abra um Private Security Advisory no GitHub).

Inclua:

- Descrição da falha
- Passos para reproduzir
- Impacto estimado (confidencialidade / integridade / disponibilidade)
- Versão/commit afetado
- Se possível, PoC mínimo

**SLA:**

- Ack em até 48h úteis
- Triagem em até 5 dias úteis
- Fix para `critical` em até 7 dias úteis; `high` em 14 dias; `medium` em 30 dias

## Escopo

Em escopo:

- `apps/api`, `apps/web`, `packages/*`
- Scripts de deploy e migrations
- Pipelines CI/CD (secrets, injection, privilege escalation)

Fora de escopo:

- Dependências de terceiros sem exploit prático na nossa configuração
- Ataques que exijam acesso físico à máquina do usuário
- Rate limiting em endpoints públicos sem impacto financeiro direto
- Clickjacking em páginas sem ação sensível

## Recompensas

Programa formal ainda não existe. Reportes válidos recebem menção (opcional) no release notes e, a critério da empresa, recompensa monetária.

## Compromissos

- Nunca processamos segredos reais em logs
- Tokens de integração (Tiny, Conta Simples, etc.) ficam criptografados em repouso
- RLS multi-tenant obrigatório no banco
- Backups cifrados
- LGPD: subject requests via `dpo@grupolauxen.com.br`

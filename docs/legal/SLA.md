# SLA — Acordo de Nível de Serviço

**Money Mind BPO Financeiro**  
**Versão:** 1.0 | **Data:** 01/05/2025

---

## 1. Escopo

Este SLA define os compromissos de disponibilidade e performance da plataforma Money Mind BPO Financeiro para cada plano de assinatura.

---

## 2. Definições

- **Disponibilidade:** percentual de tempo em que a Plataforma está operacional e acessível por usuários autenticados
- **Indisponibilidade:** período em que a Plataforma está inacessível por falha no ambiente da Money Mind (exclui falhas do cliente, terceiros ou força maior)
- **Mês de referência:** mês calendário completo

---

## 3. Compromissos de Disponibilidade

| Plano | Disponibilidade Mensal | Tempo máximo de indisponibilidade/mês |
|-------|----------------------|--------------------------------------|
| Free | Sem SLA | — |
| Starter | **99,0%** | ~7,2 horas |
| Pro | **99,5%** | ~3,6 horas |
| Business | **99,9%** | ~43 minutos |
| Enterprise | **99,95%** | ~22 minutos |

---

## 4. Créditos por Violação de SLA

Quando a disponibilidade mensal for inferior ao comprometido:

### Starter (99,0%)
| Disponibilidade Real | Crédito |
|---------------------|---------|
| 98,0% – 98,9% | 10% da mensalidade |
| 97,0% – 97,9% | 20% da mensalidade |
| < 97,0% | 30% da mensalidade |

### Pro (99,5%)
| Disponibilidade Real | Crédito |
|---------------------|---------|
| 99,0% – 99,4% | 15% da mensalidade |
| 98,0% – 98,9% | 25% da mensalidade |
| < 98,0% | 35% da mensalidade |

### Business (99,9%)
| Disponibilidade Real | Crédito |
|---------------------|---------|
| 99,5% – 99,8% | 20% da mensalidade |
| 99,0% – 99,4% | 30% da mensalidade |
| < 99,0% | 50% da mensalidade |

### Enterprise (99,95%)
Créditos e penalidades definidos no contrato individual negociado.

---

## 5. Processo de Solicitação de Crédito

5.1. O Cliente deve solicitar crédito em até 30 dias após o mês em que ocorreu a violação, via e-mail para financeiro@moneymind.com.br.

5.2. A solicitação deve incluir: datas e horários de indisponibilidade observada, prints ou registros que comprovem o incidente.

5.3. A Money Mind analisará a solicitação em até 10 dias úteis.

5.4. Créditos aprovados serão aplicados na próxima fatura.

5.5. Créditos não são cumulativos com outros descontos ou promoções.

---

## 6. Exclusões de SLA

Não são contabilizados como indisponibilidade:

- Janelas de manutenção planejadas (comunicadas com 48 horas de antecedência, máx. 2h/mês)
- Indisponibilidades causadas por: ataques DDoS, falha em serviços de terceiros (Stripe, Supabase), falha de conectividade do lado do Cliente, força maior
- Período durante o Trial gratuito
- Degradação de funcionalidades não críticas (relatórios, analytics)

---

## 7. Tempos de Resposta de Suporte

| Severidade | Starter | Pro | Business | Enterprise |
|-----------|---------|-----|----------|------------|
| Crítico (P0) | 8h úteis | 4h úteis | 2h | 1h |
| Alto (P1) | 24h úteis | 12h úteis | 8h úteis | 4h |
| Médio (P2) | 48h úteis | 24h úteis | 24h úteis | 12h úteis |
| Baixo (P3) | 5 dias | 3 dias | 2 dias | 1 dia |

*Enterprise inclui gerente de conta dedicado e suporte via WhatsApp/Teams.*

---

## 8. Status e Incidentes

- Status em tempo real: **https://status.moneymind.com.br**
- Histórico de incidentes dos últimos 90 dias disponível na mesma página
- Subscrição de alertas de status por e-mail disponível

---

*Para questões sobre SLA: sla@moneymind.com.br*

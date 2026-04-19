# Política de Segurança — Money Mind BPO Financeiro

**Versão:** 1.0 | **Data:** 01/05/2025

---

## 1. Criptografia

### 1.1. Em Trânsito (In-Transit)
- Todo o tráfego entre clientes e servidores utiliza **TLS 1.3**
- Certificados SSL gerenciados automaticamente (Let's Encrypt / Render)
- HSTS (HTTP Strict Transport Security) ativo em produção com preload
- Todas as integrações externas utilizam HTTPS obrigatório

### 1.2. Em Repouso (At-Rest)
- Dados armazenados no Supabase (PostgreSQL) com **AES-256** at-rest
- Tokens de integração (Tiny ERP, bancos, gateways) criptografados no banco
- Senhas armazenadas exclusivamente com hash **bcrypt** (cost ≥ 12)
- Backups criptografados com chave gerenciada pelo Supabase

---

## 2. Controle de Acesso

### 2.1. Autenticação
- Autenticação gerenciada pelo **Supabase Auth** (JWT com expiração de 1 hora)
- Refresh tokens com expiração de 30 dias
- **Autenticação Multifator (MFA)** disponível via TOTP (Google Authenticator, Authy)
- Bloqueio temporário após 5 tentativas falhas consecutivas

### 2.2. Autorização — RBAC
- **Owner:** acesso total à organização
- **Admin:** gestão operacional, sem acesso a billing/exclusão
- **Accountant:** acesso financeiro com restrições
- **Viewer:** somente leitura

### 2.3. Row Level Security (RLS)
- **Todas as tabelas** do banco de dados possuem RLS ativo via Supabase
- Dados de organizações distintas são completamente segregados em nível de banco de dados
- Consultas sem contexto de organização retornam zero resultados (fail-safe)

---

## 3. Infraestrutura

### 3.1. Hospedagem
- Backend (NestJS) hospedado no **Render.com** com auto-scaling
- Banco de dados: **Supabase** (PostgreSQL gerenciado) — região: South America (quando disponível) ou US East
- Secrets gerenciados via variáveis de ambiente seguras, nunca no código

### 3.2. Backups
- Backups automáticos diários do banco de dados
- Retenção de 30 dias para planos Starter/Pro e 90 dias para Business/Enterprise
- Point-in-Time Recovery (PITR) disponível nos planos Business e Enterprise
- Testes de restauração realizados mensalmente

### 3.3. Monitoramento
- Logs de auditoria para todas as operações CRUD em dados sensíveis
- Monitoramento de erros em tempo real via **Sentry**
- Alertas de anomalias de acesso e performance

---

## 4. SLA por Plano

| Plano | Disponibilidade mensal | Crédito por violação |
|-------|----------------------|---------------------|
| Starter | 99,0% | 10% da mensalidade por hora adicional |
| Pro | 99,5% | 20% da mensalidade por hora adicional |
| Business | 99,9% | 25% da mensalidade |
| Enterprise | 99,95% | Negociável em contrato |

*Janelas de manutenção planejadas (< 2h/mês, comunicadas com 48h de antecedência) não contam como indisponibilidade.*

Ver detalhes em **SLA.md**.

---

## 5. Gestão de Incidentes

### 5.1. Classificação
- **Crítico (P0):** Exposição de dados de usuários, indisponibilidade total → resposta em 1 hora
- **Alto (P1):** Indisponibilidade parcial ou degradação severa → resposta em 4 horas
- **Médio (P2):** Funcionalidades não críticas afetadas → resposta em 24 horas
- **Baixo (P3):** Problemas cosméticos ou de performance minor → próxima sprint

### 5.2. Notificação de Incidentes de Dados
- Conforme LGPD Art. 48, incidentes com risco relevante serão reportados à **ANPD em até 72 horas**
- Usuários afetados serão notificados dentro de 5 dias úteis
- Relatório pós-incidente disponibilizado em até 30 dias

---

## 6. Vulnerability Disclosure

Encontrou uma vulnerabilidade de segurança? Reporte responsavelmente:

- **E-mail:** seguranca@moneymind.com.br
- **PGP Key:** disponível no site (em breve)
- **Prazo de resposta:** 5 dias úteis
- **Prazo de correção:** 30-90 dias dependendo da severidade

Comprometemo-nos a não tomar ações legais contra pesquisadores que agirem de boa-fé e dentro do escopo declarado.

**Fora do escopo:** ataques DDoS, engenharia social contra funcionários, acesso a contas de terceiros sem permissão.

---

## 7. Desenvolvimento Seguro

- Code review obrigatório em todas as mudanças
- Dependências auditadas automaticamente (npm audit / Snyk)
- Secrets nunca commitados no repositório (verificação automatizada)
- OWASP Top 10 considerado no desenvolvimento
- Testes de segurança incluídos no CI/CD

---

*Contato de segurança: seguranca@moneymind.com.br*  
*Status da plataforma: status.moneymind.com.br*

# Política de Privacidade — Money Mind BPO Financeiro

**Versão:** 1.0  
**Data de vigência:** 01/05/2025  
**Controlador:** [NOME JURÍDICO] — CNPJ [CNPJ]  
**DPO:** dpo@moneymind.com.br

---

## 1. Quem somos — Controlador

**[NOME JURÍDICO]**, inscrita no CNPJ [CNPJ], com sede em [ENDEREÇO], Cascavel - PR, é a Controladora dos dados pessoais tratados por meio da plataforma **Money Mind BPO Financeiro**.

Para exercer seus direitos ou tirar dúvidas sobre privacidade, contate nosso DPO: **dpo@moneymind.com.br**.

---

## 2. Dados Coletados (LGPD Art. 9, I)

### 2.1. Dados de Identificação e Conta
- Nome completo, e-mail, CPF/CNPJ (opcional)
- Senha (armazenada com hash bcrypt — jamais em texto puro)
- Foto de perfil (opcional)

### 2.2. Dados da Organização
- CNPJ, razão social, endereço da empresa
- Tokens de integração com terceiros (Tiny ERP, bancos, gateways — criptografados at-rest)

### 2.3. Dados Financeiros (inseridos pelo Cliente)
- Contas a pagar e receber, extratos bancários, notas fiscais
- Contatos/clientes, categorias financeiras
- Dados de conciliação bancária

### 2.4. Dados de Uso e Técnicos
- Endereço IP, user-agent, cookies de sessão
- Logs de auditoria (ações realizadas na plataforma)
- Dados de analytics de uso (com consentimento)

### 2.5. Dados de Billing
- Histórico de faturas (processado via Stripe — não armazenamos dados de cartão)
- Plano contratado, datas de cobrança

---

## 3. Finalidades e Base Legal (LGPD Art. 7)

| Finalidade | Base Legal (LGPD) |
|------------|-------------------|
| Prestação do serviço contratado | Execução de contrato (Art. 7, V) |
| Autenticação e segurança de acesso | Execução de contrato + Legítimo interesse (Art. 7, IX) |
| Cobrança e faturamento | Execução de contrato (Art. 7, V) |
| Cumprimento de obrigações fiscais/legais | Cumprimento de obrigação legal (Art. 7, II) |
| Envio de comunicações de produto | Legítimo interesse (Art. 7, IX) |
| Envio de marketing e promoções | Consentimento (Art. 7, I) |
| Analytics e melhoria do produto | Consentimento (Art. 7, I) |
| Processamento por IA (conciliação, sugestões) | Consentimento (Art. 7, I) |
| Prevenção a fraudes e segurança | Legítimo interesse (Art. 7, IX) |

---

## 4. Compartilhamento de Dados (LGPD Art. 9, V)

Compartilhamos dados estritamente necessários com os seguintes parceiros, todos com obrigações contratuais de proteção de dados:

| Parceiro | Finalidade | Localização |
|----------|-----------|-------------|
| **Supabase** | Banco de dados e autenticação | EUA (SCCs) |
| **Stripe** | Processamento de pagamentos | EUA (SCCs) |
| **SendGrid (Twilio)** | Envio de e-mails transacionais | EUA (SCCs) |
| **Sentry** | Monitoramento de erros | EUA (SCCs) |
| **Render.com** | Hospedagem de servidores | EUA (SCCs) |
| **Tiny ERP / Olist** | Integração ERP (quando configurado pelo Cliente) | Brasil |
| **Pagar.me / Stone** | Gateway de pagamentos (quando configurado) | Brasil |
| **Conta Simples** | Conta bancária PJ (quando configurado) | Brasil |

Não vendemos, alugamos ou comercializamos dados pessoais com terceiros para fins de marketing.

Podemos compartilhar dados quando exigido por lei, decisão judicial ou autoridade competente.

---

## 5. Retenção de Dados (LGPD Art. 9, VI)

| Categoria | Período de Retenção |
|-----------|---------------------|
| Dados de conta ativa | Enquanto a conta estiver ativa |
| Logs de auditoria | 5 anos (obrigação fiscal — Lei 9.394/96) |
| Dados financeiros (NF-e, CP/CR) | 5 anos (obrigação fiscal) |
| Dados excluídos por solicitação | 30 dias após solicitação, então anonimizados |
| Dados de billing/faturas | 5 anos (obrigação fiscal) |
| Logs de acesso/segurança | 90 dias |

Após os prazos acima, os dados são anonimizados ou eliminados de forma segura.

---

## 6. Direitos do Titular (LGPD Art. 18)

Você tem os seguintes direitos em relação aos seus dados:

- **Acesso:** solicitar confirmação da existência e acesso aos dados
- **Correção:** retificar dados inexatos ou desatualizados
- **Anonimização:** solicitar anonimização de dados desnecessários
- **Portabilidade:** receber seus dados em formato estruturado (JSON)
- **Eliminação:** solicitar exclusão de dados tratados com base no consentimento
- **Revogação do consentimento:** a qualquer momento, sem ônus
- **Oposição:** opor-se a tratamentos ilegais ou excessivos
- **Informação:** sobre com quem compartilhamos seus dados

**Como exercer:** acesse Configurações > LGPD na plataforma, ou envie e-mail para dpo@moneymind.com.br. Prazo de resposta: 15 dias úteis.

---

## 7. Transferência Internacional

Alguns de nossos parceiros (Supabase, Stripe, SendGrid) são baseados nos Estados Unidos. Essas transferências são realizadas com base nas **Cláusulas Contratuais Padrão (SCCs)** da União Europeia, adaptadas às exigências da LGPD conforme resolução da ANPD.

---

## 8. Segurança

Adotamos medidas técnicas e organizacionais adequadas para proteger dados pessoais:

- Criptografia em trânsito (TLS 1.3)
- Criptografia at-rest (AES-256 via Supabase)
- Row Level Security (RLS) em todas as tabelas
- Autenticação multifator (MFA) disponível
- Backups diários com retenção de 30 dias
- Monitoramento contínuo via Sentry e logs de auditoria

Detalhes em nossa **Política de Segurança**: https://moneymind.com.br/seguranca

---

## 9. Cookies

Utilizamos cookies essenciais (necessários para funcionamento) e cookies opcionais (analytics, marketing). Veja nossa **Política de Cookies**: https://moneymind.com.br/cookies.

Você pode gerenciar preferências de cookies a qualquer momento em Configurações > LGPD > Consentimentos.

---

## 10. Menores de Idade

A Plataforma não é destinada a menores de 18 anos. Não coletamos dados de menores intencionalmente. Se identificarmos tratamento indevido, os dados serão eliminados imediatamente.

---

## 11. Alterações nesta Política

Poderemos atualizar esta Política periodicamente. Notificaremos usuários ativos por e-mail com antecedência de 30 dias para alterações substanciais.

---

*Encarregado de Dados (DPO): dpo@moneymind.com.br*  
*Autoridade Nacional de Proteção de Dados (ANPD): www.gov.br/anpd*

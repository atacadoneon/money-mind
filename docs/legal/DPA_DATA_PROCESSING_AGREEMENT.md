# DPA — Acordo de Tratamento de Dados

**Data Processing Agreement — Money Mind BPO Financeiro**

**Versão:** 1.0 | **Data:** 01/05/2025

---

## 1. Partes

- **Controlador:** O Cliente (empresa ou pessoa física contratante da Plataforma)
- **Operador:** [NOME JURÍDICO], CNPJ [CNPJ], com sede em [ENDEREÇO], Cascavel - PR ("Money Mind")

---

## 2. Escopo do Tratamento

2.1. O presente DPA regula o tratamento de dados pessoais realizado pela Money Mind, na qualidade de **Operadora**, em nome do Cliente (**Controlador**), no âmbito da prestação dos serviços da plataforma Money Mind BPO Financeiro.

2.2. **Natureza do tratamento:** coleta, armazenamento, processamento, organização e análise de dados financeiros e cadastrais inseridos pelo Controlador na Plataforma.

2.3. **Finalidade:** operação da plataforma de gestão financeira (conciliação bancária, gestão de contas a pagar/receber, relatórios, integrações com ERPs e bancos).

2.4. **Tipos de dados pessoais:** nomes, CPF/CNPJ, e-mails, telefones, dados financeiros, dados de contatos comerciais do Controlador.

2.5. **Titulares afetados:** funcionários, clientes, fornecedores e parceiros do Controlador.

2.6. **Duração:** enquanto vigente o contrato de serviços, acrescido dos prazos de retenção legais.

---

## 3. Obrigações da Money Mind (Operadora)

A Money Mind compromete-se a:

3.1. Tratar os dados pessoais exclusivamente conforme as instruções documentadas do Controlador e as finalidades previstas no contrato de serviços.

3.2. Garantir que as pessoas autorizadas a tratar dados pessoais assumiram compromissos de confidencialidade.

3.3. Implementar medidas técnicas e organizacionais adequadas conforme descrito na Política de Segurança.

3.4. Notificar o Controlador sem demora indevida — **em até 72 (setenta e duas) horas** — após tomar conhecimento de incidente de segurança que possa afetar dados pessoais.

3.5. Apoiar o Controlador no atendimento de solicitações dos titulares de dados (direitos do Art. 18 da LGPD), conforme capacidade técnica da Plataforma.

3.6. Disponibilizar ao Controlador todas as informações necessárias para demonstração do cumprimento das obrigações previstas na LGPD.

3.7. Excluir ou devolver todos os dados pessoais ao Controlador ao término da prestação de serviços, conforme opção do Controlador, salvo obrigações legais de retenção.

---

## 4. Sub-operadores (Subcontratação)

4.1. O Controlador autoriza a Money Mind a contratar os seguintes sub-operadores:

| Sub-operador | Finalidade | País | Garantias |
|-------------|-----------|------|-----------|
| **Supabase** | Banco de dados, autenticação, storage | EUA | SCCs + Políticas de Privacidade |
| **Stripe** | Processamento de pagamentos de assinatura | EUA | SCCs + Stripe DPA |
| **SendGrid (Twilio)** | E-mails transacionais | EUA | SCCs |
| **Sentry** | Monitoramento de erros (dados anonimizados) | EUA | SCCs |
| **Render.com** | Hospedagem de servidores de API | EUA | SCCs |
| **Redis Cloud** | Cache de sessão | EUA | SCCs |

4.2. A Money Mind notificará o Controlador sobre qualquer alteração no rol de sub-operadores com antecedência mínima de 30 dias, dando ao Controlador a oportunidade de se opor.

4.3. A Money Mind responde perante o Controlador pelos atos dos sub-operadores nos mesmos termos de suas próprias obrigações.

---

## 5. Medidas de Segurança

A Money Mind mantém as seguintes medidas técnicas e organizacionais:

- **Criptografia em trânsito:** TLS 1.3 em todas as comunicações
- **Criptografia at-rest:** AES-256 (Supabase) para todos os dados armazenados
- **Controle de acesso:** Row Level Security (RLS) + RBAC (papéis owner/admin/accountant/viewer)
- **Autenticação:** Suporte a MFA; senhas com hash bcrypt
- **Backups:** Diários automáticos, retenção 30 dias, testes mensais de restauração
- **Monitoramento:** Logs de auditoria para todas as operações de leitura/escrita de dados sensíveis
- **Gestão de vulnerabilidades:** Processo de vulnerability disclosure (ver Política de Segurança)
- **Segregação:** Dados de organizações distintas são logicamente segregados por RLS

---

## 6. Auditoria

6.1. A Money Mind disponibilizará, a pedido do Controlador, evidências de conformidade com as práticas de segurança descritas neste DPA.

6.2. Em caso de auditorias formais, o Controlador deverá comunicar com antecedência mínima de 30 dias e arcar com os custos associados.

6.3. A Money Mind poderá substituir auditorias presenciais por relatórios de auditoria de terceiros certificados (SOC 2, ISO 27001 — quando disponíveis).

---

## 7. Notificação de Incidentes

7.1. Incidente de segurança relevante: qualquer violação que resulte em acesso não autorizado, destruição, perda, alteração ou divulgação de dados pessoais.

7.2. Prazo de notificação ao Controlador: **72 horas** após a identificação.

7.3. A notificação conterá: natureza do incidente, dados e titulares afetados, medidas tomadas e recomendadas.

7.4. O Controlador é responsável por notificar a ANPD e os titulares, conforme obrigação legal.

---

## 8. Devolução e Destruição de Dados

8.1. Ao término do contrato, a Money Mind:

- Disponibilizará ao Controlador a exportação de todos os dados por 30 dias;
- Após esse prazo, procederá à eliminação segura ou anonimização dos dados;
- Certificará a eliminação mediante solicitação escrita.

8.2. Dados sujeitos a obrigações legais de retenção (fiscais, trabalhistas) serão mantidos pelo prazo mínimo exigido por lei, mesmo após o término do contrato.

---

## 9. Disposições Finais

9.1. Este DPA integra e complementa o Contrato de Prestação de Serviços e os Termos de Uso.

9.2. Em caso de conflito, este DPA prevalece sobre o Contrato de Serviços no que se refere ao tratamento de dados pessoais.

9.3. Foro: Cascavel - PR, Brasil.

---

*Para exercer direitos como controlador ou formalizar este DPA por contrato assinado, contate: dpo@moneymind.com.br*

import { baseLayout } from './base';

export interface PaymentFailedParams {
  nome: string;
  orgName: string;
  amount: string;
  portalUrl: string;
  nextAttempt?: string;
}

export const paymentFailedTemplate = {
  subject: () => 'Falha no pagamento — ação necessária — Money Mind BPO',
  html: (p: PaymentFailedParams) =>
    baseLayout(
      `<h1>Falha no pagamento</h1>
      <div class="highlight">
        <p><span class="badge badge-danger">FALHOU</span></p>
        <p style="margin-top:8px;"><strong>Valor:</strong> R$ ${p.amount}</p>
        ${p.nextAttempt ? `<p><strong>Próxima tentativa:</strong> ${p.nextAttempt}</p>` : ''}
      </div>
      <p>Olá, <strong>${p.nome}</strong>. Não conseguimos processar o pagamento de <strong>R$ ${p.amount}</strong> para a assinatura de <strong>${p.orgName}</strong>.</p>
      <p>Para evitar a suspensão do serviço, atualize seus dados de pagamento:</p>
      <a href="${p.portalUrl}" class="btn">Atualizar forma de pagamento</a>
      <hr class="divider" />
      <p style="font-size:13px;color:#64748b;">Se precisar de ajuda, entre em contato com <a href="mailto:financeiro@moneymind.com.br">financeiro@moneymind.com.br</a></p>`,
      'Seu pagamento falhou. Ação necessária.',
    ),
  text: (p: PaymentFailedParams) =>
    `Falha no pagamento!\n\nOlá ${p.nome}, não conseguimos cobrar R$${p.amount} de ${p.orgName}.\n\nAtualize: ${p.portalUrl}`,
};

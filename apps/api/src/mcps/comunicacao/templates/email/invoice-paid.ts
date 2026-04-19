import { baseLayout } from './base';

export interface InvoicePaidParams {
  nome: string;
  orgName: string;
  amount: string;
  plan: string;
  paidAt: string;
  pdfUrl?: string;
  portalUrl?: string;
}

export const invoicePaidTemplate = {
  subject: (p: InvoicePaidParams) => `Pagamento confirmado — R$ ${p.amount} — Money Mind BPO`,
  html: (p: InvoicePaidParams) =>
    baseLayout(
      `<h1>Pagamento confirmado ✓</h1>
      <div class="highlight">
        <p><span class="badge badge-success">PAGO</span></p>
        <p style="margin-top:8px;"><strong>Plano:</strong> ${p.plan}</p>
        <p><strong>Valor:</strong> R$ ${p.amount}</p>
        <p><strong>Data:</strong> ${p.paidAt}</p>
      </div>
      <p>Olá, <strong>${p.nome}</strong>. Confirmamos o recebimento do pagamento referente à assinatura de <strong>${p.orgName}</strong>.</p>
      ${p.pdfUrl ? `<a href="${p.pdfUrl}" class="btn btn-secondary">Baixar nota fiscal</a>` : ''}
      ${p.portalUrl ? `<p style="font-size:13px;color:#64748b;margin-top:8px;"><a href="${p.portalUrl}">Gerenciar assinatura</a></p>` : ''}`,
      `Pagamento de R$${p.amount} confirmado.`,
    ),
  text: (p: InvoicePaidParams) =>
    `Pagamento confirmado!\n\nOlá ${p.nome}, recebemos seu pagamento de R$${p.amount} referente ao plano ${p.plan} de ${p.orgName}.\n\nData: ${p.paidAt}`,
};

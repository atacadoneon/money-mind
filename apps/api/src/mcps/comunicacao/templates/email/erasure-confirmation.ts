import { baseLayout } from './base';

export interface ErasureConfirmationParams {
  nome: string;
  processAt: string;
  revertUrl?: string;
}

export const erasureConfirmationTemplate = {
  subject: () => 'Solicitação de exclusão de dados registrada — LGPD — Money Mind BPO',
  html: (p: ErasureConfirmationParams) =>
    baseLayout(
      `<h1>Solicitação de exclusão registrada</h1>
      <p>Olá, <strong>${p.nome}</strong>. Recebemos sua solicitação de exclusão de dados conforme a LGPD.</p>
      <div class="highlight">
        <p><strong>Processamento programado para:</strong> ${p.processAt}</p>
        <p style="margin-top:8px;font-size:13px;color:#64748b;">Você tem 30 dias para reverter esta decisão antes dos dados serem apagados permanentemente.</p>
      </div>
      ${p.revertUrl ? `<a href="${p.revertUrl}" class="btn btn-secondary">Cancelar exclusão</a>` : ''}
      <hr class="divider" />
      <p style="font-size:13px;color:#64748b;">Protocolo registrado conforme LGPD Art. 18. DPO: <a href="mailto:dpo@moneymind.com.br">dpo@moneymind.com.br</a></p>`,
      'Solicitação de exclusão de dados registrada.',
    ),
  text: (p: ErasureConfirmationParams) =>
    `Solicitação de exclusão registrada.\n\nOlá ${p.nome}, seus dados serão apagados em ${p.processAt}.\n${p.revertUrl ? `\nPara cancelar: ${p.revertUrl}` : ''}`,
};

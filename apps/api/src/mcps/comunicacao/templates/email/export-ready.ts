import { baseLayout } from './base';

export interface ExportReadyParams {
  nome: string;
  downloadUrl: string;
  expiresAt: string;
}

export const exportReadyTemplate = {
  subject: () => 'Seus dados estão prontos para download — LGPD — Money Mind BPO',
  html: (p: ExportReadyParams) =>
    baseLayout(
      `<h1>Exportação LGPD pronta</h1>
      <p>Olá, <strong>${p.nome}</strong>. Sua solicitação de exportação de dados foi processada.</p>
      <p>Clique no botão abaixo para baixar o arquivo com todos os seus dados.</p>
      <a href="${p.downloadUrl}" class="btn">Baixar meus dados</a>
      <p style="font-size:13px;color:#94a3b8;">Este link expira em <strong>${p.expiresAt}</strong>.<br/>Após este período, faça uma nova solicitação.</p>
      <hr class="divider" />
      <p style="font-size:13px;color:#64748b;">Esta exportação foi solicitada em conformidade com a Lei Geral de Proteção de Dados (LGPD, Art. 18). Dúvidas? <a href="mailto:dpo@moneymind.com.br">dpo@moneymind.com.br</a></p>`,
      'Seus dados LGPD estão prontos para download.',
    ),
  text: (p: ExportReadyParams) =>
    `Exportação LGPD pronta!\n\nOlá ${p.nome}, baixe seus dados em: ${p.downloadUrl}\n\nLink expira em: ${p.expiresAt}`,
};

import { baseLayout } from './base';

export interface TrialExpiredParams {
  nome: string;
  orgName: string;
  upgradeUrl: string;
}

export const trialExpiredTemplate = {
  subject: () => 'Seu trial expirou — reative sua conta no Money Mind BPO',
  html: (p: TrialExpiredParams) =>
    baseLayout(
      `<h1>Seu período gratuito expirou</h1>
      <p>Olá, <strong>${p.nome}</strong>. O trial de <strong>${p.orgName}</strong> chegou ao fim.</p>
      <p>Seus dados estão seguros e você pode reativar sua conta a qualquer momento escolhendo um plano.</p>
      <a href="${p.upgradeUrl}" class="btn">Reativar conta</a>
      <hr class="divider" />
      <div class="highlight">
        <p><strong>O que você perde sem um plano:</strong></p>
        <p>✗ Conciliação automática de extratos<br/>✗ Multi-empresa<br/>✗ Relatórios financeiros<br/>✗ Integração Tiny ERP</p>
      </div>
      <p style="font-size:13px;color:#64748b;">Seus dados ficam disponíveis por 30 dias após o trial.</p>`,
      'Seu trial expirou. Reative sua conta no Money Mind BPO.',
    ),
  text: (p: TrialExpiredParams) =>
    `Seu trial expirou!\n\nOlá ${p.nome}, reative sua conta em: ${p.upgradeUrl}`,
};

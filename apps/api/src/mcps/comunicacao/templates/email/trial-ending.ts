import { baseLayout } from './base';

export interface TrialEndingParams {
  nome: string;
  orgName: string;
  daysLeft: number;
  upgradeUrl: string;
}

export const trialEndingTemplate = {
  subject: (p: TrialEndingParams) => `Seu trial expira em ${p.daysLeft} dia${p.daysLeft !== 1 ? 's' : ''} — Money Mind BPO`,
  html: (p: TrialEndingParams) =>
    baseLayout(
      `<h1>Seu trial está quase no fim</h1>
      <div class="highlight">
        <p><span class="badge badge-warning">Trial — ${p.daysLeft} dia${p.daysLeft !== 1 ? 's' : ''} restante${p.daysLeft !== 1 ? 's' : ''}</span></p>
      </div>
      <p>Olá, <strong>${p.nome}</strong>. O período gratuito de <strong>${p.orgName}</strong> expira em <strong>${p.daysLeft} dia${p.daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>Para continuar usando o Money Mind BPO sem interrupções, escolha um plano agora.</p>
      <a href="${p.upgradeUrl}" class="btn">Escolher meu plano</a>
      <hr class="divider" />
      <p style="font-size:13px;color:#64748b;">Nosso plano Starter começa a partir de <strong>R$ 49/mês</strong> e inclui conciliação automática, multi-empresa e integração com Tiny ERP.</p>`,
      `Seu trial expira em ${p.daysLeft} dias. Escolha um plano para continuar.`,
    ),
  text: (p: TrialEndingParams) =>
    `Seu trial expira em ${p.daysLeft} dias!\n\nOlá ${p.nome}, escolha um plano em: ${p.upgradeUrl}\n\nPlanos a partir de R$49/mês.`,
};

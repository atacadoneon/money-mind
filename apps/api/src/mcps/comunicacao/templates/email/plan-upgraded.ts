import { baseLayout } from './base';

export interface PlanUpgradedParams {
  nome: string;
  orgName: string;
  oldPlan: string;
  newPlan: string;
  features: string[];
}

export const planUpgradedTemplate = {
  subject: (p: PlanUpgradedParams) => `Bem-vindo ao plano ${p.newPlan}! — Money Mind BPO`,
  html: (p: PlanUpgradedParams) =>
    baseLayout(
      `<h1>Upgrade realizado com sucesso!</h1>
      <p>Olá, <strong>${p.nome}</strong>. A organização <strong>${p.orgName}</strong> agora está no plano <strong>${p.newPlan}</strong>.</p>
      <div class="highlight">
        <p><strong>${p.oldPlan}</strong> → <strong>${p.newPlan}</strong> <span class="badge badge-success">Ativo</span></p>
      </div>
      ${p.features.length > 0 ? `<p><strong>Novas funcionalidades disponíveis:</strong></p><ul style="padding-left:20px;margin:8px 0 16px;">${p.features.map((f) => `<li style="color:#475569;font-size:14px;margin-bottom:6px;">${f}</li>`).join('')}</ul>` : ''}
      <a href="https://app.moneymind.com.br" class="btn">Explorar meu plano</a>`,
      `Seu plano foi atualizado para ${p.newPlan}.`,
    ),
  text: (p: PlanUpgradedParams) =>
    `Upgrade realizado!\n\nOlá ${p.nome}, ${p.orgName} agora está no plano ${p.newPlan}.\n\nAcesse: https://app.moneymind.com.br`,
};

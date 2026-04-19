import { baseLayout } from './base';

export interface EmailVerificationParams {
  nome: string;
  verificationUrl: string;
  expiresInHours?: number;
}

export const emailVerificationTemplate = {
  subject: () => 'Confirme seu e-mail — Money Mind BPO',
  html: (p: EmailVerificationParams) =>
    baseLayout(
      `<h1>Confirme seu e-mail</h1>
      <p>Olá, <strong>${p.nome}</strong>. Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta.</p>
      <a href="${p.verificationUrl}" class="btn">Confirmar e-mail</a>
      <p style="font-size:13px;color:#94a3b8;">Este link expira em ${p.expiresInHours ?? 24} horas.<br/>Se você não criou uma conta, ignore este e-mail.</p>
      <hr class="divider" />
      <p style="font-size:13px;color:#94a3b8;">Se o botão não funcionar, copie e cole este link no seu navegador:<br/><a href="${p.verificationUrl}">${p.verificationUrl}</a></p>`,
      'Confirme seu e-mail para ativar sua conta.',
    ),
  text: (p: EmailVerificationParams) =>
    `Confirme seu e-mail\n\nOlá ${p.nome},\nClique no link para confirmar: ${p.verificationUrl}\n\nExpira em ${p.expiresInHours ?? 24}h.`,
};

import { baseLayout } from './base';

export interface PasswordResetParams {
  nome: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export const passwordResetTemplate = {
  subject: () => 'Redefinição de senha — Money Mind BPO',
  html: (p: PasswordResetParams) =>
    baseLayout(
      `<h1>Redefinir senha</h1>
      <p>Olá, <strong>${p.nome}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <a href="${p.resetUrl}" class="btn">Redefinir senha</a>
      <p style="font-size:13px;color:#94a3b8;">Este link expira em ${p.expiresInMinutes ?? 60} minutos.<br/>Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.</p>`,
      'Redefina sua senha do Money Mind BPO.',
    ),
  text: (p: PasswordResetParams) =>
    `Redefinir senha\n\nOlá ${p.nome},\nClique no link: ${p.resetUrl}\n\nExpira em ${p.expiresInMinutes ?? 60} minutos.`,
};

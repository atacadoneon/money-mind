import { baseLayout } from './base';

export interface InviteTeamMemberParams {
  inviteeName: string;
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
  expiresAt?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  accountant: 'Contador',
  viewer: 'Visualizador',
};

export const inviteTeamMemberTemplate = {
  subject: (p: InviteTeamMemberParams) => `${p.inviterName} convidou você para ${p.orgName} — Money Mind BPO`,
  html: (p: InviteTeamMemberParams) =>
    baseLayout(
      `<h1>Você foi convidado!</h1>
      <p><strong>${p.inviterName}</strong> convidou você para acessar a organização <strong>${p.orgName}</strong> no Money Mind BPO como <strong>${roleLabels[p.role] ?? p.role}</strong>.</p>
      <a href="${p.acceptUrl}" class="btn">Aceitar convite</a>
      ${p.expiresAt ? `<p style="font-size:13px;color:#94a3b8;">Este convite expira em ${p.expiresAt}.</p>` : ''}
      <hr class="divider" />
      <p style="font-size:13px;color:#64748b;">Se você não esperava este convite, simplesmente ignore este e-mail.</p>`,
      `Você foi convidado para ${p.orgName} no Money Mind BPO.`,
    ),
  text: (p: InviteTeamMemberParams) =>
    `Você foi convidado!\n\n${p.inviterName} convidou você para ${p.orgName} como ${p.role}.\n\nAceitar: ${p.acceptUrl}`,
};

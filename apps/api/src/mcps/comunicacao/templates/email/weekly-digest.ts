import { baseLayout } from './base';

export interface WeeklyDigestParams {
  nome: string;
  orgName: string;
  semana: string;
  recebidoSemana: string;
  pagouSemana: string;
  saldoAtual: string;
  vencendoProxSemana: number;
  viewUrl: string;
}

export const weeklyDigestTemplate = {
  subject: (p: WeeklyDigestParams) => `Resumo financeiro semanal — ${p.orgName} — ${p.semana}`,
  html: (p: WeeklyDigestParams) =>
    baseLayout(
      `<h1>Resumo semanal — ${p.semana}</h1>
      <p>Olá, <strong>${p.nome}</strong>. Aqui está o resumo financeiro de <strong>${p.orgName}</strong>.</p>
      <div class="highlight">
        <p><strong>Recebido na semana:</strong> R$ ${p.recebidoSemana}</p>
        <p><strong>Pago na semana:</strong> R$ ${p.pagouSemana}</p>
        <p><strong>Saldo atual:</strong> R$ ${p.saldoAtual}</p>
        ${p.vencendoProxSemana > 0 ? `<p><strong>Vencendo na próxima semana:</strong> ${p.vencendoProxSemana} título${p.vencendoProxSemana !== 1 ? 's' : ''} <span class="badge badge-warning">Atenção</span></p>` : ''}
      </div>
      <a href="${p.viewUrl}" class="btn">Ver dashboard completo</a>`,
      `Resumo financeiro de ${p.orgName}: R$${p.saldoAtual} de saldo.`,
    ),
  text: (p: WeeklyDigestParams) =>
    `Resumo semanal — ${p.orgName} — ${p.semana}\n\nRecebido: R$${p.recebidoSemana}\nPago: R$${p.pagouSemana}\nSaldo: R$${p.saldoAtual}\n\nVer mais: ${p.viewUrl}`,
};

import { baseLayout } from './base';

export interface ReconciliationCompleteParams {
  nome: string;
  orgName: string;
  empresa: string;
  periodo: string;
  totalTransacoes: number;
  conciliadasAuto: number;
  pendentes: number;
  viewUrl: string;
}

export const reconciliationCompleteTemplate = {
  subject: (p: ReconciliationCompleteParams) => `Conciliação concluída — ${p.empresa} — ${p.periodo}`,
  html: (p: ReconciliationCompleteParams) =>
    baseLayout(
      `<h1>Conciliação concluída</h1>
      <p>Olá, <strong>${p.nome}</strong>. A conciliação de <strong>${p.empresa}</strong> para o período <strong>${p.periodo}</strong> foi concluída.</p>
      <div class="highlight">
        <p><strong>Total de transações:</strong> ${p.totalTransacoes}</p>
        <p><strong>Conciliadas automaticamente:</strong> ${p.conciliadasAuto} <span class="badge badge-success">✓</span></p>
        <p><strong>Pendentes de revisão:</strong> ${p.pendentes} ${p.pendentes > 0 ? '<span class="badge badge-warning">Atenção</span>' : ''}</p>
      </div>
      <a href="${p.viewUrl}" class="btn">Ver resultados</a>`,
      `Conciliação de ${p.empresa} concluída. ${p.pendentes} pendentes.`,
    ),
  text: (p: ReconciliationCompleteParams) =>
    `Conciliação concluída!\n\n${p.empresa} — ${p.periodo}\nTotal: ${p.totalTransacoes} | Auto: ${p.conciliadasAuto} | Pendentes: ${p.pendentes}\n\nVer: ${p.viewUrl}`,
};

import { CobrancaTemplateParams } from './cobranca-lembrete';

export const cobrancaVencimento = {
  id: 'cobranca_vencimento_hoje',
  whatsappTemplateId: 'cobranca_vencimento_hoje',
  subject: (p: CobrancaTemplateParams) => `Vencimento hoje — R$ ${p.valor} — ${p.empresa ?? 'Money Mind BPO'}`,
  html: (p: CobrancaTemplateParams) => `
    <p>Olá, <strong>${p.clienteNome}</strong>,</p>
    <p>Seu boleto de <strong>R$ ${p.valor}</strong> vence <strong>hoje (${p.vencimento})</strong>.</p>
    <p>Evite juros e multa pagando agora!</p>
    ${p.linkBoleto ? `<p><a href="${p.linkBoleto}">Pagar agora</a></p>` : ''}
  `,
  text: (p: CobrancaTemplateParams) =>
    `${p.clienteNome}, seu boleto de R$ ${p.valor} vence HOJE (${p.vencimento}). ${p.linkBoleto ?? ''}`,
  whatsappParams: (p: CobrancaTemplateParams) => [p.clienteNome, p.valor, p.vencimento, p.linkBoleto ?? ''],
};

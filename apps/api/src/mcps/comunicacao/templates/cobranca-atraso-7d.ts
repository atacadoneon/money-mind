import { CobrancaTemplateParams } from './cobranca-lembrete';

export const cobrancaAtraso7d = {
  id: 'cobranca_atraso_7d',
  whatsappTemplateId: 'cobranca_atraso_7d',
  subject: (p: CobrancaTemplateParams) => `Boleto em atraso há 7 dias — R$ ${p.valor}`,
  html: (p: CobrancaTemplateParams) => `
    <p>Olá, <strong>${p.clienteNome}</strong>,</p>
    <p>Seu boleto de <strong>R$ ${p.valor}</strong> (vencido em ${p.vencimento}) está em atraso há 7 dias.</p>
    <p>Entre em contato para negociar ou regularize agora.</p>
    ${p.linkBoleto ? `<p><a href="${p.linkBoleto}">Segunda via / Pagar agora</a></p>` : ''}
  `,
  text: (p: CobrancaTemplateParams) =>
    `${p.clienteNome}, boleto R$ ${p.valor} (venc. ${p.vencimento}) 7 dias em atraso. Entre em contato. ${p.linkBoleto ?? ''}`,
  whatsappParams: (p: CobrancaTemplateParams) => [p.clienteNome, p.valor, p.vencimento, '7', p.linkBoleto ?? ''],
};

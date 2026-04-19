import { CobrancaTemplateParams } from './cobranca-lembrete';

export const cobrancaAtraso3d = {
  id: 'cobranca_atraso_3d',
  whatsappTemplateId: 'cobranca_atraso_3d',
  subject: (p: CobrancaTemplateParams) => `Boleto em atraso há 3 dias — R$ ${p.valor}`,
  html: (p: CobrancaTemplateParams) => `
    <p>Olá, <strong>${p.clienteNome}</strong>,</p>
    <p>Seu boleto de <strong>R$ ${p.valor}</strong> (vencido em ${p.vencimento}) está em atraso há 3 dias.</p>
    <p>Regularize agora para evitar encargos adicionais.</p>
    ${p.linkBoleto ? `<p><a href="${p.linkBoleto}">Pagar agora</a></p>` : ''}
  `,
  text: (p: CobrancaTemplateParams) =>
    `${p.clienteNome}, seu boleto de R$ ${p.valor} (venc. ${p.vencimento}) está 3 dias em atraso. ${p.linkBoleto ?? ''}`,
  whatsappParams: (p: CobrancaTemplateParams) => [p.clienteNome, p.valor, p.vencimento, '3', p.linkBoleto ?? ''],
};

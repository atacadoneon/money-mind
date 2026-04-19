import { CobrancaTemplateParams } from './cobranca-lembrete';

export const cobrancaAtraso15d = {
  id: 'cobranca_atraso_15d',
  whatsappTemplateId: 'cobranca_atraso_15d',
  subject: (p: CobrancaTemplateParams) => `URGENTE: Boleto em atraso há 15 dias — R$ ${p.valor}`,
  html: (p: CobrancaTemplateParams) => `
    <p>Olá, <strong>${p.clienteNome}</strong>,</p>
    <p><strong>Atenção:</strong> Seu boleto de <strong>R$ ${p.valor}</strong> (vencido em ${p.vencimento}) está em atraso há 15 dias.</p>
    <p>Para evitar medidas adicionais de cobrança, regularize imediatamente ou entre em contato conosco.</p>
    ${p.linkBoleto ? `<p><a href="${p.linkBoleto}">Clique aqui para pagar</a></p>` : ''}
  `,
  text: (p: CobrancaTemplateParams) =>
    `URGENTE: ${p.clienteNome}, seu boleto de R$ ${p.valor} (venc. ${p.vencimento}) está 15 dias em atraso. Regularize urgente. ${p.linkBoleto ?? ''}`,
  whatsappParams: (p: CobrancaTemplateParams) => [p.clienteNome, p.valor, p.vencimento, '15', p.linkBoleto ?? ''],
};

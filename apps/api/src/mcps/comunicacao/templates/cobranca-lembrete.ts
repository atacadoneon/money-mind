export interface CobrancaTemplateParams {
  clienteNome: string;
  valor: string;
  vencimento: string;
  linkBoleto?: string;
  empresa?: string;
}

export const cobrancaLembrete = {
  id: 'cobranca_lembrete_5d',
  whatsappTemplateId: 'cobranca_lembrete_vencimento',
  subject: (p: CobrancaTemplateParams) => `Lembrete: vencimento em 5 dias — ${p.empresa ?? 'Money Mind BPO'}`,
  html: (p: CobrancaTemplateParams) => `
    <p>Olá, <strong>${p.clienteNome}</strong>,</p>
    <p>Lembramos que você possui um boleto no valor de <strong>R$ ${p.valor}</strong> com vencimento em <strong>${p.vencimento}</strong>.</p>
    ${p.linkBoleto ? `<p><a href="${p.linkBoleto}">Clique aqui para pagar</a></p>` : ''}
    <p>Em caso de dúvidas, entre em contato conosco.</p>
  `,
  text: (p: CobrancaTemplateParams) =>
    `Olá ${p.clienteNome}, seu boleto de R$ ${p.valor} vence em ${p.vencimento}. ${p.linkBoleto ? `Pague em: ${p.linkBoleto}` : ''}`,
  whatsappParams: (p: CobrancaTemplateParams) => [p.clienteNome, p.valor, p.vencimento, p.linkBoleto ?? ''],
};

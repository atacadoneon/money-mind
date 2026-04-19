import { baseLayout } from './base';

export interface WelcomeParams {
  nome: string;
  orgName: string;
  loginUrl?: string;
}

export const welcomeTemplate = {
  subject: (p: WelcomeParams) => `Bem-vindo ao Money Mind BPO, ${p.nome}!`,
  html: (p: WelcomeParams) =>
    baseLayout(
      `<h1>Bem-vindo, ${p.nome}! 🎉</h1>
      <p>Sua conta no <strong>Money Mind BPO</strong> foi criada com sucesso para a organização <strong>${p.orgName}</strong>.</p>
      <p>Você tem <strong>14 dias grátis</strong> para explorar todas as funcionalidades do plano Starter. Sem necessidade de cartão de crédito.</p>
      <div class="highlight">
        <p><strong>Próximos passos sugeridos:</strong></p>
        <p>1. Configure sua primeira empresa<br/>
        2. Conecte sua conta bancária ou importe um extrato OFX<br/>
        3. Explore a conciliação automática com IA</p>
      </div>
      <a href="${p.loginUrl ?? 'https://app.moneymind.com.br'}" class="btn">Acessar minha conta</a>
      <hr class="divider" />
      <p>Dúvidas? Fale conosco em <a href="mailto:suporte@moneymind.com.br">suporte@moneymind.com.br</a> ou acesse nossa <a href="https://app.moneymind.com.br/help">Central de Ajuda</a>.</p>`,
      `Bem-vindo ao Money Mind BPO, ${p.nome}! Sua conta está pronta.`,
    ),
  text: (p: WelcomeParams) =>
    `Bem-vindo, ${p.nome}!\n\nSua conta no Money Mind BPO foi criada com sucesso para ${p.orgName}.\n\nAcesse: ${p.loginUrl ?? 'https://app.moneymind.com.br'}\n\nDúvidas? suporte@moneymind.com.br`,
};

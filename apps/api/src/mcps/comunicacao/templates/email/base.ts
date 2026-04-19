/**
 * Base HTML email layout for Money Mind BPO transactional emails.
 * Self-contained HTML compatible with all major email clients.
 */
export function baseLayout(content: string, previewText = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Money Mind BPO</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 32px; text-align: center; }
    .header-logo { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header-logo span { color: #6366f1; }
    .body { padding: 32px; }
    .body h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .body p { font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 16px; }
    .body strong { color: #0f172a; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 8px 0 16px; }
    .btn-secondary { background: #f1f5f9; color: #475569 !important; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .highlight { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .highlight p { margin: 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warning { background: #fef9c3; color: #854d0e; }
    .badge-danger { background: #fee2e2; color: #b91c1c; }
    .footer { text-align: center; padding: 24px 16px 8px; }
    .footer p { font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .footer a { color: #6366f1; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .body { padding: 24px 16px; }
      .btn { display: block; text-align: center; }
    }
  </style>
</head>
<body>
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">Money<span>Mind</span> BPO</div>
      </div>
      <div class="body">
        ${content}
      </div>
    </div>
    <div class="footer">
      <p>Money Mind BPO Financeiro &bull; <a href="https://moneymind.com.br">moneymind.com.br</a></p>
      <p>Você recebeu este e-mail porque tem uma conta no Money Mind BPO.</p>
      <p><a href="https://app.moneymind.com.br/configuracoes/lgpd">Gerenciar notificações</a> &bull; <a href="https://moneymind.com.br/privacidade">Privacidade</a></p>
    </div>
  </div>
</body>
</html>`;
}

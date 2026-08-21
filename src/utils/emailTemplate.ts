/**
 * Utilitário de E-mails Corporativos - Risel ERP
 * Gera templates HTML modernos, responsivos e elegantes no padrão visual da Risel Combustíveis.
 */

export interface ResetPasswordEmailData {
  userName: string;
  userEmail: string;
  resetToken: string;
  resetLink: string;
  expiresInHours: number;
  requestIp?: string;
  requestDateFormatted?: string;
}

export function generateResetPasswordHtml(data: ResetPasswordEmailData): string {
  const { userName, userEmail, resetLink, expiresInHours, requestDateFormatted, requestIp } = data;
  const dataFormatada = requestDateFormatted || new Date().toLocaleString('pt-BR');
  const ip = requestIp || '189.40.122.84 (Rede Corporativa / Paulínia - SP)';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - Risel ERP</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1410;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1410;
      padding: 30px 15px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .header {
      background: linear-gradient(135deg, #092c20 0%, #114D38 100%);
      padding: 36px 30px 28px 30px;
      text-align: center;
      position: relative;
    }
    .logo-container {
      display: inline-block;
      background: #ffffff;
      padding: 6px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      margin-bottom: 14px;
    }
    .logo-img {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: block;
      object-fit: cover;
    }
    .header-title {
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
    }
    .header-subtitle {
      color: #6ee7b7;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin: 0;
    }
    .content {
      padding: 36px 32px 28px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      line-height: 1.65;
      color: #475569;
      margin-bottom: 24px;
    }
    .info-card {
      background-color: #f8fafc;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 12.5px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 28px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 800;
      padding: 16px 36px;
      border-radius: 14px;
      box-shadow: 0 12px 24px -6px rgba(16, 185, 129, 0.4);
      letter-spacing: 0.5px;
    }
    .cta-button:hover {
      background: linear-gradient(135deg, #047857 0%, #059669 100%);
    }
    .alt-link-card {
      background-color: #f1f5f9;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 11px;
      color: #64748b;
      word-break: break-all;
    }
    .alt-link-card strong {
      color: #334155;
      display: block;
      margin-bottom: 4px;
    }
    .security-notice {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 10px 10px 0;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.5;
      color: #92400e;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 30px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer strong {
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- HEADER -->
      <div class="header">
        <div class="logo-container">
          <img 
            src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" 
            alt="Risel Combustíveis" 
            class="logo-img"
          />
        </div>
        <h1 class="header-title">Risel Combustíveis</h1>
        <p class="header-subtitle">Segurança & Gestão de Acessos ERP</p>
      </div>

      <!-- CORPO PRINCIPAL -->
      <div class="content">
        <h2 class="greeting">Olá, ${userName || 'Colaborador(a)'}!</h2>
        <p class="lead-text">
          Recebemos uma solicitação para redefinição da sua senha de acesso ao <strong>Sistema Risel ERP</strong> (módulos de <em>Lançamento de Documentos</em> e <em>Controle de Frota Leve</em>).
        </p>

        <!-- CARD DE DETALHES -->
        <div class="info-card">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600;">Conta / E-mail:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 12px; font-weight: 700; text-align: right;">${userEmail}</td>
            </tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600;">Data do Pedido:</td>
              <td style="padding: 6px 0; color: #0f172a; font-size: 12px; font-weight: 700; text-align: right;">${dataFormatada}</td>
            </tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 6px 0; color: #64748b; font-size: 12px; font-weight: 600;">Validade do Link:</td>
              <td style="padding: 6px 0; color: #059669; font-size: 12px; font-weight: 700; text-align: right;">${expiresInHours} horas</td>
            </tr>
            <tr>
              <td style="padding: 6px 0 0 0; color: #64748b; font-size: 12px; font-weight: 600;">Origem da Solicitação:</td>
              <td style="padding: 6px 0 0 0; color: #0f172a; font-size: 12px; font-weight: 700; text-align: right;">${ip}</td>
            </tr>
          </table>
        </div>

        <!-- BOTÃO DE AÇÃO -->
        <div class="cta-container">
          <a href="${resetLink}" class="cta-button" target="_blank">
            REDEFINIR MINHA SENHA &rarr;
          </a>
        </div>

        <!-- LINK ALTERNATIVO -->
        <div class="alt-link-card">
          <strong>Não consegue clicar no botão acima?</strong>
          Copie e cole este endereço no seu navegador:<br>
          <span style="color: #059669; text-decoration: underline;">${resetLink}</span>
        </div>

        <!-- AVISO DE SEGURANÇA -->
        <div class="security-notice">
          <strong>Aviso de Segurança:</strong> Se você não realizou esta solicitação, por favor desconsidere este e-mail. Nenhuma alteração foi realizada em sua conta e sua senha atual permanece em total segurança.
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <p style="margin: 0 0 6px 0;">
          <strong>Risel Combustíveis Ltda.</strong> &bull; CNPJ 00.000.000/0001-00
        </p>
        <p style="margin: 0 0 6px 0;">
          Av. Dr. Roberto Moreira, Paulínia - SP &bull; Departamento de Tecnologia da Informação
        </p>
        <p style="margin: 0; color: #cbd5e1; font-size: 10px;">
          Esta é uma mensagem automática do sistema de segurança. Por favor, não responda diretamente a este e-mail.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

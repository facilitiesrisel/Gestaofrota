import nodemailer from "nodemailer";

/**
 * Script de Envio de 1 E-mail de Validação para: deny.goncalves@risel.com.br
 * Validação de Layout: Negrito estritamente no CAMPO / ITEM, valores sem negrito (limpo e despoluído).
 */

const TARGET_EMAIL = "deny.goncalves@risel.com.br";
const SMTP_USER = "gestaodefrotarisel@gmail.com";
const SMTP_PASS = "aeczbopvnpocoezw";
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

const RISEL_LOGO_URL = "https://risel.com.br/wp-content/uploads/2024/07/RISEL.png";
const RISEL_FAVICON_URL = "https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg";

async function main() {
  console.log(`[Validação] Preparando e-mail de teste único com tabelas despoluídas para ${TARGET_EMAIL}...`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const subject = "Validação de Layout: Reserva Aprovada #RES-2026-0841 (Tabelas Despoluídas)";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body, table, td, th, p, h1, h2, h3, div, span, strong, a { 
      font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
  <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    
    <!-- Topo Corporativo Risel -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); border-bottom: 4px solid #f47920; border-collapse: collapse;">
      <tr>
        <td style="padding: 22px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="54" valign="middle">
                <img src="${RISEL_FAVICON_URL}" alt="Logo Risel" width="48" height="48" style="border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35);" />
              </td>
              <td valign="middle" style="padding-left: 18px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 16pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase;">
                  Confirmação de Reserva de Veículo
                </h1>
                <p style="color: #86efac; margin: 4px 0 0 0; font-size: 10.5pt; font-weight: 700; text-transform: uppercase;">
                  Risel Combustíveis Ltda
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Corpo Principal -->
    <div style="padding: 26px 28px 20px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
      
      <!-- Mensagem de Boas-vindas e Contexto -->
      <div style="background-color: #f8fafc; border-left: 5px solid #0d4a36; padding: 14px 18px; border-radius: 8px; margin-bottom: 22px;">
        <p style="margin: 0; color: #1e293b; font-size: 11.5pt; line-height: 1.5; font-weight: 600;">
          Olá, <strong>Deny Gonçalves</strong>! Sua solicitação de reserva foi aprovada pela gestão de frota.
        </p>
        <p style="margin: 6px 0 0 0; color: #475569; font-size: 10pt; line-height: 1.4;">
          Abaixo você confere o espelho oficial com o novo padrão visual limpo: somente os <strong>CAMPOS / ITENS</strong> estão em negrito, mantendo os valores legíveis e sem poluição visual.
        </p>
      </div>

      <!-- Tabela 1: Dados da Reserva (Padrão Vertical: Campo em Negrito à esquerda, Valor sem negrito à direita) -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; color: #0d4a36; font-size: 11.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
          📋 Dados da Reserva & Itinerário
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <tbody>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">🏷️</span>Status
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                <span style="background-color: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 4px; font-weight: 600; font-size: 10pt; border: 1px solid #bbf7d0; display: inline-block;">
                  ✓ APROVADO
                </span>
              </td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">🎫</span>Protocolo da Reserva
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                RES-2026-0841
              </td>
            </tr>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">👤</span>Solicitante
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                Deny Gonçalves
              </td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">🪪</span>Condutor Designado
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                Deny Gonçalves (CNH 04928192831 - Cat. B)
              </td>
            </tr>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">🏢</span>Departamento / Base
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                Tecnologia & Inovação / Matriz Paulínia
              </td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">🚗</span>Veículo Selecionado
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                Toyota Hilux CD 4x4 - Placa RSL-4E12 (Frota Própria)
              </td>
            </tr>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">📅</span>Período da Utilização
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                16/09/2026 às 08:00 até 18/09/2026 às 18:00
              </td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle;">
                <span style="margin-right: 8px;">📍</span>Destino & Finalidade
              </td>
              <td style="padding: 10px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal;">
                Unidade Ribeirão Preto - Alinhamento e auditoria de sistemas de telemetria
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tabela 2: Demonstrativo de Lançamento / Despesa (Padrão Horizontal: Cabeçalhos em Negrito, Linhas de Dados com peso normal) -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; color: #0d4a36; font-size: 11.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
          📊 Espelho de Tabela Horizontal (Colunas com Cabeçalho em Negrito)
        </h3>
        <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; min-width: 580px; font-size: 10pt;">
            <thead>
              <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
                <th style="padding: 10px 12px; text-align: left; font-weight: 700; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #f47920;">ITEM / SERVIÇO</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 700; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #f47920;">CENTRO CUSTO</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 700; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #f47920;">VENCIMENTO</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 700; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #f47920;">STATUS</th>
                <th style="padding: 10px 14px; text-align: right; font-weight: 700; font-size: 9pt; text-transform: uppercase; border-bottom: 2px solid #f47920;">VALOR</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 11px 12px; color: #0f172a; font-weight: normal;">Locação Veicular Diária Especial</td>
                <td style="padding: 11px 12px; text-align: center; color: #475569; font-weight: normal;">101 - TI Frota</td>
                <td style="padding: 11px 12px; text-align: center; color: #b45309; font-weight: normal;">25/09/2026</td>
                <td style="padding: 11px 12px; text-align: center;">
                  <span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 8.5pt;">AGUARDANDO</span>
                </td>
                <td style="padding: 11px 14px; text-align: right; color: #065f46; font-weight: normal; font-size: 10.5pt;">R$ 450,00</td>
              </tr>
              <tr style="background-color: #f8fafc;">
                <td style="padding: 11px 12px; color: #0f172a; font-weight: normal;">Taxa de Seguro e Cobertura Total</td>
                <td style="padding: 11px 12px; text-align: center; color: #475569; font-weight: normal;">101 - TI Frota</td>
                <td style="padding: 11px 12px; text-align: center; color: #b45309; font-weight: normal;">25/09/2026</td>
                <td style="padding: 11px 12px; text-align: center;">
                  <span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 8.5pt;">APROVADO</span>
                </td>
                <td style="padding: 11px 14px; text-align: right; color: #065f46; font-weight: normal; font-size: 10.5pt;">R$ 80,00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Assinatura Oficial Padronizada Risel Combustíveis Ltda -->
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; width: 100%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <tr>
          <td style="vertical-align: middle; width: 52px; padding-right: 14px; border-right: 2px solid #e2e8f0;">
            <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
              <img src="${RISEL_LOGO_URL}" alt="Risel Combustíveis" style="max-height: 38px; width: auto; display: block; border: 0;" />
            </a>
          </td>
          <td style="vertical-align: middle; padding-left: 14px;">
            <div style="font-size: 11.5pt; font-weight: 800; color: #0d4a36; line-height: 1.2;">
              Risel Combustíveis Ltda
            </div>
            <div style="font-size: 9pt; color: #64748b; margin-top: 3px; line-height: 1.4;">
              Sistema Integrado de Gestão Corporativa | Frotas & Operações
            </div>
            <div style="font-size: 8.5pt; color: #94a3b8; margin-top: 2px;">
              Este é um e-mail oficial de validação do sistema. Mensagem automática.
            </div>
          </td>
        </tr>
      </table>

    </div>
  </div>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: '"Risel Combustíveis" <gestaodefrotarisel@gmail.com>',
    to: TARGET_EMAIL,
    subject: subject,
    html: html,
  });

  console.log(`[Validação] E-mail enviado com sucesso para ${TARGET_EMAIL}! MessageId: ${info.messageId}`);
}

main().catch((err) => {
  console.error("[Validação] Erro ao enviar e-mail:", err);
  process.exit(1);
});

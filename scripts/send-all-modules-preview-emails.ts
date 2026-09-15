import nodemailer from "nodemailer";

/**
 * Script Oficial de Homologação e Teste de Layouts de E-mails
 * Risel Combustíveis Ltda - ERP Frotas, Multas, Reservas e Documentos
 * 
 * Destinatário Exclusivo: deny.goncalves@risel.com.br
 * Envio individual por Módulo e Submódulo (19 gatilhos no padrão visual corporativo)
 */

const TARGET_EMAIL = "deny.goncalves@risel.com.br";

// Configurações SMTP oficiais do cofre seguro Risel
const SMTP_USER = "gestaodefrotarisel@gmail.com";
const SMTP_PASS = "aeczbopvnpocoezw";
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

const RISEL_LOGO_URL = "https://risel.com.br/wp-content/uploads/2024/07/RISEL.png";
const RISEL_FAVICON_URL = "https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg";

// Buffer de PDF básico para simulação de anexos oficiais
function createDummyPdfBuffer(title: string): Buffer {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
  return Buffer.from(content);
}

function getIconForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('status')) return '🏷️';
  if (l.includes('solicitante')) return '👤';
  if (l.includes('condutor') || l.includes('motorista') || l.includes('responsável')) return '🪪';
  if (l.includes('departamento') || l.includes('setor') || l.includes('base') || l.includes('filial')) return '🏢';
  if (l.includes('veículo') || l.includes('veiculo') || l.includes('placa') || l.includes('modelo')) return '🚗';
  if (l.includes('saída') || l.includes('saida') || l.includes('retirada') || l.includes('data')) return '📅';
  if (l.includes('retorno') || l.includes('devolução') || l.includes('devolucao') || l.includes('previsão')) return '🔄';
  if (l.includes('destino') || l.includes('trajeto') || l.includes('cidade') || l.includes('localização')) return '📍';
  if (l.includes('distância') || l.includes('distancia') || l.includes('km') || l.includes('odômetro')) return '🛣️';
  if (l.includes('motivo') || l.includes('finalidade') || l.includes('serviço') || l.includes('justificativa')) return '📝';
  if (l.includes('rodízio') || l.includes('rodizio')) return '⛔';
  if (l.includes('tanque') || l.includes('combustível') || l.includes('combustivel')) return '⛽';
  if (l.includes('observ') || l.includes('parecer') || l.includes('despacho') || l.includes('recusa')) return '💬';
  if (l.includes('protocolo') || l.includes('reserva') || l.includes('localizador') || l.includes('ordem de serviço') || l.includes('os')) return '🎫';
  if (l.includes('locadora') || l.includes('fornecedor')) return '🏬';
  if (l.includes('valor') || l.includes('custo') || l.includes('preço') || l.includes('pagamento')) return '💰';
  if (l.includes('cnh') || l.includes('documento') || l.includes('ait') || l.includes('infracao') || l.includes('infração')) return '📄';
  if (l.includes('velocidade') || l.includes('gps') || l.includes('alerta')) return '🚨';
  return '📌';
}

/**
 * Gerador do Rodapé e Assinatura Visual Oficial Risel
 */
function generateEmailSignatureHtml(senderName: string = "Risel Combustíveis"): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; width: 100%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <tr>
        <td style="vertical-align: middle; width: 52px; padding-right: 14px; border-right: 2px solid #e2e8f0;">
          <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
            <img src="${RISEL_LOGO_URL}" alt="Risel Combustíveis" style="max-height: 38px; width: auto; display: block; border: 0;" />
          </a>
        </td>
        <td style="vertical-align: middle; padding-left: 14px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <div style="font-size: 11pt; font-weight: 800; color: #1e293b; line-height: 1.25;">
            Risel Combustíveis Ltda
          </div>
          <div style="font-size: 10pt; color: #64748b; margin-top: 2px; line-height: 1.25;">
            Paulínia/SP • <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 600;">www.risel.com.br</a>
          </div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Layout Universal Premium Risel (Header com degradê institucional, detalhes, badges, botão CTA e rodapé)
 */
function buildCorporateEmailLayout(params: {
  moduleBadge?: string;
  headerTitle: string;
  headerSubtitle: string;
  senderName: string;
  introText?: string;
  alertBox?: { type: 'success' | 'warning' | 'danger' | 'info'; title: string; text: string };
  details?: { label: string; value: string }[];
  customHtmlBody?: string;
  actionButton?: { label: string; url: string };
  attachedFilesNotice?: string;
}): string {
  const {
        headerTitle,
    headerSubtitle,
    senderName,
    introText,
    alertBox,
    details,
    customHtmlBody,
    actionButton,
    attachedFilesNotice
  } = params;

  let alertBoxHtml = '';
  if (alertBox) {
    const colors = {
      success: { bg: '#f0fdf4', border: '#16a34a', text: '#166534', title: '#15803d' },
      warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', title: '#b45309' },
      danger: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', title: '#b91c1c' },
      info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', title: '#1d4ed8' }
    }[alertBox.type];

    alertBoxHtml = `
      <div style="background-color: ${colors.bg}; border-left: 5px solid ${colors.border}; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <strong style="display: block; color: ${colors.title}; font-size: 11pt; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px;">${alertBox.title}</strong>
        <p style="margin: 0; color: ${colors.text}; font-size: 11pt; line-height: 1.5; font-weight: 500;">${alertBox.text}</p>
      </div>
    `;
  }

  let tableRowsHtml = '';
  if (details && details.length > 0) {
    tableRowsHtml = details.map((d, index) => {
      const icon = getIconForLabel(d.label);
      const isStatus = d.label.toLowerCase().includes('status') || d.label.toLowerCase().includes('situação');
      const isApproved = isStatus && (d.value.includes('APROVAD') || d.value.includes('CONCLUÍD') || d.value.includes('TRÂNSITO') || d.value.includes('REGULAR') || d.value.includes('LIBERAD') || d.value.includes('CONFIRMAD'));
      const isPending = isStatus && (d.value.includes('PENDENTE') || d.value.includes('AGUARDANDO') || d.value.includes('ANÁLISE') || d.value.includes('SOLICITAD'));
      const isRejected = isStatus && (d.value.includes('RECUSAD') || d.value.includes('CANCELAD') || d.value.includes('REJEITAD') || d.value.includes('CRÍTICO') || d.value.includes('ALERTA') || d.value.includes('RETIDO'));

      let valueDisplay = `<span style="color: #334155; font-weight: normal; font-size: 11pt;">${d.value}</span>`;
      if (isApproved) {
        valueDisplay = `<span style="background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 11pt; display: inline-block; border: 1px solid #bbf7d0;">${d.value}</span>`;
      } else if (isPending) {
        valueDisplay = `<span style="background-color: #fef3c7; color: #b45309; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 11pt; display: inline-block; border: 1px solid #fde68a;">${d.value}</span>`;
      } else if (isRejected) {
        valueDisplay = `<span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 11pt; display: inline-block; border: 1px solid #fecaca;">${d.value}</span>`;
      }

      return `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #edf2f7;">
          <td style="padding: 11px 16px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-weight: 700; width: 36%; font-size: 11pt; vertical-align: middle; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <span style="margin-right: 8px; font-size: 12pt;">${icon}</span><span style="color: #1e293b;">${d.label}</span>
          </td>
          <td style="padding: 11px 18px; border-bottom: 1px solid #edf2f7; color: #334155; font-size: 11pt; vertical-align: middle; font-weight: normal; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            ${valueDisplay}
          </td>
        </tr>
      `;
    }).join('');
  }

  const buttonHtml = actionButton ? `
    <div style="text-align: center; margin-top: 24px; margin-bottom: 16px;">
      <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
        <tr>
          <td align="center" bgcolor="#114D38" style="border-radius: 8px; background-color: #114D38; background: linear-gradient(135deg, #09392b 0%, #114D38 50%, #1d7053 100%);">
            <a href="${actionButton.url}" target="_blank" style="font-size: 11pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-weight: 800; color: #ffffff !important; text-decoration: none; padding: 13px 34px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #114D38;">
              <span style="color: #ffffff !important;">${actionButton.label}</span>
            </a>
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  const attachedNoticeHtml = attachedFilesNotice ? `
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <p style="margin: 0; color: #166534; font-size: 10.5pt; font-weight: 700; display: flex; align-items: center; gap: 6px;">
        <span>📎</span> <span>${attachedFilesNotice}</span>
      </p>
    </div>
  ` : '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${headerTitle}</title>
    <style>
      body, table, td, p, h1, h2, h3, div, span, strong, a { 
        font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
      }
      body { 
        background-color: #f1f5f9; 
        margin: 0; 
        padding: 0; 
        -webkit-font-smoothing: antialiased;
      }
    </style>
  </head>
  <body style="background-color: #f1f5f9; padding: 24px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      
      <!-- Cabeçalho Oficial Risel com Logo Timbrado e Degradê Corporativo -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
        <tr>
          <td bgcolor="#09392b" style="padding: 22px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <tr>
                <td width="54" valign="middle" style="width: 54px; vertical-align: middle;">
                  <img src="${RISEL_FAVICON_URL}" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35); object-fit: cover;" />
                </td>
                <td valign="middle" style="padding-left: 18px; vertical-align: middle;">

                  <h1 style="color: #ffffff !important; margin: 0; font-size: 15.5pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">
                    ${headerTitle}
                  </h1>
                  <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 10.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                    ${headerSubtitle}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Conteúdo Interno Principal -->
      <div style="padding: 26px 28px 20px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
        
        ${introText ? `
          <div style="background-color: #f8fafc; padding: 14px 18px; border-left: 5px solid #0d4a36; border-radius: 8px; margin-bottom: 18px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <p style="color: #1e293b; font-size: 11pt; line-height: 1.55; margin: 0; font-weight: 600;">${introText}</p>
          </div>
        ` : ''}

        ${alertBoxHtml}

        ${tableRowsHtml ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 6px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <thead>
              <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
                <th style="padding: 10px 16px; text-align: left; font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f47920; width: 36%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">CAMPO / ITEM</th>
                <th style="padding: 10px 18px; text-align: left; font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f47920; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">DETALHAMENTO OPERACIONAL</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        ` : ''}

        ${customHtmlBody || ''}

        ${attachedNoticeHtml}

        ${buttonHtml}

        <!-- Assinatura Corporativa Oficial Risel -->
        ${generateEmailSignatureHtml(senderName)}

      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendDirectEmail(options: {
  to: string;
  fromName: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content?: Buffer; contentType?: string; encoding?: string }>;
}) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return await transporter.sendMail({
    from: `"${options.fromName}" <${SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments
  });
}

async function main() {
  console.log(`\n========================================================================`);
  console.log(`INICIANDO DISPARO COMPLETO E INDIVIDUAL DE HOMOLOGAÇÃO DE E-MAILS`);
  console.log(`Destinatário Único e Exclusivo: ${TARGET_EMAIL}`);
  console.log(`Conta Remetente: ${SMTP_USER} (Google Workspace / Gmail SMTP)`);
  console.log(`Padrão Visual: Aptos Narrow 11pt, Verde #114D38, Laranja #f47920 e Assinatura`);
  console.log(`========================================================================\n`);

  const dummyPdf = createDummyPdfBuffer("Documento Corporativo Risel");

  const emailTriggers = [
    // =========================================================================
    // MÓDULO 1: GESTÃO DE RESERVAS (Remetente: "Gestão de Reservas Risel")
    // =========================================================================
    {
      moduleIndex: "1.1",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Nova Solicitação de Reserva (Pendente de Aprovação)",
      fromName: "Risel Combustíveis",
      subject: "Nova Solicitação de Reserva de Veículo - Rodrigo Albuquerque",
      html: buildCorporateEmailLayout({
        headerTitle: "Nova Solicitação de Reserva",
        headerSubtitle: "Risel Combustíveis • Solicitação Pendente de Análise",
        senderName: "Gestão de Reservas Risel",
        introText: "Uma nova solicitação de reserva de veículo da frota interna foi registrada no sistema e aguarda homologação e parecer da Gestão de Frota.",
        details: [
          { label: "Status da Reserva", value: "⏳ PENDENTE DE APROVAÇÃO" },
          { label: "Solicitante", value: "Rodrigo Albuquerque" },
          { label: "Condutor Autorizado", value: "Rodrigo Albuquerque" },
          { label: "Departamento / Setor", value: "Operações & Logística Corporativa" },
          { label: "Veículo Sugerido", value: "Toyota Hilux CD 4x4 - Placa BRA2E19" },
          { label: "Data/Hora de Saída", value: "25/09/2026 às 08:00" },
          { label: "Previsão de Retorno", value: "26/09/2026 às 18:00" },
          { label: "Destino da Viagem", value: "Ribeirão Preto/SP - Base Parceira de Distribuição" },
          { label: "Distância Estimada", value: "320 km rodados" },
          { label: "Motivo / Finalidade", value: "Auditoria operacional e supervisão técnica no recebimento de combustíveis a granel." }
        ],
        actionButton: {
          label: "🚀 Analisar Solicitação no Sistema",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas"
        }
      })
    },

    {
      moduleIndex: "1.2",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Solicitação de Reserva Aprovada",
      fromName: "Risel Combustíveis",
      subject: "Sua Solicitação de Reserva para o dia 25/09/2026 foi Aprovada",
      html: buildCorporateEmailLayout({
        headerTitle: "Solicitação de Reserva Aprovada",
        headerSubtitle: "Risel Combustíveis • Reserva Homologada com Sucesso",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Rodrigo Albuquerque, comunicamos que a sua solicitação de reserva de veículo corporativo foi aprovada pela Gestão de Frota.",
        alertBox: {
          type: "success",
          title: "Instruções de Retirada da Chave:",
          text: "A chave e o documento do veículo já se encontram liberados na portaria principal da Matriz Paulínia. Realize o checklist de inspeção no painel antes da saída."
        },
        details: [
          { label: "Status da Reserva", value: "✅ APROVADA / LIBERADA" },
          { label: "Solicitante", value: "Rodrigo Albuquerque" },
          { label: "Condutor Autorizado", value: "Rodrigo Albuquerque" },
          { label: "Veículo Designado", value: "Toyota Hilux CD 4x4 - Placa BRA2E19" },
          { label: "Saída Autorizada", value: "25/09/2026 às 08:00" },
          { label: "Retorno Previsto", value: "26/09/2026 às 18:00" },
          { label: "Destino Aprovado", value: "Ribeirão Preto/SP" },
          { label: "Nível de Combustível", value: "Tanque Cheio na Saída (Devolver Cheio)" },
          { label: "Despacho da Gestão", value: "Veículo higienizado, revisado e liberado com chave na portaria da Matriz." }
        ],
        actionButton: {
          label: "🚗 Acessar Detalhes da Reserva",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas"
        }
      })
    },

    {
      moduleIndex: "1.3",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Solicitação de Reserva Recusada",
      fromName: "Risel Combustíveis",
      subject: "Solicitação de Reserva Recusada - Mariana Silveira",
      html: buildCorporateEmailLayout({
        headerTitle: "Solicitação de Reserva Recusada",
        headerSubtitle: "Risel Combustíveis • Parecer da Gestão de Frota",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Mariana Silveira, informamos que sua solicitação de reserva de veículo para a data informada não pôde ser atendida.",
        alertBox: {
          type: "danger",
          title: "Motivo da Recusa / Parecer Técnico:",
          text: "Veículo Fiat Strada agendado para revisão preventiva periódica na concessionária autorizada no período solicitado. Sugerimos reagendar ou solicitar veículo terceirizado pelo módulo RAC."
        },
        details: [
          { label: "Status da Reserva", value: "❌ RECUSADA" },
          { label: "Solicitante", value: "Mariana Silveira" },
          { label: "Setor / Departamento", value: "Comercial & Vendas" },
          { label: "Veículo Solicitado", value: "Fiat Strada Endurance - Placa RIS1020" },
          { label: "Data Solicitada", value: "28/09/2026 (09:00 às 17:00)" },
          { label: "Destino", value: "Campinas/SP - Reunião com Clientes" },
          { label: "Alternativa Recomendada", value: "Abertura de Solicitação RAC para locação em locadora credenciada." }
        ],
        actionButton: {
          label: "📋 Abrir Pedido no Módulo RAC",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac"
        }
      })
    },

    {
      moduleIndex: "1.4",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Solicitação de Reserva Cancelada",
      fromName: "Risel Combustíveis",
      subject: "Reserva Cancelada - Roberto Mendes",
      html: buildCorporateEmailLayout({
        headerTitle: "Reserva Cancelada",
        headerSubtitle: "Risel Combustíveis • Liberação de Veículo na Frota",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Roberto Mendes, confirmamos que a reserva do veículo corporativo foi cancelada no sistema a seu pedido.",
        details: [
          { label: "Status da Reserva", value: "🚫 CANCELADA" },
          { label: "Solicitante", value: "Roberto Mendes" },
          { label: "Condutor", value: "Roberto Mendes" },
          { label: "Veículo Liberado", value: "Volkswagen Saveiro - Placa JKL-3456" },
          { label: "Data Original", value: "28/09/2026 (07:30 às 17:00)" },
          { label: "Destino Planejado", value: "Campinas/SP" },
          { label: "Motivo do Cancelamento", value: "Reagendamento de visita técnica junto ao fornecedor terceirizado." }
        ],
        actionButton: {
          label: "📅 Consultar Calendário de Reservas",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas"
        }
      })
    },

    {
      moduleIndex: "1.5",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Atualização de Dados da Reserva",
      fromName: "Risel Combustíveis",
      subject: "Atualização de Reserva de Veículo - Juliana Ferreira",
      html: buildCorporateEmailLayout({
        headerTitle: "Atualização de Reserva",
        headerSubtitle: "Risel Combustíveis • Alteração de Parâmetros Operacionais",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Juliana Ferreira, informamos que os dados da sua reserva de veículo foram atualizados com sucesso pela Gestão de Frota.",
        details: [
          { label: "Status da Reserva", value: "✅ ATUALIZADA & APROVADA" },
          { label: "Solicitante", value: "Juliana Ferreira" },
          { label: "Novo Condutor", value: "Lucas Albuquerque (Substituição homologada)" },
          { label: "Veículo Designado", value: "Toyota Yaris Sedan - Placa MNO-7890" },
          { label: "Nova Data/Hora Saída", value: "30/09/2026 às 08:30" },
          { label: "Nova Data/Hora Retorno", value: "02/10/2026 às 18:00" },
          { label: "Destino Atualizado", value: "São José dos Campos/SP - Treinamento de Lideranças" },
          { label: "Observações da Frota", value: "Condutor substituto devidamente cadastrado e autorizado para retirada da chave." }
        ],
        actionButton: {
          label: "🔍 Visualizar Reserva Atualizada",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas"
        }
      })
    },

    {
      moduleIndex: "1.6",
      moduleGroup: "Módulo Gestão de Reservas",
      submodule: "Envio de Link de Acesso à Reserva Pública",
      fromName: "Risel Combustíveis",
      subject: "Link de Acesso Rápido - Reserva de Veículos Risel Combustíveis",
      html: buildCorporateEmailLayout({
        headerTitle: "Acesso ao Portal de Reservas",
        headerSubtitle: "Risel Combustíveis • Agendamento de Veículos da Frota",
        senderName: "Gestão de Reservas Risel",
        introText: "Olá! Segue o link corporativo direto para você solicitar e consultar agendamentos de veículos da frota própria da Risel Combustíveis.",
        alertBox: {
          type: "info",
          title: "Dica Operacional:",
          text: "Reserve seus veículos com pelo menos 24 horas de antecedência para garantir a disponibilidade e higienização prévia da frota."
        },
        details: [
          { label: "Destinatário", value: "Colaborador Risel" },
          { label: "Portal", value: "Gestão de Frotas & Reservas Leves" },
          { label: "Autenticação", value: "Acesso Seguro via Link Corporativo" },
          { label: "Horário de Retirada", value: "Segunda a Sexta das 07:30 às 18:00 (Portaria Matriz)" }
        ],
        actionButton: {
          label: "🚀 Acessar Formulário de Reserva",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reserva-publica"
        }
      })
    },

    // =========================================================================
    // MÓDULO 2: USO DIÁRIO & DIÁRIO DE BORDO (Remetente: "Gestão de Reservas Risel")
    // =========================================================================
    {
      moduleIndex: "2.1",
      moduleGroup: "Módulo Uso Diário & Diário de Bordo",
      submodule: "Início de Uso Diário (Saída do Veículo / Check-in)",
      fromName: "Risel Combustíveis",
      subject: "Início de Uso Diário - Anderson Lima - Placa PQR-1234",
      html: buildCorporateEmailLayout({
        headerTitle: "Início de Uso Diário",
        headerSubtitle: "Risel Combustíveis • Saída de Veículo Registrada",
        senderName: "Gestão de Reservas Risel",
        introText: "Informamos que o condutor Anderson Lima registrou o início de uso diário do veículo corporativo para atendimento de rota externa.",
        details: [
          { label: "Status da Viagem", value: "🚗 VEÍCULO EM TRÂNSITO" },
          { label: "Condutor", value: "Anderson Lima" },
          { label: "Departamento / Setor", value: "Manutenção Industrial & Instalações" },
          { label: "Veículo", value: "Renault Kangoo Express - Placa PQR-1234" },
          { label: "Data/Hora de Saída", value: "15/09/2026 às 07:45" },
          { label: "Odômetro Inicial", value: "48.250 km" },
          { label: "Nível de Combustível", value: "⛽ Cheio (100%)" },
          { label: "Destino Previsto", value: "Paulínia/SP - Atendimento Preventivo Base 02" },
          { label: "Checklist de Saída", value: "✅ Conforme (Pneus, Óleo e Documento OK)" },
          { label: "Motivo / Serviço", value: "Troca de filtros e calibração de sensores na base operacional." }
        ],
        actionButton: {
          label: "📍 Acompanhar no Mapa em Tempo Real",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/uso-diario"
        }
      })
    },

    {
      moduleIndex: "2.2",
      moduleGroup: "Módulo Uso Diário & Diário de Bordo",
      submodule: "Fim de Uso Diário (Devolução / Check-out Concluído)",
      fromName: "Risel Combustíveis",
      subject: "Fim de Uso Diário - Anderson Lima - Placa PQR-1234",
      html: buildCorporateEmailLayout({
        headerTitle: "Fim de Uso Diário Concluído",
        headerSubtitle: "Risel Combustíveis • Devolução e Diário de Bordo Fechado",
        senderName: "Gestão de Reservas Risel",
        introText: "O condutor Anderson Lima concluiu o roteiro diário e registrou a devolução do veículo no pátio da Matriz Paulínia.",
        details: [
          { label: "Status da Viagem", value: "✅ CONCLUÍDA / RETORNO REALIZADO" },
          { label: "Condutor", value: "Anderson Lima" },
          { label: "Veículo Devolvido", value: "Renault Kangoo Express - Placa PQR-1234" },
          { label: "Data/Hora da Saída", value: "15/09/2026 às 07:45" },
          { label: "Data/Hora da Devolução", value: "15/09/2026 às 16:30" },
          { label: "Odômetro Inicial", value: "48.250 km" },
          { label: "Odômetro Final", value: "48.312 km" },
          { label: "Distância Total Percorrida", value: "🛣️ 62 km rodados no dia" },
          { label: "Tanque no Retorno", value: "⛽ 3/4 do Tanque" },
          { label: "Registro de Ocorrências", value: "Nenhuma anormalidade ou avaria detectada." }
        ],
        actionButton: {
          label: "📊 Consultar Histórico de Viagens",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/uso-diario"
        }
      })
    },

    // =========================================================================
    // MÓDULO 3: LOCAÇÃO TERCEIRIZADA (RAC) (Remetente: "Gestão de Reservas Risel")
    // =========================================================================
    {
      moduleIndex: "3.1",
      moduleGroup: "Módulo Locação Terceirizada (RAC)",
      submodule: "Nova Solicitação RAC com CNH Anexa",
      fromName: "Risel Combustíveis",
      subject: "Solicitação RAC - RAC-20260925-9120 - Carlos Mendes (Paulínia ➔ Santos)",
      html: buildCorporateEmailLayout({
        headerTitle: "Solicitação de Locação RAC",
        headerSubtitle: "Risel Combustíveis • Veículo Terceirizado para Cotação",
        senderName: "Gestão de Reservas Risel",
        introText: "Uma nova solicitação de locação de veículo terceirizado (RAC) foi protocolada no sistema e aguarda cotação nas locadoras parceiras (Localiza / Movida / Unidas).",
        details: [
          { label: "Status da Solicitação", value: "⏳ SOLICITADA (Aguardando Cotação)" },
          { label: "Protocolo Operacional", value: "RAC-20260925-9120" },
          { label: "Solicitante", value: "Carlos Mendes" },
          { label: "Condutor Titular", value: "Carlos Mendes" },
          { label: "Departamento / Setor", value: "Operações & Logística Portuária" },
          { label: "Trajeto Solicitado", value: "Paulínia/SP ➔ Santos/SP (Porto)" },
          { label: "Data de Retirada", value: "01/10/2026 às 08:00" },
          { label: "Data de Devolução", value: "03/10/2026 às 18:00 (3 diárias)" },
          { label: "Categoria do Veículo", value: "Sedan Médio Executivo (Grupo C)" },
          { label: "Justificativa Operacional", value: "Atendimento emergencial de auditoria e operação de descarga de granel no Porto de Santos." },
          { label: "Documento Anexado", value: "📎 CNH_Digital_Carlos_Mendes.pdf (Anexo no e-mail)" }
        ],
        attachedFilesNotice: "Arquivo CNH do condutor anexado a este e-mail em formato PDF de alta resolução.",
        actionButton: {
          label: "💼 Cotar na Locadora Parceira",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac"
        }
      }),
      attachments: [
        {
          filename: "CNH_Digital_Carlos_Mendes.pdf",
          content: dummyPdf,
          contentType: "application/pdf"
        }
      ]
    },

    {
      moduleIndex: "3.2",
      moduleGroup: "Módulo Locação Terceirizada (RAC)",
      submodule: "Locação RAC Aprovada com Voucher Anexo",
      fromName: "Risel Combustíveis",
      subject: "Locação RAC Aprovada com Voucher - RAC-20260925-9120 - Carlos Mendes - Localiza",
      html: buildCorporateEmailLayout({
        headerTitle: "Locação RAC Aprovada & Voucher Emitido",
        headerSubtitle: "Risel Combustíveis • Confirmação de Reserva de Veículo",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Carlos Mendes, sua solicitação de locação de veículo terceirizado foi aprovada e confirmada na locadora parceira com voucher emitido em anexo.",
        alertBox: {
          type: "success",
          title: "Instruções de Retirada no Balcão da Locadora:",
          text: "Apresentar no balcão da Localiza o Voucher Oficial anexo, sua CNH original física ou digital e documento com foto. Lembre-se de retirar e devolver com o tanque abastecido."
        },
        details: [
          { label: "Status da Reserva", value: "✅ RESERVA CONFIRMADA / VOUCHER EMITIDO" },
          { label: "Protocolo Risel", value: "RAC-20260925-9120" },
          { label: "Condutor Autorizado", value: "Carlos Mendes" },
          { label: "Locadora Contratada", value: "Localiza Rent a Car" },
          { label: "Nº Localizador / Reserva", value: "LOC-778921" },
          { label: "Agência de Retirada", value: "Localiza Campinas Norte (Av. Barão de Itapura, 2120)" },
          { label: "Data de Retirada", value: "01/10/2026 às 08:00" },
          { label: "Data de Devolução", value: "03/10/2026 às 18:00" },
          { label: "Valor Total Contratado", value: "R$ 540,00 (Total 3 diárias com seguro completo incluso)" }
        ],
        attachedFilesNotice: "Voucher oficial de confirmação emitido pela Localiza anexado em PDF.",
        actionButton: {
          label: "📄 Acessar Solicitação RAC no ERP",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac"
        }
      }),
      attachments: [
        {
          filename: "Voucher_Localiza_RAC_20260925_9120.pdf",
          content: dummyPdf,
          contentType: "application/pdf"
        }
      ]
    },

    {
      moduleIndex: "3.3",
      moduleGroup: "Módulo Locação Terceirizada (RAC)",
      submodule: "Locação RAC Recusada com Parecer",
      fromName: "Risel Combustíveis",
      subject: "Solicitação RAC Indeferida - RAC-20260925-4411 - Lucas Ferreira",
      html: buildCorporateEmailLayout({
        headerTitle: "Solicitação de Locação RAC Recusada",
        headerSubtitle: "Risel Combustíveis • Parecer da Gestão de Frotas",
        senderName: "Gestão de Reservas Risel",
        introText: "Prezado(a) Lucas Ferreira, comunicamos que sua solicitação de veículo terceirizado (RAC) não pôde ser autorizada pela administração.",
        alertBox: {
          type: "danger",
          title: "Parecer da Gestão de Frota:",
          text: "Há disponibilidade de veículo próprio da frota interna da Risel para o mesmo trajeto e data requerida. Solicitamos utilizar a Reserva de Frota Própria para otimização de custos operacionais."
        },
        details: [
          { label: "Status da Solicitação", value: "❌ RECUSADA" },
          { label: "Protocolo Risel", value: "RAC-20260925-4411" },
          { label: "Solicitante", value: "Lucas Ferreira" },
          { label: "Departamento", value: "Marketing & Comunicação" },
          { label: "Trajeto Solicitado", value: "Paulínia/SP ➔ São Paulo/SP" },
          { label: "Data Solicitada", value: "05/10/2026" },
          { label: "Recomendação Operacional", value: "Utilizar a reserva de veículos internos (ex: Yaris ou Strada da frota própria)." }
        ],
        actionButton: {
          label: "🚗 Solicitar Veículo da Frota Própria",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas"
        }
      })
    },

    // =========================================================================
    // MÓDULO 4: CHECKLIST DE FROTA LEVE (Remetente: "Checklist Frota Leve - Risel")
    // =========================================================================
    {
      moduleIndex: "4.1",
      moduleGroup: "Módulo Checklist de Frota Leve",
      submodule: "Comprovante de Inspeção Veicular Realizada",
      fromName: "Risel Combustíveis",
      subject: "Nova Inspeção Realizada - Placa BRA2E19 (APROVADO)",
      html: buildCorporateEmailLayout({
        headerTitle: "Comprovante de Inspeção Veicular",
        headerSubtitle: "Risel Combustíveis • Checklist Operacional de Frota Leve",
        senderName: "Checklist Frota Leve - Risel",
        introText: "Uma nova inspeção de checklist foi concluída com êxito no sistema para o veículo Toyota Hilux (BRA2E19).",
        details: [
          { label: "Status da Inspeção", value: "✅ APROVADO / SEM RESSALVAS" },
          { label: "Placa do Veículo", value: "BRA2E19 (Toyota Hilux CD 4x4)" },
          { label: "Condutor Responsável", value: "Carlos Eduardo Silva" },
          { label: "Base Operacional", value: "Paulínia / Matriz" },
          { label: "Data da Inspeção", value: "15/09/2026 às 08:15" },
          { label: "Quilometragem (KM)", value: "45.210 km" },
          { label: "Nível do Tanque", value: "⛽ Cheio (100%)" },
          { label: "Estado dos Pneus", value: "Dianteiros: BOM | Traseiros: BOM | Estepe: BOM" },
          { label: "Itens de Segurança", value: "Extintor, Triângulo, Chave de Roda e Macaco CONFORMES" },
          { label: "Fluidos e Óleo", value: "Nível de óleo do motor e arrefecimento DENTRO DO PADRÃO" },
          { label: "Observações da Lataria", value: "Veículo limpo, sem avarias ou riscos recentes." }
        ],
        actionButton: {
          label: "📋 Visualizar Checklist no Painel",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/checklist"
        }
      })
    },

    // =========================================================================
    // MÓDULO 5: CONTROLE DE FROTAS & MANUTENÇÃO (Remetente: "Controle de Frotas")
    // =========================================================================
    {
      moduleIndex: "5.1",
      moduleGroup: "Módulo Controle de Frotas",
      submodule: "Termo de Autorização de Desconto por Avaria (com PDF Anexo)",
      fromName: "Risel Combustíveis",
      subject: "Autorização de Desconto em Folha por Avaria - Veículo BRA2E19 - Risel Combustíveis",
      html: buildCorporateEmailLayout({
        headerTitle: "Autorização de Desconto por Avaria",
        headerSubtitle: "Risel Combustíveis • Termo de Responsabilidade e Reparo de Veículo",
        senderName: "Controle de Frotas",
        introText: "Prezado(a) Carlos Eduardo Silva, informamos que foi formalizado o registro da Ordem de Serviço referente aos reparos de avarias no veículo sob sua condução.",
        alertBox: {
          type: "warning",
          title: "Forma de Desconto em Folha de Pagamento:",
          text: "Conforme o Termo de Responsabilidade e Manutenção anexo, o valor total do reparo de R$ 750,00 será descontado diretamente em folha de pagamento."
        },
        details: [
          { label: "Status do Documento", value: "📝 AGUARDANDO ASSINATURA DO TERMO" },
          { label: "Ordem de Serviço (OS)", value: "OS-2026-4419" },
          { label: "Placa do Veículo", value: "BRA2E19 (Toyota Hilux)" },
          { label: "Colaborador Responsável", value: "Carlos Eduardo Silva" },
          { label: "Base Operacional", value: "Paulínia / Matriz" },
          { label: "Descrição dos Reparos", value: "Substituição de lanterna traseira direita e reparo pontual de para-choque traseiro" },
          { label: "Valor Total do Reparo", value: "R$ 750,00" },
          { label: "Forma de Desconto", value: "Desconto em Folha de Pagamento" },
          { label: "Documento Anexo", value: "📎 Termo_Autorizacao_Desconto_Avaria_BRA2E19.pdf" }
        ],
        attachedFilesNotice: "O Termo Oficial de Autorização de Desconto em Folha assinado pelo gestor segue anexo em formato PDF.",
        actionButton: {
          label: "📑 Visualizar Ordem de Serviço",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/frota"
        }
      }),
      attachments: [
        {
          filename: "Termo_Autorizacao_Desconto_Avaria_BRA2E19.pdf",
          content: dummyPdf,
          contentType: "application/pdf"
        }
      ]
    },

    {
      moduleIndex: "5.2",
      moduleGroup: "Módulo Controle de Frotas",
      submodule: "Alerta de Manutenção Preventiva / Revisão de KM",
      fromName: "Risel Combustíveis",
      subject: "Alerta de Manutenção: Veículo BRA2E19 atingiu 45.000 km - Revisão Agendada",
      html: buildCorporateEmailLayout({
        headerTitle: "Alerta de Manutenção Preventiva",
        headerSubtitle: "Risel Combustíveis • Plano de Revisões Periódicas da Frota",
        senderName: "Controle de Frotas",
        introText: "O sistema identificou que o veículo Toyota Hilux (BRA2E19) atingiu a faixa quilométrica estipulada para a revisão periódica de 45.000 km.",
        details: [
          { label: "Status da Manutenção", value: "⚠️ REVISÃO PREVENTIVA AGENDADA" },
          { label: "Placa do Veículo", value: "BRA2E19 (Toyota Hilux CD)" },
          { label: "Quilometragem Atual", value: "45.210 km (Meta de revisão: 45.000 km)" },
          { label: "Base Alocada", value: "Paulínia / Matriz" },
          { label: "Oficina / Concessionária", value: "Concessionária Maggi Toyota Campinas" },
          { label: "Data do Agendamento", value: "28/09/2026 às 08:30" },
          { label: "Itens Inclusos na Revisão", value: "Troca de óleo sintético, filtro de óleo, filtro de combustível, filtro de ar e pastilhas de freio" },
          { label: "Custo Estimado", value: "R$ 1.420,00 (Tabela Fixa Concessionária)" }
        ],
        actionButton: {
          label: "🔧 Abrir Módulo de Manutenção",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/frota"
        }
      })
    },

    // =========================================================================
    // MÓDULO 6: CONTROLE DE MULTAS (Remetente: "Sistema de Multas Risel")
    // =========================================================================
    {
      moduleIndex: "6.1",
      moduleGroup: "Módulo Controle de Multas",
      submodule: "Notificação de Infração de Trânsito (AIT) ao Condutor",
      fromName: "Risel Combustíveis",
      subject: "NOTIFICAÇÃO DE MULTA: PLACA BRA2E19 - FROTA: 104 - BASE: PAULÍNIA - DATA 15.09.2026",
      html: buildCorporateEmailLayout({
        headerTitle: "Notificação de Infração de Trânsito",
        headerSubtitle: "Risel Combustíveis Ltda",
        senderName: "Sistema de Multas Risel",
        introText: "Prezado(a) condutor(a) / Gestor, informamos que foi registrada uma autuação de trânsito vinculada ao veículo sob sua responsabilidade na data especificada abaixo. Solicitamos providenciar a cópia da CNH e a assinatura no Termo de Desconto anexo.",
        alertBox: {
          type: "danger",
          title: "Atenção ao Prazo Limite de Indicação do Condutor:",
          text: "O prazo limite para indicação do real infrator junto ao órgão de trânsito (DER/SP) expira em 10/10/2026. A indicação tempestiva evita penalidades adicionais."
        },
        details: [
          { label: "Status da Infração", value: "⏳ AGUARDANDO INDICAÇÃO DO CONDUTOR" },
          { label: "Auto de Infração (AIT)", value: "DER-SP 1R-8492019-3" },
          { label: "Placa do Veículo", value: "BRA2E19 (Frota 104 - Toyota Hilux)" },
          { label: "Condutor Responsável", value: "Rodrigo Albuquerque" },
          { label: "Base / Filial", value: "Paulínia / Matriz" },
          { label: "Data/Hora da Infração", value: "15/09/2026 às 14:22" },
          { label: "Local da Infração", value: "SP-330 Rodovia Anhanguera, KM 118 - Campinas/SP" },
          { label: "Enquadramento / Descrição", value: "Transitar em velocidade superior à máxima permitida em até 20% (Art. 218, I do CTB)" },
          { label: "Pontuação CNH", value: "4 Pontos (Infração Média)" },
          { label: "Valor Original", value: "R$ 130,16" },
          { label: "Valor com Desconto (SNE)", value: "R$ 78,10 (40% de desconto pelo app SNE)" },
          { label: "Prazo Limite de Indicação", value: "10/10/2026" }
        ],
        attachedFilesNotice: "Documentos anexos a este e-mail: Auto de Infração oficial digitalizado e Termo de Autorização de Desconto em Folha.",
        actionButton: {
          label: "⚖️ Acessar Painel de Multas & Recursos",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/multas"
        }
      }),
      attachments: [
        {
          filename: "AIT_DER_SP_1R84920193_BRA2E19.pdf",
          content: dummyPdf,
          contentType: "application/pdf"
        }
      ]
    },

    // =========================================================================
    // MÓDULO 7: RASTREAMENTO & TELEMETRIA (Remetente: "Rastreamento Frota Leve Risel")
    // =========================================================================
    {
      moduleIndex: "7.1",
      moduleGroup: "Módulo Rastreamento & Telemetria",
      submodule: "Alerta FDS / Movimentação Não Autorizada fora de Expediente",
      fromName: "Risel Combustíveis",
      subject: "🚨 ALERTA FDS: Movimentação não autorizada - BRA2E19",
      html: buildCorporateEmailLayout({
        headerTitle: "Alerta Crítico de Telemetria GPS",
        headerSubtitle: "Risel Combustíveis • Central de Monitoramento 24h",
        senderName: "Rastreamento Frota Leve Risel",
        introText: "ATENÇÃO: Foi detectada movimentação em tempo real de um veículo da frota leve durante o fim de semana SEM viagem ou reserva ativa no sistema corporativo.",
        alertBox: {
          type: "danger",
          title: "Alerta de Segurança Patrimonial:",
          text: "Veículo em deslocamento ativo fora do horário comercial permitido pela política de frotas. Contate imediatamente o responsável ou a supervisão de segurança."
        },
        details: [
          { label: "Status do Alerta", value: "🚨 DESLOCAMENTO NÃO AUTORIZADO" },
          { label: "Veículo Rastreado", value: "Toyota Hilux - Placa BRA2E19" },
          { label: "Velocidade Registrada", value: "84 km/h (Em trânsito)" },
          { label: "Data e Hora do GPS", value: "15/09/2026 às 03:42 (Madrugada de Domingo)" },
          { label: "Localização Atual", value: "Av. José Paulino, 1200 - Centro, Paulínia - SP" },
          { label: "Coordenadas Geográficas", value: "-22.761245, -47.153920" },
          { label: "Reserva Ativa no Sistema", value: "NENHUMA (Sem registro de saída no Diário de Bordo)" }
        ],
        actionButton: {
          label: "🛰️ Visualizar Posição no Mapa GPS",
          url: "https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/telemetria"
        }
      })
    },

    // =========================================================================
    // MÓDULO 8: LANÇAMENTO DE DOCUMENTOS (Remetente: "Sistema de Documentos Risel")
    // =========================================================================
    {
      moduleIndex: "8.1",
      moduleGroup: "Módulo Lançamento de Documentos",
      submodule: "Solicitação de Aprovação de Documento / NF-e (Tabela Horizontal Oficial)",
      fromName: "Risel Combustíveis",
      subject: "Aprovação - Posto Modelo de Paulínia Comércio Ltda - 05/10/2026",
      html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Aprovação de Lançamento - Risel Combustíveis</title>
        <style>
          body, table, td, p, h1, h2, h3, div, span, strong, a { 
            font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif !important; 
          }
          body { background-color: #f1f5f9; margin: 0; padding: 24px 10px; }
        </style>
      </head>
      <body style="background-color: #f1f5f9; padding: 24px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
        <div style="max-width: 820px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          
          <!-- Topo Timbrado Oficial Risel -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
            <tr>
              <td bgcolor="#09392b" style="padding: 22px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td width="54" valign="middle" style="width: 54px; vertical-align: middle;">
                      <img src="${RISEL_FAVICON_URL}" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35); object-fit: cover;" />
                    </td>
                    <td valign="middle" style="padding-left: 18px; vertical-align: middle;">
                      <h1 style="color: #ffffff !important; margin: 0; font-size: 16pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">
                        Solicitação de Aprovação de Lançamento
                      </h1>
                      <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 10.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                        Risel Combustíveis Ltda
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Corpo com Tabela Horizontal Oficial do Sistema -->
          <div style="padding: 26px 28px 20px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
            
            <div style="background-color: #f8fafc; padding: 14px 18px; border-left: 5px solid #0d4a36; border-radius: 8px; margin-bottom: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              <p style="margin: 0; color: #1e293b; font-size: 11pt; line-height: 1.5; font-weight: 600;">
                Segue documento para aprovação: Fornecimento de combustível diesel S-10 a granel para abastecimento da frota pesada e carretas bitrem da unidade Paulínia (2ª quinzena).
              </p>
            </div>

            <!-- Tabela Horizontal Oficial (Colunas Estritas em Aptos Narrow 11) -->
            <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 22px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; min-width: 760px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
                <thead>
                  <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">STATUS</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">VENCIMENTO</th>
                    <th style="padding: 10px 10px; text-align: left; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">FORNECEDOR</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">CNPJ</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">DOC (NF)</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">FILIAL</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">CENTRO DE CUSTO</th>
                    <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #f47920; font-weight: 700; font-size: 9pt; text-transform: uppercase;">VALOR BRUTO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                      <span style="background-color: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; border: 1px solid #fde68a; display: inline-block;">
                        ⏳ AGUARDANDO
                      </span>
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: normal; color: #b91c1c;">
                      05/10/2026
                    </td>
                    <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: normal; color: #0f172a;">
                      Posto Modelo de Paulínia Comércio Ltda
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9pt; color: #475569; font-weight: normal;">
                      45.892.314/0001-82
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: normal; color: #114D38;">
                      NF-e 184920
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: normal;">
                      100 - Paulínia
                    </td>
                    <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #334155; font-weight: normal;">
                      C.C 101 - Operacional
                    </td>
                    <td style="padding: 12px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: normal; font-size: 11pt; color: #15803d;">
                      R$ 48.750,00
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Detalhes Complementares da OC -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 22px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt;">
              <tr>
                <td style="padding: 14px 18px;">
                  <p style="margin: 0; color: #64748b;"><strong style="color: #1e293b;">Ordem de Compra / Lançamento:</strong> <span style="font-family: monospace; font-weight: normal; color: #0f172a;">OC-2026-9812</span> | <strong style="color: #1e293b;">Forma de Pagto:</strong> <span style="font-weight: normal; color: #334155;">Boleto Bancário (30 DD)</span></p>
                </td>
              </tr>
            </table>





            <!-- Assinatura Oficial do Módulo -->
            ${generateEmailSignatureHtml("Sistema de Documentos Risel")}

          </div>
        </div>
      </body>
      </html>
      `,
      attachments: [
        {
          filename: "NFe_184920_Posto_Modelo.pdf",
          content: dummyPdf,
          contentType: "application/pdf"
        }
      ]
    },

    {
      moduleIndex: "8.2",
      moduleGroup: "Módulo Lançamento de Documentos",
      submodule: "Relatório Consolidado de Lançamentos Pendentes",
      fromName: "Risel Combustíveis",
      subject: "Relatório Semanal Consolidado - Lançamentos Pendentes de Pagamento",
      html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório de Pendências ERP Risel</title>
      </head>
      <body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
        <div style="max-width: 720px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); border-bottom: 4px solid #f47920; border-collapse: collapse;">
            <tr>
              <td style="padding: 22px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="54" valign="middle">
                      <img src="${RISEL_FAVICON_URL}" alt="Logo Risel" width="48" height="48" style="border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35);" />
                    </td>
                    <td valign="middle" style="padding-left: 18px;">
                      
                      <h1 style="color: #ffffff; margin: 0; font-size: 16pt; font-weight: 900; text-transform: uppercase;">
                        Relatório Consolidado de Contas a Pagar
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

          <!-- Corpo -->
          <div style="padding: 26px 28px 20px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
            <p style="margin: 0 0 16px 0; color: #334155; line-height: 1.5;">
              Prezados Administradores e Gestores, seguem para conhecimento e deliberação os lançamentos operacionais que se encontram pendentes de aprovação e vencendo nos próximos dias.
            </p>

            <!-- Cards Resumo de Indicadores -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 22px;">
              <tr>
                <td width="50%" style="padding: 16px; border-right: 1px solid #e2e8f0;">
                  <span style="color: #64748b; font-size: 10pt; font-weight: 800; text-transform: uppercase; display: block;">Total de Pendências</span>
                  <span style="color: #114D38; font-size: 18pt; font-weight: 900; display: block; margin-top: 4px;">3 lançamentos</span>
                </td>
                <td width="50%" style="padding: 16px;">
                  <span style="color: #64748b; font-size: 10pt; font-weight: 800; text-transform: uppercase; display: block;">Valor Total Acumulado</span>
                  <span style="color: #d97706; font-size: 18pt; font-weight: 900; display: block; margin-top: 4px;">R$ 84.320,00</span>
                </td>
              </tr>
            </table>

            <!-- Tabela dos Lançamentos -->
            <h3 style="margin: 0 0 8px 0; color: #114D38; font-size: 11.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Lista Detalhada de Títulos</h3>
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 10pt;">
                <thead>
                  <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
                    <th style="padding: 9px 12px; text-align: left; font-weight: 700;">VENCIMENTO</th>
                    <th style="padding: 9px 12px; text-align: left; font-weight: 700;">FORNECEDOR</th>
                    <th style="padding: 9px 12px; text-align: center; font-weight: 700;">DOC</th>
                    <th style="padding: 9px 12px; text-align: center; font-weight: 700;">STATUS</th>
                    <th style="padding: 9px 12px; text-align: right; font-weight: 700;">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 10px 12px; font-weight: normal; color: #b91c1c;">20/09/2026</td>
                    <td style="padding: 10px 12px; font-weight: normal; color: #0f172a;">Ipiranga Produtos de Petróleo S/A</td>
                    <td style="padding: 10px 12px; text-align: center; font-family: monospace; font-weight: normal;">NF 90214</td>
                    <td style="padding: 10px 12px; text-align: center;"><span style="background-color: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 8.5pt; font-weight: 600;">PENDENTE</span></td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: normal; color: #0f172a;">R$ 22.450,00</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #edf2f7; background-color: #f8fafc;">
                    <td style="padding: 10px 12px; font-weight: normal; color: #b91c1c;">22/09/2026</td>
                    <td style="padding: 10px 12px; font-weight: normal; color: #0f172a;">Michelin Pneus Brasil Ltda</td>
                    <td style="padding: 10px 12px; text-align: center; font-family: monospace; font-weight: normal;">NF 44102</td>
                    <td style="padding: 10px 12px; text-align: center;"><span style="background-color: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 8.5pt; font-weight: 600;">PENDENTE</span></td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: normal; color: #0f172a;">R$ 13.120,00</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 12px; font-weight: normal; color: #0f172a;">05/10/2026</td>
                    <td style="padding: 10px 12px; font-weight: normal; color: #0f172a;">Posto Modelo de Paulínia Comércio Ltda</td>
                    <td style="padding: 10px 12px; text-align: center; font-family: monospace; font-weight: normal;">NF 184920</td>
                    <td style="padding: 10px 12px; text-align: center;"><span style="background-color: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 8.5pt; font-weight: 600;">PENDENTE</span></td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: normal; color: #0f172a;">R$ 48.750,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Botão de Ação -->
            <div style="text-align: center; margin: 24px 0 16px 0;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                <tr>
                  <td align="center" bgcolor="#114D38" style="border-radius: 8px; background-color: #114D38;">
                    <a href="https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/documentos" target="_blank" style="font-size: 11pt; font-weight: 800; color: #ffffff !important; text-decoration: none; padding: 13px 34px; border-radius: 8px; display: inline-block; text-transform: uppercase;">
                      <span style="color: #ffffff !important;">🚀 Acessar Sistema Risel ERP</span>
                    </a>
                  </td>
                </tr>
              </table>
            </div>

            ${generateEmailSignatureHtml("Sistema de Documentos Risel")}

          </div>
        </div>
      </body>
      </html>
      `
    },

    // =========================================================================
    // MÓDULO 9: SEGURANÇA & ACESSO ERP (Remetente: "Segurança Risel")
    // =========================================================================
    {
      moduleIndex: "9.1",
      moduleGroup: "Módulo Segurança & Acessos ERP",
      submodule: "Redefinição de Senha e Recuperação de Conta",
      fromName: "Risel Combustíveis",
      subject: "Recuperação de Acesso e Redefinição de Senha - Risel Combustíveis",
      html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Redefinição de Senha - Risel ERP</title>
      </head>
      <body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
        <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); border-bottom: 4px solid #f47920; border-collapse: collapse;">
            <tr>
              <td style="padding: 22px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="54" valign="middle">
                      <img src="${RISEL_FAVICON_URL}" alt="Logo Risel" width="48" height="48" style="border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35);" />
                    </td>
                    <td valign="middle" style="padding-left: 18px;">
                      
                      <h1 style="color: #ffffff; margin: 0; font-size: 16pt; font-weight: 900; text-transform: uppercase;">
                        Redefinição de Senha
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

          <!-- Corpo -->
          <div style="padding: 26px 28px 20px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
            <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 13pt; font-weight: 800;">Olá, Deny Gonçalves!</p>
            <p style="margin: 0 0 18px 0; color: #475569; line-height: 1.55;">
              Recebemos uma solicitação para redefinição da sua senha de acesso ao <strong>Sistema Risel ERP</strong>.
            </p>

            <!-- Card de Dados da Solicitação -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 22px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 10.5pt;">
                <tr style="border-bottom: 1px dashed #e2e8f0;">
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">Conta / E-mail:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 800; text-align: right;">deny.goncalves@risel.com.br</td>
                </tr>
                <tr style="border-bottom: 1px dashed #e2e8f0;">
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">Data e Hora da Solicitação:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 800; text-align: right;">15/09/2026 às 07:50</td>
                </tr>
                <tr style="border-bottom: 1px dashed #e2e8f0;">
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">Validade do Link:</td>
                  <td style="padding: 6px 0; color: #15803d; font-weight: 800; text-align: right;">24 horas (Expiração Automática)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0 0 0; color: #64748b; font-weight: 700;">IP da Solicitação:</td>
                  <td style="padding: 6px 0 0 0; color: #0f172a; font-weight: 800; text-align: right;">189.40.122.84 (Rede Corporativa / Paulínia-SP)</td>
                </tr>
              </table>
            </div>

            <!-- Botão de Ação -->
            <div style="text-align: center; margin: 26px 0 20px 0;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                <tr>
                  <td align="center" bgcolor="#114D38" style="border-radius: 8px; background-color: #114D38; background: linear-gradient(135deg, #09392b 0%, #114D38 50%, #1d7053 100%);">
                    <a href="https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/redefinir-senha?token=risel_sec_9812_token&email=deny.goncalves%40risel.com.br" target="_blank" style="font-size: 11pt; font-weight: 800; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                      <span style="color: #ffffff !important;">🔐 REDEFINIR MINHA SENHA</span>
                    </a>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Aviso de Segurança -->
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 22px; font-size: 10pt; color: #92400e; line-height: 1.5;">
              <strong>Aviso Importante de Segurança:</strong> Caso não tenha solicitado esta alteração, desconsidere esta mensagem. Sua senha atual permanecerá totalmente protegida e inalterada.
            </div>

            ${generateEmailSignatureHtml("Segurança Risel")}

          </div>
        </div>
      </body>
      </html>
      `
    }
  ];

  console.log(`Total de e-mails mapeados e preparados para envio: ${emailTriggers.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < emailTriggers.length; i++) {
    const trigger = emailTriggers[i];
    console.log(`[${i + 1}/${emailTriggers.length}] Disparando ${trigger.moduleGroup} ➔ Submódulo ${trigger.moduleIndex}: "${trigger.submodule}"`);
    console.log(`    Remetente: "${trigger.fromName}" <${SMTP_USER}>`);
    console.log(`    Assunto: "${trigger.subject}"`);
    if (trigger.attachments) {
      console.log(`    Anexos: ${trigger.attachments.map(a => a.filename).join(", ")}`);
    }

    try {
      const info = await sendDirectEmail({
        to: TARGET_EMAIL,
        fromName: trigger.fromName,
        subject: trigger.subject,
        html: trigger.html,
        attachments: trigger.attachments
      });

      console.log(`    -> SUCESSO! Entregue ao servidor Gmail (ID: ${info.messageId})`);
      successCount++;
    } catch (err: any) {
      console.error(`    -> FALHA ao enviar "${trigger.submodule}":`, err.message);
      failCount++;
    }

    // Intervalo de segurança de 1.4s para entrega suave sem trigger de spam/rate limit no SMTP
    await new Promise(resolve => setTimeout(resolve, 1400));
  }

  console.log(`\n========================================================================`);
  console.log(`FINAL DO DISPARO DE HOMOLOGAÇÃO DE E-MAILS`);
  console.log(`Destinatário Exclusivo: ${TARGET_EMAIL}`);
  console.log(`Total de Modelos: ${emailTriggers.length}`);
  console.log(`Enviados com Sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
  console.log(`========================================================================\n`);
}

main().catch(err => {
  console.error("Erro fatal na execução do script:", err);
  process.exit(1);
});

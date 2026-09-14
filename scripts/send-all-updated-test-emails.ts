import nodemailer from "nodemailer";
import { generateLancamentoAprovacaoEmailHtml } from "../src/services/lancamentoEmailService";

const TARGET_EMAIL = "deny.goncalves@risel.com.br";

function getIconForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('status')) return '🏷️';
  if (l.includes('solicitante')) return '👤';
  if (l.includes('condutor') || l.includes('motorista')) return '🪪';
  if (l.includes('departamento') || l.includes('setor')) return '🏢';
  if (l.includes('veículo') || l.includes('veiculo') || l.includes('placa')) return '🚗';
  if (l.includes('saída') || l.includes('saida') || l.includes('retirada')) return '📅';
  if (l.includes('retorno') || l.includes('devolução') || l.includes('devolucao')) return '🔄';
  if (l.includes('destino') || l.includes('trajeto') || l.includes('cidade')) return '📍';
  if (l.includes('distância') || l.includes('distancia') || l.includes('km')) return '🛣️';
  if (l.includes('motivo') || l.includes('finalidade') || l.includes('serviço') || l.includes('servico') || l.includes('propósito')) return '📝';
  if (l.includes('rodízio') || l.includes('rodizio')) return '⛔';
  if (l.includes('tanque') || l.includes('combustível') || l.includes('combustivel')) return '⛽';
  if (l.includes('odômetro') || l.includes('odometro') || l.includes('km inicial') || l.includes('km final')) return '📟';
  if (l.includes('observ') || l.includes('parecer') || l.includes('despacho') || l.includes('recusa')) return '💬';
  if (l.includes('protocolo') || l.includes('reserva') || l.includes('localizador')) return '🎫';
  if (l.includes('locadora')) return '🏬';
  if (l.includes('valor') || l.includes('custo')) return '💰';
  return '📌';
}

function generateReservationEmailHtml(
  title: string,
  details: { label: string; value: string }[],
  highlightColor: string = '#114D38',
  actionLink?: string,
  introText?: string,
  footerText?: string
): string {
  const subtitleUpper = (title && title.toUpperCase().includes('RISEL')) 
    ? title.toUpperCase() 
    : (title ? title.toUpperCase() : 'DETALHES DA SOLICITAÇÃO');

  const rows = details.map((d, index) => {
    const icon = getIconForLabel(d.label);
    const isEven = index % 2 === 0;
    const isStatus = d.label.toLowerCase().includes('status');
    const isApproved = isStatus && (d.value.toLowerCase().includes('aprovad') || d.value.includes('✅') || d.value.includes('EM TRÂNSITO') || d.value.includes('CONCLUÍDA'));
    const isPending = isStatus && (d.value.toLowerCase().includes('pendente') || d.value.toLowerCase().includes('aguardando') || d.value.includes('⏳') || d.value.includes('SOLICITADA'));
    const isRejected = isStatus && (d.value.toLowerCase().includes('rejeitad') || d.value.toLowerCase().includes('recusad') || d.value.toLowerCase().includes('cancelad') || d.value.includes('❌') || d.value.includes('🚫'));

    let valueDisplay = d.value;
    if (isApproved) {
      valueDisplay = `<span style="background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 11pt; display: inline-block; border: 1px solid #bbf7d0;">${d.value}</span>`;
    } else if (isPending) {
      valueDisplay = `<span style="background-color: #fef3c7; color: #b45309; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 11pt; display: inline-block; border: 1px solid #fde68a;">${d.value}</span>`;
    } else if (isRejected) {
      valueDisplay = `<span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 11pt; display: inline-block; border: 1px solid #fecaca;">${d.value}</span>`;
    } else {
      valueDisplay = `<span style="color: #0f172a; font-weight: 700; font-size: 11pt;">${d.value}</span>`;
    }

    return `
      <tr style="background-color: ${isEven ? '#ffffff' : '#ffffff'}; border-bottom: 1px solid #edf2f7;">
        <td style="padding: 12px 16px; border-bottom: 1px solid #edf2f7; background-color: #f8fafc; color: #334155; font-weight: 700; width: 38%; font-size: 11pt; vertical-align: middle; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <span style="margin-right: 8px; font-size: 13pt;">${icon}</span><span style="color: #1e293b;">${d.label}</span>
        </td>
        <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; color: #0f172a; font-size: 11pt; vertical-align: middle; font-weight: 600; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${valueDisplay}
        </td>
      </tr>
    `;
  }).join('');

  const buttonHtml = actionLink ? `
    <div style="text-align: center; margin-top: 28px; margin-bottom: 16px;">
      <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
        <tr>
          <td align="center" bgcolor="#114D38" style="border-radius: 8px; background-color: #114D38; background: linear-gradient(135deg, #09392b 0%, #114D38 50%, #1d7053 100%);">
            <a href="${actionLink}" target="_blank" style="font-size: 11.5pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-weight: 800; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #114D38;">
              <span style="color: #ffffff !important;">🚀 Acessar Sistema Risel</span>
            </a>
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  const introHtml = introText ? `
    <div style="background-color: #f0fdf4; padding: 14px 18px; border-left: 5px solid #16a34a; border-radius: 8px; margin-bottom: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <p style="color: #166534; font-size: 11pt; line-height: 1.5; margin: 0; font-weight: 600;">${introText}</p>
    </div>
  ` : '';

  const footerHtml = footerText ? `
    <div style="background-color: #fffbeb; border-left: 5px solid #f59e0b; color: #92400e; padding: 14px 18px; border-radius: 8px; margin-top: 22px; font-size: 11pt; line-height: 1.5; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <strong style="display: block; margin-bottom: 4px; font-size: 11pt; color: #b45309;">⚠️ Atenção & Recomendações:</strong>
      ${footerText}
    </div>
  ` : '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
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
  <body style="background-color: #f1f5f9; padding: 24px 12px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      
      <!-- Cabeçalho Oficial Risel -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
        <tr>
          <td bgcolor="#09392b" style="padding: 22px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <tr>
                <td width="54" valign="middle" style="width: 54px; vertical-align: middle;">
                  <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.35); object-fit: cover;" />
                </td>
                <td valign="middle" style="padding-left: 18px; vertical-align: middle;">
                  <h1 style="color: #ffffff !important; margin: 0; font-size: 16pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">${subtitleUpper}</h1>
                  <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 10.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Risel Combustíveis Ltda • Gestão de Frotas & Reservas</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Conteúdo Interno -->
      <div style="padding: 26px 28px 22px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
        
        ${introHtml}

        <!-- Tabela Estruturada de Informações -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 8px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <thead>
            <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
              <th style="padding: 10px 16px; text-align: left; font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f47920; width: 38%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">INFORMAÇÃO</th>
              <th style="padding: 10px 18px; text-align: left; font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f47920; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">DETALHAMENTO</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        ${footerHtml}

        ${buttonHtml}

        <!-- Rodapé do E-mail -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; text-align: center; color: #64748b; font-size: 9.5pt; line-height: 1.5; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <p style="margin: 0;">Mensagem automática gerada pelo <strong>Sistema de Gestão de Reservas • Risel Combustíveis</strong>.</p>
          <p style="margin: 3px 0 0 0;">Paulínia/SP • Brasil</p>
        </div>

      </div>
    </div>
  </body>
  </html>
  `;
}

async function sendDirectEmail(to: string, subject: string, html: string, attachments?: any[]) {
  const host = "smtp.gmail.com";
  const port = 465;
  const secure = true;
  const user = "gestaodefrotarisel@gmail.com";
  const pass = "aeczbopvnpocoezw";
  const fromName = "Gestão Risel ERP";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  return await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    html,
    attachments
  });
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`DISPARANDO TESTES DE E-MAIL OFICIAIS PARA: ${TARGET_EMAIL}`);
  console.log(`======================================================\n`);

  // Anexo de teste para o Lançamento de Documentos
  const dummyPdfBase64 = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
  ).toString("base64");

  const triggers = [
    // 1. GESTÃO DE RESERVAS: Nova Solicitação (Notificação Interna para Administradores)
    {
      name: "1. [Reservas] Nova Solicitação de Reserva de Veículo",
      subject: "Nova Solicitação de Reserva de Veículo - Rodrigo Albuquerque",
      html: generateReservationEmailHtml(
        "Nova Solicitação de Reserva de Veículo",
        [
          { label: "Status", value: "⏳ PENDENTE DE APROVAÇÃO" },
          { label: "Solicitante", value: "Rodrigo Albuquerque" },
          { label: "Condutor", value: "Rodrigo Albuquerque" },
          { label: "Departamento", value: "Operações & Logística" },
          { label: "Veículo Sugerido", value: "Toyota Hilux - BRA2E19" },
          { label: "Data de Saída", value: "25/09/2026 08:00" },
          { label: "Retorno Previsto", value: "26/09/2026 18:00" },
          { label: "Destino", value: "Ribeirão Preto/SP - Base Distribuidora" },
          { label: "Distância Estimada", value: "320 km" },
          { label: "Motivo / Finalidade", value: "Supervisão técnica de descarregamento e auditoria em base parceira." }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas',
        "Uma nova solicitação de reserva de veículo foi registrada por Rodrigo Albuquerque e aguarda análise da Gestão de Frota."
      )
    },

    // 2. GESTÃO DE RESERVAS: Aprovação de Reserva (Para Solicitante e Admins)
    {
      name: "2. [Reservas] Solicitação de Reserva Aprovada",
      subject: "Sua Solicitação de Reserva para o dia 25/09/2026 foi Aprovada",
      html: generateReservationEmailHtml(
        "Solicitação de Reserva Aprovada",
        [
          { label: "Status", value: "✅ APROVADA" },
          { label: "Solicitante", value: "Rodrigo Albuquerque" },
          { label: "Condutor", value: "Rodrigo Albuquerque" },
          { label: "Departamento", value: "Operações & Logística" },
          { label: "Veículo Aprovado", value: "Toyota Hilux - BRA2E19" },
          { label: "Data de Saída", value: "25/09/2026 08:00" },
          { label: "Retorno Previsto", value: "26/09/2026 18:00" },
          { label: "Destino", value: "Ribeirão Preto/SP - Base Distribuidora" },
          { label: "Distância Estimada", value: "320 km" },
          { label: "Motivo / Finalidade", value: "Supervisão técnica de descarregamento e auditoria em base parceira." },
          { label: "Observações da Administração", value: "Veículo revisado e liberado com chave na portaria principal." }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas',
        "Prezado(a) Rodrigo Albuquerque, informamos que sua solicitação de reserva de veículo da frota Risel foi aprovada com sucesso.",
        "Orientamos realizar o checklist antes de sair. Lembre-se de devolver o veículo abastecido e preencher a KM Final e Diário de Bordo ao retornar."
      )
    },

    // 3. GESTÃO DE RESERVAS: Recusa de Reserva (Para Solicitante e Admins)
    {
      name: "3. [Reservas] Solicitação de Reserva Recusada",
      subject: "Solicitação de Reserva Recusada - Mariana Silveira",
      html: generateReservationEmailHtml(
        "Solicitação de Reserva Recusada",
        [
          { label: "Status", value: "❌ RECUSADA" },
          { label: "Solicitante", value: "Mariana Silveira" },
          { label: "Condutor", value: "Mariana Silveira" },
          { label: "Departamento", value: "Comercial" },
          { label: "Veículo Solicitado", value: "Fiat Strada - RIS1020" },
          { label: "Data de Saída", value: "28/09/2026 09:00" },
          { label: "Retorno Previsto", value: "28/09/2026 17:00" },
          { label: "Destino", value: "Campinas/SP - Reunião Cliente" },
          { label: "Motivo da Solicitação", value: "Visita comercial externa" },
          { label: "Motivo da Recusa", value: "Veículo agendado para manutenção preventiva de 40.000 km na concessionária nesta data." }
        ],
        '#dc2626',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas',
        "Prezado(a) Mariana Silveira, informamos que sua solicitação de reserva não pôde ser aprovada pela Gestão de Frota.",
        "Motivo da Recusa / Parecer da Administração: Veículo agendado para manutenção preventiva de 40.000 km na concessionária nesta data. Sugerimos reagendar ou solicitar veículo terceirizado (RAC)."
      )
    },

    // 4. GESTÃO DE RESERVAS: Início de Uso Diário / Checklist
    {
      name: "4. [Reservas] Início de Uso Diário do Veículo",
      subject: "Início de Uso Diário - Veículo BRA2E19 - Rodrigo Albuquerque",
      html: generateReservationEmailHtml(
        "Início de Uso Diário do Veículo",
        [
          { label: "Status", value: "🚗 EM TRÂNSITO / EM USO" },
          { label: "Condutor", value: "Rodrigo Albuquerque" },
          { label: "Veículo", value: "Toyota Hilux - Placa: BRA2E19" },
          { label: "Data/Hora de Saída", value: "25/09/2026 08:15" },
          { label: "KM Inicial", value: "45.210 km" },
          { label: "Nível do Tanque", value: "⛽ Cheio (100%)" },
          { label: "Destino Previsto", value: "Ribeirão Preto/SP" },
          { label: "Checklist Realizado", value: "✅ Conforme (Pneus, Óleo, Documentos e Lanternas OK)" }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas',
        "O condutor Rodrigo Albuquerque realizou a retirada do veículo e iniciou a viagem corporativa.",
        "Dirija com segurança e respeite os limites de velocidade nas rodovias."
      )
    },

    // 5. GESTÃO DE RESERVAS: Fim de Uso Diário / Devolução
    {
      name: "5. [Reservas] Devolução e Diário de Bordo Concluído",
      subject: "Devolução de Veículo Concluída - BRA2E19 - Rodrigo Albuquerque",
      html: generateReservationEmailHtml(
        "Devolução de Veículo Concluída",
        [
          { label: "Status", value: "✅ CONCLUÍDA / VEÍCULO DEVOLVIDO" },
          { label: "Condutor", value: "Rodrigo Albuquerque" },
          { label: "Veículo", value: "Toyota Hilux - Placa: BRA2E19" },
          { label: "Data/Hora de Devolução", value: "26/09/2026 17:45" },
          { label: "KM Inicial", value: "45.210 km" },
          { label: "KM Final", value: "45.542 km" },
          { label: "Distância Percorrida", value: "🛣️ 332 km rodados" },
          { label: "Nível de Devolução", value: "⛽ Tanque Cheio" },
          { label: "Ocorrências Registradas", value: "Nenhuma ocorrência ou avaria registrada." }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/reservas',
        "A devolução do veículo foi registrada no sistema com sucesso.",
        "O veículo já se encontra disponível para novas reservas no pátio da Matriz Paulínia."
      )
    },

    // 6. SOLICITAÇÃO RAC: Nova Solicitação Terceirizada com CNH Anexa (Para Admins)
    {
      name: "6. [RAC] Nova Solicitação de Locação RAC com CNH Anexa",
      subject: "[Solicitação RAC] RAC-20260925-9120 - Carlos Mendes (Paulínia ➔ Santos)",
      html: generateReservationEmailHtml(
        "Solicitação de Locação RAC (Veículo Terceirizado)",
        [
          { label: "Status", value: "⏳ SOLICITADA (Aguardando Cotação RAC)" },
          { label: "Protocolo", value: "RAC-20260925-9120" },
          { label: "Solicitante", value: "Carlos Mendes" },
          { label: "Condutor", value: "Carlos Mendes" },
          { label: "Setor / Cargo", value: "Operações / Coordenador de Logística" },
          { label: "Trajeto Solicitado", value: "Paulínia/SP ➔ Santos/SP" },
          { label: "Data de Retirada", value: "01/10/2026 08:00" },
          { label: "Data de Devolução", value: "03/10/2026 18:00" },
          { label: "Motivo / Justificativa", value: "Atendimento emergencial de operação portuária no Porto de Santos." },
          { label: "Documento Anexo", value: "📎 CNH_Carlos_Mendes.pdf (Anexada)" }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac',
        "Uma nova solicitação de locação RAC foi registrada no sistema e a CNH do condutor foi devidamente anexada para abertura na locadora parceira.",
        "Providenciar cotação na locadora parceira (Localiza / Movida / Unidas) e emitir o voucher de reserva."
      ),
      attachments: [
        {
          filename: "CNH_Carlos_Mendes.pdf",
          content: dummyPdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ]
    },

    // 7. SOLICITAÇÃO RAC: Retorno de Aprovação com Voucher Anexo (Para Solicitante)
    {
      name: "7. [RAC] Retorno de Aprovação RAC com Voucher Anexo",
      subject: "[Solicitação RAC APROVADA] RAC-20260925-9120 - Carlos Mendes",
      html: generateReservationEmailHtml(
        "Locação RAC Aprovada & Confirmada",
        [
          { label: "Status", value: "✅ APROVADA / VOUCHER EMITIDO" },
          { label: "Protocolo", value: "RAC-20260925-9120" },
          { label: "Solicitante / Condutor", value: "Carlos Mendes" },
          { label: "Locadora Contratada", value: "Localiza Rent a Car" },
          { label: "Localizador / Reserva", value: "LOC-778921" },
          { label: "Loja de Retirada", value: "Localiza Campinas Norte (Av. Barão de Itapura)" },
          { label: "Data de Retirada", value: "01/10/2026 08:00" },
          { label: "Data de Devolução", value: "03/10/2026 18:00" },
          { label: "Valor Contratado", value: "R$ 540,00 (Total 3 diárias com seguro completo)" },
          { label: "Instruções ao Condutor", value: "Apresentar CNH original e documento com foto no balcão da locadora. O voucher segue anexo." }
        ],
        '#114D38',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac',
        "Prezado(a) Carlos Mendes, sua solicitação de locação RAC foi aprovada e confirmada pela Gestão de Frota.",
        "O voucher da locadora está em anexo. Lembre-se de devolver o veículo com o tanque abastecido para evitar encargos adicionais da locadora."
      ),
      attachments: [
        {
          filename: "Voucher_Localiza_RAC_20260925_9120.pdf",
          content: dummyPdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ]
    },

    // 8. SOLICITAÇÃO RAC: Retorno de Recusa com Justificativa (Para Solicitante)
    {
      name: "8. [RAC] Retorno de Recusa RAC com Justificativa",
      subject: "[Solicitação RAC RECUSADA] RAC-20260925-4411 - Lucas Ferreira",
      html: generateReservationEmailHtml(
        "Solicitação de Locação RAC Recusada",
        [
          { label: "Status", value: "❌ RECUSADA" },
          { label: "Protocolo", value: "RAC-20260925-4411" },
          { label: "Solicitante", value: "Lucas Ferreira" },
          { label: "Setor", value: "Marketing" },
          { label: "Trajeto Solicitado", value: "Paulínia/SP ➔ São Paulo/SP" },
          { label: "Motivo Original", value: "Deslocamento para evento corporativo" },
          { label: "Motivo da Recusa", value: "Disponibilidade de veículo da frota interna na mesma data. Por favor, utilize a reserva de frota própria." }
        ],
        '#dc2626',
        'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/#/rac',
        "Prezado(a) Lucas Ferreira, informamos que sua solicitação de locação RAC não foi aprovada pela Gestão de Frota.",
        "Parecer da Administração: Há veículo disponível na frota própria interna da Risel para a mesma data e trajeto. Orientamos realizar a solicitação pela Frota Interna."
      )
    },

    // 9. LANÇAMENTO DE DOCUMENTOS: Solicitação de Aprovação (Tabela Horizontal, Aptos Narrow 11, Anexo Original)
    {
      name: "9. [Lançamentos] Aprovação de Documento (Tabela Horizontal + Aptos Narrow 11 + Anexo Original)",
      ...generateLancamentoAprovacaoEmailHtml({
        fornecedor: "Posto Modelo de Paulínia Comércio de Combustíveis Ltda",
        descricao: "Fornecimento de combustível diesel S-10 a granel para abastecimento da frota de carretas bitrem da unidade Paulínia, referente à 2ª quinzena.",
        valor: "R$ 48.750,00",
        dataVencimento: "2026-10-05",
        dataEmissao: "2026-09-20",
        cnpj: "45.892.314/0001-82",
        doc: "184920",
        tipoDocumento: "NF-e",
        formaPagamento: "Boleto Bancário (30 DD)",
        frequencia: "Mensal",
        estabelecimento: "100 - Paulínia Matriz",
        centroCusto: "C.C 101 - Operacional Frotas",
        aprovadores: "Deny e Diretoria Executiva",
        status: "Aguardando aprovação",
        lancadoPor: "Lorena Padilha",
        codLancamentoOc: "OC-2026-9812",
        observacao: "Fatura validada com medição do tanque central e notas de abastecimento assinadas.",
        nomeArquivoAnexo: "NFe_184920_Posto_Modelo_Paulinea.pdf",
        arquivoAnexoBase64: dummyPdfBase64
      }),
      attachments: [
        {
          filename: "NFe_184920_Posto_Modelo_Paulinea.pdf",
          content: dummyPdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ]
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    console.log(`[${i + 1}/${triggers.length}] Enviando para ${TARGET_EMAIL}: "${trigger.name}"...`);

    try {
      const info = await sendDirectEmail(TARGET_EMAIL, trigger.subject, trigger.html, trigger.attachments);
      console.log(`  -> SUCESSO! Message ID: ${info.messageId}`);
      successCount++;
    } catch (err: any) {
      console.error(`  -> ERRO ao enviar "${trigger.name}":`, err.message);
      failCount++;
    }

    // Intervalo de 1.2s para garantir entrega suave no servidor SMTP
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\n======================================================`);
  console.log(`RESULTADO DO DISPARO DE TESTES:`);
  console.log(`Destinatário: ${TARGET_EMAIL}`);
  console.log(`Total de Modelos: ${triggers.length}`);
  console.log(`Enviados com Sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
  console.log(`======================================================\n`);
}

run().catch(e => {
  console.error("Erro fatal no script de disparo:", e);
  process.exit(1);
});

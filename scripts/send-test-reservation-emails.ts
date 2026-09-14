import nodemailer from "nodemailer";

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

function generateEmailHtml(
  title: string,
  details: { label: string; value: string }[],
  highlightColor: string = '#114D38',
  actionLink?: string,
  introText?: string,
  footerText?: string,
  borderColor: string = '#e2e8f0',
  mapImageUrl?: string
): string {
  const subtitleUpper = (title && title.toUpperCase().includes('RISEL')) 
    ? title.toUpperCase() 
    : (title ? title.toUpperCase() : 'DETALHES DA SOLICITAÇÃO');

  const rows = details.map((d, index) => {
    const icon = getIconForLabel(d.label);
    const isEven = index % 2 === 0;
    const isStatus = d.label.toLowerCase().includes('status');
    const isApproved = isStatus && (d.value.toLowerCase().includes('aprovad') || d.value.includes('✅') || d.value.includes('EM TRÂNSITO') || d.value.includes('CONCLUÍDA'));
    const isPending = isStatus && (d.value.toLowerCase().includes('pendente') || d.value.toLowerCase().includes('aguardando') || d.value.includes('⏳'));
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
      body, table, td, p, h1, h2, h3, div, span, strong, a, li, b { 
        font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
        font-size: 11pt;
      }
      body { 
        background-color: #f1f5f9; 
        margin: 0; 
        padding: 0; 
        -webkit-font-smoothing: antialiased;
      }
    </style>
  </head>
  <body style="background-color: #f1f5f9; padding: 20px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
    <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      
      <!-- Header Corporativo Risel -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#114D38" style="background-color: #114D38; background: linear-gradient(135deg, #09392b 0%, #114D38 50%, #1d7053 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
        <tr>
          <td bgcolor="#114D38" style="padding: 24px 24px 20px 24px; text-align: center;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <tr>
                <td align="center" style="text-align: center;">
                  <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto; border-collapse: collapse;">
                    <tr>
                      <td valign="middle" style="padding-right: 14px;">
                        <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.3); object-fit: cover;" />
                      </td>
                      <td valign="middle" style="text-align: left;">
                        <h1 style="color: #f59e0b !important; margin: 0; font-size: 19pt; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.1;">RISEL COMBUSTÍVEIS</h1>
                        <p style="color: #fde047 !important; margin: 4px 0 0 0; font-size: 11pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${subtitleUpper}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Conteúdo Principal -->
      <div style="padding: 28px 24px 24px 24px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        ${introHtml}

        <!-- Tabela Estruturada de Detalhes -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <tbody>
            ${rows}
          </tbody>
        </table>

        ${footerHtml}
        ${buttonHtml}
      </div>

      <!-- Rodapé Institucional -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <p style="margin: 0; color: #475569; font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          Risel Combustíveis • Gestão de Frotas & Reservas
        </p>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 9.5pt;">
          Esta é uma notificação automática emitida em conformidade com as diretrizes operacionais.
        </p>
      </div>

    </div>
  </body>
  </html>
  `;
}

async function sendTestEmail(subject: string, html: string) {
  const response = await fetch("http://localhost:3000/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: TARGET_EMAIL,
      subject: subject,
      html: html,
      fromName: "Gestão de Reservas Risel",
      source: "reservas"
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`[RISEL] INICIANDO DISPARO DE TESTES DE GESTÃO DE RESERVAS`);
  console.log(`Destinatário Exclusivo: ${TARGET_EMAIL}`);
  console.log(`Endpoint: http://localhost:3000/api/send-email`);
  console.log(`======================================================\n`);

  const triggers = [
    {
      name: "Gatilho 1: Nova Solicitação de Reserva de Veículo",
      subject: "Nova Solicitação de Reserva de Veículo - Carlos Eduardo Silva",
      title: "Detalhes da Solicitação",
      details: [
        { label: "Status", value: "⏳ PENDENTE DE APROVAÇÃO" },
        { label: "Solicitante", value: "Carlos Eduardo Silva" },
        { label: "Condutor", value: "Carlos Eduardo Silva" },
        { label: "Departamento", value: "Operações & Logística" },
        { label: "Veículo Sugerido", value: "Fiat Strada Endurance - Placa GHI-9012" },
        { label: "Data de Saída", value: "22/09/2026 08:00" },
        { label: "Retorno Previsto", value: "24/09/2026 18:00" },
        { label: "Destino", value: "Ribeirão Preto/SP - Visita Técnica e Auditoria de Postos" },
        { label: "Distância Estimada", value: "460 km" },
        { label: "Motivo", value: "Alinhamento operacional com gerentes de pista e inspeção de conformidade das bombas" },
        { label: "Rodízio SP Capital", value: "Liberado (Final 2)" }
      ],
      intro: "Uma nova solicitação de reserva de veículo foi registrada no sistema e aguarda análise da Gestão de Frota.",
      footer: "A liberação da chave e retirada do veículo está condicionada à aprovação formal da administração.",
      actionLink: "https://risel-combustiveis.web.app/reservas"
    },
    {
      name: "Gatilho 2: Solicitação de Reserva Aprovada",
      subject: "Solicitação de Reserva Aprovada - Carlos Eduardo Silva",
      title: "Solicitação de Reserva Aprovada",
      details: [
        { label: "Status", value: "✅ APROVADA" },
        { label: "Solicitante", value: "Carlos Eduardo Silva" },
        { label: "Condutor", value: "Carlos Eduardo Silva" },
        { label: "Departamento", value: "Operações & Logística" },
        { label: "Veículo Aprovado", value: "Fiat Strada Endurance - Placa GHI-9012" },
        { label: "Data de Saída", value: "22/09/2026 08:00" },
        { label: "Retorno Previsto", value: "24/09/2026 18:00" },
        { label: "Destino", value: "Ribeirão Preto/SP - Visita Técnica e Auditoria de Postos" },
        { label: "Distância Estimada", value: "460 km" },
        { label: "Motivo / Finalidade", value: "Alinhamento operacional com gerentes de pista" },
        { label: "Observações da Administração", value: "Veículo liberado na vaga 04 da Matriz com tanque cheio. Realizar checklist antes da saída." }
      ],
      intro: "Prezado(a) Carlos Eduardo Silva, informamos que sua solicitação de reserva de veículo da frota Risel foi aprovada com sucesso.",
      footer: "Orientamos realizar o checklist antes de sair. Lembre-se de devolver o veículo abastecido e preencher a KM Final e Diário de Bordo ao retornar.",
      actionLink: "https://risel-combustiveis.web.app/reservas"
    },
    {
      name: "Gatilho 3: Solicitação de Reserva Recusada / Rejeitada",
      subject: "Solicitação de Reserva Recusada - Mariana Souza Rocha",
      title: "Solicitação de Reserva Recusada",
      details: [
        { label: "Status", value: "❌ RECUSADA" },
        { label: "Solicitante", value: "Mariana Souza Rocha" },
        { label: "Condutor", value: "Mariana Souza Rocha" },
        { label: "Departamento", value: "Comercial & Novos Negócios" },
        { label: "Veículo Solicitado", value: "Chevrolet Onix Plus - Placa DEF-5678" },
        { label: "Data de Saída", value: "25/09/2026 09:00" },
        { label: "Retorno Previsto", value: "25/09/2026 19:00" },
        { label: "Destino", value: "Santos/SP - Reunião com Cliente Estratégico" },
        { label: "Motivo da Solicitação", value: "Apresentação comercial e assinatura de contrato de fornecimento" },
        { label: "Motivo da Recusa", value: "Veículo já alocado para diretoria institucional no período solicitado. Sugerimos solicitar locação RAC ou reagendar." }
      ],
      intro: "Prezado(a) Mariana Souza Rocha, informamos que sua solicitação de reserva não pôde ser aprovada pela Gestão de Frota.",
      footer: "Caso a viagem seja inadiável, abra uma solicitação no módulo RAC (Veículo Terceirizado) para cotação imediata em locadora parceira.",
      actionLink: "https://risel-combustiveis.web.app/reservas"
    },
    {
      name: "Gatilho 4: Solicitação de Reserva Cancelada",
      subject: "Reserva Cancelada - Roberto Mendes",
      title: "Solicitação de Reserva Cancelada",
      details: [
        { label: "Status", value: "🚫 CANCELADA" },
        { label: "Solicitante", value: "Roberto Mendes" },
        { label: "Condutor", value: "Roberto Mendes" },
        { label: "Departamento", value: "Manutenção Industrial" },
        { label: "Veículo", value: "Volkswagen Saveiro - Placa JKL-3456" },
        { label: "Data de Saída Prevista", value: "28/09/2026 07:30" },
        { label: "Retorno Previsto", value: "28/09/2026 17:00" },
        { label: "Destino", value: "Campinas/SP - Manutenção Preventiva em Unidade" },
        { label: "Motivo Original", value: "Deslocamento técnico para reparo de compressores de ar" },
        { label: "Situação", value: "Reserva cancelada no sistema a pedido do colaborador devido a reagendamento com fornecedor." }
      ],
      intro: "Prezado(a) Roberto Mendes, informamos que sua reserva de veículo foi cancelada com sucesso no sistema de frota.",
      footer: "Caso necessite de um veículo para uma nova data, realize uma nova solicitação diretamente pelo painel.",
      actionLink: "https://risel-combustiveis.web.app/reservas"
    },
    {
      name: "Gatilho 5: Atualização de Reserva de Veículo",
      subject: "Atualização de Reserva - Juliana Ferreira",
      title: "Atualização de Reserva de Veículo",
      details: [
        { label: "Status", value: "✅ APROVADA / ATUALIZADA" },
        { label: "Solicitante", value: "Juliana Ferreira" },
        { label: "Condutor", value: "Lucas Albuquerque" },
        { label: "Departamento", value: "Recursos Humanos & DHO" },
        { label: "Veículo", value: "Toyota Yaris Sedan - Placa MNO-7890" },
        { label: "Data de Saída", value: "30/09/2026 08:30" },
        { label: "Retorno Previsto", value: "02/10/2026 18:00" },
        { label: "Destino", value: "São José dos Campos/SP - Treinamento de Equipes" },
        { label: "Motivo / Finalidade", value: "Integração e capacitação de novos líderes de filial" },
        { label: "Observações da Administração", value: "Alteração de condutor realizada conforme autorização do gestor da área." }
      ],
      intro: "Prezado(a) Juliana Ferreira, sua reserva de veículo foi atualizada pela Gestão de Frota Risel.",
      footer: "O novo condutor registrado está habilitado para a retirada da chave na portaria da matriz.",
      actionLink: "https://risel-combustiveis.web.app/reservas"
    },
    {
      name: "Gatilho 6: Início de Uso Diário (Saída do Veículo)",
      subject: "Início de Uso Diário - Anderson Lima",
      title: "Início de Uso Diário",
      details: [
        { label: "Status", value: "🚀 VEÍCULO EM TRÂNSITO" },
        { label: "Condutor", value: "Anderson Lima" },
        { label: "Departamento", value: "Manutenção & Instalações" },
        { label: "Veículo", value: "Renault Kangoo Express - Placa PQR-1234" },
        { label: "Data de Saída", value: "15/09/2026 07:45" },
        { label: "Destino", value: "Paulínia/SP - Atendimento Preventivo Base 02" },
        { label: "Odômetro Inicial", value: "48.250 km" },
        { label: "Distância Estimada", value: "35 km" },
        { label: "Nível Tanque", value: "Cheio (100%)" },
        { label: "Motivo / Serviço", value: "Troca de filtros e calibração de sensores na base operacional" }
      ],
      intro: "Informamos que o condutor Anderson Lima registrou a saída do veículo PQR-1234 para atendimento em Paulínia/SP.",
      footer: "Lembre-se de conduzir respeitando as leis de trânsito e preencher a KM Final e Diário de Bordo no retorno.",
      actionLink: "https://risel-combustiveis.web.app/uso-diario"
    },
    {
      name: "Gatilho 7: Fim de Uso Diário (Retorno do Veículo / Check-out)",
      subject: "Fim de Uso Diário - Anderson Lima",
      title: "Fim de Uso Diário",
      details: [
        { label: "Status", value: "🏁 CONCLUÍDA / RETORNO REALIZADO" },
        { label: "Condutor", value: "Anderson Lima" },
        { label: "Departamento", value: "Manutenção & Instalações" },
        { label: "Veículo", value: "Renault Kangoo Express - Placa PQR-1234" },
        { label: "Data de Saída", value: "15/09/2026 07:45" },
        { label: "Data de Retorno", value: "15/09/2026 16:30" },
        { label: "Destino Percorrido", value: "Paulínia/SP - Atendimento Preventivo Base 02" },
        { label: "Odômetro Inicial", value: "48.250 km" },
        { label: "Odômetro Final", value: "48.312 km" },
        { label: "Distância Percorrida", value: "62 km" },
        { label: "Nível Tanque (Chegada)", value: "3/4" },
        { label: "Motivo / Serviço", value: "Atendimento preventivo concluído sem intercorrências" }
      ],
      intro: "O condutor Anderson Lima registrou a devolução do veículo PQR-1234 e a rota foi finalizada.",
      footer: "O odômetro e status do veículo foram atualizados automaticamente no sistema Risel.",
      actionLink: "https://risel-combustiveis.web.app/uso-diario"
    },
    {
      name: "Gatilho 8: Solicitação de Locação RAC (Veículo Terceirizado)",
      subject: "[Solicitação RAC] RAC-20260915-8492 - Rodrigo Albuquerque (Paulínia/SP ➔ São José dos Campos/SP)",
      title: "SOLICITAÇÃO DE LOCAÇÃO RAC",
      details: [
        { label: "Status", value: "⏳ EM ANÁLISE PELA GESTÃO" },
        { label: "Protocolo", value: "RAC-20260915-8492" },
        { label: "Solicitante", value: "Rodrigo Albuquerque" },
        { label: "Condutor Principal", value: "Rodrigo Albuquerque" },
        { label: "Departamento", value: "Gerência Comercial" },
        { label: "Categoria Sugerida", value: "Sedan Executivo (Grupo C)" },
        { label: "Data de Retirada", value: "05/10/2026 08:00" },
        { label: "Data de Devolução", value: "09/10/2026 18:00" },
        { label: "Duração Estimada", value: "5 dia(s) (5 diárias)" },
        { label: "Cidade de Retirada", value: "Paulínia/SP" },
        { label: "Cidade de Devolução", value: "Paulínia/SP" },
        { label: "Motivo / Destino", value: "Rodada de negociações comerciais com redes de postos no Vale do Paraíba" },
        { label: "Situação da CNH", value: "✅ CNH Digital Regularizada em Arquivo Ativo" }
      ],
      intro: "Novo pedido de veículo terceirizado registrado na fila operacional para cotação na rede de locadoras parceiras.",
      footer: "A equipe de suprimentos e frotas procederá com a cotação e emissão do voucher de retirada.",
      actionLink: "https://risel-combustiveis.web.app/rac"
    },
    {
      name: "Gatilho 9: Locação RAC Aprovada / Confirmação da Reserva",
      subject: "[RAC APROVADA] RAC-20260915-8492 - Rodrigo Albuquerque - Localiza (Reserva LOC-9823471)",
      title: "LOCAÇÃO RAC APROVADA",
      details: [
        { label: "Status", value: "✅ RESERVA CONFIRMADA / AGUARDANDO RETIRADA" },
        { label: "Protocolo", value: "RAC-20260915-8492" },
        { label: "Solicitante / Condutor", value: "Rodrigo Albuquerque" },
        { label: "Departamento", value: "Gerência Comercial" },
        { label: "Locadora Parceira", value: "Localiza Rent a Car" },
        { label: "Nº Reserva / Localizador", value: "LOC-9823471" },
        { label: "Loja de Retirada", value: "Localiza Campinas Shopping (Av. Jacy Teixeira de Camargo, 940)" },
        { label: "Data de Retirada", value: "05/10/2026 08:00" },
        { label: "Data de Devolução", value: "09/10/2026 18:00" },
        { label: "Custo Contratado", value: "R$ 890,00 (Total 5 diárias com seguro incluso)" },
        { label: "Observações da Administração", value: "Voucher liberado. Apresentar documento com foto e CNH original no balcão da locadora." }
      ],
      intro: "Prezado(a) Rodrigo Albuquerque, sua locação de veículo terceirizado (RAC) foi aprovada e confirmada na locadora parceira.",
      footer: "O voucher de reserva está emitido. Lembre-se de abastecer o veículo antes de devolver na locadora para evitar taxas extras.",
      actionLink: "https://risel-combustiveis.web.app/rac"
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    console.log(`[${i + 1}/${triggers.length}] Enviando: "${trigger.name}"...`);

    const html = generateEmailHtml(
      trigger.title,
      trigger.details,
      '#114D38',
      trigger.actionLink,
      trigger.intro,
      trigger.footer
    );

    try {
      const info = await sendTestEmail(trigger.subject, html);
      console.log(`  -> SUCESSO! Provedor: ${info.provider || 'API Backend'}`);
      successCount++;
    } catch (err: any) {
      console.error(`  -> ERRO ao enviar "${trigger.name}":`, err.message);
      failCount++;
    }

    // Pequeno intervalo para respeitar taxa de envio do SMTP
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\n======================================================`);
  console.log(`RESULTADO DO DISPARO DE TESTES:`);
  console.log(`Total de Gatilhos: ${triggers.length}`);
  console.log(`Enviados com Sucesso: ${successCount}`);
  console.log(`Falhas: ${failCount}`);
  console.log(`======================================================\n`);
}

run().catch(e => {
  console.error("Erro fatal no script de teste:", e);
  process.exit(1);
});

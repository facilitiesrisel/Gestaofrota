/**
 * Script de Controle de Frota Leve - Risel Combustíveis
 * @OnlyCurrentDoc
 * @Require(DriveApp)
 * @Require(MailApp)
 */

const CONFIG = {
  // Destinatários principais do checklist
  EMAIL_DESTINOS: "deny.goncalves@risel.com.br, lorena.padilha@risel.com.br",
  LOGO_URL: "https://risel.com.br/wp-content/uploads/2024/07/RISEL.png",
  PNEU_ICON_URL: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDjNyYhC9iKeULJlRIsR3PtSutApI14jWW0zjOLVGSZQqmRXPWPs8ItIni&s=10",
  COR_GRADIENTE_INICIO: "#005C30", // Verde Oficial Risel
  COR_GRADIENTE_FIM: "#00361C",    // Verde Escuro Risel
  COR_LARANJA: "#F47920",          // Laranja Risel Accent
  COR_FUNDO_LEVE: "#F8FAFC",       // Fundo Off-White Premium
  TAMANHO_IMAGEM_PX: 1000          // Resolução maior para suportar os cards ampliados
};

// 1. Função de Teste e Diagnóstico do Webhook
function testarConexaoRisel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  Logger.log("==================================================");
  Logger.log("✅ GOOGLE APPS SCRIPT RISEL COMBUSTÍVEIS CONECTADO!");
  Logger.log("Planilha Ativa: " + ss.getName());
  Logger.log("Nome da Aba: " + sheet.getName());
  Logger.log("Total de Linhas Preenchidas Atualmente: " + lastRow);
  Logger.log("==================================================");
  Logger.log("ℹ️ NOTA: Este script recebe dados automaticamente do sistema Risel através da função 'doPost(e)'.");
  Logger.log("Ao importar arquivos no sistema web, os abastecimentos serão inseridos automaticamente nesta planilha.");
  Logger.log("==================================================");
}

function myFunction() {
  testarConexaoRisel();
}

function testLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    Logger.log("A planilha possui apenas o cabeçalho ou está vazia (" + lastRow + " linhas). O Webhook está pronto para receber novos registros do sistema Risel.");
    testarConexaoRisel();
    return;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  Logger.log("Iniciando teste de verificação da linha " + lastRow);
  processarEEnviarChecklist(headers, rowValues);
  Logger.log("Teste concluído com sucesso!");
}

// 2. Gatilho do Formulário
function onFormSubmit(e) {
  if (!e || !e.values) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  processarEEnviarChecklist(headers, e.values);
}

// 3. Processamento e Envio de E-mail
function processarEEnviarChecklist(headers, values) {
  const dados = {};
  headers.forEach((header, index) => {
    dados[header.trim()] = values[index] || "";
  });

  const placa = dados["PLACA"] || "N/A";
  const entregador = dados["ENTREGUE POR"] || "Não Informado";
  const recebedor = dados["RECEBIDO POR"] || "Não Informado";
  const dataChecklist = formatarData(dados["DATA"]);
  const assunto = `Checklist Frota Leve - ${placa} - ${dados["TIPO DE CHECKLIST"]}`;

  // Captura dinamicamente o e-mail do solicitante na Coluna B (índice 1)
  const emailSolicitante = values[1] ? values[1].toString().trim() : "";

  // Gera o HTML do PDF
  const htmlTemplate = gerarHtmlElegante(dados);
  
  // Converte o HTML para PDF
  const blobHtml = Utilities.newBlob(htmlTemplate, MimeType.HTML);
  const pdf = blobHtml.getAs(MimeType.PDF).setName(`Checklist_${placa}_${dataChecklist.replace(/\//g, '-')}.pdf`);

  // E-mail Corporativo com Cabeçalho Gradiente Verde
  const corpoEmail = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      <div style="background-color: #005C30; background: linear-gradient(135deg, ${CONFIG.COR_GRADIENTE_INICIO} 0%, ${CONFIG.COR_GRADIENTE_FIM} 100%); padding: 30px 20px; text-align: center; border-bottom: 4px solid ${CONFIG.COR_LARANJA};">
        <div style="background: #FFFFFF; padding: 12px 24px; border-radius: 8px; display: inline-block; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          <img src="${CONFIG.LOGO_URL}" style="height: 45px; display: block;" alt="Logo Risel" />
        </div>
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; color: #FFFFFF; letter-spacing: 0.5px;">Checklist Registrado com Sucesso</h2>
      </div>
      <div style="padding: 30px; background-color: #FFFFFF; color: #2D3748; line-height: 1.6;">
        <p style="margin-top: 0; font-size: 16px; font-weight: bold; color: ${CONFIG.COR_GRADIENTE_INICIO};">Olá,</p>
        <p style="font-size: 14px; margin-bottom: 20px;">Um novo checklist de veículo leve foi finalizado no sistema. Veja os detalhes de controle abaixo:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
          <tr style="background-color: #F8FAFC;">
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #4A5568; width: 40%;">🚗 Placa do Veículo:</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; color: #1A202C; font-weight: bold;">${placa}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #4A5568;">🏢 Base Operacional:</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; color: #1A202C;">${dados["BASE"] || ""}</td>
          </tr>
          <tr style="background-color: #F8FAFC;">
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #4A5568;">📋 Tipo de Checklist:</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; color: #1A202C;">${dados["TIPO DE CHECKLIST"] || ""}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #4A5568;">📅 Data do Registro:</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; color: #1A202C;">${dataChecklist}</td>
          </tr>
          <tr style="background-color: #F8FAFC;">
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #4A5568;">📤 Entregue Por:</td>
            <td style="padding: 12px 15px; border-bottom: 1px solid #E2E8F0; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold;">${entregador}</td>
          </tr>
          <tr>
            <td style="padding: 12px 15px; color: #4A5568; font-weight: bold;">📥 Recebido Por:</td>
            <td style="padding: 12px 15px; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold;">${recebedor}</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  // Configuração de envio de e-mail integrado
  const opcoesEnvio = {
    to: CONFIG.EMAIL_DESTINOS,
    subject: assunto,
    htmlBody: corpoEmail,
    attachments: [pdf],
    name: "Checklist Frota Leve"
  };

  // Se houver um e-mail válido de solicitante na coluna B, adiciona em cópia (CC)
  if (emailSolicitante && emailSolicitante.includes("@")) {
    opcoesEnvio.cc = emailSolicitante;
  }

  // Disparo de e-mail unificado
  MailApp.sendEmail(opcoesEnvio);
}

// 4. Estrutura de Geração do PDF
function gerarHtmlElegante(d) {
  const limparObs = (chave1, chave2) => {
    let v = d[chave1] || d[chave2] || "";
    v = v.toString().trim();
    return (v.toLowerCase() === "undefined" || v === "") ? "" : v;
  };

  const obsDianteira = limparObs("OBSERVAÇÕES - DIANTEIRA\nAvarias, riscos e amassados", "OBSERVAÇÕES - DIANTEIRA");
  const obsTraseira = limparObs("OBSERVAÇÕES - TRASEIRA\nAvarias, riscos e/ou amassados", "OBSERVAÇÕES - TRASEIRA");
  const obsMotorista = limparObs("OBSERVAÇÕES - LADO MOTORISTA\nAvarias, riscos e/ou amassados", "OBSERVAÇÕES - LADO MOTORISTA");
  const obsPassageiro = limparObs("OBSERVAÇÕES - LADO PASSAGEIRO\nInformar avarias, riscos e/ou amassados", "OBSERVAÇÕES - LADO PASSAGEIRO");

  // Estruturação do Header Unificado com Fundo Verde e Logo no Canto Superior Esquerdo
  const stringHeaderHtml = (tituloPagina) => `
    <table style="width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 15px; background-color: #005C30 !important; background: linear-gradient(135deg, ${CONFIG.COR_GRADIENTE_INICIO} 0%, ${CONFIG.COR_GRADIENTE_FIM} 100%) !important; border-bottom: 5px solid ${CONFIG.COR_LARANJA} !important; border-radius: 6px 6px 0 0;">
      <tr style="background: none !important;">
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: left; width: 30%;">
          <div style="background: #FFFFFF; padding: 6px 12px; border-radius: 6px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <img src="${CONFIG.LOGO_URL}" style="height: 35px; display: block;" alt="Logo Risel" />
          </div>
        </td>
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: right; width: 70%;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF !important; letter-spacing: 1px;">${tituloPagina}</h1>
        </td>
      </tr>
    </table>
  `;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 10px; color: #2D3748; font-size: 11px; background-color: #FFFFFF; }
      
      /* Divisores de Seções */
      .section-title { 
        background-color: #F1F5F9; 
        color: ${CONFIG.COR_GRADIENTE_INICIO}; 
        padding: 10px 14px; 
        font-weight: bold; 
        font-size: 12px; 
        margin-top: 15px; 
        border-left: 4px solid ${CONFIG.COR_LARANJA}; 
        border-radius: 0 4px 4px 0;
        text-transform: uppercase; 
      }
      
      /* Tabelas Gerais */
      table { 
        width: 100%; 
        border-collapse: separate; 
        border-spacing: 0; 
        margin-top: 6px; 
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        overflow: hidden;
      }
      th, td { 
        padding: 15px 18px; 
        text-align: left; 
        vertical-align: middle; 
        border-bottom: 1px solid #E2E8F0;
        border-right: 1px solid #E2E8F0;
        line-height: 1.5;
      }
      tr:last-child th, tr:last-child td { border-bottom: none; }
      th:last-child, td:last-child { border-right: none; }
      
      th { 
        background-color: #F8FAFC; 
        color: #4A5568; 
        font-weight: 600; 
        width: 25%; 
        font-size: 9.5px; 
        text-transform: uppercase; 
      }
      td { font-size: 11px; font-weight: bold; color: #1A202C; background-color: #FFFFFF; }
      
      /* Ícones */
      .tire-icon-img {
        width: 14px;
        height: 14px;
        vertical-align: middle;
        margin-right: 8px;
      }
      .item-icon {
        display: inline-block;
        width: 8px;
        height: 8px;
        background-color: ${CONFIG.COR_GRADIENTE_INICIO}; 
        border-radius: 2px;
        margin-right: 8px;
        vertical-align: middle;
      }

      /* Grid 2x2 para Fotos Maximizadas */
      .photo-grid { width: 100%; border-collapse: separate; border-spacing: 12px; margin-top: 10px; border: none; }
      .photo-grid td { width: 50%; border: none; padding: 0; background: none; }
      .photo-card { border: 1px solid #E2E8F0; padding: 8px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .photo-card img { 
        width: 100%; 
        height: 250px; 
        border-radius: 6px; 
        object-fit: cover; 
        display: block;
      }
      .photo-title { font-size: 9.5px; color: #4A5568; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; text-align: center; }

      /* Cards do Interior Ampliados (Proporcionais e de Alta Resolução) */
      .interior-photo-card { border: 1px solid #E2E8F0; padding: 10px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .interior-photo-card img { 
        width: 100%; 
        height: 380px; /* Altura generosa ampliada para visualização impecável */
        border-radius: 6px; 
        object-fit: cover; 
        display: block;
      }
    </style>
  </head>
  <body>

    <!-- PÁGINA 1: INFORMAÇÕES GERAIS -->
    \${stringHeaderHtml("CHECKLIST FROTA LEVE")}

    <div class="section-title">📋 Dados Gerais do Checklist</div>
    <table>
      <tr>
        <th>📅 DATA DO REGISTRO</th><td>\${formatarData(d["DATA"])}</td>
        <th>📋 TIPO DE CHECKLIST</th><td>\${d["TIPO DE CHECKLIST"]}</td>
      </tr>
      <tr>
        <th>🏢 BASE OPERACIONAL</th><td>\${d["BASE"]}</td>
        <th>🚗 PLACA DO VEÍCULO</th><td>\${d["PLACA"]}</td>
      </tr>
      <tr>
        <th>🚘 MARCA / MODELO</th><td>\${d["MARCA / MODELO"]}</td>
        <th>🎨 COR DO VEÍCULO</th><td>\${d["COR"]}</td>
      </tr>
      <tr>
        <th>⛽ NÍVEL DO TANQUE</th><td>\${d["NÍVEL TANQUE [TANQUE]"]}</td>
        <th>🛣️ KM ATUAL</th><td>\${formatarNumero(d["KM ATUAL"])}</td>
      </tr>
    </table>

    <div class="section-title">🛠️ Componentes e Pneus</div>
    <table>
      <tr>
        <th style="width: 25%;"><span class="item-icon"></span>ITENS INTEGRADOS</th>
        <td colspan="3" style="font-weight: normal; color: #2D3748; line-height: 1.4;">\${d["ITENS DO VEÍCULO"]}</td>
      </tr>
    </table>

    <div style="margin-top: 15px; font-weight: bold; color: \${CONFIG.COR_GRADIENTE_INICIO}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">🛞 Conservação Física dos Pneus</div>
    <table>
      <tr>
        <th><img src="\${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />DIANTEIRO DIREITO</th><td>\${d["ESTADO PNEUS [DIANTEIRO DIREITO]"]}</td>
        <th><img src="\${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />DIANTEIRO ESQUERDO</th><td>\${d["ESTADO PNEUS [DIANTEIRO ESQUERDO]"]}</td>
      </tr>
      <tr>
        <th><img src="\${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />TRASEIRO DIREITO</th><td>\${d["ESTADO PNEUS [TRASEIRO DIREITO]"]}</td>
        <th><img src="\${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />TRASEIRO ESQUERDO</th><td>\${d["ESTADO PNEUS [TRASEIRO ESQUERDO]"]}</td>
      </tr>
      <tr>
        <th><img src="\${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />ESTEPE AUXILIAR</th><td colspan="3">\${d["ESTADO PNEUS [ESTEPE]"]}</td>
      </tr>
    </table>

    <!-- SEÇÃO DE AVARIAS EM DUAS LINHAS E DUAS COLUNAS -->
    <div class="section-title">⚠️ Avarias e Observações</div>
    <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; margin-top: 6px;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: \${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Dianteira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">\${obsDianteira || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: \${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Traseira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">\${obsTraseira || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-right: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: \${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Lado Motorista</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">\${obsMotorista || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: \${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Lado Passageiro</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">\${obsPassageiro || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
      </tr>
    </table>


    <!-- PÁGINA 2: REGISTRO FOTOGRÁFICO - PARTE 1 -->
    <div style="page-break-before: always;"></div>
    \${stringHeaderHtml("REGISTRO FOTOGRÁFICO - PARTE 1")}
    
    <table class="photo-grid">
      <tr>
        <td>\${gerarCardFoto("Frente", d["FOTO FRENTE"])}</td>
        <td>\${gerarCardFoto("Traseira", d["FOTO TRASEIRA"])}</td>
      </tr>
      <tr>
        <td>\${gerarCardFoto("Lado Motorista", d["FOTO LADO MOTORISTA"])}</td>
        <td>\${gerarCardFoto("Lado Passageiro", d["FOTO LADO PASSAGEIRO"])}</td>
      </tr>
    </table>


    <!-- PÁGINA 3: REGISTRO FOTOGRÁFICO - PARTE 2 -->
    <div style="page-break-before: always;"></div>
    \${stringHeaderHtml("REGISTRO FOTOGRÁFICO - PARTE 2")}
    
    <table class="photo-grid">
      <tr>
        <td>\${gerarCardFoto("Retrovisor Motorista", d["FOTO RETROVISOR MOTORISTA"])}</td>
        <td>\${gerarCardFoto("Retrovisor Passageiro", d["FOTO RETOROVISOR PASSAGEIRO"])}</td>
      </tr>
      <tr>
        <td>\${gerarCardFoto("Faróis Dianteiros", d["FOTO FARÓIS/LANTERNAS DIANTEIRAS"])}</td>
        <td>\${gerarCardFoto("Lanternas Traseiras", d["FOTO FARÓIS/LANTERNAS TRASEIRAS"])}</td>
      </tr>
    </table>


    <!-- PÁGINA 4: FOTOS DO INTERIOR E RESPONSÁVEIS -->
    <div style="page-break-before: always;"></div>
    \${stringHeaderHtml("FOTOS DO INTERIOR & RESPONSÁVEIS")}

    <div class="section-title">📸 Registro Fotográfico do Interior</div>
    <div style="margin-top: 10px;">
      \${gerarFotosInteriorMultiplas(d["FOTOS INTERIOR DO VEÍCULO"])}
    </div>

    <!-- Tabela Executiva de Responsáveis -->
    <div class="section-title" style="margin-top: 30px;">👥 Responsáveis pelo Registro</div>
    <table style="width: 100%; border-collapse: separate; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-top: 12px;">
      <tr>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; background-color: #F8FAFC !important;">📤 ENTREGUE POR</th>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; border-bottom: 1px solid #E2E8F0; background-color: #F8FAFC !important;">📥 RECEBIDO POR</th>
      </tr>
      <tr>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; border-right: 1px solid #E2E8F0; background-color: #FFFFFF !important;">
          \${d["ENTREGUE POR"] || "Não Informado"}
        </td>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; background-color: #FFFFFF !important;">
          \${d["RECEBIDO POR"] || "Não Informado"}
        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
}

// 5. Motor de Compressão e Inserção de Imagens (Exterior - Grandes)
function gerarCardFoto(titulo, urlString) {
  if (!urlString || urlString.trim() === "") {
    return `<div class="photo-card"><div class="photo-title">\${titulo}</div><p style="color:#A0AEC0; font-size:10px; padding: 110px 0; text-align:center;">Sem foto registrada</p></div>`;
  }
  
  const url = urlString.split(",")[0].trim();
  const base64 = converterUrlParaBase64Comprimido(url);
  
  if (!base64) {
    return `<div class="photo-card"><div class="photo-title">\${titulo}</div><p style="color:#E53E3E; font-size:10px; padding: 110px 0; text-align:center;">Erro ao processar imagem</p></div>`;
  }
  
  return `
    <div class="photo-card">
      <div class="photo-title">\${titulo}</div>
      <img src="\${base64}" alt="\${titulo}" />
    </div>
  `;
}

// 6. Motor de Compressão para Fotos de Interior (Ampliadas e sem distorção)
function gerarFotosInteriorMultiplas(urlString) {
  if (!urlString || urlString.trim() === "") {
    return "<p style='color:#A0AEC0; font-size:11px; padding: 15px 5px;'>Nenhuma foto do interior enviada para este checklist.</p>";
  }
  
  const urls = urlString.split(",");
  let html = '<table class="photo-grid"><tr>';
  
  urls.forEach((url, index) => {
    const base64 = converterUrlParaBase64Comprimido(url.trim());
    if (base64) {
      if (index > 0 && index % 2 === 0) {
        html += '</tr><tr>';
      }
      html += `<td><div class="interior-photo-card"><img src="\${base64}" /></div></td>`;
    }
  });
  
  html += '</tr></table>';
  return html;
}

// Compressão inteligente via API de Thumbnails do Google Drive
function converterUrlParaBase64Comprimido(url) {
  const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  
  const fileId = idMatch[1];
  
  try {
    const token = ScriptApp.getOAuthToken();
    const fetchUrl = `https://drive.google.com/thumbnail?id=\${fileId}&sz=w\${CONFIG.TAMANHO_IMAGEM_PX}`;
    
    const response = UrlFetchApp.fetch(fetchUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob();
      return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
    }
  } catch (e) {
    Logger.log("Erro ao converter imagem: " + e.toString());
  }
  return null;
}

// Formatadores de Dados Auxiliares
function formatarData(dataStr) {
  if (!dataStr) return "";
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return dataStr;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarNumero(num) {
  if (num === undefined || num === null || num === "") return "N/A";
  // Remove qualquer caractere não numérico para garantir a conversão limpa
  const str = num.toString().replace(/\\D/g, "");
  if (!str) return num; 
  return Number(str).toLocaleString("pt-BR");
}

/**
 * 4. Ponto de Entrada para Inserção Direta via Webhook / App da Web
 * Permite que o sistema web da Risel envie relatórios de abastecimento (CSV)
 * e grave automaticamente na planilha Google Sheets sem necessidade de login manual.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Nenhum dado recebido no payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetTitle = contents.sheetTitle || "Página1";
    let sheet = ss.getSheetByName(sheetTitle) || ss.getActiveSheet();

    // Se o cabeçalho for enviado e a planilha estiver em branco (0 linhas)
    if (sheet.getLastRow() === 0 && contents.headers && contents.headers.length > 0) {
      sheet.appendRow(contents.headers);
    }

    // Adiciona todas as linhas recebidas
    if (contents.rows && contents.rows.length > 0) {
      const startRow = Math.max(1, sheet.getLastRow() + 1);
      sheet.getRange(startRow, 1, contents.rows.length, contents.rows[0].length).setValues(contents.rows);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Dados inseridos com sucesso na planilha!",
      rowsAdded: contents.rows ? contents.rows.length : 0
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


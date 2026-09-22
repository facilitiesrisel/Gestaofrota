/**
 * =================================================================================
 * CÓDIGO BACKEND INTEGRADO G F RISEL v6.0 (MULTI-MÓDULOS)
 * - Módulo 1: Gestão de Banco de Dados (Read, Save, Delete, Upload Drive, Termos PDF)
 * - Módulo 2: Importação em Lote / Sincronização Automática (Multas e Abastecimentos)
 * - Módulo 3: Vistorias & Checklists (Gatilho de Formulário, Relatório PDF e E-mails)
 * =================================================================================
 * @OnlyCurrentDoc
 * @Require(DriveApp)
 * @Require(MailApp)
 */

// =================================================================================
// 1. CONFIGURAÇÕES GERAIS
// =================================================================================
const CONFIG = {
  EMAIL_DESTINOS: "deny.goncalves@risel.com.br, lorena.padilha@risel.com.br",
  LOGO_URL: "https://risel.com.br/wp-content/uploads/2024/07/RISEL.png",
  PNEU_ICON_URL: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDjNyYhC9iKeULJlRIsR3PtSutApI14jWW0zjOLVGSZQqmRXPWPs8ItIni&s=10",
  COR_GRADIENTE_INICIO: "#005C30", // Verde Oficial Risel
  COR_GRADIENTE_FIM: "#00361C",    // Verde Escuro Risel
  COR_LARANJA: "#F47920",          // Laranja Risel Accent
  COR_FUNDO_LEVE: "#F8FAFC",       // Fundo Off-White Premium
  TAMANHO_IMAGEM_PX: 1000          // Resolução para fotos do checklist
};

// =================================================================================
// 2. ROTEADORES HTTP (GET e POST)
// =================================================================================
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.tryLock(30000); 
  } catch (lockErr) {}

  try {
    let content = {};
    if (e && e.postData && e.postData.contents) {
      try {
        content = JSON.parse(e.postData.contents);
      } catch (err) {
        content = {};
      }
    }

    const action = content.action || (e && e.parameter ? e.parameter.action : "");

    // A) Envio direto de E-mail
    if (action === "sendEmail") {
      const emailOptions = {
        to: content.to || CONFIG.EMAIL_DESTINOS,
        subject: content.subject || "Notificação do Sistema Risel",
        htmlBody: content.html || content.htmlBody || "",
        name: content.fromName || "Gestão de Frotas - Risel"
      };
      if (content.cc) emailOptions.cc = content.cc;

      if (content.attachments && Array.isArray(content.attachments)) {
        const mailAtts = [];
        for (let i = 0; i < content.attachments.length; i++) {
          const a = content.attachments[i];
          if (a && a.content) {
            const rawBase64 = a.content.includes("base64,") ? a.content.split("base64,")[1] : a.content;
            const decoded = Utilities.base64Decode(rawBase64);
            const blob = Utilities.newBlob(decoded, a.contentType || "application/pdf", a.filename || ("anexo_" + (i + 1) + ".pdf"));
            mailAtts.push(blob);
          }
        }
        if (mailAtts.length > 0) emailOptions.attachments = mailAtts;
      }

      MailApp.sendEmail(emailOptions);
      return jsonResponse({
        success: true,
        message: "E-mail enviado com sucesso pelo Google Apps Script!"
      });
    }

    // B) Inserção em Lote (Batch Sync: Multas, Abastecimentos, etc.)
    if (action === "save_batch" || (content.rows && Array.isArray(content.rows) && content.rows.length > 0)) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheetTitle = content.sheetTitle || (content.type === "multa" ? "MULTAS" : "Página1");
      let sheet = ss.getSheetByName(sheetTitle);
      if (!sheet) {
        sheet = ss.insertSheet(sheetTitle);
      }

      // Se a planilha estiver vazia e os cabeçalhos foram enviados
      if (sheet.getLastRow() === 0 && content.headers && content.headers.length > 0) {
        sheet.appendRow(content.headers);
      }

      if (content.rows && content.rows.length > 0) {
        const startRow = Math.max(1, sheet.getLastRow() + 1);
        sheet.getRange(startRow, 1, content.rows.length, content.rows[0].length).setValues(content.rows);
      }

      return jsonResponse({
        success: true,
        status: "success",
        message: "Dados gravados em lote com sucesso!",
        rowsAdded: content.rows ? content.rows.length : 0
      });
    }

    // C) Operações CRUD Padrão do Sistema
    let result = { success: false, error: "Ação não informada ou desconhecida: " + action };

    if (action === 'read') {
      result = { success: true, ...readAllData() };
    } else if (action === 'save') {
      result = { success: true, data: saveData(content.type, content.payload) };
    } else if (action === 'delete') {
      result = { success: true, data: deleteData(content.type, content.payload) };
    } else if (action === 'upload') {
      result = uploadFile(content);
    } else if (action === 'generate_pdf') {
      result = generatePdf(content);
    } else if (!action) {
      // Diagnóstico caso chamado via navegador (GET padrão)
      result = {
        success: true,
        message: "Google Apps Script Risel Online e Operacional!",
        spreadsheet: SpreadsheetApp.getActiveSpreadsheet().getName()
      };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

// =================================================================================
// 3. MÓDULO CRUD: LEITURA E GRAVAÇÃO INTELIGENTE
// =================================================================================
function readAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (sheet.getLastRow() < 1) { 
      result[name] = []; 
      return; 
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    result[name] = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { 
        if (h) obj[h] = row[i]; 
      });
      return obj;
    });
  });
  return result;
}

function norm(s) { 
  if (s === undefined || s === null) return "";
  return String(s).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim(); 
}

function saveData(type, item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Definição da Aba correspondente
  let sheetName = 'DADOS';
  if (type === 'veiculo') {
    if (ss.getSheetByName('FROTA')) sheetName = 'FROTA';
    else if (ss.getSheetByName('FROTAS')) sheetName = 'FROTAS';
    else sheetName = 'FROTA';
  } else if (type === 'motorista') {
    sheetName = ss.getSheetByName('MOTORISTAS') ? 'MOTORISTAS' : 'MOTORISTA';
  } else if (type === 'config') {
    sheetName = 'CONFIGS';
  } else {
    sheetName = 'MULTAS';
  }

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (type === 'config') sheet.appendRow(['KEY', 'VALUE']);
  }

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const data = sheet.getDataRange().getValues();
  
  // 2. Identificação da Coluna Chave
  let keyIdx = -1;
  let possibleKeys = [];
  if (type === 'veiculo') possibleKeys = ['FROTA', 'VEICULO', 'PREFIXO', 'ID', 'CODIGO', 'NFROTA', 'NUMEROFROTA'];
  else if (type === 'motorista') possibleKeys = ['LOGIN', 'MATRICULA', 'ID', 'CODIGO'];
  else if (type === 'config') possibleKeys = ['KEY', 'CHAVE'];
  else possibleKeys = ['ID', 'AIT', 'CODIGO']; // Multa

  for (let i = 0; i < headers.length; i++) {
    const hNorm = norm(headers[i]);
    if (possibleKeys.some(k => norm(k) === hNorm)) {
      keyIdx = i;
      break;
    }
  }
  
  if (type === 'veiculo' && keyIdx === -1 && headers.length >= 2 && norm(headers[0]) === 'STATUS') {
    keyIdx = 1; 
  }

  // 3. Valor da Chave do Item
  let itemId = "";
  if (type === 'veiculo') itemId = item['FROTA'] || item['ID'] || item['VEICULO'];
  else if (type === 'motorista') itemId = item['LOGIN'] || item['ID'];
  else if (type === 'config') itemId = item['KEY'];
  else itemId = item['ID'] || item['AIT'];

  const searchVal = norm(itemId);
  let rowIdx = -1;

  // 4. Procura Linha Existente para Atualização
  if (keyIdx !== -1 && searchVal !== "") {
    for (let i = 1; i < data.length; i++) {
      const cellVal = norm(data[i][keyIdx]);
      if (cellVal === searchVal || String(data[i][keyIdx]) === String(itemId)) { 
        rowIdx = i + 1; 
        break; 
      }
    }
  }

  // 5. Prepara Valores conforme os Cabeçalhos da Planilha
  const rowValues = headers.map(h => {
    const hNorm = norm(h);
    if (item[h] !== undefined) return item[h];
    for (let k in item) {
      if (norm(k) === hNorm) return item[k];
    }
    return "";
  });
  
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    return "Sucesso: Registro Atualizado (Linha " + rowIdx + ")";
  } else {
    sheet.appendRow(rowValues);
    return "Sucesso: Registro Criado (Nova Linha)";
  }
}

function deleteData(type, payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetName = type === 'veiculo' ? (ss.getSheetByName('FROTA') ? 'FROTA' : 'FROTAS') : (type === 'motorista' ? 'MOTORISTAS' : (type === 'config' ? 'CONFIGS' : 'MULTAS'));
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return "Erro: Aba não encontrada.";
  
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const data = sheet.getDataRange().getValues();

  let keyIdx = -1;
  let possibleKeys = [];
  if (type === 'veiculo') possibleKeys = ['FROTA', 'VEICULO', 'PREFIXO', 'ID', 'CODIGO', 'NFROTA'];
  else if (type === 'motorista') possibleKeys = ['LOGIN', 'MATRICULA', 'ID'];
  else if (type === 'config') possibleKeys = ['KEY'];
  else possibleKeys = ['ID', 'AIT'];

  for (let i = 0; i < headers.length; i++) {
    const hNorm = norm(headers[i]);
    if (possibleKeys.some(k => norm(k) === hNorm)) { keyIdx = i; break; }
  }

  let itemId = "";
  if (type === 'veiculo') itemId = payload.id || payload.ID || payload.FROTA;
  else if (type === 'motorista') itemId = payload.id || payload.LOGIN;
  else if (type === 'config') itemId = payload.key || payload.KEY;
  else itemId = payload.id || payload.ID;

  const searchVal = norm(itemId);

  if (keyIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      const cellVal = norm(data[i][keyIdx]);
      if (cellVal === searchVal || String(data[i][keyIdx]) === String(itemId)) {
        sheet.deleteRow(i + 1);
        return "Deletado com sucesso.";
      }
    }
  }
  return "Registro não localizado para exclusão.";
}

function uploadFile(d) {
  const folder = DriveApp.getFolderById(d.folderId);
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(d.fileData), d.mimeType, d.fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { success: true, fileUrl: file.getUrl() };
}

function generatePdf(d) {
  const folder = DriveApp.getFolderById(d.folderId);
  const template = DriveApp.getFileById(d.templateId).makeCopy('AUT_TEMP', folder);
  const doc = DocumentApp.openById(template.getId());
  const body = doc.getBody();
  for (let key in d.data) { body.replaceText(key, d.data[key] || ""); }
  doc.saveAndClose();
  const pdf = folder.createFile(template.getAs(MimeType.PDF));
  pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  template.setTrashed(true);
  return { success: true, fileUrl: pdf.getUrl() };
}

// =================================================================================
// 4. MÓDULO CHECKLIST: FORMULÁRIO, FOTOS E RELATÓRIO PDF
// =================================================================================
function onFormSubmit(e) {
  if (!e || !e.values) return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  processarEEnviarChecklist(headers, e.values);
}

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
  const emailSolicitante = values[1] ? values[1].toString().trim() : "";

  const htmlTemplate = gerarHtmlElegante(dados);
  const blobHtml = Utilities.newBlob(htmlTemplate, MimeType.HTML);
  const pdf = blobHtml.getAs(MimeType.PDF).setName(`Checklist_${placa}_${dataChecklist.replace(/\//g, '-')}.pdf`);

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

  const opcoesEnvio = {
    to: CONFIG.EMAIL_DESTINOS,
    subject: assunto,
    htmlBody: corpoEmail,
    attachments: [pdf],
    name: "Checklist Frota Leve"
  };

  if (emailSolicitante && emailSolicitante.includes("@")) {
    opcoesEnvio.cc = emailSolicitante;
  }

  MailApp.sendEmail(opcoesEnvio);
}

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
      .tire-icon-img { width: 14px; height: 14px; vertical-align: middle; margin-right: 8px; }
      .item-icon {
        display: inline-block;
        width: 8px;
        height: 8px;
        background-color: ${CONFIG.COR_GRADIENTE_INICIO}; 
        border-radius: 2px;
        margin-right: 8px;
        vertical-align: middle;
      }
      .photo-grid { width: 100%; border-collapse: separate; border-spacing: 12px; margin-top: 10px; border: none; }
      .photo-grid td { width: 50%; border: none; padding: 0; background: none; }
      .photo-card { border: 1px solid #E2E8F0; padding: 8px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .photo-card img { width: 100%; height: 250px; border-radius: 6px; object-fit: cover; display: block; }
      .photo-title { font-size: 9.5px; color: #4A5568; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; text-align: center; }
      .interior-photo-card { border: 1px solid #E2E8F0; padding: 10px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .interior-photo-card img { width: 100%; height: 380px; border-radius: 6px; object-fit: cover; display: block; }
    </style>
  </head>
  <body>
    <!-- PÁGINA 1: INFORMAÇÕES GERAIS -->
    ${stringHeaderHtml("CHECKLIST FROTA LEVE")}

    <div class="section-title">📋 Dados Gerais do Checklist</div>
    <table>
      <tr>
        <th>📅 DATA DO REGISTRO</th><td>${formatarData(d["DATA"])}</td>
        <th>📋 TIPO DE CHECKLIST</th><td>${d["TIPO DE CHECKLIST"]}</td>
      </tr>
      <tr>
        <th>🏢 BASE OPERACIONAL</th><td>${d["BASE"]}</td>
        <th>🚗 PLACA DO VEÍCULO</th><td>${d["PLACA"]}</td>
      </tr>
      <tr>
        <th>🚘 MARCA / MODELO</th><td>${d["MARCA / MODELO"]}</td>
        <th>🎨 COR DO VEÍCULO</th><td>${d["COR"]}</td>
      </tr>
      <tr>
        <th>⛽ NÍVEL DO TANQUE</th><td>${d["NÍVEL TANQUE [TANQUE]"]}</td>
        <th>🛣️ KM ATUAL</th><td>${formatarNumero(d["KM ATUAL"])}</td>
      </tr>
    </table>

    <div class="section-title">🛠️ Componentes e Pneus</div>
    <table>
      <tr>
        <th style="width: 25%;"><span class="item-icon"></span>ITENS INTEGRADOS</th>
        <td colspan="3" style="font-weight: normal; color: #2D3748; line-height: 1.4;">${d["ITENS DO VEÍCULO"]}</td>
      </tr>
    </table>

    <div style="margin-top: 15px; font-weight: bold; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">🛞 Conservação Física dos Pneus</div>
    <table>
      <tr>
        <th><img src="${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />DIANTEIRO DIREITO</th><td>${d["ESTADO PNEUS [DIANTEIRO DIREITO]"]}</td>
        <th><img src="${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />DIANTEIRO ESQUERDO</th><td>${d["ESTADO PNEUS [DIANTEIRO ESQUERDO]"]}</td>
      </tr>
      <tr>
        <th><img src="${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />TRASEIRO DIREITO</th><td>${d["ESTADO PNEUS [TRASEIRO DIREITO]"]}</td>
        <th><img src="${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />TRASEIRO ESQUERDO</th><td>${d["ESTADO PNEUS [TRASEIRO ESQUERDO]"]}</td>
      </tr>
      <tr>
        <th><img src="${CONFIG.PNEU_ICON_URL}" class="tire-icon-img" />ESTEPE AUXILIAR</th><td colspan="3">${d["ESTADO PNEUS [ESTEPE]"]}</td>
      </tr>
    </table>

    <div class="section-title">⚠️ Avarias e Observações</div>
    <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; margin-top: 6px;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Dianteira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">${obsDianteira || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Traseira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">${obsTraseira || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-right: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Lado Motorista</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">${obsMotorista || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px; background-color: #FFFFFF;">
          <div style="font-size: 9px; color: ${CONFIG.COR_GRADIENTE_INICIO}; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; letter-spacing: 0.5px;">⚠️ Lado Passageiro</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 40px; line-height: 1.4;">${obsPassageiro || '<span style="color:#A0AEC0; font-weight: normal; font-style: italic;">Nenhuma avaria observada</span>'}</div>
        </td>
      </tr>
    </table>

    <!-- PÁGINA 2: REGISTRO FOTOGRÁFICO - PARTE 1 -->
    <div style="page-break-before: always;"></div>
    ${stringHeaderHtml("REGISTRO FOTOGRÁFICO - PARTE 1")}
    <table class="photo-grid">
      <tr>
        <td>${gerarCardFoto("Frente", d["FOTO FRENTE"])}</td>
        <td>${gerarCardFoto("Traseira", d["FOTO TRASEIRA"])}</td>
      </tr>
      <tr>
        <td>${gerarCardFoto("Lado Motorista", d["FOTO LADO MOTORISTA"])}</td>
        <td>${gerarCardFoto("Lado Passageiro", d["FOTO LADO PASSAGEIRO"])}</td>
      </tr>
    </table>

    <!-- PÁGINA 3: REGISTRO FOTOGRÁFICO - PARTE 2 -->
    <div style="page-break-before: always;"></div>
    ${stringHeaderHtml("REGISTRO FOTOGRÁFICO - PARTE 2")}
    <table class="photo-grid">
      <tr>
        <td>${gerarCardFoto("Retrovisor Motorista", d["FOTO RETROVISOR MOTORISTA"])}</td>
        <td>${gerarCardFoto("Retrovisor Passageiro", d["FOTO RETOROVISOR PASSAGEIRO"])}</td>
      </tr>
      <tr>
        <td>${gerarCardFoto("Faróis Dianteiros", d["FOTO FARÓIS/LANTERNAS DIANTEIRAS"])}</td>
        <td>${gerarCardFoto("Lanternas Traseiras", d["FOTO FARÓIS/LANTERNAS TRASEIRAS"])}</td>
      </tr>
    </table>

    <!-- PÁGINA 4: FOTOS DO INTERIOR E RESPONSÁVEIS -->
    <div style="page-break-before: always;"></div>
    ${stringHeaderHtml("FOTOS DO INTERIOR & RESPONSÁVEIS")}

    <div class="section-title">📸 Registro Fotográfico do Interior</div>
    <div style="margin-top: 10px;">
      ${gerarFotosInteriorMultiplas(d["FOTOS INTERIOR DO VEÍCULO"])}
    </div>

    <div class="section-title" style="margin-top: 30px;">👥 Responsáveis pelo Registro</div>
    <table style="width: 100%; border-collapse: separate; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-top: 12px;">
      <tr>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; background-color: #F8FAFC !important;">📤 ENTREGUE POR</th>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; border-bottom: 1px solid #E2E8F0; background-color: #F8FAFC !important;">📥 RECEBIDO POR</th>
      </tr>
      <tr>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; border-right: 1px solid #E2E8F0; background-color: #FFFFFF !important;">
          ${d["ENTREGUE POR"] || "Não Informado"}
        </td>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; background-color: #FFFFFF !important;">
          ${d["RECEBIDO POR"] || "Não Informado"}
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function gerarCardFoto(titulo, urlString) {
  if (!urlString || urlString.trim() === "") {
    return `<div class="photo-card"><div class="photo-title">${titulo}</div><p style="color:#A0AEC0; font-size:10px; padding: 110px 0; text-align:center;">Sem foto registrada</p></div>`;
  }
  const url = urlString.split(",")[0].trim();
  const base64 = converterUrlParaBase64Comprimido(url);
  if (!base64) {
    return `<div class="photo-card"><div class="photo-title">${titulo}</div><p style="color:#E53E3E; font-size:10px; padding: 110px 0; text-align:center;">Erro ao processar imagem</p></div>`;
  }
  return `
    <div class="photo-card">
      <div class="photo-title">${titulo}</div>
      <img src="${base64}" alt="${titulo}" />
    </div>
  `;
}

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
      html += `<td><div class="interior-photo-card"><img src="${base64}" /></div></td>`;
    }
  });
  html += '</tr></table>';
  return html;
}

function converterUrlParaBase64Comprimido(url) {
  const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  const fileId = idMatch[1];
  try {
    const token = ScriptApp.getOAuthToken();
    const fetchUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${CONFIG.TAMANHO_IMAGEM_PX}`;
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

function formatarData(dataStr) {
  if (!dataStr) return "";
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return dataStr;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarNumero(num) {
  if (num === undefined || num === null || num === "") return "N/A";
  const str = num.toString().replace(/\D/g, "");
  if (!str) return num; 
  return Number(str).toLocaleString("pt-BR");
}

function testarConexaoRisel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("✅ GOOGLE APPS SCRIPT RISEL v6.0 CONECTADO COM SUCESSO!");
  Logger.log("Planilha: " + ss.getName());
}

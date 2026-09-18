
import React, { useState, useEffect } from 'react';
import { getApiUrl, setApiUrl, testConnection, getDriveFolderId, getDocsTemplateId, setDriveConfig, getEmailConfig, setEmailConfig, clearCache, saveConfigItemApi } from '../services/storage';
import { Save, Link as LinkIcon, Radio, CheckCircle, XCircle, Loader2, Code, Copy, Table, AlertTriangle, FileJson, Folder, Mail, RefreshCw } from 'lucide-react';

const HEADERS_MULTAS = "ID\tSTATUS\tFROTA\tPLACA\tBASE\tAIT\tTIPO\tDATA INFRACAO\tDATA RECEBIMENTO\tPRAZO INDICACAO\tRECEBIDA COM PRAZO\tENQUADRAMENTO\tARTIGO CTB\tDESCRICAO INFRACAO\tPONTOS CNH\tLOGIN MOTORISTA\tNOME MOTORISTA\tORGAO AUTUADOR\tENDERECO\tMUNICIPIO\tUF\tRODOVIA OU URBANO\tRETORNOU COM PRAZO\tVALOR\tDESCONTO\tVALOR COM DESCONTO\tEMPRESA OU CONDUTOR\tDESCONTAR MOTORISTA\tPAGO COM DESCONTO\tENVIADO AO RH\tOBS\tLINK AIT\tLINK AUTORIZACAO";
const HEADERS_VEICULOS = "STATUS\tFROTA\tPLACA\tMARCA\tMODELO\tANO\tFILIAL\tREGIÃO\tTIPO\tCAPACIDADE\tPROPRIETÁRIO\tLICENCIAMENTO\tCUSTO LICENCIAMENTO 2026\tCUSTO IPVA 2026\tCUSTO MULTAS 2026\tCUSTO POR PLACA";
const HEADERS_MOTORISTAS = "STATUS\tLOGIN\tNOME\tBASE\tQTD. MULTAS\tVALOR MULTAS";

const MANIFEST_CODE = `{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.send_mail"
  ]
}`;

const SCRIPT_CODE = `// =================================================================================
// CÓDIGO BACKEND G F RISEL v5.4 (ANEXOS DIRETOS NO E-MAIL + SYNC COMPLETO)
// =================================================================================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.TEXT);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 
  try {
    let content = {};
    if (e.postData && e.postData.contents) {
        try { content = JSON.parse(e.postData.contents); } catch (err) {}
    }
    const action = content.action || e.parameter.action;
    let result = { success: false, error: "Ação desconhecida: " + action };

    if (action === 'read') result = { success: true, ...readAllData() };
    else if (action === 'save') result = { success: true, data: saveData(content.type, content.payload) };
    else if (action === 'delete') result = { success: true, data: deleteData(content.type, content.payload) };
    else if (action === 'upload') result = uploadFile(content);
    else if (action === 'generate_pdf') result = generatePdf(content);
    else if (action === 'send_email') result = sendEmailNotification(content.payload);

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function readAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (sheet.getLastRow() < 1) { result[name] = []; return; }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    result[name] = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    });
  });
  return result;
}

function norm(s) { 
    if (s === undefined || s === null) return "";
    return String(s).toUpperCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim(); 
}

function saveData(type, item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Definição Inteligente da Aba
  let sheetName = 'Multas';
  if (type === 'veiculo') {
      if (ss.getSheetByName('Frota')) sheetName = 'Frota';
      else if (ss.getSheetByName('FROTA')) sheetName = 'FROTA';
      else if (ss.getSheetByName('FROTAS')) sheetName = 'FROTAS';
      else if (ss.getSheetByName('Frota Completa')) sheetName = 'Frota Completa';
      else if (ss.getSheetByName('veiculos')) sheetName = 'veiculos';
      else sheetName = 'Frota';
  }
  else if (type === 'motorista') {
      if (ss.getSheetByName('Motoristas')) sheetName = 'Motoristas';
      else if (ss.getSheetByName('MOTORISTAS')) sheetName = 'MOTORISTAS';
      else if (ss.getSheetByName('motoristas')) sheetName = 'motoristas';
      else sheetName = 'Motoristas';
  }
  else if (type === 'codigo') {
      if (ss.getSheetByName('Cod Multas')) sheetName = 'Cod Multas';
      else if (ss.getSheetByName('COD MULTAS')) sheetName = 'COD MULTAS';
      else sheetName = 'Cod Multas';
  }
  else if (type === 'config') sheetName = 'CONFIGS';
  else sheetName = ss.getSheetByName('Multas') ? 'Multas' : (ss.getSheetByName('MULTAS') ? 'MULTAS' : 'Multas');

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (type === 'config') sheet.appendRow(['KEY', 'VALUE']);
  }

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const data = sheet.getDataRange().getValues();
  
  // 2. Busca Índice da Coluna Chave (Mais Robusto)
  let keyIdx = -1;
  
  // Lista de possíveis nomes de cabeçalho para cada tipo
  let possibleKeys = [];
  if (type === 'veiculo') possibleKeys = ['FROTA', 'VEICULO', 'PREFIXO', 'ID', 'CODIGO', 'NFROTA', 'NUMEROFROTA'];
  else if (type === 'motorista') possibleKeys = ['LOGIN', 'MATRICULA', 'ID', 'CODIGO'];
  else if (type === 'config') possibleKeys = ['KEY', 'CHAVE'];
  else possibleKeys = ['ID', 'AIT', 'CODIGO']; // Multa

  // Procura coluna chave
  for (let i = 0; i < headers.length; i++) {
      const hNorm = norm(headers[i]);
      if (possibleKeys.some(k => norm(k) === hNorm)) {
          keyIdx = i;
          break;
      }
  }
  
  // Fallback: Para veículos, se não achou, tenta coluna B (índice 1) se coluna A for STATUS
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

  // 4. Procura Linha Existente
  if (keyIdx !== -1 && searchVal !== "") {
    for (let i = 1; i < data.length; i++) {
      const cellVal = norm(data[i][keyIdx]);
      // Compara normalizado E tenta comparar como string simples
      if (cellVal === searchVal || String(data[i][keyIdx]) === String(itemId)) { 
          rowIdx = i + 1; 
          break; 
      }
    }
  }

  // 5. Prepara Dados para Salvar
  const rowValues = headers.map(h => {
      const hNorm = norm(h);
      // Tenta match exato primeiro
      if (item[h] !== undefined) return item[h];
      // Tenta match normalizado
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
  
  let sheetName = 'DADOS';
  if (type === 'veiculo') {
      if (ss.getSheetByName('Frota Completa')) sheetName = 'Frota Completa';
      else if (ss.getSheetByName('FROTA COMPLETA')) sheetName = 'FROTA COMPLETA';
      else if (ss.getSheetByName('FROTA')) sheetName = 'FROTA';
      else if (ss.getSheetByName('FROTAS')) sheetName = 'FROTAS';
      else if (ss.getSheetByName('veiculos')) sheetName = 'veiculos';
      else sheetName = 'Frota Completa';
  } else {
      sheetName = type === 'motorista' ? 'MOTORISTAS' : (type === 'config' ? 'CONFIGS' : (ss.getSheetByName('Multas') ? 'Multas' : 'MULTAS'));
  }
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return "Erro: Aba não encontrada.";
  
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const data = sheet.getDataRange().getValues();

  // Mesma lógica de busca de chave do Save
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

function sendEmailNotification(data) {
  try {
    const to = data.to_email || data.emailTo || "deny.goncalves@risel.com.br";
    const cc = data.cc_email || "";
    const subject = data.subject || ("NOTIFICAÇÃO DE MULTA: PLACA " + (data.placa || "") + " - AIT " + (data.ait || ""));
    const htmlBody = data.message_html || data.htmlBody || "";
    
    const attachments = [];
    
    // 1. Processa anexos do AIT (pode conter múltiplos links ou arquivos)
    if (data.linkAit) {
      const parts = String(data.linkAit).split(/[\\n,;|]+/);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        let fileName = "AIT_" + (data.placa || "MULTA") + (i > 0 ? "_" + (i + 1) : "");
        let fileUrl = part;
        if (part.indexOf("::") !== -1) {
          const segs = part.split("::");
          fileName = segs[0].trim();
          fileUrl = segs.slice(1).join("::").trim();
        }
        const fileId = getFileIdFromUrl(fileUrl);
        if (fileId) {
          const att = getSafeAttachment(fileId, fileName);
          if (att) attachments.push(att);
        }
      }
    }
    
    // 2. Processa anexo da Autorização de Desconto (PDF gerado)
    if (data.linkAuth) {
      const authId = getFileIdFromUrl(data.linkAuth);
      if (authId) {
        const att = getSafeAttachment(authId, "AUTORIZACAO_DESCONTO_" + (data.placa || "MULTA"));
        if (att) attachments.push(att);
      }
    }
    
    // 3. Suporte a arquivos adicionais em base64 enviados diretamente
    if (data.files && Array.isArray(data.files)) {
      for (let i = 0; i < data.files.length; i++) {
        const f = data.files[i];
        if (f && f.data && f.name) {
          const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mimeType || "application/octet-stream", f.name);
          attachments.push(blob);
        }
      }
    }
    
    const emailOptions = {
      to: to,
      subject: subject,
      htmlBody: htmlBody,
      attachments: attachments
    };
    if (cc && cc.trim().length > 0) {
      emailOptions.cc = cc;
    }
    
    MailApp.sendEmail(emailOptions);
    
    return {
      success: true,
      message: "E-mail enviado com sucesso com " + attachments.length + " anexo(s) direto(s) na mensagem!",
      attachmentsCount: attachments.length
    };
  } catch (err) {
    return { success: false, error: "Erro ao enviar e-mail com anexos: " + err.toString() };
  }
}

function getFileIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/[-\\w]{25,}/);
  return match ? match[0] : null;
}

function getSafeAttachment(fileId, preferredName) {
  try {
    const file = DriveApp.getFileById(fileId);
    const mime = file.getMimeType();
    let blob;
    if (mime === MimeType.GOOGLE_DOCS || mime === MimeType.GOOGLE_SHEETS || mime === MimeType.GOOGLE_SLIDES) {
      blob = file.getAs(MimeType.PDF);
    } else {
      blob = file.getBlob();
    }
    if (preferredName) {
      const origName = file.getName();
      const ext = origName.indexOf(".") !== -1 ? origName.split(".").pop() : "";
      if (ext && preferredName.toLowerCase().indexOf("." + ext.toLowerCase()) === -1) {
        blob.setName(preferredName + "." + ext);
      } else {
        blob.setName(preferredName);
      }
    }
    return blob;
  } catch (e) {
    return null;
  }
}`;

const ConfigPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [templateId, setTemplateId] = useState('');
  
  // EmailJS State
  const [emailServiceId, setEmailServiceId] = useState('');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailPublicKey, setEmailPublicKey] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'script' | 'manifest'>('script');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    setUrl(getApiUrl());
    setFolderId(getDriveFolderId());
    setTemplateId(getDocsTemplateId());
    
    // Load Email Config
    const emailConfig = getEmailConfig();
    setEmailServiceId(emailConfig.serviceId);
    setEmailTemplateId(emailConfig.templateId);
    setEmailPublicKey(emailConfig.publicKey);
  }, []);

  const handleSave = async () => {
    setSavingSettings(true);
    
    // 1. Limpa o cache local IMEDIATAMENTE para que as multas antigas desapareçam
    clearCache();
    
    // 2. Salva localmente primeiro para integridade
    setApiUrl(url);
    setDriveConfig(folderId, templateId);
    setEmailConfig(emailServiceId, emailTemplateId, emailPublicKey);
    
    // 3. Tenta sincronizar as configurações com a nuvem (aba CONFIGS da planilha do Google Sheets)
    // Feito de forma SEQUENCIAL para evitar conflitos concorrentes de trava (LockService) e evitar 
    // inserções duplicadas e erros ao criar a nova aba "CONFIGS" simultaneamente.
    try {
        const emailJSON = JSON.stringify({ serviceId: emailServiceId, templateId: emailTemplateId, publicKey: emailPublicKey });
        
        await saveConfigItemApi('risel_drive_folder_id', folderId);
        await saveConfigItemApi('risel_docs_template_id', templateId);
        await saveConfigItemApi('risel_email_config', emailJSON);
        
        setSaved(true);
        setSavingSettings(false);
        setTimeout(() => setSaved(false), 3000);
        
        if (confirm("Configurações salvas localmente, cache redefinido com sucesso e tudo sincronizado com a planilha do Google Sheets! A página será recarregada para aplicar os novos dados.")) {
            window.location.reload();
        }
    } catch (e: any) {
        console.warn("Erro ao sincronizar na planilha:", e);
        setSaved(true);
        setSavingSettings(false);
        setTimeout(() => setSaved(false), 3000);
        
        if (confirm(`Configurações salvas localmente na memória do navegador e cache local limpo. Porém, não foi possível sincronizar na planilha online (${e.message || e}). Deseja atualizar a tela mesmo assim?`)) {
            window.location.reload();
        }
    }
  };

  const handleReset = () => {
      if (confirm("ATENÇÃO: Isso limpará todo o cache local e forçará o download dos dados da planilha novamente. Útil se você trocou de computador ou se os dados não aparecem. Confirmar?")) {
          clearCache();
          window.location.reload();
      }
  };

  const handleTest = async () => {
      setTesting(true);
      setTestResult(null);
      setTestMessage('');
      setApiUrl(url);
      try {
          const start = Date.now();
          const response = await testConnection();
          const duration = Date.now() - start;
          if (response && (response.multas || response.veiculos || response.success === true)) {
              setTestResult('success');
              setTestMessage(`Conexão OK (${duration}ms). Script backend respondendo corretamente.`);
              if (showCode && !response.error) setShowCode(false);
          } else {
              setTestResult('error');
              const errorMsg = response?.error || 'Dados inválidos recebidos.';
              setTestMessage(`Erro no Script: ${errorMsg}`);
              setShowCode(true); 
          }
      } catch (e: any) {
          setTestResult('error');
          setTestMessage(`Falha na conexão: ${e.message}.`);
      } finally {
          setTesting(false);
      }
  }

  const copyCode = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Código copiado com sucesso!");
  };

  const copyHeaders = (headers: string, name: string) => {
      navigator.clipboard.writeText(headers);
      alert(`Cabeçalhos da aba ${name} copiados! Vá para a planilha, selecione a célula A1 e dê Ctrl+V.`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h2>
        <button 
            onClick={handleReset}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center text-sm font-bold border border-red-200 transition-colors"
        >
            <RefreshCw size={16} className="mr-2"/> Limpar Cache & Recarregar
        </button>
      </div>
      
      {/* Conexões e IDs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center">
            <LinkIcon className="mr-2 text-risel-green" /> Conexões & Google Drive
        </h3>
        
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">URL do Script (Web App)</label>
                <input 
                    type="text" 
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                    placeholder="https://script.google.com/macros/s/..."
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        <Folder size={12}/> ID da Pasta Drive (Uploads)
                    </label>
                    <input 
                        type="text" 
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                        placeholder="Ex: 1Fq8e5MM_AOl..."
                        value={folderId}
                        onChange={e => setFolderId(e.target.value)}
                    />
                </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                        <FileJson size={12}/> ID do Modelo Docs (Template)
                    </label>
                    <input 
                        type="text" 
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                        placeholder="Ex: 1B53R29..."
                        value={templateId}
                        onChange={e => setTemplateId(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {testResult && (
            <div className={`mt-4 p-3 rounded-lg border flex items-start ${testResult === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {testResult === 'success' ? <CheckCircle size={18} className="mr-2 mt-0.5 shrink-0"/> : <XCircle size={18} className="mr-2 mt-0.5 shrink-0"/>}
                <span className="text-sm font-bold">{testMessage}</span>
            </div>
        )}
      </div>

      {/* EmailJS Configuration */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center">
            <Mail className="mr-2 text-risel-orange" /> Integração de E-mail (EmailJS)
        </h3>
        <p className="text-xs text-gray-500 mb-4">
            Configure abaixo as credenciais do seu painel EmailJS (https://dashboard.emailjs.com/admin) para habilitar o envio de notificações.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Service ID</label>
                <input 
                    type="text" 
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                    placeholder="service_xxxxx"
                    value={emailServiceId}
                    onChange={e => setEmailServiceId(e.target.value)}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Template ID</label>
                <input 
                    type="text" 
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                    placeholder="template_xxxxx"
                    value={emailTemplateId}
                    onChange={e => setEmailTemplateId(e.target.value)}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Public Key</label>
                <input 
                    type="text" 
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-risel-green focus:outline-none font-mono text-sm"
                    placeholder="Ex: cuqP-0hX..."
                    value={emailPublicKey}
                    onChange={e => setEmailPublicKey(e.target.value)}
                />
            </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
            <button 
                onClick={handleTest} 
                disabled={testing || !url || savingSettings}
                className={`px-4 py-2 rounded-lg font-bold flex items-center shadow-sm transition-all border ${testing ? 'bg-gray-100 text-gray-400 font-bold border-gray-100' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
            >
                {testing ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Radio className="mr-2 text-blue-500" size={18} />}
                {testing ? 'Testando...' : 'Testar Conexão'}
            </button>
            <button 
                onClick={handleSave} 
                disabled={savingSettings}
                className={`text-white px-6 py-2 rounded-lg font-bold flex items-center shadow-lg transition-all active:scale-95 ${savingSettings ? 'bg-gray-400 cursor-not-allowed' : 'bg-risel-green hover:bg-risel-dark'}`}
            >
                {savingSettings ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Save className="mr-2" size={18} />} 
                {savingSettings ? 'Sincronizando...' : (saved ? 'Salvo!' : 'Salvar Tudo')}
            </button>
      </div>

      <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all ${showCode ? 'ring-2 ring-red-400' : ''}`}>
         <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowCode(!showCode)}>
            <h3 className={`font-bold flex items-center ${showCode ? 'text-red-600' : 'text-gray-700'}`}>
                <Code className="mr-2" /> Atualização de Script Necessária (v5.3)
                {showCode && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Atualizar Agora</span>}
            </h3>
            <span className="text-sm text-blue-600 font-bold hover:underline">{showCode ? 'Ocultar' : 'Mostrar'}</span>
         </div>
         
         {showCode && (
             <div className="mt-4 animate-in fade-in">
                 
                 <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
                    <h4 className="font-black text-emerald-800 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2 text-emerald-600"/> INSTRUÇÕES DE ATUALIZAÇÃO v5.4 (ANEXOS DIRETOS NO E-MAIL)</h4>
                    <p className="text-sm text-emerald-800 mb-2">
                        Esta versão 5.4 retoma o <strong>envio dos arquivos de multas (AIT e Autorização de Desconto) diretamente como anexos reais no e-mail</strong>, sem a necessidade de links externos para baixar!
                    </p>
                    <ol className="list-decimal ml-5 text-sm text-emerald-800 space-y-1 font-bold">
                        <li>Copie o script da aba <strong>1. Script (Código.gs)</strong> e cole no Apps Script.</li>
                        <li>Copie o manifesto da aba <strong>2. Manifesto (JSON)</strong> (com a permissão de e-mail) e cole no <code>appsscript.json</code>.</li>
                        <li>Clique em <strong>Implantar &gt; Gerenciar Implantações &gt; Editar &gt; Nova Versão</strong> (ou Nova Implantação).</li>
                        <li>Caso altere a URL, atualize-a no campo acima e clique em Salvar Configurações.</li>
                    </ol>
                 </div>

                 <div className="flex space-x-2 border-b border-gray-200 mb-4">
                     <button onClick={() => setActiveTab('script')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'script' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        1. Script (Código.gs)
                     </button>
                     <button onClick={() => setActiveTab('manifest')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center ${activeTab === 'manifest' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <FileJson size={14} className="mr-1"/> 2. Manifesto (JSON)
                     </button>
                 </div>

                 {activeTab === 'script' && (
                    <>
                        <div className="relative">
                            <textarea readOnly className="w-full h-80 bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-lg outline-none custom-scrollbar leading-5" value={SCRIPT_CODE}/>
                            <button onClick={() => copyCode(SCRIPT_CODE)} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-md backdrop-blur-sm transition-colors border border-white/10 shadow-lg"><Copy size={16} /></button>
                        </div>
                    </>
                 )}

                 {activeTab === 'manifest' && (
                    <>
                        <div className="relative">
                            <textarea readOnly className="w-full h-64 bg-slate-900 text-emerald-300 font-mono text-xs p-4 rounded-lg outline-none custom-scrollbar leading-5" value={MANIFEST_CODE}/>
                            <button onClick={() => copyCode(MANIFEST_CODE)} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-md backdrop-blur-sm transition-colors border border-white/10 shadow-lg"><Copy size={16} /></button>
                        </div>
                    </>
                 )}

             </div>
         )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
         <h3 className="font-bold text-gray-700 mb-4 flex items-center">
            <Table className="mr-2 text-risel-green" /> Estrutura das Planilhas
        </h3>
        <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded border border-gray-200">
            Copie os cabeçalhos abaixo e cole na <strong>linha 1 (Célula A1)</strong> das respectivas abas.
        </p>

        <div className="space-y-4">
             <div className="border border-gray-200 rounded-lg p-3">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-1 rounded">Aba: MULTAS</span>
                    <button onClick={() => copyHeaders(HEADERS_MULTAS, 'MULTAS')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"><Copy size={12} className="mr-1"/> Copiar</button>
                 </div>
             </div>
             <div className="border border-gray-200 rounded-lg p-3">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-purple-800 uppercase bg-purple-100 px-2 py-1 rounded">Aba: MOTORISTAS</span>
                    <button onClick={() => copyHeaders(HEADERS_MOTORISTAS, 'MOTORISTAS')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"><Copy size={12} className="mr-1"/> Copiar</button>
                 </div>
             </div>
              <div className="border border-gray-200 rounded-lg p-3">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-orange-800 uppercase bg-orange-100 px-2 py-1 rounded">Aba: FROTA (Colunas A-P)</span>
                    <button onClick={() => copyHeaders(HEADERS_VEICULOS, 'FROTAS')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"><Copy size={12} className="mr-1"/> Copiar</button>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;

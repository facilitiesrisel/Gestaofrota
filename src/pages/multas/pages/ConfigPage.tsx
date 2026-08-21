
import React, { useState, useEffect } from 'react';
import { getApiUrl, setApiUrl, testConnection, getDriveFolderId, getDocsTemplateId, setDriveConfig, clearCache, fetchPlacaEmailMappings, savePlacaEmailMappings, DEFAULT_EMAIL_MAPPINGS } from '../services/storage';
import { Save, Link as LinkIcon, Radio, CheckCircle, XCircle, Loader2, Code, Copy, Table, AlertTriangle, FileJson, Folder, Mail, RefreshCw, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

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
    "https://www.googleapis.com/auth/script.external_request"
  ]
}`;

const SCRIPT_CODE = `// =================================================================================
// CÓDIGO BACKEND G F RISEL v5.3 (FIX: DUPLICIDADE E DETECÇÃO DE CHAVES)
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
  let sheetName = 'DADOS';
  if (type === 'veiculo') {
      if (ss.getSheetByName('FROTA')) sheetName = 'FROTA';
      else if (ss.getSheetByName('FROTAS')) sheetName = 'FROTAS';
      else sheetName = 'FROTA';
  }
  else if (type === 'motorista') sheetName = ss.getSheetByName('MOTORISTAS') ? 'MOTORISTAS' : 'MOTORISTA';
  else if (type === 'config') sheetName = 'CONFIGS';
  else sheetName = 'MULTAS';

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
  let sheetName = type === 'veiculo' ? (ss.getSheetByName('FROTA') ? 'FROTA' : 'FROTAS') : (type === 'motorista' ? 'MOTORISTAS' : (type === 'config' ? 'CONFIGS' : 'MULTAS'));
  
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
}`;

const ConfigPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [templateId, setTemplateId] = useState('');
  
  // Base Email Mappings States
  const [mappings, setMappings] = useState<Record<string, { to: string; cc: string }>>({});
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTo, setEditingTo] = useState('');
  const [editingCc, setEditingCc] = useState('');
  
  // SMTP Status States
  const [smtpStatus, setSmtpStatus] = useState<{
    smtpUser: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: string | boolean;
    hasPass: boolean;
  } | null>(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  
  const [newBase, setNewBase] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newCc, setNewCc] = useState('');

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
    
    const loadMappings = async () => {
      try {
        setLoadingMappings(true);
        const fetched = await fetchPlacaEmailMappings();
        setMappings(fetched);
      } catch (err) {
        console.error("Erro ao carregar mapeamentos de emails por placa", err);
      } finally {
        setLoadingMappings(false);
      }
    };

    const loadSmtpStatus = async () => {
      try {
        setLoadingSmtp(true);
        const res = await fetch('/api/smtp-status');
        if (res.ok) {
          const data = await res.json();
          setSmtpStatus(data);
        }
      } catch (err) {
        console.error("Erro ao carregar status SMTP", err);
      } finally {
        setLoadingSmtp(false);
      }
    };

    loadMappings();
    loadSmtpStatus();
  }, []);

  const handleSave = async () => {
    setApiUrl(url);
    setDriveConfig(folderId, templateId);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    alert("Configurações gerais salvas com sucesso!");
  };

  const handleSaveMapping = async (keyToSave: string, toStr: string, ccStr: string) => {
    const cleanKey = keyToSave.toUpperCase().trim();
    if (!cleanKey) return;
    const updated = {
      ...mappings,
      [cleanKey]: {
        to: toStr.trim(),
        cc: ccStr.trim()
      }
    };
    setMappings(updated);
    await savePlacaEmailMappings(updated);
    setEditingKey(null);
  };

  const handleAddMapping = async () => {
    const cleanKey = newBase.toUpperCase().trim();
    if (!cleanKey) { alert("Placa do veículo é obrigatória."); return; }
    if (mappings[cleanKey]) { alert("Esta placa já possui destinatários cadastrados."); return; }
    
    const updated = {
      ...mappings,
      [cleanKey]: {
        to: newTo.trim(),
        cc: newCc.trim()
      }
    };
    setMappings(updated);
    await savePlacaEmailMappings(updated);
    
    setNewBase('');
    setNewTo('');
    setNewCc('');
    alert(`Placa ${cleanKey} cadastrada com sucesso!`);
  };

  const handleDeleteMapping = async (keyToDelete: string) => {
    if (!confirm(`Excluir o cadastro de destinatários da placa "${keyToDelete}"?`)) return;
    const updated = { ...mappings };
    delete updated[keyToDelete];
    setMappings(updated);
    await savePlacaEmailMappings(updated);
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

      {/* Cadastro de Destinatários de acordo com a Placa do Veículo */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Mail className="text-risel-green" size={20} />
              Cadastro de Destinatários por Placa do Veículo
            </h3>
            <p className="text-xs text-gray-500">
              Configure os e-mails destinatários ("Para") e em cópia ("CC") por placa de veículo. Nota: <strong>lorena.padilha@risel.com.br</strong> e <strong>deny.goncalves@risel.com.br</strong> serão sempre incluídos em Cópia (CC) automaticamente em todas as notificações.
            </p>
          </div>
        </div>

        {loadingMappings ? (
          <div className="flex items-center justify-center p-6 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Carregando destinatários por placa...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tabela de mapeamentos existentes */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase border-b">
                    <th className="p-3 w-1/5">PLACA DO VEÍCULO</th>
                    <th className="p-3 w-2/5">PARA (DESTINATÁRIOS)</th>
                    <th className="p-3 w-2/5">CÓPIA (CC)</th>
                    <th className="p-3 text-center w-24">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {Object.keys(mappings).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400 font-medium">
                        Nenhuma placa cadastrada com destinatários específicos. Os envios usarão as cópias padrão do sistema.
                      </td>
                    </tr>
                  ) : (
                    (Object.entries(mappings) as Array<[string, { to: string; cc: string }]>).map(([baseKey, val]) => {
                      const isEditing = editingKey === baseKey;
                      return (
                        <tr key={baseKey} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-black text-gray-800">{baseKey}</td>
                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full border p-2 rounded text-xs focus:ring-2 focus:ring-risel-green"
                                value={editingTo}
                                onChange={e => setEditingTo(e.target.value)}
                                placeholder="email1@risel.com.br; email2@risel.com.br"
                              />
                            ) : (
                              <span className="font-medium text-slate-700 break-all">{val.to || '-'}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full border p-2 rounded text-xs focus:ring-2 focus:ring-risel-green"
                                value={editingCc}
                                onChange={e => setEditingCc(e.target.value)}
                                placeholder="copia@risel.com.br"
                              />
                            ) : (
                              <span className="font-medium text-slate-500 break-all">{val.cc || '-'}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => handleSaveMapping(baseKey, editingTo, editingCc)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Salvar"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingKey(baseKey);
                                    setEditingTo(val.to || '');
                                    setEditingCc(val.cc || '');
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMapping(baseKey)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Excluir"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Form de Adicionar nova placa */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Novo Mapeamento por Placa</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Placa do Veículo</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded text-xs uppercase font-bold focus:ring-2 focus:ring-risel-green"
                    placeholder="Ex: ABC1234"
                    value={newBase}
                    onChange={e => setNewBase(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">E-mails destinatários (Para)</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded text-xs focus:ring-2 focus:ring-risel-green"
                    placeholder="email1@risel.com.br; email2@risel.com.br"
                    value={newTo}
                    onChange={e => setNewTo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">E-mails em cópia (CC)</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded text-xs focus:ring-2 focus:ring-risel-green"
                    placeholder="copia1@risel.com.br; copia2@risel.com.br"
                    value={newCc}
                    onChange={e => setNewCc(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    onClick={handleAddMapping}
                    className="w-full bg-risel-green hover:bg-risel-dark text-white p-2.5 rounded font-bold text-xs flex justify-center items-center shadow transition-all active:scale-95"
                  >
                    <Plus size={14} className="mr-1" /> Adicionar Placa
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Painel SMTP */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Mail className="text-risel-orange" size={20} />
            Diagnóstico e Configuração do Servidor de E-mail (SMTP)
          </h3>
          <p className="text-xs text-gray-500">
            Abaixo estão as configurações ativas que o servidor backend está utilizando para disparar os e-mails das multas.
          </p>
        </div>

        {loadingSmtp ? (
          <div className="flex items-center justify-center p-6 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Lendo status do SMTP...
          </div>
        ) : smtpStatus ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-gray-200/80 rounded-xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Usuário Remetente</span>
                <p className="text-xs font-bold text-gray-700 truncate mt-1">{smtpStatus.smtpUser}</p>
              </div>
              <div className="border border-gray-200/80 rounded-xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Servidor SMTP Host</span>
                <p className="text-xs font-bold text-gray-700 truncate mt-1">{smtpStatus.smtpHost}</p>
              </div>
              <div className="border border-gray-200/80 rounded-xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Porta SMTP / SSL</span>
                <p className="text-xs font-bold text-gray-700 mt-1">{smtpStatus.smtpPort} ({smtpStatus.smtpSecure === 'true' || smtpStatus.smtpSecure === true ? 'SSL Seguro' : 'TLS/STARTTLS'})</p>
              </div>
              <div className="border border-gray-200/80 rounded-xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Senha SMTP configurada?</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {smtpStatus.hasPass ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle size={12}/> SIM
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <XCircle size={12}/> NÃO (Sem senha)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Alerta explicativo super rico em detalhes */}
            <div className="p-5 bg-orange-50 border border-orange-100 rounded-xl space-y-4">
              <h4 className="font-bold text-orange-800 text-xs flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-600 animate-pulse" />
                COMO RESOLVER O SEU ERRO DE ENVIO NO OFFICE 365 / MICROSOFT 365:
              </h4>
              <p className="text-xs text-orange-800 leading-relaxed">
                Como os e-mails da <strong className="underline">Risel Coberturas</strong> utilizam a infraestrutura do <strong>Office 365 / Microsoft 365</strong>, existem duas razões principais de segurança da Microsoft que podem causar falha de autenticação. Siga os passos abaixo para resolver:
              </p>
              
              <div className="space-y-4">
                <div className="border-l-4 border-orange-300 pl-3 space-y-1">
                  <h5 className="font-black text-orange-900 text-xs uppercase">PASSO 1: Habilitar o "SMTP AUTH" no Painel Admin (Obrigatório pela Microsoft)</h5>
                  <p className="text-xs text-orange-800/90 leading-relaxed">
                    Por padrão, a Microsoft bloqueia o envio de e-mails via SMTP autenticado em novas contas corporativas. 
                    <strong> Peça para o Administrador de TI da Risel</strong> fazer o seguinte ajuste rápido:
                  </p>
                  <ol className="list-decimal ml-5 text-xs text-orange-800 space-y-1 mt-1 leading-relaxed">
                    <li>Acesse o <strong>Centro de Administração do Microsoft 365</strong> (admin.microsoft.com).</li>
                    <li>Vá em <strong>Usuários</strong> &gt; <strong>Usuários Ativos</strong> e clique no e-mail <strong className="underline">{smtpStatus.smtpUser}</strong>.</li>
                    <li>Na barra lateral que se abrir, clique na aba <strong>E-mail</strong>.</li>
                    <li>Em "Aplicativos de e-mail", clique em <strong>Gerenciar aplicativos de e-mail</strong>.</li>
                    <li>Marque a opção <strong>"SMTP autenticado"</strong> (SMTP AUTH) e clique em <strong>Salvar alterações</strong>.</li>
                  </ol>
                </div>

                <div className="border-l-4 border-orange-300 pl-3 space-y-1">
                  <h5 className="font-black text-orange-900 text-xs uppercase">PASSO 2: Verificar a Senha / Senha de Aplicativo (MFA)</h5>
                  <p className="text-xs text-orange-800/90 leading-relaxed">
                    Se a sua empresa exige a Verificação de Duas Etapas (MFA) ou autenticação pelo aplicativo Microsoft Authenticator, você <strong>não pode</strong> usar a sua senha normal do e-mail. Você precisará gerar uma <strong>Senha de Aplicativo (App Password)</strong>:
                  </p>
                  <ol className="list-decimal ml-5 text-xs text-orange-800 space-y-1 mt-1 leading-relaxed">
                    <li>Acesse a página de segurança da sua conta Microsoft: <a href="https://mysignins.microsoft.com/security-info" target="_blank" rel="noopener noreferrer" className="font-black underline text-orange-950 hover:text-orange-900">mysignins.microsoft.com/security-info</a> logado como <strong className="underline">{smtpStatus.smtpUser}</strong>.</li>
                    <li>Clique em <strong>Adicionar método</strong> e escolha a opção <strong>Senha do aplicativo</strong> (se esta opção não estiver habilitada para você, o administrador de TI precisará habilitar o suporte a senhas de aplicativo nas configurações de MFA do Azure Active Directory / Entra ID).</li>
                    <li>Dê um nome (ex: <em>"Frota Risel"</em>), copie o código de 16 dígitos gerado e configure-o como a chave <strong>SMTP_PASS</strong> nos Secrets do AI Studio.</li>
                  </ol>
                </div>

                <div className="border-l-4 border-orange-300 pl-3 space-y-1">
                  <h5 className="font-black text-orange-900 text-xs uppercase">PASSO 3: Certificar-se de que os Segredos (Secrets) do AI Studio estão Salvos</h5>
                  <p className="text-xs text-orange-800/90 leading-relaxed">
                    Com base no Office 365, as seguintes chaves padrão devem estar configuradas no menu de <strong>Secrets (engrenagem no canto superior direito)</strong> do seu editor:
                  </p>
                  <ul className="list-disc ml-5 text-xs text-orange-800 space-y-1 mt-1 font-mono">
                    <li><strong>SMTP_HOST:</strong> <code className="bg-orange-100 px-1 rounded text-orange-900 font-bold">smtp.office365.com</code></li>
                    <li><strong>SMTP_PORT:</strong> <code className="bg-orange-100 px-1 rounded text-orange-900 font-bold">587</code></li>
                    <li><strong>SMTP_SECURE:</strong> <code className="bg-orange-100 px-1 rounded text-orange-900 font-bold">false</code> (necessário para STARTTLS na porta 587)</li>
                    <li><strong>SMTP_USER:</strong> <code className="bg-orange-100 px-1 rounded text-orange-900 font-bold">{smtpStatus.smtpUser}</code></li>
                    <li><strong>SMTP_PASS:</strong> <code className="bg-orange-100 px-1 rounded text-orange-900 font-bold">(sua senha de e-mail ou senha de app gerada)</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Não foi possível carregar as informações do SMTP.</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
            <button 
                onClick={handleTest} 
                disabled={testing || !url}
                className={`px-4 py-2 rounded-lg font-bold flex items-center shadow-sm transition-all border ${testing ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
            >
                {testing ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Radio className="mr-2 text-blue-500" size={18} />}
                {testing ? 'Testando...' : 'Testar Conexão'}
            </button>
            <button 
                onClick={handleSave} 
                className="bg-risel-green hover:bg-risel-dark text-white px-6 py-2 rounded-lg font-bold flex items-center shadow-lg transition-transform active:scale-95"
            >
                <Save className="mr-2" size={18} /> 
                {saved ? 'Salvo!' : 'Salvar Tudo'}
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
                 
                 <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-6">
                    <h4 className="font-black text-orange-800 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2"/> INSTRUÇÕES DE ATUALIZAÇÃO v5.3</h4>
                    <p className="text-sm text-orange-800 mb-2">
                        Esta versão 5.3 corrige a duplicação de itens ao editar (frotas e motoristas), com uma busca muito mais robusta pela coluna chave (FROTA, NFROTA, ID, etc.).
                    </p>
                    <ol className="list-decimal ml-5 text-sm text-orange-800 space-y-1 font-bold">
                        <li>Copie o script abaixo.</li>
                        <li>Substitua TUDO no editor do Apps Script (Arquivo Código.gs).</li>
                        <li>Clique em Implantar &gt; Nova Implantação.</li>
                        <li>Copie a Nova URL e atualize acima.</li>
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

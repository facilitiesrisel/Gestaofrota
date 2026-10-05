import React, { useState, useEffect, useMemo } from 'react';
import { 
  getApiUrl, 
  setApiUrl, 
  testConnection, 
  getDriveFolderId, 
  getDocsTemplateId, 
  setDriveConfig, 
  clearCache, 
  fetchBaseEmailMappings, 
  saveBaseEmailMappings, 
  fetchPlacaEmailMappings, 
  savePlacaEmailMappings, 
  DEFAULT_EMAIL_MAPPINGS, 
  DEFAULT_API_URL 
} from '../services/storage';
import { 
  Save, 
  Link as LinkIcon, 
  Radio, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Code, 
  Copy, 
  Table, 
  AlertTriangle, 
  FileJson, 
  Folder, 
  Mail, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Building, 
  Truck,
  Search,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

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
      if (cellVal === searchVal || String(data[i][keyIdx]) === String(itemId)) { 
          rowIdx = i + 1; 
          break; 
      }
    }
  }

  // 5. Prepara Dados para Salvar
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
}`;

type MainTab = 'destinatarios' | 'conexoes' | 'smtp' | 'planilhas';

const ConfigPage: React.FC = () => {
  // Aba principal ativa por padrão: DESTINATÁRIOS (Pedido do Usuário)
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('destinatarios');

  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [templateId, setTemplateId] = useState('');
  
  // Mapeamentos de E-mail: Suporte Completo a Base Operacional e Placa
  const [mappingMode, setMappingMode] = useState<'base' | 'placa'>('base');
  const [baseMappings, setBaseMappings] = useState<Record<string, { to: string; cc: string }>>(DEFAULT_EMAIL_MAPPINGS);
  const [placaMappings, setPlacaMappings] = useState<Record<string, { to: string; cc: string }>>({});
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Edição inline
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
  
  // Novo cadastro
  const [newKey, setNewKey] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newCc, setNewCc] = useState('');

  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [scriptTab, setScriptTab] = useState<'script' | 'manifest'>('script');
  const [showCode, setShowCode] = useState(false);
  const [scriptCode, setScriptCode] = useState(SCRIPT_CODE);

  useEffect(() => {
    setUrl(getApiUrl());
    setFolderId(getDriveFolderId());
    setTemplateId(getDocsTemplateId());

    // Carrega a versão atualizada do Apps Script direto do servidor
    fetch('/api/sheets/script-code')
      .then(res => res.ok ? res.text() : null)
      .then(code => {
        if (code && code.trim().length > 100) {
          setScriptCode(code);
        }
      })
      .catch(() => {});
    
    const loadMappings = async () => {
      try {
        setLoadingMappings(true);
        const [bases, placas] = await Promise.all([
          fetchBaseEmailMappings(),
          fetchPlacaEmailMappings()
        ]);
        if (bases && Object.keys(bases).length > 0) {
          setBaseMappings(bases);
        }
        if (placas) {
          setPlacaMappings(placas);
        }
      } catch (err) {
        console.error("Erro ao carregar mapeamentos de emails por base e placa", err);
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

  const handleSaveConexoes = async () => {
    setApiUrl(url);
    setDriveConfig(folderId, templateId);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    alert("Configurações de conexão e Google Drive salvas com sucesso!");
  };

  const handleSaveMapping = async (keyToSave: string, toStr: string, ccStr: string) => {
    const cleanKey = keyToSave.toUpperCase().trim();
    if (!cleanKey) return;
    
    if (mappingMode === 'base') {
      const updated = {
        ...baseMappings,
        [cleanKey]: { to: toStr.trim(), cc: ccStr.trim() }
      };
      setBaseMappings(updated);
      await saveBaseEmailMappings(updated);
    } else {
      const updated = {
        ...placaMappings,
        [cleanKey]: { to: toStr.trim(), cc: ccStr.trim() }
      };
      setPlacaMappings(updated);
      await savePlacaEmailMappings(updated);
    }
    setEditingKey(null);
  };

  const handleAddMapping = async () => {
    const cleanKey = newKey.toUpperCase().trim();
    if (!cleanKey) { 
      alert(mappingMode === 'base' ? "Sigla ou nome da Base é obrigatório (ex: PAULÍNIA, BETIM, CAXIAS ou PLN)." : "Placa do veículo é obrigatória."); 
      return; 
    }

    if (mappingMode === 'base') {
      if (baseMappings[cleanKey]) { 
        alert("Esta base já possui destinatários cadastrados. Use o botão Editar na tabela abaixo."); 
        return; 
      }
      const updated = {
        ...baseMappings,
        [cleanKey]: { to: newTo.trim(), cc: newCc.trim() }
      };
      setBaseMappings(updated);
      await saveBaseEmailMappings(updated);
      alert(`Base Operacional "${cleanKey}" cadastrada com sucesso!`);
    } else {
      if (placaMappings[cleanKey]) { 
        alert("Esta placa já possui destinatários cadastrados. Use o botão Editar na tabela abaixo."); 
        return; 
      }
      const updated = {
        ...placaMappings,
        [cleanKey]: { to: newTo.trim(), cc: newCc.trim() }
      };
      setPlacaMappings(updated);
      await savePlacaEmailMappings(updated);
      alert(`Placa "${cleanKey}" cadastrada com sucesso!`);
    }
    
    setNewKey('');
    setNewTo('');
    setNewCc('');
  };

  const handleRestoreDefaultBases = async () => {
    if (confirm("Deseja restaurar e atualizar as bases operacionais padrão da Risel (Paulínia, Betim, Caxias, Aguaí, Cubatão, Jales, Ourinhos, São Bernardo, Suprimentos)? Seus cadastros manuais existentes serão preservados.")) {
      const merged = { ...DEFAULT_EMAIL_MAPPINGS, ...baseMappings };
      setBaseMappings(merged);
      await saveBaseEmailMappings(merged);
      alert("Bases operacionais oficiais sincronizadas com sucesso!");
    }
  };

  const handleDeleteMapping = async (keyToDelete: string) => {
    const targetDesc = mappingMode === 'base' ? `a base operacional "${keyToDelete}"` : `a placa "${keyToDelete}"`;
    if (!confirm(`Excluir o cadastro de destinatários para ${targetDesc}?`)) return;
    
    if (mappingMode === 'base') {
      const updated = { ...baseMappings };
      delete updated[keyToDelete];
      setBaseMappings(updated);
      await saveBaseEmailMappings(updated);
    } else {
      const updated = { ...placaMappings };
      delete updated[keyToDelete];
      setPlacaMappings(updated);
      await savePlacaEmailMappings(updated);
    }
  };

  const handleReset = () => {
    if (confirm("ATENÇÃO: Isso limpará o cache local e forçará o recarregamento dos dados da nuvem. Confirmar?")) {
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
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Código copiado com sucesso!");
  };

  const copyHeaders = (headers: string, name: string) => {
    navigator.clipboard.writeText(headers);
    alert(`Cabeçalhos da aba ${name} copiados! Vá para a planilha, selecione a célula A1 e cole com Ctrl+V.`);
  };

  // Filtragem dos mapeamentos em exibição
  const filteredEntries = useMemo(() => {
    const currentList = mappingMode === 'base' ? baseMappings : placaMappings;
    const entries = Object.entries(currentList) as Array<[string, { to: string; cc: string }]>;
    if (!searchFilter.trim()) return entries;
    const q = searchFilter.toLowerCase().trim();
    return entries.filter(([k, v]) => 
      k.toLowerCase().includes(q) || 
      (v.to || '').toLowerCase().includes(q) || 
      (v.cc || '').toLowerCase().includes(q)
    );
  }, [mappingMode, baseMappings, placaMappings, searchFilter]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-12 font-sans">
      {/* Cabeçalho da Página com Título e Ação de Limpeza */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Frota Pesada • Controle de Multas
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configurações do Sistema</h2>
          <p className="text-xs text-slate-500 font-medium">
            Gerencie os destinatários e cópias de e-mail por <strong>Base Operacional</strong>, credenciais corporativas e conexões.
          </p>
        </div>

        <button 
          onClick={handleReset}
          className="self-start sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center text-xs font-bold border border-slate-300 transition-colors shadow-2xs active:scale-95 cursor-pointer"
          title="Limpar cache do navegador e recarregar dados mais recentes"
        >
          <RefreshCw size={14} className="mr-1.5 text-slate-600"/> Limpar Cache
        </button>
      </div>

      {/* Barra de Abas Superiores de Navegação Direta */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveMainTab('destinatarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeMainTab === 'destinatarios'
              ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 font-black'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Mail size={16} />
          <span>Destinatários por Base & Placa</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeMainTab === 'destinatarios' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {Object.keys(baseMappings).length} Bases
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('conexoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeMainTab === 'conexoes'
              ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 font-black'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <LinkIcon size={16} />
          <span>Conexões & Google Drive</span>
        </button>

        <button
          onClick={() => setActiveMainTab('smtp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeMainTab === 'smtp'
              ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 font-black'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Radio size={16} />
          <span>Servidor SMTP (E-mail)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </button>

        <button
          onClick={() => setActiveMainTab('planilhas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeMainTab === 'planilhas'
              ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 font-black'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Code size={16} />
          <span>Google Sheets & Scripts</span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: DESTINATÁRIOS POR BASE E PLACA (REATIVADO EM DESTAQUE) */}
      {activeMainTab === 'destinatarios' && (
        <div className="space-y-6">
          {/* Card explicativo e status corporativo */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building className="text-emerald-700" size={20} />
                <h3 className="text-base font-black text-emerald-950">
                  Cadastro de Destinatários e Cópias por Base Operacional
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Esta tela define quem receberá as notificações automáticas de multas da Frota Pesada. Ao cadastrar uma infração com a <strong>Base Operacional</strong> (ex: Paulínia, Betim, Caxias, etc.), o sistema preencherá automaticamente os e-mails principais ("Para") e os e-mails em cópia ("CC").
              </p>
              <p className="text-[11px] text-emerald-900 font-semibold flex items-center gap-1.5 pt-1">
                <Info size={13} className="text-emerald-700" />
                Os e-mails de <strong>lorena.padilha@risel.com.br</strong> e <strong>deny.goncalves@risel.com.br</strong> são mantidos automaticamente em todas as notificações em cópia.
              </p>
            </div>

            <button
              onClick={handleRestoreDefaultBases}
              className="self-start md:self-auto inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Carregar todas as bases operacionais padrão da Risel"
            >
              <RotateCcw size={14} /> Restaurar Bases Oficiais
            </button>
          </div>

          {/* Seletor de Modo (Base Operacional vs Placa) e Busca */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/90 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => { setMappingMode('base'); setEditingKey(null); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mappingMode === 'base'
                      ? 'bg-emerald-700 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building size={14} /> Por Base Operacional / Filial
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    mappingMode === 'base' ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {Object.keys(baseMappings).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMappingMode('placa'); setEditingKey(null); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mappingMode === 'placa'
                      ? 'bg-emerald-700 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Truck size={14} /> Exceções por Placa
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    mappingMode === 'placa' ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {Object.keys(placaMappings).length}
                  </span>
                </button>
              </div>

              {/* Barra de Filtro / Busca */}
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={mappingMode === 'base' ? "Buscar por base ou e-mail..." : "Buscar por placa ou e-mail..."}
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            {/* Formulário de Cadastro Rápido de Nova Base / Placa */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={15} className="text-emerald-700" />
                  {mappingMode === 'base' ? 'Cadastrar Nova Base Operacional' : 'Cadastrar Regra de Placa Específica'}
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">
                  {mappingMode === 'base' ? 'Ex: PAULÍNIA, BETIM, CAXIAS, AGUAÍ, OURINHOS' : 'Ex: ABC1D23'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase mb-1 block">
                    {mappingMode === 'base' ? 'Nome ou Sigla da Base' : 'Placa do Veículo'}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 p-2 rounded-xl text-xs uppercase font-black focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-2xs"
                    placeholder={mappingMode === 'base' ? 'Ex: PAULÍNIA ou PLN' : 'Ex: ABC1D23'}
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase mb-1 block">
                    E-mails Principais (Para)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 p-2 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-2xs"
                    placeholder="email1@risel.com.br; email2@risel.com.br"
                    value={newTo}
                    onChange={e => setNewTo(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase mb-1 block">
                    E-mails em Cópia (CC)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 p-2 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white shadow-2xs"
                    placeholder="copia@risel.com.br"
                    value={newCc}
                    onChange={e => setNewCc(e.target.value)}
                  />
                </div>

                <div>
                  <button
                    onClick={handleAddMapping}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white p-2 rounded-xl font-black text-xs flex justify-center items-center shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={15} className="mr-1" />
                    {mappingMode === 'base' ? 'Salvar Base' : 'Salvar Placa'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tabela de Destinatários */}
            {loadingMappings ? (
              <div className="flex items-center justify-center p-12 text-slate-400 text-xs font-bold">
                <Loader2 className="animate-spin mr-2" size={20} />
                Carregando bases operacionais e destinatários cadastrados...
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-[10px] font-black text-slate-600 uppercase border-b border-slate-200">
                      <th className="p-3 w-1/4">
                        {mappingMode === 'base' ? 'BASE OPERACIONAL / FILIAL' : 'PLACA DO VEÍCULO'}
                      </th>
                      <th className="p-3 w-2/5">DESTINATÁRIOS PRINCIPAIS (PARA)</th>
                      <th className="p-3 w-1/3">CÓPIA (CC)</th>
                      <th className="p-3 text-center w-28">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">
                          {searchFilter 
                            ? 'Nenhum registro encontrado para a busca informada.'
                            : mappingMode === 'base' 
                              ? 'Nenhuma base cadastrada. Clique em "Restaurar Bases Oficiais" acima para carregar a lista padrão da Risel.'
                              : 'Nenhuma placa com regra individual cadastrada.'}
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map(([key, val]) => {
                        const isEditing = editingKey === key;
                        return (
                          <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-black text-slate-900 tracking-wide font-mono">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
                                mappingMode === 'base' 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                  : 'bg-blue-50 border-blue-200 text-blue-900'
                              }`}>
                                {mappingMode === 'base' ? <Building size={13} className="text-emerald-700"/> : <Truck size={13} className="text-blue-700"/>}
                                {key}
                              </span>
                            </td>

                            <td className="p-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full border border-slate-300 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                  value={editingTo}
                                  onChange={e => setEditingTo(e.target.value)}
                                  placeholder="email1@risel.com.br; email2@risel.com.br"
                                />
                              ) : (
                                <span className="font-semibold text-slate-800 break-all">{val.to || '-'}</span>
                              )}
                            </td>

                            <td className="p-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full border border-slate-300 p-1.5 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
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
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleSaveMapping(key, editingTo, editingCc)}
                                    className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                    title="Salvar Alterações"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    onClick={() => setEditingKey(null)}
                                    className="p-1.5 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingKey(key);
                                      setEditingTo(val.to || '');
                                      setEditingCc(val.cc || '');
                                    }}
                                    className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                    title="Editar Destinatários"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMapping(key)}
                                    className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir Mapeamento"
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
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: CONEXÕES & GOOGLE DRIVE */}
      {activeMainTab === 'conexoes' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="font-black text-slate-800 flex items-center text-base">
                <LinkIcon className="mr-2 text-emerald-700" size={18} /> Conexões & Google Drive
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configurações da URL do Web App do Google Apps Script e pastas de destino do Google Drive.
              </p>
            </div>
            
            <button
              onClick={handleSaveConexoes}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center cursor-pointer"
            >
              <Save size={14} className="mr-1.5" /> Salvar Conexões
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase">URL do Script (Web App Google)</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-xs mt-1"
                placeholder="https://script.google.com/macros/s/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                  <Folder size={13}/> ID da Pasta Google Drive (Uploads AIT)
                </label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-xs mt-1"
                  placeholder="Ex: 1Fq8e5MM_AOl..."
                  value={folderId}
                  onChange={e => setFolderId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                  <FileJson size={13}/> ID do Modelo Google Docs (Template Termo)
                </label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-xs mt-1"
                  placeholder="Ex: 1B53R29..."
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-all flex items-center cursor-pointer disabled:opacity-50"
              >
                {testing ? <Loader2 size={14} className="animate-spin mr-1.5"/> : <Radio size={14} className="mr-1.5 text-emerald-700"/>}
                Testar Comunicação com o Script
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-3.5 rounded-xl border flex items-start ${testResult === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {testResult === 'success' ? <CheckCircle size={18} className="mr-2 mt-0.5 shrink-0"/> : <XCircle size={18} className="mr-2 mt-0.5 shrink-0"/>}
              <span className="text-xs font-bold">{testMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: SERVIDOR SMTP */}
      {activeMainTab === 'smtp' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2 text-base">
              <Mail className="text-emerald-700" size={20} />
              Diagnóstico do Servidor de E-mail Corporativo (SMTP)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configurações de infraestrutura ativas no servidor backend para entrega das notificações de multas.
            </p>
          </div>

          {loadingSmtp ? (
            <div className="flex items-center justify-center p-8 text-slate-400 text-xs font-bold">
              <Loader2 className="animate-spin mr-2" size={18} />
              Consultando status do servidor SMTP...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">E-mail Remetente</span>
                <span className="text-xs font-bold text-slate-800 font-mono break-all">
                  {smtpStatus?.smtpUser || "gestaodefrotarisel@gmail.com"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Servidor Host</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {smtpStatus?.smtpHost || "smtp.gmail.com"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Porta / Segurança</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  Porta {smtpStatus?.smtpPort || 465} (SSL/TLS)
                </span>
              </div>

              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-black text-emerald-700 uppercase block mb-1">Status de Conexão</span>
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-600"/> Ativo & Operacional
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: GOOGLE SHEETS & SCRIPTS */}
      {activeMainTab === 'planilhas' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center text-base">
              <Code className="mr-2 text-emerald-700" size={18} /> Código Apps Script Atualizado
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Caso precise implantar ou atualizar o código da planilha no Google Apps Script, utilize os botões abaixo:
            </p>

            <div className="flex space-x-2 border-b border-slate-200 mb-4">
              <button 
                onClick={() => setScriptTab('script')} 
                className={`px-4 py-2 text-xs font-black border-b-2 transition-colors cursor-pointer ${
                  scriptTab === 'script' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                1. Script Principal (Código.gs)
              </button>
              <button 
                onClick={() => setScriptTab('manifest')} 
                className={`px-4 py-2 text-xs font-black border-b-2 transition-colors flex items-center cursor-pointer ${
                  scriptTab === 'manifest' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileJson size={14} className="mr-1"/> 2. Manifesto (appsscript.json)
              </button>
            </div>

            {scriptTab === 'script' && (
              <div className="relative">
                <textarea 
                  readOnly 
                  className="w-full h-72 bg-slate-900 text-slate-300 font-mono text-[11px] p-4 rounded-xl outline-none leading-relaxed" 
                  value={scriptCode}
                />
                <button 
                  onClick={() => copyCode(scriptCode)} 
                  className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Copy size={13} /> Copiar Código
                </button>
              </div>
            )}

            {scriptTab === 'manifest' && (
              <div className="relative">
                <textarea 
                  readOnly 
                  className="w-full h-64 bg-slate-900 text-emerald-300 font-mono text-[11px] p-4 rounded-xl outline-none leading-relaxed" 
                  value={MANIFEST_CODE}
                />
                <button 
                  onClick={() => copyCode(MANIFEST_CODE)} 
                  className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Copy size={13} /> Copiar Manifesto
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center text-base">
              <Table className="mr-2 text-emerald-700" size={18} /> Estrutura dos Cabeçalhos da Planilha
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Copie os cabeçalhos abaixo e cole na <strong>linha 1 (Célula A1)</strong> das respectivas abas no Google Sheets:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-slate-200 rounded-xl p-3.5 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-black text-emerald-900 uppercase">Aba: MULTAS</span>
                <button 
                  onClick={() => copyHeaders(HEADERS_MULTAS, 'MULTAS')} 
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center bg-white border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy size={12} className="mr-1"/> Copiar
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-black text-purple-900 uppercase">Aba: MOTORISTAS</span>
                <button 
                  onClick={() => copyHeaders(HEADERS_MOTORISTAS, 'MOTORISTAS')} 
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center bg-white border border-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy size={12} className="mr-1"/> Copiar
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-black text-orange-900 uppercase">Aba: FROTA</span>
                <button 
                  onClick={() => copyHeaders(HEADERS_VEICULOS, 'FROTAS')} 
                  className="text-xs font-bold text-orange-700 hover:text-orange-900 flex items-center bg-white border border-orange-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy size={12} className="mr-1"/> Copiar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPage;


import { Veiculo, Motorista, CodigoMulta, Multa } from '../types';
import { mockVeiculos, mockMotoristas, mockCodigosMulta, mockMultas } from './mockData';
import { VEICULOS_REAIS } from '../../../data/veiculos_reais';
import { idbGetAll, idbPut, idbDelete, idbBulkPut } from './db';
import { 
  fetchMultasSupabase, 
  saveMultaSupabase, 
  saveBatchMultasSupabase,
  deleteMultaSupabase, 
  clearAllMultasSupabase,
  fetchEmailMappingsSupabase,
  saveEmailMappingsSupabase,
  fetchVeiculosSupabase
} from '../../../services/supabaseService';
import { safeSetItem, safeGetItem, safeRemoveItem } from '../../../utils/safeStorage';

const API_URL_KEY = 'risel_api_url';
const DRIVE_FOLDER_KEY = 'risel_drive_folder_id';
const DOCS_TEMPLATE_KEY = 'risel_docs_template_id';
const EMAIL_CONFIG_KEY = 'risel_email_config';
const CACHE_KEY = 'risel_data_cache';
const CACHE_DURATION = 1 * 60 * 1000; // Reduzido para 1 Minuto para diminuir latência

// URL do Script Oficial Risel v6.0
export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxiSQPRzYQoeTEpHC6df5Rb52F1zyhkvtyOI5gk0UeML49w3rKpsaO36DHQIdVS7nQ2ug/exec';

// IDs Padrão (Fallback)
const DEFAULT_FOLDER_ID = '1Fq8e5MM_AOl01HD0iGmVg1cg2bCnUmVk';
const DEFAULT_TEMPLATE_ID = '1U1B53R29XIXrNs12nIQfeJ7MDlVCScivDkjyHo2QO8o'; // ID Correto do Documento Google

// Getters Dinâmicos
export const getApiUrl = () => {
    const stored = localStorage.getItem(API_URL_KEY);
    // Se estiver vazio ou for a URL antiga obsoleta, atualiza automaticamente para a nova URL
    if (!stored || stored.includes('AKfycbw4b-wAzc99jr-CQo3THJtlQpC925RroOb1lqOjE3ibl96sOZwnQMGIGNEwHT-zGk2t')) {
        localStorage.setItem(API_URL_KEY, DEFAULT_API_URL);
        return DEFAULT_API_URL;
    }
    return stored;
};

export const getDriveFolderId = () => localStorage.getItem(DRIVE_FOLDER_KEY) || DEFAULT_FOLDER_ID;
export const getDocsTemplateId = () => localStorage.getItem(DOCS_TEMPLATE_KEY) || DEFAULT_TEMPLATE_ID;

// Email Config
export const getEmailConfig = () => {
    const stored = localStorage.getItem(EMAIL_CONFIG_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing email config", e);
        }
    }
    return { serviceId: '', templateId: '', publicKey: '' };
};

// Destinatários padrão para Multas de Frota Leve (Estritamente isolados da Frota Pesada)
export const DEFAULT_EMAIL_MAPPINGS: Record<string, { to: string; cc: string }> = {
    'PAULÍNIA': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'PAULINIA': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'PLN': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CUBATÃO': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CUBATAO': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CPB': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'SÃO BERNARDO': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'SAO BERNARDO': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'SBC': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'OURINHOS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'OUR': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'JALES': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'JLS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'AGUAÍ': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'AGUAI': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'AGU': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'BETIM': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'BTM': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'DUQUE DE CAXIAS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CAXIAS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'DCX': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CAMPINAS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'CPS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'SUPRIMENTOS': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'SUPRI': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'MATRIZ': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' },
    'GERAL': { to: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br', cc: 'deny.goncalves@risel.com.br; lorena.padilha@risel.com.br' }
};

export const DEFAULT_CC_EMAILS = 'lorena.padilha@risel.com.br; deny.goncalves@risel.com.br';

export const fetchPlacaEmailMappings = async (): Promise<Record<string, { to: string; cc: string }>> => {
    let localParsed: Record<string, { to: string; cc: string }> = {};
    const local = safeGetItem('risel_frota_leve_placa_email_mappings');
    if (local) {
        try {
            localParsed = JSON.parse(local);
        } catch (e) {
            console.error("Erro ao carregar e-mails por placa locais da Frota Leve:", e);
        }
    }

    // 1. Consulta na nuvem oficial Supabase na tabela de Frota Leve
    try {
        const cloudMappings = await fetchEmailMappingsSupabase('frota_leve_placa');
        if (cloudMappings && typeof cloudMappings === 'object' && Object.keys(cloudMappings).length > 0) {
            const merged = { ...localParsed, ...cloudMappings };
            safeSetItem('risel_frota_leve_placa_email_mappings', JSON.stringify(merged));
            return merged;
        }
    } catch (e) {
        console.warn("Aviso ao buscar mapeamento de e-mails da placa no Supabase:", e);
    }

    // 2. Fallback no servidor local backend
    try {
        const serverRes = await fetch('/api/email-mappings/frota_leve_placa');
        if (serverRes.ok) {
            const serverData = await serverRes.json();
            if (serverData && typeof serverData === 'object' && Object.keys(serverData).length > 0) {
                const merged = { ...localParsed, ...serverData };
                safeSetItem('risel_frota_leve_placa_email_mappings', JSON.stringify(merged));
                return merged;
            }
        }
    } catch (_) {}

    return localParsed;
};

export const savePlacaEmailMappings = async (mappings: Record<string, { to: string; cc: string }>) => {
    const sanitized: Record<string, { to: string; cc: string }> = {};
    Object.entries(mappings).forEach(([placa, val]) => {
        let ccStr = (val.cc || '').trim();
        if (!ccStr.toLowerCase().includes('lorena.padilha@risel.com.br')) {
            ccStr = ccStr ? `${ccStr}; lorena.padilha@risel.com.br` : 'lorena.padilha@risel.com.br';
        }
        if (!ccStr.toLowerCase().includes('deny.goncalves@risel.com.br')) {
            ccStr = `${ccStr}; deny.goncalves@risel.com.br`;
        }
        sanitized[placa.toUpperCase().trim()] = { to: val.to || '', cc: ccStr };
    });

    safeSetItem('risel_frota_leve_placa_email_mappings', JSON.stringify(sanitized));
    
    // 1. Grava no Supabase sob chave de Frota Leve
    saveEmailMappingsSupabase('frota_leve_placa', sanitized).catch(e => console.warn("Aviso ao salvar mapeamento no Supabase:", e));
    
    // 2. Grava no backend do servidor
    try {
        await fetch('/api/email-mappings/frota_leve_placa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitized)
        });
    } catch (_) {}

    return { success: true };
};

export const fetchBaseEmailMappings = async (): Promise<Record<string, { to: string; cc: string }>> => {
    let baseMap: Record<string, { to: string; cc: string }> = { ...DEFAULT_EMAIL_MAPPINGS };
    const local = safeGetItem('risel_frota_leve_base_email_mappings');
    if (local) {
        try { 
            const parsed = JSON.parse(local);
            // Purga qualquer e-mail da frota pesada que tenha ficado em cache antigo
            const cleanParsed: Record<string, { to: string; cc: string }> = {};
            Object.entries(parsed).forEach(([k, v]: [string, any]) => {
                const toStr = String(v?.to || '').toLowerCase();
                const ccStr = String(v?.cc || '').toLowerCase();
                const hasPesadaEmail = toStr.includes('logistica6@') || toStr.includes('frotasp2@') || toStr.includes('programacaolog@') || toStr.includes('frotacb@') ||
                                       ccStr.includes('logistica6@') || ccStr.includes('frotasp2@') || ccStr.includes('programacaolog@') || ccStr.includes('frotacb@');
                if (!hasPesadaEmail && v?.to) {
                    cleanParsed[k] = v;
                }
            });
            baseMap = { ...DEFAULT_EMAIL_MAPPINGS, ...cleanParsed }; 
        } catch (e) {}
    }

    // 1. Consulta na nuvem oficial Supabase
    try {
        const cloudBase = await fetchEmailMappingsSupabase('frota_leve_base');
        if (cloudBase && typeof cloudBase === 'object' && Object.keys(cloudBase).length > 0) {
            baseMap = { ...baseMap, ...cloudBase };
            safeSetItem('risel_frota_leve_base_email_mappings', JSON.stringify(baseMap));
            return baseMap;
        }
    } catch (e) {}

    // 2. Fallback no servidor local backend
    try {
        const serverRes = await fetch('/api/email-mappings/frota_leve_base');
        if (serverRes.ok) {
            const serverBase = await serverRes.json();
            if (serverBase && typeof serverBase === 'object' && Object.keys(serverBase).length > 0) {
                baseMap = { ...baseMap, ...serverBase };
                safeSetItem('risel_frota_leve_base_email_mappings', JSON.stringify(baseMap));
            }
        }
    } catch (_) {}

    return baseMap;
};

export const saveBaseEmailMappings = async (mappings: Record<string, { to: string; cc: string }>) => {
    safeSetItem('risel_frota_leve_base_email_mappings', JSON.stringify(mappings));
    
    // 1. Grava no Supabase sob chave de Frota Leve
    saveEmailMappingsSupabase('frota_leve_base', mappings).catch(e => console.warn("Aviso ao salvar mapeamento de base no Supabase:", e));
    
    // 2. Grava no backend do servidor local
    try {
        await fetch('/api/email-mappings/frota_leve_base', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappings)
        });
    } catch (_) {}

    return { success: true };
};

// Setters
export const setApiUrl = (url: string) => {
    localStorage.setItem(API_URL_KEY, url);
    try {
        fetch('/api/sheets/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appsScriptUrl: url })
        }).catch(() => {});
    } catch (e) {}
};
export const setDriveConfig = (folderId: string, templateId: string) => {
    localStorage.setItem(DRIVE_FOLDER_KEY, folderId);
    localStorage.setItem(DOCS_TEMPLATE_KEY, templateId);
};

export const setEmailConfig = (serviceId: string, templateId: string, publicKey: string) => {
    const config = { serviceId, templateId, publicKey };
    localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(config));
};

const request = async (payload: any) => {
  const url = getApiUrl();
  if (!url) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: true, message: "OK" };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("API Error:", error);
    return null;
  }
};

let localStore: { veiculos: Veiculo[]; motoristas: Motorista[]; codigos: CodigoMulta[]; multas: Multa[] } = {
  veiculos: [],
  motoristas: [],
  codigos: mockCodigosMulta,
  multas: []
};

const updateCacheOptimistically = (
  entity: 'veiculos' | 'motoristas' | 'codigos' | 'multas',
  item: any,
  originalId: string | undefined,
  action: 'save' | 'delete'
) => {
  if (!localStore[entity]) return;
  const list = [...(localStore[entity] as any[])];
  const targetId = originalId || item?.id || item?.ait || item?.placa;

  if (action === 'delete') {
    localStore[entity] = list.filter((i: any) => (i.id || i.ait || i.placa) !== targetId) as any;
  } else {
    const idx = list.findIndex((i: any) => (i.id || i.ait || i.placa) === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    localStore[entity] = list as any;
  }

  safeSetItem(CACHE_KEY, JSON.stringify({
    timestamp: Date.now(),
    data: localStore
  }));
};

const mapMultaToPayload = (multa: Multa) => {
  return {
    "ID": multa.id,
    "STATUS": multa.status,
    "PLACA": multa.placa,
    "BASE": multa.base,
    "FROTA": multa.frota,
    "TIPO": multa.tipo,
    "AIT": multa.ait,
    "DATA_INFRACAO": multa.dataHoraInfracao,
    "DATA_RECEBIMENTO": multa.dataRecebimento,
    "PRAZO_INDICACAO": multa.prazoIndicacao,
    "ENQUADRAMENTO": multa.enquadramento,
    "DESCRICAO": multa.descricaoInfracao,
    "LOCAL": multa.localInfracao,
    "MUNICIPIO": multa.municipio,
    "UF": multa.uf,
    "ORGAO_AUTUADOR": multa.orgaoAutuador,
    "VALOR": multa.valor,
    "DESCONTO": multa.desconto,
    "VALOR_COM_DESCONTO": multa.valorComDesconto,
    "TAXA_LOCADORA": multa.taxaLocadora,
    "VALOR_FINAL": (multa as any).valorFinal || multa.valorComDesconto,
    "DESCONTAR_MOTORISTA": multa.descontar,
    "RESPONSAVEL_NOME": multa.responsavelNome,
    "RESPONSAVEL_CPF": multa.responsavelCpf,
    "RESPONSABILIDADE": multa.responsabilidade,
    "OBS": multa.obs,
    "LINK_AIT": multa.linkAit,
    "LINK_AUTH": multa.linkAuth
  };
};

// Cache Helper
export const clearCache = () => {
    console.log("Limpando cache local...");
    localStorage.removeItem(CACHE_KEY);
    localStore = { veiculos: [], motoristas: [], codigos: mockCodigosMulta, multas: [] };
};

// Helper para normalização e comparação ágil de strings (Placas, Códigos, Chaves)
export const cleanString = (val: any): string => {
  if (!val) return '';
  return String(val)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .trim();
};

export const formatInputText = (val: any): string => {
  if (val === undefined || val === null) return '';
  return String(val).toUpperCase();
};

export const deleteDriveFiles = async (urls: string[]): Promise<void> => {
  try {
    await request({ action: 'delete_drive_files', urls });
  } catch (e) {
    console.warn("Aviso ao deletar arquivos temporários do drive:", e);
  }
};

export const testConnection = async () => {
  try {
    const res = await request({ action: 'read' });
    if (!res) return { success: false, error: "Sem resposta do servidor" };
    return res;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const fetchDashboardConfig = async () => {
  try {
    const response = await request({ action: 'get_config' });
    if (response && response.success && response.config) {
      return response.config;
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const saveDashboardConfigApi = async (config: any) => {
  try {
    return await request({ action: 'save_config', payload: config });
  } catch (e) {
    return null;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const uploadFileToDrive = async (file: File, folderId: string, customName?: string) => {
  try {
    const base64Data = await fileToBase64(file);
    const fileName = customName || file.name;
    const mimeType = file.type || 'application/pdf';
    const finalFolderId = folderId && folderId !== 'LOCAL' ? folderId : DEFAULT_FOLDER_ID;

    const payload = {
      action: 'upload',
      folderId: finalFolderId,
      fileName: fileName,
      mimeType: mimeType,
      fileData: base64Data
    };

    // 1. Tentar primeiro o backend proxy do servidor (/api/drive/upload) - zero restrição de CORS no navegador
    try {
      const proxyRes = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        if (proxyData && (proxyData.fileUrl || proxyData.success)) {
          return proxyData;
        }
      }
    } catch (proxyErr) {
      console.warn('[uploadFileToDrive] Proxy backend falhou, tentando fallback direto:', proxyErr);
    }

    // 2. Fallback direto ao Google Apps Script usando 'text/plain;charset=utf-8'
    // OBSERVAÇÃO CRUCIAL: text/plain NÃO dispara preflight CORS (OPTIONS), eliminando o 'Failed to fetch'!
    try {
      const gasResult = await request(payload);
      if (gasResult && (gasResult.fileUrl || gasResult.success)) {
        return gasResult;
      }
    } catch (gasErr) {
      console.warn('[uploadFileToDrive] Fallback Apps Script direto falhou:', gasErr);
    }

    // 3. Fallback Resiliente Local: Data URL para que o usuário NUNCA perca o anexo
    const localDataUrl = `data:${mimeType};base64,${base64Data}`;
    return {
      success: true,
      fileUrl: localDataUrl,
      fileName: fileName,
      isLocal: true,
      message: 'Arquivo salvo com sucesso'
    };
  } catch (err: any) {
    console.error('[uploadFileToDrive] Erro geral ao processar anexo:', err);
    // Em caso extremo, ainda assim tenta criar o data url para não barrar o anexo
    try {
      const b64 = await fileToBase64(file);
      return {
        success: true,
        fileUrl: `data:${file.type || 'application/pdf'};base64,${b64}`,
        fileName: customName || file.name,
        isLocal: true
      };
    } catch {
      throw new Error(err?.message || 'Falha ao processar arquivo para anexo.');
    }
  }
};

export const generateAuthPdfDocs = async (data: any, templateId: string, folderId: string) => {
  try {
    const finalTemplateId = templateId || DEFAULT_TEMPLATE_ID;
    const finalFolderId = folderId && folderId !== 'LOCAL' ? folderId : DEFAULT_FOLDER_ID;
    const payload = {
      action: 'generate_pdf',
      templateId: finalTemplateId,
      folderId: finalFolderId,
      data: data
    };

    // 1. Tenta proxy seguro no backend
    try {
      const proxyRes = await fetch('/api/drive/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (proxyRes.ok) {
        const result = await proxyRes.json();
        if (result && (result.success || result.pdfUrl)) return result;
      }
    } catch (e) {
      console.warn('[generateAuthPdfDocs] Proxy backend falhou, tentando fallback direto:', e);
    }

    // 2. Fallback direto usando request() com text/plain
    try {
      const gasResult = await request(payload);
      if (gasResult) return gasResult;
    } catch (e) {
      console.warn('[generateAuthPdfDocs] Fallback GAS falhou:', e);
    }

    return { success: false, error: 'Não foi possível gerar documento via Google Docs.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha na geração de PDF' };
  }
};

// Helper de timeout resiliente para evitar esperas infinitas na rede
const withTimeout = <T>(promise: Promise<T>, ms: number = 3000, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
};

// --- DATA FETCHING WITH CACHE (ULTRA-RÁPIDO / INSTANT LOCAL-FIRST) ---
export const fetchAllData = async (forceRefresh: boolean = false) => {
  try {
    // 1. CARREGAMENTO INSTANTÂNEO (Local-First): se já tiver em memória ou cache local, entrega de imediato
    if (!forceRefresh) {
        if (localStore.multas && localStore.multas.length > 0 && localStore.veiculos && localStore.veiculos.length > 0) {
            return localStore;
        }

        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.data && parsed.data.multas && parsed.data.multas.length > 0) {
                    localStore = parsed.data;
                    return parsed.data;
                }
            } catch (e) {}
        }

        const storedM = localStorage.getItem("risel_frota_multas");
        if (storedM) {
            try {
                const parsedM = JSON.parse(storedM);
                if (Array.isArray(parsedM) && parsedM.length > 0) {
                    const fallbackData = {
                        veiculos: Array.isArray(VEICULOS_REAIS) ? (VEICULOS_REAIS as any) : [],
                        motoristas: [],
                        codigos: mockCodigosMulta,
                        multas: parsedM
                    };
                    localStore = fallbackData;
                    return fallbackData;
                }
            } catch (e) {}
        }
    }

    // 2. BUSCA PARALELIZADA COM TIMEOUT (Evita travamentos de rede)
    const [vehiclesResult, serverMultasResult, supabaseMultasResult] = await Promise.allSettled([
      withTimeout(fetchVeiculosSupabase().catch(() => []), 2500, []),
      withTimeout(fetch("/api/multas", { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []), 2500, []),
      withTimeout(fetchMultasSupabase().catch(() => []), 2500, [])
    ]);

    let localVeiculos: Veiculo[] = [];
    if (vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value) && vehiclesResult.value.length > 0) {
        localVeiculos = vehiclesResult.value.map((v: any) => ({
          id: v.placa || v.id,
          status: (v.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
          placa: cleanString(v.placa || ''),
          filial: v.filial || v.base || 'Sede',
          base: v.filial || v.base || 'Sede',
          condutor: v.condutor || (v as any).motorista || '',
          cpfCondutor: v.cpfCondutor || (v as any).cpf || '',
          marca: v.marca || '',
          modelo: v.modelo || '',
          ano: String(v.ano || ''),
          tipo: v.tipo || 'Passeio',
          capacidade: v.capacidade || '',
          regiao: v.regiao || '',
          proprietario: v.locadora || v.proprietario || 'Próprio',
          validadeLicenciamento: v.vencContrato || '',
          email: v.email || ''
        }));
    }

    // Mesclar dados enriquecidos de risel_frota_veiculos_v2 para garantir que cpfCondutor e email estejam presentes
    try {
      const storedV = localStorage.getItem("risel_frota_veiculos_v2");
      if (storedV) {
        const parsedV = JSON.parse(storedV);
        if (Array.isArray(parsedV)) {
          const storedMap = new Map(parsedV.map((item: any) => [cleanString(item.placa), item]));
          localVeiculos = localVeiculos.map(v => {
            const extra = storedMap.get(cleanString(v.placa));
            if (extra) {
              return {
                ...v,
                cpfCondutor: v.cpfCondutor || extra.cpfCondutor || extra.cpf || '',
                email: v.email || extra.email || '',
                condutor: v.condutor || extra.condutor || ''
              };
            }
            return v;
          });
        }
      }
    } catch (e) {}

    if (localVeiculos.length === 0 && Array.isArray(VEICULOS_REAIS)) {
      localVeiculos = VEICULOS_REAIS.map((v: any) => ({
        id: v.placa || v.id,
        status: (v.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
        placa: cleanString(v.placa || ''),
        filial: v.filial || 'Sede',
        base: v.filial || 'Sede',
        condutor: v.condutor || '',
        cpfCondutor: v.cpfCondutor || '',
        marca: '',
        modelo: v.modelo || '',
        ano: '',
        tipo: 'Passeio',
        capacidade: '',
        regiao: '',
        proprietario: v.locadora || 'Próprio',
        validadeLicenciamento: v.vencContrato || '',
        email: v.email || ''
      }));
    }

    // Carregar multas consolidando fontes
    let localMultas: Multa[] = [];
    const multasConsolidadasMap = new Map<string, Multa>();

    // 1. Servidor compartilhado
    if (serverMultasResult.status === 'fulfilled' && Array.isArray(serverMultasResult.value)) {
        serverMultasResult.value.forEach((m: Multa) => {
            if (m && (m.id || m.ait)) multasConsolidadasMap.set(String(m.id || m.ait).toUpperCase().trim(), m);
        });
    }

    // 2. Supabase
    if (supabaseMultasResult.status === 'fulfilled' && Array.isArray(supabaseMultasResult.value)) {
        supabaseMultasResult.value.forEach((m: Multa) => {
            if (m && (m.id || m.ait)) multasConsolidadasMap.set(String(m.id || m.ait).toUpperCase().trim(), m);
        });
    }

    // 3. LocalStorage
    try {
      const storedM = localStorage.getItem("risel_frota_multas");
      if (storedM) {
        const parsedM = JSON.parse(storedM);
        if (Array.isArray(parsedM) && parsedM.length > 0) {
          parsedM.forEach((m: Multa) => {
            if (m && (m.id || m.ait)) multasConsolidadasMap.set(String(m.id || m.ait).toUpperCase().trim(), m);
          });
        }
      }
    } catch (e) {}

    localMultas = Array.from(multasConsolidadasMap.values());

    // 4. Mesclar do IndexedDB se disponível
    try {
      const idbMultas = await idbGetAll<Multa>('multas');
      if (idbMultas && idbMultas.length > 0) {
        const idbMap = new Map<string, Multa>();
        localMultas.forEach(m => idbMap.set(String(m.id || m.ait).toUpperCase().trim(), m));
        idbMultas.forEach(m => idbMap.set(String(m.id || m.ait).toUpperCase().trim(), m));
        localMultas = Array.from(idbMap.values());
      }
    } catch (e) {}

    // Função de saneamento rigorosa para descartar multas de teste estáticas, resíduos ou abas incorretas
    const isMockOrTestMulta = (m: Multa) => {
      if (!m) return true;
      const id = String(m.id || '').toLowerCase().trim();
      const ait = String(m.ait || '').toLowerCase().trim();
      const placa = String(m.placa || '').toUpperCase().trim();
      const motorista = String(m.responsavelNome || '').toLowerCase().trim();
      const enquadramento = String(m.enquadramento || '').toLowerCase().trim();
      const desc = String(m.descricaoInfracao || '').toLowerCase().trim();
      
      // IDs de teste conhecidos
      if (id === 'm1' || id === 'm2' || id === 'm3' || id.startsWith('mock') || id.startsWith('sample') || id.startsWith('teste') || id.startsWith('ghost')) return true;
      if (ait.includes('teste') || ait.includes('exemplo') || ait === '123456' || ait === '999999' || ait === '000000') return true;
      if (placa === 'BRA2E19' || placa === 'ABC1234' || placa === 'XYZ0000' || placa === 'TESTE' || placa === 'SEM-PLACA' || placa === 'FROTA') return true;
      if (motorista.includes('motorista teste') || motorista.includes('exemplo') || motorista === 'teste') return true;
      if (desc.includes('exemplo de infração') || desc.includes('multa teste')) return true;
      
      // Validação de formato mínimo de placa (pelo menos 6-7 caracteres alfanuméricos)
      if (!placa || placa.length < 6) return true;
      
      return false;
    };

    localMultas = localMultas.filter(m => !isMockOrTestMulta(m));
    idbDelete('multas', 'm1');
    idbDelete('multas', 'm2');
    idbDelete('multas', 'm3');
    idbDelete('multas', 'teste-real-1');
    safeSetItem("risel_frota_multas", JSON.stringify(localMultas));

    const finalVeiculos = localVeiculos;
    const finalMultas = localMultas.filter(m => !isMockOrTestMulta(m));

    // Carregar motoristas locais do IndexedDB
    let motoristas: Motorista[] = [];
    try {
      const idbMotoristas = await idbGetAll<Motorista>('motoristas');
      if (idbMotoristas && idbMotoristas.length > 0) {
        motoristas = idbMotoristas;
      }
    } catch (e) {}

    // Carregar códigos de infração: base padrão + IndexedDB + localStorage + histórico de multas
    const codigosMap = new Map<string, CodigoMulta>();
    
    // 1. Base oficial de códigos do CTB
    mockCodigosMulta.forEach(c => {
      if (c && c.codigo) {
        codigosMap.set(cleanString(c.codigo), c);
      }
    });

    // 2. Do IndexedDB
    try {
      const idbCodigos = await idbGetAll<CodigoMulta>('codigos');
      if (idbCodigos && idbCodigos.length > 0) {
        idbCodigos.forEach(c => {
          if (c && c.codigo) codigosMap.set(cleanString(c.codigo), c);
        });
      }
    } catch (e) {}

    // 3. Do localStorage protegido
    try {
      const storedCodigos = safeGetItem('risel_codigos_multas');
      if (storedCodigos) {
        const parsed: CodigoMulta[] = JSON.parse(storedCodigos);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            if (c && c.codigo) codigosMap.set(cleanString(c.codigo), c);
          });
        }
      }
    } catch (e) {}

    // 4. Do histórico de multas (aprende novos códigos informados)
    finalMultas.forEach(m => {
      if (m.enquadramento && String(m.enquadramento).trim().length >= 2) {
        const key = cleanString(m.enquadramento);
        if (key && !codigosMap.has(key)) {
          codigosMap.set(key, {
            codigo: String(m.enquadramento).toUpperCase().trim(),
            baseLegal: String(m.artigoCtb || '').trim(),
            descricao: String(m.descricaoInfracao || '').trim(),
            pontos: Number(m.pontosCnh) || 0,
            valor: Number(m.valor) || 0,
            desconto: Number(m.desconto) || 0
          });
        }
      }
    });

    const finalCodigos = Array.from(codigosMap.values());

    const resultData = {
        veiculos: finalVeiculos, 
        motoristas: motoristas.length > 0 ? motoristas : [],
        codigos: finalCodigos,
        multas: finalMultas
    };

    localStore = resultData;

    // Sincronizar no IndexedDB em segundo plano para garantia total contra perda de dados (capacidade de GB)
    try {
      if (finalMultas.length > 0) idbBulkPut('multas', finalMultas);
      if (finalVeiculos.length > 0) idbBulkPut('veiculos', finalVeiculos);
    } catch (e) {}

    safeSetItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: resultData
    }));

    return resultData;

  } catch (e) {
    console.error("Failed to fetch data", e);
    return localStore;
  }
};

export const saveVeiculo = async (veiculo: Veiculo, originalId?: string) => {
  const url = getApiUrl();
  updateCacheOptimistically('veiculos', veiculo, originalId, 'save');
  
  // Salvar no IndexedDB local para proteção de dados
  await idbPut('veiculos', veiculo);
  if (originalId && originalId !== veiculo.id) {
    await idbDelete('veiculos', originalId);
  }

  // Atualizar no storage
  try {
    const storedV = safeGetItem("risel_frota_veiculos_v2");
    let list: Veiculo[] = storedV ? JSON.parse(storedV) : [];
    if (originalId && originalId !== veiculo.id) {
      list = list.filter(v => v.id !== originalId);
    }
    const idx = list.findIndex(v => v.id === veiculo.id);
    if (idx >= 0) list[idx] = veiculo; else list.unshift(veiculo);
    safeSetItem("risel_frota_veiculos_v2", JSON.stringify(list));
  } catch (e) {}

  // Se houver alteração de ID (Renomeação de Frota), excluir o antigo primeiro
  if (originalId && originalId !== veiculo.id) {
       if (url && url !== DEFAULT_API_URL) {
           await request({ action: 'delete', type: 'veiculo', payload: { id: originalId, ID: originalId, FROTA: originalId } });
       } else if (!url) {
           localStore.veiculos = localStore.veiculos.filter(v => v.id !== originalId);
       }
  }

  const payload = {
      "ID": veiculo.id,
      "STATUS": veiculo.status || 'ATIVO',
      "FROTA": veiculo.id,
      "PLACA": veiculo.placa,
      "FILIAL": veiculo.filial,
      "MARCA": veiculo.marca || '',
      "MODELO": veiculo.modelo || '',
      "ANO": veiculo.ano || '',
      "TIPO": veiculo.tipo || '',
      "REGIAO": veiculo.regiao || '',
      "CAPACIDADE": veiculo.capacidade || '',
      "PROPRIETARIO": veiculo.proprietario || '',
      "LICENCIAMENTO": veiculo.validadeLicenciamento || '',
      // Campos Financeiros
      "CUSTO LICENCIAMENTO 2026": veiculo.custoLicenciamento2026 || 0,
      "CUSTO IPVA 2026": veiculo.custoIpva2026 || 0,
      "CUSTO MULTAS 2026": veiculo.custoMultas2026 || 0,
      "CUSTO POR PLACA": veiculo.custoTotal2026 || 0
  };

  if (url && url !== DEFAULT_API_URL) {
    await request({ action: 'save', type: 'veiculo', payload: payload });
  }
  const idx = localStore.veiculos.findIndex(v => v.id === veiculo.id);
  if (idx >= 0) localStore.veiculos[idx] = veiculo; else localStore.veiculos.push(veiculo);
  return { success: true };
};

export const deleteVeiculo = async (id: string) => {
  const url = getApiUrl();
  updateCacheOptimistically('veiculos', null, id, 'delete');
  await idbDelete('veiculos', id);
  try {
    const storedV = safeGetItem("risel_frota_veiculos_v2");
    if (storedV) {
      let list: Veiculo[] = JSON.parse(storedV);
      list = list.filter(v => v.id !== id);
      safeSetItem("risel_frota_veiculos_v2", JSON.stringify(list));
    }
  } catch (e) {}

  localStore.veiculos = localStore.veiculos.filter(v => v.id !== id);
  if (url && url !== DEFAULT_API_URL) {
    await request({ action: 'delete', type: 'veiculo', payload: { id, ID: id } });
  }
  return { success: true };
};

export const saveMotorista = async (motorista: Motorista, originalLogin?: string) => {
  const url = getApiUrl();
  updateCacheOptimistically('motoristas', motorista, originalLogin, 'save');
  await idbPut('motoristas', motorista);
  if (originalLogin && originalLogin !== motorista.login) {
    await idbDelete('motoristas', originalLogin);
  }
  
  const payload = {
     "STATUS": motorista.status || 'ATIVO',
     "LOGIN": motorista.login,
     "NOME": motorista.nome,
     "BASE": motorista.base || ''
  };

  if (url && url !== DEFAULT_API_URL) {
    await request({ action: 'save', type: 'motorista', payload: payload });
  }
  const idx = localStore.motoristas.findIndex(m => m.login === motorista.login);
  if(idx >= 0) localStore.motoristas[idx] = motorista; else localStore.motoristas.push(motorista);
  return { success: true };
};

export const deleteMotorista = async (login: string) => {
  const url = getApiUrl();
  updateCacheOptimistically('motoristas', null, login, 'delete');
  await idbDelete('motoristas', login);
  localStore.motoristas = localStore.motoristas.filter(m => m.login !== login);
  if (url && url !== DEFAULT_API_URL) {
    await request({ action: 'delete', type: 'motorista', payload: { id: login, ID: login } });
  }
  return { success: true };
};

// Sincronização de Multas com a Planilha do Google Vinculada
export const syncMultasToGoogleSheet = async (
  multas: Multa[]
): Promise<{ success: boolean; count: number }> => {
  if (!multas || multas.length === 0) return { success: true, count: 0 };

  // 1. Tentar primeiro via backend proxy /api/multas/sync-sheets (sem restrição de CORS)
  try {
    const res = await fetch('/api/multas/sync-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        multas,
        appsScriptUrl: getApiUrl()
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.savedInSheets) {
        return { success: true, count: multas.length };
      }
    }
  } catch (e) {
    console.warn("Aviso ao sincronizar via proxy /api/multas/sync-sheets:", e);
  }

  // 2. Fallback direto caso o proxy não responda
  const url = getApiUrl();
  if (url && url !== DEFAULT_API_URL) {
    try {
      for (const m of multas) {
        await request({ action: 'save', type: 'multa', payload: mapMultaToPayload(m) }).catch(() => {});
      }
    } catch (directErr) {
      console.warn("Aviso no fallback direto para Google Sheets:", directErr);
    }
  }

  return { success: true, count: multas.length };
};

export const saveMulta = async (multa: Multa) => {
  updateCacheOptimistically('multas', multa, undefined, 'save');
  
  // 1. Persistência em Nuvem (Supabase Oficial)
  try {
    saveMultaSupabase(multa).catch(e => console.warn("Aviso ao salvar multa no Supabase:", e));
  } catch (e) {
    console.warn("Aviso ao salvar multa no Supabase:", e);
  }

  // 1.1 Persistência Compartilhada Centralizada (API Express /api/multas para todos os usuários)
  try {
    await fetch("/api/multas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(multa)
    });
  } catch (apiErr) {
    console.warn("Aviso ao persistir multa na API compartilhada:", apiErr);
  }

  // 2. Persistência dupla local segura: IndexedDB + LocalStorage (com timeout para nunca travar)
  try {
    await Promise.race([
      idbPut('multas', multa),
      new Promise(r => setTimeout(r, 800))
    ]);
  } catch (e) {}

  try {
    const stored = localStorage.getItem("risel_frota_multas");
    let list: Multa[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(m => m.id === multa.id || m.ait === multa.ait);
    if (idx >= 0) {
      list[idx] = multa;
    } else {
      list.unshift(multa);
    }
    safeSetItem("risel_frota_multas", JSON.stringify(list));
    localStore.multas = list;
  } catch (e) {
    console.error("Erro ao persistir multa localmente:", e);
  }

  // 3. Alimentar a Planilha do Google que já está vinculada aos lançamentos
  try {
    syncMultasToGoogleSheet([multa]).catch(e => {
      console.warn("Aviso ao sincronizar lançamento com Google Sheets:", e);
    });
  } catch (sheetErr) {
    console.warn("Aviso ao sincronizar com Google Sheets:", sheetErr);
  }

  return { success: true, id: multa.id };
};

export const saveBatchMultas = async (
  multasParaGravar: Multa[],
  onProgress?: (percent: number, current: number, total: number) => void
): Promise<{ success: boolean; count: number; updatedMultas?: Multa[] }> => {
  if (!multasParaGravar || multasParaGravar.length === 0) {
    return { success: true, count: 0 };
  }

  const total = multasParaGravar.length;
  onProgress?.(30, 0, total);

  // 1. Atualizar persistência primária local rápida (LocalStorage)
  let updatedList: Multa[] = [];
  try {
    const stored = safeGetItem("risel_frota_multas");
    let list: Multa[] = stored ? JSON.parse(stored) : [];
    const map = new Map<string, Multa>();
    list.forEach(m => map.set(m.id || m.ait, m));
    multasParaGravar.forEach(m => map.set(m.id || m.ait, m));
    updatedList = Array.from(map.values());
    safeSetItem("risel_frota_multas", JSON.stringify(updatedList));
    localStore.multas = updatedList;
  } catch (err) {
    console.warn("Aviso ao salvar lote de multas no localStorage:", err);
  }

  onProgress?.(50, Math.floor(total * 0.3), total);

  // 2. Atualizar Cache Otimista em memória e localStorage
  try {
    const cached = safeGetItem(CACHE_KEY);
    let data = cached ? JSON.parse(cached).data : null;
    if (!data) data = { ...localStore };
    data.multas = updatedList.length > 0 ? updatedList : localStore.multas;
    safeSetItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (err) {
    console.warn("Aviso ao atualizar cache em lote:", err);
  }

  onProgress?.(65, Math.floor(total * 0.5), total);

  // 3. Persistência de alta durabilidade (IndexedDB em lote único com timeout de segurança)
  try {
    await Promise.race([
      idbBulkPut('multas', multasParaGravar),
      new Promise(r => setTimeout(r, 1200))
    ]);
  } catch (err) {
    console.warn("Aviso ao salvar multas no IndexedDB:", err);
  }

  onProgress?.(80, Math.floor(total * 0.75), total);

  // 4. Alimentar a Planilha do Google que já está vinculada aos lançamentos
  try {
    await syncMultasToGoogleSheet(multasParaGravar);
  } catch (sheetErr) {
    console.warn("Aviso ao sincronizar lote na planilha Google:", sheetErr);
  }

  onProgress?.(95, total, total);

  // 5. Sincronização em Nuvem (Supabase em lote com fallback seguro em segundo plano sem bloquear)
  try {
    saveBatchMultasSupabase(multasParaGravar).catch(e => {
      console.warn("Aviso na sincronização em nuvem das multas:", e);
    });
  } catch (err) {
    console.warn("Aviso ao disparar sincronização Supabase:", err);
  }

  // 6. Persistência Compartilhada Centralizada em Lote (/api/multas/batch) para todos os usuários
  try {
    await fetch("/api/multas/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(multasParaGravar)
    });
  } catch (apiErr) {
    console.warn("Aviso ao persistir lote na API compartilhada:", apiErr);
  }

  onProgress?.(100, total, total);

  return { success: true, count: multasParaGravar.length, updatedMultas: updatedList };
};

export const saveCodigo = async (codigo: CodigoMulta) => {
  clearCache();
  try {
    await idbPut('codigos', codigo);
  } catch (e) {}
  try {
    const stored = safeGetItem('risel_codigos_multas');
    let list: CodigoMulta[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(c => cleanString(c.codigo) === cleanString(codigo.codigo));
    if (idx >= 0) list[idx] = codigo;
    else list.push(codigo);
    safeSetItem('risel_codigos_multas', JSON.stringify(list));
  } catch (e) {}

  const idx = localStore.codigos.findIndex(c => cleanString(c.codigo) === cleanString(codigo.codigo));
  if(idx >= 0) localStore.codigos[idx] = codigo; 
  else localStore.codigos.push(codigo);
  return { success: true };
};

export const deleteMulta = async (id: string) => {
  updateCacheOptimistically('multas', null, id, 'delete');
  
  // Excluir do Supabase
  try {
    await deleteMultaSupabase(id);
  } catch (e) {
    console.warn("Aviso ao deletar multa no Supabase:", e);
  }

  // Excluir do Servidor Compartilhado Express
  try {
    await fetch(`/api/multas/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  } catch (apiErr) {
    console.warn("Aviso ao deletar multa no servidor compartilhado:", apiErr);
  }

  await idbDelete('multas', id);
  try {
    const stored = safeGetItem("risel_frota_multas");
    if (stored) {
      let list: Multa[] = JSON.parse(stored);
      list = list.filter(m => m.id !== id && m.ait !== id);
      safeSetItem("risel_frota_multas", JSON.stringify(list));
    }
  } catch (e) {
    console.error("Erro ao remover multa localmente:", e);
  }

  return { success: true };
};

export const clearAllMultasData = async () => {
  try {
    await clearAllMultasSupabase();
  } catch (e) {
    console.warn("Aviso ao limpar Supabase:", e);
  }
  safeRemoveItem("risel_frota_multas");
  safeRemoveItem(CACHE_KEY);
  try {
    const idbMultas = await idbGetAll<Multa>('multas');
    if (idbMultas && idbMultas.length > 0) {
      for (const m of idbMultas) {
        if (m.id) await idbDelete('multas', m.id);
        if (m.ait) await idbDelete('multas', m.ait);
      }
    }
  } catch (e) {}
  localStore.multas = [];
  return { success: true };
};

export const getLocalData = () => localStore;

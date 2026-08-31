
import { Veiculo, Motorista, CodigoMulta, Multa } from '../types';
import { mockVeiculos, mockMotoristas, mockCodigosMulta, mockMultas } from './mockData';
import { VEICULOS_REAIS } from '../../../data/veiculos_reais';
import { idbGetAll, idbPut, idbDelete, idbBulkPut } from './db';
import { fetchMultasSupabase, saveMultaSupabase, deleteMultaSupabase, clearAllMultasSupabase } from '../../../services/supabaseService';

const API_URL_KEY = 'risel_api_url';
const DRIVE_FOLDER_KEY = 'risel_drive_folder_id';
const DOCS_TEMPLATE_KEY = 'risel_docs_template_id';
const EMAIL_CONFIG_KEY = 'risel_email_config';
const CACHE_KEY = 'risel_data_cache';
const CACHE_DURATION = 1 * 60 * 1000; // Reduzido para 1 Minuto para diminuir latência

// URL do Script (padrão vazia para usar dados reais locais/Supabase)
const DEFAULT_API_URL = '';

// IDs Padrão (Fallback)
const DEFAULT_FOLDER_ID = '1Fq8e5MM_AOl01HD0iGmVg1cg2bCnUmVk';
const DEFAULT_TEMPLATE_ID = '1U1B53R29XIXrNs12nIQfeJ7MDlVCScivDkjyHo2QO8o'; // ID Correto do Documento Google

// Getters Dinâmicos
export const getApiUrl = () => {
    return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
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

// Default Base Email Mappings
export const DEFAULT_EMAIL_MAPPINGS: Record<string, { to: string; cc: string }> = {
    'AGU': { to: 'operacionalaguai@risel.com.br; administrativo3.aguai@risel.com.br; administrativo.aguai@risel.com.br', cc: 'logistica6@risel.com.br' },
    'CPB': { to: 'priscila.mendes@risel.com.br; frotacb@risel.com.br', cc: 'logistica6@risel.com.br' },
    'JLS': { to: 'rodrigo.mosca@risel.com.br; operacional01.jales@risel.com.br; dyorgines.messaros@risel.com.br', cc: 'logistica6@risel.com.br' },
    'OUR': { to: 'vinicius.paladino@risel.com.br; frotaor@risel.com.br', cc: 'logistica6@risel.com.br' },
    'PLN': { to: 'daiara.nascimento@risel.com.br; programacaolog@risel.com.br; daniele.vedovello@risel.com.br', cc: 'logistica6@risel.com.br' },
    'SBC': { to: 'frotasp2@risel.com.br; programacaosp@risel.com.br; operacionalsp@risel.com.br', cc: 'logistica6@risel.com.br' },
    'SUPRI': { to: 'william.pereira@risel.com.br; lucas.daniel@risel.com.br; felipe.assumpcao@risel.com.br', cc: 'logistica6@risel.com.br' }
};

export const DEFAULT_CC_EMAILS = 'lorena.padilha@risel.com.br; deny.goncalves@risel.com.br';

export const fetchPlacaEmailMappings = async (): Promise<Record<string, { to: string; cc: string }>> => {
    const local = localStorage.getItem('risel_placa_email_mappings');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            return parsed;
        } catch (e) {
            console.error("Erro ao carregar e-mails por placa:", e);
        }
    }
    return {};
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

    localStorage.setItem('risel_placa_email_mappings', JSON.stringify(sanitized));
    return { success: true };
};

export const fetchBaseEmailMappings = async (): Promise<Record<string, { to: string; cc: string }>> => {
    const local = localStorage.getItem('risel_base_email_mappings');
    if (local) {
        try { return JSON.parse(local); } catch (e) {}
    }
    return DEFAULT_EMAIL_MAPPINGS;
};

export const saveBaseEmailMappings = async (mappings: Record<string, { to: string; cc: string }>) => {
    localStorage.setItem('risel_base_email_mappings', JSON.stringify(mappings));
    return { success: true };
};

// Setters
export const setApiUrl = (url: string) => localStorage.setItem(API_URL_KEY, url);
export const setDriveConfig = (folderId: string, templateId: string) => {
    localStorage.setItem(DRIVE_FOLDER_KEY, folderId);
    localStorage.setItem(DOCS_TEMPLATE_KEY, templateId);
};

export const setEmailConfig = (serviceId: string, templateId: string, publicKey: string) => {
    const config = { serviceId, templateId, publicKey };
    localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(config));
};

// Cache Helper
export const clearCache = () => {
    console.log("Limpando cache local...");
    localStorage.removeItem(CACHE_KEY);
};

const request = async (payload: any) => {
  const url = getApiUrl();
  if (!url) return null;
  try {
    const response = await fetch(url, { 
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
    });
    
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("Resposta não-JSON do servidor:", text);
        if (text.includes('<!DOCTYPE html>') || text.includes('Error')) {
             return { success: false, error: "Erro no Servidor Google (HTML retornado). Verifique a URL do Script e permissões." };
        }
        return { success: true, message: "Processado (sem JSON)" }; 
    }
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export const testConnection = async () => {
    return await request({ action: 'read' });
};

// Dashboard Config (Cloud)
export const fetchDashboardConfig = async () => {
    const response = await request({ action: 'get_config' });
    if (response && response.success && response.config) {
        return response.config;
    }
    return null;
};

export const saveDashboardConfigApi = async (config: any) => {
    return await request({ action: 'save_config', payload: config });
};

let localStore = { veiculos: [], motoristas: [], codigos: mockCodigosMulta, multas: [] };

// --- OPTIMISTIC CACHE UPDATER ---
export const updateCacheOptimistically = (
  type: 'veiculos' | 'motoristas' | 'multas' | 'codigos',
  item: any,
  originalKey?: string,
  action: 'save' | 'delete' = 'save'
) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    let data = cached ? JSON.parse(cached).data : null;
    if (!data) {
      data = { veiculos: [], motoristas: [], codigos: mockCodigosMulta, multas: [] };
    }

    if (type === 'veiculos') {
      let list: Veiculo[] = data.veiculos || [];
      if (action === 'delete') {
        const idToDelete = originalKey || item?.id || item;
        list = list.filter((v: Veiculo) => v.id !== idToDelete);
      } else {
        if (originalKey && originalKey !== item.id) {
          list = list.filter((v: Veiculo) => v.id !== originalKey);
        }
        const idx = list.findIndex((v: Veiculo) => v.id === item.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...item };
        } else {
          list.unshift(item);
        }
      }
      data.veiculos = list;
    } else if (type === 'motoristas') {
      let list: Motorista[] = data.motoristas || [];
      if (action === 'delete') {
        const loginToDelete = originalKey || item?.login || item;
        list = list.filter((m: Motorista) => m.login !== loginToDelete);
      } else {
        if (originalKey && originalKey !== item.login) {
          list = list.filter((m: Motorista) => m.login !== originalKey);
        }
        const idx = list.findIndex((m: Motorista) => m.login === item.login);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...item };
        } else {
          list.unshift(item);
        }
      }
      data.motoristas = list;
    } else if (type === 'multas') {
      let list: Multa[] = data.multas || [];
      if (action === 'delete') {
        const idToDelete = originalKey || item?.id || item;
        list = list.filter((m: Multa) => m.id !== idToDelete);
      } else {
        const idx = list.findIndex((m: Multa) => m.id === item.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...item };
        } else {
          list.unshift(item);
        }
      }
      data.multas = list;
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));

    return data;
  } catch (e) {
    console.error("Erro ao atualizar cache otimista:", e);
    return null;
  }
};

// --- FILE HELPERS ---

export const fileToBase64 = (file: File): Promise<string> => {
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
    const base64Data = await fileToBase64(file);
    try {
        if (folderId && folderId !== 'LOCAL') {
            const payload = {
                action: 'upload',
                folderId: folderId,
                fileName: customName || file.name,
                mimeType: file.type,
                fileData: base64Data
            };
            const response = await request(payload);
            if (response && response.fileUrl) {
                return response;
            }
        }
    } catch (e) {
        console.warn("Upload no Google Drive indisponível/falhou, salvando como Data URL local:", e);
    }
    // Fallback zero-custo: Data URL local seguro
    const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${base64Data}`;
    return { success: true, fileUrl: dataUrl };
};

export const getFileIdFromUrl = (url: string): string | null => {
    if (!url) return null;
    const dMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (dMatch && dMatch[1]) return dMatch[1];
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(url.trim())) return url.trim();
    return null;
};

export const deleteDriveFiles = async (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    for (const url of urls) {
        if (!url) continue;
        try {
            const fileId = getFileIdFromUrl(url) || url;
            if (fileId) {
                console.log(`Solicitando deleção do arquivo do Google Drive (ID: ${fileId})...`);
                await request({
                    action: 'delete_file',
                    fileId: fileId,
                    fileUrl: url
                });
            }
        } catch (e) {
            console.warn("Erro ao solicitar deleção de arquivo do Drive:", url, e);
        }
    }
};

export const generateAuthPdfDocs = async (data: any, templateId: string, folderId: string) => {
    const payload = {
        action: 'generate_pdf',
        templateId: templateId,
        folderId: folderId,
        data: data
    };
    return await request(payload);
}

// --- HELPERS (EXPORTADOS CORRETAMENTE) ---

export const formatInputText = (str: string) => {
    if (!str) return '';
    return str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeKey = (key: string) => {
    if (!key) return '';
    return key.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
};

const hasAnyKey = (row: any, keys: string[]) => {
    if (!row || typeof row !== 'object') return false;
    const normalizedTargetKeys = keys.map(k => normalizeKey(k));
    const rowKeys = Object.keys(row).map(k => normalizeKey(k));
    return rowKeys.some(rk => normalizedTargetKeys.includes(rk));
};

export const cleanString = (str: string) => {
    return str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
};

const parseDate = (val: any) => {
    if (!val) return undefined;
    const str = String(val).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        const parts = str.split(' ')[0].split('/'); 
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.split('T')[0];
    }
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    return str;
};

const parseDateTime = (val: any) => {
    if (!val) return undefined;
    const str = String(val).trim();
    if (str.endsWith('Z') || (str.includes('T') && str.length > 16)) {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const Y = date.getFullYear();
            const M = String(date.getMonth() + 1).padStart(2, '0');
            const D = String(date.getDate()).padStart(2, '0');
            const H = String(date.getHours()).padStart(2, '0');
            const m = String(date.getMinutes()).padStart(2, '0');
            return `${Y}-${M}-${D}T${H}:${m}`;
        }
    }
    if (str.includes('T')) return str.substring(0, 16);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        const [datePart, timePart] = str.split(' ');
        const d = datePart.split('/');
        const isoDate = `${d[2]}-${d[1].padStart(2, '0')}-${d[0].padStart(2, '0')}`;
        const isoTime = timePart ? timePart.substring(0, 5) : '00:00';
        return `${isoDate}T${isoTime}`;
    }
    return str;
}

const parseCurrency = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
             str = str.replace(/\./g, '').replace(',', '.'); 
        } else {
            str = str.replace(/,/g, ''); 
        }
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }
    str = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const isPlate = (str: string) => {
    const s = cleanString(str);
    return /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(s);
};

const findValue = (row: any, normalizedKeys: string[]) => {
    for (const key of normalizedKeys) {
        if (row[key] !== undefined && row[key] !== "" && row[key] !== null) return row[key];
        const foundKey = Object.keys(row).find(k => normalizeKey(k) === key);
        if (foundKey && row[foundKey]) return row[foundKey];
    }
    return "";
};

// --- MAPPERS ---
const mapMultaFromSheet = (row: any): Multa => {
  const normalizedRow: any = {};
  Object.keys(row).forEach(k => normalizedRow[normalizeKey(k)] = row[k]);
  Object.assign(normalizedRow, row);

  let aitValue = findValue(normalizedRow, ['AIT', 'AUTODEINFRACAO', 'NAIT', 'NUMEROAIT']);
  if (!aitValue) aitValue = findValue(normalizedRow, ['AITDIGITADO']);
  let id = findValue(normalizedRow, ['IDSISTEMA', 'ID', 'CODIGO']);
  if (!id && aitValue) id = aitValue; 

  return {
    id: String(id || Math.random().toString(36).substr(2, 9)),
    status: findValue(normalizedRow, ['STATUS', 'SITUACAO']) || 'AGUARDANDO BOLETO',
    frota: String(findValue(normalizedRow, ['FROTA', 'VEICULO'])).trim(),
    placa: cleanString(findValue(normalizedRow, ['PLACA'])), 
    base: findValue(normalizedRow, ['BASE', 'FILIAL', 'UNIDADE']),
    ait: String(aitValue || '').trim(),
    tipo: findValue(normalizedRow, ['TIPO']) || 'NOTIFICAÇÃO',
    dataHoraInfracao: parseDateTime(findValue(normalizedRow, ['DATAEHORARIOINFRACAO', 'DATAHORAINFRACAO', 'DATA', 'DATAINFRACAO'])),
    dataRecebimento: parseDate(findValue(normalizedRow, ['DATADERECEBIMENTO', 'DATARECEBIMENTO', 'RECEBIMENTO', 'DATADERECEBIMENTO'])),
    prazoIndicacao: parseDate(findValue(normalizedRow, ['PRAZODEINDICACAO', 'PRAZOINDICACAO', 'PRAZO'])),
    recebidaComPrazo: findValue(normalizedRow, ['RECEBIDACOMPRAZO']) as any || 'SIM',
    enquadramento: findValue(normalizedRow, ['ENQUADRAMENTODAMULTA', 'ENQUADRAMENTO']),
    artigoCtb: findValue(normalizedRow, ['ARTIGOCTB', 'ARTIGO', 'BASELEGAL']),
    descricaoInfracao: findValue(normalizedRow, ['DESCRICAOINFRACAO', 'DESCRICAODAINFRACAO', 'DESCRICAO', 'INFRACAO']),
    pontosCnh: Number(findValue(normalizedRow, ['PONTOSNACNH', 'PONTOSNA', 'PONTOS', 'PONTOSCNH'])) || 0,
    responsavelCodigo: findValue(normalizedRow, ['LOGINMOTORISTA', 'LOGIN', 'RESPONSAVEL']),
    responsavelNome: findValue(normalizedRow, ['NOME', 'NOMEMOTORISTA', 'RESPONSAVEL']), 
    orgaoAutuador: findValue(normalizedRow, ['ORGAOAUTUADOR', 'ORGAO']),
    endereco: findValue(normalizedRow, ['ENDERECOCOMPLETO', 'ENDERECO', 'LOCAL']),
    municipio: findValue(normalizedRow, ['MUNICIPIO', 'CIDADE']),
    uf: findValue(normalizedRow, ['UF', 'ESTADO', 'U']), 
    rodoviaOuUrbano: findValue(normalizedRow, ['RODOVIAOUURBANO', 'RODOVIA OU URBANO', 'RODOVIA', 'URBANO', 'TIPOVIARIO', 'LOCAL', 'TRECHO']) as any || 'URBANO',
    retornouComPrazo: findValue(normalizedRow, ['RETORNOUCOMPRAZO', 'RETORNO', 'RETORNOU']) as any || 'NÃO',
    valor: parseCurrency(findValue(normalizedRow, ['VALOR', 'VALORMULTA'])),
    desconto: parseCurrency(findValue(normalizedRow, ['DESCONTO'])),
    valorComDesconto: parseCurrency(findValue(normalizedRow, ['VALOR COM DESCONTO', 'VALORCOMDESCONTO', 'LIQUIDO', 'VALOR LIQUIDO', 'COLZ', 'Z'])),
    empresaOuCondutor: findValue(normalizedRow, ['EMPRESAOUCONDUTOR']) as any || 'CONDUTOR',
    descontarMotorista: findValue(normalizedRow, ['DESCONTARDOMOTORISTA', 'DESCONTAR']) as any || 'SIM',
    pagoComDesconto: findValue(normalizedRow, ['PAGOCDESCONTO', 'PAGOCOMDESCONTO', 'PAGO']) as any || 'SIM',
    descontoEnviadoRH: parseDate(findValue(normalizedRow, ['ENVIADOAORH', 'ENVIADO AO RH', 'DESCONTOENVIADOPARAORH', 'DATARH', 'ENVIADORH', 'RH'])),
    numDocumento: findValue(normalizedRow, ['NDOCUMENTO', 'DOCUMENTO', 'NUMERODOCUMENTO']),
    vencimento: parseDate(findValue(normalizedRow, ['VENCIMENTO'])),
    obs: findValue(normalizedRow, ['OBS', 'OBSERVACOES']),
    linkAit: findValue(normalizedRow, ['LINKAIT', 'ARQUIVOAIT', 'AITANEXO', 'LINK AIT']),
    linkAuth: findValue(normalizedRow, ['LINKAUTH', 'LINKAUTORIZACAO', 'AUTORIZACAO', 'LINK AUTORIZACAO'])
  };
};

const mapVeiculoFromSheet = (row: any): Veiculo => {
  const normalizedRow: any = {};
  Object.keys(row).forEach(k => normalizedRow[normalizeKey(k)] = row[k]);
  Object.assign(normalizedRow, row);

  let rawPlaca = findValue(normalizedRow, ['PLACA', 'VEICULO', 'PLACAS', 'B', 'COLB', 'COLUMNB', '1']);
  if (!rawPlaca || !isPlate(rawPlaca)) {
    rawPlaca = '';
    const values = Object.values(row);
    for (const val of values) {
        const str = String(val);
        if (isPlate(str)) {
            rawPlaca = cleanString(str);
            break; 
        }
    }
  }

  let rawId = findValue(normalizedRow, ['FROTA', 'NFROTA', 'ID', 'A', 'COLA', 'COLUMNA', '0']);
  if ((!rawId || String(rawId).trim() === '') && rawPlaca) {
      const cleanP = cleanString(String(rawPlaca));
      const values = Object.values(row);
      for (const val of values) {
          const s = String(val).trim();
          const cleanS = cleanString(s);
          if (s.length > 0 && s.length <= 10 && cleanS !== cleanP && /^[A-Z0-9\-\.]+$/.test(cleanS)) {
              if (/^\d+$/.test(cleanS)) { rawId = s; break; }
              if (!rawId) rawId = s; 
          }
      }
  }
  if ((!rawId || String(rawId).trim() === '') && rawPlaca) {
      rawId = rawPlaca;
  }

  return {
    id: String(rawId || '').trim(),
    status: findValue(normalizedRow, ['STATUS', 'SITUACAO', 'ATIVO']) || 'ATIVO',
    placa: cleanString(String(rawPlaca || '')),
    filial: findValue(normalizedRow, ['FILIAL', 'BASE', 'UNIDADE', 'C', 'COLC', '2']),
    marca: findValue(normalizedRow, ['MARCA', 'FABRICANTE']),
    modelo: findValue(normalizedRow, ['MODELO', 'VEICULO']),
    ano: findValue(normalizedRow, ['ANO']),
    tipo: findValue(normalizedRow, ['TIPO', 'CATEGORIA']),
    capacidade: findValue(normalizedRow, ['CAPACIDADE']),
    regiao: findValue(normalizedRow, ['REGIAO', 'REGIAO']),
    proprietario: findValue(normalizedRow, ['PROPRIETARIO']),
    validadeLicenciamento: parseDate(findValue(normalizedRow, ['LICENCIAMENTO', 'VALIDADE', 'VENCIMENTO', 'K', 'COLK', '10'])),
    
    // Novos campos de custos (Mapeamento M, N, O, P)
    custoLicenciamento2026: parseCurrency(findValue(normalizedRow, ['CUSTOLICENCIAMENTO2026', 'CUSTOLICENCIAMENTO', 'LICENCIAMENTO2026', 'M', 'COLM'])),
    custoIpva2026: parseCurrency(findValue(normalizedRow, ['CUSTOIPVA2026', 'CUSTOIPVA', 'IPVA2026', 'N', 'COLN'])),
    custoMultas2026: parseCurrency(findValue(normalizedRow, ['CUSTOMULTAS2026', 'CUSTOMULTAS', 'MULTAS2026', 'O', 'COLO'])),
    custoTotal2026: parseCurrency(findValue(normalizedRow, ['CUSTOPORPLACA', 'CUSTOTOTAL', 'TOTAL2026', 'P', 'COLP']))
  };
};

const mapMotoristaFromSheet = (row: any): Motorista => {
  const normalizedRow: any = {};
  Object.keys(row).forEach(k => normalizedRow[normalizeKey(k)] = row[k]);
  
  // Mapeamento atualizado para incluir STATUS e garantir ordem
  return {
    status: findValue(normalizedRow, ['STATUS', 'SITUACAO']) || 'ATIVO',
    login: String(findValue(normalizedRow, ['LOGIN', 'CODIGO', 'ID', 'MATRICULA']) || '').trim(),
    nome: findValue(normalizedRow, ['NOME', 'MOTORISTA', 'FUNCIONARIO']),
    base: findValue(normalizedRow, ['BASE', 'FILIAL', 'UNIDADE', 'C', 'COLC', '2'])
  };
};

const mapCodigoFromSheet = (row: any): CodigoMulta => {
  const normalizedRow: any = {};
  Object.keys(row).forEach(k => normalizedRow[normalizeKey(k)] = row[k]);
  return {
    codigo: findValue(normalizedRow, ['CODIGO', 'ENQUADRAMENTO']),
    baseLegal: findValue(normalizedRow, ['BASELEGAL', 'ARTIGO']),
    descricao: findValue(normalizedRow, ['DESCRICAO', 'NATUREZA']),
    pontos: Number(findValue(normalizedRow, ['PTS', 'PONTOS'])) || 0,
    valor: parseCurrency(findValue(normalizedRow, ['VALOR', 'VALORBASE'])),
    desconto: parseCurrency(findValue(normalizedRow, ['DESCONTO']))
  };
}

const mapMultaToPayload = (multa: Multa) => {
    return {
        "ID": multa.id,
        "STATUS": multa.status,
        "FROTA": multa.frota,
        "PLACA": multa.placa,
        "BASE": multa.base,
        "AIT": multa.ait,
        "TIPO": multa.tipo,
        "DATA INFRACAO": multa.dataHoraInfracao,
        "DATA RECEBIMENTO": multa.dataRecebimento,
        "PRAZO INDICACAO": multa.prazoIndicacao,
        "RECEBIDA COM PRAZO": multa.recebidaComPrazo,
        "ENQUADRAMENTO": multa.enquadramento,
        "ARTIGO CTB": multa.artigoCtb,
        "DESCRICAO INFRACAO": multa.descricaoInfracao,
        "PONTOS CNH": multa.pontosCnh,
        "LOGIN MOTORISTA": multa.responsavelCodigo,
        "NOME MOTORISTA": multa.responsavelNome,
        "ORGAO AUTUADOR": multa.orgaoAutuador,
        "ENDERECO": multa.endereco,
        "MUNICIPIO": multa.municipio,
        "UF": multa.uf, 
        "RODOVIA OU URBANO": multa.rodoviaOuUrbano,
        "RETORNOU COM PRAZO": multa.retornouComPrazo,
        "VALOR": multa.valor,
        "DESCONTO": multa.desconto,
        "VALOR COM DESCONTO": multa.valorComDesconto, 
        "EMPRESA OU CONDUTOR": multa.empresaOuCondutor,
        "DESCONTAR MOTORISTA": multa.descontarMotorista,
        "PAGO COM DESCONTO": multa.pagoComDesconto,
        "OBS": multa.obs,
        "LINK AIT": multa.linkAit,
        "LINK AUTORIZACAO": multa.linkAuth,
        "ENVIADO AO RH": multa.descontoEnviadoRH
    };
};

const findDataArray = (data: any, preferredKeys: string[], validator: (rawRow: any) => boolean, excludeKeys: string[] = []) => {
    for (const key of preferredKeys) {
        if (excludeKeys.includes(key)) continue;
        if (data[key] && Array.isArray(data[key])) {
             if (data[key].length === 0) return { key, data: [] };
             if (data[key].some(validator)) {
                 return { key, data: data[key] };
             }
        }
    }
    for (const key of Object.keys(data)) {
        if (excludeKeys.includes(key)) continue;
        if (Array.isArray(data[key]) && data[key].length > 0) {
             if (data[key].some(validator)) {
                 return { key, data: data[key] };
             }
        }
    }
    return null;
};

// --- DATA FETCHING WITH CACHE ---
export const fetchAllData = async (forceRefresh: boolean = false) => {
  try {
    // 1. Tenta pegar do Cache se não for forceRefresh
    if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const now = Date.now();
                if (now - parsed.timestamp < CACHE_DURATION) {
                    console.log("Using cached data (Valid for 1 min)");
                    return parsed.data;
                }
            } catch (e) {
                console.warn("Cache inválido, buscando novos dados...");
            }
        }
    }

    // Carregar veículos do Controle de Frota Leve
    let localVeiculos: Veiculo[] = [];
    try {
      const storedV = localStorage.getItem("risel_frota_veiculos_v2");
      if (storedV) {
        const parsedV = JSON.parse(storedV);
        if (Array.isArray(parsedV) && parsedV.length > 0) {
          localVeiculos = parsedV.map((v: any) => ({
            id: v.placa || v.id,
            status: (v.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
            placa: cleanString(v.placa || ''),
            filial: v.filial || v.base || 'Sede',
            marca: v.marca || '',
            modelo: v.modelo || '',
            ano: String(v.ano || ''),
            tipo: v.tipo || 'Passeio',
            capacidade: v.capacidade || '',
            regiao: v.regiao || '',
            proprietario: v.locadora || v.proprietario || 'Próprio',
            validadeLicenciamento: v.vencContrato || ''
          }));
        }
      }
    } catch (e) {}

    if (localVeiculos.length === 0 && Array.isArray(VEICULOS_REAIS)) {
      localVeiculos = VEICULOS_REAIS.map((v: any) => ({
        id: v.placa || v.id,
        status: (v.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO',
        placa: cleanString(v.placa || ''),
        filial: v.filial || 'Sede',
        marca: '',
        modelo: v.modelo || '',
        ano: '',
        tipo: 'Passeio',
        capacidade: '',
        regiao: '',
        proprietario: v.locadora || 'Próprio',
        validadeLicenciamento: v.vencContrato || ''
      }));
    }

    // Carregar multas DIRETAMENTE E EXCLUSIVAMENTE do Supabase e Banco Local (100% desconectado de planilhas)
    let localMultas: Multa[] = [];

    // Reset solicitado: Limpa os 59 registros de teste/antigos mantendo o banco zerado e sem tocar em planilhas
    const resetExecuted = localStorage.getItem("risel_multas_cleared_v1");
    if (!resetExecuted) {
      try {
        await clearAllMultasSupabase();
      } catch (e) {}
      localStorage.removeItem("risel_frota_multas");
      localStorage.setItem("risel_multas_cleared_v1", "true");
      try {
        const idbOld = await idbGetAll<Multa>('multas');
        if (idbOld && idbOld.length > 0) {
          for (const m of idbOld) {
            if (m.id) await idbDelete('multas', m.id);
            if (m.ait) await idbDelete('multas', m.ait);
          }
        }
      } catch (e) {}
    } else {
      try {
        const dbMultas = await fetchMultasSupabase();
        if (Array.isArray(dbMultas) && dbMultas.length > 0) {
          localMultas = dbMultas;
        }
      } catch (e) {
        console.warn("Aviso ao buscar multas do Supabase:", e);
      }

      try {
        const storedM = localStorage.getItem("risel_frota_multas");
        if (storedM) {
          const parsedM = JSON.parse(storedM);
          if (Array.isArray(parsedM) && parsedM.length > 0) {
            const map = new Map<string, Multa>();
            parsedM.forEach((m: Multa) => map.set(m.id || m.ait, m));
            localMultas.forEach((m: Multa) => map.set(m.id || m.ait, m));
            localMultas = Array.from(map.values());
          }
        }
      } catch (e) {}

      // Tentar mesclar do IndexedDB se disponível
      try {
        const idbMultas = await idbGetAll<Multa>('multas');
        if (idbMultas && idbMultas.length > 0) {
          const idbMap = new Map<string, Multa>();
          localMultas.forEach(m => idbMap.set(m.id || m.ait, m));
          idbMultas.forEach(m => idbMap.set(m.id || m.ait, m));
          localMultas = Array.from(idbMap.values());
        }
      } catch (e) {}
    }

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
    localStorage.setItem("risel_frota_multas", JSON.stringify(localMultas));

    const finalVeiculos = localVeiculos;
    const finalMultas = localMultas.filter(m => !isMockOrTestMulta(m));

    // Se houver multas válidas salvas localmente mas ainda não gravadas no Supabase, tenta sincronizar
    if (finalMultas.length > 0) {
      finalMultas.forEach(m => {
        saveMultaSupabase(m).catch(() => {});
      });
    }

    // Carregar motoristas locais do IndexedDB
    let motoristas: Motorista[] = [];
    try {
      const idbMotoristas = await idbGetAll<Motorista>('motoristas');
      if (idbMotoristas && idbMotoristas.length > 0) {
        motoristas = idbMotoristas;
      }
    } catch (e) {}

    const resultData = {
        veiculos: finalVeiculos, 
        motoristas: motoristas.length > 0 ? motoristas : [],
        codigos: mockCodigosMulta,
        multas: finalMultas
    };

    localStore = resultData;

    // Sincronizar no IndexedDB em segundo plano para garantia total contra perda de dados
    try {
      if (finalMultas.length > 0) idbBulkPut('multas', finalMultas);
      if (finalVeiculos.length > 0) idbBulkPut('veiculos', finalVeiculos);
    } catch (e) {}

    localStorage.setItem(CACHE_KEY, JSON.stringify({
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

  // Atualizar no localStorage
  try {
    const storedV = localStorage.getItem("risel_frota_veiculos_v2");
    let list: Veiculo[] = storedV ? JSON.parse(storedV) : [];
    if (originalId && originalId !== veiculo.id) {
      list = list.filter(v => v.id !== originalId);
    }
    const idx = list.findIndex(v => v.id === veiculo.id);
    if (idx >= 0) list[idx] = veiculo; else list.unshift(veiculo);
    localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(list));
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
    const storedV = localStorage.getItem("risel_frota_veiculos_v2");
    if (storedV) {
      let list: Veiculo[] = JSON.parse(storedV);
      list = list.filter(v => v.id !== id);
      localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(list));
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

export const saveMulta = async (multa: Multa) => {
  updateCacheOptimistically('multas', multa, undefined, 'save');
  
  // 1. Persistência em Nuvem (Supabase Oficial)
  try {
    await saveMultaSupabase(multa);
  } catch (e) {
    console.warn("Aviso ao salvar multa no Supabase:", e);
  }

  // 2. Persistência dupla local segura: IndexedDB + LocalStorage
  await idbPut('multas', multa);
  try {
    const stored = localStorage.getItem("risel_frota_multas");
    let list: Multa[] = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(m => m.id === multa.id || m.ait === multa.ait);
    if (idx >= 0) {
      list[idx] = multa;
    } else {
      list.unshift(multa);
    }
    localStorage.setItem("risel_frota_multas", JSON.stringify(list));
  } catch (e) {
    console.error("Erro ao persistir multa localmente:", e);
  }

  return { success: true, id: multa.id };
};

export const saveCodigo = async (codigo: CodigoMulta) => {
  clearCache();
  await idbPut('codigos', codigo);
  const idx = localStore.codigos.findIndex(c => c.codigo === codigo.codigo);
  if(idx >= 0) localStore.codigos[idx] = codigo; else localStore.codigos.push(codigo);
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

  await idbDelete('multas', id);
  try {
    const stored = localStorage.getItem("risel_frota_multas");
    if (stored) {
      let list: Multa[] = JSON.parse(stored);
      list = list.filter(m => m.id !== id && m.ait !== id);
      localStorage.setItem("risel_frota_multas", JSON.stringify(list));
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
  localStorage.removeItem("risel_frota_multas");
  localStorage.removeItem(CACHE_KEY);
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

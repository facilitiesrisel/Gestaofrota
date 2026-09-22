
import { Veiculo, Motorista, CodigoMulta, Multa } from '../types';
import { mockVeiculos, mockMotoristas, mockCodigosMulta, mockMultas } from './mockData';

const API_URL_KEY = 'risel_api_url';
const DRIVE_FOLDER_KEY = 'risel_drive_folder_id';
const DOCS_TEMPLATE_KEY = 'risel_docs_template_id';
const EMAIL_CONFIG_KEY = 'risel_email_config';
const CACHE_KEY = 'risel_data_cache_1mwfKdJ_v4';
const CACHE_DURATION = 1 * 60 * 1000; // 1 Minuto para diminuir latência

// URL ATUALIZADA DO SCRIPT
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxiN8UHx-gOiq0-BK7cWD45kY4mz60418wxbRZDmnO89VxR5hya-DNGXzbm5GmBpBijUA/exec';

// IDs Padrão (Fallback)
const DEFAULT_FOLDER_ID = '1Fq8e5MM_AOl01HD0iGmVg1cg2bCnUmVk';
const DEFAULT_TEMPLATE_ID = '1aGQJt53eI0Gv0-W8uXyDdbvqOaLaPQEJcRAgVircinw'; // ID Correto do Documento Google

// Getters Dinâmicos
export const getApiUrl = () => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
    }
    return DEFAULT_API_URL;
};

export const getDriveFolderId = () => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(DRIVE_FOLDER_KEY) || DEFAULT_FOLDER_ID;
    }
    return DEFAULT_FOLDER_ID;
};

export const getDocsTemplateId = () => {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(DOCS_TEMPLATE_KEY) || DEFAULT_TEMPLATE_ID;
    }
    return DEFAULT_TEMPLATE_ID;
};

// Email Config
export const getEmailConfig = () => {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(EMAIL_CONFIG_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing email config", e);
            }
        }
    }
    return { serviceId: '', templateId: '', publicKey: '' };
};

// Setters
export const setApiUrl = (url: string) => {
    localStorage.setItem(API_URL_KEY, url);
    clearCache(); // Limpa cache imediatamente para evitar apresentar dados da planilha anterior
};
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
    try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem('risel_data_cache');
    } catch(e) {}
};

// --- PLANILHA OFICIAL RISEL LOGÍSTICA ---
export const SPREADSHEET_ID = '1mwfKdJ_N-eSjTzz7OZL7FVy8bDY-dGr-qj-ujRQHyZ8';
export const GID_MULTAS = '0';
export const GID_FROTA = '413419483';
export const GID_MOTORISTAS = '1444520531';
export const GID_COD_MULTAS = '2096924041';

/**
 * Parser Universal de CSV robusto para Google Sheets
 */
export const parseCSVText = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentField = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++; 
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentField);
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            row.push(currentField);
            if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
                lines.push(row);
            }
            row = [];
            currentField = '';
            if (char === '\r' && nextChar === '\n') {
                i++; 
            }
        } else {
            currentField += char;
        }
    }
    if (row.length > 0 || currentField !== '') {
        row.push(currentField);
        lines.push(row);
    }
    return lines;
};

/**
 * Baixa todos os 260+ veículos da aba 'Frota' (GID 413419483) da planilha oficial
 */
export const fetchVehiclesFromSheetsCSV = async (): Promise<Veiculo[]> => {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_FROTA}`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Erro de rede ao baixar planilha de frota");
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE html>')) {
             throw new Error("Planilha privada ou formato inválido");
        }
        
        const lines = parseCSVText(text);
        if (lines.length <= 1) return [];

        const headers = lines[0].map(h => normalizeKey(h));
        const veiculos: Veiculo[] = [];

        for (let i = 1; i < lines.length; i++) {
            const rowData = lines[i];
            if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) continue;
            
            const normRow: any = {};
            headers.forEach((header, colIdx) => {
                if (header) {
                    normRow[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
                }
            });

            const placaVal = cleanString(normRow.PLACA || '');
            if (!placaVal) continue;

            const frotaVal = String(normRow.FROTA || '').trim();
            const filialVal = String(normRow.FILIAL || normRow.BASE || normRow.REGIAO || 'OUTROS').trim().toUpperCase();
            const statusVal = String(normRow.STATUS || 'Ativo').trim();

            veiculos.push({
                id: frotaVal || placaVal,
                placa: placaVal,
                filial: filialVal,
                base: filialVal,
                status: statusVal,
                marca: String(normRow.MARCA || '').trim(),
                modelo: String(normRow.MODELO || '').trim(),
                ano: String(normRow.ANO || '').trim(),
                regiao: String(normRow.REGIAO || normRow.FILIAL || '').trim(),
                tipo: String(normRow.TIPO || '').trim(),
                capacidade: String(normRow.CAPACIDADE || '').trim(),
                proprietario: String(normRow.PROPRIETARIO || '').trim(),
                validadeLicenciamento: String(normRow.LICENCIAMENTO || '').trim(),
                locadora: String(normRow.PROPRIETARIO || 'RISEL').trim(),
                custoLicenciamento2026: parseCurrency(normRow.CUSTOLICENCIAMENTO2026),
                custoIpva2026: parseCurrency(normRow.CUSTOIPVA2026),
                custoMultas2026: parseCurrency(normRow.CUSTOMULTAS2026),
                custoTotal2026: parseCurrency(normRow.CUSTOPORPLACA)
            });
        }
        return veiculos;
    } catch (e) {
        console.error("Falha ao ler frotas do CSV público do Google Sheets:", e);
        return [];
    }
};

/**
 * Baixa todos os 310+ motoristas da aba 'Motoristas' (GID 1444520531) da planilha oficial
 */
export const fetchMotoristasFromSheetsCSV = async (): Promise<Motorista[]> => {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_MOTORISTAS}`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Erro ao baixar motoristas");
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE html>')) return [];

        const lines = parseCSVText(text);
        if (lines.length <= 1) return [];

        const headers = lines[0].map(h => normalizeKey(h));
        const motoristas: Motorista[] = [];

        for (let i = 1; i < lines.length; i++) {
            const rowData = lines[i];
            if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) continue;
            
            const normRow: any = {};
            headers.forEach((header, colIdx) => {
                if (header) {
                    normRow[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
                }
            });

            const nomeVal = String(normRow.NOME || '').trim();
            const loginVal = String(normRow.LOGIN || normRow.MATRICULA || normRow.CODIGO || '').trim();
            if (!nomeVal && !loginVal) continue;

            motoristas.push({
                login: loginVal || `MOT-${i}`,
                nome: nomeVal || `MOTORISTA ${loginVal}`,
                base: String(normRow.BASE || normRow.FILIAL || '').trim().toUpperCase(),
                status: String(normRow.STATUS || 'ATIVO').trim().toUpperCase()
            });
        }
        return motoristas;
    } catch (e) {
        console.error("Falha ao ler motoristas do CSV oficial:", e);
        return [];
    }
};

/**
 * Baixa todos os 460+ códigos de infração da aba 'Cod Multas' (GID 2096924041) da planilha oficial
 */
export const fetchCodigosFromSheetsCSV = async (): Promise<CodigoMulta[]> => {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_COD_MULTAS}`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Erro ao baixar códigos de multas");
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE html>')) return [];

        const lines = parseCSVText(text);
        if (lines.length <= 1) return [];

        const headers = lines[0].map(h => normalizeKey(h));
        const codigos: CodigoMulta[] = [];

        for (let i = 1; i < lines.length; i++) {
            const rowData = lines[i];
            if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) continue;
            
            const normRow: any = {};
            headers.forEach((header, colIdx) => {
                if (header) {
                    normRow[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
                }
            });

            const codVal = String(normRow.CODIGO || normRow.ENQUADRAMENTO || '').trim();
            if (!codVal) continue;

            codigos.push({
                codigo: codVal,
                descricao: String(normRow.DESCRICAO || '').trim(),
                baseLegal: String(normRow.BASELEGAL || normRow.ARTIGO || '').trim(),
                pontos: Number(normRow.PTS || normRow.PONTOS) || 0,
                valor: parseCurrency(normRow.VALOR),
                desconto: parseCurrency(normRow.DESCONTO)
            });
        }
        return codigos;
    } catch (e) {
        console.error("Falha ao ler códigos do CSV oficial:", e);
        return [];
    }
};

/**
 * Baixa todas as multas registradas na aba 'Multas' (GID 0) da planilha oficial
 */
export const fetchMultasFromSheetsCSV = async (): Promise<Multa[]> => {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_MULTAS}`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Erro ao baixar multas");
        const text = await response.text();
        if (!text || text.trim().startsWith('<!DOCTYPE html>')) return [];

        const lines = parseCSVText(text);
        if (lines.length <= 1) return [];

        const headers = lines[0].map(h => normalizeKey(h));
        const multas: Multa[] = [];

        for (let i = 1; i < lines.length; i++) {
            const rowData = lines[i];
            if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) continue;
            
            const normRow: any = {};
            headers.forEach((header, colIdx) => {
                if (header) {
                    normRow[header] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
                }
            });

            const multa = mapMultaFromSheet(normRow);
            if (multa.placa || (multa.ait && multa.ait.length > 1)) {
                multas.push(multa);
            }
        }
        return multas;
    } catch (e) {
        console.error("Falha ao ler multas do CSV oficial:", e);
        return [];
    }
};

const request = async (payload: any) => {
  const url = getApiUrl();
  if (!url) return null;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 segundos de timeout para evitar travamento infinito
  
  try {
    const response = await fetch(url, { 
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller.signal
    });
    clearTimeout(timeoutId);
    
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

// Generical config save to 'CONFIGS' sheet
export const saveConfigItemApi = async (key: string, value: string) => {
    return await request({ action: 'save', type: 'config', payload: { KEY: key, VALUE: value } });
};

const OFFLINE_STORE_KEY = 'risel_offline_store_v1';
const loadOfflineStore = () => {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(OFFLINE_STORE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    veiculos: Array.isArray(parsed.veiculos) && parsed.veiculos.length ? parsed.veiculos : mockVeiculos,
                    motoristas: Array.isArray(parsed.motoristas) && parsed.motoristas.length ? parsed.motoristas : mockMotoristas,
                    codigos: Array.isArray(parsed.codigos) && parsed.codigos.length ? parsed.codigos : mockCodigosMulta,
                    multas: Array.isArray(parsed.multas) && parsed.multas.length ? parsed.multas : mockMultas
                };
            } catch(e) {}
        }
    }
    return { veiculos: mockVeiculos, motoristas: mockMotoristas, codigos: mockCodigosMulta, multas: mockMultas };
};

let localStore = loadOfflineStore();

export const persistLocalStore = () => {
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(localStore));
        } catch(e) {}
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
    const payload = {
        action: 'upload',
        folderId: folderId,
        fileName: customName || file.name,
        mimeType: file.type,
        fileData: base64Data
    };
    return await request(payload);
};

export const generateAuthPdfDocs = async (data: any, templateId: string, folderId: string) => {
    const payload = {
        action: 'generate_pdf',
        templateId: templateId,
        folderId: folderId,
        data: data
    };
    return await request(payload);
};

export interface SendEmailPayload {
    to_email: string;
    cc_email?: string;
    subject: string;
    message_html: string;
    placa?: string;
    frota?: string;
    ait?: string;
    linkAit?: string;
    linkAuth?: string;
    motorista?: string;
    dataInfracao?: string;
    prazo?: string;
    valor?: number;
    files?: Array<{ name: string; mimeType: string; data: string }>;
}

export const sendEmailWithAttachmentsApi = async (data: SendEmailPayload) => {
    // 1. Tentar envio prioritário pelo backend Node (/api/send-email) com suporte a Resend, Brevo e SMTP
    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: data.to_email,
                cc: data.cc_email,
                subject: data.subject,
                html: data.message_html,
                source: 'multas',
                fromName: 'Sistema de Multas Risel',
                driveUrls: [
                    ...(data.linkAit ? [{ name: 'AIT_Auto_Infracao.pdf', url: data.linkAit }] : []),
                    ...(data.linkAuth ? [{ name: 'Autorizacao_Desconto.pdf', url: data.linkAuth }] : [])
                ]
            })
        });
        if (res.ok) {
            const json = await res.json();
            if (json.success || json.delivered) {
                return {
                    success: true,
                    message: json.message || 'E-mail enviado com sucesso!',
                    attachmentsCount: json.attachmentsCount ?? 0,
                    provider: json.provider
                };
            }
        }
    } catch (nodeErr) {
        console.warn("Disparo pelo backend Node falhou, tentando rota direta Apps Script:", nodeErr);
    }

    // 2. Fallback para Google Apps Script
    const payload = {
        action: 'send_email',
        payload: data
    };
    return await request(payload);
};

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

export const isPlate = (str: string) => {
    const s = cleanString(str);
    return /^[A-Z]{2,4}[0-9A-Z]{3,5}$/.test(s) && s.length >= 6 && s.length <= 8;
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
    frota: findValue(normalizedRow, ['FROTA', 'VEICULO']) ? String(findValue(normalizedRow, ['FROTA', 'VEICULO'])).trim() : '',
    placa: cleanString(findValue(normalizedRow, ['PLACA'])), 
    base: findValue(normalizedRow, ['BASE', 'FILIAL', 'UNIDADE']),
    ait: String(aitValue || '').trim(),
    tipo: findValue(normalizedRow, ['TIPO']) || 'NOTIFICAÇÃO',
    dataHoraInfracao: parseDateTime(findValue(normalizedRow, ['DATAEHORARIOINFRACAO', 'DATAHORAINFRACAO', 'DATA', 'DATAINFRACAO'])),
    dataRecebimento: parseDate(findValue(normalizedRow, ['DATADERECEBIMENTO', 'DATARECEBIMENTO', 'RECEBIMENTO', 'DATADERECEBIMENTO'])),
    prazoIndicacao: parseDate(findValue(normalizedRow, ['PRAZODEINDICACAO', 'PRAZOINDICACAO', 'PRAZO'])),
    recebidaComPrazo: findValue(normalizedRow, ['RECEBIDACOMPRAZO']) as any || 'SIM',
    enquadramento: String(findValue(normalizedRow, ['ENQUADRAMENTODAMULTA', 'ENQUADRAMENTO']) || '').trim(),
    artigoCtb: String(findValue(normalizedRow, ['ARTIGOCTB', 'ARTIGO', 'BASELEGAL']) || '').trim(),
    descricaoInfracao: String(findValue(normalizedRow, ['DESCRICAOINFRACAO', 'DESCRICAODAINFRACAO', 'DESCRICAO', 'INFRACAO']) || '').trim(),
    pontosCnh: Number(findValue(normalizedRow, ['PONTOSNACNH', 'PONTOSNA', 'PONTOS', 'PONTOSCNH'])) || 0,
    responsavelCodigo: findValue(normalizedRow, ['LOGINMOTORISTA', 'LOGIN', 'RESPONSAVEL']) ? String(findValue(normalizedRow, ['LOGINMOTORISTA', 'LOGIN', 'RESPONSAVEL'])).trim() : '',
    responsavelNome: String(findValue(normalizedRow, ['NOME', 'NOMEMOTORISTA', 'RESPONSAVEL']) || '').trim(), 
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
  const cleanRawPlaca = cleanString(rawPlaca);
  if (cleanRawPlaca && cleanRawPlaca.length >= 6 && cleanRawPlaca.length <= 8) {
    rawPlaca = cleanRawPlaca;
  } else if (!rawPlaca || !isPlate(rawPlaca)) {
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

  const rawStatus = findValue(normalizedRow, ['STATUS', 'SITUACAO', 'ATIVO']) || 'Ativo';

  // Chaves específicas para a nova planilha
  const vencContrato = findValue(normalizedRow, ['VENCCONTRATO', 'VENCIMENTOCONTRATO', 'CONTRATO', 'VENC']);
  const condutor = findValue(normalizedRow, ['CONDUTOR', 'MOTORISTA', 'OPERADOR']);
  const funcao = findValue(normalizedRow, ['FUNCAO', 'FUNCAO', 'FUNÇÃO', 'CARGO']);
  const contatoMotorista = findValue(normalizedRow, ['CONTATOMOTORISTA', 'CONTATO', 'TELEFONE', 'FONE']);
  const gestorResp = findValue(normalizedRow, ['GESTORRESP', 'GESTOR', 'RESPONSAVEL', 'GESTORRESPONSAVEL']);
  const email = findValue(normalizedRow, ['EMAIL', 'CORREIO', 'CONTATOEMAIL', 'DIRETOR']);
  const locadora = findValue(normalizedRow, ['LOCADORA', 'PARCEIRO', 'FORNECEDOR']);
  const baseLocal = findValue(normalizedRow, ['BASE', 'LOCALIDADE']);
  const diasVencVal = findValue(normalizedRow, ['DIASPVENC', 'DIASVENC', 'DIASPARAVENCIMENTO']);

  const parseDiasVenc = (val: any) => {
    if (val === undefined || val === null || val === '') return undefined;
    const n = parseInt(String(val).trim());
    return isNaN(n) ? undefined : n;
  };

  return {
    id: String(rawId || rawPlaca || '').trim(),
    status: String(rawStatus).trim(),
    placa: cleanString(String(rawPlaca || '')),
    filial: findValue(normalizedRow, ['FILIAL', 'BASE', 'UNIDADE', 'C', 'COLC', '2']) || 'OUTROS',
    modelo: findValue(normalizedRow, ['MODELO', 'VEICULO']) || '',
    
    // Novas propriedades da planilha
    vencContrato: vencContrato ? String(vencContrato).trim() : undefined,
    condutor: condutor ? String(condutor).trim() : undefined,
    funcao: funcao ? String(funcao).trim() : undefined,
    contatoMotorista: contatoMotorista ? String(contatoMotorista).trim() : undefined,
    gestorResp: gestorResp ? String(gestorResp).trim() : undefined,
    email: email ? String(email).trim() : undefined,
    locadora: locadora ? String(locadora).trim() : undefined,
    base: baseLocal ? String(baseLocal).trim() : undefined,
    diasVenc: parseDiasVenc(diasVencVal),

    // Legados/financeiros mantidos para compatibilidade
    marca: findValue(normalizedRow, ['MARCA', 'FABRICANTE']) || locadora || '',
    ano: findValue(normalizedRow, ['ANO']) || '',
    tipo: findValue(normalizedRow, ['TIPO', 'CATEGORIA']) || funcao || '',
    capacidade: findValue(normalizedRow, ['CAPACIDADE']) || '',
    regiao: findValue(normalizedRow, ['REGIAO', 'REGIAO']) || 'OUTROS',
    proprietario: findValue(normalizedRow, ['PROPRIETARIO']) || locadora || '',
    validadeLicenciamento: parseDate(findValue(normalizedRow, ['LICENCIAMENTO', 'VALIDADE', 'VENCIMENTO', 'K', 'COLK', '10'])) || vencContrato || '',
    
    // Custos
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
                if (now - parsed.timestamp < CACHE_DURATION && parsed.data?.veiculos?.length > 0) {
                    console.log("Using cached data (Valid for 1 min)");
                    return parsed.data;
                }
            } catch (e) {
                console.warn("Cache inválido, buscando novos dados...");
            }
        }
    }

    // 2. Dispara requisições simultâneas: os 4 CSVs oficiais + webhook da API se configurada
    const [csvVehiclesRes, csvMotoristasRes, csvCodigosRes, csvMultasRes, apiRes] = await Promise.allSettled([
        fetchVehiclesFromSheetsCSV(),
        fetchMotoristasFromSheetsCSV(),
        fetchCodigosFromSheetsCSV(),
        fetchMultasFromSheetsCSV(),
        request({ action: 'read' })
    ]);

    const csvVeiculos: Veiculo[] = csvVehiclesRes.status === 'fulfilled' ? csvVehiclesRes.value : [];
    const csvMotoristas: Motorista[] = csvMotoristasRes.status === 'fulfilled' ? csvMotoristasRes.value : [];
    const csvCodigos: CodigoMulta[] = csvCodigosRes.status === 'fulfilled' ? csvCodigosRes.value : [];
    const csvMultas: Multa[] = csvMultasRes.status === 'fulfilled' ? csvMultasRes.value : [];
    const apiData = (apiRes.status === 'fulfilled' && apiRes.value && apiRes.value.success !== false) ? apiRes.value : null;

    // Sincronizar configurações do Google Sheets para o localStorage (Multi-dispositivos) se retornado pela API
    if (apiData) {
        const configsList = apiData.CONFIGS || apiData.configs || apiData.Configs || [];
        if (Array.isArray(configsList)) {
            configsList.forEach((row: any) => {
                const k = row.KEY || row.key || row.Chave || row.CHAVE;
                const v = row.VALUE || row.value || row.Valor || row.VALOR;
                if (k) {
                    localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
                }
            });
        }
    }

    const usedKeys: string[] = [];

    // --- CONSOLIDAÇÃO DE MULTAS (GID 0 + API + localStore) ---
    const multasMap = new Map<string, Multa>();

    // a. CSV GID 0 (Planilha Oficial)
    csvMultas.forEach(m => {
        const key = m.id || m.ait;
        if (key) multasMap.set(key, m);
    });

    // b. API Webhook
    if (apiData) {
        const multasResult = findDataArray(
            apiData, 
            ['Multas', 'multas', 'MULTAS', 'Multa', 'Infracoes'], 
            (row) => {
                 return hasAnyKey(row, ['AIT', 'AUTODEINFRACAO', 'NAIT']) || 
                        (hasAnyKey(row, ['FROTA', 'VEICULO']) && hasAnyKey(row, ['STATUS', 'SITUACAO'])) ||
                        hasAnyKey(row, ['ENQUADRAMENTODAMULTA', 'ENQUADRAMENTO']);
            },
            usedKeys
        );
        if (multasResult && multasResult.data && multasResult.data.length > 0) {
            usedKeys.push(multasResult.key);
            multasResult.data.map(mapMultaFromSheet).forEach((m: Multa) => {
                if (m.placa || (m.ait && m.ait.length > 1)) {
                    const key = m.id || m.ait;
                    if (key) multasMap.set(key, m);
                }
            });
        }
    }

    // c. LocalStore (dados criados na sessão corrente)
    localStore.multas.forEach(m => {
        const key = m.id || m.ait;
        if (key && !multasMap.has(key)) {
            multasMap.set(key, m);
        }
    });

    let multas: Multa[] = Array.from(multasMap.values());

    // --- CONSOLIDAÇÃO DE VEÍCULOS (GID 413419483 + Multas + API + localStore) ---
    const uniqueVeiculosMap = new Map<string, Veiculo>();

    // a. CSV GID 413419483 (Frota Oficial)
    csvVeiculos.forEach(v => {
        const cleanP = cleanString(v.placa);
        if (cleanP) {
            uniqueVeiculosMap.set(cleanP, v);
        }
    });

    // b. Veículos derivados de multas já registradas na planilha
    multas.forEach(m => {
        const cleanP = cleanString(m.placa);
        if (cleanP && cleanP.length >= 6) {
            const existing = uniqueVeiculosMap.get(cleanP);
            if (!existing) {
                uniqueVeiculosMap.set(cleanP, {
                    id: m.frota || cleanP,
                    placa: cleanP,
                    filial: m.base || 'OUTROS',
                    base: m.base || 'OUTROS',
                    condutor: m.responsavelNome || '',
                    status: 'Ativo'
                });
            } else if (!existing.condutor && m.responsavelNome) {
                existing.condutor = m.responsavelNome;
            }
        }
    });

    // c. API Webhook
    if (apiData) {
        const veiculosResult = findDataArray(
            apiData, 
            ['Frota Completa', 'FROTA COMPLETA', 'frota completa', 'veiculos', 'VEICULOS', 'Frotas', 'FROTAS', 'Frota', 'FROTA', 'frota'], 
            (row) => {
                 const values = Object.values(row);
                 const hasPlate = values.some(val => isPlate(String(val)));
                 const hasFrotaHeader = hasAnyKey(row, ['FROTA', 'VEICULO', 'PLACA']);
                 const isMulta = hasAnyKey(row, ['AIT', 'AUTODEINFRACAO', 'ENQUADRAMENTO', 'ENQUADRAMENTODAMULTA']);
                 return (hasPlate || hasFrotaHeader) && !isMulta;
            },
            usedKeys
        );
        if (veiculosResult && Array.isArray(veiculosResult.data) && veiculosResult.data.length > 0) {
            usedKeys.push(veiculosResult.key);
            veiculosResult.data
                .map(mapVeiculoFromSheet)
                .filter((v: Veiculo) => v.placa && cleanString(v.placa).length >= 6)
                .forEach((v: Veiculo) => {
                    const cleanP = cleanString(v.placa);
                    if (cleanP) {
                        const existing = uniqueVeiculosMap.get(cleanP);
                        uniqueVeiculosMap.set(cleanP, {
                            ...existing,
                            ...v,
                            id: (v.id && cleanString(v.id) !== cleanP) ? v.id : (existing?.id || cleanP),
                            placa: cleanP,
                            status: v.status || existing?.status || 'Ativo',
                            filial: v.filial || v.base || existing?.filial || 'OUTROS',
                            base: v.base || v.filial || existing?.base || 'OUTROS'
                        });
                    }
                });
        }
    }

    // d. LocalStore
    localStore.veiculos.forEach(v => {
        const cleanP = cleanString(v.placa);
        if (cleanP && !uniqueVeiculosMap.has(cleanP)) {
            uniqueVeiculosMap.set(cleanP, v);
        }
    });

    if (uniqueVeiculosMap.size === 0) {
        mockVeiculos.forEach(v => {
            const cleanP = cleanString(v.placa);
            if (cleanP) uniqueVeiculosMap.set(cleanP, v);
        });
    }

    let veiculos: Veiculo[] = Array.from(uniqueVeiculosMap.values());

    // --- CONSOLIDAÇÃO DE MOTORISTAS (GID 1444520531 + Frota + Multas + API + localStore) ---
    const motoristaMap = new Map<string, Motorista>();

    // a. CSV GID 1444520531 (Motoristas Oficial)
    csvMotoristas.forEach(m => {
        const key = cleanString(m.nome || m.login);
        if (key) {
            motoristaMap.set(key, {
                login: m.login || `MOT-${key.substring(0, 6)}`,
                nome: m.nome.trim(),
                base: m.base || '',
                status: m.status || 'ATIVO'
            });
        }
    });

    // b. API Webhook
    if (apiData) {
        const motoristasResult = findDataArray(
            apiData, 
            ['motoristas', 'MOTORISTAS', 'Condutores', 'CONDUTORES', 'condutores', 'Motorista', 'Condutor', 'Funcionarios', 'FUNCIONARIOS'], 
            (row) => (hasAnyKey(row, ['LOGIN', 'MATRICULA', 'CODIGO', 'ID']) && hasAnyKey(row, ['NOME', 'MOTORISTA', 'CONDUTOR'])) || hasAnyKey(row, ['MOTORISTA', 'CONDUTOR', 'NOME']),
            usedKeys
        );
        if (motoristasResult && motoristasResult.data) {
            motoristasResult.data.map(mapMotoristaFromSheet).filter((m: Motorista) => m.nome && m.nome.trim() !== '').forEach((m: Motorista) => {
                const key = cleanString(m.nome || m.login);
                if (key && !motoristaMap.has(key)) {
                    motoristaMap.set(key, {
                        ...m,
                        login: m.login || `MOT-${key.substring(0, 6)}`,
                        status: m.status || 'ATIVO',
                        nome: m.nome.trim()
                    });
                }
            });
        }
    }

    // c. Vincula condutores que estão na planilha de frota para não perder nenhum motorista
    veiculos.forEach(v => {
        if (v.condutor && v.condutor.trim()) {
            const key = cleanString(v.condutor);
            if (key && !motoristaMap.has(key)) {
                motoristaMap.set(key, {
                    login: `MOT-${key.substring(0, 6)}`,
                    nome: v.condutor.trim(),
                    base: v.filial || v.base || '',
                    status: 'ATIVO'
                });
            }
        }
    });

    // d. LocalStore
    localStore.motoristas.forEach(m => {
        const key = cleanString(m.nome || m.login);
        if (key && !motoristaMap.has(key)) {
            motoristaMap.set(key, m);
        }
    });

    let motoristas: Motorista[] = Array.from(motoristaMap.values());

    // --- BLINDAGEM E VÍNCULO DAS MULTAS COM A FROTA E CONDUTORES ---
    const fleetPlacasMap = new Map<string, Veiculo>();
    veiculos.forEach(v => fleetPlacasMap.set(cleanString(v.placa), v));

    multas = multas.map(m => {
        const cleanPlaca = cleanString(m.placa);
        const fleetVehicle = fleetPlacasMap.get(cleanPlaca);

        let finalBase = m.base;
        let finalFrota = m.frota;
        let finalNome = m.responsavelNome;
        let finalCodigo = m.responsavelCodigo;

        if (fleetVehicle) {
            if (!finalBase || finalBase === 'OUTROS' || finalBase.trim() === '') {
                finalBase = fleetVehicle.filial || fleetVehicle.base || '';
            }
            if (!finalFrota || finalFrota.trim() === '') {
                finalFrota = fleetVehicle.id || fleetVehicle.placa;
            }
            // Não inferir condutor da frota automaticamente: o usuário edita manualmente após a importação para garantir exatidão
        }

        // Garante coerência entre Código e Nome do motorista
        if (finalNome && (!finalCodigo || finalCodigo.trim() === '')) {
            const matchedMot = motoristaMap.get(cleanString(finalNome));
            if (matchedMot) {
                finalCodigo = matchedMot.login;
            }
        } else if (finalCodigo && (!finalNome || finalNome.trim() === '')) {
            const matchedMot = motoristas.find(mot => cleanString(mot.login) === cleanString(finalCodigo));
            if (matchedMot) {
                finalNome = matchedMot.nome;
            }
        }

        return {
            ...m,
            placa: cleanPlaca || m.placa,
            frota: finalFrota || '',
            base: finalBase || '',
            responsavelNome: finalNome || '',
            responsavelCodigo: finalCodigo || ''
        };
    });

    // --- CALCULAR CUSTOS DE MULTAS 2026 ---
    veiculos = veiculos.map(v => {
        const cleanPlacaVeiculo = cleanString(v.placa);
        
        const multas2026 = multas.filter(m => {
            if (!m.dataHoraInfracao) return false;
            const cleanPlacaMulta = cleanString(m.placa);
            const isVeiculo = cleanPlacaMulta === cleanPlacaVeiculo;
            const is2026 = m.dataHoraInfracao.startsWith('2026') || (m.dataHoraInfracao.includes('/2026'));
            return isVeiculo && is2026;
        });

        const totalMultas2026 = multas2026.reduce((acc, m) => acc + (m.valorComDesconto || m.valor || 0), 0);
        const lic = v.custoLicenciamento2026 || 0;
        const ipva = v.custoIpva2026 || 0;
        const total = lic + ipva + totalMultas2026;

        return {
            ...v,
            custoMultas2026: totalMultas2026,
            custoTotal2026: total
        };
    });

    // --- CONSOLIDAÇÃO DE CÓDIGOS DE MULTA (GID 2096924041 + API + localStore) ---
    const codigosMap = new Map<string, CodigoMulta>();

    // a. CSV GID 2096924041 (Códigos Oficial)
    csvCodigos.forEach(c => {
        const key = cleanString(c.codigo);
        if (key) codigosMap.set(key, c);
    });

    // b. API Webhook
    if (apiData) {
        const codigosResult = findDataArray(
            apiData, 
            ['codigos', 'CODIGOS', 'Cod Multas'], 
            (row) => hasAnyKey(row, ['CODIGO', 'ENQUADRAMENTO']) && hasAnyKey(row, ['DESCRICAO']),
            usedKeys
        );
        if (codigosResult && codigosResult.data) {
            codigosResult.data.map(mapCodigoFromSheet).forEach((c: CodigoMulta) => {
                const key = cleanString(c.codigo);
                if (key && !codigosMap.has(key)) {
                    codigosMap.set(key, c);
                }
            });
        }
    }

    // c. LocalStore
    localStore.codigos.forEach(c => {
        const key = cleanString(c.codigo);
        if (key && !codigosMap.has(key)) {
            codigosMap.set(key, c);
        }
    });

    const codigos = codigosMap.size > 0 ? Array.from(codigosMap.values()) : mockCodigosMulta;

    const resultData = {
        veiculos: veiculos.length > 0 ? veiculos : [], 
        motoristas: motoristas.length > 0 ? motoristas : [],
        codigos: codigos.length > 0 ? codigos : mockCodigosMulta,
        multas: multas.length > 0 ? multas : [] 
    };

    // Sincroniza o localStore em memória com os dados consolidados
    localStore.veiculos = resultData.veiculos;
    localStore.motoristas = resultData.motoristas;
    localStore.codigos = resultData.codigos;
    localStore.multas = resultData.multas;

    // 3. Salvar no Cache com Timestamp
    if (resultData.veiculos.length > 0 || resultData.multas.length > 0) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: resultData
        }));
    }

    return resultData;

  } catch (e) {
    console.error("Failed to fetch data", e);
    return localStore;
  }
};

export const saveVeiculo = async (veiculo: Veiculo, originalId?: string) => {
  const url = getApiUrl();
  clearCache(); // Invalida o cache para ver a mudança imediata
  
  // Se houver alteração de ID (Renomeação de Frota), excluir o antigo primeiro
  if (originalId && originalId !== veiculo.id) {
       localStore.veiculos = localStore.veiculos.filter(v => v.id !== originalId);
       if (url && url !== DEFAULT_API_URL) {
           await request({ action: 'delete', type: 'veiculo', payload: { id: originalId, ID: originalId, FROTA: originalId } });
       }
  }

  // Atualiza store local e persiste sempre
  const idx = localStore.veiculos.findIndex(v => v.placa === veiculo.placa || v.id === veiculo.id);
  if (idx >= 0) localStore.veiculos[idx] = veiculo; else localStore.veiculos.push(veiculo);
  persistLocalStore();

  const payload = {
      // Nova estrutura de colunas compatível com a aba "Frota Completa"
      "Placa": veiculo.placa,
      "Modelo": veiculo.modelo || '',
      "Venc. Contrato": veiculo.vencContrato || veiculo.validadeLicenciamento || '',
      "Condutor": veiculo.condutor || '',
      "Função": veiculo.funcao || '',
      "Contato Motorista": veiculo.contatoMotorista || '',
      "Gestor Resp.": veiculo.gestorResp || '',
      "E-mail": veiculo.email || '',
      "Filial": veiculo.filial,
      "Locadora": veiculo.locadora || veiculo.proprietario || '',
      "Base": veiculo.base || veiculo.filial || '',
      "Dias p/ Venc.": veiculo.diasVenc || 0,
      "Status": veiculo.status || 'Ativo',

      // Estrutura legada para compatibilidade absoluta
      "ID": veiculo.placa || veiculo.id,
      "STATUS": veiculo.status || 'Ativo',
      "FROTA": veiculo.placa || veiculo.id,
      "PLACA": veiculo.placa,
      "FILIAL": veiculo.filial,
      "MARCA": veiculo.marca || veiculo.locadora || '',
      "MODELO": veiculo.modelo || '',
      "ANO": veiculo.ano || '',
      "TIPO": veiculo.tipo || veiculo.funcao || '',
      "REGIAO": veiculo.regiao || veiculo.filial || '',
      "CAPACIDADE": veiculo.capacidade || '',
      "PROPRIETARIO": veiculo.proprietario || veiculo.locadora || '',
      "LICENCIAMENTO": veiculo.validadeLicenciamento || veiculo.vencContrato || '',
      "CUSTO LICENCIAMENTO 2026": veiculo.custoLicenciamento2026 || 0,
      "CUSTO IPVA 2026": veiculo.custoIpva2026 || 0,
      "CUSTO MULTAS 2026": veiculo.custoMultas2026 || 0,
      "CUSTO POR PLACA": veiculo.custoTotal2026 || 0
  };

  if (!url) return;
  await request({ action: 'save', type: 'veiculo', payload: payload });
};

export const deleteVeiculo = async (id: string) => {
  const url = getApiUrl();
  clearCache();
  localStore.veiculos = localStore.veiculos.filter(v => v.id !== id && v.placa !== id);
  persistLocalStore();
  if (!url) return;
  await request({ action: 'delete', type: 'veiculo', payload: { id, ID: id, PLACA: id, FROTA: id } });
};

export const saveMotorista = async (motorista: Motorista) => {
  const url = getApiUrl();
  clearCache();
  
  const idx = localStore.motoristas.findIndex(m => m.login === motorista.login);
  if (idx >= 0) localStore.motoristas[idx] = motorista; else localStore.motoristas.push(motorista);
  persistLocalStore();

  const payload = {
     "STATUS": motorista.status || 'ATIVO',
     "LOGIN": motorista.login,
     "NOME": motorista.nome,
     "BASE": motorista.base || ''
  };

  if (!url) return;
  await request({ action: 'save', type: 'motorista', payload: payload });
};

export const deleteMotorista = async (login: string) => {
  const url = getApiUrl();
  clearCache();
  localStore.motoristas = localStore.motoristas.filter(m => m.login !== login);
  persistLocalStore();
  if (!url) return;
  await request({ action: 'delete', type: 'motorista', payload: { id: login, ID: login } });
};

export const saveMulta = async (multa: Multa) => {
  const url = getApiUrl();
  clearCache();
  const idx = localStore.multas.findIndex(m => m.id === multa.id);
  if (idx >= 0) localStore.multas[idx] = multa; else localStore.multas.push(multa);
  persistLocalStore();
  if (!url) return;
  const sheetPayload = mapMultaToPayload(multa);
  await request({ action: 'save', type: 'multa', payload: sheetPayload });
};

export const deleteMulta = async (id: string) => {
  const url = getApiUrl();
  clearCache();
  localStore.multas = localStore.multas.filter(m => m.id !== id);
  persistLocalStore();
  if (!url) return;
  await request({ action: 'delete', type: 'multa', payload: { id: id, ID: id } });
};

export const saveCodigo = async (codigo: CodigoMulta) => {
  const url = getApiUrl();
  clearCache();
  const idx = localStore.codigos.findIndex(c => cleanString(c.codigo) === cleanString(codigo.codigo));
  if (idx >= 0) localStore.codigos[idx] = codigo; else localStore.codigos.push(codigo);
  persistLocalStore();

  const payload = {
    "CODIGO": codigo.codigo,
    "DESCRICAO": codigo.descricao,
    "BASE LEGAL": codigo.baseLegal || '',
    "PONTOS": codigo.pontos || 0,
    "VALOR": codigo.valor || 0,
    "DESCONTO": codigo.desconto || 0,
    "ENQUADRAMENTO": codigo.codigo
  };

  if (!url) return;
  await request({ action: 'save', type: 'codigo', payload: payload });
};

export const getLocalData = () => localStore;

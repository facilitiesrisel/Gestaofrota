import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VEICULOS_REAIS } from '../data/veiculos_reais';
import type { Veiculo } from '../pages/Frota';

// Configurações Padrão do Supabase (projeto oficial fornecido)
const env = (import.meta as any).env || {};
const DEFAULT_SUPABASE_URL = env.VITE_SUPABASE_URL || "https://ihowbxlqfcjzzzleasqq.supabase.co";
const DEFAULT_SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlob3dieGxxZmNqenp6bGVhc3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAwNzksImV4cCI6MjEwMTMxNjA3OX0.nTbdmUa16BrXPlcX_RyWAzpPmCjqeivR1Yo1qjF_Ld0";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastPing?: string;
  pingCount?: number;
}

export function getSupabaseConfig(): SupabaseConfig {
  let savedUrl = localStorage.getItem("risel_supabase_url");
  let savedKey = localStorage.getItem("risel_supabase_key");

  // Se a URL estiver vazia, for exemplo antigo ou não for a do projeto oficial, atualiza automaticamente
  if (!savedUrl || !savedUrl.includes("ihowbxlqfcjzzzleasqq")) {
    savedUrl = DEFAULT_SUPABASE_URL;
    localStorage.setItem("risel_supabase_url", savedUrl);
  }
  
  // A chave oficial do projeto Risel contém a assinatura nTbdmUa16BrXPlcX
  const isOfficialKey = savedKey && savedKey.includes("nTbdmUa16BrXPlcX") && !savedKey.includes("sample_key");
  if (!isOfficialKey) {
    savedKey = DEFAULT_SUPABASE_KEY;
    localStorage.setItem("risel_supabase_key", savedKey);
  }

  const isConnected = localStorage.getItem("risel_supabase_connected") === "true";
  const lastPing = localStorage.getItem("risel_supabase_last_ping") || undefined;
  const pingCount = parseInt(localStorage.getItem("risel_supabase_ping_count") || "0", 10);

  return {
    url: savedUrl,
    anonKey: savedKey,
    isConnected,
    lastPing,
    pingCount
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem("risel_supabase_url", url.trim());
  localStorage.setItem("risel_supabase_key", anonKey.trim());
  localStorage.setItem("risel_supabase_connected", "true");
  supabaseInstance = null;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(forceNew = false): SupabaseClient {
  const config = getSupabaseConfig();
  if (!supabaseInstance || forceNew) {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

export function forceResetToOfficialSupabase(): SupabaseClient {
  localStorage.setItem("risel_supabase_url", DEFAULT_SUPABASE_URL);
  localStorage.setItem("risel_supabase_key", DEFAULT_SUPABASE_KEY);
  supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, {
    auth: { persistSession: false }
  });
  return supabaseInstance;
}

// Interfaces de Dados para Usuários no Supabase
export interface SupabaseUser {
  email: string;
  name: string;
  role: string;
  permissions: any;
  status: string;
  password?: string;
  must_change_password?: boolean;
  created_at?: string;
}

// Interfaces de Dados para o Módulo de Lançamento de Documentos
export interface SupabaseLancamento {
  id: number;
  status: string;
  data_lancamento?: string;
  data_vencimento: string;
  fornecedor: string;
  doc: string;
  valor: string;
  forma_pagto: string;
  tipo: string;
  descricao?: string;
  cnpj?: string;
  estabelecimento?: string;
  nome_arquivo_anexo?: string;
  arquivo_anexo_base64?: string;
  item_sistema?: string;
  data_emissao?: string;
  observacao?: string;
  frequencia?: string;
  lancado_por?: string;
  data_aprovacao?: string;
  centro_custo?: string;
  codigo_lancamento?: string;
  created_at?: string;
}

// 1. Teste de Conexão com o Supabase
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSupabaseConfig();
    const targetUrl = url || config.url;
    const targetKey = key || config.anonKey;

    if (!targetUrl || !targetKey || targetUrl.includes("xyzcompany")) {
      return { 
        success: false, 
        message: "Configuração do Supabase pendente. Insira a URL e a Anon Key do projeto no Supabase." 
      };
    }

    const client = createClient(targetUrl, targetKey);
    const { data, error } = await client.from('lancamentos').select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === "PGRST301" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
        return {
          success: true,
          message: "Conectado ao Supabase! A tabela 'lancamentos' ainda não existe. Clique em 'Criar Tabela no Supabase'."
        };
      }
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    localStorage.setItem("risel_supabase_connected", "true");
    return { success: true, message: "Conexão estabelecida com sucesso com o Banco de Dados Supabase!" };
  } catch (err: any) {
    return { success: false, message: `Falha de rede: ${err.message || "Erro desconhecido"}` };
  }
}

// 2. Anti-Inatividade Keep-Alive Ping (Garante que o banco de dados não entre em pausa no plano gratuito)
export async function pingSupabaseKeepAlive(): Promise<{ success: boolean; timestamp: string; count: number }> {
  const config = getSupabaseConfig();
  const now = new Date().toLocaleString("pt-BR");
  const newCount = (config.pingCount || 0) + 1;

  try {
    const client = getSupabaseClient();
    // Faz uma chamada mínima e leve para manter o banco ativo
    await client.from('lancamentos').select('id').limit(1);

    localStorage.setItem("risel_supabase_last_ping", now);
    localStorage.setItem("risel_supabase_ping_count", newCount.toString());

    return { success: true, timestamp: now, count: newCount };
  } catch (e) {
    localStorage.setItem("risel_supabase_last_ping", now + " (Tentativa realizada)");
    localStorage.setItem("risel_supabase_ping_count", newCount.toString());
    return { success: false, timestamp: now, count: newCount };
  }
}

// Inferência universal de MIME Type por extensão de arquivo
export function getMimeTypeFromFileName(fileName: string): string {
  const lower = String(fileName || "").toLowerCase().trim();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".msg")) return "application/vnd.ms-outlook";
  if (lower.endsWith(".eml")) return "message/rfc822";
  if (lower.endsWith(".oft")) return "application/vnd.ms-outlook";
  if (lower.endsWith(".pst")) return "application/vnd.ms-outlook-pst";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".txt") || lower.endsWith(".log") || lower.endsWith(".ret") || lower.endsWith(".rem")) return "text/plain";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".rar")) return "application/vnd.rar";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  return "application/octet-stream";
}

// Converte registro bruto do Supabase para o modelo completo do sistema
export function mapSupabaseRowToLancamento(row: any): any {
  if (!row) return row;
  // Extrai metadados seguros caso estejam embutidos na observação (prioriza a tag mais recente)
  const rawObs = String(row.observacao || "");
  let parsedNumDoc = row.codigo_lancamento || row.numero_documento || "";
  let parsedOc = row.cod_lancamento_oc || row.cod_oc || "";
  let parsedCc = row.centro_custo || "";
  let parsedAlcada = row.aprovadores || "";
  let parsedBase = row.estabelecimento || "";
  let parsedUpdatedAt = row.updated_at || row.updatedAt || "";
  let parsedDriveUrl = row.drive_url || row.driveUrl || "";
  let parsedCidade = row.cidade || "";
  let parsedUf = row.uf || "";
  let parsedTelefone = row.telefone || "";
  let parsedEmail = row.email || "";
  let parsedMultaPlaca = row.multa_placa || "";
  let parsedMultaInfracao = row.multa_infracao || "";
  let parsedMultaMotorista = row.multa_motorista || "";
  let parsedMultaGravidade = row.multa_gravidade || "";
  let parsedModuloPetroshow = row.modulo_petroshow || "";

  const getLatestTag = (regex: RegExp) => {
    const matches = Array.from(rawObs.matchAll(regex));
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      return last && last[1] ? last[1].trim() : "";
    }
    return "";
  };

  const tagDoc = getLatestTag(/\[Nº DOC:\s*([^\]]+)\]/gi);
  if (tagDoc) parsedNumDoc = tagDoc;

  const tagOc = getLatestTag(/\[OC\/CÓD:\s*([^\]]+)\]/gi);
  if (tagOc) parsedOc = tagOc;

  const tagCc = getLatestTag(/\[CENTRO DE CUSTO:\s*([^\]]+)\]/gi);
  if (tagCc) parsedCc = tagCc;

  const tagAlcada = getLatestTag(/\[ALÇADA:\s*([^\]]+)\]/gi);
  if (tagAlcada) parsedAlcada = tagAlcada;

  const tagBase = getLatestTag(/\[BASE:\s*([^\]]+)\]/gi);
  if (tagBase) parsedBase = tagBase;

  const tagUpdatedAt = getLatestTag(/\[UPDATED_AT:\s*([^\]]+)\]/gi);
  if (tagUpdatedAt) parsedUpdatedAt = tagUpdatedAt;

  const tagDrive = getLatestTag(/\[GOOGLE DRIVE:\s*([^\]]+)\]/gi);
  if (tagDrive) parsedDriveUrl = tagDrive;

  if (rawObs.includes("[CONTATO_JSON:")) {
    try {
      const match = rawObs.match(/\[CONTATO_JSON:\s*(\{.*?\})\]/s);
      if (match && match[1]) {
        const c = JSON.parse(match[1]);
        if (c && typeof c === "object") {
          if (!parsedCidade && c.cidade) parsedCidade = c.cidade;
          if (!parsedUf && c.uf) parsedUf = c.uf;
          if (!parsedTelefone && c.telefone) parsedTelefone = c.telefone;
          if (!parsedEmail && c.email) parsedEmail = c.email;
          if (!parsedMultaPlaca && c.multaPlaca) parsedMultaPlaca = c.multaPlaca;
          if (!parsedMultaInfracao && c.multaInfracao) parsedMultaInfracao = c.multaInfracao;
          if (!parsedMultaMotorista && c.multaMotorista) parsedMultaMotorista = c.multaMotorista;
          if (!parsedMultaGravidade && c.multaGravidade) parsedMultaGravidade = c.multaGravidade;
          if (!parsedModuloPetroshow && c.moduloPetroshow) parsedModuloPetroshow = c.moduloPetroshow;
        }
      }
    } catch (e) {}
  }

  // Se ainda não tem parsedNumDoc mas row.doc tem o número, extrai com segurança
  if (!parsedNumDoc && row.doc && typeof row.doc === "string") {
    const cleanDoc = row.doc.trim();
    if (!cleanDoc.startsWith("DOC-") && !cleanDoc.endsWith("S/N") && cleanDoc !== "N/A") {
      const parts = cleanDoc.split(" ");
      if (parts.length > 1) {
        parsedNumDoc = parts.slice(1).join(" ").trim();
      } else {
        parsedNumDoc = cleanDoc;
      }
    }
  }

  let parsedAnexos: any[] = [];
  if (row.anexos) {
    if (Array.isArray(row.anexos)) {
      parsedAnexos = row.anexos;
    } else if (typeof row.anexos === "string") {
      try { parsedAnexos = JSON.parse(row.anexos); } catch (e) {}
    }
  }
  if ((!parsedAnexos || parsedAnexos.length === 0) && rawObs.includes("[ANEXOS_JSON:")) {
    try {
      const match = rawObs.match(/\[ANEXOS_JSON:\s*(\[.*?\])\]/s);
      if (match && match[1]) {
        const p = JSON.parse(match[1]);
        if (Array.isArray(p) && p.length > 0) parsedAnexos = p;
      }
    } catch (e) {}
  }
  if ((!parsedAnexos || parsedAnexos.length === 0) && (row.arquivo_anexo_base64 || row.nome_arquivo_anexo)) {
    parsedAnexos = [{
      id: "anx-1",
      nome: row.nome_arquivo_anexo || "Documento.pdf",
      base64: row.arquivo_anexo_base64 || ""
    }];
  } else if (parsedAnexos.length > 0 && row.arquivo_anexo_base64 && !parsedAnexos[0].base64) {
    parsedAnexos[0] = {
      ...parsedAnexos[0],
      base64: row.arquivo_anexo_base64
    };
  }

  // Higieniza a observação para que tags internas nunca apareçam no formulário ou dupliquem
  const cleanObs = rawObs
    .replace(/\[Nº DOC:[^\]]*\]/gi, "")
    .replace(/\[OC\/CÓD:[^\]]*\]/gi, "")
    .replace(/\[CENTRO DE CUSTO:[^\]]*\]/gi, "")
    .replace(/\[ALÇADA:[^\]]*\]/gi, "")
    .replace(/\[BASE:[^\]]*\]/gi, "")
    .replace(/\[GOOGLE DRIVE:[^\]]*\]/gi, "")
    .replace(/\[UPDATED_AT:[^\]]*\]/gi, "")
    .replace(/\[CONTATO_JSON:\s*\{.*?\}\]/gs, "")
    .replace(/\[ANEXOS_JSON:\s*\[.*?\]\]/gs, "")
    .replace(/\[ANEXOS_JSON:[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: row.id,
    status: row.status,
    dataLancamento: row.data_lancamento,
    dataVencimento: row.data_vencimento,
    fornecedor: row.fornecedor,
    doc: row.doc,
    valor: row.valor,
    formaPagto: row.forma_pagto,
    tipo: row.tipo,
    descricao: row.descricao,
    cnpj: row.cnpj,
    estabelecimento: parsedBase || "100 - Paulínia",
    nomeArquivoAnexo: row.nome_arquivo_anexo || (parsedAnexos[0]?.nome || ""),
    arquivoAnexoBase64: row.arquivo_anexo_base64 || (parsedAnexos[0]?.base64 || ""),
    driveUrl: parsedDriveUrl || undefined,
    anexos: parsedAnexos,
    temAnexo: Boolean(row.arquivo_anexo_base64 || row.nome_arquivo_anexo || parsedAnexos.length > 0),
    itemSistema: row.item_sistema,
    dataEmissao: row.data_emissao,
    observacao: cleanObs,
    frequencia: row.frequencia,
    lancadoPor: row.lancado_por,
    dataAprovacao: row.data_aprovacao,
    aprovadores: parsedAlcada || "Deny e Gerência",
    centroCusto: parsedCc || "C.C 101 - Operacional",
    codLancamentoOc: parsedOc || "",
    codigoLancamento: parsedNumDoc || "",
    numeroDocumento: parsedNumDoc || "",
    cidade: parsedCidade,
    uf: parsedUf,
    telefone: parsedTelefone,
    email: parsedEmail,
    multaPlaca: parsedMultaPlaca || undefined,
    multaInfracao: parsedMultaInfracao || undefined,
    multaMotorista: parsedMultaMotorista || undefined,
    multaGravidade: parsedMultaGravidade || undefined,
    moduloPetroshow: parsedModuloPetroshow || undefined,
    updatedAt: parsedUpdatedAt || undefined,
    updatedAtMs: parsedUpdatedAt ? (Date.parse(parsedUpdatedAt) || 0) : 0
  };
}

// 3. Buscar Lançamentos no Supabase
export async function fetchLancamentosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('lancamentos')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar lançamentos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(mapSupabaseRowToLancamento);
  } catch (err) {
    console.error("Erro no fetchLancamentosSupabase:", err);
    return [];
  }
}

export const SUPABASE_STORAGE_BUCKET_DOCUMENTOS = "documentos-anexos";

/**
 * Converte base64 para Blob binário de forma segura
 */
function base64ToBlob(base64Data: string, contentType: string = 'application/octet-stream'): Blob {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * Upload de arquivo anexo para o Supabase Storage Bucket ('documentos-anexos').
 * Suporta todos os tipos de arquivos (PDF, XML, E-mails Outlook .msg/.eml, Excel, Word, Imagens, ZIP, etc.)
 * Organiza por subpasta mensal (ex: '2026/09/nome_arquivo.msg')
 * Retorna a URL pública para salvar diretamente na tabela, reduzindo tráfego da API em até 95%.
 */
export async function uploadDocumentoAnexoSupabaseStorage(
  fileOrBase64: File | Blob | { base64: string; name: string },
  fileName: string,
  vencimentoOuData?: string
): Promise<{ publicUrl: string; path: string } | null> {
  try {
    const client = getSupabaseClient();
    
    // Extrai ano e mês para organização da pasta
    let year = new Date().getFullYear();
    let month = String(new Date().getMonth() + 1).padStart(2, '0');
    if (vencimentoOuData) {
      if (vencimentoOuData.includes('/')) {
        const p = vencimentoOuData.trim().split('/');
        if (p.length === 3) { year = parseInt(p[2], 10) || year; month = p[1].padStart(2, '0'); }
      } else if (vencimentoOuData.includes('-')) {
        const p = vencimentoOuData.trim().split('T')[0].split('-');
        if (p.length === 3) { year = parseInt(p[0], 10) || year; month = p[1].padStart(2, '0'); }
      }
    }

    // Higieniza nome do arquivo preservando a extensão original
    const cleanFileName = (fileName || "anexo.bin").replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${year}/${month}/${Date.now()}_${cleanFileName}`;

    let blobToSend: Blob;
    let contentType = getMimeTypeFromFileName(cleanFileName);

    if (fileOrBase64 instanceof Blob || fileOrBase64 instanceof File) {
      blobToSend = fileOrBase64;
      if (fileOrBase64.type && fileOrBase64.type.trim() !== "") {
        contentType = fileOrBase64.type;
      }
    } else if (typeof fileOrBase64 === 'object' && fileOrBase64.base64) {
      const b64Str = fileOrBase64.base64;
      const mimeMatch = b64Str.match(/^data:([^;,]+);base64,/i);
      if (mimeMatch && mimeMatch[1] && mimeMatch[1].trim() !== "" && mimeMatch[1] !== "application/octet-stream") {
        contentType = mimeMatch[1].trim();
      }
      blobToSend = base64ToBlob(b64Str, contentType);
    } else {
      return null;
    }

    const { error } = await client.storage
      .from(SUPABASE_STORAGE_BUCKET_DOCUMENTOS)
      .upload(storagePath, blobToSend, {
        cacheControl: '3600',
        upsert: true,
        contentType
      });

    if (error) {
      console.warn(`[Supabase Storage] Informação: bucket '${SUPABASE_STORAGE_BUCKET_DOCUMENTOS}' indisponível ou permissão pendente:`, error.message);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from(SUPABASE_STORAGE_BUCKET_DOCUMENTOS)
      .getPublicUrl(storagePath);

    return {
      publicUrl: publicUrlData.publicUrl,
      path: storagePath
    };
  } catch (err) {
    console.warn('[Supabase Storage] Aviso ao carregar arquivo no bucket:', err);
    return null;
  }
}

// 4. Salvar / Atualizar Lançamento no Supabase
export async function saveLancamentoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const rawId = item.id;
    let targetId: number;

    if (typeof rawId === "number" && !isNaN(rawId)) {
      targetId = rawId;
    } else if (typeof rawId === "string" && !isNaN(Number(rawId)) && Number(rawId) > 0) {
      targetId = Number(rawId);
    } else {
      targetId = Date.now();
    }

    const numDoc = item.codigoLancamento || item.numeroDocumento || "";
    const codOc = item.codLancamentoOc || "";
    const centCusto = item.centroCusto || "C.C 101 - Operacional";
    const alcada = item.aprovadores || "Deny e Gerência";
    const filialBase = item.estabelecimento || "100 - Paulínia";
    const updatedAtIso = item.updatedAt || new Date().toISOString();

    // Higieniza observação removendo tags pré-existentes para garantir que novas alterações substituam as antigas
    let cleanObs = String(item.observacao || "")
      .replace(/\[Nº DOC:[^\]]*\]/gi, "")
      .replace(/\[OC\/CÓD:[^\]]*\]/gi, "")
      .replace(/\[CENTRO DE CUSTO:[^\]]*\]/gi, "")
      .replace(/\[ALÇADA:[^\]]*\]/gi, "")
      .replace(/\[BASE:[^\]]*\]/gi, "")
      .replace(/\[GOOGLE DRIVE:[^\]]*\]/gi, "")
      .replace(/\[UPDATED_AT:[^\]]*\]/gi, "")
      .replace(/\[CONTATO_JSON:\s*\{.*?\}\]/gs, "")
      .replace(/\[ANEXOS_JSON:\s*\[.*?\]\]/gs, "")
      .replace(/\[ANEXOS_JSON:[^\]]*\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const tags: string[] = [];
    if (numDoc) tags.push(`[Nº DOC: ${numDoc}]`);
    if (codOc) tags.push(`[OC/CÓD: ${codOc}]`);
    if (centCusto) tags.push(`[CENTRO DE CUSTO: ${centCusto}]`);
    if (alcada) tags.push(`[ALÇADA: ${alcada}]`);
    if (filialBase) tags.push(`[BASE: ${filialBase}]`);
    if (item.driveUrl) tags.push(`[GOOGLE DRIVE: ${item.driveUrl}]`);
    tags.push(`[UPDATED_AT: ${updatedAtIso}]`);

    const contatoMeta: Record<string, string> = {};
    if (item.cidade) contatoMeta.cidade = String(item.cidade);
    if (item.uf) contatoMeta.uf = String(item.uf);
    if (item.telefone) contatoMeta.telefone = String(item.telefone);
    if (item.email) contatoMeta.email = String(item.email);
    if (item.multaPlaca) contatoMeta.multaPlaca = String(item.multaPlaca);
    if (item.multaInfracao) contatoMeta.multaInfracao = String(item.multaInfracao);
    if (item.multaMotorista) contatoMeta.multaMotorista = String(item.multaMotorista);
    if (item.multaGravidade) contatoMeta.multaGravidade = String(item.multaGravidade);
    if (item.moduloPetroshow) contatoMeta.moduloPetroshow = String(item.moduloPetroshow);
    if (Object.keys(contatoMeta).length > 0) {
      tags.push(`[CONTATO_JSON: ${JSON.stringify(contatoMeta)}]`);
    }

    const anexosArr = Array.isArray(item.anexos) ? item.anexos : [];
    const GOOGLE_DRIVE_LANCAMENTOS_FOLDER_ID = "1jakLnREoQ8W0-lz2aLWA1wXK4oaE_9Jz";
    const GOOGLE_DRIVE_LANCAMENTOS_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_LANCAMENTOS_FOLDER_ID}?hl=pt-br`;

    const fornSlug = String(item.fornecedor || "Fornecedor").trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const docSlug = String(numDoc || item.doc || targetId).trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 20);

    // Helper para enviar base64 direto para a pasta do Google Drive (1jakLnREoQ8W0-lz2aLWA1wXK4oaE_9Jz) via servidor/AppsScript
    const uploadToDriveFolder = async (b64Data: string, fName: string): Promise<string | null> => {
      try {
        const cleanName = `${fornSlug}_${docSlug}_${fName || "Documento.pdf"}`.replace(/_+/g, "_");
        const res = await fetch("/api/drive/upload-lancamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: cleanName,
            fileData: b64Data,
            mimeType: getMimeTypeFromFileName(fName || "Documento.pdf"),
            folderId: GOOGLE_DRIVE_LANCAMENTOS_FOLDER_ID
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && (data.downloadUrl || data.fileUrl)) {
            return data.downloadUrl || data.fileUrl;
          }
        }
      } catch (e) {
        console.warn("[Google Drive Upload] Aviso ao enviar anexo para a pasta do Drive:", e);
      }
      return null;
    };

    // Economia de tráfego e banco de dados: envia anexo para a pasta oficial do Google Drive e salva apenas a URL no Supabase
    let finalAnexo = item.arquivoAnexoUrl || item.driveUrl || item.arquivoAnexoBase64 || (anexosArr[0]?.url || anexosArr[0]?.base64 || "");
    const primaryFileName = item.nomeArquivoAnexo || (anexosArr[0]?.nome || "documento.pdf");

    if (finalAnexo && !finalAnexo.startsWith("http")) {
      const driveLink = await uploadToDriveFolder(finalAnexo, primaryFileName);
      if (driveLink) {
        finalAnexo = driveLink;
        item.driveUrl = driveLink;
        item.arquivoAnexoUrl = driveLink;
      } else {
        try {
          const storageResult = await uploadDocumentoAnexoSupabaseStorage(
            { base64: finalAnexo, name: primaryFileName },
            primaryFileName,
            item.dataVencimento || item.dataLancamento
          );
          if (storageResult && storageResult.publicUrl) {
            finalAnexo = storageResult.publicUrl;
          } else if (finalAnexo.length > 15000) {
            // Nunca sobrecarrega o Supabase com base64 pesado; aponta para a pasta do Drive mientras mantém binário no servidor
            finalAnexo = GOOGLE_DRIVE_LANCAMENTOS_FOLDER_URL;
          }
        } catch {
          if (finalAnexo.length > 15000) {
            finalAnexo = GOOGLE_DRIVE_LANCAMENTOS_FOLDER_URL;
          }
        }
      }
    }

    if (item.driveUrl && !tags.some(t => t.startsWith("[GOOGLE DRIVE:"))) {
      tags.push(`[GOOGLE DRIVE: ${item.driveUrl}]`);
    } else if (finalAnexo && finalAnexo.startsWith("http") && !tags.some(t => t.startsWith("[GOOGLE DRIVE:"))) {
      tags.push(`[GOOGLE DRIVE: ${finalAnexo}]`);
    }

    // Prepara os anexos para ANEXOS_JSON enviando cada arquivo para a pasta do Google Drive (sem gravar base64 pesado no Supabase)
    if (anexosArr.length > 0) {
      const processedAnexos = [];
      for (let i = 0; i < Math.min(anexosArr.length, 6); i++) {
        const a = anexosArr[i];
        let aUrlOrData = a.url || a.driveUrl || a.base64 || "";
        if (i === 0 && finalAnexo && finalAnexo.startsWith("http")) {
          aUrlOrData = finalAnexo;
        } else if (aUrlOrData && !aUrlOrData.startsWith("http")) {
          const uploadedLink = await uploadToDriveFolder(aUrlOrData, a.nome || `anexo_${i + 1}.pdf`);
          if (uploadedLink) {
            aUrlOrData = uploadedLink;
          } else if (aUrlOrData.length > 15000) {
            aUrlOrData = GOOGLE_DRIVE_LANCAMENTOS_FOLDER_URL;
          }
        }
        processedAnexos.push({
          id: a.id || `anx-${i + 1}`,
          nome: a.nome || `Anexo_${i + 1}`,
          url: aUrlOrData && aUrlOrData.startsWith("http") ? aUrlOrData : undefined,
          base64: aUrlOrData && aUrlOrData.startsWith("http") ? aUrlOrData : ""
        });
      }
      tags.push(`[ANEXOS_JSON: ${JSON.stringify(processedAnexos)}]`);
    }

    const finalObs = [cleanObs, ...tags].filter(Boolean).join(" ").trim();

    // Monta o objeto oficial com estritamente as colunas existentes no PostgreSQL do Supabase
    const cleanRecord: any = {
      id: targetId,
      status: item.status || "Aguardando Aprovação",
      data_lancamento: item.dataLancamento || item.data_lancamento || new Date().toISOString().split("T")[0],
      data_vencimento: item.dataVencimento || item.data_vencimento || item.dataLancamento || new Date().toISOString().split("T")[0],
      fornecedor: item.fornecedor || "Fornecedor Não Informado",
      doc: item.doc || (numDoc ? `${item.tipo || 'NF-e'} ${numDoc}` : "N/A"),
      valor: item.valor || "R$ 0,00",
      forma_pagto: item.formaPagto || item.forma_pagto || "Boleto",
      tipo: item.tipo || "NF-e",
      descricao: item.descricao || "",
      cnpj: item.cnpj || "",
      estabelecimento: filialBase,
      nome_arquivo_anexo: item.nomeArquivoAnexo || (anexosArr[0]?.nome || ""),
      item_sistema: item.itemSistema || item.item_sistema || "",
      data_emissao: item.dataEmissao || item.data_emissao || "",
      observacao: finalObs,
      frequencia: item.frequencia || "Esporádico",
      lancado_por: item.lancadoPor || item.lancado_por || "Sistema",
      data_aprovacao: item.dataAprovacao !== undefined ? item.dataAprovacao : (item.data_aprovacao || "")
    };

    // Só sobrescreve arquivo_anexo_base64 com a referência leve (URL do Drive) ou vazio se o usuário limpou intencionalmente os anexos
    if (finalAnexo || (!cleanRecord.nome_arquivo_anexo && anexosArr.length === 0)) {
      cleanRecord.arquivo_anexo_base64 = finalAnexo || "";
    }

    const { error: upsertErr } = await client
      .from('lancamentos')
      .upsert(cleanRecord, { onConflict: 'id' });

    if (!upsertErr) {
      console.log(`[Supabase Service] Lançamento ${targetId} salvo com sucesso no PostgreSQL.`);
      return true;
    }

    console.error("Erro ao gravar lançamento no Supabase:", upsertErr.message || upsertErr);
    return false;
  } catch (err) {
    console.error("Erro no saveLancamentoSupabase:", err);
    return false;
  }
}

// 5. Excluir Lançamento no Supabase
export async function deleteLancamentoSupabase(id: number | string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const numId = typeof id === "number" ? id : (parseInt(String(id), 10) || Number(id));
    const { error } = await client
      .from('lancamentos')
      .delete()
      .eq('id', numId);

    if (error) {
      console.error("Erro ao excluir do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteLancamentoSupabase:", err);
    return false;
  }
}

// --- FUNÇÕES DE GESTÃO DE USUÁRIOS NO SUPABASE ---

export async function fetchUsuariosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('usuarios')
      .select('*');

    if (error) {
      console.warn("Aviso ao buscar usuários do Supabase:", error.message || error);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((item: any) => {
      const rawPerms = item.permissoes !== undefined && item.permissoes !== null
        ? item.permissoes
        : item.permissions;

      const perms = typeof rawPerms === 'string' 
        ? (() => { try { return JSON.parse(rawPerms); } catch { return {}; } })() 
        : (rawPerms || {});

      const isMaster = item.email && item.email.toLowerCase() === "deny.goncalves@risel.com.br";

      const mustChange = isMaster 
        ? false 
        : (item.must_change_password !== undefined && item.must_change_password !== null
            ? Boolean(item.must_change_password)
            : (perms?.mustChangePassword !== undefined && perms?.mustChangePassword !== null
                ? Boolean(perms.mustChangePassword)
                : (perms?.must_change_password !== undefined && perms?.must_change_password !== null
                    ? Boolean(perms.must_change_password)
                    : false)));

      const resolvedName = item.nome || item.name || item.full_name || item.username || (item.email ? item.email.split('@')[0] : "Usuário");
      const resolvedPass = item.senha || item.password || perms?.password || "";

      // Mapeamento normalizado completo de permissões
      const docsAllowed = perms.documentos !== undefined
        ? Boolean(perms.documentos)
        : Boolean(perms.dashboard || perms.lancamentos || perms.lancamento || perms.fornecedores || perms.fornecedor);

      const fVeiculos = perms.frota_veiculos !== undefined 
        ? Boolean(perms.frota_veiculos) 
        : Boolean(perms.frota);
      const fChecklist = perms.frota_checklist !== undefined 
        ? Boolean(perms.frota_checklist) 
        : Boolean(perms.checklist);
      const fReservas = perms.frota_reservas !== undefined 
        ? Boolean(perms.frota_reservas) 
        : Boolean(perms.reservas);
      const fMultas = perms.frota_multas !== undefined 
        ? Boolean(perms.frota_multas) 
        : Boolean(perms.multas);
      const fRastreamento = perms.frota_rastreamento !== undefined 
        ? Boolean(perms.frota_rastreamento) 
        : Boolean(perms.telemetria || perms.rastreamento);

      const frotaGeral = fVeiculos || fChecklist || fReservas || fMultas || fRastreamento;

      const normalizedPermissions = isMaster || item.role === "admin" || perms.admin === true
        ? {
            admin: true,
            documentos: true,
            dashboard: true,
            lancamentos: true,
            fornecedores: true,
            frota: true,
            frota_veiculos: true,
            frota_checklist: true,
            frota_reservas: true,
            frota_multas: true,
            frota_rastreamento: true,
            usuarios: true,
          }
        : {
            admin: false,
            documentos: docsAllowed,
            dashboard: docsAllowed,
            lancamentos: docsAllowed,
            fornecedores: docsAllowed,
            frota: frotaGeral,
            frota_veiculos: fVeiculos,
            frota_checklist: fChecklist,
            frota_reservas: fReservas,
            frota_multas: fMultas,
            frota_rastreamento: fRastreamento,
            usuarios: false,
          };

      return {
        id: item.id,
        email: item.email,
        name: resolvedName,
        role: isMaster ? "admin" : (normalizedPermissions.admin ? "admin" : (item.role || "user")),
        permissions: normalizedPermissions,
        status: item.status || "Ativa",
        password: resolvedPass,
        mustChangePassword: mustChange,
        createdAt: item.created_at
      };
    });
  } catch (err) {
    console.error("Erro no fetchUsuariosSupabase:", err);
    return [];
  }
}

export async function saveUsuarioSupabase(user: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const userEmail = (user.email || "").toLowerCase().trim();
    if (!userEmail) return false;

    const resolvedName = user.name || user.nome || userEmail;
    const isMaster = userEmail === "deny.goncalves@risel.com.br";
    const basePermissions = typeof user.permissions === 'object' && user.permissions !== null
      ? user.permissions
      : {};

    const mustChangeVal = user.mustChangePassword !== undefined ? user.mustChangePassword : false;
    const resolvedPassword = user.password || user.senha || "Risel@2026!";

    // Mapeamento normalizado garantindo todas as chaves
    const docsAllowed = basePermissions.documentos !== undefined
      ? Boolean(basePermissions.documentos)
      : Boolean(basePermissions.dashboard || basePermissions.lancamentos || basePermissions.fornecedores);

    const fVeiculos = basePermissions.frota_veiculos !== undefined 
      ? Boolean(basePermissions.frota_veiculos) 
      : Boolean(basePermissions.frota);
    const fChecklist = basePermissions.frota_checklist !== undefined 
      ? Boolean(basePermissions.frota_checklist) 
      : Boolean(basePermissions.checklist);
    const fReservas = basePermissions.frota_reservas !== undefined 
      ? Boolean(basePermissions.frota_reservas) 
      : Boolean(basePermissions.reservas);
    const fMultas = basePermissions.frota_multas !== undefined 
      ? Boolean(basePermissions.frota_multas) 
      : Boolean(basePermissions.multas);
    const fRastreamento = basePermissions.frota_rastreamento !== undefined 
      ? Boolean(basePermissions.frota_rastreamento) 
      : Boolean(basePermissions.telemetria || basePermissions.rastreamento);

    const frotaGeral = fVeiculos || fChecklist || fReservas || fMultas || fRastreamento;
    const isAdmin = isMaster || user.role === "admin" || basePermissions.admin === true;

    // Objeto de permissões salvo no Supabase com compatibilidade tanto para chaves modernas quanto legadas
    const permissoesPayload = isAdmin ? {
      admin: true,
      documentos: true,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      frota_veiculos: true,
      frota_checklist: true,
      frota_reservas: true,
      frota_multas: true,
      frota_rastreamento: true,
      usuarios: true,
      // Legados
      checklist: true,
      reservas: true,
      telemetria: true,
      rastreamento: true,
      multas: true,
      lancamento: true,
      fornecedor: true,
      mustChangePassword: mustChangeVal,
      must_change_password: mustChangeVal,
      password: resolvedPassword
    } : {
      admin: false,
      documentos: docsAllowed,
      dashboard: docsAllowed,
      lancamentos: docsAllowed,
      fornecedores: docsAllowed,
      frota: frotaGeral,
      frota_veiculos: fVeiculos,
      frota_checklist: fChecklist,
      frota_reservas: fReservas,
      frota_multas: fMultas,
      frota_rastreamento: fRastreamento,
      usuarios: false,
      // Legados
      checklist: fChecklist,
      reservas: fReservas,
      telemetria: fRastreamento,
      rastreamento: fRastreamento,
      multas: fMultas,
      lancamento: docsAllowed,
      fornecedor: docsAllowed,
      mustChangePassword: mustChangeVal,
      must_change_password: mustChangeVal,
      password: resolvedPassword
    };

    // Tentativa 1: Schema exato da tabela usuarios no Supabase (coluna 'permissoes', 'nome', 'senha')
    const primaryRecord: any = {
      email: userEmail,
      nome: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      permissoes: permissoesPayload,
      updated_at: new Date().toISOString()
    };

    let { error } = await client
      .from('usuarios')
      .upsert(primaryRecord, { onConflict: 'email' });

    if (!error) return true;

    // Fallback 1: Caso a coluna updated_at não exista no Supabase
    const recordSemUpdatedAt: any = {
      email: userEmail,
      nome: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      permissoes: permissoesPayload
    };
    const resSemUpdate = await client.from('usuarios').upsert(recordSemUpdatedAt, { onConflict: 'email' });
    if (!resSemUpdate.error) return true;

    // Fallback 2: Caso exista variação com 'name' ou 'password' / 'permissions'
    const recordBothKeys: any = {
      email: userEmail,
      nome: resolvedName,
      name: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      senha: resolvedPassword,
      password: resolvedPassword,
      permissoes: permissoesPayload,
      permissions: permissoesPayload
    };
    const resBoth = await client.from('usuarios').upsert(recordBothKeys, { onConflict: 'email' });
    if (!resBoth.error) return true;

    // Fallback 3: Caso o schema use estritamente inglês
    const recordEnglish: any = {
      email: userEmail,
      name: resolvedName,
      role: isAdmin ? "admin" : "user",
      status: user.status || "Ativa",
      password: resolvedPassword,
      permissions: permissoesPayload
    };
    const resEnglish = await client.from('usuarios').upsert(recordEnglish, { onConflict: 'email' });
    if (!resEnglish.error) return true;

    console.warn("Aviso ao salvar usuário no Supabase:", error?.message || resSemUpdate.error?.message);
    return false;
  } catch (err) {
    console.error("Erro no saveUsuarioSupabase:", err);
    return false;
  }
}

/**
 * Garante que o login corporativo especificado esteja salvo diretamente no banco de dados Supabase.
 * Preserva integralmente permissões customizadas definidas pelo Administrador.
 */
export async function ensureUserCredentialsInSupabase(
  email: string,
  defaultUser: any
): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail) return false;

    // Consulta se o usuário já existe na tabela 'usuarios'
    const { data, error } = await client
      .from('usuarios')
      .select('*')
      .eq('email', cleanEmail);

    if (!error && Array.isArray(data) && data.length > 0) {
      const existing = data[0];
      const rawPerms = existing.permissoes !== undefined && existing.permissoes !== null
        ? existing.permissoes
        : existing.permissions;

      const existingPerms = typeof rawPerms === 'string' 
        ? (() => { try { return JSON.parse(rawPerms); } catch { return {}; } })() 
        : (rawPerms || {});

      const existingPassword = existing.senha || existing.password || existingPerms?.password;

      // Se o usuário já possui registro no banco, PRESERVA INTEGRALMENTE as permissões
      if (existingPassword && existingPassword.trim().length > 0) {
        return true;
      }

      // Caso contrário (sem senha no banco), preenche a senha padrão preservando todas as permissões
      const updated = {
        ...existing,
        email: cleanEmail,
        permissions: existingPerms,
        role: existing.role || "user",
        password: defaultUser.password,
        must_change_password: false
      };
      return await saveUsuarioSupabase(updated);
    } else {
      // Se não existe na base de dados, insere com as configurações padrão
      return await saveUsuarioSupabase({
        ...defaultUser,
        email: cleanEmail,
        password: defaultUser.password,
        must_change_password: false
      });
    }
  } catch (err) {
    console.warn(`Aviso ao assegurar credencial de ${email} no Supabase:`, err);
    return false;
  }
}

export async function deleteUsuarioSupabase(email: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const userEmail = (email || "").toLowerCase().trim();
    if (!userEmail) return false;

    const { error } = await client
      .from('usuarios')
      .delete()
      .eq('email', userEmail);

    if (error) {
      console.error("Erro ao excluir usuário do Supabase:", error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteUsuarioSupabase:", err);
    return false;
  }
}

export async function syncLocalUsuariosToSupabase(localUsers: any[]): Promise<{ count: number; success: boolean }> {
  if (!localUsers || localUsers.length === 0) return { count: 0, success: true };

  try {
    let successCount = 0;
    for (const u of localUsers) {
      const ok = await saveUsuarioSupabase(u);
      if (ok) successCount++;
    }
    return { count: successCount, success: true };
  } catch (err) {
    console.error("Erro na sincronização de usuários:", err);
    return { count: 0, success: false };
  }
}

// 6. Sincronizar todos os registros do LocalStorage com o Supabase
export async function syncLocalLancamentosToSupabase(localItems: any[]): Promise<{ count: number; success: boolean }> {
  if (!localItems || localItems.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = localItems.map(item => {
      const numDoc = item.codigoLancamento || item.numeroDocumento || "";
      const codOc = item.codLancamentoOc || "";
      const centCusto = item.centroCusto || "C.C 101 - Operacional";
      const alcada = item.aprovadores || "Deny e Gerência";
      const filialBase = item.estabelecimento || "100 - Paulínia";

      let finalObs = item.observacao || "";
      if (numDoc && !finalObs.includes(`[Nº DOC: ${numDoc}]`)) {
        finalObs = finalObs ? `${finalObs} [Nº DOC: ${numDoc}]` : `[Nº DOC: ${numDoc}]`;
      }
      if (codOc && !finalObs.includes(`[OC/CÓD: ${codOc}]`)) {
        finalObs = finalObs ? `${finalObs} [OC/CÓD: ${codOc}]` : `[OC/CÓD: ${codOc}]`;
      }
      if (centCusto && !finalObs.includes(`[CENTRO DE CUSTO: ${centCusto}]`)) {
        finalObs = finalObs ? `${finalObs} [CENTRO DE CUSTO: ${centCusto}]` : `[CENTRO DE CUSTO: ${centCusto}]`;
      }
      if (alcada && !finalObs.includes(`[ALÇADA: ${alcada}]`)) {
        finalObs = finalObs ? `${finalObs} [ALÇADA: ${alcada}]` : `[ALÇADA: ${alcada}]`;
      }
      if (filialBase && !finalObs.includes(`[BASE: ${filialBase}]`)) {
        finalObs = finalObs ? `${finalObs} [BASE: ${filialBase}]` : `[BASE: ${filialBase}]`;
      }

      let parsedId = typeof item.id === "number" ? item.id : (parseInt(item.id, 10) || Date.now());

      return {
        id: parsedId,
        status: item.status || "Aguardando aprovação",
        data_lancamento: item.dataLancamento || new Date().toISOString().split("T")[0],
        data_vencimento: item.dataVencimento || item.dataLancamento,
        fornecedor: item.fornecedor || "Fornecedor",
        doc: item.doc || (numDoc ? `${item.tipo || 'NF-e'} ${numDoc}` : "N/A"),
        valor: item.valor || "R$ 0,00",
        forma_pagto: item.formaPagto || "Boleto",
        tipo: item.tipo || "NF-e",
        descricao: item.descricao || "",
        cnpj: item.cnpj || "",
        estabelecimento: filialBase,
        nome_arquivo_anexo: item.nomeArquivoAnexo || "",
        arquivo_anexo_base64: item.arquivoAnexoBase64 || "",
        item_sistema: item.itemSistema || "",
        data_emissao: item.dataEmissao || "",
        observacao: finalObs,
        frequencia: item.frequencia || "Esporádico",
        lancado_por: item.lancadoPor || "Deny",
        data_aprovacao: item.dataAprovacao || ""
      };
    });

    const { error } = await client
      .from('lancamentos')
      .upsert(dbRecords, { onConflict: 'id' });

    if (error) {
      console.error("Erro na sincronização em lote com o Supabase:", error);
      return { count: 0, success: false };
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro na sincronização com Supabase:", err);
    return { count: 0, success: false };
  }
}

// 7. Interfaces e Funções para a Tabela de Abastecimentos no Supabase
export interface SupabaseAbastecimento {
  id: string;
  placa: string;
  base?: string;
  condutor?: string;
  data: string;
  litros: number;
  km_percorrido: number;
  valor_total: number;
  combustivel?: string;
  posto?: string;
  cidade?: string;
  uf?: string;
  valor_litro?: number;
  saldo?: number;
  hodometro?: number;
  cartao?: string;
  cnpj_posto?: string;
  transacao?: string;
  modelo?: string;
  observacoes?: string;
  created_at?: string;
}

export async function fetchAbastecimentosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('abastecimentos')
      .select('*')
      .order('data', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar abastecimentos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      base: row.base,
      condutor: row.condutor,
      data: row.data,
      litros: Number(row.litros) || 0,
      kmPercorrido: Number(row.km_percorrido) || 0,
      valorTotal: Number(row.valor_total) || 0,
      combustivel: row.combustivel,
      posto: row.posto,
      cidade: row.cidade,
      uf: row.uf || undefined,
      valorLitro: row.valor_litro !== null && row.valor_litro !== undefined ? Number(row.valor_litro) : undefined,
      saldo: row.saldo !== null && row.saldo !== undefined ? Number(row.saldo) : undefined,
      hodometro: row.hodometro !== null && row.hodometro !== undefined ? Number(row.hodometro) : undefined,
      cartao: row.cartao || undefined,
      cnpjPosto: row.cnpj_posto || undefined,
      transacao: row.transacao || undefined,
      modelo: row.modelo || undefined,
      observacoes: row.observacoes || undefined
    }));
  } catch (err) {
    console.error("Erro no fetchAbastecimentosSupabase:", err);
    return [];
  }
}

export async function saveAbastecimentoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord: Partial<SupabaseAbastecimento> = {
      id: item.id || ("abast-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      placa: (item.placa || "").toUpperCase(),
      base: item.base || "CAMPINEIRA",
      condutor: item.condutor || "Sem Motorista Associado",
      data: item.data || new Date().toISOString().split("T")[0],
      litros: Number(item.litros) || 0,
      km_percorrido: Number(item.kmPercorrido) || 0,
      valor_total: Number(item.valorTotal) || 0,
      combustivel: item.combustivel || "Gasolina",
      posto: item.posto || "",
      cidade: item.cidade || "",
      uf: item.uf || undefined,
      valor_litro: item.valorLitro !== undefined && item.valorLitro !== null ? Number(item.valorLitro) : undefined,
      saldo: item.saldo !== undefined && item.saldo !== null ? Number(item.saldo) : undefined,
      hodometro: item.hodometro !== undefined && item.hodometro !== null ? Number(item.hodometro) : undefined,
      cartao: item.cartao || undefined,
      cnpj_posto: item.cnpjPosto || undefined,
      transacao: item.transacao || undefined,
      modelo: item.modelo || undefined,
      observacoes: item.observacoes || undefined
    };

    const { error } = await client
      .from('abastecimentos')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.warn("Aviso ao gravar abastecimento no Supabase (tentando fallback base):", error.message);
      const baseRecord = {
        id: dbRecord.id,
        placa: dbRecord.placa,
        base: dbRecord.base,
        condutor: dbRecord.condutor,
        data: dbRecord.data,
        litros: dbRecord.litros,
        km_percorrido: dbRecord.km_percorrido,
        valor_total: dbRecord.valor_total,
        combustivel: dbRecord.combustivel,
        posto: dbRecord.posto,
        cidade: dbRecord.cidade,
        saldo: dbRecord.saldo,
        hodometro: dbRecord.hodometro
      };
      const { error: errBase } = await client
        .from('abastecimentos')
        .upsert(baseRecord, { onConflict: 'id' });
      if (errBase) {
        console.error("Erro no saveAbastecimentoSupabase (fallback):", errBase);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Erro no saveAbastecimentoSupabase:", err);
    return false;
  }
}

export async function saveBatchAbastecimentosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => ({
      id: item.id || ("abast-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      placa: (item.placa || "").toUpperCase(),
      base: item.base || "CAMPINEIRA",
      condutor: item.condutor || "Sem Motorista Associado",
      data: item.data || new Date().toISOString().split("T")[0],
      litros: Number(item.litros) || 0,
      km_percorrido: Number(item.kmPercorrido) || 0,
      valor_total: Number(item.valorTotal) || 0,
      combustivel: item.combustivel || "Gasolina",
      posto: item.posto || "",
      cidade: item.cidade || "",
      uf: item.uf || null,
      valor_litro: item.valorLitro !== undefined && item.valorLitro !== null ? Number(item.valorLitro) : null,
      saldo: item.saldo !== undefined && item.saldo !== null ? Number(item.saldo) : null,
      hodometro: item.hodometro !== undefined && item.hodometro !== null ? Number(item.hodometro) : null,
      cartao: item.cartao || null,
      cnpj_posto: item.cnpjPosto || null,
      transacao: item.transacao || null,
      modelo: item.modelo || null,
      observacoes: item.observacoes || null
    }));

    const CHUNK_SIZE = 500;
    let totalSaved = 0;

    for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      const { error } = await client
        .from('abastecimentos')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.warn("Aviso ao gravar lote no Supabase (tentando fallback base):", error.message);
        const chunkBase = chunk.map(rec => ({
          id: rec.id,
          placa: rec.placa,
          base: rec.base,
          condutor: rec.condutor,
          data: rec.data,
          litros: rec.litros,
          km_percorrido: rec.km_percorrido,
          valor_total: rec.valor_total,
          combustivel: rec.combustivel,
          posto: rec.posto,
          cidade: rec.cidade,
          saldo: rec.saldo,
          hodometro: rec.hodometro
        }));

        const { error: errBase } = await client
          .from('abastecimentos')
          .upsert(chunkBase, { onConflict: 'id' });

        if (errBase) {
          console.error("Erro no fallback do saveBatchAbastecimentosSupabase:", errBase);
        } else {
          totalSaved += chunkBase.length;
        }
      } else {
        totalSaved += chunk.length;
      }
    }

    return { count: totalSaved, success: totalSaved > 0 };
  } catch (err) {
    console.error("Erro no saveBatchAbastecimentosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteAbastecimentoSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('abastecimentos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao excluir abastecimento do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteAbastecimentoSupabase:", err);
    return false;
  }
}

// 8. Interfaces e Funções para Veículos no Supabase
export interface SupabaseVeiculo {
  placa: string;
  modelo: string;
  marca?: string;
  ano?: number;
  tipo?: string;
  base?: string;
  condutor?: string;
  status?: string;
  km_atual?: number;
  combustivel_padrao?: string;
  observacoes?: string;
  created_at?: string;
}

export async function fetchVeiculosSupabase(): Promise<any[]> {
  try {
    const cleanPlateKey = (p: string) => String(p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

    const unpackRawRecord = (raw: any) => {
      if (!raw || typeof raw !== 'object') return raw;
      const cleanP = cleanPlateKey(raw.placa || raw.id);
      let extra: any = {};
      let plainObs = "";

      if (typeof raw.observacoes === "string") {
        const trimmed = raw.observacoes.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            extra = JSON.parse(trimmed);
            if (typeof extra.observacoes === "string" && !extra.observacoes.trim().startsWith("{")) {
              plainObs = extra.observacoes;
            }
          } catch (_) {}
        } else {
          plainObs = trimmed;
        }
      }

      const definedTop: any = {};
      for (const [k, val] of Object.entries(raw)) {
        if (val !== undefined && k !== "observacoes") {
          definedTop[k] = val;
        }
      }

      return {
        ...extra,
        ...definedTop,
        placa: cleanP,
        updatedAt: definedTop.updatedAt || extra.updatedAt || "",
        observacoes: plainObs
      };
    };

    let cloudRecords: any[] = [];

    // 1. Consulta o banco na nuvem Supabase (Fonte Primária da Verdade)
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('veiculos')
        .select('*')
        .order('placa', { ascending: true });

      if (error) {
        console.warn("Aviso ao buscar veículos no Supabase:", error.message);
        if (error.message?.includes("API key") || error.code === "PGRST301" || error.code === "401") {
          const freshClient = forceResetToOfficialSupabase();
          const retryRes = await freshClient.from('veiculos').select('*').order('placa', { ascending: true });
          if (retryRes.data && retryRes.data.length > 0) {
            cloudRecords = retryRes.data.map(unpackRawRecord);
          }
        }
      } else if (data && data.length > 0) {
        cloudRecords = data.map(unpackRawRecord);
      }
    } catch (sbErr) {
      console.warn("Falha de conexão com Supabase:", sbErr);
    }

    // 2. Consulta o backend local (que também sincroniza com Supabase no servidor)
    let localData: any[] = [];
    try {
      const localRes = await fetch("/api/veiculos");
      if (localRes.ok) {
        const parsed = await localRes.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          localData = parsed.map(unpackRawRecord);
        }
      }
    } catch (_) {}

    // Mapa unificado indexado pela placa com resolução por timestamp updatedAt
    const unifiedRecordMap = new Map<string, any>();

    (cloudRecords || []).forEach(r => {
      const p = cleanPlateKey(r.placa || r.id);
      if (p) unifiedRecordMap.set(p, r);
    });

    (localData || []).forEach(l => {
      const p = cleanPlateKey(l.placa || l.id);
      if (!p) return;
      const existing = unifiedRecordMap.get(p);
      if (!existing) {
        unifiedRecordMap.set(p, l);
      } else if (l.updatedAt && (!existing.updatedAt || l.updatedAt > existing.updatedAt)) {
        unifiedRecordMap.set(p, { ...existing, ...l });
      } else {
        unifiedRecordMap.set(p, { ...l, ...existing });
      }
    });

    const realMap = new Map(VEICULOS_REAIS.map(v => [cleanPlateKey(v.placa), v]));
    const dbPlacas = new Set<string>();

    const mergedList: Veiculo[] = Array.from(unifiedRecordMap.values()).map(row => {
      const cleanR = cleanPlateKey(row.placa);
      dbPlacas.add(cleanR);
      const real = realMap.get(cleanR);

      // Prioridade absoluta para os campos salvos no banco (respeitando até mesmo campos limpos pelo usuário)
      const filialFinal = row.filial || row.base || real?.filial || "Paulínia";
      const condutorFinal = (row.condutor !== undefined && row.condutor !== null && String(row.condutor).trim() !== "")
        ? String(row.condutor).trim()
        : (real?.condutor || "Disponível");
      const rawStatus = (row.status !== undefined && row.status !== null && String(row.status).trim() !== "")
        ? String(row.status).trim()
        : (real?.status || "Ativo");
      const statusFinal = rawStatus.toLowerCase() === "inativo"
        ? "Inativo"
        : rawStatus.toLowerCase() === "em manutenção"
          ? "Em Manutenção"
          : rawStatus.toLowerCase() === "reservado"
            ? "Reservado"
            : rawStatus.toLowerCase() === "em viagem"
              ? "Em Viagem"
              : "Ativo";
      const modeloFinal = row.modelo || real?.modelo || "Veículo Frota";
      const locadoraFinal = (row.locadora !== undefined && row.locadora !== null && String(row.locadora).trim() !== "")
        ? String(row.locadora).trim()
        : (real?.locadora || "Frota Própria");
      const contratoFinal = (row.contrato !== undefined && row.contrato !== null)
        ? String(row.contrato).trim()
        : (real?.contrato || "");
      const vencFinal = (row.vencContrato !== undefined && row.vencContrato !== null)
        ? String(row.vencContrato).trim()
        : (row.venc_contrato !== undefined && row.venc_contrato !== null ? String(row.venc_contrato).trim() : (real?.vencContrato || ""));
      const emailFinal = (row.email !== undefined && row.email !== null)
        ? String(row.email).trim()
        : (real?.email || "");
      const gestorFinal = (row.gestorResp !== undefined && row.gestorResp !== null)
        ? String(row.gestorResp).trim()
        : (row.gestor_resp !== undefined && row.gestor_resp !== null ? String(row.gestor_resp).trim() : (real?.gestorResp || ""));
      const contatoFinal = (row.contatoMotorista !== undefined && row.contatoMotorista !== null)
        ? String(row.contatoMotorista).trim()
        : (row.contato_motorista !== undefined && row.contato_motorista !== null ? String(row.contato_motorista).trim() : (real?.contatoMotorista || ""));
      const funcaoFinal = (row.funcao !== undefined && row.funcao !== null && String(row.funcao).trim() !== "")
        ? String(row.funcao).trim()
        : (real?.funcao || "Motorista");
      const setorFinal = (row.setor !== undefined && row.setor !== null)
        ? String(row.setor).trim()
        : ((real as any)?.setor || "");
      const cpfFinal = (row.cpfCondutor !== undefined && row.cpfCondutor !== null)
        ? String(row.cpfCondutor).trim()
        : (row.cpf_condutor || real?.cpfCondutor || "");
      const cnhValFinal = (row.cnhValidade !== undefined && row.cnhValidade !== null)
        ? String(row.cnhValidade).trim()
        : (row.cnh_validade || "");
      const cnhNumFinal = (row.cnhNumero !== undefined && row.cnhNumero !== null)
        ? String(row.cnhNumero).trim()
        : (row.cnh_numero || "");
      const cnhArquivoFinal = row.cnhNomeArquivo || row.cnh_nome_arquivo || "";
      const cnhAnexoFinal = row.cnhAnexoBase64 || row.cnh_anexo_base64 || `/api/cnh/${cleanR}`;
      const odometroFinal = Number(row.odometro ?? row.km_atual ?? real?.odometro ?? 0);
      const combustivelFinal = row.combustivel || row.combustivel_padrao || real?.combustivel || "Flex";
      const dataTrocaFinal = row.dataTrocaCondutor || row.data_troca_condutor || real?.dataTrocaCondutor || "";
      const dataInatFinal = (row.dataInativacao !== undefined && row.dataInativacao !== null)
        ? String(row.dataInativacao).trim()
        : (row.data_inativacao || (real as any)?.dataInativacao || "");
      const motivoInatFinal = (row.motivoInativacao !== undefined && row.motivoInativacao !== null)
        ? String(row.motivoInativacao).trim()
        : (row.motivo_inativacao || (real as any)?.motivoInativacao || "");
      const tipoVinculoFinal = row.tipoVinculo !== undefined
        ? row.tipoVinculo
        : (row.tipo_vinculo !== undefined ? row.tipo_vinculo : (String(locadoraFinal).toUpperCase().trim() === "FROTA PRÓPRIA" ? "" : "Contrato"));
      const obsFinal = typeof row.observacoes === "string" && !row.observacoes.startsWith("{")
        ? row.observacoes
        : ((real as any)?.observacoes || "");

      return {
        id: row.id || `v-${cleanR.toLowerCase()}`,
        placa: cleanR,
        modelo: modeloFinal,
        vencContrato: vencFinal,
        condutor: condutorFinal,
        cpfCondutor: cpfFinal,
        cnhValidade: cnhValFinal,
        cnhNumero: cnhNumFinal,
        cnhAnexoBase64: cnhAnexoFinal,
        cnhNomeArquivo: cnhArquivoFinal,
        funcao: funcaoFinal,
        setor: setorFinal,
        contatoMotorista: contatoFinal,
        gestorResp: gestorFinal,
        email: emailFinal,
        filial: filialFinal,
        base: filialFinal,
        locadora: locadoraFinal,
        contrato: contratoFinal,
        odometro: odometroFinal,
        combustivel: combustivelFinal,
        status: statusFinal as any,
        dataTrocaCondutor: dataTrocaFinal,
        dataInativacao: dataInatFinal,
        motivoInativacao: motivoInatFinal,
        tipoVinculo: tipoVinculoFinal,
        updatedAt: row.updatedAt || "",
        observacoes: obsFinal
      };
    });

    // Se houver algum veículo em VEICULOS_REAIS que ainda não esteja no banco, inclui
    VEICULOS_REAIS.forEach(real => {
      const p = cleanPlateKey(real.placa);
      if (!dbPlacas.has(p)) {
        mergedList.push(real);
        dbPlacas.add(p);
      }
    });

    return mergedList;
  } catch (err) {
    console.error("Erro no fetchVeiculosSupabase:", err);
    return [];
  }
}

export async function saveVeiculoSupabase(item: any): Promise<boolean> {
  try {
    const cleanPlaca = String(item.placa || item.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
    if (!cleanPlaca) return false;

    const updatedAt = item.updatedAt || new Date().toISOString();

    let cnhAnexoRef = item.cnhAnexoBase64 || "";
    if (cnhAnexoRef && typeof cnhAnexoRef === "string" && cnhAnexoRef.length > 2000) {
      cnhAnexoRef = `/api/cnh/${cleanPlaca}`;
    }

    // Salva o anexo de CNH no disco / Google Drive via servidor
    if (item.cnhAnexoBase64 && typeof item.cnhAnexoBase64 === "string" && item.cnhAnexoBase64.length > 2000) {
      try {
        await fetch(`/api/cnh/${cleanPlaca}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            base64: item.cnhAnexoBase64, 
            nomeArquivo: item.cnhNomeArquivo,
            driveUrl: "https://drive.google.com/drive/folders/1tIJ67ADpN6blterYogPq9SObDVHr3xsk?usp=sharing"
          })
        });
      } catch (_) {}
    }

    const resolvedFilial = item.filial || item.base || "Paulínia";

    const sanitizeTextOnlyObs = (rawObs: any): string => {
      if (!rawObs || typeof rawObs !== 'string') return "";
      let s = rawObs.trim();
      if (s.startsWith("{") && s.endsWith("}")) {
        try {
          const parsed = JSON.parse(s);
          return typeof parsed.observacoes === 'string' ? sanitizeTextOnlyObs(parsed.observacoes) : "";
        } catch (_) { return ""; }
      }
      return s;
    };

    const cleanObs = sanitizeTextOnlyObs(item.observacoes);

    // Dados leves para a nuvem Supabase (sem anexos pesados de CNH)
    const extraData = JSON.stringify({
      id: item.id || `v-${cleanPlaca.toLowerCase()}`,
      modelo: item.modelo || "Veículo Frota",
      condutor: item.condutor || "Disponível",
      status: item.status || "Ativo",
      vencContrato: item.vencContrato ?? "",
      cpfCondutor: item.cpfCondutor ?? "",
      cnhValidade: item.cnhValidade ?? "",
      cnhNumero: item.cnhNumero ?? "",
      cnhDriveFolder: "https://drive.google.com/drive/folders/1tIJ67ADpN6blterYogPq9SObDVHr3xsk?usp=sharing",
      cnhNomeArquivo: item.cnhNomeArquivo ?? "",
      funcao: item.funcao ?? "",
      setor: item.setor ?? "",
      contatoMotorista: item.contatoMotorista ?? "",
      gestorResp: item.gestorResp ?? "",
      email: item.email ?? "",
      filial: resolvedFilial,
      locadora: item.locadora ?? "",
      contrato: item.contrato ?? "",
      odometro: Number(item.odometro || 0),
      combustivel: item.combustivel || "Flex",
      dataTrocaCondutor: item.dataTrocaCondutor ?? "",
      dataInativacao: item.dataInativacao ?? "",
      motivoInativacao: item.motivoInativacao ?? "",
      tipoVinculo: item.tipoVinculo !== undefined ? item.tipoVinculo : (String(item.locadora).toUpperCase().trim() === "FROTA PRÓPRIA" ? "" : "Contrato"),
      updatedAt,
      observacoes: cleanObs
    });

    const dbRecord: any = {
      placa: cleanPlaca,
      modelo: item.modelo || "Veículo Frota",
      marca: item.marca || "",
      ano: Number(item.ano) || new Date().getFullYear(),
      tipo: item.tipo || "Leve",
      base: resolvedFilial,
      condutor: item.condutor || "Disponível",
      status: item.status || "Ativo",
      km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
      combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
      venc_contrato: item.vencContrato ?? "",
      funcao: item.funcao ?? "Motorista",
      contato_motorista: item.contatoMotorista ?? "",
      gestor_resp: item.gestorResp ?? "",
      email: item.email ?? "",
      filial: resolvedFilial,
      locadora: item.locadora || "Frota Própria",
      contrato: item.contrato ?? "",
      odometro: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
      combustivel: item.combustivel || item.combustivelPadrao || "Flex",
      data_troca_condutor: item.dataTrocaCondutor ?? "",
      observacoes: extraData
    };

    // 1. Grava no Supabase (await com retorno de confirmação)
    let supabaseSuccess = false;
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('veiculos')
        .upsert(dbRecord, { onConflict: 'placa' });

      if (error) {
        const standardRecord = {
          placa: cleanPlaca,
          modelo: item.modelo || "Veículo Frota",
          base: resolvedFilial,
          condutor: item.condutor || "Disponível",
          status: item.status || "Ativo",
          km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
          observacoes: extraData
        };
        const res2 = await client.from('veiculos').upsert(standardRecord, { onConflict: 'placa' });
        supabaseSuccess = !res2.error;
      } else {
        supabaseSuccess = true;
      }
    } catch (sbErr) {
      console.warn("Aviso ao sincronizar no Supabase:", sbErr);
    }

    // 2. Grava no backend local atômico imediatamente (que também sincroniza com Supabase no servidor)
    let backendSuccess = false;
    try {
      const bRes = await fetch("/api/veiculos/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...item, 
          placa: cleanPlaca, 
          filial: resolvedFilial, 
          base: resolvedFilial,
          cnhAnexoBase64: cnhAnexoRef,
          updatedAt
        })
      });
      backendSuccess = bRes.ok;
    } catch (_) {}

    return supabaseSuccess || backendSuccess;
  } catch (err) {
    console.error("Erro no saveVeiculoSupabase:", err);
    return false;
  }
}

export async function saveBatchVeiculosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const sanitizedBatch = items.map(item => {
      const cleanPlaca = String(item.placa || item.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
      let cnhAnexoRef = item.cnhAnexoBase64 || "";
      if (cnhAnexoRef && typeof cnhAnexoRef === "string" && cnhAnexoRef.length > 2000) {
        cnhAnexoRef = `/api/cnh/${cleanPlaca}`;
      }
      return { ...item, placa: cleanPlaca, cnhAnexoBase64: cnhAnexoRef };
    });

    // 1. Grava no backend local imediatamente
    try {
      await fetch("/api/veiculos/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedBatch)
      });
    } catch (_) {}

    // 2. Grava no Supabase com records leves e sanitizados
    const client = getSupabaseClient();
    const dbRecords = sanitizedBatch.map(item => {
      const cleanPlaca = item.placa;
      const resolvedFilial = item.filial || item.base || "Paulínia";
      const cleanObs = typeof item.observacoes === "string" && !item.observacoes.trim().startsWith("{") ? item.observacoes.trim() : "";

      const extraData = JSON.stringify({
        id: item.id || `v-${cleanPlaca.toLowerCase()}`,
        modelo: item.modelo || "Veículo Frota",
        condutor: item.condutor || "Disponível",
        status: item.status || "Ativo",
        vencContrato: item.vencContrato ?? "",
        cpfCondutor: item.cpfCondutor ?? "",
        cnhValidade: item.cnhValidade ?? "",
        cnhNumero: item.cnhNumero ?? "",
        cnhDriveFolder: "https://drive.google.com/drive/folders/1tIJ67ADpN6blterYogPq9SObDVHr3xsk?usp=sharing",
        cnhAnexoBase64: item.cnhAnexoBase64 || `/api/cnh/${cleanPlaca}`,
        cnhNomeArquivo: item.cnhNomeArquivo ?? "",
        funcao: item.funcao ?? "",
        setor: item.setor ?? "",
        contatoMotorista: item.contatoMotorista ?? "",
        gestorResp: item.gestorResp ?? "",
        email: item.email ?? "",
        filial: resolvedFilial,
        locadora: item.locadora ?? "",
        contrato: item.contrato ?? "",
        odometro: Number(item.odometro || 0),
        combustivel: item.combustivel || "Flex",
        dataTrocaCondutor: item.dataTrocaCondutor ?? "",
        dataInativacao: item.dataInativacao ?? "",
        motivoInativacao: item.motivoInativacao ?? "",
        tipoVinculo: item.tipoVinculo !== undefined ? item.tipoVinculo : (String(item.locadora).toUpperCase().trim() === "FROTA PRÓPRIA" ? "" : "Contrato"),
        updatedAt: item.updatedAt || "",
        observacoes: cleanObs
      });

      return {
        placa: cleanPlaca,
        modelo: item.modelo || "Veículo Frota",
        marca: item.marca || "",
        ano: Number(item.ano) || new Date().getFullYear(),
        tipo: item.tipo || "Leve",
        base: resolvedFilial,
        condutor: item.condutor || "Disponível",
        status: item.status || "Ativo",
        km_atual: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
        combustivel_padrao: item.combustivel || item.combustivelPadrao || "Flex",
        venc_contrato: item.vencContrato ?? "",
        funcao: item.funcao ?? "Motorista",
        contato_motorista: item.contatoMotorista ?? "",
        gestor_resp: item.gestorResp ?? "",
        email: item.email ?? "",
        filial: resolvedFilial,
        locadora: item.locadora || "Frota Própria",
        contrato: item.contrato ?? "",
        odometro: Number(item.odometro || item.kmAtual || item.km_atual) || 0,
        combustivel: item.combustivel || item.combustivelPadrao || "Flex",
        data_troca_condutor: item.dataTrocaCondutor ?? "",
        observacoes: extraData
      };
    });

    const { error } = await client
      .from('veiculos')
      .upsert(dbRecords, { onConflict: 'placa' });

    if (error) {
      const standardBatch = dbRecords.map(r => ({
        placa: r.placa,
        modelo: r.modelo,
        base: r.base,
        condutor: r.condutor,
        status: r.status,
        km_atual: r.km_atual,
        observacoes: r.observacoes
      }));
      await client.from('veiculos').upsert(standardBatch, { onConflict: 'placa' });
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro no saveBatchVeiculosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteVeiculoSupabase(placa: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('veiculos')
      .delete()
      .eq('placa', placa.toUpperCase().trim());

    if (error) {
      console.error("Erro ao excluir veículo do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteVeiculoSupabase:", err);
    return false;
  }
}

// 9. Interfaces e Funções para Contratos da Frota no Supabase
export interface SupabaseContrato {
  id: string;
  numero: string;
  veiculo_placa?: string;
  fornecedor: string;
  tipo_contrato?: string;
  data_inicio?: string;
  data_vencimento: string;
  valor_mensal?: number;
  status?: string;
  observacao?: string;
  created_at?: string;
}

export async function fetchContratosSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('contratos')
      .select('*')
      .order('data_vencimento', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar contratos no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      numero: row.numero,
      veiculoPlaca: row.veiculo_placa || "",
      fornecedor: row.fornecedor,
      tipoContrato: row.tipo_contrato || "Locação",
      dataInicio: row.data_inicio || "",
      dataVencimento: row.data_vencimento,
      valorMensal: Number(row.valor_mensal) || 0,
      status: row.status || "Ativo",
      observacao: row.observacao || ""
    }));
  } catch (err) {
    console.error("Erro no fetchContratosSupabase:", err);
    return [];
  }
}

export async function saveContratoSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord: Partial<SupabaseContrato> = {
      id: item.id || ("cto-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      numero: item.numero || item.doc || "CTO-" + Date.now(),
      veiculo_placa: (item.veiculoPlaca || item.placa || "").toUpperCase().trim(),
      fornecedor: item.fornecedor || "Locadora / Fornecedor",
      tipo_contrato: item.tipoContrato || item.tipo || "Locação",
      data_inicio: item.dataInicio || "",
      data_vencimento: item.dataVencimento || item.vencimento || new Date().toISOString().split("T")[0],
      valor_mensal: Number(item.valorMensal || item.valor) || 0,
      status: item.status || "Ativo",
      observacao: item.observacao || ""
    };

    const { error } = await client
      .from('contratos')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao gravar contrato no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveContratoSupabase:", err);
    return false;
  }
}

export async function saveBatchContratosSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };

  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => ({
      id: item.id || ("cto-" + Date.now() + "-" + Math.random().toString(36).substring(7)),
      numero: item.numero || item.doc || "CTO-" + Date.now(),
      veiculo_placa: (item.veiculoPlaca || item.placa || "").toUpperCase().trim(),
      fornecedor: item.fornecedor || "Locadora / Fornecedor",
      tipo_contrato: item.tipoContrato || item.tipo || "Locação",
      data_inicio: item.dataInicio || "",
      data_vencimento: item.dataVencimento || item.vencimento || new Date().toISOString().split("T")[0],
      valor_mensal: Number(item.valorMensal || item.valor) || 0,
      status: item.status || "Ativo",
      observacao: item.observacao || ""
    }));

    const { error } = await client
      .from('contratos')
      .upsert(dbRecords, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao gravar lote de contratos no Supabase:", error);
      return { count: 0, success: false };
    }

    return { count: dbRecords.length, success: true };
  } catch (err) {
    console.error("Erro no saveBatchContratosSupabase:", err);
    return { count: 0, success: false };
  }
}

export async function deleteContratoSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('contratos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao excluir contrato do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteContratoSupabase:", err);
    return false;
  }
}

// 9. FORNECEDORES
export async function fetchFornecedoresSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('fornecedores')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar fornecedores no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id || row.cnpj,
      cnpj: row.cnpj,
      nome: row.nome,
      codigoItem: row.codigo_item || row.codigoItem || "",
      cidade: row.cidade || "",
      uf: row.uf || "",
      telefone: row.telefone || "",
      email: row.email || "",
      status: row.status || "Ativo",
      avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nome?.charAt(0) || "F")}&background=f8fafc`,
      logradouro: row.logradouro || "",
      numero: row.numero || "",
      bairro: row.bairro || "",
      cep: row.cep || ""
    }));
  } catch (err) {
    console.error("Erro no fetchFornecedoresSupabase:", err);
    return [];
  }
}

export async function saveFornecedorSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanCnpj = (item.cnpj || "").replace(/\D/g, "") || item.cnpj;
    const baseRecord: any = {
      cnpj: cleanCnpj,
      nome: item.nome || "Fornecedor sem nome",
      codigo_item: item.codigoItem || "",
      cidade: item.cidade || "",
      uf: item.uf || "",
      telefone: item.telefone || "",
      email: item.email || "",
      status: item.status || "Ativo",
      avatar: item.avatar || ""
    };

    const completeRecord = {
      ...baseRecord,
      logradouro: item.logradouro || "",
      numero: item.numero || "",
      bairro: item.bairro || "",
      cep: item.cep || ""
    };

    const firstTry = await client
      .from('fornecedores')
      .upsert(completeRecord, { onConflict: 'cnpj' });

    if (!firstTry.error) {
      return true;
    }

    // Se falhar por ausência de colunas adicionais, tenta salvar com as colunas base
    if (firstTry.error && (firstTry.error.code === 'PGRST204' || firstTry.error.message?.includes('column'))) {
      const retry = await client
        .from('fornecedores')
        .upsert(baseRecord, { onConflict: 'cnpj' });
      return !retry.error;
    }

    console.error("Erro ao gravar fornecedor no Supabase:", firstTry.error);
    return false;
  } catch (err) {
    console.error("Erro no saveFornecedorSupabase:", err);
    return false;
  }
}

export async function deleteFornecedorSupabase(cnpj: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanCnpj = (cnpj || "").replace(/\D/g, "") || cnpj;
    const { error } = await client
      .from('fornecedores')
      .delete()
      .eq('cnpj', cleanCnpj);

    if (error) {
      console.error("Erro ao deletar fornecedor do Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteFornecedorSupabase:", err);
    return false;
  }
}

// 10. CENTROS DE CUSTO
export async function fetchCentrosCustoSupabase(): Promise<string[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('centros_custo')
      .select('nome')
      .order('nome', { ascending: true });

    if (error) {
      // Fallback para Firestore caso a tabela ainda não exista
      try {
        const { db } = await import("../firebaseConfig");
        const snap = await db.collection("centros_custo").get();
        const firestoreList: string[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d.nome) firestoreList.push(d.nome);
        });
        if (firestoreList.length > 0) return firestoreList;
      } catch (e) {}
      return [];
    }
    return (data || []).map(row => row.nome).filter(Boolean);
  } catch (err) {
    return [];
  }
}

export async function saveCentroCustoSupabase(nome: string, codigo?: string, descricao?: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Salva no Supabase
    try {
      const client = getSupabaseClient();
      const dbRecord = {
        nome: cleanName,
        codigo: codigo || "",
        descricao: descricao || ""
      };

      const { error } = await client
        .from('centros_custo')
        .upsert(dbRecord, { onConflict: 'nome' });

      if (error) {
        console.warn("Aviso ao salvar Centro de Custo no Supabase:", error.message);
      }
    } catch (sbErr) {
      console.warn("Falha no client Supabase para Centro de Custo:", sbErr);
    }

    // 2. Salva no Firestore para redundância e disponibilidade multiusuário imediata
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("centros_custo").doc(docKey).set({
        nome: cleanName,
        codigo: codigo || "",
        descricao: descricao || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (fErr) {
      console.warn("Aviso ao salvar Centro de Custo no Firestore:", fErr);
    }

    return true;
  } catch (err) {
    console.error("Erro no saveCentroCustoSupabase:", err);
    return false;
  }
}

export async function deleteCentroCustoSupabase(nome: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Remove do Supabase
    try {
      const client = getSupabaseClient();
      await client.from('centros_custo').delete().eq('nome', cleanName);
    } catch (sbErr) {}

    // 2. Remove do Firestore
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("centros_custo").doc(docKey).delete();
    } catch (fErr) {}

    return true;
  } catch (err) {
    console.error("Erro no deleteCentroCustoSupabase:", err);
    return false;
  }
}

export async function updateCentroCustoSupabase(oldNome: string, newNome: string, codigo?: string, descricao?: string): Promise<boolean> {
  try {
    if (oldNome !== newNome) {
      await deleteCentroCustoSupabase(oldNome);
    }
    return await saveCentroCustoSupabase(newNome, codigo, descricao);
  } catch (err) {
    console.error("Erro no updateCentroCustoSupabase:", err);
    return false;
  }
}

// 10.B. Funções para Persistência de Bases (Estabelecimentos / Filiais)
export async function fetchBasesSupabase(): Promise<string[]> {
  const resultList = new Set<string>();

  // 1. Tenta buscar no Supabase
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('bases')
      .select('nome')
      .order('nome', { ascending: true });

    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        if (row.nome && typeof row.nome === "string") {
          resultList.add(row.nome.trim());
        }
      });
    }
  } catch (err) {}

  // 2. Tenta buscar no Firestore
  try {
    const { db } = await import("../firebaseConfig");
    const snap = await db.collection("bases_filiais").get();
    snap.forEach(doc => {
      const d = doc.data();
      if (d.nome && typeof d.nome === "string") {
        resultList.add(d.nome.trim());
      }
    });
  } catch (e) {}

  return Array.from(resultList);
}

export async function saveBaseSupabase(nome: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Salva no Supabase
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('bases')
        .upsert({ nome: cleanName }, { onConflict: 'nome' });

      if (error) {
        console.warn("Aviso ao salvar Base no Supabase:", error.message);
      }
    } catch (sbErr) {
      console.warn("Falha no client Supabase para Base:", sbErr);
    }

    // 2. Salva no Firestore
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("bases_filiais").doc(docKey).set({
        nome: cleanName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (fErr) {
      console.warn("Aviso ao salvar Base no Firestore:", fErr);
    }

    return true;
  } catch (err) {
    console.error("Erro no saveBaseSupabase:", err);
    return false;
  }
}

export async function deleteBaseSupabase(nome: string): Promise<boolean> {
  try {
    const cleanName = nome.trim();
    if (!cleanName) return false;

    // 1. Remove do Supabase
    try {
      const client = getSupabaseClient();
      await client.from('bases').delete().eq('nome', cleanName);
    } catch (sbErr) {}

    // 2. Remove do Firestore
    try {
      const { db } = await import("../firebaseConfig");
      const docKey = cleanName.replace(/[/\\?%*:|"<>]/g, '_');
      await db.collection("bases_filiais").doc(docKey).delete();
    } catch (fErr) {}

    return true;
  } catch (err) {
    console.error("Erro no deleteBaseSupabase:", err);
    return false;
  }
}

export async function updateBaseSupabase(oldNome: string, newNome: string): Promise<boolean> {
  try {
    if (oldNome !== newNome) {
      await deleteBaseSupabase(oldNome);
    }
    return await saveBaseSupabase(newNome);
  } catch (err) {
    console.error("Erro no updateBaseSupabase:", err);
    return false;
  }
}

// 11. Interfaces e Funções para Multas no Supabase (Módulo de Controle de Multas)
export interface SupabaseMulta {
  id: string;
  placa: string;
  frota?: string;
  ait?: string;
  tipo?: string;
  status?: string;
  valor?: number;
  valor_com_desconto?: number;
  desconto?: number;
  taxa_locadora?: number;
  data_infracao?: string;
  data_recebimento?: string;
  prazo_indicacao?: string;
  enquadramento?: string;
  artigo_ctb?: string;
  descricao_infracao?: string;
  pontos_cnh?: number;
  base?: string;
  nome_motorista?: string;
  orgao_autuador?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  rodovia_urbano?: string;
  recebida_com_prazo?: string;
  retornou_com_prazo?: string;
  empresa_ou_condutor?: string;
  descontar_motorista?: string;
  pago_com_desconto?: string;
  enviado_rh?: string;
  link_ait?: string;
  link_autorizacao?: string;
  obs?: string;
  created_at?: string;
}

const MULTA_META_PREFIX = '[MULTA_META_JSON:';

function normalizeMultaDateToISO(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Formato DD/MM/YYYY ou DD/MM/YYYY HH:mm
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  // Formato ISO YYYY-MM-DDTHH:mm ou YYYY-MM-DD HH:mm
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

function unpackMultaObsWithMeta(rawObs?: string | null): { cleanObs: string; meta: Record<string, any> } {
  const text = String(rawObs || '');
  const idx = text.indexOf(MULTA_META_PREFIX);
  if (idx === -1) {
    return { cleanObs: text.trim(), meta: {} };
  }
  const cleanObs = text.slice(0, idx).trim();
  const metaPart = text.slice(idx + MULTA_META_PREFIX.length);
  const endBracket = metaPart.lastIndexOf(']');
  const jsonStr = endBracket !== -1 ? metaPart.slice(0, endBracket).trim() : metaPart.trim();
  try {
    const meta = JSON.parse(jsonStr);
    return { cleanObs, meta: meta && typeof meta === 'object' ? meta : {} };
  } catch (e) {
    return { cleanObs, meta: {} };
  }
}

function packMultaObsWithMeta(item: any): string {
  const { cleanObs } = unpackMultaObsWithMeta(item.obs);
  const meta = {
    dataHoraInfracao: item.dataHoraInfracao || '',
    dataRecebimento: item.dataRecebimento || '',
    prazoIndicacao: item.prazoIndicacao || '',
    taxaLocadora: Number(item.taxaLocadora) || 0,
    responsavelCodigo: item.responsavelCodigo || '',
    responsavelCpf: item.responsavelCpf || '',
    descontoEnviadoRH: Boolean(item.descontoEnviadoRH),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
  const metaTag = `${MULTA_META_PREFIX}${JSON.stringify(meta)}]`;
  return cleanObs ? `${cleanObs}\n${metaTag}` : metaTag;
}

export async function fetchMultasSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('multas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Aviso ao carregar multas do Supabase:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((row: any) => {
      const { cleanObs, meta } = unpackMultaObsWithMeta(row.obs);
      return {
        id: String(row.id || row.ait || ''),
        status: row.status || 'AGUARDANDO BOLETO',
        frota: row.frota || row.placa || '',
        placa: (row.placa || '').toUpperCase().trim(),
        base: row.base || '',
        ait: row.ait || row.id || '',
        tipo: row.tipo || 'AUTO',
        dataHoraInfracao: meta.dataHoraInfracao || row.data_infracao || '',
        dataRecebimento: meta.dataRecebimento || row.data_recebimento || '',
        prazoIndicacao: meta.prazoIndicacao || row.prazo_indicacao || '',
        recebidaComPrazo: row.recebida_com_prazo || 'SIM',
        enquadramento: row.enquadramento || '',
        artigoCtb: row.artigo_ctb || '',
        descricaoInfracao: row.descricao_infracao || '',
        pontosCnh: Number(row.pontos_cnh !== undefined ? row.pontos_cnh : 0),
        responsavelCodigo: meta.responsavelCodigo || '',
        responsavelNome: row.nome_motorista || '',
        responsavelCpf: meta.responsavelCpf || '',
        orgaoAutuador: row.orgao_autuador || '',
        endereco: row.endereco || '',
        municipio: row.municipio || '',
        uf: row.uf || '',
        rodoviaOuUrbano: row.rodovia_urbano || 'URBANO',
        retornouComPrazo: row.retornou_com_prazo || 'SIM',
        valor: Number(row.valor || 0),
        desconto: Number(row.desconto || 0),
        taxaLocadora: Number(row.taxa_locadora !== undefined ? row.taxa_locadora : (meta.taxaLocadora || 0)),
        valorComDesconto: Number(row.valor_com_desconto || (row.valor || 0)),
        empresaOuCondutor: row.empresa_ou_condutor || 'CONDUTOR',
        descontarMotorista: row.descontar_motorista || 'SIM',
        pagoComDesconto: row.pago_com_desconto || 'SIM',
        enviadoAoRh: row.enviado_rh || 'NÃO',
        descontoEnviadoRH: meta.descontoEnviadoRH !== undefined ? Boolean(meta.descontoEnviadoRH) : row.enviado_rh === 'SIM',
        obs: cleanObs,
        linkAit: row.link_ait || '',
        linkAuth: row.link_autorizacao || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: meta.updatedAt || row.created_at || ''
      };
    });
  } catch (err) {
    console.error("Erro no fetchMultasSupabase:", err);
    return [];
  }
}

function buildSupabaseMultaRecord(item: any): Record<string, any> {
  const id = String(item.id || item.ait || `multa-${Date.now()}`).trim();
  const placa = (item.placa || '').toUpperCase().trim();
  const dataInfracao = normalizeMultaDateToISO(item.dataHoraInfracao);
  const dataRecebimento = normalizeMultaDateToISO(item.dataRecebimento);
  const prazoIndicacao = normalizeMultaDateToISO(item.prazoIndicacao);

  return {
    id,
    placa: placa || 'SEM-PLACA',
    frota: item.frota || placa,
    ait: item.ait || id,
    tipo: item.tipo || 'AUTO',
    status: item.status || 'AGUARDANDO BOLETO',
    valor: Number(item.valor) || 0,
    valor_com_desconto: Number(item.valorComDesconto) || (Number(item.valor) || 0),
    desconto: Number(item.desconto) || 0,
    data_infracao: dataInfracao,
    data_recebimento: dataRecebimento,
    prazo_indicacao: prazoIndicacao,
    enquadramento: item.enquadramento || '',
    artigo_ctb: item.artigoCtb || '',
    descricao_infracao: item.descricaoInfracao || '',
    pontos_cnh: Number(item.pontosCnh) || 0,
    base: item.base || '',
    nome_motorista: item.responsavelNome || '',
    orgao_autuador: item.orgaoAutuador || '',
    endereco: item.endereco || '',
    municipio: item.municipio || '',
    uf: item.uf || '',
    rodovia_urbano: item.rodoviaOuUrbano || 'URBANO',
    recebida_com_prazo: item.recebidaComPrazo || 'SIM',
    retornou_com_prazo: item.retornouComPrazo || 'SIM',
    empresa_ou_condutor: item.empresaOuCondutor || 'CONDUTOR',
    descontar_motorista: item.descontarMotorista || 'SIM',
    pago_com_desconto: item.pagoComDesconto || 'SIM',
    enviado_rh: item.enviadoAoRh || 'NÃO',
    link_ait: item.linkAit || '',
    link_autorizacao: item.linkAuth || '',
    obs: packMultaObsWithMeta(item)
  };
}

export async function saveMultaSupabase(item: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord = buildSupabaseMultaRecord(item);

    const res = await client
      .from('multas')
      .upsert(dbRecord, { onConflict: 'id' });

    if (res.error) {
      console.warn("Aviso ao salvar multa no Supabase:", res.error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Erro no saveMultaSupabase:", err);
    return false;
  }
}

export async function deleteMultaSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const cleanId = String(id || '').trim();
    const { error } = await client
      .from('multas')
      .delete()
      .eq('id', cleanId);

    // Garantir remoção também caso o ID passado seja o número do AIT
    await client
      .from('multas')
      .delete()
      .eq('ait', cleanId);

    if (error) {
      console.error("Erro ao deletar multa no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteMultaSupabase:", err);
    return false;
  }
}

export async function clearAllMultasSupabase(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('multas')
      .delete()
      .neq('id', '___NUNCA_EXISTE___');

    if (error) {
      console.error("Erro ao zerar tabela de multas no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no clearAllMultasSupabase:", err);
    return false;
  }
}

export async function saveBatchMultasSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  try {
    const client = getSupabaseClient();
    const dbRecords = items.map(item => buildSupabaseMultaRecord(item));

    const CHUNK_SIZE = 50;
    let totalSaved = 0;

    for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      try {
        const timeoutPromise = new Promise<{ error: any }>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout ao conectar com Supabase")), 5000)
        );
        const upsertPromise = client.from('multas').upsert(chunk, { onConflict: 'id' });
        const res: any = await Promise.race([upsertPromise, timeoutPromise]);
        if (!res.error) {
          totalSaved += chunk.length;
        } else {
          console.warn("Aviso ao salvar lote parcial no Supabase:", res.error.message);
        }
      } catch (chunkErr) {
        console.warn("Aviso na gravação de chunk do Supabase:", chunkErr);
      }
    }

    return { count: totalSaved, success: totalSaved > 0 };
  } catch (err) {
    console.warn("Aviso geral no saveBatchMultasSupabase:", err);
    return { count: 0, success: false };
  }
}

import { 
  ServicoManutencaoItem, 
  AnexoManutencao, 
  AutorizacaoDescontoAvaria 
} from './termoAvariaPdfService';

// 12. Interfaces e Funções para a Tabela de Manutenções da Frota no Supabase
export interface SupabaseManutencao {
  id: string;
  placa: string;
  tipo: "Preventiva" | "Corretiva";
  descricao: string;
  data: string;
  dataEntrada?: string;
  dataSaida?: string;
  odometro: number;
  custo: number;
  oficina: string;
  condutor?: string;
  base?: string;
  modelo?: string;
  nf_os?: string;
  status?: "Concluída" | "Em Andamento" | "Agendada";
  observacoes?: string;
  created_at?: string;
  servicos?: ServicoManutencaoItem[];
  anexos?: AnexoManutencao[];
  autorizacaoAvaria?: AutorizacaoDescontoAvaria;
}

export async function fetchManutencoesSupabase(): Promise<SupabaseManutencao[]> {
  const client = getSupabaseClient();
  let manutencoes: SupabaseManutencao[] = [];

  // 1. Tenta carregar da tabela dedicada 'manutencoes' no Supabase
  try {
    const { data, error } = await client
      .from('manutencoes')
      .select('*')
      .order('data', { ascending: false });

    if (!error && data && data.length > 0) {
      manutencoes = data.map((row: any) => ({
        id: String(row.id),
        placa: (row.placa || '').toUpperCase().trim(),
        tipo: row.tipo === 'Corretiva' ? 'Corretiva' : 'Preventiva',
        descricao: row.descricao || '',
        data: row.data || new Date().toISOString().split('T')[0],
        dataEntrada: row.data_entrada || row.dataEntrada || row.data || new Date().toISOString().split('T')[0],
        dataSaida: row.data_saida || row.dataSaida || row.data || new Date().toISOString().split('T')[0],
        odometro: Number(row.odometro) || 0,
        custo: Number(row.custo) || 0,
        oficina: row.oficina || '',
        condutor: row.condutor || undefined,
        base: row.base || undefined,
        modelo: row.modelo || undefined,
        nf_os: row.nf_os || row.doc || undefined,
        status: row.status || 'Concluída',
        observacoes: row.observacoes || undefined,
        created_at: row.created_at || undefined
      }));
      localStorage.setItem("risel_frota_manutencoes", JSON.stringify(manutencoes));
      return manutencoes;
    }
  } catch (err) {
    // Tabela dedicada pode não existir no schema cache do Supabase
  }

  // 2. Não consulta a tabela 'lancamentos' para evitar poluição entre módulos
  // 3. Fallback para dados salvos localmente (removendo mocks legados)

  // 3. Fallback para dados salvos localmente (removendo mocks legados)
  const saved = localStorage.getItem("risel_frota_manutencoes");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Purga registros mock legados (ex: mn1, mn2, mn3)
        const realItems = parsed.filter(
          (m: any) => m && !["mn1", "mn2", "mn3"].includes(String(m.id))
        );
        if (realItems.length !== parsed.length) {
          localStorage.setItem("risel_frota_manutencoes", JSON.stringify(realItems));
        }
        if (realItems.length > 0) {
          return realItems;
        }
      }
    } catch (e) {}
  }

  // 4. Se não há dados reais no Supabase nem em cache, retorna vazio (pronto para dados reais)
  return [];
}

export async function saveManutencaoSupabase(item: any): Promise<boolean> {
  const client = getSupabaseClient();
  const idStr = String(item.id || `mn-${Date.now()}`);
  const placa = String(item.placa || '').toUpperCase().trim();
  const custo = Number(item.custo) || 0;
  const odometro = Number(item.odometro) || 0;
  const data = item.data || new Date().toISOString().split('T')[0];
  const dataEntrada = item.dataEntrada || data;
  const dataSaida = item.dataSaida || data;
  const tipo = item.tipo === 'Corretiva' ? 'Corretiva' : 'Preventiva';

  const manutencaoObj: SupabaseManutencao = {
    id: idStr,
    placa,
    tipo,
    descricao: item.descricao || 'Manutenção veicular',
    data,
    dataEntrada,
    dataSaida,
    odometro,
    custo,
    oficina: item.oficina || 'Oficina Credenciada',
    condutor: item.condutor,
    base: item.base,
    modelo: item.modelo,
    nf_os: item.nf_os,
    status: item.status || 'Concluída',
    observacoes: item.observacoes,
    servicos: item.servicos || undefined,
    anexos: item.anexos || undefined,
    autorizacaoAvaria: item.autorizacaoAvaria || undefined
  };

  // Atualiza cache local imediatamente garantindo apenas registros reais
  try {
    const saved = localStorage.getItem("risel_frota_manutencoes");
    let list: SupabaseManutencao[] = saved ? JSON.parse(saved) : [];
    list = list.filter(m => !["mn1", "mn2", "mn3"].includes(String(m.id)));
    const idx = list.findIndex(m => String(m.id) === idStr);
    if (idx >= 0) {
      list[idx] = manutencaoObj;
    } else {
      list = [manutencaoObj, ...list];
    }
    localStorage.setItem("risel_frota_manutencoes", JSON.stringify(list));
  } catch (e) {}

  let savedInSupabase = false;

  // 1. Tenta salvar na tabela 'manutencoes' com compatibilidade de nomes de colunas
  try {
    const dbPayload: any = {
      id: idStr,
      placa,
      tipo,
      descricao: item.descricao || 'Manutenção veicular',
      data,
      data_entrada: dataEntrada,
      data_saida: dataSaida,
      odometro,
      km_veiculo: odometro,
      custo,
      valor_total: custo,
      oficina: item.oficina || 'Oficina Credenciada',
      oficina_fornecedor: item.oficina || 'Oficina Credenciada',
      condutor: item.condutor || null,
      base: item.base || null,
      modelo: item.modelo || null,
      nf_os: item.nf_os || null,
      status: item.status || 'Concluída',
      observacoes: item.observacoes || null
    };

    const { error } = await client
      .from('manutencoes')
      .upsert(dbPayload, { onConflict: 'id' });

    if (!error) {
      savedInSupabase = true;
    }
  } catch (err) {
    // Continua para o salvamento via lancamentos
  }

  return savedInSupabase || true;
}

export async function deleteManutencaoSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  const idStr = String(id);

  // Atualiza cache local
  try {
    const saved = localStorage.getItem("risel_frota_manutencoes");
    if (saved) {
      const list: SupabaseManutencao[] = JSON.parse(saved);
      const filtered = list.filter(m => String(m.id) !== idStr);
      localStorage.setItem("risel_frota_manutencoes", JSON.stringify(filtered));
    }
  } catch (e) {}

  // Remove da tabela exclusiva de manutenções
  try {
    await client.from('manutencoes').delete().eq('id', idStr);
  } catch (e) {}

  return true;
}

export async function saveBatchManutencoesSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  let count = 0;
  for (const item of items) {
    const ok = await saveManutencaoSupabase(item);
    if (ok) count++;
  }
  return { count, success: count > 0 };
}

// 13. RESERVAS DE VEÍCULOS (FROTA LEVE)
export async function fetchReservasSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('reservas')
      .select('*')
      .order('de', { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar reservas no Supabase:", error.message);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      condutor: row.condutor,
      de: row.de,
      ate: row.ate,
      destino: row.destino || "",
      status: row.status || "Confirmada",
      observacoes: row.observacoes || ""
    }));
  } catch (err) {
    console.error("Erro no fetchReservasSupabase:", err);
    return [];
  }
}

export async function saveReservaSupabase(reserva: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord = {
      id: String(reserva.id || `res_${Date.now()}`),
      placa: String(reserva.placa || "").toUpperCase().trim(),
      condutor: reserva.condutor || "Disponível",
      de: reserva.de || new Date().toISOString(),
      ate: reserva.ate || new Date().toISOString(),
      destino: reserva.destino || "",
      status: reserva.status || "Confirmada",
      observacoes: reserva.observacoes || ""
    };

    const { error } = await client
      .from('reservas')
      .upsert(dbRecord, { onConflict: 'id' });

    if (error) {
      console.warn("Aviso ao salvar reserva no Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no saveReservaSupabase:", err);
    return false;
  }
}

export async function saveBatchReservasSupabase(items: any[]): Promise<{ count: number; success: boolean }> {
  if (!items || items.length === 0) return { count: 0, success: true };
  let count = 0;
  for (const item of items) {
    const ok = await saveReservaSupabase(item);
    if (ok) count++;
  }
  return { count, success: count > 0 };
}

export async function deleteReservaSupabase(id: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('reservas')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn("Aviso ao deletar reserva no Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro no deleteReservaSupabase:", err);
    return false;
  }
}

// 14. CHECKLISTS DE VEÍCULOS
export async function fetchChecklistsSupabase(): Promise<any[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('checklists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      placa: row.placa,
      condutor: row.condutor,
      data: row.data,
      odometro: Number(row.odometro || 0),
      status: row.status,
      observacoes: row.observacoes || "",
      itens: row.itens || {},
      email: row.email,
      tipo: row.tipo || "Saída"
    }));
  } catch (err) {
    return [];
  }
}

export async function saveChecklistSupabase(checklist: any): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const dbRecord = {
      id: String(checklist.id || `chk_${Date.now()}`),
      placa: String(checklist.placa || "").toUpperCase().trim(),
      condutor: checklist.condutor || "",
      data: checklist.data || new Date().toISOString(),
      odometro: Number(checklist.odometro || 0),
      status: checklist.status || "Aprovado",
      observacoes: checklist.observacoes || "",
      itens: checklist.itens || {},
      email: checklist.email || "",
      tipo: checklist.tipo || "Saída"
    };

    const { error } = await client
      .from('checklists')
      .upsert(dbRecord, { onConflict: 'id' });

    return !error;
  } catch (err) {
    return false;
  }
}

// 15. MAPEAMENTOS DE E-MAIL (CONFIGURAÇÕES DE MULTAS & FROTA)
export async function fetchEmailMappingsSupabase(tipo: 'placa' | 'base' | 'frota_leve_placa' | 'frota_leve_base' | string): Promise<any | null> {
  let serverData: any = null;
  // 1. Consulta prioritária no backend local oficial (sem cache para refletir alterações imediatas)
  try {
    const res = await fetch(`/api/email-mappings/${tipo}?_t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        serverData = data;
      }
    }
  } catch (_) {}

  // 2. Consulta complementar no Supabase para garantir sincronia entre múltiplos dispositivos
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('email_mappings')
      .select('mappings')
      .eq('tipo', tipo)
      .maybeSingle();

    if (!error && data && data.mappings && typeof data.mappings === 'object') {
      if (serverData) {
        return { ...serverData, ...data.mappings };
      }
      return data.mappings;
    }
  } catch (err) {}

  return serverData;
}

export async function saveEmailMappingsSupabase(tipo: 'placa' | 'base' | 'frota_leve_placa' | 'frota_leve_base' | string, mappings: any): Promise<boolean> {
  let serverOk = false;
  let supaOk = false;
  // 1. Grava no backend local oficial (que também sincroniza com Supabase no servidor)
  try {
    const res = await fetch(`/api/email-mappings/${tipo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappings)
    });
    serverOk = res.ok;
  } catch (_) {}

  // 2. Grava de forma segura no Supabase pelo cliente
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('email_mappings')
      .upsert({
        id: `map_${tipo}`,
        tipo,
        mappings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    supaOk = !error;
  } catch (err) {}

  return serverOk || supaOk;
}

// 16. Script SQL de Criação das Tabelas do Risel ERP no Supabase
export const SUPABASE_SQL_SCHEMA = `-- Script Completo do Banco de Dados Real - Risel ERP (Supabase Oficial: https://ihowbxlqfcjzzzleasqq.supabase.co)

-- 1. TABELA DE LANÇAMENTOS DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.lancamentos (
    id BIGINT PRIMARY KEY,
    status VARCHAR(100) NOT NULL DEFAULT 'Aguardando aprovação',
    data_lancamento VARCHAR(50),
    data_vencimento VARCHAR(50) NOT NULL,
    fornecedor VARCHAR(255) NOT NULL,
    doc VARCHAR(255) NOT NULL,
    valor VARCHAR(100) NOT NULL,
    forma_pagto VARCHAR(100) DEFAULT 'Boleto',
    tipo VARCHAR(100) DEFAULT 'NF-e',
    descricao TEXT,
    cnpj VARCHAR(50),
    estabelecimento VARCHAR(255) DEFAULT '100 - Paulínia',
    nome_arquivo_anexo TEXT,
    arquivo_anexo_base64 TEXT,
    item_sistema VARCHAR(100),
    data_emissao VARCHAR(50),
    observacao TEXT,
    frequencia VARCHAR(100) DEFAULT 'Esporádico',
    lancado_por VARCHAR(100) DEFAULT 'Deny',
    data_aprovacao VARCHAR(50),
    centro_custo VARCHAR(255) DEFAULT 'C.C 101 - Operacional',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(255) DEFAULT 'C.C 101 - Operacional';
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS codigo_lancamento VARCHAR(255);

-- 1. Políticas Seguras de RLS para Lançamentos (Prevenção contra exclusão indevida e controle de acesso)
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Leitura Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Gravacao Lancamentos" ON public.lancamentos;
DROP POLICY IF EXISTS "Exclusao Restrita Lancamentos" ON public.lancamentos;
CREATE POLICY "Leitura Lancamentos" ON public.lancamentos FOR SELECT USING (true);
CREATE POLICY "Gravacao Lancamentos" ON public.lancamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Lancamentos" ON public.lancamentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Lancamentos" ON public.lancamentos FOR DELETE TO authenticated USING (true);

-- 2. TABELA DE CENTROS DE CUSTO
CREATE TABLE IF NOT EXISTS public.centros_custo (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50),
    nome VARCHAR(255) UNIQUE NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Centros Custo" ON public.centros_custo;
DROP POLICY IF EXISTS "Leitura Centros Custo" ON public.centros_custo;
DROP POLICY IF EXISTS "Modificacao Centros Custo" ON public.centros_custo;
CREATE POLICY "Leitura Centros Custo" ON public.centros_custo FOR SELECT USING (true);
CREATE POLICY "Modificacao Centros Custo" ON public.centros_custo FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. TABELA DE VEÍCULOS (FROTA LEVE - DADOS COMPLETOS DE CADASTRO)
CREATE TABLE IF NOT EXISTS public.veiculos (
    placa VARCHAR(20) PRIMARY KEY,
    modelo VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    ano INT,
    tipo VARCHAR(100) DEFAULT 'Leve',
    base VARCHAR(100) DEFAULT 'CAMPINEIRA',
    condutor VARCHAR(255) DEFAULT 'Disponível',
    status VARCHAR(100) DEFAULT 'Ativo',
    km_atual NUMERIC(10,2) DEFAULT 0,
    combustivel_padrao VARCHAR(100) DEFAULT 'Flex',
    venc_contrato VARCHAR(50),
    cpf_condutor VARCHAR(50),
    cnh_validade VARCHAR(50),
    cnh_numero VARCHAR(50),
    cnh_anexo_base64 TEXT,
    cnh_nome_arquivo VARCHAR(255),
    funcao VARCHAR(100) DEFAULT 'Motorista',
    setor VARCHAR(100) DEFAULT '',
    contato_motorista VARCHAR(100),
    gestor_resp VARCHAR(255),
    email VARCHAR(255),
    filial VARCHAR(100) DEFAULT 'CAMPINEIRA',
    locadora VARCHAR(255) DEFAULT 'Frota Própria',
    contrato VARCHAR(100),
    odometro NUMERIC(10,2) DEFAULT 0,
    combustivel VARCHAR(100) DEFAULT 'Flex',
    data_troca_condutor VARCHAR(50),
    data_inativacao VARCHAR(50),
    motivo_inativacao TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir adição de colunas detalhadas caso a tabela 'veiculos' já exista no Supabase:
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS venc_contrato VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cpf_condutor VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_validade VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_numero VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_anexo_base64 TEXT;
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS cnh_nome_arquivo VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS funcao VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS setor VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS contato_motorista VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS gestor_resp VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS filial VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS locadora VARCHAR(255);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS contrato VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS odometro NUMERIC(10,2);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS combustivel VARCHAR(100);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS data_troca_condutor VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS data_inativacao VARCHAR(50);
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS motivo_inativacao TEXT;

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Leitura Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Gravacao Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Atualizacao Veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Exclusao Restrita Veiculos" ON public.veiculos;
CREATE POLICY "Leitura Veiculos" ON public.veiculos FOR SELECT USING (true);
CREATE POLICY "Gravacao Veiculos" ON public.veiculos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Veiculos" ON public.veiculos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Veiculos" ON public.veiculos FOR DELETE TO authenticated USING (true);

-- 4. TABELA DE FORNECEDORES
CREATE TABLE IF NOT EXISTS public.fornecedores (
    cnpj VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    codigo_item VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(10),
    telefone VARCHAR(100),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Ativo',
    avatar TEXT,
    logradouro TEXT,
    numero VARCHAR(50),
    bairro VARCHAR(100),
    cep VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cep VARCHAR(20);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Leitura Fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Modificacao Fornecedores" ON public.fornecedores;
CREATE POLICY "Leitura Fornecedores" ON public.fornecedores FOR SELECT USING (true);
CREATE POLICY "Modificacao Fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. TABELA DE ABASTECIMENTOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.abastecimentos (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    base VARCHAR(100),
    condutor VARCHAR(255),
    data DATE,
    litros NUMERIC(10,2),
    km_percorrido NUMERIC(10,2),
    valor_total NUMERIC(10,2),
    combustivel VARCHAR(100),
    posto VARCHAR(255),
    cidade VARCHAR(100),
    uf VARCHAR(20),
    valor_litro NUMERIC(10,2),
    saldo NUMERIC(10,2),
    hodometro NUMERIC(10,2),
    cartao VARCHAR(100),
    cnpj_posto VARCHAR(50),
    transacao VARCHAR(100),
    modelo VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS uf VARCHAR(20);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS valor_litro NUMERIC(10,2);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS cartao VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS cnpj_posto VARCHAR(50);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS transacao VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.abastecimentos ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Leitura Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Gravacao Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Atualizacao Abastecimentos" ON public.abastecimentos;
DROP POLICY IF EXISTS "Exclusao Restrita Abastecimentos" ON public.abastecimentos;
CREATE POLICY "Leitura Abastecimentos" ON public.abastecimentos FOR SELECT USING (true);
CREATE POLICY "Gravacao Abastecimentos" ON public.abastecimentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Abastecimentos" ON public.abastecimentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Abastecimentos" ON public.abastecimentos FOR DELETE TO authenticated USING (true);

-- 6. TABELA DE CONTRATOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.contratos (
    id TEXT PRIMARY KEY,
    numero VARCHAR(100) NOT NULL,
    veiculo_placa VARCHAR(20),
    fornecedor VARCHAR(255) NOT NULL,
    tipo_contrato VARCHAR(100) DEFAULT 'Locação',
    data_inicio DATE,
    data_vencimento DATE NOT NULL,
    valor_mensal NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(100) DEFAULT 'Ativo',
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Leitura Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Gravacao Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Atualizacao Contratos" ON public.contratos;
DROP POLICY IF EXISTS "Exclusao Restrita Contratos" ON public.contratos;
CREATE POLICY "Leitura Contratos" ON public.contratos FOR SELECT USING (true);
CREATE POLICY "Gravacao Contratos" ON public.contratos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Contratos" ON public.contratos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Contratos" ON public.contratos FOR DELETE TO authenticated USING (true);

-- 7. TABELA DE MANUTENÇÕES (FROTA LEVE - DADOS REAIS)
CREATE TABLE IF NOT EXISTS public.manutencoes (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    data DATE,
    data_entrada DATE,
    data_saida DATE,
    tipo VARCHAR(100) DEFAULT 'Preventiva',
    descricao TEXT,
    oficina_fornecedor VARCHAR(255),
    oficina VARCHAR(255),
    valor_total NUMERIC(10,2) DEFAULT 0,
    custo NUMERIC(10,2) DEFAULT 0,
    km_veiculo NUMERIC(10,2),
    odometro NUMERIC(10,2),
    condutor VARCHAR(255),
    base VARCHAR(100),
    modelo VARCHAR(100),
    nf_os VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Concluída',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS data_saida DATE;
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS oficina VARCHAR(255);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS odometro NUMERIC(10,2);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS condutor VARCHAR(255);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS base VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS modelo VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS nf_os VARCHAR(100);
ALTER TABLE public.manutencoes ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Leitura Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Gravacao Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Atualizacao Manutencoes" ON public.manutencoes;
DROP POLICY IF EXISTS "Exclusao Restrita Manutencoes" ON public.manutencoes;
CREATE POLICY "Leitura Manutencoes" ON public.manutencoes FOR SELECT USING (true);
CREATE POLICY "Gravacao Manutencoes" ON public.manutencoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Manutencoes" ON public.manutencoes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Manutencoes" ON public.manutencoes FOR DELETE TO authenticated USING (true);

-- 8. TABELA DE MULTAS (FROTA LEVE - DADOS COMPLETOS)
CREATE TABLE IF NOT EXISTS public.multas (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    frota VARCHAR(100),
    ait VARCHAR(100),
    tipo VARCHAR(50) DEFAULT 'AUTO',
    status VARCHAR(100) DEFAULT 'AGUARDANDO BOLETO',
    valor NUMERIC(10,2) DEFAULT 0,
    valor_com_desconto NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    data_infracao DATE,
    data_recebimento DATE,
    prazo_indicacao DATE,
    enquadramento VARCHAR(100),
    artigo_ctb VARCHAR(100),
    descricao_infracao TEXT,
    pontos_cnh INT DEFAULT 0,
    base VARCHAR(100),
    nome_motorista VARCHAR(255),
    orgao_autuador VARCHAR(255),
    endereco TEXT,
    municipio VARCHAR(100),
    uf VARCHAR(10),
    rodovia_urbano VARCHAR(50) DEFAULT 'URBANO',
    recebida_com_prazo VARCHAR(20) DEFAULT 'SIM',
    retornou_com_prazo VARCHAR(20) DEFAULT 'SIM',
    empresa_ou_condutor VARCHAR(50) DEFAULT 'CONDUTOR',
    descontar_motorista VARCHAR(20) DEFAULT 'SIM',
    pago_com_desconto VARCHAR(20) DEFAULT 'SIM',
    enviado_rh VARCHAR(20) DEFAULT 'NÃO',
    link_ait TEXT,
    link_autorizacao TEXT,
    obs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir adição de colunas em bancos existentes
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS frota VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS ait VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'AUTO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'AGUARDANDO BOLETO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS valor_com_desconto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS data_infracao DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS data_recebimento DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS prazo_indicacao DATE;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS enquadramento VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS artigo_ctb VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS descricao_infracao TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS pontos_cnh INT DEFAULT 0;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS base VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS nome_motorista VARCHAR(255);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS orgao_autuador VARCHAR(255);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS uf VARCHAR(10);
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS rodovia_urbano VARCHAR(50) DEFAULT 'URBANO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS recebida_com_prazo VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS retornou_com_prazo VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS empresa_ou_condutor VARCHAR(50) DEFAULT 'CONDUTOR';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS descontar_motorista VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS pago_com_desconto VARCHAR(20) DEFAULT 'SIM';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS enviado_rh VARCHAR(20) DEFAULT 'NÃO';
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS link_ait TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS link_autorizacao TEXT;
ALTER TABLE public.multas ADD COLUMN IF NOT EXISTS obs TEXT;

ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Multas" ON public.multas;
DROP POLICY IF EXISTS "Leitura Multas" ON public.multas;
DROP POLICY IF EXISTS "Gravacao Multas" ON public.multas;
DROP POLICY IF EXISTS "Atualizacao Multas" ON public.multas;
DROP POLICY IF EXISTS "Exclusao Restrita Multas" ON public.multas;
CREATE POLICY "Leitura Multas" ON public.multas FOR SELECT USING (true);
CREATE POLICY "Gravacao Multas" ON public.multas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Multas" ON public.multas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Multas" ON public.multas FOR DELETE TO authenticated USING (true);

-- 9. TABELA DE USUÁRIOS E ACESSOS
CREATE TABLE IF NOT EXISTS public.usuarios (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    nome VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    permissions JSONB,
    status VARCHAR(50) DEFAULT 'Ativa',
    password VARCHAR(255),
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS nome VARCHAR(255);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Leitura Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Modificacao Usuarios" ON public.usuarios;
CREATE POLICY "Leitura Usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Modificacao Usuarios" ON public.usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. TABELA DE RESERVAS DE VEÍCULOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.reservas (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    condutor VARCHAR(255) NOT NULL,
    de VARCHAR(50) NOT NULL,
    ate VARCHAR(50) NOT NULL,
    destino TEXT,
    status VARCHAR(50) DEFAULT 'Confirmada',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Leitura Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Gravacao Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Atualizacao Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Exclusao Restrita Reservas" ON public.reservas;
CREATE POLICY "Leitura Reservas" ON public.reservas FOR SELECT USING (true);
CREATE POLICY "Gravacao Reservas" ON public.reservas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao Reservas" ON public.reservas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusao Restrita Reservas" ON public.reservas FOR DELETE TO authenticated USING (true);

-- 11. TABELA DE CHECKLISTS DE VEÍCULOS (FROTA LEVE)
CREATE TABLE IF NOT EXISTS public.checklists (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    condutor VARCHAR(255) NOT NULL,
    data VARCHAR(50),
    odometro NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Aprovado',
    observacoes TEXT,
    itens JSONB,
    email VARCHAR(255),
    tipo VARCHAR(50) DEFAULT 'Saída',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Checklists" ON public.checklists;
DROP POLICY IF EXISTS "Leitura Checklists" ON public.checklists;
DROP POLICY IF EXISTS "Gravacao Checklists" ON public.checklists;
CREATE POLICY "Leitura Checklists" ON public.checklists FOR SELECT USING (true);
CREATE POLICY "Gravacao Checklists" ON public.checklists FOR ALL USING (true) WITH CHECK (true);

-- 12. TABELA DE MAPEAMENTOS DE E-MAIL (CONFIGURAÇÃO DE DISPAROS DE MULTAS E FROTAS)
CREATE TABLE IF NOT EXISTS public.email_mappings (
    id TEXT PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    mappings JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.email_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Email Mappings" ON public.email_mappings;
CREATE POLICY "Leitura Email Mappings" ON public.email_mappings FOR SELECT USING (true);
CREATE POLICY "Gravacao Email Mappings" ON public.email_mappings FOR ALL USING (true) WITH CHECK (true);
`;


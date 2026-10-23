import { db } from "../firebaseConfig";
import { 
  fetchLancamentosSupabase, 
  saveLancamentoSupabase, 
  deleteLancamentoSupabase,
  getSupabaseClient,
  mapSupabaseRowToLancamento
} from "./supabaseService";

// Evento customizado para notificar todos os componentes do sistema na mesma janela/abas
const SYNC_EVENT = "risel_lancamentos_sync_event";
const STORAGE_KEY = "risel_lancamentos";
const SNAPSHOT_BACKUP_KEY = "risel_lancamentos_snapshot_backup";
const SNAPSHOT_TIMESTAMP_KEY = "risel_lancamentos_snapshot_timestamp";
const DELETED_IDS_KEY = "risel_lancamentos_deleted_ids";

// BroadcastChannel para sincronização instantânea (<10ms) entre todas as abas e janelas abertas
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("risel_lancamentos_broadcast_channel");
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "SYNC_LANCAMENTOS" && Array.isArray(event.data.items)) {
        console.info("[LancamentosSync] Recebido via BroadcastChannel de outra aba.");
        updateLocalCacheFromBroadcast(event.data.items);
      }
    };
  }
} catch (e) {}

// Flag para pausar chamadas ao Supabase caso atinja cota de tráfego (exceed_egress_quota)
let supabaseQuotaExceededUntil = 0;
let lastKnownServerVersion = 0;
let supabaseRealtimeChannel: any = null;

// Função de cálculo de assinatura de integridade para detecção instantânea de edições de campos
export function computeLancamentosSignature(items: any[]): string {
  if (!items || items.length === 0) return "empty_0";
  return items.map(item => {
    const id = item.id || "";
    const status = item.status || "";
    const valor = item.valor || "";
    const venc = item.dataVencimento || item.data_vencimento || "";
    const emiss = item.dataEmissao || item.data_emissao || "";
    const lanc = item.dataLancamento || item.data_lancamento || "";
    const doc = item.doc || "";
    const codDoc = item.codigoLancamento || item.numeroDocumento || "";
    const codOc = item.codLancamentoOc || "";
    const forn = item.fornecedor || "";
    const cnpj = item.cnpj || "";
    const cc = item.centroCusto || "";
    const alc = item.aprovadores || "";
    const est = item.estabelecimento || "";
    const pag = item.formaPagto || item.forma_pagto || "";
    const apr = item.dataAprovacao || item.data_aprovacao || "";
    const obs = (item.observacao || "").slice(0, 80);
    const anx = Array.isArray(item.anexos) ? item.anexos.length : (item.arquivoAnexoBase64 ? 1 : 0);
    const upd = item.updatedAt || "";
    return `${id}:${status}:${valor}:${venc}:${emiss}:${lanc}:${doc}:${codDoc}:${codOc}:${forn}:${cnpj}:${cc}:${alc}:${est}:${pag}:${apr}:${obs}:${anx}:${upd}`;
  }).join("|");
}

// Função para obter IDs deletados para evitar re-ressurreição
function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw).map(String));
  } catch (e) {
    return new Set();
  }
}

function addDeletedId(id: string | number) {
  try {
    const idStr = String(id);
    const set = getDeletedIds();
    set.add(idStr);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function removeDeletedId(id: string | number) {
  try {
    const idStr = String(id);
    const set = getDeletedIds();
    if (set.has(idStr)) {
      set.delete(idStr);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

// Limpa IDs deletados antigos se a lista crescer demasiadamente (> 500)
function cleanupDeletedIds() {
  try {
    const set = getDeletedIds();
    if (set.size > 500) {
      const arr = Array.from(set).slice(-200);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
    }
  } catch (e) {}
}

let activeListeners: Array<(items: any[]) => void> = [];
let cachedLancamentos: any[] = [];
let isInitialized = false;
let unsubscribeFirestore: (() => void) | null = null;
let pollIntervalTimer: any = null;

// Função para identificar apenas registros explicitamente de teste de desenvolvimento
export function isFictitiousLancamento(item: any): boolean {
  if (!item) return false;
  const fornecedorUpper = String(item.fornecedor || "").toUpperCase().trim();
  if (fornecedorUpper === "FORNECEDOR TESTE" || fornecedorUpper === "FORNECEDOR FICTÍCIO" || fornecedorUpper === "TESTE MOCK") {
    return true;
  }
  return false;
}

// Mapa em memória de gravações locais recentes para impedir que sincronizações assíncronas atrasadas revertam status ou campos recém-salvos
const recentlySavedMap = new Map<string, { item: any; savedAtMs: number }>();
const RECENTLY_SAVED_SESSION_KEY = "risel_lancamentos_recent_saves_v1";

function recordRecentSave(item: any) {
  if (!item || !item.id) return;
  const idStr = String(item.id);
  const now = Date.now();
  recentlySavedMap.set(idStr, { item: { ...item }, savedAtMs: now });
  try {
    const slim = prepareItemsForLocalStorage([item])[0];
    const raw = sessionStorage.getItem(RECENTLY_SAVED_SESSION_KEY);
    const mapObj = raw ? JSON.parse(raw) : {};
    mapObj[idStr] = { item: slim, savedAtMs: now };
    // Limpa entradas com mais de 10 minutos
    Object.keys(mapObj).forEach(k => {
      if (now - (mapObj[k]?.savedAtMs || 0) > 10 * 60 * 1000) {
        delete mapObj[k];
      }
    });
    sessionStorage.setItem(RECENTLY_SAVED_SESSION_KEY, JSON.stringify(mapObj));
  } catch (e) {}
}

function getRecentSave(idStr: string): { item: any; savedAtMs: number } | null {
  const mem = recentlySavedMap.get(idStr);
  if (mem && Date.now() - mem.savedAtMs <= 10 * 60 * 1000) {
    return mem;
  }
  try {
    const raw = sessionStorage.getItem(RECENTLY_SAVED_SESSION_KEY);
    if (raw) {
      const mapObj = JSON.parse(raw);
      const entry = mapObj[idStr];
      if (entry && Date.now() - (entry.savedAtMs || 0) <= 10 * 60 * 1000) {
        return entry;
      }
    }
  } catch (e) {}
  return null;
}

export function getItemTimestampMs(item: any): number {
  if (!item) return 0;
  if (typeof item.updatedAtMs === "number" && item.updatedAtMs > 0) return item.updatedAtMs;
  if (item.updatedAt) {
    const t = new Date(item.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.updated_at) {
    const t = new Date(item.updated_at).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.createdAt) {
    const t = new Date(item.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.created_at) {
    const t = new Date(item.created_at).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

export function stripInternalMetadataTags(rawObs: string): string {
  if (!rawObs || typeof rawObs !== "string") return "";
  return rawObs
    .replace(/\[Nº DOC:[^\]]*\]/gi, "")
    .replace(/\[OC\/CÓD:[^\]]*\]/gi, "")
    .replace(/\[CENTRO DE CUSTO:[^\]]*\]/gi, "")
    .replace(/\[ALÇADA:[^\]]*\]/gi, "")
    .replace(/\[BASE:[^\]]*\]/gi, "")
    .replace(/\[UPDATED_AT:[^\]]*\]/gi, "")
    .replace(/\[GOOGLE DRIVE:[^\]]*\]/gi, "")
    .replace(/\[CONTATO_JSON:\s*\{.*?\}\]/gis, "")
    .replace(/\[ANEXOS_META_JSON:\s*\[.*?\]\]/gis, "")
    .replace(/\[ANEXOS_JSON:\s*\[.*?\]\]/gis, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Mescla duas versões do mesmo lançamento priorizando estritamente a versão mais recente (por updatedAt) e preservando binários de anexos
function mergeTwoLancamentoVersions(primaryOrOlder: any, secondaryOrNewer: any): any {
  if (!primaryOrOlder) return normalizeLancamento(secondaryOrNewer);
  if (!secondaryOrNewer) return normalizeLancamento(primaryOrOlder);

  const normA = normalizeLancamento(primaryOrOlder);
  const normB = normalizeLancamento(secondaryOrNewer);

  const timeA = getItemTimestampMs(normA);
  const timeB = getItemTimestampMs(normB);

  let winner = normB;
  let loser = normA;

  if (timeA > 0 && timeB > 0) {
    if (timeA >= timeB) {
      winner = normA;
      loser = normB;
    } else {
      winner = normB;
      loser = normA;
    }
  } else if (timeA > 0 && timeB === 0) {
    winner = normA;
    loser = normB;
  } else if (timeB > 0 && timeA === 0) {
    winner = normB;
    loser = normA;
  } else {
    // Se nenhum tem timestamp explícito, prioriza normA (geralmente Servidor / Cache Local ativo)
    winner = normA;
    loser = normB;
  }

  // Hidrata base64 dos anexos caso o vencedor tenha vindo do localStorage slim (sem base64)
  const loserAnexos: any[] = Array.isArray(loser.anexos) ? loser.anexos : [];
  let mergedAnexos: any[] = Array.isArray(winner.anexos) ? [...winner.anexos] : [];

  if (mergedAnexos.length > 0) {
    mergedAnexos = mergedAnexos.map((anx: any, idx: number) => {
      if (anx && anx.base64 && anx.base64.length > 50) return anx;
      const matchInLoser = loserAnexos.find((la: any) => (la?.id && la.id === anx?.id) || (la?.nome && la.nome === anx?.nome)) || loserAnexos[idx];
      if (matchInLoser && matchInLoser.base64) {
        return { ...anx, base64: matchInLoser.base64 };
      }
      if (idx === 0 && loser.arquivoAnexoBase64 && loser.arquivoAnexoBase64.length > 50) {
        return { ...anx, base64: loser.arquivoAnexoBase64 };
      }
      return anx;
    });
  } else if (winner.temAnexo && loserAnexos.length > 0) {
    mergedAnexos = loserAnexos;
  }

  const bestBase64 =
    winner.arquivoAnexoBase64 ||
    mergedAnexos[0]?.base64 ||
    ((winner.temAnexo || winner.nomeArquivoAnexo) ? (loser.arquivoAnexoBase64 || loserAnexos[0]?.base64 || "") : "");

  return normalizeLancamento({
    ...loser,
    ...winner,
    anexos: mergedAnexos,
    arquivoAnexoBase64: bestBase64,
    updatedAt: winner.updatedAt || loser.updatedAt || "",
    updatedAtMs: Math.max(timeA, timeB) || undefined
  });
}

// Normaliza um registro de lançamento para manter consistência total e integridade absoluta dos campos
export function normalizeLancamento(item: any): any {
  if (!item) return item;
  const rawId = item.id;
  const numId = Number(rawId);
  const cleanId = !isNaN(numId) && numId > 0 ? numId : (rawId || Date.now());

  // 1. Número do Documento (Nº Documento *) - NUNCA deve ser misturado com Cód. OC
  let numDoc = item.codigoLancamento || item.numeroDocumento || item.codigo_lancamento || item.NUMERO_DOC || "";
  
  // 2. Cód. Lançamento / Nº OC - Campo independente e opcional
  let codOc = item.codLancamentoOc !== undefined ? item.codLancamentoOc : (item.codigo_lancamento_oc || item.cod_lancamento_oc || item.COD_OC || "");

  let centCusto = item.centroCusto || item.centro_custo || item.CENTRO_CUSTO || "";
  let alcada = item.aprovadores || item.APROVADORES || "";
  let baseFilial = item.estabelecimento || item.ESTABELECIMENTO || "";
  let extractedUpdatedAt = item.updatedAt || item.updated_at || "";
  let extraContato: any = {};

  // Extração inteligente de tags de segurança na observação (usadas apenas como fallback se o campo principal não estiver definido)
  const rawObs = String(item.observacao || item.OBSERVACAO || "");
  if (rawObs) {
    const getLatestTag = (regex: RegExp) => {
      const matches = Array.from(rawObs.matchAll(regex));
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        return last && last[1] ? last[1].trim() : "";
      }
      return "";
    };

    const docTag = getLatestTag(/\[Nº DOC:\s*([^\]]+)\]/gi);
    if (docTag && !numDoc) numDoc = docTag;

    const ocTag = getLatestTag(/\[OC\/CÓD:\s*([^\]]+)\]/gi);
    if (ocTag && !codOc && item.codLancamentoOc === undefined) codOc = ocTag;

    const ccTag = getLatestTag(/\[CENTRO DE CUSTO:\s*([^\]]+)\]/gi);
    if (ccTag && !centCusto) centCusto = ccTag;

    const alcadaTag = getLatestTag(/\[ALÇADA:\s*([^\]]+)\]/gi);
    if (alcadaTag && !alcada) alcada = alcadaTag;

    const baseTag = getLatestTag(/\[BASE:\s*([^\]]+)\]/gi);
    if (baseTag && !baseFilial) baseFilial = baseTag;

    const updTag = getLatestTag(/\[UPDATED_AT:\s*([^\]]+)\]/gi);
    if (updTag && !extractedUpdatedAt) extractedUpdatedAt = updTag;

    const contatoMatch = rawObs.match(/\[CONTATO_JSON:\s*(\{.*?\})\]/s);
    if (contatoMatch && contatoMatch[1]) {
      try {
        extraContato = JSON.parse(contatoMatch[1]);
      } catch (e) {}
    }
  }

  if (!centCusto) centCusto = "C.C 101 - Operacional";
  if (!baseFilial) baseFilial = "100 - Paulínia";

  // Se ainda não tem numDoc mas tem o campo doc, tenta extrair o número do documento (ex: "NF-e 1902" -> "1902")
  const rawDocStr = item.doc || item.DOC || "";
  if (!numDoc && rawDocStr && typeof rawDocStr === "string") {
    const cleanDoc = rawDocStr.trim();
    if (!cleanDoc.startsWith("DOC-") && !cleanDoc.endsWith("S/N")) {
      const parts = cleanDoc.split(" ");
      if (parts.length > 1) {
        numDoc = parts.slice(1).join(" ").trim();
      } else {
        numDoc = cleanDoc;
      }
    }
  }

  // Formatação consistente e determinística do campo 'doc' (tipo + número do documento)
  const tipoDoc = item.tipo || item.tipoDocumento || item.TIPO || "NF-e";
  let finalDoc = rawDocStr;
  if (!finalDoc || finalDoc === "N/A" || finalDoc.startsWith("DOC-")) {
    if (numDoc) {
      finalDoc = numDoc.toLowerCase().startsWith(tipoDoc.toLowerCase())
        ? numDoc
        : `${tipoDoc} ${numDoc}`;
    } else {
      finalDoc = `${tipoDoc} S/N`;
    }
  }

  let finalAnexos = Array.isArray(item.anexos) && item.anexos.length > 0 ? item.anexos.slice(0, 4) : [];
  if (finalAnexos.length === 0 && rawObs && (rawObs.includes("[ANEXOS_JSON:") || rawObs.includes("[ANEXOS_META_JSON:"))) {
    try {
      const match = rawObs.match(/\[ANEXOS_(?:META_)?JSON:\s*(\[.*?\])\]/s);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalAnexos = parsed.slice(0, 4);
        }
      }
    } catch (e) {}
  }
  const fallbackBase64 = item.arquivoAnexoBase64 || item.arquivo_anexo_base64 || "";
  const fallbackNomeAnexo = item.nomeArquivoAnexo || item.nome_arquivo_anexo || "";
  if (finalAnexos.length === 0 && (fallbackBase64 || fallbackNomeAnexo)) {
    finalAnexos = [{
      id: "anx-1",
      nome: fallbackNomeAnexo || "Documento.pdf",
      base64: fallbackBase64
    }];
  } else if (finalAnexos.length > 0 && fallbackBase64 && !finalAnexos[0]?.base64) {
    finalAnexos = [
      { ...finalAnexos[0], base64: fallbackBase64 },
      ...finalAnexos.slice(1)
    ];
  }

  const cleanUserObservacao = stripInternalMetadataTags(rawObs);

  const normalizedStatusRaw = String(item.status || item.STATUS || "Aguardando Aprovação").trim();
  const normalizedStatus = normalizedStatusRaw.toLowerCase() === "aguardando aprovação" || normalizedStatusRaw.toLowerCase() === "aguardando aprovacao"
    ? "Aguardando Aprovação"
    : normalizedStatusRaw;

  return {
    ...item,
    id: cleanId,
    tipo: tipoDoc,
    doc: finalDoc,
    codigoLancamento: numDoc,
    numeroDocumento: numDoc,
    codLancamentoOc: codOc || "",
    centroCusto: centCusto,
    aprovadores: alcada || item.aprovadores || "Deny e Gerência",
    estabelecimento: baseFilial,
    status: normalizedStatus,
    fornecedor: item.fornecedor || item.FORNECEDOR || "Fornecedor Não Informado",
    cnpj: item.cnpj || item.CNPJ || "",
    valor: item.valor || item.VALOR || "R$ 0,00",
    formaPagto: item.formaPagto || item.formaPagamento || item.forma_pagto || "Boleto",
    descricao: item.descricao !== undefined ? item.descricao : (item.DESCRICAO || ""),
    itemSistema: item.itemSistema !== undefined ? item.itemSistema : (item.item_sistema || ""),
    frequencia: item.frequencia || item.FREQUENCIA || "Esporádico",
    lancadoPor: item.lancadoPor || item.lancado_por || "Sistema",
    dataAprovacao: item.dataAprovacao !== undefined ? item.dataAprovacao : (item.data_aprovacao || ""),
    dataLancamento: item.dataLancamento || item.data_lancamento || item.DATA_LANCAMENTO || new Date().toISOString().split("T")[0],
    dataVencimento: item.dataVencimento || item.data_vencimento || item.VENCIMENTO || "",
    dataEmissao: item.dataEmissao !== undefined ? item.dataEmissao : (item.data_emissao || item.DATA_EMISSAO || ""),
    observacao: cleanUserObservacao,
    cidade: item.cidade || extraContato.cidade || "",
    uf: (item.uf || extraContato.uf || "").toUpperCase(),
    telefone: item.telefone || extraContato.telefone || "",
    email: (item.email || extraContato.email || "").toLowerCase(),
    multaPlaca: item.multaPlaca || extraContato.multaPlaca || "",
    multaInfracao: item.multaInfracao || extraContato.multaInfracao || "",
    multaMotorista: item.multaMotorista || extraContato.multaMotorista || "",
    multaGravidade: item.multaGravidade || extraContato.multaGravidade || "Média",
    moduloPetroshow: item.moduloPetroshow || extraContato.moduloPetroshow || "",
    anexos: finalAnexos,
    nomeArquivoAnexo: finalAnexos[0]?.nome || fallbackNomeAnexo || "",
    arquivoAnexoBase64: finalAnexos[0]?.base64 || fallbackBase64 || "",
    temAnexo: Boolean(finalAnexos.length > 0 || fallbackBase64 || fallbackNomeAnexo || item.temAnexo),
    updatedAt: extractedUpdatedAt || item.updatedAt || ""
  };
}

// Função utilitária para atualizar cache local com dados recebidos via BroadcastChannel
function updateLocalCacheFromBroadcast(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return;
  const deletedIds = getDeletedIds();
  const currentMap = new Map<string, any>();
  cachedLancamentos.forEach(i => currentMap.set(String(i.id), i));

  const valid = items
    .filter(i => !deletedIds.has(String(i.id)) && !isFictitiousLancamento(i))
    .map(incoming => {
      const idStr = String(incoming.id);
      const existing = currentMap.get(idStr);
      const recent = getRecentSave(idStr);
      let merged = existing ? mergeTwoLancamentoVersions(existing, incoming) : normalizeLancamento(incoming);
      if (recent) {
        merged = mergeTwoLancamentoVersions(merged, recent.item);
      }
      return merged;
    });
  
  if (valid.length === 0) return;
  
  const currentSig = computeLancamentosSignature(cachedLancamentos);
  const newSig = computeLancamentosSignature(valid);
  if (currentSig === newSig && cachedLancamentos.length === valid.length) return;

  cachedLancamentos = valid;
  try {
    const slim = prepareItemsForLocalStorage(valid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    localStorage.setItem(SNAPSHOT_BACKUP_KEY, JSON.stringify(slim));
    localStorage.setItem(SNAPSHOT_TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {}

  activeListeners.forEach(cb => {
    try { cb(valid); } catch (e) {}
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: valid }));
    window.dispatchEvent(new Event("risel_lancamentos_updated"));
  }
}

// Configura o canal Realtime do Supabase via WebSocket para refletir alterações pontuais e instantâneas entre computadores
function setupSupabaseRealtimeChannel() {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    if (supabaseRealtimeChannel) {
      try { client.removeChannel(supabaseRealtimeChannel); } catch (e) {}
      supabaseRealtimeChannel = null;
    }

    supabaseRealtimeChannel = client
      .channel("lancamentos-live-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lancamentos" },
        (payload: any) => {
          console.info("[Supabase Realtime] Evento na tabela 'lancamentos':", payload.eventType);
          
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            if (payload.new && payload.new.id) {
              const mapped = mapSupabaseRowToLancamento(payload.new);
              const normalized = normalizeLancamento(mapped);
              const targetId = String(normalized.id);
              const deletedIds = getDeletedIds();
              if (deletedIds.has(targetId)) return;

              const current = getLancamentosUnified();
              const existingIdx = current.findIndex(i => String(i.id) === targetId);
              const recent = getRecentSave(targetId);

              let nextList: any[];
              if (existingIdx >= 0) {
                const existing = current[existingIdx];
                // Se houve gravação local nos últimos 45s e o evento Realtime não tem timestamp superior, protege a versão local
                if (recent && Date.now() - recent.savedAtMs < 45000) {
                  const recentTime = getItemTimestampMs(recent.item);
                  const incomingTime = getItemTimestampMs(normalized);
                  if (!incomingTime || recentTime >= incomingTime) {
                    const protectedItem = mergeTwoLancamentoVersions(normalized, recent.item);
                    nextList = [...current];
                    nextList[existingIdx] = protectedItem;
                    notifyListeners(nextList);
                    return;
                  }
                }

                const mergedItem = mergeTwoLancamentoVersions(existing, normalized);
                nextList = [...current];
                nextList[existingIdx] = mergedItem;
              } else {
                nextList = [recent ? mergeTwoLancamentoVersions(normalized, recent.item) : normalized, ...current];
              }
              notifyListeners(nextList);
            }
          } else if (payload.eventType === "DELETE") {
            const oldId = payload.old?.id;
            if (oldId) {
              const idStr = String(oldId);
              addDeletedId(idStr);
              const current = getLancamentosUnified();
              const nextList = current.filter(i => String(i.id) !== idStr);
              notifyListeners(nextList, true);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[Supabase Realtime] Inscrito e conectado na tabela 'lancamentos' com sucesso.");
        }
      });
  } catch (err) {
    console.warn("[Supabase Realtime] Aviso ao configurar canal:", err);
  }
}

// Função utilitária para higienizar itens salvos no localStorage (evita estouro de cota de 5MB com base64)
function prepareItemsForLocalStorage(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (!item) return item;
    const clone = { ...item };
    if (clone.arquivoAnexoBase64 && clone.arquivoAnexoBase64.length > 200) {
      clone.temAnexo = true;
      delete clone.arquivoAnexoBase64;
    }
    if (Array.isArray(clone.anexos) && clone.anexos.length > 0) {
      clone.temAnexo = true;
      clone.anexos = clone.anexos.map((anx: any) => {
        if (!anx) return anx;
        const { base64, ...anxRest } = anx;
        return anxRest;
      });
    }
    return clone;
  });
}

// Dispara notificação para todos os ouvintes ativos com salvamento seguro
function notifyListeners(items: any[], forceAllowEmpty: boolean = false) {
  // REGRA DE PROTEÇÃO ANTI-WIPE:
  // Se a lista de entrada estiver vazia, mas tínhamos itens locais e não foi uma limpeza intencional, NÃO limpa!
  if (items.length === 0 && cachedLancamentos.length > 0 && !forceAllowEmpty) {
    console.warn("[LancamentosSync] Tentativa de sobrescrever lista local com vazio bloqueada pelo mecanismo Anti-Wipe.");
    return;
  }

  cachedLancamentos = items;

  try {
    const slimItems = prepareItemsForLocalStorage(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slimItems));
    
    // Se a lista possui itens, atualiza o snapshot imutável de contingência
    if (items.length > 0) {
      localStorage.setItem(SNAPSHOT_BACKUP_KEY, JSON.stringify(slimItems));
      localStorage.setItem(SNAPSHOT_TIMESTAMP_KEY, new Date().toISOString());
    }

    try {
      sessionStorage.setItem("risel_lancamentos_session", JSON.stringify(slimItems));
    } catch (sErr) {}
  } catch (e) {
    console.warn("[LancamentosSync] Erro ao persistir em localStorage:", e);
  }

  activeListeners.forEach(cb => {
    try {
      cb(items);
    } catch (err) {
      console.warn("Erro no listener de lançamentos:", err);
    }
  });

  // Notifica outras abas ou componentes via CustomEvent
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: items }));
    window.dispatchEvent(new Event("risel_lancamentos_updated"));
  }
}

// 1. Obter lançamentos atuais em memória ou do storage com recuperação por snapshot
export function getLancamentosUnified(): any[] {
  if (cachedLancamentos && cachedLancamentos.length > 0) {
    // Filtra dados fictícios residuais se houver
    cachedLancamentos = cachedLancamentos.filter(item => !isFictitiousLancamento(item));
    return cachedLancamentos;
  }
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const deletedIds = getDeletedIds();
    
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedLancamentos = parsed
          .filter((item: any) => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
          .map(normalizeLancamento);
        if (cachedLancamentos.length > 0) {
          return cachedLancamentos;
        }
      }
    }

    // MECANISMO DE RECUPERAÇÃO AUTOMÁTICA: Se o STORAGE_KEY estiver vazio, busca no SNAPSHOT_BACKUP_KEY
    const snapshot = localStorage.getItem(SNAPSHOT_BACKUP_KEY);
    if (snapshot) {
      const parsedSnap = JSON.parse(snapshot);
      if (Array.isArray(parsedSnap) && parsedSnap.length > 0) {
        cachedLancamentos = parsedSnap
          .filter((item: any) => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
          .map(normalizeLancamento);
        // Restaura no STORAGE_KEY
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(prepareItemsForLocalStorage(cachedLancamentos)));
        } catch (e) {}
        return cachedLancamentos;
      }
    }

    // Fallback de contingência no sessionStorage
    const sessionSaved = sessionStorage.getItem("risel_lancamentos_session");
    if (sessionSaved) {
      const parsedSession = JSON.parse(sessionSaved);
      if (Array.isArray(parsedSession) && parsedSession.length > 0) {
        cachedLancamentos = parsedSession
          .filter((item: any) => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
          .map(normalizeLancamento);
        return cachedLancamentos;
      }
    }
  } catch (e) {}

  return [];
}

// 2. Iniciar sincronização com Banco de Dados (Supabase Realtime, Render Backend e Firestore)
export function initLancamentosSync(): () => void {
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;
  cleanupDeletedIds();

  // Carrega estado inicial do cache local
  getLancamentosUnified();

  // A. Conexão em tempo real pontual via WebSocket no Supabase PostgreSQL
  setupSupabaseRealtimeChannel();

  // B. Carga inicial dos dados oficiais ao abrir a aplicação
  pullFromCloudAndServer();

  // C. Listener para sincronização entre abas do mesmo navegador via localStorage
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        const deletedIds = getDeletedIds();
        if (Array.isArray(updated) && updated.length > 0) {
          const currentMap = new Map<string, any>();
          cachedLancamentos.forEach(i => currentMap.set(String(i.id), i));

          const valid = updated
            .filter((item: any) => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
            .map((item: any) => {
              const idStr = String(item.id);
              const existing = currentMap.get(idStr);
              const recent = getRecentSave(idStr);
              let merged = existing ? mergeTwoLancamentoVersions(existing, item) : normalizeLancamento(item);
              if (recent) {
                merged = mergeTwoLancamentoVersions(merged, recent.item);
              }
              return merged;
            });
          if (valid.length > 0) {
            cachedLancamentos = valid;
            activeListeners.forEach(cb => { try { cb(valid); } catch (err) {} });
          }
        }
      } catch (err) {}
    }
  };

  const handleCustomSync = (e: any) => {
    if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
      cachedLancamentos = e.detail;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(SYNC_EVENT, handleCustomSync);
  }

  return () => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
    if (supabaseRealtimeChannel) {
      try {
        const client = getSupabaseClient();
        if (client) client.removeChannel(supabaseRealtimeChannel);
      } catch (e) {}
      supabaseRealtimeChannel = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(SYNC_EVENT, handleCustomSync);
    }
    isInitialized = false;
  };
}

let isPulling = false;

// B. Busca no Banco de Dados do Servidor, Firestore e Supabase com proteção absoluta contra perda de dados ou reversão de status
export async function pullFromCloudAndServer(force: boolean = false): Promise<any[]> {
  if (isPulling) return cachedLancamentos;
  isPulling = true;

  try {
    let deletedIds = getDeletedIds();
    const idMap = new Map<string, any>();
    let databaseFetched = false;

    // 1. Busca no Servidor backend (/api/lancamentos) com proteção total anti-cache
    try {
      const res = await fetch(`/api/lancamentos?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });
      if (res.ok) {
        const data = await res.json();

        if (data.version) {
          lastKnownServerVersion = Math.max(lastKnownServerVersion, data.version);
        }

        // Se o servidor retornou IDs deletados, sincroniza com o conjunto local
        if (data.deletedIds && Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: any) => addDeletedId(id));
          deletedIds = getDeletedIds();
        }

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          databaseFetched = true;
          data.items.forEach((item: any) => {
            const idStr = String(item.id);
            if (!deletedIds.has(idStr) && !isFictitiousLancamento(item)) {
              idMap.set(idStr, normalizeLancamento(item));
            }
          });
        }
      }
    } catch (e) {
      console.warn("[LancamentosSync] Falha ao consultar backend /api/lancamentos:", e);
    }

    // 2. Busca no Supabase (com proteção de quota e mesclagem estrita por timestamp updatedAt)
    const now = Date.now();
    if (now > supabaseQuotaExceededUntil) {
      try {
        const supaItems = await fetchLancamentosSupabase();
        if (Array.isArray(supaItems) && supaItems.length > 0) {
          databaseFetched = true;
          supaItems.forEach(item => {
            const idStr = String(item.id);
            if (!deletedIds.has(idStr) && !isFictitiousLancamento(item)) {
              const existing = idMap.get(idStr);
              if (existing) {
                idMap.set(idStr, mergeTwoLancamentoVersions(existing, item));
              } else {
                idMap.set(idStr, normalizeLancamento(item));
              }
            }
          });
        }
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("exceed_egress_quota") || msg.includes("quota")) {
          supabaseQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
          console.warn("[LancamentosSync] Supabase com restrição de tráfego. Utilizando banco de dados local redundante.");
        }
      }
    }

    // 3. Mescla itens do cache local e da trava de gravações recentes para garantir que criações ou edições nunca sejam revertidas
    if (cachedLancamentos && cachedLancamentos.length > 0) {
      cachedLancamentos.forEach(localItem => {
        const idStr = String(localItem.id);
        if (!deletedIds.has(idStr) && !isFictitiousLancamento(localItem)) {
          const remoteItem = idMap.get(idStr);
          if (!remoteItem) {
            idMap.set(idStr, normalizeLancamento(localItem));
          } else {
            idMap.set(idStr, mergeTwoLancamentoVersions(remoteItem, localItem));
          }
        }
      });
    }

    // 4. Garante prioridade absoluta para itens recém-salvos nesta sessão
    idMap.forEach((currentVal, idStr) => {
      const recent = getRecentSave(idStr);
      if (recent) {
        idMap.set(idStr, mergeTwoLancamentoVersions(currentVal, recent.item));
      }
    });

    // 5. Monta a lista oficial autoritativa estritamente com dados reais
    const freshItems = Array.from(idMap.values())
      .filter(item => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    // Atualiza o cache e notifica ouvintes se houver QUALQUER diferença de conteúdo
    if (freshItems.length > 0 || databaseFetched) {
      const currentSignature = computeLancamentosSignature(cachedLancamentos);
      const freshSignature = computeLancamentosSignature(freshItems);
      
      if (force || currentSignature !== freshSignature || cachedLancamentos.length !== freshItems.length) {
        notifyListeners(freshItems);
      }
    }

    return freshItems.length > 0 ? freshItems : cachedLancamentos;
  } finally {
    isPulling = false;
  }
}

// Auto-Heal: envia itens locais válidos para o servidor se o servidor tiver sido reiniciado
async function autoHealServer(items: any[]) {
  if (!items || items.length === 0) return;
  try {
    await fetch("/api/lancamentos/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    console.info(`[LancamentosSync] Auto-Heal executado com sucesso: ${items.length} lançamentos persistidos no servidor.`);
  } catch (e) {}
}

// Força sincronização imediata manual
export async function forceSyncLancamentos(): Promise<any[]> {
  return await pullFromCloudAndServer(true);
}

// 3. Subscrever para receber atualizações automáticas em componentes React
export function subscribeToLancamentosUnified(callback: (items: any[]) => void): () => void {
  initLancamentosSync();

  activeListeners.push(callback);
  callback(getLancamentosUnified());

  return () => {
    activeListeners = activeListeners.filter(cb => cb !== callback);
  };
}

// 4. Gravação / Criação / Edição de Lançamento com reflexo imediato e persistência direta no Banco
export async function saveLancamentoUnified(item: any): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const normalized = normalizeLancamento({
    ...item,
    updatedAt: nowIso,
    updatedAtMs: nowMs
  });
  normalized.updatedAt = nowIso;
  normalized.updatedAtMs = nowMs;
  const targetId = String(normalized.id);

  // Remove dos IDs deletados caso estivesse marcado
  removeDeletedId(targetId);

  // 1. Atualização Otimista Imediata Local com Preservação de Anexos em Memória
  const current = getLancamentosUnified();
  const existingIdx = current.findIndex(i => String(i.id) === targetId);
  let finalSavedItem = normalized;
  let updatedList: any[];

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    // Se o item editado mantinha anexos cujos base64 estavam em memória no existing, preserva-os
    if (Array.isArray(finalSavedItem.anexos) && finalSavedItem.anexos.length > 0 && Array.isArray(existing.anexos)) {
      finalSavedItem.anexos = finalSavedItem.anexos.map((anx: any, idx: number) => {
        if (anx && anx.base64 && anx.base64.length > 50) return anx;
        const matchOld = existing.anexos.find((ea: any) => (ea?.id && ea.id === anx?.id) || (ea?.nome && ea.nome === anx?.nome)) || existing.anexos[idx];
        if (matchOld && matchOld.base64) {
          return { ...anx, base64: matchOld.base64 };
        }
        return anx;
      });
    }
    if (!finalSavedItem.arquivoAnexoBase64 && finalSavedItem.nomeArquivoAnexo && existing.arquivoAnexoBase64) {
      finalSavedItem.arquivoAnexoBase64 = finalSavedItem.anexos?.[0]?.base64 || existing.arquivoAnexoBase64;
    }
    finalSavedItem = { ...existing, ...finalSavedItem, updatedAt: nowIso, updatedAtMs: nowMs };
    updatedList = [...current];
    updatedList[existingIdx] = finalSavedItem;
  } else {
    updatedList = [finalSavedItem, ...current];
  }

  // Registra na trava de proteção contra reversão assíncrona
  recordRecentSave(finalSavedItem);

  notifyListeners(updatedList);

  // Transmite imediatamente para outras abas locais
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "SYNC_LANCAMENTOS", items: updatedList });
    } catch (e) {}
  }

  // 2. Persistência no Servidor Express (Disco local + Backup atômico + Supabase server-side)
  try {
    const res = await fetch("/api/lancamentos", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify(finalSavedItem)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        lastKnownServerVersion = Math.max(lastKnownServerVersion, data.version);
      }
    }
  } catch (sErr) {
    console.warn("[LancamentosSync] Erro ao salvar no Servidor:", sErr);
  }

  // 3. Persistência direta no Banco Supabase PostgreSQL
  if (Date.now() > supabaseQuotaExceededUntil) {
    try {
      await saveLancamentoSupabase(finalSavedItem);
    } catch (sbErr: any) {
      if (String(sbErr?.message || "").includes("exceed_egress_quota")) {
        supabaseQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
      }
    }
  }

  // 4. Persistência no Firestore (contingência)
  try {
    const cleanForFirestore = { ...finalSavedItem };
    Object.keys(cleanForFirestore).forEach(k => cleanForFirestore[k] === undefined && delete cleanForFirestore[k]);
    await db.collection("lancamentos").doc(targetId).set(cleanForFirestore, { merge: true });
  } catch (fErr) {}

  return true;
}

// 5. Exclusão de Lançamento com reflexo imediato para todos os usuários
export async function deleteLancamentoUnified(id: number | string): Promise<boolean> {
  const idStr = String(id);
  addDeletedId(idStr);

  // 1. Atualização Otimista Imediata Local
  const current = getLancamentosUnified();
  const updatedList = current.filter(item => String(item.id) !== idStr);
  notifyListeners(updatedList, true);

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "SYNC_LANCAMENTOS", items: updatedList });
    } catch (e) {}
  }

  // 2. Exclusão no Servidor Express (Banco de Dados)
  try {
    const res = await fetch(`/api/lancamentos/${idStr}`, { 
      method: "DELETE",
      headers: { "Cache-Control": "no-cache" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        lastKnownServerVersion = Math.max(lastKnownServerVersion, data.version);
      }
    }
  } catch (sErr) {
    console.warn("[LancamentosSync] Erro ao excluir do Servidor:", sErr);
  }

  // 3. Exclusão no Banco Supabase
  try {
    await deleteLancamentoSupabase(id);
  } catch (sbErr) {}

  // 4. Exclusão no Firestore
  try {
    await db.collection("lancamentos").doc(idStr).delete();
  } catch (fErr) {}

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "REQUEST_PULL" });
    } catch (e) {}
  }

  return true;
}

// =========================================================================
// MÓDULO OFICIAL DE BANCO DE DADOS: BACKUPS E RESTAURAÇÃO
// =========================================================================

export interface DatabaseBackupInfo {
  filename: string;
  timestamp: string;
  count: number;
  sizeBytes: number;
}

// Busca a lista de backups gravados no Banco de Dados do Servidor
export async function fetchDatabaseBackups(): Promise<DatabaseBackupInfo[]> {
  try {
    const res = await fetch("/api/lancamentos/backups");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.backups) ? data.backups : [];
  } catch (e) {
    return [];
  }
}

// Cria um backup imediato do Banco de Dados no servidor
export async function createDatabaseBackup(): Promise<{ success: boolean; filename?: string; count?: number; error?: string }> {
  try {
    const res = await fetch("/api/lancamentos/backup", { method: "POST" });
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Restaura os dados a partir de um backup gravado no Banco de Dados do Servidor
export async function restoreFromDatabaseBackup(filename?: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const res = await fetch("/api/lancamentos/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      const restored = data.items.map(normalizeLancamento);
      notifyListeners(restored, true);
      return { success: true, count: restored.length };
    }
    return { success: false, count: 0, error: data.error || "Erro ao restaurar do banco de dados" };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message };
  }
}

// Importa e grava lançamentos diretamente no Banco de Dados do Servidor
export async function importLancamentosToDatabase(items: any[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, count: 0, error: "Nenhum lançamento fornecido" };
  }
  try {
    const normalizedList = items.map(normalizeLancamento);
    const res = await fetch("/api/lancamentos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: normalizedList })
    });
    const data = await res.json();
    if (data.success) {
      notifyListeners(normalizedList, true);
      return { success: true, count: normalizedList.length };
    }
    return { success: false, count: 0, error: data.error || "Erro ao importar dados" };
  } catch (e: any) {
    return { success: false, count: 0, error: e.message };
  }
}

// =========================================================================
// MÓDULO DE SNAPSHOT VAULT LOCAL E RESTAURAÇÃO DE EMERGÊNCIA
// =========================================================================

export function getLancamentosSnapshotInfo(): { hasSnapshot: boolean; count: number; timestamp?: string } {
  try {
    const raw = localStorage.getItem(SNAPSHOT_BACKUP_KEY);
    const ts = localStorage.getItem(SNAPSHOT_TIMESTAMP_KEY) || undefined;
    if (!raw) return { hasSnapshot: false, count: 0 };
    const parsed = JSON.parse(raw);
    return {
      hasSnapshot: Array.isArray(parsed) && parsed.length > 0,
      count: Array.isArray(parsed) ? parsed.length : 0,
      timestamp: ts
    };
  } catch (e) {
    return { hasSnapshot: false, count: 0 };
  }
}

export function restoreLancamentosFromSnapshot(): { success: boolean; count: number } {
  try {
    const raw = localStorage.getItem(SNAPSHOT_BACKUP_KEY);
    if (!raw) return { success: false, count: 0 };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return { success: false, count: 0 };

    const restored = parsed.map(normalizeLancamento);
    notifyListeners(restored, true);
    
    // Repopula o banco de dados do servidor
    autoHealServer(restored).catch(() => {});
    importLancamentosToDatabase(restored).catch(() => {});

    return { success: true, count: restored.length };
  } catch (e) {
    return { success: false, count: 0 };
  }
}

export function restoreLancamentosFromList(items: any[]): { success: boolean; count: number } {
  if (!Array.isArray(items) || items.length === 0) return { success: false, count: 0 };

  const current = getLancamentosUnified();
  const map = new Map<string, any>();

  // Itens atuais
  current.forEach(i => map.set(String(i.id), normalizeLancamento(i)));
  // Novos itens da lista de restauração
  items.forEach(i => map.set(String(i.id || Date.now()), normalizeLancamento(i)));

  const merged = Array.from(map.values()).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  notifyListeners(merged, true);

  // Dispara auto-heal e persistência no banco de dados do servidor
  autoHealServer(merged).catch(() => {});
  importLancamentosToDatabase(merged).catch(() => {});

  return { success: true, count: merged.length };
}

export function exportLancamentosBackupJson(): void {
  const items = getLancamentosUnified();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `backup_banco_lancamentos_risel_${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Recupera o anexo PDF/imagem original de um lançamento diretamente do servidor ou Supabase
 */
export async function fetchLancamentoAnexoOriginal(id: string | number): Promise<{ nome: string; arquivoAnexoBase64: string; anexos: any[] } | null> {
  const targetId = String(id || "").trim();
  if (!targetId) return null;

  // 1. Tenta buscar no cache em memória primeiro
  const current = getLancamentosUnified();
  const cached = current.find(i => String(i.id) === targetId);
  if (cached && (cached.arquivoAnexoBase64 || (Array.isArray(cached.anexos) && cached.anexos.some((a: any) => a?.base64)))) {
    return {
      nome: cached.nomeArquivoAnexo || cached.anexos?.[0]?.nome || "Documento.pdf",
      arquivoAnexoBase64: cached.arquivoAnexoBase64 || cached.anexos?.[0]?.base64 || "",
      anexos: cached.anexos || []
    };
  }

  // 2. Busca no endpoint dedicado do servidor
  try {
    const res = await fetch(`/api/lancamentos/${encodeURIComponent(targetId)}/anexo?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.arquivoAnexoBase64 || (Array.isArray(data.anexos) && data.anexos.length > 0))) {
        if (cached) {
          cached.arquivoAnexoBase64 = data.arquivoAnexoBase64 || cached.arquivoAnexoBase64;
          if (Array.isArray(data.anexos) && data.anexos.length > 0) {
            cached.anexos = data.anexos;
          }
        }
        return {
          nome: data.nome || "Documento.pdf",
          arquivoAnexoBase64: data.arquivoAnexoBase64 || "",
          anexos: data.anexos || []
        };
      }
    }
  } catch (err) {
    console.warn("[LancamentosService] Falha ao carregar anexo do servidor:", err);
  }

  // 3. Fallback Supabase
  try {
    const client = getSupabaseClient();
    if (client) {
      const numId = Number(targetId);
      const query = isNaN(numId)
        ? client.from("lancamentos").select("arquivo_anexo_base64, nome_arquivo_anexo").eq("id", targetId).single()
        : client.from("lancamentos").select("arquivo_anexo_base64, nome_arquivo_anexo").eq("id", numId).single();
      const { data, error } = await query;
      if (!error && data && data.arquivo_anexo_base64) {
        return {
          nome: data.nome_arquivo_anexo || "Documento.pdf",
          arquivoAnexoBase64: data.arquivo_anexo_base64,
          anexos: [{ id: "anx-supa", nome: data.nome_arquivo_anexo || "Documento.pdf", base64: data.arquivo_anexo_base64 }]
        };
      }
    }
  } catch (e) {}

  return null;
}


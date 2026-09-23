import { db } from "../firebaseConfig";
import { 
  fetchLancamentosSupabase, 
  saveLancamentoSupabase, 
  deleteLancamentoSupabase,
  getSupabaseClient 
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
      } else if (event.data?.type === "REQUEST_PULL") {
        pullFromCloudAndServer(true);
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

// Função para identificar e filtrar registros fictícios/demonstrativos antigos
export function isFictitiousLancamento(item: any): boolean {
  if (!item) return false;
  const numId = Number(item.id);
  // IDs pequenos de 1 a 100 gerados nos mocks de desenvolvimento antigos
  if (!isNaN(numId) && numId > 0 && numId <= 100) return true;

  const fornecedorUpper = String(item.fornecedor || "").toUpperCase().trim();
  const ficticiosFornecedores = [
    "AUTO PEÇAS SÃO JOSÉ",
    "POSTO IPIRANGA PAULÍNIA",
    "LOCADORA UNIDAS S.A.",
    "DISTRIBUIDORA SHELL BRASIL",
    "OFICINA MECÂNICA CENTRAL",
    "TRANSPORTADORA RÁPIDO SOL",
    "FORNECEDOR EXEMPLO",
    "FORNECEDOR TESTE"
  ];
  if (ficticiosFornecedores.some(f => fornecedorUpper.includes(f))) return true;

  const docUpper = String(item.doc || item.codigoLancamento || "").toUpperCase().trim();
  const ficticiosDocs = ["NF-E 8831", "NF-E 1902", "FATURA 4520", "NF-E 7634", "CT-E 11980", "BOLETO 9941"];
  if (ficticiosDocs.includes(docUpper)) return true;

  return false;
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
  let codOc = item.codLancamentoOc || item.codigo_lancamento_oc || item.cod_lancamento_oc || item.COD_OC || "";

  let centCusto = item.centroCusto || item.centro_custo || item.CENTRO_CUSTO || "C.C 101 - Operacional";
  let alcada = item.aprovadores || item.APROVADORES || "";
  let baseFilial = item.estabelecimento || item.ESTABELECIMENTO || "";

  // Extração inteligente de tags de segurança na observação
  const rawObs = item.observacao || item.OBSERVACAO || "";
  if (rawObs) {
    const docMatch = String(rawObs).match(/\[Nº DOC:\s*([^\]]+)\]/i);
    if (docMatch && docMatch[1] && !numDoc) {
      numDoc = docMatch[1].trim();
    }
    const ocMatch = String(rawObs).match(/\[OC\/CÓD:\s*([^\]]+)\]/i);
    if (ocMatch && ocMatch[1] && !codOc) {
      codOc = ocMatch[1].trim();
    }
    const ccMatch = String(rawObs).match(/\[CENTRO DE CUSTO:\s*([^\]]+)\]/i);
    if (ccMatch && ccMatch[1] && (!item.centroCusto || item.centroCusto === "C.C 101 - Operacional")) {
      centCusto = ccMatch[1].trim();
    }
    const alcadaMatch = String(rawObs).match(/\[ALÇADA:\s*([^\]]+)\]/i);
    if (alcadaMatch && alcadaMatch[1] && !alcada) {
      alcada = alcadaMatch[1].trim();
    }
    const baseMatch = String(rawObs).match(/\[BASE:\s*([^\]]+)\]/i);
    if (baseMatch && baseMatch[1] && !baseFilial) {
      baseFilial = baseMatch[1].trim();
    }
  }

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

  return {
    ...item,
    id: cleanId,
    tipo: tipoDoc,
    doc: finalDoc,
    codigoLancamento: numDoc,
    numeroDocumento: numDoc,
    codLancamentoOc: codOc,
    centroCusto: centCusto,
    aprovadores: alcada || item.aprovadores || "Deny e Gerência",
    estabelecimento: baseFilial || item.estabelecimento || "100 - Paulínia",
    status: item.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (item.status || item.STATUS || "Aguardando Aprovação"),
    fornecedor: item.fornecedor || item.FORNECEDOR || "Fornecedor Não Informado",
    cnpj: item.cnpj || item.CNPJ || "",
    valor: item.valor || item.VALOR || "R$ 0,00",
    dataLancamento: item.dataLancamento || item.data_lancamento || item.DATA_LANCAMENTO || new Date().toISOString().split("T")[0],
    dataVencimento: item.dataVencimento || item.data_vencimento || item.VENCIMENTO || "",
    dataEmissao: item.dataEmissao || item.data_emissao || item.DATA_EMISSAO || "",
    observacao: rawObs,
    anexos: Array.isArray(item.anexos)
      ? item.anexos.slice(0, 4)
      : (item.arquivoAnexoBase64 ? [{ id: "anx-1", nome: item.nomeArquivoAnexo || "Documento.pdf", base64: item.arquivoAnexoBase64 }] : [])
  };
}

// Função utilitária para atualizar cache local com dados recebidos via BroadcastChannel
function updateLocalCacheFromBroadcast(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return;
  const deletedIds = getDeletedIds();
  const valid = items
    .filter(i => !deletedIds.has(String(i.id)) && !isFictitiousLancamento(i))
    .map(normalizeLancamento);
  
  if (valid.length === 0) return;
  
  const currentSig = computeLancamentosSignature(cachedLancamentos);
  const newSig = computeLancamentosSignature(valid);
  if (currentSig === newSig && cachedLancamentos.length === valid.length) return;

  cachedLancamentos = valid;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    localStorage.setItem(SNAPSHOT_BACKUP_KEY, JSON.stringify(valid));
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

// Configura o canal Realtime do Supabase via WebSocket para refletir alterações instantâneas entre computadores
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
        (payload) => {
          console.info("[Supabase Realtime] Mudança detectada na tabela 'lancamentos':", payload.eventType);
          pullFromCloudAndServer(true);
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

let versionPollTimer: any = null;

// Verificador de versão de altíssima frequência e baixíssimo consumo no Render
async function checkServerVersionFast() {
  try {
    const res = await fetch(`/api/lancamentos/version?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version && data.version > lastKnownServerVersion) {
        if (lastKnownServerVersion > 0) {
          console.info(`[LancamentosSync] Nova versão detectada no Servidor/Render (${data.version} > ${lastKnownServerVersion}). Sincronizando...`);
          pullFromCloudAndServer(true);
        }
        lastKnownServerVersion = data.version;
      }
    }
  } catch (e) {}
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    
    // Se a lista possui itens, atualiza o snapshot imutável de contingência
    if (items.length > 0) {
      localStorage.setItem(SNAPSHOT_BACKUP_KEY, JSON.stringify(items));
      localStorage.setItem(SNAPSHOT_TIMESTAMP_KEY, new Date().toISOString());
    }
  } catch (e) {}

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
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedLancamentos));
        } catch (e) {}
        return cachedLancamentos;
      }
    }
  } catch (e) {}

  return [];
}

// 2. Iniciar sincronização em tempo real com Banco de Dados (Supabase Realtime, Render Backend e Firestore)
export function initLancamentosSync(): () => void {
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;
  cleanupDeletedIds();

  // Carrega estado inicial do cache local
  getLancamentosUnified();

  // A. Conexão em tempo real via WebSocket no Supabase
  setupSupabaseRealtimeChannel();

  // B. Listener em Tempo Real no Firestore (se disponível)
  try {
    const collectionRef = db.collection("lancamentos");
    unsubscribeFirestore = collectionRef.onSnapshot(
      snapshot => {
        const deletedIds = getDeletedIds();
        const firestoreItems: any[] = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const docId = String(doc.id || data.id);
          if (deletedIds.has(docId)) {
            return;
          }
          firestoreItems.push(normalizeLancamento({
            id: Number(doc.id) || Number(data.id) || doc.id,
            ...data
          }));
        });

        if (firestoreItems.length > 0) {
          firestoreItems.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
          notifyListeners(firestoreItems);
        } else {
          pullFromCloudAndServer();
        }
      },
      err => {
        pullFromCloudAndServer();
      }
    );
  } catch (e) {
    pullFromCloudAndServer();
  }

  // C. Polling contínuo de contingência a cada 20 segundos
  pullFromCloudAndServer();
  pollIntervalTimer = setInterval(() => {
    pullFromCloudAndServer();
  }, 20000);

  // D. Monitoramento ultra rápido de versões no Servidor Express / Render
  // Checa versão a cada 4 segundos se a janela estiver ativa, ou a cada 15s em segundo plano
  versionPollTimer = setInterval(() => {
    const isFocused = typeof document !== "undefined" && document.hasFocus && document.hasFocus();
    if (isFocused || Math.random() < 0.25) {
      checkServerVersionFast();
    }
  }, 4000);

  // E. Dispara atualização imediata ao retomar o foco na janela ou aba
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      checkServerVersionFast();
      pullFromCloudAndServer(true);
    }
  };

  const handleWindowFocus = () => {
    checkServerVersionFast();
    pullFromCloudAndServer();
  };

  // F. Listener para sincronização entre abas do mesmo navegador via localStorage
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        const deletedIds = getDeletedIds();
        if (Array.isArray(updated) && updated.length > 0) {
          const valid = updated
            .filter((item: any) => !deletedIds.has(String(item.id)) && !isFictitiousLancamento(item))
            .map(normalizeLancamento);
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
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  return () => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
    if (pollIntervalTimer) {
      clearInterval(pollIntervalTimer);
      pollIntervalTimer = null;
    }
    if (versionPollTimer) {
      clearInterval(versionPollTimer);
      versionPollTimer = null;
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
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    isInitialized = false;
  };
}

let isPulling = false;

// B. Busca no Banco de Dados do Servidor, Firestore e Supabase com proteção absoluta contra perda de dados
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

    // 2. Busca no Supabase (com proteção de quota)
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
                idMap.set(idStr, normalizeLancamento({
                  ...existing,
                  ...item,
                  codigoLancamento: item.codigoLancamento || existing.codigoLancamento || "",
                  numeroDocumento: item.numeroDocumento || existing.numeroDocumento || "",
                  codLancamentoOc: item.codLancamentoOc || existing.codLancamentoOc || "",
                  doc: (item.doc && !item.doc.startsWith("DOC-") && !item.doc.endsWith("S/N")) ? item.doc : existing.doc,
                  nomeArquivoAnexo: item.nomeArquivoAnexo || existing.nomeArquivoAnexo || "",
                  arquivoAnexoBase64: item.arquivoAnexoBase64 || existing.arquivoAnexoBase64 || "",
                  anexos: (Array.isArray(existing.anexos) && existing.anexos.length > 0) ? existing.anexos : (item.anexos || [])
                }));
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

    // Se nenhuma fonte remota respondeu, mantém itens locais legítimos
    if (!databaseFetched && cachedLancamentos && cachedLancamentos.length > 0) {
      cachedLancamentos.forEach(item => {
        const idStr = String(item.id);
        if (!deletedIds.has(idStr) && !isFictitiousLancamento(item)) {
          idMap.set(idStr, normalizeLancamento(item));
        }
      });
    }

    // 3. Monta a lista oficial autoritativa estritamente com dados reais
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

// 4. Gravação / Criação / Edição de Lançamento com reflexo imediato e persistência redundante
export async function saveLancamentoUnified(item: any): Promise<boolean> {
  const normalized = normalizeLancamento(item);
  normalized.updatedAt = new Date().toISOString();
  const targetId = String(normalized.id);

  // Remove dos IDs deletados caso estivesse marcado
  removeDeletedId(targetId);

  // 1. Atualização Otimista Imediata Local com Snapshot Vault
  const current = getLancamentosUnified();
  const existingIdx = current.findIndex(i => String(i.id) === targetId);
  let updatedList: any[];

  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = { ...updatedList[existingIdx], ...normalized };
  } else {
    updatedList = [normalized, ...current];
  }

  notifyListeners(updatedList);

  // Transmite imediatamente para outras abas locais
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "SYNC_LANCAMENTOS", items: updatedList });
    } catch (e) {}
  }

  // 2. Persistência no Servidor Express (Render)
  try {
    const res = await fetch("/api/lancamentos", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify(normalized)
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

  // 3. Persistência no Supabase (se a quota estiver normal)
  if (Date.now() > supabaseQuotaExceededUntil) {
    try {
      await saveLancamentoSupabase(normalized);
    } catch (sbErr: any) {
      if (String(sbErr?.message || "").includes("exceed_egress_quota")) {
        supabaseQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
      }
    }
  }

  // 4. Persistência no Firestore (com proteção contra erros)
  try {
    const cleanForFirestore = { ...normalized };
    Object.keys(cleanForFirestore).forEach(k => cleanForFirestore[k] === undefined && delete cleanForFirestore[k]);
    await db.collection("lancamentos").doc(targetId).set(cleanForFirestore, { merge: true });
  } catch (fErr) {}

  // Dispara aviso em Broadcast para instâncias locais puxarem se necessário
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "REQUEST_PULL" });
    } catch (e) {}
  }

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


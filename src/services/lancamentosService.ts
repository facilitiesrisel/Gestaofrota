import { db } from "../firebaseConfig";
import { 
  fetchLancamentosSupabase, 
  saveLancamentoSupabase, 
  deleteLancamentoSupabase 
} from "./supabaseService";

// Evento customizado para notificar todos os componentes do sistema na mesma janela/abas
const SYNC_EVENT = "risel_lancamentos_sync_event";
const STORAGE_KEY = "risel_lancamentos";
const DELETED_IDS_KEY = "risel_lancamentos_deleted_ids";

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

// Normaliza um registro de lançamento para manter consistência nos campos
export function normalizeLancamento(item: any): any {
  const rawId = item.id;
  const numId = Number(rawId);
  const cleanId = !isNaN(numId) && numId > 0 ? numId : rawId;

  // Extrai Cód. Lançamento / Nº OC
  let codOc = item.codLancamentoOc || item.codigoLancamento || item.codigo_lancamento || "";
  let centCusto = item.centroCusto || item.centro_custo || "C.C 101 - Operacional";
  let alcada = item.aprovadores || "";
  let baseFilial = item.estabelecimento || "";

  if (item.observacao) {
    const ocMatch = String(item.observacao).match(/\[OC\/CÓD:\s*([^\]]+)\]/i);
    if (ocMatch && ocMatch[1] && !codOc) {
      codOc = ocMatch[1].trim();
    }
    const ccMatch = String(item.observacao).match(/\[CENTRO DE CUSTO:\s*([^\]]+)\]/i);
    if (ccMatch && ccMatch[1] && (!item.centroCusto || item.centroCusto === "C.C 101 - Operacional")) {
      centCusto = ccMatch[1].trim();
    }
    const alcadaMatch = String(item.observacao).match(/\[ALÇADA:\s*([^\]]+)\]/i);
    if (alcadaMatch && alcadaMatch[1] && !alcada) {
      alcada = alcadaMatch[1].trim();
    }
    const baseMatch = String(item.observacao).match(/\[BASE:\s*([^\]]+)\]/i);
    if (baseMatch && baseMatch[1] && !baseFilial) {
      baseFilial = baseMatch[1].trim();
    }
  }

  return {
    ...item,
    id: cleanId,
    codLancamentoOc: codOc,
    codigoLancamento: codOc || item.doc || "",
    centroCusto: centCusto,
    aprovadores: alcada || item.aprovadores || "Deny e Gerência",
    estabelecimento: baseFilial || item.estabelecimento || "100 - Paulínia",
    status: item.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (item.status || "Aguardando Aprovação"),
    doc: item.doc || (codOc ? `DOC-${codOc}` : `DOC-${cleanId}`),
    fornecedor: item.fornecedor || "Fornecedor Não Informado"
  };
}

// Dispara notificação para todos os ouvintes ativos
function notifyListeners(items: any[]) {
  cachedLancamentos = items;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
  }
}

// 1. Obter lançamentos atuais em memória ou do storage
export function getLancamentosUnified(): any[] {
  if (cachedLancamentos && cachedLancamentos.length > 0) {
    return cachedLancamentos;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const deletedIds = getDeletedIds();
      cachedLancamentos = parsed
        .filter((item: any) => !deletedIds.has(String(item.id)))
        .map(normalizeLancamento);
      return cachedLancamentos;
    }
  } catch (e) {}
  return [];
}

// 2. Iniciar sincronização em tempo real (Firestore, Servidor com Polling e Supabase)
export function initLancamentosSync(): () => void {
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;
  cleanupDeletedIds();

  // Carrega estado inicial do cache
  getLancamentosUnified();

  // A. Listener em Tempo Real no Firestore (para clientes conectados)
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
          // Se snapshot vier vazio, sincroniza com servidor backend e Supabase
          pullFromCloudAndServer();
        }
      },
      err => {
        console.warn("[LancamentosSync] Listener Firestore pausado, operando com sincronização contínua:", err.message);
        pullFromCloudAndServer();
      }
    );
  } catch (e) {
    console.warn("[LancamentosSync] Erro ao instanciar Firestore:", e);
    pullFromCloudAndServer();
  }

  // B. Polling em Tempo Real a cada 4 segundos com o Servidor e Supabase
  // Isso garante que QUALQUER alteração, inclusão ou exclusão feita por outro usuário
  // apareça na tela de todos os computadores instantaneamente!
  pullFromCloudAndServer();
  pollIntervalTimer = setInterval(() => {
    pullFromCloudAndServer();
  }, 4000);

  // C. Dispara atualização imediata ao retomar o foco na janela
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      pullFromCloudAndServer();
    }
  };

  // D. Listener para sincronização entre abas do mesmo navegador
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        const deletedIds = getDeletedIds();
        cachedLancamentos = updated
          .filter((item: any) => !deletedIds.has(String(item.id)))
          .map(normalizeLancamento);
        notifyListeners(cachedLancamentos);
      } catch (err) {}
    }
  };

  const handleCustomSync = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      cachedLancamentos = e.detail;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(SYNC_EVENT, handleCustomSync);
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
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(SYNC_EVENT, handleCustomSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    isInitialized = false;
  };
}

let isPulling = false;

// B. Busca no Servidor e Supabase para sincronização autoritativa global
export async function pullFromCloudAndServer(): Promise<any[]> {
  if (isPulling) return cachedLancamentos;
  isPulling = true;

  try {
    let deletedIds = getDeletedIds();
    const idMap = new Map<string, any>();
    let serverSuccess = false;

    // 1. Busca no Servidor backend (/api/lancamentos)
    try {
      const res = await fetch("/api/lancamentos");
      if (res.ok) {
        const data = await res.json();
        serverSuccess = true;

        // Se o servidor retornou IDs deletados, sincroniza com o conjunto local
        if (data.deletedIds && Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: any) => addDeletedId(id));
          deletedIds = getDeletedIds();
        }

        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const idStr = String(item.id);
            if (!deletedIds.has(idStr)) {
              idMap.set(idStr, normalizeLancamento(item));
            }
          });
        }
      }
    } catch (e) {
      console.warn("[LancamentosSync] Falha ao consultar backend /api/lancamentos:", e);
    }

    // 2. Busca no Supabase
    try {
      const supaItems = await fetchLancamentosSupabase();
      if (Array.isArray(supaItems) && supaItems.length > 0) {
        supaItems.forEach(item => {
          const idStr = String(item.id);
          if (!deletedIds.has(idStr)) {
            const existing = idMap.get(idStr);
            idMap.set(idStr, normalizeLancamento({ ...existing, ...item }));
          }
        });
      }
    } catch (e) {
      console.warn("[LancamentosSync] Falha ao consultar Supabase:", e);
    }

    // 3. Monta a lista oficial autoritativa
    const freshItems = Array.from(idMap.values())
      .filter(item => !deletedIds.has(String(item.id)))
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    // Se houve sucesso no servidor ou no Supabase, a lista oficial substitui o cache local
    if (serverSuccess || freshItems.length > 0) {
      // Verifica se houve alguma alteração em relação ao cache atual
      const currentCacheStr = JSON.stringify(cachedLancamentos.map(i => i.id));
      const freshStr = JSON.stringify(freshItems.map(i => i.id));
      
      if (currentCacheStr !== freshStr || cachedLancamentos.length !== freshItems.length) {
        notifyListeners(freshItems);
      }
    }

    return freshItems;
  } finally {
    isPulling = false;
  }
}

// Força sincronização imediata manual
export async function forceSyncLancamentos(): Promise<any[]> {
  return await pullFromCloudAndServer();
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

// 4. Gravação / Criação / Edição de Lançamento com reflexo imediato para todos os usuários
export async function saveLancamentoUnified(item: any): Promise<boolean> {
  const normalized = normalizeLancamento(item);
  const targetId = String(normalized.id);

  // Remove dos IDs deletados caso estivesse marcado
  removeDeletedId(targetId);

  // 1. Atualização Otimista Imediata Local
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

  // 2. Persistência no Servidor Express (compartilha instantaneamente com todos os usuários via polling e API)
  try {
    await fetch("/api/lancamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized)
    });
  } catch (sErr) {
    console.warn("[LancamentosSync] Erro ao salvar no Servidor:", sErr);
  }

  // 3. Persistência no Banco Supabase (nuvem relacional)
  try {
    await saveLancamentoSupabase(normalized);
  } catch (sbErr) {
    console.warn("[LancamentosSync] Erro ao salvar no Supabase:", sbErr);
  }

  // 4. Persistência no Firestore
  try {
    const cleanForFirestore = { ...normalized };
    Object.keys(cleanForFirestore).forEach(k => cleanForFirestore[k] === undefined && delete cleanForFirestore[k]);
    await db.collection("lancamentos").doc(targetId).set(cleanForFirestore, { merge: true });
  } catch (fErr) {
    console.warn("[LancamentosSync] Erro ao salvar no Firestore:", fErr);
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
  notifyListeners(updatedList);

  // 2. Exclusão no Servidor Express (salva nos excluídos do servidor para todos os outros usuários)
  try {
    await fetch(`/api/lancamentos/${idStr}`, { method: "DELETE" });
  } catch (sErr) {
    console.warn("[LancamentosSync] Erro ao excluir do Servidor:", sErr);
  }

  // 3. Exclusão no Banco Supabase
  try {
    await deleteLancamentoSupabase(id);
  } catch (sbErr) {
    console.warn("[LancamentosSync] Erro ao excluir do Supabase:", sbErr);
  }

  // 4. Exclusão no Firestore
  try {
    await db.collection("lancamentos").doc(idStr).delete();
  } catch (fErr) {
    console.warn("[LancamentosSync] Erro ao excluir do Firestore:", fErr);
  }

  return true;
}

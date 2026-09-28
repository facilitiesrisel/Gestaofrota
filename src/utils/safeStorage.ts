/**
 * safeStorage.ts - Gerenciador Seguro de Armazenamento para o Sistema Risel
 * Previne falhas críticas de QuotaExceededError (cota de 5MB do localStorage)
 * com limpeza automática de caches descartáveis, fallback de memória e sessionStorage.
 */

// Cache em memória para contingência absoluta
const memoryFallback = new Map<string, string>();

// Chaves consideradas puramente de cache descartável que podem ser expurgadas sem perda de dados de negócio
const DISPOSABLE_PREFIXES = [
  "risel_distance_",
  "risel_geocoding_",
  "risel_temp_",
  "osm_",
  "mapbox_"
];

const DISPOSABLE_KEYS = [
  "risel_admin_ai_chat",
  "risel_telemetry_alert_events_v2",
  "risel_telemetry_alert_events_v1",
  "risel_supabase_last_ping",
  "risel_supabase_ping_count",
  "risel_temp_state",
  "readOverdueNotifications"
];

/**
 * Calcula o tamanho aproximado do localStorage em bytes
 */
export function getLocalStorageSize(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || "";
        total += (key.length + val.length) * 2; // UTF-16
      }
    }
  } catch (e) {}
  return total;
}

/**
 * Executa limpeza emergencial de caches para liberar espaço imediatamente
 */
export function performStorageEmergencyEviction(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  let freedCount = 0;

  try {
    const keysToRemove: string[] = [];

    // 1. Identificar chaves com prefixo descartável
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (
        DISPOSABLE_PREFIXES.some(prefix => key.startsWith(prefix)) ||
        DISPOSABLE_KEYS.includes(key)
      ) {
        keysToRemove.push(key);
      }
    }

    // Remover chaves descartáveis
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
        freedCount++;
      } catch (e) {}
    });

    // 2. Se ainda estiver pesado, inspeciona e otimiza listas grandes
    // Otimiza vault de snapshot de lançamentos se estiver muito pesado (> 400KB)
    try {
      const snap = localStorage.getItem("risel_lancamentos_snapshot_vault");
      if (snap && snap.length > 400000) {
        const parsed = JSON.parse(snap);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((item: any) => {
            const { arquivoAnexoBase64, anexos, ...rest } = item;
            return rest;
          });
          localStorage.setItem("risel_lancamentos_snapshot_vault", JSON.stringify(cleaned));
        }
      }
    } catch (e) {
      try { localStorage.removeItem("risel_lancamentos_snapshot_vault"); } catch (_) {}
    }

    // 3. Otimiza histórico de abastecimentos ou manutenções caso contenham itens demais (> 200)
    try {
      const abast = localStorage.getItem("risel_frota_abastecimentos");
      if (abast && abast.length > 500000) {
        const parsed = JSON.parse(abast);
        if (Array.isArray(parsed) && parsed.length > 200) {
          localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(parsed.slice(0, 200)));
        }
      }
    } catch (e) {}

    console.info(`[SafeStorage] Limpeza emergencial concluída: ${freedCount} caches liberados.`);
  } catch (err) {
    console.warn("[SafeStorage] Erro durante limpeza emergencial:", err);
  }

  return freedCount;
}

/**
 * Higieniza objetos de veículos antes de salvar no localStorage
 * Garante que payloads pesados não estourem a cota de 5MB
 */
function sanitizeVehiclesForStorage(vehicles: any[]): any[] {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map(v => {
    if (!v || typeof v !== "object") return v;
    const { _raw, rawTelemetry, rawSheetRow, historicoPosicoes, ...clean } = v;
    return clean;
  });
}

/**
 * safeSetItem - Grava com proteção contra QuotaExceededError e fallback transparente
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;

  // Atualiza sempre a memória em caso de contingência
  memoryFallback.set(key, value);

  // Se o item for veiculos, garante higienização preventiva se for string JSON
  let processedValue = value;
  if (key === "risel_frota_veiculos_v2" && value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      processedValue = JSON.stringify(sanitizeVehiclesForStorage(parsed));
    } catch (e) {}
  }

  try {
    localStorage.setItem(key, processedValue);
    return true;
  } catch (err: any) {
    const isQuotaError = 
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err?.code === 22 ||
      err?.code === 1014 ||
      String(err?.message || "").toLowerCase().includes("quota") ||
      String(err || "").toLowerCase().includes("exceeded the quota");

    if (isQuotaError) {
      console.warn(`[SafeStorage] Cota do localStorage excedida ao salvar "${key}". Iniciando limpeza automática...`);
      performStorageEmergencyEviction();

      try {
        localStorage.setItem(key, processedValue);
        return true;
      } catch (retryErr) {
        console.warn(`[SafeStorage] Segunda tentativa de salvar "${key}" no localStorage falhou. Usando sessionStorage e memória.`);
        try {
          sessionStorage.setItem(key, processedValue);
        } catch (sErr) {}
        return false;
      }
    } else {
      console.warn(`[SafeStorage] Falha ao gravar "${key}":`, err);
      try {
        sessionStorage.setItem(key, processedValue);
      } catch (sErr) {}
      return false;
    }
  }
}

/**
 * safeGetItem - Recupera valor do localStorage com fallback para sessionStorage e memória
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal !== null) return fromLocal;
  } catch (e) {}

  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession !== null) return fromSession;
  } catch (e) {}

  return memoryFallback.get(key) || null;
}

/**
 * safeRemoveItem - Remove de todos os storages
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;

  try { localStorage.removeItem(key); } catch (e) {}
  try { sessionStorage.removeItem(key); } catch (e) {}
  memoryFallback.delete(key);
}

/**
 * Executa checagem proativa no início da aplicação
 * Se o uso estiver acima de ~3.2MB (de 5MB), executa limpeza automática preventiva
 */
export function cleanStorageHealthCheck() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const totalBytes = getLocalStorageSize();
    // 3.2 MB = 3,355,443 bytes
    if (totalBytes > 3200000) {
      console.info(`[SafeStorage] Uso alto detectado (${(totalBytes / (1024 * 1024)).toFixed(2)} MB). Otimizando armazenamento...`);
      performStorageEmergencyEviction();
    }
  } catch (e) {}
}

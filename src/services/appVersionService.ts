/**
 * Serviço de Verificação e Sincronização de Versão para o Sistema Risel
 * Garante que todos os usuários em qualquer dispositivo ou filial recebam as atualizações
 * mais recentes do Render imediatamente, sem ficarem travados em caches antigos do navegador.
 */

import { performStorageEmergencyEviction } from "../utils/safeStorage";

let initialVersion: string | null = null;
let isChecking = false;
let updateTriggered = false;

export async function checkServerVersion(): Promise<{ updated: boolean; version?: string }> {
  if (updateTriggered || isChecking) return { updated: false };
  isChecking = true;

  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) {
      return { updated: false };
    }

    const data = await res.json();
    const serverVer = data.version || data.serverStart;

    if (!initialVersion) {
      initialVersion = serverVer;
      return { updated: false, version: serverVer };
    }

    if (serverVer && initialVersion && serverVer !== initialVersion) {
      // Nova versão detectada no Render!
      updateTriggered = true;
      return { updated: true, version: serverVer };
    }

    return { updated: false, version: serverVer };
  } catch (err) {
    return { updated: false };
  } finally {
    isChecking = false;
  }
}

/**
 * Limpa todos os caches e recarrega a aplicação com garantia de atualização
 */
export async function forceHardReload() {
  try {
    // 1. Limpa excedentes do localStorage para evitar QuotaExceededError no recarregamento
    performStorageEmergencyEviction();

    // 2. Desregistra Service Workers se houver
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    // 3. Limpa caches de requisições HTTP
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    sessionStorage.clear();
  } catch (e) {
    console.warn("Aviso ao limpar caches:", e);
  }

  // 4. Executa recarregamento forçado com substituição de histórico
  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.set('_v', Date.now().toString());
    window.location.replace(cleanUrl.toString());
  } catch (e) {
    window.location.reload();
  }
}

// Expõe no escopo global para suporte técnico e debug
if (typeof window !== 'undefined') {
  (window as any).__forcarAtualizacaoRisel = forceHardReload;
}

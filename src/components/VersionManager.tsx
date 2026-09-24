import React, { useEffect, useState } from "react";
import { checkServerVersion, forceHardReload } from "../services/appVersionService";
import { RefreshCw, CheckCircle2 } from "lucide-react";

export const VersionManager: React.FC = () => {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const isUserBusyEditing = () => {
    try {
      return (
        localStorage.getItem("risel_is_editing_lancamento") === "true" ||
        sessionStorage.getItem("risel_is_editing_lancamento") === "true"
      );
    } catch (e) {
      return false;
    }
  };

  const handleApplyUpdate = () => {
    setIsReloading(true);
    forceHardReload();
  };

  useEffect(() => {
    // 1. Checagem inicial ao carregar o componente
    checkServerVersion();

    // 2. Checagem periódica a cada 20 segundos
    const interval = setInterval(async () => {
      const { updated } = await checkServerVersion();
      if (updated) {
        setHasNewVersion(true);
        // Se o usuário estiver preenchendo um formulário, NÃO recarrega automaticamente
        if (!isUserBusyEditing()) {
          setTimeout(() => {
            if (!isUserBusyEditing()) {
              setIsReloading(true);
              forceHardReload();
            }
          }, 2000);
        }
      }
    }, 20000);

    // 3. Checagem quando o usuário volta para a aba da Risel
    const handleFocus = async () => {
      const { updated } = await checkServerVersion();
      if (updated) {
        setHasNewVersion(true);
        // Se o usuário estiver no meio de um lançamento, preserva a tela intacta
        if (!isUserBusyEditing()) {
          setTimeout(() => {
            if (!isUserBusyEditing()) {
              setIsReloading(true);
              forceHardReload();
            }
          }, 1500);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (hasNewVersion || isReloading) {
    const isBusy = isUserBusyEditing();

    return (
      <div 
        id="risel-version-update-banner"
        className="fixed bottom-4 right-4 z-9999 max-w-md bg-emerald-950 text-white p-4 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300"
      >
        <div className="flex items-center gap-3">
          <RefreshCw className={`w-5 h-5 text-emerald-400 shrink-0 ${isReloading ? "animate-spin" : ""}`} />
          <div className="text-xs text-left">
            <p className="font-bold text-white">Nova versão detectada!</p>
            <p className="text-emerald-200/90 text-[11px]">
              {isBusy
                ? "Conclua seu lançamento. Você pode atualizar quando finalizar."
                : isReloading
                ? "Sincronizando tela e atualizando sistema..."
                : "Atualizando sistema em instantes..."}
            </p>
          </div>
        </div>

        {isBusy && !isReloading && (
          <button
            type="button"
            onClick={handleApplyUpdate}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            Atualizar agora
          </button>
        )}
      </div>
    );
  }

  return null;
};

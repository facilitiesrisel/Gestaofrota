import React, { useEffect, useState } from "react";
import { checkServerVersion, forceHardReload } from "../services/appVersionService";
import { RefreshCw, CheckCircle2 } from "lucide-react";

export const VersionManager: React.FC = () => {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // 1. Checagem inicial ao carregar o componente
    checkServerVersion();

    // 2. Checagem periódica a cada 20 segundos
    const interval = setInterval(async () => {
      const { updated } = await checkServerVersion();
      if (updated) {
        setHasNewVersion(true);
        // Recarrega automaticamente após 1.5s
        setTimeout(() => {
          setIsReloading(true);
          forceHardReload();
        }, 1500);
      }
    }, 20000);

    // 3. Checagem imediata quando o usuário volta para a aba da Risel
    const handleFocus = async () => {
      const { updated } = await checkServerVersion();
      if (updated) {
        setHasNewVersion(true);
        setTimeout(() => {
          setIsReloading(true);
          forceHardReload();
        }, 1200);
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
    return (
      <div 
        id="risel-version-update-banner"
        className="fixed bottom-4 right-4 z-9999 max-w-sm bg-emerald-950 text-white p-4 rounded-xl shadow-2xl border border-emerald-500/30 flex items-center gap-3 animate-bounce"
      >
        <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
        <div className="text-xs">
          <p className="font-bold text-white">Nova versão detectada!</p>
          <p className="text-emerald-200/80 text-[11px]">Sincronizando tela e atualizando para todos os usuários...</p>
        </div>
      </div>
    );
  }

  return null;
};

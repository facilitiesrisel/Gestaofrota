import React, { useState, useEffect } from "react";

interface Props {
  children: React.ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Global error caught by Risel Boundary:", event.error || event.message);
      // Ignora erros conhecidos inofensivos de extensões ou terceiros
      if (event.message && (
        event.message.includes("ResizeObserver") ||
        event.message.includes("extension") ||
        event.message.includes("clarity")
      )) {
        return;
      }
      setHasError(true);
      setErrorMessage(event.message || "Erro de execução no navegador.");
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection caught by Risel Boundary:", event.reason);
      const reasonStr = String(event.reason?.message || event.reason || "");
      if (reasonStr.includes("ResizeObserver") || reasonStr.includes("extension")) {
        return;
      }
      // Não bloqueia a tela se for rejeição de rede em segundo plano
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center space-x-3 text-amber-400">
            <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold">Risel ERP - Recuperação de Sistema</h2>
          </div>
          
          <p className="text-sm text-slate-300">
            Ocorreu uma falha inesperada durante a inicialização de um componente.
          </p>

          {errorMessage && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-red-400 font-mono overflow-auto max-h-36">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-4 rounded-xl text-sm transition-colors"
            >
              Recarregar Página
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-xl text-sm transition-colors"
            >
              Ir para o Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

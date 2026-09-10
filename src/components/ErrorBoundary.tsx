import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary oficial do Risel ERP.
 * Implementado como React Class Component conforme especificações do React,
 * capturando estritamente falhas críticas na árvore de renderização sem
 * interceptar requisições de rede, avisos de terceiros ou eventos de janela normais.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Risel ERP] Erro crítico de renderização:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      // Limpa dados transitórios preservando sessões principais se possível
      sessionStorage.clear();
      localStorage.removeItem("risel_temp_state");
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="risel-error-boundary-screen" className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-emerald-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Risel ERP - Recuperação Rápida</h2>
                <p className="text-xs text-slate-500">O sistema encontrou uma oscilação temporária na interface.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você pode tentar retomar a tela imediatamente ou recarregar para restabelecer a conexão com os servidores.
            </p>

            {this.state.error && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-mono overflow-auto max-h-28">
                {this.state.error.toString()}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <button
                id="btn-retry-boundary"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-1.5 bg-[#114D38] hover:bg-[#0c3728] text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tentar de novo
              </button>

              <button
                id="btn-reload-boundary"
                onClick={this.handleHardReload}
                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs border border-slate-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar
              </button>

              <button
                id="btn-home-boundary"
                onClick={this.handleClearCacheAndReload}
                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs border border-slate-300 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

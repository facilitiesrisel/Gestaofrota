import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Calendar, ShieldCheck, Copy, Check, Car, ClipboardList, MapPin, Lock, FileText, ArrowLeft, Home } from "lucide-react";
import { ReservaSubmoduleContainer } from "../components/reserva/ReservaSubmoduleContainer";

export default function ReservaPublica({ initialView }: { initialView?: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const activeSub = searchParams.get("sub") || initialView || "request";

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/reservas`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSwitchTab = (viewId: string) => {
    setSearchParams({ sub: viewId });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Header Institucional Limpo e Exclusivo (Sem menus de outros módulos do ERP) */}
      <header className="bg-gradient-to-r from-[#114D38] via-[#0d3d2c] to-[#07241a] text-white py-3.5 px-4 sm:px-6 shadow-md border-b-4 border-[#F47920] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Marca / Identidade */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              title="Voltar à tela anterior"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 text-xs font-bold shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-white/10 p-0.5 shadow-inner shrink-0 flex items-center justify-center">
              <img
                src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg"
                alt="Risel Combustíveis"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase font-display text-white leading-none">
                  Risel Combustíveis
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-800/80 text-emerald-200 border border-emerald-500/30 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                  Portal Público
                </span>
              </div>
              <p className="text-[11px] text-emerald-300 font-bold uppercase tracking-wide mt-0.5">
                Reserva & Gestão de Veículos
              </p>
            </div>
          </div>

          {/* Ações Rápidas: Copiar Link Exclusivo & Área Administrativa */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copiar link direto para envio aos colaboradores"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-extrabold text-white transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-orange-400" />
                  <span className="hidden sm:inline">Copiar Link do Portal</span>
                  <span className="sm:hidden">Copiar Link</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleSwitchTab('login')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                activeSub === 'login'
                  ? 'bg-[#F47920] text-white shadow-xs'
                  : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/30'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Área Administrativa</span>
              <span className="md:hidden">Admin</span>
            </button>
          </div>
        </div>

        {/* Abas de Navegação em Telas Grandes (Desktop) */}
        <div className="hidden md:block max-w-6xl mx-auto mt-3 pt-2.5 border-t border-emerald-800/60">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'request', label: 'Solicitar Reserva (Frota Leve)', icon: FileText },
              { id: 'racRequest', label: 'Solicitar Locação RAC (Terceirizado)', icon: Car },
              { id: 'dailyUse', label: 'Uso Diário (Diário de Bordo)', icon: ClipboardList },
              { id: 'fleetStatus', label: 'Status da Frota', icon: MapPin },
            ].map(tab => {
              const isActive = activeSub === tab.id || (tab.id === 'racRequest' && (activeSub === 'rac' || activeSub === 'rac_request'));
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-white text-[#114D38] shadow-sm'
                      : 'text-emerald-100/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#114D38]' : tab.id === 'racRequest' ? 'text-amber-300' : 'text-emerald-300'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal 100% isolado de outros módulos */}
      <main className="flex-1 w-full flex flex-col min-h-0">
        <ReservaSubmoduleContainer forcePublic={true} />
      </main>

      {/* Rodapé Institucional Simples */}
      <footer className="bg-white border-t border-slate-200 text-slate-500 text-[10px] font-bold py-4 text-center select-none hidden md:block">
        <p className="uppercase tracking-wider">
          &copy; {new Date().getFullYear()} Risel Combustíveis &bull; Sistema de Gestão de Frota Leve &bull; Link Direto: <span className="text-emerald-700 font-mono">/reservas</span>
        </p>
      </footer>
    </div>
  );
}

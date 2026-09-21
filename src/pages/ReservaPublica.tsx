import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Copy, Check, Car, ClipboardList, MapPin, FileText, ArrowLeft } from "lucide-react";
import { ReservaSubmoduleContainer } from "../components/reserva/ReservaSubmoduleContainer";

export default function ReservaPublica({ initialView }: { initialView?: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  // Monitora viagem em andamento salva no dispositivo do condutor
  const [pendingTrip, setPendingTrip] = useState<{ id: string; plate?: string; driverName?: string; model?: string } | null>(() => {
    try {
      const id = localStorage.getItem('activeDailyTripId');
      const rawData = localStorage.getItem('activeDailyTripData');
      if (id && rawData) {
        return JSON.parse(rawData);
      }
      if (id) {
        return { id };
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    const checkPending = () => {
      try {
        const id = localStorage.getItem('activeDailyTripId');
        const rawData = localStorage.getItem('activeDailyTripData');
        if (id && rawData) {
          setPendingTrip(JSON.parse(rawData));
        } else if (id) {
          setPendingTrip({ id });
        } else {
          setPendingTrip(null);
        }
      } catch (e) {
        setPendingTrip(null);
      }
    };

    window.addEventListener('storage', checkPending);
    window.addEventListener('risel_daily_trip_updated', checkPending);
    return () => {
      window.removeEventListener('storage', checkPending);
      window.removeEventListener('risel_daily_trip_updated', checkPending);
    };
  }, []);

  const urlSub = searchParams.get("sub");

  // Bloqueio rigoroso: se vier sub=login ou sub=admin na rota pública, redireciona imediatamente para tela pública
  useEffect(() => {
    if (urlSub === 'login' || urlSub === 'admin') {
      setSearchParams({ sub: 'request' }, { replace: true });
    }
  }, [urlSub, setSearchParams]);

  // Se o condutor abrir o link no celular e tiver viagem de uso diário em andamento, abre direto em 'dailyUse'
  const defaultSub = pendingTrip?.id ? "dailyUse" : (initialView || "request");
  const activeSub = (urlSub && urlSub !== 'login' && urlSub !== 'admin') ? urlSub : defaultSub;

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/reservas`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSwitchTab = (viewId: string) => {
    // Proíbe chavear para login/admin no acesso público
    if (viewId === 'login' || viewId === 'admin') {
      return;
    }
    setSearchParams({ sub: viewId });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Header Institucional Limpo e Exclusivo (Sem menus ou acessos administrativos) */}
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
              </div>
              <p className="text-[11px] text-emerald-300 font-bold uppercase tracking-wide mt-0.5">
                Reserva & Gestão de Veículos
              </p>
            </div>
          </div>

          {/* Botão de Compartilhar Link Público */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copiar link público das reservas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="hidden sm:inline">Copiar Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Abas de Navegação Responsivas (Mobile & Desktop) */}
        <div className="max-w-6xl mx-auto mt-2.5 pt-2 border-t border-emerald-800/70 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 pb-0.5 min-w-max">
            {[
              { id: 'request', label: 'Frota Leve', fullLabel: 'Solicitar Reserva (Frota Leve)', icon: FileText },
              { id: 'racRequest', label: 'Veículo Locado', fullLabel: 'Solicitar Veículo Locado', icon: Car },
              { id: 'dailyUse', label: 'Uso Diário', fullLabel: 'Uso Diário (Diário de Bordo)', icon: ClipboardList },
              { id: 'fleetStatus', label: 'Status Frota', fullLabel: 'Status da Frota', icon: MapPin },
            ].map(tab => {
              const isActive = activeSub === tab.id || (tab.id === 'racRequest' && (activeSub === 'rac' || activeSub === 'rac_request'));
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none active:scale-95 ${
                    isActive
                      ? 'bg-white text-[#005C30] shadow-md ring-2 ring-[#F47920]'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-100 border border-emerald-700/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#005C30]' : tab.id === 'racRequest' ? 'text-amber-300' : 'text-emerald-300'}`} />
                  <span className="hidden sm:inline">{tab.fullLabel}</span>
                  <span className="sm:hidden">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* BANNER FIXO INTELIGENTE: Alerta quando o usuário possui viagem de Uso Diário em andamento */}
      {pendingTrip && (
        <div className="bg-gradient-to-r from-amber-500 via-[#F47920] to-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sticky top-[108px] z-40 border-b border-orange-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="font-black tracking-wide truncate">
              Viagem em Andamento: {pendingTrip.plate || 'Veículo em Trânsito'} {pendingTrip.driverName ? `• ${pendingTrip.driverName}` : ''}
            </span>
            <span className="hidden md:inline text-amber-100 text-[11px] font-medium">
              (Preencha o KM Final e Nível do Combustível para concluir a devolução)
            </span>
          </div>
          <button
            onClick={() => handleSwitchTab('dailyUse')}
            className="px-3.5 py-1.5 bg-white text-[#114D38] hover:bg-amber-50 font-black rounded-lg shadow-sm text-[11px] uppercase tracking-wider shrink-0 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5 text-[#F47920]" />
            <span>Finalizar Viagem</span>
          </button>
        </div>
      )}

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

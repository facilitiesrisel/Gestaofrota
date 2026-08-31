import React, { useState, useEffect } from 'react';
import { mapQuotaService, MapQuotaState } from '../../services/mapQuotaService';
import { ShieldCheck, AlertTriangle, RefreshCw, Layers, Check, Settings2, Info } from 'lucide-react';

interface MapQuotaIndicatorProps {
  compact?: boolean;
  className?: string;
}

export const MapQuotaIndicator: React.FC<MapQuotaIndicatorProps> = ({ compact = false, className = '' }) => {
  const [quotaState, setQuotaState] = useState<MapQuotaState>(() => mapQuotaService.getState());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Registra uso ao montar o mapa
    mapQuotaService.recordMapUsage(1);
    const unsubscribe = mapQuotaService.subscribe((newState) => {
      setQuotaState(newState);
    });
    return () => unsubscribe();
  }, []);

  const usagePercent = Math.min(100, Math.round((quotaState.requestsThisMonth / quotaState.monthlyLimit) * 100));
  const isNearLimit = usagePercent >= 80;
  const isOverThreshold = quotaState.isFallbackActive || usagePercent >= quotaState.thresholdPercent;

  if (compact) {
    return (
      <div className={`relative z-20 ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all shadow-xs cursor-pointer ${
            isOverThreshold
              ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
              : isNearLimit
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-slate-900/90 backdrop-blur text-white border-slate-700 hover:bg-slate-800'
          }`}
          title="Clique para ver o controle de cota e proteção sem custo"
        >
          {isOverThreshold ? (
            <AlertTriangle className="w-3 h-3 text-white" />
          ) : (
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          )}
          <span>
            {quotaState.activeProviderName} • {usagePercent}% Cota
          </span>
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 text-left text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black text-slate-900">Proteção de Cota Zero Custo</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-[11px]">
              <div>
                <div className="flex justify-between font-bold text-slate-600 mb-1">
                  <span>Uso da Cota Mensal ({quotaState.currentMonth})</span>
                  <span className={isOverThreshold ? 'text-amber-600' : 'text-emerald-700'}>{usagePercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverThreshold ? 'bg-amber-500' : isNearLimit ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                  <span>{quotaState.requestsThisMonth.toLocaleString('pt-BR')} reqs</span>
                  <span>Limite seguro: {quotaState.monthlyLimit.toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border text-[10px] leading-relaxed ${
                isOverThreshold
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}>
                {isOverThreshold ? (
                  <p>
                    <strong className="block font-bold mb-0.5">Failover Mapbox Ativo (90%+ atingido):</strong>
                    O sistema migrou automaticamente para o Mapbox em Português do Brasil para garantir que não haja cobrança no Google Cloud.
                  </p>
                ) : (
                  <p>
                    <strong className="block font-bold mb-0.5">Google Maps Ativo (Sem Custo):</strong>
                    Operando na cota gratuita. Ao atingir 90% de consumo, o failover para o Mapbox será acionado automaticamente.
                  </p>
                )}
              </div>

              {/* Seletor Manual de Modo */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Modo de Operação
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => mapQuotaService.setForcedProvider('auto')}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-black transition-all ${
                      quotaState.forcedProvider === 'auto'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Automático
                  </button>
                  <button
                    type="button"
                    onClick={() => mapQuotaService.setForcedProvider('google')}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-black transition-all ${
                      quotaState.forcedProvider === 'google'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => mapQuotaService.setForcedProvider('mapbox')}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-black transition-all ${
                      quotaState.forcedProvider === 'mapbox'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Mapbox
                  </button>
                </div>
              </div>

              {/* Ações de Teste e Reset */}
              <div className="flex justify-between items-center pt-1 text-[9px]">
                <button
                  type="button"
                  onClick={() => mapQuotaService.setSimulatedUsage(92)}
                  className="text-amber-700 hover:underline font-bold"
                >
                  Simular 92% (Testar Mapbox)
                </button>
                <button
                  type="button"
                  onClick={() => mapQuotaService.resetUsage()}
                  className="text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  Zerar Cota
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white p-3 rounded-2xl border border-slate-200 shadow-xs text-left ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-xl ${isOverThreshold ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">
              Provedor de Mapa: <span className="text-emerald-700">{quotaState.activeProviderName}</span> (100% PT-BR)
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Controle de consumo com failover automático aos 90% para evitar cobranças
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
            isOverThreshold ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'
          }`}>
            {usagePercent}% da cota mensal usada
          </span>
        </div>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOverThreshold ? 'bg-amber-500' : isNearLimit ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </div>
  );
};

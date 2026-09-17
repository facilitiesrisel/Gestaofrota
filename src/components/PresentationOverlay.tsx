import React, { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Tv, 
  Clock, 
  Maximize2 
} from "lucide-react";
import { usePresentation } from "../context/PresentationContext";

export const PresentationOverlay: React.FC = () => {
  const { 
    isActive, 
    currentIndex, 
    timeLeft, 
    isPaused, 
    dashboards, 
    currentDashboard, 
    stopPresentation, 
    nextSlide, 
    prevSlide, 
    togglePause,
    jumpToSlide
  } = usePresentation();

  const [isVisible, setIsVisible] = useState(true);

  // Auto-ocultar a barra após 4 segundos sem mover o mouse
  useEffect(() => {
    if (!isActive) return;

    let timeoutId: any;

    const handleMouseMove = () => {
      setIsVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 4000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    timeoutId = setTimeout(() => setIsVisible(false), 4000);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [isActive]);

  if (!isActive) return null;

  // Formatar tempo mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Progresso de 0% a 100% dos 180 segundos
  const totalDuration = 180;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  return (
    <>
      {/* Barra de progresso ultra-fina fixa no topo absoluto da tela */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-black/40 z-[99999] pointer-events-none">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(16,185,129,0.8)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Barra de Controles Flutuante Superior */}
      <div 
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[99999] transition-all duration-300 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 bg-[#07110C]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-500/30 select-none">
          {/* Badge Apresentação */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700/60 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Tv className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Apresentação</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span className="text-[9px] font-bold text-slate-400">3 min por slide</span>
            </div>
          </div>

          {/* Nome do Dashboard Atual */}
          <div className="flex flex-col text-left max-w-[280px] sm:max-w-xs md:max-w-md truncate pr-3 border-r border-slate-700/60">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-300/80">
              {currentDashboard.module}
            </span>
            <span className="text-xs font-bold text-white truncate" title={currentDashboard.name}>
              {currentDashboard.name}
            </span>
          </div>

          {/* Controles de Slide */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Slide Anterior */}
            <button
              type="button"
              onClick={prevSlide}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Slide Anterior (Seta Esquerda)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Pausar / Continuar */}
            <button
              type="button"
              onClick={togglePause}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                isPaused 
                  ? "bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shadow-md" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              }`}
              title={isPaused ? "Retomar Apresentação (Barra de Espaço)" : "Pausar Tempo (Barra de Espaço)"}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>

            {/* Próximo Slide */}
            <button
              type="button"
              onClick={nextSlide}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Próximo Slide (Seta Direita)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Contador de Tempo e Slides */}
          <div className="flex items-center gap-2 px-2 shrink-0">
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatTime(timeLeft)}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {dashboards.length}
            </span>
          </div>

          {/* Botão Sair da Apresentação */}
          <button
            type="button"
            onClick={stopPresentation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-black text-xs transition-all shadow-md cursor-pointer border border-rose-400/40 shrink-0 ml-1 hover:scale-105 active:scale-95"
            title="Sair da apresentação e manter no dashboard atual (ESC)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Sair (ESC)</span>
          </button>
        </div>

        {/* Indicadores de slides clicáveis abaixo da barra */}
        <div className="flex items-center justify-center gap-1.5 mt-1.5">
          {dashboards.map((dash, idx) => (
            <button
              key={dash.id}
              type="button"
              onClick={() => jumpToSlide(idx)}
              className={`transition-all duration-200 rounded-full cursor-pointer ${
                idx === currentIndex
                  ? "w-6 h-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "w-2 h-1.5 bg-white/40 hover:bg-white/70"
              }`}
              title={`${idx + 1}. ${dash.name}`}
            />
          ))}
        </div>
      </div>
    </>
  );
};

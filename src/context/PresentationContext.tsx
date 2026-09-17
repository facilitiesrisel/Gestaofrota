import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface PresentationDashboard {
  id: string;
  name: string;
  module: string;
  path: string;
  description: string;
}

export const PRESENTATION_DASHBOARDS: PresentationDashboard[] = [
  {
    id: "documentos",
    name: "Dashboard de Documentos & Finanças",
    module: "Lançamento de Documentos",
    path: "/documentos/dashboard",
    description: "Visão consolidada de notas fiscais, faturas, alçadas de aprovação, custos e fluxo financeiro."
  },
  {
    id: "checklist",
    name: "Dashboard de Checklist Veicular",
    module: "Frota Leve • Checklist",
    path: "/frota?tab=checklist&sub=dashboard",
    description: "Inspeções e vistorias diárias, itens críticos com não-conformidades e status operacional."
  },
  {
    id: "reservas",
    name: "Dashboard Analítico de Reservas",
    module: "Frota Leve • Reservas",
    path: "/frota?tab=reservas&sub=dashboard",
    description: "Taxas de ocupação de veículos, requisições por departamento, diárias e locações RAC."
  },
  {
    id: "multas",
    name: "Dashboard de Gestão de Multas",
    module: "Frota Leve • Multas",
    path: "/frota?tab=multas&sub=dashboard",
    description: "Infrações por gravidade, veículos autuados, valores acumulados e ranking de condutores."
  },
  {
    id: "rastreamento",
    name: "Dashboard de Telemetria & Rastreamento",
    module: "Frota Leve • Rastreamento",
    path: "/frota?tab=rastreamento&sub=dashboard",
    description: "Monitoramento ao vivo de posições, ignições, limites de velocidade e telemetria veicular."
  },
  {
    id: "abastecimento",
    name: "Dashboard de Abastecimentos & Custos",
    module: "Frota Leve • Custos",
    path: "/frota?tab=frota&sub=custos&subtab=dashboard",
    description: "Consumo em litros, valores gastos com combustível, médias de KM/L e despesas por frota."
  },
  {
    id: "manutencao",
    name: "Dashboard de Manutenção da Frota",
    module: "Frota Leve • Manutenção",
    path: "/frota?tab=frota&sub=manutencao&subtab=dashboard",
    description: "Ordens de serviço preventivas e corretivas, despesas com oficinas e peças de reposição."
  }
];

// Tempo por slide: 3 minutos (180 segundos)
const SLIDE_DURATION_SECONDS = 180;

interface PresentationContextType {
  isActive: boolean;
  currentIndex: number;
  timeLeft: number;
  isPaused: boolean;
  dashboards: PresentationDashboard[];
  currentDashboard: PresentationDashboard;
  startPresentation: () => void;
  stopPresentation: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  togglePause: () => void;
  jumpToSlide: (index: number) => void;
}

const PresentationContext = createContext<PresentationContextType | undefined>(undefined);

export const PresentationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SLIDE_DURATION_SECONDS);
  const [isPaused, setIsPaused] = useState(false);

  const currentDashboard = PRESENTATION_DASHBOARDS[currentIndex] || PRESENTATION_DASHBOARDS[0];

  // Iniciar Apresentação
  const startPresentation = useCallback(() => {
    // Tenta tela cheia se disponível
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignora se bloqueado pelo browser (ex: iframe sandbox)
        });
      }
    } catch (e) {
      console.warn("Fullscreen não suportado ou bloqueado:", e);
    }

    setIsActive(true);
    setIsPaused(false);
    setCurrentIndex(0);
    setTimeLeft(SLIDE_DURATION_SECONDS);

    // Navega para o primeiro dashboard
    navigate(PRESENTATION_DASHBOARDS[0].path);
  }, [navigate]);

  // Parar Apresentação e manter o usuário no dashboard atual
  const stopPresentation = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);

    // Sai da tela cheia se estiver ativa
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn("Erro ao sair de tela cheia:", e);
    }
  }, []);

  // Próximo Slide
  const nextSlide = useCallback(() => {
    setTimeLeft(SLIDE_DURATION_SECONDS);
    setCurrentIndex((prev) => {
      const next = (prev + 1) % PRESENTATION_DASHBOARDS.length;
      navigate(PRESENTATION_DASHBOARDS[next].path);
      return next;
    });
  }, [navigate]);

  // Slide Anterior
  const prevSlide = useCallback(() => {
    setTimeLeft(SLIDE_DURATION_SECONDS);
    setCurrentIndex((prev) => {
      const prevIdx = (prev - 1 + PRESENTATION_DASHBOARDS.length) % PRESENTATION_DASHBOARDS.length;
      navigate(PRESENTATION_DASHBOARDS[prevIdx].path);
      return prevIdx;
    });
  }, [navigate]);

  // Pular para slide específico
  const jumpToSlide = useCallback((index: number) => {
    if (index >= 0 && index < PRESENTATION_DASHBOARDS.length) {
      setTimeLeft(SLIDE_DURATION_SECONDS);
      setCurrentIndex(index);
      navigate(PRESENTATION_DASHBOARDS[index].path);
    }
  }, [navigate]);

  // Alternar pausa
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Timer de 3 minutos por slide
  useEffect(() => {
    if (!isActive || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Troca de slide
          nextSlide();
          return SLIDE_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isPaused, nextSlide]);

  // Escuta da tecla ESC e monitoramento de Fullscreen
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stopPresentation();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === " " || e.code === "Space") {
        // Barra de espaço pausa/despausa se não estiver em input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          togglePause();
        }
      }
    };

    const handleFullscreenChange = () => {
      // Se saiu de tela cheia manualmente pelo browser, também encerra a apresentação mantendo o dashboard atual
      if (!document.fullscreenElement && isActive) {
        stopPresentation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isActive, stopPresentation, nextSlide, prevSlide, togglePause]);

  return (
    <PresentationContext.Provider
      value={{
        isActive,
        currentIndex,
        timeLeft,
        isPaused,
        dashboards: PRESENTATION_DASHBOARDS,
        currentDashboard,
        startPresentation,
        stopPresentation,
        nextSlide,
        prevSlide,
        togglePause,
        jumpToSlide
      }}
    >
      {children}
    </PresentationContext.Provider>
  );
};

export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error("usePresentation deve ser usado dentro de um PresentationProvider");
  }
  return context;
}

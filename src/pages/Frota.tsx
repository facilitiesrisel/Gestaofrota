import { QRCodeSVG } from "qrcode.react";
import { AbastecimentoTableView, AbastecimentoDashboardView } from "../components/reserva/AbastecimentoViews";
import { useState, useMemo, useEffect, ReactNode, FormEvent } from "react";
import React, { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toTitleCase } from "../lib/utils";
import { 
  Truck, Award, Crown, Trophy, Calendar, CheckSquare, ShieldAlert, 
  Navigation, Plus, Search, Filter, Fuel, Wrench, AlertTriangle, 
  ChevronRight, Check, X, Eye, Phone, Mail, FileText, ArrowLeft, 
  Clock, MapPin, Gauge, Star, BarChart3, TrendingUp, DollarSign,
  LayoutGrid, ArrowRight, Activity, Edit2, LayoutDashboard, FileSpreadsheet, RefreshCw, RotateCcw,
  CheckCircle, AlertCircle, Info, Database, Copy, ExternalLink, Link2, Lock, Code, Download, Siren, BellRing, Settings
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import { ReservaSubmoduleContainer } from "../components/reserva/ReservaSubmoduleContainer";
import { fetchFleetPositions } from "../services/geoFrotasService";
import { ALLOWED_PLATES } from "../constants_reserva";
import { TelemetryDashboard } from "../components/reserva/TelemetryDashboard";
import { TelemetryMapAndGrid } from "../components/reserva/TelemetryMapAndGrid";
import { TelemetryReportsAndFences } from "../components/reserva/TelemetryReportsAndFences";
import { TelemetryAlerts } from "../components/reserva/TelemetryAlerts";
import { ChecklistDashboard } from "../components/reserva/ChecklistDashboard";
import { ChecklistRealizados } from "../components/reserva/ChecklistRealizados";
import { ChecklistForm } from "../components/reserva/ChecklistForm";
import { ChecklistAlertas } from "../components/reserva/ChecklistAlertas";
import MultasDashboard from "./multas/MultasDashboard";
import { getFirebaseChecklists, deleteFirebaseChecklist } from "../services/firebaseService";
import { 
  fetchAbastecimentosSupabase, 
  saveAbastecimentoSupabase, 
  saveBatchAbastecimentosSupabase, 
  deleteAbastecimentoSupabase,
  fetchVeiculosSupabase,
  saveVeiculoSupabase,
  saveBatchVeiculosSupabase,
  deleteVeiculoSupabase,
  fetchContratosSupabase,
  saveContratoSupabase,
  saveBatchContratosSupabase,
  deleteContratoSupabase
} from "../services/supabaseService";
import { VEICULOS_REAIS } from "../data/veiculos_reais";
import { 
  connectGoogleSheets, 
  readSheetDataByGid, 
  saveCsvDataToSheetsByGid, 
  saveAllAbastecimentosToSheets,
  readVehiclesFromSheets, 
  readFuelFromSheets,
  saveVehiclesToSheets, 
  SPREADSHEET_ID, 
  GID_VEICULOS, 
  GID_ABASTECIMENTOS, 
  getAccessToken,
  getAppsScriptUrl,
  saveAppsScriptUrl
} from "../services/googleSheetsService";
import { useAuth, hasSubmoduleAccess } from "../context/AuthContext";
import { UserProfileBadge } from "../components/UserProfileBadge";

// BENCHMARK DATE FOR CONTRACT EXPIRY COMPARISONS
const HOJE_REF = "2026-07-03";

// Componente de Placa Padrão Mercosul (igual a Gestão de Reservas)
export const MercosulPlateBadge: React.FC<{ plate: string; isInactive?: boolean }> = ({ plate, isInactive }) => {
    const formattedPlate = (plate || 'ABC1D23').toUpperCase().trim();
    
    return (
        <div className={`inline-flex flex-col items-center justify-center border rounded-lg overflow-hidden shadow-2xs select-none transition-all duration-200 ${
            isInactive 
                ? 'border-slate-300 bg-slate-100 opacity-60' 
                : 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-xs'
        }`} style={{ width: '92px', minWidth: '92px' }}>
            {/* Faixa Azul Mercosul */}
            <div className={`w-full py-0.5 px-1.5 flex items-center justify-between ${isInactive ? 'bg-slate-500' : 'bg-[#003399]'}`}>
                {/* Estrelas / Logo Mercosul */}
                <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-90"></div>
                    <div className="w-1 h-1 rounded-full bg-yellow-200 opacity-70"></div>
                </div>
                {/* Texto BRASIL */}
                <span className="text-[7.5px] font-black text-white tracking-widest leading-none font-sans uppercase">
                    BRASIL
                </span>
                {/* Mini Bandeira do Brasil */}
                <div className="w-2.5 h-1.5 bg-emerald-500 rounded-[1px] relative flex items-center justify-center overflow-hidden">
                    <div className="w-1.5 h-1 bg-yellow-400 rotate-45 transform"></div>
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-700 absolute"></div>
                </div>
            </div>

            {/* Corpo da Placa com Código e Fonte Monospace */}
            <div className="w-full bg-white py-0.5 px-1 text-center flex items-center justify-center">
                <span className={`text-[12px] font-mono font-black tracking-wider leading-tight ${isInactive ? 'text-slate-500' : 'text-slate-900'}`}>
                    {formattedPlate}
                </span>
            </div>
        </div>
    );
};

// HELPER FOR SHORTENING LONG CORPORATE NAMES (inspired by user request)
const formatarTextoLongo = (texto: string, maxLength: number = 18): string => {
  if (!texto) return "";
  let t = texto.trim();
  
  // Custom substitution rules for professional visual styling
  const upper = t.toUpperCase();
  if (upper.includes("PRT SOLUCOES") || upper.includes("PRT SOLUÇÕES")) {
    return "PRT Soluções";
  }
  if (upper.includes("POSTOS ABC")) {
    return "Postos ABC";
  }
  if (upper.includes("LOCALIZA GESTÃO") || upper.includes("LOCALIZA GESTAO")) {
    return "Localiza Gestão";
  }

  t = t.replace(/\s+LTDA\.?\s*/gi, " ")
       .replace(/\s+S\.?A\.?\s*/gi, " ")
       .replace(/\s+LIMITADA\s*/gi, " ")
       .replace(/\s+E\s+PARTICIPACOES\s*/gi, "")
       .replace(/\s+E\s+PARTICIPAÇÕES\s*/gi, "")
       .replace(/\s+SERVICOS\s+EM\s+/gi, " ")
       .replace(/\s+SERVIÇOS\s+EM\s+/gi, " ")
       .replace(/\s+TELEFONIA\s+E\s+SEGURANCA\s+ELETRONICA\s*/gi, " ")
       .replace(/\s+TELEFONIA\s+E\s+SEGURANÇA\s+ELETRÔNICA\s*/gi, " ")
       .replace(/\s+ALUGUEL\s+DE\s+CARROS\s*/gi, "")
       .trim();

  if (t.length > maxLength) {
    const parts = t.split(" ");
    if (parts.length > 1) {
      const short = `${parts[0]} ${parts[1]}`;
      t = short.length > maxLength ? parts[0] : short;
    } else {
      t = t.substring(0, maxLength - 2) + "..";
    }
  }
  return toTitleCase(t);
};

// Types
export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  vencContrato: string;
  condutor: string;
  funcao: string;
  contatoMotorista: string;
  gestorResp: string;
  email: string;
  filial: string;
  locadora: string;
  contrato: string;
  odometro: number;
  combustivel: string;
  status: "Disponível" | "Em Viagem" | "Em Manutenção" | "Reservado" | "Ativo" | "Inativo";
  dataTrocaCondutor?: string;
  dataInativacao?: string;
  motivoInativacao?: string;
}

interface Checklist {
  id: string;
  placa: string;
  condutor: string;
  data: string;
  odometro: number;
  itens: {
    pneus: "OK" | "Atenção" | "Crítico";
    freios: "OK" | "Atenção" | "Crítico";
    farois: "OK" | "Atenção" | "Crítico";
    seguranca: "OK" | "Atenção" | "Crítico";
    fluidos: "OK" | "Atenção" | "Crítico";
    lataria: "OK" | "Atenção" | "Crítico";
  };
  observacoes: string;
  status: "Aprovado" | "Ressalvas" | "Retido";
  
  // Rich properties from Google Sheets or Firestore
  timestamp?: string;
  email?: string;
  tipo?: string;
  base?: string;
  marcaModelo?: string;
  cor?: string;
  nivelTanque?: string;
  listaItens?: string[];
  pneuDianteiroDireito?: string;
  pneuDianteiroEsquerdo?: string;
  pneuTraseiroDireito?: string;
  pneuTraseiroEsquerdo?: string;
  pneuEstepe?: string;
  obsDianteira?: string;
  fotoFrente?: string;
  obsMotorista?: string;
  fotoMotorista?: string;
  obsPassageiro?: string;
  fotoPassageiro?: string;
  obsTraseira?: string;
  fotoTraseira?: string;
  entreguePor?: string;
  recebidoPor?: string;
  fotosInterior?: string;
  fotoRetrovisorMotorista?: string;
  fotoRetrovisorPassageiro?: string;
  fotoFaroisTraseiros?: string;
  fotoFaroisDianteiros?: string;
  mergedDocUrl?: string;
  isGoogleSheet?: boolean;
}

interface Reserva {
  id: string;
  placa: string;
  condutor: string;
  de: string;
  ate: string;
  destino: string;
  status: "Confirmada" | "Em Andamento" | "Finalizada" | "Cancelada";
}

interface Multa {
  id: string;
  placa: string;
  condutor: string;
  infracao: string;
  data: string;
  valor: number;
  pontos: number;
  pagamento: "Aberto" | "Pago";
  defesa: "Não Iniciada" | "Em Recurso" | "Deferido" | "Indeferido";
}

interface Pedagio {
  id: string;
  placa: string;
  data: string;
  valor: number;
  base: string;
  condutor: string;
  locadora: string;
}

export interface Abastecimento {
  id: string;
  placa: string;
  base: string;
  condutor: string;
  data: string;
  kmPercorrido: number;
  litros: number;
  valorTotal: number;
  combustivel: string;
  posto: string;
  cidade: string;
  uf?: string;
  valorLitro?: number;
  saldo?: number;
  hodometro?: number;
  cartao?: string;
  cnpjPosto?: string;
  transacao?: string;
  modelo?: string;
  observacoes?: string;
}

interface Manutencao {
  id: string;
  placa: string;
  tipo: "Preventiva" | "Corretiva";
  descricao: string;
  data: string;
  odometro: number;
  custo: number;
  oficina: string;
}

const THEMES = {
  orange: {
    bgBlur: "bg-orange-500",
    gradientBg: "from-white via-orange-50/20 to-orange-500/[0.04]",
    glowColor: "group-hover:shadow-orange-200/50 border-orange-100/80 hover:border-orange-300",
    iconContainer: "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50 text-orange-600 group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white",
    textAccent: "text-orange-600 group-hover:text-orange-700"
  },
  emerald: {
    bgBlur: "bg-emerald-500",
    gradientBg: "from-white via-emerald-50/20 to-emerald-500/[0.04]",
    glowColor: "group-hover:shadow-emerald-200/50 border-emerald-100/80 hover:border-emerald-300",
    iconContainer: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50 text-emerald-600 group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white",
    textAccent: "text-emerald-600 group-hover:text-emerald-700"
  },
  blue: {
    bgBlur: "bg-blue-500",
    gradientBg: "from-white via-blue-50/20 to-blue-500/[0.04]",
    glowColor: "group-hover:shadow-blue-200/50 border-blue-100/80 hover:border-blue-300",
    iconContainer: "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/50 text-blue-600 group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white",
    textAccent: "text-blue-600 group-hover:text-blue-700"
  },
  rose: {
    bgBlur: "bg-rose-500",
    gradientBg: "from-white via-rose-50/20 to-rose-500/[0.04]",
    glowColor: "group-hover:shadow-rose-200/50 border-rose-100/80 hover:border-rose-300",
    iconContainer: "bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/50 text-rose-600 group-hover:from-rose-500 group-hover:to-red-500 group-hover:text-white",
    textAccent: "text-rose-600 group-hover:text-rose-700"
  },
  violet: {
    bgBlur: "bg-violet-500",
    gradientBg: "from-white via-violet-50/20 to-violet-500/[0.04]",
    glowColor: "group-hover:shadow-violet-200/50 border-violet-100/80 hover:border-violet-300",
    iconContainer: "bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200/50 text-violet-600 group-hover:from-violet-500 group-hover:to-purple-500 group-hover:text-white",
    textAccent: "text-violet-600 group-hover:text-violet-700"
  }
};

function SubModuleCard({ title, description, icon: Icon, onClick, theme, delay }: any) {
  const selectedTheme = THEMES[theme as keyof typeof THEMES] || THEMES.orange;
  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20, 
        delay: delay * 0.5 
      }}
      className="h-full"
    >
      <button onClick={onClick} className="w-full text-left block group h-full cursor-pointer focus:outline-none">
        <div className={`rounded-[32px] p-8 border shadow-sm transition-all duration-500 relative overflow-hidden h-full flex flex-col justify-between bg-gradient-to-br ${selectedTheme.gradientBg} ${selectedTheme.glowColor}`}>
          <div className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-10 transition-all duration-500 group-hover:opacity-25 group-hover:scale-110 ${selectedTheme.bgBlur}`} />
          
          <div>
            <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center mb-6 shadow-sm border transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 relative z-10 ${selectedTheme.iconContainer}`}>
              <Icon className="w-8 h-8" />
            </div>
            
            <h2 className="text-xl font-display font-bold text-slate-800 mb-3 relative z-10">{title}</h2>
            <p className="text-slate-500 leading-relaxed mb-6 text-xs font-semibold relative z-10">{description}</p>
          </div>
          
          <div className={`inline-flex items-center gap-1.5 font-black tracking-wide uppercase text-[10px] transition-colors mt-auto relative z-10 ${selectedTheme.textAccent}`}>
            Acessar área 
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function SubSystemLayout({ 
  activeTab,
  menuItems,
  activeSubSection,
  setActiveSubSection,
  hideSidebar = false,
  children 
}: { 
  activeTab: string; 
  menuItems: { id: string; label: string; icon: any }[]; 
  activeSubSection: string; 
  setActiveSubSection: (id: string) => void; 
  hideSidebar?: boolean;
  children: ReactNode; 
}) {
  if (hideSidebar) {
    return (
      <div className="flex-1 min-h-0 w-full text-slate-800 text-left flex flex-col overflow-hidden">
        {children}
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 w-full text-slate-800 text-left items-start overflow-hidden">
      {/* Menu Lateral de Navegação do Submódulo */}
      <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-36 z-20">
        <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 text-left">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Área Operacional</span>
            <span className="text-xs font-black text-slate-700 block mt-0.5">{activeTab}</span>
          </div>

          {/* Lista de subseções do menu (Vertical no desktop, horizontal no mobile) */}
          <div className="flex flex-row flex-wrap lg:flex-col gap-1.5 w-full">
            {menuItems.map((item) => {
              const IsActive = activeSubSection === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubSection(item.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left flex-1 min-w-[130px] lg:w-full lg:flex-none cursor-pointer border ${
                    IsActive
                      ? "bg-emerald-50/70 text-[#114D38] border-emerald-150/50 shadow-sm font-black"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${IsActive ? "text-[#114D38]" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conteúdo à Direita */}
      <div className="flex-1 min-w-0 w-full h-full flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

const SUB_MODULE_INFO = {
  frota: { 
    label: "Controle de Frota Leve", 
    icon: Truck, 
    theme: "orange", 
    colorClass: "text-orange-600 border-orange-200/50 bg-orange-500", 
    highlightText: "from-orange-600 to-amber-500" 
  },
  checklist: { 
    label: "Checklist Digital", 
    icon: CheckSquare, 
    theme: "emerald", 
    colorClass: "text-emerald-600 border-emerald-200/50 bg-emerald-500", 
    highlightText: "from-emerald-600 to-emerald-400" 
  },
  reservas: { 
    label: "Gestão de Reservas", 
    icon: Calendar, 
    theme: "blue", 
    colorClass: "text-blue-600 border-blue-200/50 bg-blue-500", 
    highlightText: "from-blue-600 to-blue-400" 
  },
  multas: { 
    label: "Controle de Multas", 
    icon: ShieldAlert, 
    theme: "rose", 
    colorClass: "text-rose-600 border-rose-200/50 bg-rose-500", 
    highlightText: "from-rose-600 to-rose-400" 
  },
  rastreamento: { 
    label: "Rastreamento Ativo", 
    icon: Navigation, 
    theme: "violet", 
    colorClass: "text-violet-600 border-violet-200/50 bg-violet-500", 
    highlightText: "from-violet-600 to-violet-400" 
  },
};

interface SubModuleAuthScreenProps {
  tab: string;
  onSuccess: () => void;
  onBack: () => void;
}

function SubModuleAuthScreen({ tab, onSuccess, onBack }: SubModuleAuthScreenProps) {
  const info = SUB_MODULE_INFO[tab as keyof typeof SUB_MODULE_INFO] || SUB_MODULE_INFO.frota;
  const Icon = info.icon;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError("Por favor, informe o PIN de acesso.");
      return;
    }
    
    setIsLoading(true);
    setError("");

    // Validação de segurança simulada do ERP Risel
    setTimeout(() => {
      if (pin === "1234") {
        onSuccess();
      } else {
        setError("PIN de acesso incorreto. Tente novamente.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Círculos decorativos de blur de fundo com base na cor do tema do módulo */}
      <div className={`absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 transition-opacity duration-700 ${
        info.theme === 'orange' ? 'bg-orange-500' : 
        info.theme === 'emerald' ? 'bg-emerald-500' : 
        info.theme === 'blue' ? 'bg-blue-500' : 
        info.theme === 'rose' ? 'bg-rose-500' : 'bg-violet-500'
      }`} />
      <div className={`absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl opacity-10 transition-opacity duration-700 ${
        info.theme === 'orange' ? 'bg-orange-500' : 
        info.theme === 'emerald' ? 'bg-emerald-500' : 
        info.theme === 'blue' ? 'bg-blue-500' : 
        info.theme === 'rose' ? 'bg-rose-500' : 'bg-violet-500'
      }`} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
        className="w-full max-w-md bg-white rounded-[32px] border border-slate-150 p-8 shadow-2xl shadow-slate-200/80 relative z-10 text-center"
      >
        {/* Badge do ícone do subsistema com brilho de tema */}
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className={`absolute inset-0 rounded-[24px] blur-xl opacity-20 scale-110 ${
            info.theme === 'orange' ? 'bg-orange-500' : 
            info.theme === 'emerald' ? 'bg-emerald-500' : 
            info.theme === 'blue' ? 'bg-blue-500' : 
            info.theme === 'rose' ? 'bg-rose-500' : 'bg-violet-500'
          }`} />
          <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center shadow-md border relative z-10 bg-gradient-to-br from-slate-50 to-slate-100/50 ${info.colorClass}`}>
            <Icon className="w-9 h-9 text-white" />
          </div>
        </div>

        <h2 className="text-xl font-display font-black text-slate-800 tracking-tight">
          Acessar <span className={`bg-gradient-to-r ${info.highlightText} bg-clip-text text-transparent`}>{info.label}</span>
        </h2>
        
        <p className="text-[11px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">
          Módulo de Frota Leve · Risel ERP
        </p>

        <p className="text-slate-500 text-xs font-medium leading-relaxed mt-4 px-3">
          Este é um subsistema de acesso restrito. Confirme o PIN operacional para liberar a visualização do painel CRM.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 text-left">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
              PIN de Operador da Frota
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setPin(val);
                  setError("");
                }}
                placeholder="••••"
                disabled={isLoading}
                className="w-full text-center tracking-[1.5em] font-mono text-xl px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-slate-350 focus:ring-0 focus:outline-none transition-all placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-300"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-[11px] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[11px] text-slate-500 leading-relaxed font-medium">
            <span className="font-extrabold text-slate-700 block mb-0.5">Dica para homologação:</span>
            Digite o PIN padrão <strong className="text-slate-800 font-black">1234</strong> para liberar o acesso ao painel de controle do submódulo.
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                isLoading 
                  ? "bg-slate-300 shadow-none cursor-wait" 
                  : info.theme === 'orange' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/10' 
                  : info.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' 
                  : info.theme === 'blue' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10' 
                  : info.theme === 'rose' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10' 
                  : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/10'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Confirmar Acesso"
              )}
            </button>

            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-transparent"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Portal da Frota
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ensureAllAllowedPlates(currentVehicles: Veiculo[]): Veiculo[] {
  return currentVehicles;
}

export default function Frota() {
  const mainFrotaTableScrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "portal" | "frota" | "checklist" | "reservas" | "multas" | "rastreamento") || "portal";

  const setActiveTab = (tab: "portal" | "frota" | "checklist" | "reservas" | "multas" | "rastreamento") => {
    if (tab === "rastreamento") {
      setSearchParams({ tab, sub: "mapa" });
    } else {
      setSearchParams({ tab });
    }
  };

  // Estado de Autenticação para cada um dos Submódulos
  const [authenticatedTabs, setAuthenticatedTabs] = useState<Record<string, boolean>>(() => {
    const auths = localStorage.getItem("risel_auth_submodules");
    if (!auths) return {};
    try {
      return JSON.parse(auths);
    } catch (e) {
      return {};
    }
  });

  const handleAuthenticateSubModule = (tab: string) => {
    const auths = localStorage.getItem("risel_auth_submodules");
    let parsed: Record<string, boolean> = {};
    if (auths) {
      try {
        parsed = JSON.parse(auths);
      } catch (e) {}
    }
    parsed[tab] = true;
    localStorage.setItem("risel_auth_submodules", JSON.stringify(parsed));
    setAuthenticatedTabs(parsed);
    // Notifica o MainLayout sobre a alteração do estado de autenticação
    window.dispatchEvent(new Event("risel_submodule_auth_change"));
  };

  // Core States
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);

  // Google Sheets Integration states
  const [googleToken, setGoogleToken] = useState<string | null>(getAccessToken());
  const [isSyncingWithSheets, setIsSyncingWithSheets] = useState(false);
  const [googleSheetsError, setGoogleSheetsError] = useState<string | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState("");
  const [isSavingAppsScript, setIsSavingAppsScript] = useState(false);
  const [sheetsModalTab, setSheetsModalTab] = useState<"onedrive" | "appsscript" | "oauth">("onedrive");
  const [appScriptCode, setAppScriptCode] = useState<string>("");
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptViewer, setShowScriptViewer] = useState<boolean>(true);

  const fetchAppsScriptCode = async () => {
    try {
      const res = await fetch("/api/sheets/script-code");
      if (res.ok) {
        const code = await res.text();
        setAppScriptCode(code);
      }
    } catch (e) {
      console.error("Erro ao carregar código do script:", e);
    }
  };

  useEffect(() => {
    getAppsScriptUrl().then(url => {
      if (url) setAppsScriptUrlInput(url);
    });
    fetchOneDriveConfig();
    fetchAppsScriptCode();
  }, []);

  const handleCopyAppsScriptCode = () => {
    if (!appScriptCode) return;
    navigator.clipboard.writeText(appScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleDownloadAppsScriptCode = () => {
    if (!appScriptCode) return;
    const blob = new Blob([appScriptCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AppsScript.gs";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [oneDriveUrl, setOneDriveUrl] = useState("https://riselcombustiveis-my.sharepoint.com/:f:/g/personal/deny_goncalves_risel_com_br/IgDhfwPxVW9nQZyFwLRjd-4MAbGt0nJQIAsM88RTgpOauxM?e=ZTFwbC");
  const [oneDriveEnabled, setOneDriveEnabled] = useState(true);
  const [oneDriveLogs, setOneDriveLogs] = useState<any[]>([]);
  const [isOneDriveSyncing, setIsOneDriveSyncing] = useState(false);
  const [isSavingOneDriveConfig, setIsSavingOneDriveConfig] = useState(false);

  const fetchOneDriveConfig = async () => {
    try {
      const res = await fetch("/api/onedrive/config");
      if (res.ok) {
        const data = await res.json();
        if (data.folderUrl) setOneDriveUrl(data.folderUrl);
        if (typeof data.enabled === "boolean") setOneDriveEnabled(data.enabled);
        if (Array.isArray(data.logs)) setOneDriveLogs(data.logs);
      }
    } catch (e) {}
  };

  const handleSaveOneDriveConfig = async () => {
    setIsSavingOneDriveConfig(true);
    try {
      const res = await fetch("/api/onedrive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: oneDriveUrl, enabled: oneDriveEnabled })
      });
      if (res.ok) {
        showToast("success", "Configuração do OneDrive Salva!", "Sincronização diária agendada para todas as 09:00 da manhã.");
      } else {
        showToast("error", "Erro ao Salvar", "Não foi possível salvar a URL do OneDrive.");
      }
    } catch (err: any) {
      showToast("error", "Erro ao Salvar", err.message);
    } finally {
      setIsSavingOneDriveConfig(false);
    }
  };

  const handleOneDriveSyncNow = async () => {
    setIsOneDriveSyncing(true);
    showToast("info", "Sincronizando OneDrive...", "Verificando dados e buscando atualizações na pasta do OneDrive...");
    try {
      const res = await fetch("/api/onedrive/sync-now", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("success", "Sincronização Ativa!", data.log?.message || `${data.addedCount || 0} abastecimentos verificados e sincronizados.`);
        handleSyncGoogleSheetsNow();
      } else {
        showToast("info", "Status OneDrive", data.log?.message || data.error || "Verifique as configurações do OneDrive.");
      }
      fetchOneDriveConfig();
    } catch (err: any) {
      showToast("error", "Erro ao Sincronizar", err.message || "Erro de conexão.");
    } finally {
      setIsOneDriveSyncing(false);
    }
  };

  const [isExportingToSheets, setIsExportingToSheets] = useState(false);

  const handleExportAllToGoogleSheets = async () => {
    setIsExportingToSheets(true);
    showToast("info", "Enviando Dados para a Planilha...", "Exportando todos os abastecimentos para a sua planilha do Google Sheets...");
    try {
      const res = await fetch("/api/sheets/push-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appsScriptUrl: appsScriptUrlInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "Exportação Concluída com Sucesso!", data.message || "Todos os abastecimentos foram gravados na planilha Google!");
        handleSyncGoogleSheetsNow();
      } else {
        showToast("error", "Erro ao Exportar", data.error || data.message || "Falha ao gravar na planilha.");
      }
    } catch (err: any) {
      showToast("error", "Erro de Conexão", err.message || "Não foi possível comunicar com o servidor.");
    } finally {
      setIsExportingToSheets(false);
    }
  };

  const handleSaveAppsScriptUrl = async () => {
    if (!appsScriptUrlInput.trim()) {
      showToast("error", "URL Obrigatória", "Por favor, insira a URL do App da Web gerada no Google Apps Script.");
      return;
    }
    setIsSavingAppsScript(true);
    try {
      const success = await saveAppsScriptUrl(appsScriptUrlInput.trim());
      if (success) {
        showToast("success", "Sincronização Ativada com Sucesso!", "URL configurada! Iniciando envio dos dados acumulados para a planilha...");
        await handleExportAllToGoogleSheets();
        setIsSheetsModalOpen(false);
      } else {
        showToast("error", "Erro ao Salvar", "Ocorreu um erro ao registrar a URL no servidor.");
      }
    } catch (err: any) {
      showToast("error", "Erro ao Salvar", err.message || "Não foi possível salvar a URL do Apps Script.");
    } finally {
      setIsSavingAppsScript(false);
    }
  };

  const handleConnectSheetsClick = () => {
    setIsSheetsModalOpen(true);
  };

  const handleGoogleSignInPopup = async () => {
    try {
      showToast("info", "Conectando Google Sheets...", "Abrindo autenticação do Google.");
      const token = await connectGoogleSheets();
      setGoogleToken(token);
      showToast("success", "Google Sheets Conectado!", "Gravação direta na planilha online ativada!");
      setIsSheetsModalOpen(false);
      
      if (abastecimentos.length > 0) {
        setIsSyncingWithSheets(true);
        saveAllAbastecimentosToSheets(token, abastecimentos)
          .then(() => {
            showToast("success", "Planilha Atualizada!", `${abastecimentos.length} abastecimentos salvos na planilha online!`);
          })
          .catch((err) => {
            console.error("Erro ao gravar na planilha:", err);
            showToast("info", "Aviso de Permissão", "Conectado! Caso a gravação falhe, verifique as permissões de edição no Google Drive.");
          })
          .finally(() => setIsSyncingWithSheets(false));
      }
    } catch (err: any) {
      console.error("Erro ao conectar via popup do Google:", err);
      showToast("error", "Erro ao Conectar", "Não foi possível conectar via popup. Tente inserir o Token de Acesso diretamente na opção abaixo.");
    }
  };

  const handleSaveManualToken = async () => {
    const cleanToken = manualTokenInput.trim();
    if (!cleanToken) {
      showToast("error", "Token Inválido", "Por favor, cole um Token de Acesso do Google válido.");
      return;
    }

    setIsTestingToken(true);
    try {
      localStorage.setItem("google_access_token", cleanToken);
      setGoogleToken(cleanToken);
      
      showToast("success", "Token Conectado!", "Testando permissão de escrita na planilha...");
      
      if (abastecimentos.length > 0) {
        await saveAllAbastecimentosToSheets(cleanToken, abastecimentos);
        showToast("success", "Sincronização Concluída!", `${abastecimentos.length} abastecimentos sincronizados na Planilha Google!`);
      } else {
        showToast("success", "Pronto para Uso!", "Conexão estabelecida com a Planilha Google.");
      }
      
      setIsSheetsModalOpen(false);
      setManualTokenInput("");
    } catch (err: any) {
      console.error("Erro ao testar token manual:", err);
      showToast("error", "Erro no Token", "O token fornecido expirou ou não possui acesso à planilha. Gere um novo token no Google OAuth Playground.");
    } finally {
      setIsTestingToken(false);
    }
  };

  const handleUpdateAbastecimento = async (updatedItem: Abastecimento) => {
    const updatedList = abastecimentos.map(a => a.id === updatedItem.id ? updatedItem : a);
    setAbastecimentos(updatedList);
    localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(updatedList));

    // Salva no Banco Supabase Real se configurado
    saveAbastecimentoSupabase(updatedItem).catch(e => console.warn("Supabase update error:", e));

    let token = googleToken || getAccessToken();
    if (token) {
      try {
        await saveAllAbastecimentosToSheets(token, updatedList);
        showToast("success", "Abastecimento Atualizado!", "O registro foi alterado no sistema e na Planilha do Google online!");
      } catch (err) {
        console.error("Erro ao sincronizar edição com Google Sheets:", err);
        showToast("info", "Atualizado no Sistema e Supabase!", "Registro alterado no sistema.");
      }
    } else {
      showToast("success", "Abastecimento Atualizado!", "Registro alterado no sistema e banco de dados.");
    }
  };

  const handleDeleteAbastecimento = async (id: string) => {
    const updatedList = abastecimentos.filter(a => a.id !== id);
    setAbastecimentos(updatedList);
    localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(updatedList));

    // Remove do Banco Supabase Real
    deleteAbastecimentoSupabase(id).catch(e => console.warn("Supabase delete error:", e));

    let token = googleToken || getAccessToken();
    if (token) {
      try {
        await saveAllAbastecimentosToSheets(token, updatedList);
        showToast("success", "Registro Excluído!", "Abastecimento removido do sistema, Supabase e Planilha Google.");
      } catch (err) {
        showToast("info", "Removido do Sistema!", "Registro removido do sistema local.");
      }
    } else {
      showToast("success", "Registro Excluído!", "Abastecimento removido com sucesso.");
    }
  };

  const handleSyncGoogleSheetsNow = async () => {
    setIsSyncingWithSheets(true);
    try {
      await handleSyncGoogleSheets();
      showToast("success", "Sincronização Concluída!", "Dados atualizados da Planilha Google online!");
    } catch (err: any) {
      showToast("error", "Erro ao Atualizar", "Não foi possível buscar os dados da Planilha Google.");
    } finally {
      setIsSyncingWithSheets(false);
    }
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFilial, setFilterFilial] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");

  // Real vehicles loading & costs filters states
  const [isVehiclesLoading, setIsVehiclesLoading] = useState(false);

  const [pedagios, setPedagios] = useState<Pedagio[]>([]);
  const [activeAbastecimentoTab, setActiveAbastecimentoTab] = useState<"tabela" | "dashboard">("tabela");
  
  // Column visibility
  const [visColAbast, setVisColAbast] = useState({ veiculo: true, base: true, data: true, odometro: true, litros: true, valor: true });
  const [visColPedagio, setVisColPedagio] = useState({ veiculo: true, base: true, condutor: true, locadora: true, data: true, valor: true });
  
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvType, setCsvType] = useState<"abastecimentos" | "pedagios" | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; desc?: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, desc?: string) => {
    setToast({ type, title, desc });
    setTimeout(() => {
      setToast(null);
    }, 7000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    const targetCsvType = csvType || "abastecimentos";
    
    if (selectedFiles.length > 1 && targetCsvType === "abastecimentos") {
      showToast("info", "Sincronizando Lote de Arquivos...", `Lendo e processando ${selectedFiles.length} arquivos CSV da pasta do OneDrive...`);
    }

    let allParsedAbastecimentos: Abastecimento[] = [];
    let totalFilesProcessed = 0;

    for (const file of selectedFiles) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const rawText = (event.target?.result as string) || "";
            if (!rawText.trim()) {
              resolve();
              return;
            }

            const cleanText = rawText.replace(/^\uFEFF/, '');

            let parseResult = Papa.parse(cleanText, {
              header: true,
              skipEmptyLines: 'greedy',
              transformHeader: (h) => h.trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '')
            });

            if (parseResult.data.length > 0) {
              const firstRow = parseResult.data[0] as Record<string, any>;
              const keys = Object.keys(firstRow);
              if (keys.length === 1 && (keys[0].includes(';') || keys[0].includes('\t') || keys[0].includes(','))) {
                const delim = keys[0].includes(';') ? ';' : keys[0].includes('\t') ? '\t' : ',';
                parseResult = Papa.parse(cleanText, {
                  header: true,
                  delimiter: delim,
                  skipEmptyLines: 'greedy',
                  transformHeader: (h) => h.trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '')
                });
              }
            }

            let rowsToProcess = parseResult.data as Record<string, any>[];

            const rawKeys = rowsToProcess.length > 0 ? Object.keys(rowsToProcess[0]) : [];
            const hasValidColumn = rawKeys.some(k => {
              const kn = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return kn.includes('placa') || kn.includes('veiculo') || kn.includes('data') || kn.includes('litro') || kn.includes('valor') || kn.includes('mercadoria');
            });

            if (!hasValidColumn && cleanText.length > 0) {
              const rawArrayParse = Papa.parse(cleanText, { skipEmptyLines: 'greedy' });
              const rawData = rawArrayParse.data as string[][];
              const headerIdx = rawData.findIndex(rowArr => 
                rowArr.some(cell => {
                  const cn = String(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
                  return cn.includes('placa') || cn.includes('veiculo') || cn.includes('data') || cn.includes('litro') || cn.includes('valor');
                })
              );

              if (headerIdx !== -1) {
                const headerRow = rawData[headerIdx].map(c => String(c).trim().replace(/^\uFEFF/, '').replace(/^["']|["']$/g, ''));
                rowsToProcess = rawData.slice(headerIdx + 1).map(rowArr => {
                  const obj: Record<string, string> = {};
                  headerRow.forEach((h, idx) => {
                    if (h) obj[h] = String(rowArr[idx] || '').trim();
                  });
                  return obj;
                });
              }
            }

            const allowed = new Set(veiculos.map(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()));

            if (targetCsvType === "pedagios") {
              const parsed = rowsToProcess
                .map((row: any) => ({
                  id: "csv-" + Math.random().toString(36).substring(7),
                  placa: (row.Placa || row.placa || "").trim().toUpperCase(),
                  data: row.Data || row.data || new Date().toISOString().split("T")[0],
                  valor: parseFloat(row.Valor || row.valor || 0) || 0,
                  base: row.Base || row.base || "",
                  condutor: row.Condutor || row.condutor || "",
                  locadora: row.Locadora || row.locadora || ""
                }))
                .filter((p: Pedagio) => {
                   const c = p.placa.replace(/[^a-zA-Z0-9]/g, '');
                   return c && (allowed.size === 0 || allowed.has(c));
                });
              if (parsed.length > 0) {
                const updated = [...pedagios, ...parsed];
                setPedagios(updated);
                localStorage.setItem("risel_frota_pedagios", JSON.stringify(updated));
                showToast("success", "Pedágios Importados", `${parsed.length} pedágios foram importados com sucesso!`);
              }
            } else {
              // Abastecimentos
              const normalizeHeader = (str: string) => {
                return String(str || "")
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]/g, "");
              };

              const getRowVal = (row: any, keys: string[]) => {
                if (!row) return "";
                const rowKeys = Object.keys(row);
                
                // Pass 1: Direct exact key match
                for (const k of keys) {
                  if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
                    return String(row[k]).trim();
                  }
                }

                // Pass 2: Normalized EXACT match across ALL keys in rowKeys
                for (const k of keys) {
                  const targetNorm = normalizeHeader(k);
                  if (!targetNorm) continue;

                  const foundExact = rowKeys.find(rk => normalizeHeader(rk) === targetNorm);
                  if (foundExact && row[foundExact] !== undefined && row[foundExact] !== null && String(row[foundExact]).trim() !== "") {
                    return String(row[foundExact]).trim();
                  }
                }

                // Pass 3: Normalized SUBSTRING match ONLY as fallback
                for (const k of keys) {
                  const targetNorm = normalizeHeader(k);
                  if (!targetNorm || targetNorm.length < 3) continue;

                  const foundSub = rowKeys.find(rk => {
                    const rkNorm = normalizeHeader(rk);
                    if (targetNorm === "placa" && (rkNorm.includes("descricao") || rkNorm.includes("centrodecusto") || rkNorm.includes("modelo") || rkNorm.includes("digmotorista"))) {
                      return false;
                    }
                    return rkNorm.includes(targetNorm);
                  });

                  if (foundSub && row[foundSub] !== undefined && row[foundSub] !== null && String(row[foundSub]).trim() !== "") {
                    return String(row[foundSub]).trim();
                  }
                }

                return "";
              };

              const parseBrazilianDate = (val: any): string => {
                if (val === undefined || val === null || val === "") return new Date().toISOString().split("T")[0];
                if (typeof val === "number" || (!isNaN(Number(val)) && Number(val) > 30000 && Number(val) < 60000)) {
                  const num = Number(val);
                  const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
                  if (!isNaN(dateObj.getTime())) {
                    return dateObj.toISOString().split("T")[0];
                  }
                }

                const str = String(val).trim();
                if (!str) return new Date().toISOString().split("T")[0];

                const isoMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                if (isoMatch) {
                  const y = isoMatch[1];
                  const m = isoMatch[2].padStart(2, "0");
                  const d = isoMatch[3].padStart(2, "0");
                  return `${y}-${m}-${d}`;
                }

                const brMatch = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
                if (brMatch) {
                  const d = brMatch[1].padStart(2, "0");
                  const m = brMatch[2].padStart(2, "0");
                  let y = brMatch[3];
                  if (y.length === 2) y = "20" + y;
                  return `${y}-${m}-${d}`;
                }

                return new Date().toISOString().split("T")[0];
              };

              const parseFloatBr = (val: any): number => {
                if (val === undefined || val === null || val === "") return 0;
                if (typeof val === "number") return isNaN(val) ? 0 : val;
                const str = String(val).replace(/R\$/gi, '').replace(/L/gi, '').replace(/km/gi, '').trim();
                if (!str) return 0;
                if (str.includes(",") && str.includes(".")) {
                  if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
                    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
                  } else {
                    return parseFloat(str.replace(/,/g, "")) || 0;
                  }
                }
                if (str.includes(",")) {
                  return parseFloat(str.replace(",", ".")) || 0;
                }
                return parseFloat(str) || 0;
              };

              const parsed = rowsToProcess.map((row: any, idx: number) => {
                let placaRaw = getRowVal(row, [
                  'Placa', 'placa', 'PLACA', 'Veiculo', 'Veículo', 'Placa do Veiculo', 'Placa do Veículo', 
                  'Matricula', 'Matrícula', 'Placa Veículo', 'Placa Veiculo', 'Placa - Dig.Motorista', 
                  'Placa/Modelo', 'PLACA_VEICULO', 'VEICULO', 'Placa / Veiculo', 'Placa_Veiculo', 'Cod. Veiculo'
                ]);

                if (!placaRaw) {
                  const rowValues = Object.values(row).map(v => String(v || '').trim());
                  const foundPlate = rowValues.find(v => /^[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}$/.test(v.replace(/[^a-zA-Z0-9]/g, '')));
                  if (foundPlate) placaRaw = foundPlate;
                }

                const placaClean = placaRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                if (!placaClean) return null;

                const dataRaw = getRowVal(row, [
                  'Data/ Hora transação', 'Data/ Hora transao', 'Data/Hora transação', 'Data Transação', 
                  'Data Transacao', 'Data/Hora', 'Data', 'data', 'DATA', 'Dt Transacao', 'Data Hora', 
                  'Data/Hora Transacao', 'Data e Hora', 'Data Abastecimento', 'Data_Hora', 'Transação',
                  'DT_TRANSACAO', 'DT_ABASTECIMENTO', 'Data Movimento', 'DATA_ABASTECIMENTO'
                ]);
                const parsedData = parseBrazilianDate(dataRaw);

                const litros = parseFloatBr(getRowVal(row, [
                  'Qtd Mercadoria', 'Qtd. Mercadoria', 'Litros', 'litros', 'LITROS', 'Volume', 
                  'Quantidade', 'Qtd', 'Qtd.', 'Volume (L)', 'Quantidade (L)', 'Qtd Litros', 
                  'Litros Abastecidos', 'LITROS_ABASTECIDOS', 'QTD_LITROS', 'Lts'
                ]));
                const valorTotal = parseFloatBr(getRowVal(row, [
                  'Valor total com desconto', 'Valor total original', 'Valor total', 'Valor Total', 
                  'Valor Gasto', 'Valor', 'valor', 'VALOR', 'valorTotal', 'Valor Pago', 'Custo Total', 
                  'Valor (R$)', 'Valor Total (R$)', 'Valor Liquido', 'Valor Líquido', 'Total Gasto', 
                  'VALOR_TOTAL', 'Custo'
                ]));

                const kmPercorrido = parseFloatBr(getRowVal(row, [
                  'Km/Hr Percorrido', 'Km Percorrido', 'Km Percorridos', 'kmPercorrido', 'Distancia', 
                  'Distância', 'Hodômetro Transação - Dig. Motorista', 'Hodometro Transacao - Dig. Motorista', 
                  'Hodômetro', 'Hodometro', 'Km atual', 'Km Atual', 'Hodômetro informado', 'Hodometro informado', 
                  'Km', 'KM', 'Leitura', 'Leitura de Km', 'KM Atual'
                ]));
                const combustivel = getRowVal(row, ['Mercadoria', 'Tipo Mercadoria', 'Combustivel', 'Combustível', 'Tipo de Combustível', 'Produto', 'COMBUSTIVEL', 'Tipo Combustivel']) || "Gasolina";
                const posto = getRowVal(row, ['Nome EC', 'Nome do Posto', 'Posto', 'posto', 'Estabelecimento', 'Razao Social', 'Razão Social', 'POSTO', 'Nome Estabelecimento', 'Credenciado']);
                const cidade = getRowVal(row, ['Cidade EC', 'Cidade', 'cidade', 'Município', 'Municipio', 'CIDADE']);
                const uf = getRowVal(row, ['UF EC', 'UF', 'uf', 'Estado', 'ESTADO', 'UF Estabelecimento', 'Estado EC']);
                const valorLitroRaw = parseFloatBr(getRowVal(row, ['Preço Unitário', 'Preco Unitario', 'Valor Litro', 'Valor por Litro', 'Valor/L', 'Preço/L', 'Preco/L', 'Valor Unitario', 'Preço', 'Preco']));
                const valorLitro = valorLitroRaw > 0 ? valorLitroRaw : (valorTotal && litros ? Number((valorTotal / litros).toFixed(2)) : undefined);
                const saldo = parseFloatBr(getRowVal(row, ['Saldo Cartão', 'Saldo Cartao', 'Saldo', 'saldo', 'Saldo atual', 'Saldo Atual', 'SALDO', 'Saldo Disponível', 'Saldo Disponivel', 'Saldo AF'])) || undefined;
                const hodometro = parseFloatBr(getRowVal(row, ['Hodômetro Transação - Dig. Motorista', 'Hodometro Transacao - Dig. Motorista', 'Hodômetro', 'Hodometro', 'Km atual', 'Km Atual', 'Hodômetro informado', 'Hodometro informed', 'Km', 'KM', 'Leitura'])) || undefined;
                const cartao = getRowVal(row, ['Número Cartão', 'Numero Cartao', 'Cartão', 'Cartao', 'Nro Cartao', 'Nro Cartão', 'Matrícula Cartão', 'Matricula Cartao', 'Cartão AF']) || undefined;
                const cnpjPosto = getRowVal(row, ['CNPJ EC', 'CNPJ Posto', 'CNPJ', 'cnpj', 'CNPJ Estabelecimento', 'CPF/CNPJ EC', 'Cnpj']) || undefined;
                const transacao = getRowVal(row, ['Transação', 'Transacao', 'Nro Transacao', 'Nro Transação', 'Comprovante', 'NSU', 'Num Transacao', 'Número Transação', 'Cod Transacao', 'Código Transação']) || undefined;
                const modelo = getRowVal(row, ['Modelo', 'modelo', 'Modelo Veiculo', 'Modelo Veículo', 'Descricao Veiculo', 'Veiculo Modelo', 'Veículo Modelo']) || undefined;
                const observacoes = getRowVal(row, ['Observação', 'Observacao', 'Observações', 'Observacoes', 'Obs', 'OBS', 'Comentário', 'Comentario']) || undefined;

                const matchedVeic = veiculos.find(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placaClean);
                const base = getRowVal(row, ['Base', 'base', 'Nome Filial', 'Filial', 'filial', 'BASE', 'FILIAL', 'Unidade', 'Centro de Custo']) || (matchedVeic ? matchedVeic.filial : "CAMPINEIRA");
                const condutor = getRowVal(row, ['Nome motorista', 'Motorista', 'Condutor', 'condutor', 'MOTORISTA', 'Nome do Motorista', 'Motorista/Condutor']) || (matchedVeic ? matchedVeic.condutor : "Sem Motorista Associado");

                return {
                  id: "csv-" + Math.random().toString(36).substring(7) + "-" + idx,
                  placa: placaClean,
                  base: base.trim().toUpperCase(),
                  condutor: condutor.trim(),
                  data: parsedData,
                  litros,
                  kmPercorrido,
                  valorTotal,
                  combustivel,
                  posto,
                  cidade,
                  uf,
                  valorLitro,
                  saldo,
                  hodometro,
                  cartao,
                  cnpjPosto,
                  transacao,
                  modelo,
                  observacoes
                };
              }).filter((p: any) => {
                if (!p || !p.placa) return false;
                // Filtra estritamente para manter apenas abastecimentos das placas cadastradas
                return allowed.size === 0 || allowed.has(p.placa);
              }) as Abastecimento[];

              if (parsed.length > 0) {
                allParsedAbastecimentos.push(...parsed);
                totalFilesProcessed++;
              }
            }
          } catch (err) {
            console.error("Erro processando arquivo individual:", err);
          } finally {
            resolve();
          }
        };
        reader.readAsText(file as Blob, "ISO-8859-1");
      });
    }

    if (allParsedAbastecimentos.length > 0) {
      // 1. Envia para o Supabase Real (Lote de CSVs de placas cadastradas)
      try {
        await saveBatchAbastecimentosSupabase(allParsedAbastecimentos);
      } catch (sErr) {
        console.warn("Aviso na persistência Supabase de abastecimentos:", sErr);
      }

      // 2. Envia para o servidor local backend
      try {
        await fetch("/api/abastecimentos/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: allParsedAbastecimentos })
        });
      } catch (pErr) {
        console.warn("Aviso na persistência backend de abastecimentos:", pErr);
      }

      // 3. Atualiza estado local
      const current = [...abastecimentos];
      const activeKeys = new Set(current.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      let addedNewCount = 0;

      allParsedAbastecimentos.forEach(item => {
        const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
        if (!activeKeys.has(key)) {
          activeKeys.add(key);
          current.unshift(item);
          addedNewCount++;
        }
      });

      setAbastecimentos(current);
      localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(current));

      showToast(
        "success", 
        "Importação Supabase Concluída!", 
        `${totalFilesProcessed} arquivo(s) CSV processado(s). ${allParsedAbastecimentos.length} registros de veículos cadastrados importados para o Supabase.`
      );
    } else {
      showToast("error", "Sem Veículos Cadastrados no CSV", "Nenhum registro de abastecimento correspondeu às placas de veículos cadastradas no sistema.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setCsvType(null);
  };

  const handleClearAbastecimentosData = () => {
    if (user?.email !== "deny.goncalves@risel.com.br") {
      showToast("error", "Acesso Não Autorizado", "Apenas o usuário deny.goncalves@risel.com.br possui permissão para zerar dados de abastecimento.");
      return;
    }
    if (window.confirm("Tem certeza que deseja zerar as informações de abastecimento para reiniciar a carga a partir dos arquivos CSV no Supabase?")) {
      setAbastecimentos([]);
      localStorage.setItem("risel_frota_abastecimentos", "[]");
      showToast("info", "Abastecimentos Zerados", "Os registros de abastecimento foram limpados. Importe seus arquivos CSV para gravar no Supabase.");
    }
  };

  const handleSyncGoogleSheets = async (token?: string) => {
    setIsSyncingWithSheets(true);
    setGoogleSheetsError(null);

    try {
      // 1. Sincronizar Veículos da aba gid=0
      try {
        const sheetVehicles = await readVehiclesFromSheets();
        if (sheetVehicles.length > 0) {
          setVeiculos(sheetVehicles);
          localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(sheetVehicles));
          console.log(`Carregados ${sheetVehicles.length} veículos da Planilha Google (gid=0).`);
        }
      } catch (vErr) {
        console.warn("Aviso ao carregar veículos da planilha:", vErr);
      }

      // 2. Sincronizar Abastecimentos da aba Abastecimento (GID: 1773480680) e backend
      const sheetFuel = await readFuelFromSheets(token);
      
      // Mesclar com abastecimentos locais/servidor para preservar novos arquivos CSV importados
      const localStored: Abastecimento[] = JSON.parse(localStorage.getItem("risel_frota_abastecimentos") || "[]");
      const existingKeys = new Set(sheetFuel.map(a => `${a.placa}-${a.data}-${a.litros}-${a.valorTotal}`));
      const mergedFuel = [...sheetFuel];

      localStored.forEach((item) => {
        if (item && item.placa) {
          const key = `${item.placa}-${item.data}-${item.litros}-${item.valorTotal}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            mergedFuel.push(item);
          }
        }
      });

      setAbastecimentos(mergedFuel);
      localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(mergedFuel));
      console.log(`Sincronização concluída: ${mergedFuel.length} abastecimentos consolidados (${sheetFuel.length} da planilha + ${mergedFuel.length - sheetFuel.length} locais).`);
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      setGoogleSheetsError(err.message || "Erro ao carregar dados da planilha.");
    } finally {
      setIsSyncingWithSheets(false);
    }
  };

  const handleConnectGoogleSheets = async () => {
    try {
      setGoogleSheetsError(null);
      setIsSyncingWithSheets(true);
      const token = await connectGoogleSheets();
      setGoogleToken(token);
      await handleSyncGoogleSheets(token);
    } catch (err: any) {
      setGoogleSheetsError(err.message || "Erro ao conectar conta Google.");
      setIsSyncingWithSheets(false);
    }
  };

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterPeriodoInicio, setFilterPeriodoInicio] = useState("");
  const [filterPeriodoFim, setFilterPeriodoFim] = useState("");
  const [filterBase, setFilterBase] = useState("");
  const [filterCondutor, setFilterCondutor] = useState("");
  const [filterMesAno, setFilterMesAno] = useState("");

  const handleMesAnoChange = (mesAno: string) => {
    setFilterMesAno(mesAno);
    if (!mesAno) {
      setFilterPeriodoInicio("");
      setFilterPeriodoFim("");
      return;
    }
    const [ano, mes] = mesAno.split("-");
    const primeiroDia = `${ano}-${mes}-01`;
    const ultimoDiaNum = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    const ultimoDia = `${ano}-${mes}-${String(ultimoDiaNum).padStart(2, "0")}`;
    setFilterPeriodoInicio(primeiroDia);
    setFilterPeriodoFim(ultimoDia);
  };

  // Subsystem inner navigation states derived from URL search params
  const subSectionFrota = (searchParams.get("sub") as "veiculos" | "vencidos" | "custos") || "veiculos";
  const setSubSectionFrota = (sub: string) => setSearchParams({ tab: activeTab, sub });

  const subSectionChecklist = (searchParams.get("sub") as "dashboard" | "realizados" | "alertas" | "formulario") || "dashboard";
  const setSubSectionChecklist = (sub: string) => setSearchParams({ tab: activeTab, sub });

  const subSectionReservas = (searchParams.get("sub") as "agenda" | "solicitacoes") || "agenda";
  const setSubSectionReservas = (sub: string) => setSearchParams({ tab: activeTab, sub });

  const subSectionMultas = (searchParams.get("sub") as string) || "dashboard";
  const setSubSectionMultas = (sub: string) => setSearchParams({ tab: activeTab, sub });

  const subSectionRastreamento = (searchParams.get("sub") as "dashboard" | "mapa" | "alertas" | "relatorios") || "mapa";
  const setSubSectionRastreamento = (sub: string) => setSearchParams({ tab: activeTab, sub });

  // Sorting states
  const [sortField, setSortField] = useState<keyof Veiculo | "diasRestantes">("placa");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof Veiculo | "diasRestantes") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Selection drawer
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);

  // Modals
  const [isVehModalOpen, setIsVehModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [isResModalOpen, setIsResModalOpen] = useState(false);
  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);

  // Modal Editing States
  const [editingVeh, setEditingVeh] = useState<Veiculo | null>(null);
  const [modalLocadora, setModalLocadora] = useState("");
  const [customLocadora, setCustomLocadora] = useState("");
  const [modalVencContrato, setModalVencContrato] = useState("");
  const [modalStatus, setModalStatus] = useState<string>("Ativo");
  const [modalDataInativacao, setModalDataInativacao] = useState<string>("");
  const [modalMotivoInativacao, setModalMotivoInativacao] = useState<string>("");

  // Reservas UI States
  const [reservaError, setReservaError] = useState<string | null>(null);
  const [reservaSearch, setReservaSearch] = useState<string>("");
  const [reservaFilterStatus, setReservaFilterStatus] = useState<string>("Todas");

  // Load / Save from localStorage
  useEffect(() => {
    const isAllowedPlate = (plate: string) => {
      const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return clean.length >= 7;
    };

    // 1. Veículos e Contratos (Sincronizados com o Supabase Real)
    fetchVeiculosSupabase().then(supabaseVehicles => {
      if (supabaseVehicles && supabaseVehicles.length > 0) {
        setVeiculos(supabaseVehicles);
        localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(supabaseVehicles));
      } else {
        // Se a tabela no Supabase estiver vazia, grava os 75 veículos reais e contratos automaticamente no Supabase
        setVeiculos(VEICULOS_REAIS);
        localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(VEICULOS_REAIS));
        saveBatchVeiculosSupabase(VEICULOS_REAIS).catch(e => console.warn("Aviso ao salvar veículos no Supabase:", e));
        
        const contratosBatch = VEICULOS_REAIS.filter(v => Boolean(v.vencContrato)).map(v => ({
          id: `cto-${v.placa}`,
          numero: v.contrato || `CTO-${v.placa}`,
          veiculoPlaca: v.placa,
          fornecedor: v.locadora || "Locadora",
          tipoContrato: "Locação",
          dataVencimento: v.vencContrato,
          status: "Ativo"
        }));
        saveBatchContratosSupabase(contratosBatch).catch(e => console.warn("Aviso ao salvar contratos no Supabase:", e));
      }
    }).catch(err => {
      console.warn("Aviso ao buscar veículos do Supabase:", err);
      setVeiculos(VEICULOS_REAIS);
      localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(VEICULOS_REAIS));
    });

    // 2. Checklists
    const savedCheck = localStorage.getItem("risel_frota_checklists");
    let parsedCheck: Checklist[] = [];
    if (savedCheck) {
      try { parsedCheck = JSON.parse(savedCheck); } catch (e) {}
    }
    const hasInvalidCheck = parsedCheck.length === 0 || parsedCheck.some(c => !isAllowedPlate(c.placa));
    if (hasInvalidCheck) {
      const initialCheck: Checklist[] = [
        { id: "c1", placa: "SYL0A67", condutor: "Carlos Alberto Souza", data: "2026-07-02", odometro: 42450, itens: { pneus: "OK", freios: "OK", farois: "OK", seguranca: "OK", fluidos: "OK", lataria: "OK" }, status: "Aprovado", observacoes: "Veículo em ótimo estado de conservação, pronto para uso." },
        { id: "c2", placa: "SYL0A68", condutor: "Ana Beatriz Nogueira", data: "2026-06-30", odometro: 58120, itens: { pneus: "Atenção", freios: "OK", farois: "OK", seguranca: "OK", fluidos: "OK", lataria: "Atenção" }, status: "Ressalvas", observacoes: "Pneu traseiro esquerdo com desgaste moderado. Pequeno arranhão na lataria traseira." },
        { id: "c3", placa: "SYL0A69", condutor: "Roberto Carlos Lima", data: "2026-06-28", odometro: 92380, itens: { pneus: "OK", freios: "Crítico", farois: "OK", seguranca: "OK", fluidos: "Atenção", lataria: "OK" }, status: "Retido", observacoes: "Pastilhas de freio fazendo muito barulho. Nível do óleo do motor abaixo do mínimo recomendado." },
      ];
      setChecklists(initialCheck);
      localStorage.setItem("risel_frota_checklists", JSON.stringify(initialCheck));
    } else {
      setChecklists(parsedCheck);
    }

    // 3. Reservas
    const savedRes = localStorage.getItem("risel_frota_reservas");
    let parsedRes: Reserva[] = [];
    if (savedRes) {
      try { parsedRes = JSON.parse(savedRes); } catch (e) {}
    }
    const hasInvalidRes = parsedRes.length === 0 || parsedRes.some(r => !isAllowedPlate(r.placa));
    if (hasInvalidRes) {
      const initialRes: Reserva[] = [
        { id: "r1", placa: "SYL0A67", condutor: "Carlos Alberto Souza", de: "2026-07-04T08:00", ate: "2026-07-04T18:00", destino: "Atendimento a Clientes em Valinhos/SP", status: "Confirmada" },
        { id: "r2", placa: "SYL0A66", condutor: "Juliana Silveira Dias", de: "2026-07-03T09:00", ate: "2026-07-03T17:00", destino: "Visita Comercial Filial BH", status: "Em Andamento" },
        { id: "r3", placa: "SIL3B70", condutor: "Pedro Henrique Albuquerque", de: "2026-07-06T08:00", ate: "2026-07-10T18:00", destino: "Auditoria Interna Base Paulínia", status: "Confirmada" },
      ];
      setReservas(initialRes);
      localStorage.setItem("risel_frota_reservas", JSON.stringify(initialRes));
    } else {
      setReservas(parsedRes);
    }

    // 4. Multas (Inicia zerado para receber dados reais)
    const savedFines = localStorage.getItem("risel_frota_multas");
    let parsedFines: Multa[] = [];
    if (savedFines) {
      try { 
        const items = JSON.parse(savedFines); 
        parsedFines = Array.isArray(items) ? items.filter((m: any) => m.id !== 'm1' && m.id !== 'm2' && m.id !== 'm3') : [];
      } catch (e) {}
    }
    setMultas(parsedFines);
    localStorage.setItem("risel_frota_multas", JSON.stringify(parsedFines));

    // 5. Abastecimentos (Banco Supabase Real por padrão)
    fetchAbastecimentosSupabase().then(supabaseData => {
      if (supabaseData && supabaseData.length > 0) {
        setAbastecimentos(supabaseData);
        localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(supabaseData));
      } else {
        // Se não houver dados no Supabase, inicia zerado para importar dos CSVs
        setAbastecimentos([]);
        localStorage.setItem("risel_frota_abastecimentos", "[]");
      }
    }).catch(err => {
      console.warn("Aviso ao buscar abastecimentos do Supabase:", err);
      setAbastecimentos([]);
      localStorage.setItem("risel_frota_abastecimentos", "[]");
    });

    // 6. Manutenções
    const savedMaint = localStorage.getItem("risel_frota_manutencoes");
    let parsedMaint: Manutencao[] = [];
    if (savedMaint) {
      try { parsedMaint = JSON.parse(savedMaint); } catch (e) {}
    }
    const hasInvalidMaint = parsedMaint.length === 0 || parsedMaint.some(m => !isAllowedPlate(m.placa));
    if (hasInvalidMaint) {
      const initialMaint: Manutencao[] = [
        { id: "mn1", placa: "SYL0A69", tipo: "Corretiva", descricao: "Substituição de pastilhas de freio dianteiras e traseiras", data: "2026-06-29", odometro: 92390, custo: 850.00, oficina: "Oficina Multimarcas Macaé" },
        { id: "mn2", placa: "SYL0A67", tipo: "Preventiva", descricao: "Revisão periódica de 40.000km (óleo, filtros, suspensão)", data: "2026-05-10", odometro: 40100, custo: 620.00, oficina: "Concessionária Fiat Paulínia" },
      ];
      setManutencoes(initialMaint);
      localStorage.setItem("risel_frota_manutencoes", JSON.stringify(initialMaint));
    } else {
      setManutencoes(parsedMaint);
    }

    // 7. Pedagios
    const savedTolls = localStorage.getItem("risel_frota_pedagios");
    let parsedTolls: Pedagio[] = [];
    if (savedTolls) {
      try { parsedTolls = JSON.parse(savedTolls); } catch (e) {}
    }
    if (parsedTolls.length === 0) {
      const initialTolls: Pedagio[] = [
        { id: "pd1", placa: "SYL0A67", data: "2026-07-02", valor: 14.50, base: "Base Paulínia", condutor: "Carlos Alberto Souza", locadora: "Localiza" },
        { id: "pd2", placa: "SYL0A68", data: "2026-06-25", valor: 10.20, base: "Base Macaé", condutor: "Ana Beatriz Nogueira", locadora: "Movida" }
      ];
      setPedagios(initialTolls);
      localStorage.setItem("risel_frota_pedagios", JSON.stringify(initialTolls));
    } else {
      setPedagios(parsedTolls);
    }

  }, []);

  // Auto-sync Google Sheets on mount if enabled and token exists
  useEffect(() => {
    const isSheetsEnabled = localStorage.getItem("google_sheets_enabled") === "true";
    const cachedToken = getAccessToken();
    if (isSheetsEnabled && cachedToken && veiculos.length > 0) {
      handleSyncGoogleSheets(cachedToken);
    }
  }, [veiculos.length]);

  const [isChecklistsLoading, setIsChecklistsLoading] = useState(false);

  useEffect(() => {
    const loadChecklistsData = async () => {
      setIsChecklistsLoading(true);
      try {
        console.log("Auditoria de Veículos: Buscando checklists da planilha do Google...");
        const response = await fetch("/api/checklist/data");
        if (!response.ok) {
          throw new Error("Erro ao buscar dados do Google Sheets");
        }
        const sheetsData: Checklist[] = await response.json();
        
        // Buscando também do Firebase Firestore
        let firebaseData: Checklist[] = [];
        try {
          const fbChecklists = await getFirebaseChecklists();
          firebaseData = fbChecklists as any[];
        } catch (fbErr) {
          console.warn("Falha ao buscar do Firebase, usando apenas planilha:", fbErr);
        }

        // Carregar locais de backup
        const localChecks = localStorage.getItem("risel_frota_checklists");
        let parsedLocal: Checklist[] = [];
        if (localChecks) {
          try { parsedLocal = JSON.parse(localChecks); } catch (e) {}
        }

        // Carregar IDs deletados localmente para garantir ocultação permanente da planilha
        const deletedIdsStr = localStorage.getItem("risel_frota_deleted_checklist_ids");
        let deletedIdsList: string[] = [];
        if (deletedIdsStr) {
          try { deletedIdsList = JSON.parse(deletedIdsStr); } catch (e) {}
        }

        const activeSheetsData = sheetsData.filter(item => !deletedIdsList.includes(item.id));
        const activeFirebaseData = firebaseData.filter(item => !deletedIdsList.includes(item.id));
        const activeLocalData = parsedLocal.filter(item => !deletedIdsList.includes(item.id));

        // Fundir os arrays sem duplicar (priorizando o mais recente por data/id)
        const allMerged: Checklist[] = [...activeFirebaseData, ...activeLocalData, ...activeSheetsData];
        const uniqueChecklistsMap = new Map<string, Checklist>();
        allMerged.forEach(item => {
          const uniqueKey = item.id || `${item.placa}_${item.data}_${item.odometro}`;
          if (!uniqueChecklistsMap.has(uniqueKey)) {
            uniqueChecklistsMap.set(uniqueKey, item);
          }
        });

        // Helper robusto local para converter formatos de data para comparação numérica de timestamp
        const parseDateToComparableLocal = (val: string): number => {
          if (!val) return 0;
          try {
            const clean = val.replace(",", "").trim();
            if (clean.includes("/")) {
              const parts = clean.split(" ");
              const datePart = parts[0];
              const timePart = parts[1] || "00:00:00";
              const [d, m, y] = datePart.split("/");
              const [hr, min, sec] = timePart.split(":");
              const isoStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hr.padStart(2, "0")}:${min.padStart(2, "0")}:${sec ? sec.padStart(2, "0") : "00"}`;
              const t = new Date(isoStr).getTime();
              return isNaN(t) ? 0 : t;
            }
            if (clean.includes("-")) {
              const parts = clean.replace("T", " ").split(" ");
              const datePart = parts[0];
              const timePart = parts[1] || "12:00:00";
              const [y, m, d] = datePart.split("-");
              const [hr, min, sec] = timePart.split(":");
              const isoStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hr.padStart(2, "0")}:${min.padStart(2, "0")}:${sec ? sec.padStart(2, "0") : "00"}`;
              const t = new Date(isoStr).getTime();
              return isNaN(t) ? 0 : t;
            }
            const t = new Date(clean).getTime();
            return isNaN(t) ? 0 : t;
          } catch (e) {
            return 0;
          }
        };

        const finalSortedChecklists = Array.from(uniqueChecklistsMap.values()).sort((a, b) => {
          const timeA = parseDateToComparableLocal(a.timestamp || a.data || "");
          const timeB = parseDateToComparableLocal(b.timestamp || b.data || "");
          return timeB - timeA; // Descrescente: o mais recente no topo
        });

        setChecklists(finalSortedChecklists);
      } catch (error) {
        console.error("Erro ao carregar dados do submódulo de checklists:", error);
      } finally {
        setIsChecklistsLoading(false);
      }
    };

    loadChecklistsData();
  }, []);

  const handleDeleteChecklist = async (id: string) => {
    // 1. Atualizar o estado da UI instantaneamente para excelente responsividade
    setChecklists(prev => prev.filter(c => c.id !== id));

    // 2. Registrar ID deletado localmente para garantir filtragem permanente
    const deletedIdsStr = localStorage.getItem("risel_frota_deleted_checklist_ids");
    let deletedIdsList: string[] = [];
    if (deletedIdsStr) {
      try { deletedIdsList = JSON.parse(deletedIdsStr); } catch (e) {}
    }
    if (!deletedIdsList.includes(id)) {
      deletedIdsList.push(id);
      localStorage.setItem("risel_frota_deleted_checklist_ids", JSON.stringify(deletedIdsList));
    }

    const savedCheck = localStorage.getItem("risel_frota_checklists");
    if (savedCheck) {
      try {
        const parsed: any[] = JSON.parse(savedCheck);
        const filtered = parsed.filter(c => c.id !== id);
        localStorage.setItem("risel_frota_checklists", JSON.stringify(filtered));
      } catch (e) {
        console.error("Erro ao remover checklist do localStorage:", e);
      }
    }

    // 3. Deletar do Firebase em segundo plano sem travar a UI do usuário
    try {
      deleteFirebaseChecklist(id).catch(err => {
        console.warn("Falha silenciosa ao remover do Firebase:", err);
      });
    } catch (err) {
      console.warn("Falha ao chamar deleteFirebaseChecklist:", err);
    }
  };

  const [geoPositions, setGeoPositions] = useState<any[]>([]);
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  useEffect(() => {
    const loadGeoFrotasData = async () => {
      setIsGeoLoading(true);
      try {
        console.log("Painel de Frotas: Carregando últimas posições do GeoFrotas...");
        const positions = await fetchFleetPositions();
        if (positions && positions.length > 0) {
          setGeoPositions(positions);
          
          const getFleetDetails = (plate: string, apiModel?: string) => {
            const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const isGeneric = !apiModel || apiModel.toLowerCase().includes('importado') || apiModel.toLowerCase().includes('veículo') || apiModel.trim() === '';
            let model = !isGeneric ? apiModel! : '';
            let year = 2023;
            const charCodeSum = clean.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);

            if (clean.startsWith("TZA")) {
                if (isGeneric) model = ["Fiat Mobi Like", "VW Gol Trendline", "Chevrolet Onix Turbo"][charCodeSum % 3];
                year = [2022, 2023][charCodeSum % 2];
            } else if (clean.startsWith("SYL") || clean.startsWith("SIL") || clean.startsWith("SIU")) {
                if (isGeneric) model = ["Hyundai HB20 Sense", "Fiat Argo Drive", "Peugeot 208 Style"][charCodeSum % 3];
                year = [2023, 2024][charCodeSum % 2];
            } else if (clean.startsWith("TYA") || clean.startsWith("TYK") || clean.startsWith("TYP")) {
                if (isGeneric) model = ["VW Polo Track", "Chevrolet Onix LT", "Renault Kwid Zen"][charCodeSum % 3];
                year = [2024, 2025][charCodeSum % 2];
            } else if (clean.startsWith("SJF") || clean.startsWith("SHT")) {
                if (isGeneric) model = ["Fiat Cronos Drive", "Toyota Yaris Sedan"][charCodeSum % 2];
                year = 2023;
            } else {
                if (isGeneric) model = "Fiat Mobi Like";
                year = 2023;
            }
            return { model, year };
          };

          const bases = ['Paulínia (Sede)', 'Posto ABC (Campinas)', 'Filial Rio de Janeiro', 'Filial Espírito Santo'];
          const motoristas = ['Carlos Alberto Souza', 'Ana Beatriz Nogueira', 'Roberto Carlos Lima', 'Juliana Silveira Dias', 'Pedro Henrique Albuquerque', 'Marcos Mendes'];
          const funcoes = ['Técnico de Campo', 'Supervisora Comercial', 'Engenheiro Técnico', 'Suporte Técnico', 'Coord. Operações'];

          const apiVehicles: Veiculo[] = positions.map((pos) => {
            const details = getFleetDetails(pos.plate, pos.model);
            const clean = pos.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const charCodeSum = clean.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            
            return {
              id: `geo-${clean}`,
              placa: pos.plate.toUpperCase(),
              modelo: details.model,
              vencContrato: "2027-12-31",
              condutor: pos.driverName || motoristas[charCodeSum % motoristas.length],
              funcao: funcoes[charCodeSum % funcoes.length],
              contatoMotorista: "(19) 99877-6655",
              gestorResp: "Deny Gonçalves",
              email: "deny.goncalves@risel.com.br",
              filial: "Paulínia",
              locadora: "Localiza Gestão de Frotas",
              contrato: "Risel",
              odometro: typeof pos.odometer === 'number' ? pos.odometer : 45000 + (charCodeSum * 10) % 20000,
              combustivel: "Flex",
              status: "Ativo"
            };
          });

          setVeiculos(prev => {
            const currentList = prev.length > 0 ? prev : VEICULOS_REAIS;
            const updated = currentList.map(v => {
              const cleanV = v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              const matchingGeo = apiVehicles.find(a => a.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanV);
              if (matchingGeo) {
                return {
                  ...v,
                  odometro: matchingGeo.odometro > v.odometro ? matchingGeo.odometro : v.odometro,
                };
              }
              return v;
            });
            localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error("Erro ao sincronizar dados do GeoFrotas para o painel de frotas:", err);
      } finally {
        setIsGeoLoading(false);
      }
    };

    loadGeoFrotasData();

    // Configura polling de sincronização com o GeoFrotas de 7 em 7 minutos (420.000ms)
    const intervalId = setInterval(() => {
      console.log("Sincronização periódica de 7 minutos disparada para atualizar dados do GeoFrotas...");
      loadGeoFrotasData();
    }, 7 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const saveVeiculos = (data: Veiculo[]) => {
    setVeiculos(data);
    localStorage.setItem("risel_frota_veiculos_v2", JSON.stringify(data));

    // Salvar/Sincronizar de imediato no banco Supabase (Veículos e Contratos)
    saveBatchVeiculosSupabase(data).catch(e => console.warn("Aviso ao salvar veículos no Supabase:", e));
    const contratosBatch = data.filter(v => Boolean(v.vencContrato)).map(v => ({
      id: `cto-${v.placa}`,
      numero: v.contrato || `CTO-${v.placa}`,
      veiculoPlaca: v.placa,
      fornecedor: v.locadora || "Locadora",
      tipoContrato: "Locação",
      dataVencimento: v.vencContrato,
      status: "Ativo"
    }));
    saveBatchContratosSupabase(contratosBatch).catch(e => console.warn("Aviso ao salvar contratos no Supabase:", e));

    // Sincronizar de imediato com a aba gid=0 da planilha do Google se houver conexão ativa
    const activeToken = googleToken || getAccessToken();
    if (activeToken) {
      saveVehiclesToSheets(activeToken, data).catch(err => {
        console.error("Erro ao salvar veículos na Planilha Google (gid=0):", err);
      });
    }
  };

  const saveChecklists = (data: Checklist[]) => {
    setChecklists(data);
    localStorage.setItem("risel_frota_checklists", JSON.stringify(data));
  };

  const saveReservas = (data: Reserva[]) => {
    setReservas(data);
    localStorage.setItem("risel_frota_reservas", JSON.stringify(data));
  };

  const saveMultas = (data: Multa[]) => {
    setMultas(data);
    localStorage.setItem("risel_frota_multas", JSON.stringify(data));
  };

  const saveAbastecimentos = (data: Abastecimento[]) => {
    setAbastecimentos(data);
    localStorage.setItem("risel_frota_abastecimentos", JSON.stringify(data));
    saveBatchAbastecimentosSupabase(data).catch(e => console.warn("Aviso ao salvar abastecimentos no Supabase:", e));
  };

  const saveManutencoes = (data: Manutencao[]) => {
    setManutencoes(data);
    localStorage.setItem("risel_frota_manutencoes", JSON.stringify(data));
  };

  // Dynamic calculations
  const formatDateSafe = (dateStr?: string | null): string => {
    if (!dateStr) return "N/D";
    try {
      const cleanStr = String(dateStr).trim();
      if (!cleanStr) return "N/D";
      let d: Date;
      if (cleanStr.includes("T")) {
        d = new Date(cleanStr);
      } else if (cleanStr.includes("-")) {
        d = new Date(cleanStr + "T12:00:00");
      } else if (cleanStr.includes("/")) {
        const parts = cleanStr.split("/");
        if (parts.length === 3) {
          d = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T12:00:00`);
        } else {
          d = new Date(cleanStr);
        }
      } else {
        d = new Date(cleanStr);
      }
      if (isNaN(d.getTime())) return cleanStr;
      return d.toLocaleDateString("pt-BR");
    } catch (e) {
      return String(dateStr) || "N/D";
    }
  };

  const diasParaVencimento = (dataVenc?: string | null, dataInativacao?: string | null, status?: string) => {
    if (!dataVenc) return 9999;
    try {
      const cleanStr = String(dataVenc).trim();
      if (!cleanStr) return 9999;

      // Data de referência: data de inativação para veículos inativos, ou data atual do sistema para os demais
      const now = new Date();
      let ref = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

      if (status === "Inativo" && dataInativacao && String(dataInativacao).trim()) {
        const inatStr = String(dataInativacao).trim();
        if (inatStr.includes("/")) {
          const p = inatStr.split("/");
          if (p.length === 3) ref = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10), 12, 0, 0);
        } else if (inatStr.includes("-")) {
          const p = inatStr.split("T")[0].split("-");
          if (p.length === 3) ref = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0);
        }
      }

      let venc: Date | null = null;
      if (cleanStr.includes("/")) {
        const parts = cleanStr.split("/");
        if (parts.length === 3) {
          venc = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0);
        }
      } else if (cleanStr.includes("-")) {
        const parts = cleanStr.split("T")[0].split("-");
        if (parts.length === 3) {
          venc = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
        }
      }

      if (!venc || isNaN(venc.getTime())) {
        const fallback = new Date(cleanStr);
        if (isNaN(fallback.getTime())) return 9999;
        venc = new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
      }

      const diffTime = venc.getTime() - ref.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
      return 9999;
    }
  };

  const getStatusContrato = (dataVenc: string) => {
    const dias = diasParaVencimento(dataVenc);
    if (dias < 0) return { label: "Vencido", color: "text-rose-700 bg-rose-50 border-rose-200" };
    if (dias <= 30) return { label: "Vence em breve", color: "text-orange-700 bg-orange-50 border-orange-200" };
    if (dias <= 90) return { label: "Próximo (≤90d)", color: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "Ativo", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  };

  // Filter lists
  const filiaisList = useMemo(() => {
    return ["Todos", ...Array.from(new Set(veiculos.map(v => v.filial)))];
  }, [veiculos]);

  const filteredVeiculos = useMemo(() => {
    const list = veiculos.filter(v => {
      const matchesSearch = 
        v.placa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.condutor.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilial = filterFilial === "Todos" || v.filial === filterFilial;
      const matchesStatus = filterStatus === "Todos" || v.status === filterStatus;

      return matchesSearch && matchesFilial && matchesStatus;
    });

    // Sort list
    list.sort((a, b) => {
      if (sortField === "diasRestantes") {
        const diasA = diasParaVencimento(a.vencContrato, a.dataInativacao, a.status);
        const diasB = diasParaVencimento(b.vencContrato, b.dataInativacao, b.status);
        return sortDirection === "asc" ? diasA - diasB : diasB - diasA;
      }

      let valA: any = a[sortField] !== undefined ? a[sortField] : "";
      let valB: any = b[sortField] !== undefined ? b[sortField] : "";

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [veiculos, searchQuery, filterFilial, filterStatus, sortField, sortDirection]);

  // Statistics summaries - 4 main metrics of Controle de Frota (Dinamizados de acordo com filtros ativos)
  const stats = useMemo(() => {
    const targetVehicles = filteredVeiculos;
    const total = targetVehicles.length;
    const ativos = targetVehicles.filter(v => v.status !== "Inativo").length;
    const inativos = targetVehicles.filter(v => v.status === "Inativo").length;
    const manutencao = targetVehicles.filter(v => v.status === "Em Manutenção").length;
    
    // Contratos vencidos ou vencendo em 90 dias ou menos
    const contratosProximos90 = targetVehicles.filter(v => {
      if (v.status === "Inativo") return false;
      if (!v.vencContrato || !v.vencContrato.trim()) return false;
      const d = diasParaVencimento(v.vencContrato, v.dataInativacao, v.status);
      return d <= 90;
    }).length;

    const alertaVenc30 = targetVehicles.filter(v => {
      if (v.status === "Inativo") return false;
      if (!v.vencContrato || !v.vencContrato.trim()) return false;
      const d = diasParaVencimento(v.vencContrato, v.dataInativacao, v.status);
      return d <= 30;
    }).length;

    const odometroTotal = targetVehicles.reduce((acc, curr) => acc + (curr.odometro || 0), 0);

    return { total, ativos, inativos, manutencao, contratosProximos90, alertaVenc30, odometroTotal };
  }, [filteredVeiculos]);

  // Lista dinamizada para exibição na tabela (filtro de 90 dias ou vencidos com ordenação por proximidade de vencimento)
  const displayedFrotaVeiculos = useMemo(() => {
    if (subSectionFrota === "vencidos") {
      return filteredVeiculos
        .filter(v => v.status !== "Inativo" && Boolean(v.vencContrato && v.vencContrato.trim()) && diasParaVencimento(v.vencContrato, v.dataInativacao, v.status) <= 90)
        .sort((a, b) => {
          const diasA = diasParaVencimento(a.vencContrato, a.dataInativacao, a.status);
          const diasB = diasParaVencimento(b.vencContrato, b.dataInativacao, b.status);
          return diasA - diasB;
        });
    }
    return filteredVeiculos;
  }, [filteredVeiculos, subSectionFrota]);

  // Handle forms
  const handleAddEditVeiculo = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = editingVeh ? editingVeh.id : String(Date.now());
    
    const cleanUpper = (val: any) => val ? String(val).toUpperCase().trim() : "";
    const cleanEmail = (val: any) => val ? String(val).toLowerCase().trim() : "";

    const locadoraFinal = modalLocadora === "OUTRA" ? customLocadora.toUpperCase().trim() : modalLocadora.toUpperCase().trim();
    const isFrotaPropria = locadoraFinal === "FROTA PRÓPRIA";

    const placaFinal = cleanUpper(formData.get("placa"));
    const matchingGeo = geoPositions.find(gp => gp.plate && gp.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placaFinal.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    const odometroFinal = (matchingGeo && typeof matchingGeo.odometer === 'number') 
      ? matchingGeo.odometer 
      : Number(formData.get("odometro") || 0);

    const selectedStatus = (formData.get("status") as Veiculo["status"]) || modalStatus as Veiculo["status"];
    const inputDataInativacao = formData.get("dataInativacao") as string || modalDataInativacao;
    const inputMotivoInativacao = formData.get("motivoInativacao") as string || modalMotivoInativacao;

    const data: Veiculo = {
      id,
      placa: placaFinal,
      modelo: cleanUpper(formData.get("modelo")),
      vencContrato: isFrotaPropria ? "" : (formData.get("vencContrato") as string || ""),
      condutor: cleanUpper(formData.get("condutor")),
      funcao: cleanUpper(formData.get("funcao")),
      contatoMotorista: cleanUpper(formData.get("contatoMotorista")),
      gestorResp: cleanUpper(formData.get("gestorResp")),
      email: cleanEmail(formData.get("email")),
      filial: cleanUpper(formData.get("filial")),
      locadora: locadoraFinal,
      contrato: cleanUpper(formData.get("contrato")),
      odometro: odometroFinal,
      combustivel: cleanUpper(formData.get("combustivel")),
      status: selectedStatus,
      dataTrocaCondutor: formData.get("dataTrocaCondutor") as string || HOJE_REF,
      dataInativacao: selectedStatus === "Inativo" ? (inputDataInativacao || HOJE_REF) : (editingVeh?.dataInativacao || ""),
      motivoInativacao: selectedStatus === "Inativo" ? inputMotivoInativacao : (editingVeh?.motivoInativacao || ""),
    };

    let updated;
    if (editingVeh) {
      updated = veiculos.map(v => v.id === id ? data : v);
    } else {
      updated = [...veiculos, data];
    }
    saveVeiculos(updated);
    setIsVehModalOpen(false);
    setEditingVeh(null);
  };

  const handleAddChecklist = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const placa = formData.get("placa") as string;
    const condutor = veiculos.find(v => v.placa === placa)?.condutor || "Motorista Risel";
    const odometro = Number(formData.get("odometro") || 0);

    const checklist: Checklist = {
      id: String(Date.now()),
      placa,
      condutor,
      data: HOJE_REF,
      odometro,
      itens: {
        pneus: formData.get("pneus") as any,
        freios: formData.get("freios") as any,
        farois: formData.get("farois") as any,
        seguranca: formData.get("seguranca") as any,
        fluidos: formData.get("fluidos") as any,
        lataria: formData.get("lataria") as any,
      },
      observacoes: formData.get("observacoes") as string,
      status: formData.get("status") as any,
    };

    saveChecklists([checklist, ...checklists]);

    // Update vehicle odometer and status if retido
    const updatedVehs = veiculos.map(v => {
      if (v.placa === placa) {
        return {
          ...v,
          odometro: odometro > v.odometro ? odometro : v.odometro,
          status: checklist.status === "Retido" ? "Em Manutenção" as const : v.status
        };
      }
      return v;
    });
    saveVeiculos(updatedVehs);
    setIsCheckModalOpen(false);
  };

  const handleAddReserva = (e: any) => {
    e.preventDefault();
    setReservaError(null);
    const formData = new FormData(e.target);
    const placa = formData.get("placa") as string;
    const deStr = formData.get("de") as string;
    const ateStr = formData.get("ate") as string;
    const destino = formData.get("destino") as string;

    if (!placa || !deStr || !ateStr || !destino) {
      setReservaError("Todos os campos obrigatórios (*) devem ser preenchidos.");
      return;
    }

    const start = new Date(deStr).getTime();
    const end = new Date(ateStr).getTime();

    if (start >= end) {
      setReservaError("A data/hora de devolução deve ser após a data/hora de início.");
      return;
    }

    // Check conflict
    const hasConflict = reservas.some(r => {
      if (r.placa !== placa) return false;
      if (r.status === "Cancelada" || r.status === "Finalizada") return false;
      const rStart = new Date(r.de).getTime();
      const rEnd = new Date(r.ate).getTime();
      return (start < rEnd && end > rStart);
    });

    if (hasConflict) {
      const conflictRes = reservas.find(r => {
        if (r.placa !== placa) return false;
        if (r.status === "Cancelada" || r.status === "Finalizada") return false;
        const rStart = new Date(r.de).getTime();
        const rEnd = new Date(r.ate).getTime();
        return (start < rEnd && end > rStart);
      });
      const motoristaName = conflictRes?.condutor || "outro motorista";
      setReservaError(`O veículo ${placa} já está reservado por ${motoristaName} neste período.`);
      return;
    }

    const condutor = veiculos.find(v => v.placa === placa)?.condutor || "Motorista";

    const res: Reserva = {
      id: String(Date.now()),
      placa,
      condutor,
      de: deStr,
      ate: ateStr,
      destino,
      status: "Confirmada",
    };

    saveReservas([res, ...reservas]);

    // Set vehicle status to Reservado
    saveVeiculos(veiculos.map(v => v.placa === placa ? { ...v, status: "Reservado" as const } : v));
    setIsResModalOpen(false);
  };

  const handleAddMulta = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const placa = formData.get("placa") as string;
    const condutor = veiculos.find(v => v.placa === placa)?.condutor || "Motorista";

    const fine: Multa = {
      id: String(Date.now()),
      placa,
      condutor,
      infracao: formData.get("infracao") as string,
      data: formData.get("data") as string,
      valor: Number(formData.get("valor") || 0),
      pontos: Number(formData.get("pontos") || 0),
      pagamento: "Aberto",
      defesa: "Não Iniciada",
    };

    saveMultas([fine, ...multas]);
    setIsFineModalOpen(false);
  };

  const handleAddAbastecimento = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const placa = formData.get("placa") as string;
    const odom = Number(formData.get("odometro") || 0);

    const vehicle = veiculos.find(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    const fuel: Abastecimento = {
      id: String(Date.now()),
      placa,
      base: vehicle?.filial || "",
      condutor: "",
      data: formData.get("data") as string,
      kmPercorrido: odom, // storing odometro here as fallback, though it means KM percorrido in CSV. Wait, no. We'll set kmPercorrido as 0 for manual input if it's an odometer reading.
      litros: Number(formData.get("litros") || 0),
      valorTotal: Number(formData.get("valorTotal") || 0),
      combustivel: "",
      posto: formData.get("posto") as string,
      cidade: ""
    };

    saveAbastecimentos([fuel, ...abastecimentos]);

    // Update vehicle odometer
    saveVeiculos(veiculos.map(v => v.placa === placa ? { ...v, odometro: odom > v.odometro ? odom : v.odometro } : v));
    setIsFuelModalOpen(false);
  };

  const handleAddManutencao = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const placa = formData.get("placa") as string;
    const odom = Number(formData.get("odometro") || 0);

    const maint: Manutencao = {
      id: String(Date.now()),
      placa,
      tipo: formData.get("tipo") as any,
      descricao: formData.get("descricao") as string,
      data: formData.get("data") as string,
      odometro: odom,
      custo: Number(formData.get("custo") || 0),
      oficina: formData.get("oficina") as string,
    };

    saveManutencoes([maint, ...manutencoes]);

    // Set vehicle status to Em Manutenção or update odometer
    saveVeiculos(veiculos.map(v => v.placa === placa ? { 
      ...v, 
      odometro: odom > v.odometro ? odom : v.odometro,
      status: "Em Manutenção" as const
    } : v));
    setIsMaintModalOpen(false);
  };

  // Average fuel consumption helper per vehicle
  const getConsumoMedio = (placa: string) => {
    const list = abastecimentos.filter(f => f.placa === placa).sort((a,b) => a.odometro - b.odometro);
    if (list.length < 2) return "N/D";
    const deltaKm = list[list.length - 1].odometro - list[0].odometro;
    const totalLitros = list.slice(1).reduce((sum, item) => sum + item.litros, 0);
    if (totalLitros === 0 || deltaKm <= 0) return "N/D";
    return `${(deltaKm / totalLitros).toFixed(2)} km/L`;
  };

  if (activeTab !== "portal" && !authenticatedTabs[activeTab]) {
    return (
      <SubModuleAuthScreen
        tab={activeTab}
        onSuccess={() => handleAuthenticateSubModule(activeTab)}
        onBack={() => setActiveTab("portal")}
      />
    );
  }

  if (activeTab === "portal") {
    return (
      <div className="space-y-6 w-full text-slate-800">
        <div className="h-full flex flex-col justify-center max-w-6xl mx-auto py-8">
          {/* Barra Superior do Portal com Retorno e Perfil */}
          <div className="flex justify-between items-center mb-6 px-4">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all duration-300 shadow-2xs hover:shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Início
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase hidden sm:inline">Risel ERP · Gestão de Frota</span>
              <UserProfileBadge />
            </div>
          </div>

          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 mx-auto mb-6"
            >
              <Truck className="w-8 h-8" />
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-display font-black text-slate-800 tracking-tight"
            >
              Módulo de <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">Frota Leve</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-slate-500 mt-3 max-w-2xl mx-auto font-medium"
            >
              Selecione uma das áreas operacionais abaixo para realizar vistorias, gerenciar reservas, acompanhar infrações ou rastrear veículos.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hasSubmoduleAccess(user?.permissions, "checklist") && (
              <SubModuleCard
                title="Checklist Digital"
                description="Vistorias eletrônicas de pneus, freios, faróis, fluidos e lataria enviadas diretamente pelos motoristas."
                icon={CheckSquare}
                onClick={() => setActiveTab("checklist")}
                theme="emerald"
                delay={0.15}
              />
            )}
            {hasSubmoduleAccess(user?.permissions, "frota") && (
              <SubModuleCard
                title="Controle de Frota"
                description="Gestão completa de veículos leves, quilometragem, condutores cadastrados e vencimentos de contratos."
                icon={Truck}
                onClick={() => setActiveTab("frota")}
                theme="orange"
                delay={0.2}
              />
            )}
            {hasSubmoduleAccess(user?.permissions, "multas") && (
              <SubModuleCard
                title="Controle de Multas"
                description="Acompanhamento de infrações de trânsito, atribuição de condutores e recursos de defesa prévia."
                icon={ShieldAlert}
                onClick={() => setActiveTab("multas")}
                theme="rose"
                delay={0.25}
              />
            )}
            {hasSubmoduleAccess(user?.permissions, "reservas") && (
              <SubModuleCard
                title="Gestão de Reservas"
                description="Agendamento e controle de uso de veículos compartilhados para evitar conflitos de rotas de campo."
                icon={Calendar}
                onClick={() => setActiveTab("reservas")}
                theme="blue"
                delay={0.3}
              />
            )}
            {hasSubmoduleAccess(user?.permissions, "rastreamento") && (
              <SubModuleCard
                title="Rastreamento Ativo"
                description="Monitoramento geográfico em tempo real, telemetria de velocidade e alertas operacionais."
                icon={Navigation}
                onClick={() => setActiveTab("rastreamento")}
                theme="violet"
                delay={0.35}
              />
            )}
          </div>

          <div className="text-center mt-12">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-orange-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSubmoduleAccess(user?.permissions, activeTab)) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md">
          Seu usuário não possui permissão para acessar este submódulo. Solicite a liberação de acesso ao seu administrador.
        </p>
        <button
          onClick={() => setActiveTab("portal")}
          className="mt-6 px-5 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
        >
          Voltar ao Portal da Frota
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-3 w-full text-slate-800 relative">
      {/* Excel-like Static Top Section (Header, Navigation Tabs, 5 Indicators) */}
      <div 
        className="shrink-0 bg-slate-50 -mx-2 px-2 pt-0.5 pb-2 border-b border-slate-200/80 shadow-2xs space-y-2.5"
        onWheel={(e) => {
          if (mainFrotaTableScrollRef.current) {
            mainFrotaTableScrollRef.current.scrollTop += e.deltaY;
          }
        }}
      >
        {/* Top Header Card: Identidade à Esquerda e Usuário Logado no Topo Superior Direito */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs relative">
          {/* Lado Esquerdo: Identidade Visual e Breadcrumbs */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-sm shadow-orange-500/20 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <Link to="/" className="text-[10px] font-bold text-slate-400 hover:text-orange-600 transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-2.5 h-2.5" /> Início
                </Link>
                <span className="text-[10px] text-slate-300">/</span>
                <button onClick={() => setActiveTab("portal")} className="text-[10px] font-bold text-slate-400 hover:text-orange-600 transition-colors cursor-pointer bg-transparent border-none p-0 outline-none">
                  Portal de Frota Leve
                </button>
                <span className="text-[10px] text-slate-300">/</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">{activeTab}</span>
              </div>
              <h1 className="text-lg font-display font-black text-slate-800 tracking-tight leading-tight mt-0.5">
                {activeTab === "frota" && "Controle de Frota Leve"}
                {activeTab === "checklist" && "Checklist Digital"}
                {activeTab === "reservas" && "Gestão de Reservas"}
                {activeTab === "multas" && "Controle de Multas"}
                {activeTab === "rastreamento" && "Rastreamento & Telemetria"}
              </h1>
            </div>
          </div>

          {/* Canto Superior Direito: Dados do Usuário Logado */}
          <div className="flex items-center justify-end shrink-0">
            <UserProfileBadge />
          </div>
        </div>

        {/* Barra de Menus / Abas da Frota Logo Embaixo */}
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0">
          {[
            { id: "portal", label: "Menu da Frota", icon: LayoutGrid },
            { id: "frota", label: "Controle de Frota Leve", icon: Truck },
            { id: "checklist", label: "Checklist", icon: CheckSquare },
            { id: "reservas", label: "Gestão de Reservas", icon: Calendar },
            { id: "multas", label: "Multas", icon: ShieldAlert },
            { id: "rastreamento", label: "Rastreamento", icon: Navigation }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchQuery("");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-white text-orange-600 shadow-2xs border border-orange-200/60 font-black" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-orange-600" : "text-slate-400"}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Top Counters Summary Row - 4 Principal Indicators with Rectangular Style & Spring Transitions */}
        {activeTab !== "reservas" && activeTab !== "rastreamento" && activeTab !== "checklist" && activeTab !== "multas" && subSectionFrota !== "custos" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { 
                label: "Total Frota", 
                value: stats.total, 
                sub: "Veículos cadastrados", 
                gradient: "from-orange-500 to-amber-500", 
                icon: Truck, 
                textColor: "text-orange-600",
                bgLight: "bg-orange-50/70",
                gradientBg: "from-white via-orange-50/15 to-orange-500/[0.04]",
                borderColor: "border-orange-200/80 hover:border-orange-300",
                glowColor: "hover:shadow-orange-200/40"
              },
              { 
                label: "Total Frota Ativa", 
                value: stats.ativos, 
                sub: "Veículos operacionais", 
                gradient: "from-blue-500 to-indigo-500", 
                icon: CheckCircle, 
                textColor: "text-blue-600",
                bgLight: "bg-blue-50/70",
                gradientBg: "from-white via-blue-50/15 to-blue-500/[0.04]",
                borderColor: "border-blue-200/80 hover:border-blue-300",
                glowColor: "hover:shadow-blue-200/40"
              },
              { 
                label: "Total Frota Inativa", 
                value: stats.inativos, 
                sub: "Veículos desativados", 
                gradient: "from-rose-500 to-red-500", 
                icon: AlertTriangle, 
                textColor: "text-rose-600",
                bgLight: "bg-rose-50/70",
                gradientBg: "from-white via-rose-50/15 to-rose-500/[0.04]",
                borderColor: "border-rose-200/80 hover:border-rose-300",
                glowColor: "hover:shadow-rose-200/40"
              },
              { 
                label: "Odômetro Total", 
                value: `${stats.odometroTotal.toLocaleString("pt-BR")} km`, 
                sub: "Distância acumulada", 
                gradient: "from-violet-500 to-purple-500", 
                icon: Gauge, 
                textColor: "text-violet-600",
                bgLight: "bg-violet-50/70",
                gradientBg: "from-white via-violet-50/15 to-violet-500/[0.04]",
                borderColor: "border-violet-200/80 hover:border-violet-300",
                glowColor: "hover:shadow-violet-200/40"
              },
            ].map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 280, 
                  damping: 22, 
                  delay: idx * 0.04 
                }}
                className={`p-4 rounded-2xl border ${item.borderColor} shadow-2xs flex flex-col justify-between relative overflow-hidden bg-gradient-to-br ${item.gradientBg} ${item.glowColor} transition-all duration-300 min-h-[96px]`}
              >
                {/* Decorative background glow */}
                <div className={`absolute -right-8 -bottom-8 w-20 h-20 rounded-full bg-gradient-to-br ${item.gradient} opacity-[0.07] blur-lg pointer-events-none`} />
                
                <div className="flex justify-between items-start gap-2 relative z-10">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">{item.label}</span>
                  <div className={`w-7 h-7 rounded-lg ${item.bgLight} flex items-center justify-center shrink-0 border border-slate-200/40`}>
                    <item.icon className={`w-3.5 h-3.5 ${item.textColor}`} />
                  </div>
                </div>
                <div className="mt-2 relative z-10 text-left">
                  <span className={`text-xl sm:text-2xl font-display font-black bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent block tracking-tight leading-none`}>{item.value}</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">{item.sub}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Main Tab Panels Content */}
      <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {/* TAB 1: CONTROLE DE FROTA LEVE (VEHICLES LIST) */}
        {activeTab === "frota" && (
          <SubSystemLayout
            activeTab="Controle de Frota Leve"
            menuItems={[
              { id: "veiculos", label: "Todos os Veículos", icon: Truck },
              { id: "vencidos", label: "Contratos Próximos", icon: Clock },
              { id: "custos", label: "Abastecimento", icon: DollarSign }
            ]}
            activeSubSection={subSectionFrota}
            setActiveSubSection={setSubSectionFrota}
            hideSidebar={true}
          >
            {subSectionFrota === "custos" ? (
              <div className="flex-1 min-h-0 flex flex-col space-y-3 animate-in fade-in duration-200 overflow-hidden">

        {/* Hidden File Input for CSV */}
        <input 
          type="file" 
          accept=".csv" 
          multiple
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload} 
        />

                {/* Barra de Ações Superior do Abastecimento e Filtros (Congelada no Topo - Nível 2) */}
                <div className="shrink-0 bg-slate-50 pt-1 pb-2 shadow-sm border-b border-slate-200/60 flex flex-col gap-2">
                  <div className="bg-white p-3.5 rounded-[22px] border border-slate-150 shadow-sm text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider px-2 py-1 bg-slate-100 rounded-lg">
                        Controle de Abastecimento
                      </span>
                    </div>
                    
                    {/* Tab Selector, Google Sheets Sync & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                        <button
                          onClick={() => setActiveAbastecimentoTab("tabela")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                            activeAbastecimentoTab === "tabela"
                              ? "bg-[#114D38] text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
                          }`}
                        >
                          Tabela Geral
                        </button>
                        <button
                          onClick={() => setActiveAbastecimentoTab("dashboard")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                            activeAbastecimentoTab === "dashboard"
                              ? "bg-[#114D38] text-white shadow-sm"
                              : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
                          }`}
                        >
                          BI Dashboard
                        </button>
                      </div>

                      <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                          isFiltersOpen
                            ? "bg-orange-50 border-orange-200 text-orange-700"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        {isFiltersOpen ? "Ocultar Filtros" : "Filtrar"}
                      </button>

                      <button
                        onClick={() => {
                          setCsvType("abastecimentos");
                          if (fileInputRef.current) fileInputRef.current.click();
                        }}
                        className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-emerald-800"
                        title="Importar planilhas CSV de abastecimentos para o Supabase (somente veículos cadastrados)"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                        Importar Planilhas (CSV)
                      </button>

                      {user?.email === "deny.goncalves@risel.com.br" && (
                        <button
                          onClick={handleClearAbastecimentosData}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-rose-200"
                          title="Zerar abastecimentos armazenados para reiniciar importação limpa no Supabase"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          Zerar Dados
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Retractable Filters Panel (Integra o bloco sticky) */}
                  <AnimatePresence>
                    {isFiltersOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white p-5 rounded-[24px] border border-slate-150 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 text-left">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Placa</label>
                            <input
                              type="text"
                              placeholder="Buscar placa..."
                              value={filterPlaca}
                              onChange={(e) => setFilterPlaca(e.target.value.toUpperCase())}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escolher Mês/Ano</label>
                            <input
                              type="month"
                              value={filterMesAno}
                              onChange={(e) => handleMesAnoChange(e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Período De</label>
                            <input
                              type="date"
                              value={filterPeriodoInicio}
                              onChange={(e) => setFilterPeriodoInicio(e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Período Até</label>
                            <input
                              type="date"
                              value={filterPeriodoFim}
                              onChange={(e) => setFilterPeriodoFim(e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base / Filial</label>
                            <select
                              value={filterBase}
                              onChange={(e) => setFilterBase(e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold bg-white text-slate-700"
                            >
                              <option value="">Todas as Bases</option>
                              {Array.from(new Set(veiculos.map(v => v.filial).filter(Boolean))).map(base => (
                                <option key={base} value={base}>{base}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gestor / Condutor</label>
                            <input
                              type="text"
                              placeholder="Nome do condutor..."
                              value={filterCondutor}
                              onChange={(e) => setFilterCondutor(e.target.value)}
                              className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] text-xs font-semibold bg-white text-slate-700"
                            />
                          </div>
                          <div className="sm:col-span-2 md:col-span-6 flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => {
                                setFilterPlaca("");
                                setFilterPeriodoInicio("");
                                setFilterPeriodoFim("");
                                setFilterBase("");
                                setFilterCondutor("");
                                setFilterMesAno("");
                              }}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-extrabold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer"
                            >
                              Limpar Filtros
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tab content */}
                {activeAbastecimentoTab === "tabela" ? (
                  <AbastecimentoTableView 
                    abastecimentos={abastecimentos} 
                    veiculos={veiculos} 
                    filterPlaca={filterPlaca}
                    filterBase={filterBase}
                    filterCondutor={filterCondutor}
                    filterPeriodoInicio={filterPeriodoInicio}
                    filterPeriodoFim={filterPeriodoFim}
                    filterMesAno={filterMesAno}
                    onMesAnoChange={handleMesAnoChange}
                    onImport={() => { setCsvType("abastecimentos"); fileInputRef.current?.click(); }}
                    onClearData={handleClearAbastecimentosData}
                    onUpdateAbastecimento={handleUpdateAbastecimento}
                    onDeleteAbastecimento={handleDeleteAbastecimento}
                  />
                ) : (
                  <AbastecimentoDashboardView 
                    abastecimentos={abastecimentos} 
                    veiculos={veiculos}
                    filterPlaca={filterPlaca}
                    filterBase={filterBase}
                    filterCondutor={filterCondutor}
                    filterPeriodoInicio={filterPeriodoInicio}
                    filterPeriodoFim={filterPeriodoFim}
                    filterMesAno={filterMesAno}
                    onMesAnoChange={handleMesAnoChange}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
                {/* Sub-section Switcher & Filter Bar */}
                <div 
                  className="shrink-0 pt-1 pb-1 space-y-2.5"
                  onWheel={(e) => {
                    if (mainFrotaTableScrollRef.current) {
                      mainFrotaTableScrollRef.current.scrollTop += e.deltaY;
                    }
                  }}
                >
                  {/* Sub-menu Tabs for Frota Leve */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
                      <button
                        onClick={() => setSubSectionFrota("veiculos")}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          subSectionFrota === "veiculos"
                            ? "bg-white text-orange-600 shadow-2xs font-black border border-orange-200/60"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                        }`}
                      >
                        <Truck className={`w-3.5 h-3.5 ${subSectionFrota === "veiculos" ? "text-orange-600" : "text-slate-400"}`} />
                        <span>Todos os Veículos</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-0.5 ${
                          subSectionFrota === "veiculos" ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"
                        }`}>
                          {stats.total}
                        </span>
                      </button>

                      <button
                        onClick={() => setSubSectionFrota("vencidos")}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          subSectionFrota === "vencidos"
                            ? "bg-white text-rose-600 shadow-2xs font-black border border-rose-200/60"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                        }`}
                      >
                        <Clock className={`w-3.5 h-3.5 ${subSectionFrota === "vencidos" ? "text-rose-600" : "text-slate-400"}`} />
                        <span>Contratos Próximos</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-0.5 ${
                          subSectionFrota === "vencidos" ? "bg-rose-100 text-rose-700" : "bg-rose-50 text-rose-600 border border-rose-200"
                        }`}>
                          {stats.contratosProximos90}
                        </span>
                      </button>

                      <button
                        onClick={() => setSubSectionFrota("custos")}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span>Abastecimento</span>
                      </button>
                    </div>

                    {subSectionFrota === "vencidos" && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200/80 rounded-xl text-[11px] font-bold text-rose-700 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                        <span>Contratos vencendo em ≤ 90 dias ou vencidos ({displayedFrotaVeiculos.length} veículos)</span>
                      </div>
                    )}
                  </div>

                  {/* Filter and Actions Bar */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <div className="relative flex-1 min-w-[200px] max-w-sm text-left">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar por Placa, Modelo ou Condutor..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white transition-all text-left"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-600 shrink-0">
                        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        Filial:
                        <select 
                          value={filterFilial} 
                          onChange={(e) => setFilterFilial(e.target.value)} 
                          className="bg-transparent outline-none cursor-pointer text-orange-600 font-extrabold"
                        >
                          {filiaisList.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-600 shrink-0">
                        Status:
                        <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)} 
                          className="bg-transparent outline-none cursor-pointer text-orange-600 font-extrabold"
                        >
                          <option value="Todos">Todos</option>
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <button
                        onClick={() => {
                          setEditingVeh(null);
                          setModalLocadora("");
                          setCustomLocadora("");
                          setModalVencContrato("");
                          setModalStatus("Ativo");
                          setModalDataInativacao("");
                          setModalMotivoInativacao("");
                          setIsVehModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-[#114D38] hover:bg-[#1d7053] text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Novo Veículo
                      </button>
                    </div>
                  </div>
                </div>

                {/* List Table / Grid Cards com Rolagem Interna de Dados */}
                <div ref={mainFrotaTableScrollRef} className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-150 overflow-x-auto overflow-y-auto shadow-sm">
                  <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 z-20 bg-[#114D38] shadow-sm">
                        <tr className="bg-[#114D38] text-white text-[10px] font-bold uppercase tracking-wider border-b border-[#0d3b2b]">
                          <th onClick={() => handleSort("placa")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-5 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Placa {sortField === "placa" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("modelo")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Modelo {sortField === "modelo" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("condutor")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Condutor / Função {sortField === "condutor" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("filial")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Filial / Contrato {sortField === "filial" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("locadora")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Locadora {sortField === "locadora" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("vencContrato")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center gap-1">
                              Venc. Contrato {sortField === "vencContrato" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("diasRestantes")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 text-center cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center justify-center gap-1">
                              Dias p/ Venc. {sortField === "diasRestantes" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th onClick={() => handleSort("status")} className="bg-[#114D38] sticky top-0 z-20 py-4 px-4 text-center cursor-pointer hover:bg-emerald-900/50 select-none transition-colors">
                            <div className="flex items-center justify-center gap-1">
                              Status {sortField === "status" && (sortDirection === "asc" ? "▲" : "▼")}
                            </div>
                          </th>
                          <th className="bg-[#114D38] sticky top-0 z-20 py-4 px-5 text-right select-none">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {displayedFrotaVeiculos.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                              Nenhum veículo encontrado com os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          displayedFrotaVeiculos.map(v => {
                            const dias = diasParaVencimento(v.vencContrato, v.dataInativacao, v.status);
                            const isVencido = dias <= 0 && v.status !== "Inativo";
                            const isAlerta30 = dias > 0 && dias <= 30 && v.status !== "Inativo";
                            const isAlerta90 = dias > 30 && dias <= 90 && v.status !== "Inativo";
                            const rowBgClass = isVencido 
                              ? "bg-rose-50/75 hover:bg-rose-100/90 border-l-4 border-rose-500 transition-colors" 
                              : isAlerta30 
                                ? "bg-amber-50/45 hover:bg-amber-100/60 border-l-4 border-amber-400 transition-colors" 
                                : isAlerta90 && subSectionFrota === "vencidos"
                                  ? "bg-orange-50/30 hover:bg-orange-100/50 border-l-4 border-orange-300 transition-colors"
                                  : "hover:bg-slate-50/60 transition-colors";

                            return (
                              <tr key={v.id} className={rowBgClass}>
                                <td className="py-3 px-5">
                                  <MercosulPlateBadge plate={v.placa} isInactive={v.status === "Inativo"} />
                                </td>
                                <td className="py-4 px-4 text-left">
                                  <div className={`font-bold ${isVencido ? "text-rose-950" : "text-slate-800"}`}>{formatarTextoLongo(v.modelo, 20)}</div>
                                  <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{toTitleCase(v.combustivel)} · {v.odometro.toLocaleString("pt-BR")} km</div>
                                </td>
                                <td className="py-4 px-4 text-left">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    {formatarTextoLongo(v.condutor, 18)}
                                    <a href={`tel:${v.contatoMotorista}`} title="Ligar para o motorista" className="text-[#114D38] hover:text-[#1d7053]">
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  </div>
                                  <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{toTitleCase(v.funcao)}</div>
                                </td>
                                <td className="py-4 px-4 text-left">
                                  <div className="font-bold text-slate-750">{toTitleCase(v.filial)}</div>
                                  <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{v.contrato}</div>
                                </td>
                                <td className="py-4 px-4 font-bold text-slate-500 uppercase text-[11px] text-left" title={v.locadora}>
                                  {formatarTextoLongo(v.locadora, 16)}
                                </td>
                                <td className="py-4 px-4 font-mono font-bold text-left">
                                  <div className={`flex items-center gap-1.5 ${isVencido ? "text-rose-700 font-extrabold" : isAlerta30 ? "text-amber-700 font-bold" : "text-slate-650"}`}>
                                    {isVencido && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />}
                                    <span>{formatDateSafe(v.vencContrato)}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  {v.status === "Inativo" ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span 
                                        className="font-extrabold px-2.5 py-1 rounded-md text-[10px] bg-slate-100 text-slate-750 border border-slate-200 shadow-2xs max-w-[170px] truncate block"
                                        title={`Inativado em ${formatDateSafe(v.dataInativacao || "")}${v.motivoInativacao ? ` | Motivo: ${v.motivoInativacao}` : ""}`}
                                      >
                                        {v.motivoInativacao || "Inativo"}
                                      </span>
                                      <span className="text-[9px] font-mono font-bold text-slate-500">
                                        {dias < 0 
                                          ? `${Math.abs(dias)}d venc. na inat.` 
                                          : `${dias}d p/ venc. na inat.`}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`inline-flex items-center justify-center font-black px-2.5 py-1 rounded-md text-[10px] shadow-2xs border ${
                                      isVencido
                                        ? "bg-rose-600 text-white border-rose-700 shadow-rose-200 animate-pulse" 
                                        : isAlerta30 
                                          ? "bg-amber-100 text-amber-900 border-amber-300 font-extrabold" 
                                          : isAlerta90
                                            ? "bg-amber-50 text-amber-800 border-amber-200 font-extrabold"
                                            : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}>
                                      {isVencido 
                                        ? (dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : `Vence Hoje!`)
                                        : isAlerta30 
                                          ? `${dias} dias (Atenção)` 
                                          : `${dias} dias`}
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  {(() => {
                                    const displayStatus = (v.status === "Inativo" || v.status === "Em Manutenção") ? "Inativo" : "Ativo";
                                    const isAtivo = displayStatus === "Ativo";
                                    return (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black border ${
                                        isAtivo 
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" 
                                          : "bg-rose-50 text-rose-700 border-rose-200/80"
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                          isAtivo ? "bg-emerald-500" : "bg-rose-500"
                                        }`} />
                                        {displayStatus}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-4 px-5 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => setSelectedVeiculo(v)}
                                      className="p-1.5 text-slate-400 hover:text-[#114D38] hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                      title="Ver Detalhes do Veículo"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const loc = v.locadora || "";
                                        const locUpper = loc.toUpperCase().trim();
                                        const isStandard = ["LOCALIZA GESTÃO DE FROTAS", "MOVIDA", "SUPER MAIS", "FROTA PRÓPRIA"].includes(locUpper);
                                        setEditingVeh(v);
                                        if (isStandard) {
                                          setModalLocadora(locUpper);
                                          setCustomLocadora("");
                                        } else {
                                          setModalLocadora("Outra");
                                          setCustomLocadora(loc);
                                        }
                                        setModalVencContrato(v.vencContrato || "");
                                        setModalStatus(v.status);
                                        setModalDataInativacao(v.dataInativacao || "");
                                        setModalMotivoInativacao(v.motivoInativacao || "");
                                        setIsVehModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                      title="Editar Veículo"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            )}
          </SubSystemLayout>
        )}

        {/* TAB 2: CHECKLIST (INSPECTIONS) */}
        {activeTab === "checklist" && (
          <SubSystemLayout
            activeTab="Checklist"
            menuItems={[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "realizados", label: "Checklists Realizados", icon: FileSpreadsheet },
              { id: "alertas", label: "Checklists Pendentes", icon: AlertTriangle },
              { id: "formulario", label: "Formulário Checklist", icon: CheckSquare }
            ]}
            activeSubSection={subSectionChecklist}
            setActiveSubSection={setSubSectionChecklist}
            hideSidebar={true}
          >
            {isChecklistsLoading ? (
              <div className="py-20 text-center space-y-4">
                <RefreshCw className="w-8 h-8 text-[#114D38] animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-400 font-mono">Carregando dados da Planilha do Google...</p>
              </div>
            ) : (
              <>
                {subSectionChecklist === "dashboard" && (
                  <ChecklistDashboard 
                    checklists={checklists} 
                    vehicles={veiculos} 
                  />
                )}
                {subSectionChecklist === "realizados" && (
                  <ChecklistRealizados 
                    checklists={checklists} 
                    onDeleteChecklist={handleDeleteChecklist}
                  />
                )}
                {subSectionChecklist === "alertas" && (
                  <ChecklistAlertas 
                    checklists={checklists} 
                    vehicles={veiculos} 
                    onOpenChecklistFormForPlate={(plate) => {
                      setSubSectionChecklist("formulario");
                    }}
                  />
                )}
                {subSectionChecklist === "formulario" && (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1 pb-8">
                    {/* Painel Executivo do Link do Checklist Público */}
                    <div className="bg-gradient-to-r from-[#114D38] via-[#0e3f2e] to-[#0a2f22] text-white p-5 md:p-6 rounded-3xl shadow-lg border border-emerald-800/40 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#F47920]/10 rounded-full blur-3xl pointer-events-none" />

                      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 text-left">
                        
                        {/* QR Code de Leitura Celular */}
                        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shrink-0">
                          <div className="bg-white p-2 rounded-xl shadow-md border border-slate-200">
                            <QRCodeSVG 
                              value={`${window.location.origin}/c`} 
                              size={76} 
                              level="M" 
                              marginSize={1}
                            />
                          </div>
                          <div className="space-y-1 max-w-[130px]">
                            <span className="text-[10px] font-black uppercase text-[#F47920] tracking-wider block">Scan Rápido</span>
                            <p className="text-[11px] font-bold text-emerald-100 leading-tight">Aponte a câmera do celular para abrir o checklist</p>
                          </div>
                        </div>

                        {/* Informações do Link */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-[#F47920] text-white text-[9px] font-black uppercase tracking-wider rounded-md shadow-xs">
                              Link Público Curto
                            </span>
                            <span className="text-[11px] text-emerald-200 font-bold">Acesso sem login necessário</span>
                          </div>

                          <h4 className="text-base font-black tracking-wide text-white font-display">Portal de Inspeção de Frota Risel</h4>
                          
                          <div className="bg-black/30 border border-emerald-500/30 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs font-mono font-bold text-emerald-300 overflow-hidden">
                            <span className="truncate">{window.location.origin}/c</span>
                            <span className="text-[10px] text-emerald-400/70 font-sans font-bold uppercase shrink-0">Link amigável</span>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/c`);
                              alert("✅ LINK CURTO DO CHECKLIST COPIADO COM SUCESSO!\n\nEnvie aos motoristas: " + `${window.location.origin}/c`);
                            }}
                            className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider bg-[#F47920] hover:bg-[#d96512] text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            📋 Copiar Link Curto
                          </button>

                          <a 
                            href={`${window.location.origin}/checklist-publico`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-emerald-100 rounded-xl border border-white/20 transition-all text-center flex items-center justify-center gap-2"
                          >
                            🔗 Abrir em Nova Aba
                          </a>
                        </div>

                      </div>
                    </div>

                    <ChecklistForm 
                      vehicles={veiculos} 
                      onFormSubmitSuccess={(newCheck) => {
                        setChecklists(prev => [newCheck, ...prev]);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </SubSystemLayout>
        )}

        {/* TAB 3: RESERVAS */}
        {activeTab === "reservas" && (
          <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
            <ReservaSubmoduleContainer />
          </div>
        )}

        {/* TAB 4: MULTAS */}
        {activeTab === "multas" && (
          <SubSystemLayout
            activeTab="Controle de Multas"
            menuItems={[]}
            activeSubSection={subSectionMultas}
            setActiveSubSection={setSubSectionMultas}
            hideSidebar={true}
          >
            <div className="flex-1 min-h-0 overflow-y-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
              <MultasDashboard activePage={subSectionMultas} />
            </div>
          </SubSystemLayout>
        )}

        {/* TAB 5: TELEMETRIA & RASTREAMENTO */}
        {activeTab === "rastreamento" && (
          <SubSystemLayout
            activeTab="Rastreamento"
            menuItems={[
              { id: "dashboard", label: "Dashboard Telemetria", icon: LayoutDashboard },
              { id: "mapa", label: "Mapa e Grid ao Vivo", icon: MapPin },
              { id: "alertas", label: "Alertas e Sensores", icon: Activity },
              { id: "relatorios", label: "Relatórios e Cercas", icon: FileSpreadsheet }
            ]}
            activeSubSection={subSectionRastreamento}
            setActiveSubSection={setSubSectionRastreamento}
            hideSidebar={true}
          >
            <div className="flex-1 min-h-0 overflow-y-auto w-full space-y-6 pb-8">
              {subSectionRastreamento === "dashboard" && (
                <TelemetryDashboard 
                  geoPositions={geoPositions} 
                  fleetVehicles={veiculos}
                  reservas={reservas}
                />
              )}

              {subSectionRastreamento === "mapa" && (
                <TelemetryMapAndGrid 
                  geoPositions={geoPositions} 
                  fleetVehicles={veiculos}
                  reservations={reservas}
                />
              )}

              {subSectionRastreamento === "alertas" && (
                <TelemetryAlerts 
                  geoPositions={geoPositions} 
                  fleetVehicles={veiculos}
                  reservations={reservas}
                />
              )}

              {subSectionRastreamento === "relatorios" && (
                <TelemetryReportsAndFences 
                  geoPositions={geoPositions} 
                  fleetVehicles={veiculos}
                  reservations={reservas}
                />
              )}
            </div>
          </SubSystemLayout>
        )}
      </div>

      {/* COMPACT DETAIL DRAWER / SLIDE OVER */}
      <AnimatePresence>
        {selectedVeiculo && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setSelectedVeiculo(null)} />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 overflow-y-auto p-6 flex flex-col justify-between relative z-10 text-left"
            >
              <div>
                <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <MercosulPlateBadge plate={selectedVeiculo.placa} isInactive={selectedVeiculo.status === "Inativo"} />
                    <h2 className="text-lg font-display font-black text-slate-800 mt-3">{selectedVeiculo.modelo}</h2>
                    <p className="text-xs font-semibold text-slate-400">Cadastro Detalhado Risel ERP</p>
                  </div>
                  <button 
                    onClick={() => setSelectedVeiculo(null)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                {/* Info Fields Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Condutor Atual</span>
                    <span className="font-bold text-slate-800 block mt-1">{selectedVeiculo.condutor}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{selectedVeiculo.funcao}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Contato Direto</span>
                    <a href={`tel:${selectedVeiculo.contatoMotorista}`} className="font-bold text-orange-600 hover:underline block mt-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {selectedVeiculo.contatoMotorista}
                    </a>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Gestor Responsável</span>
                    <span className="font-bold text-slate-800 block mt-1">{selectedVeiculo.gestorResp || "-"}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">E-mail</span>
                    <span className="font-bold text-slate-800 block mt-1 truncate" title={selectedVeiculo.email}>{selectedVeiculo.email || "-"}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Filial / Alocação</span>
                    <span className="font-bold text-slate-800 block mt-1">{selectedVeiculo.filial}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{selectedVeiculo.contrato}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Locadora Proprietária</span>
                    <span className="font-bold text-slate-700 block mt-1 uppercase text-[10px]">{selectedVeiculo.locadora}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Vencimento do Contrato</span>
                    <span className="font-bold text-slate-800 block mt-1">
                      {formatDateSafe(selectedVeiculo.vencContrato)}
                    </span>
                    {selectedVeiculo.status === "Inativo" ? (
                      <div className="mt-2 text-[10px] text-slate-700 bg-slate-100 p-2 rounded-lg border border-slate-200 space-y-0.5">
                        <span className="font-extrabold text-[#114D38] block uppercase text-[9px]">Status na Inativação</span>
                        {selectedVeiculo.dataInativacao && (
                          <span className="block font-medium">Data Inativação: <strong>{formatDateSafe(selectedVeiculo.dataInativacao)}</strong></span>
                        )}
                        {selectedVeiculo.motivoInativacao && (
                          <span className="block font-medium">Motivo: <strong>{selectedVeiculo.motivoInativacao}</strong></span>
                        )}
                        <span className="block font-mono font-bold text-slate-600 mt-1">
                          Congelado: {diasParaVencimento(selectedVeiculo.vencContrato, selectedVeiculo.dataInativacao, selectedVeiculo.status) < 0 
                            ? `${Math.abs(diasParaVencimento(selectedVeiculo.vencContrato, selectedVeiculo.dataInativacao, selectedVeiculo.status))} dias vencido na data da inativação` 
                            : `${diasParaVencimento(selectedVeiculo.vencContrato, selectedVeiculo.dataInativacao, selectedVeiculo.status)} dias p/ vencimento na data da inativação`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Faltam {diasParaVencimento(selectedVeiculo.vencContrato, selectedVeiculo.dataInativacao, selectedVeiculo.status)} dias
                      </span>
                    )}
                  </div>
                </div>

                {/* Advanced logs */}
                <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Custos, Abastecimentos e Manutenções</h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="border border-slate-150 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Média Consumo</span>
                        <span className="font-black text-slate-800 text-sm block mt-0.5">{getConsumoMedio(selectedVeiculo.placa)}</span>
                      </div>
                      <Fuel className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="border border-slate-150 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Último Odômetro</span>
                        <span className="font-black text-slate-800 text-sm block mt-0.5">{selectedVeiculo.odometro.toLocaleString("pt-BR")} km</span>
                      </div>
                      <Gauge className="w-5 h-5 text-indigo-500" />
                    </div>
                  </div>

                  {/* Actions to fuel and maintenance directly */}
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => {
                        setIsFuelModalOpen(true);
                      }}
                      className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-black rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Fuel className="w-3.5 h-3.5" /> Registrar Abastecimento
                    </button>
                    <button 
                      onClick={() => {
                        setIsMaintModalOpen(true);
                      }}
                      className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Registrar Oficina
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 mt-6">
                <button
                  onClick={() => setSelectedVeiculo(null)}
                  className="w-full py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wide cursor-pointer text-center"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALS */}
      {/* 1. VEICULO MODAL */}
      {isVehModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-lg">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">
                {editingVeh ? "Editar Veículo Leve" : "Cadastrar Novo Veículo Leve"}
              </h3>
              <button onClick={() => setIsVehModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddEditVeiculo} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-650">
                <div className="space-y-1">
                  <label className="block">Placa *</label>
                  <input required name="placa" placeholder="e.g. PRT-4A23" defaultValue={editingVeh?.placa || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="block">Modelo *</label>
                  <input required name="modelo" placeholder="e.g. Fiat Uno Way" defaultValue={editingVeh?.modelo || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Vencimento do Contrato {modalLocadora === "FROTA PRÓPRIA" ? "(Não se aplica)" : ""}</label>
                  <input 
                    disabled={modalLocadora === "FROTA PRÓPRIA"}
                    type="date" 
                    name="vencContrato" 
                    value={modalLocadora === "FROTA PRÓPRIA" ? "" : modalVencContrato} 
                    onChange={(e) => setModalVencContrato(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-100 disabled:text-slate-400" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Combustível *</label>
                  <select name="combustivel" defaultValue={editingVeh?.combustivel || "Flex"} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                    <option value="Flex">Flex (Gasolina/Álcool)</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Etanol">Etanol</option>
                    <option value="Diesel">Diesel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block">Condutor Atual *</label>
                  <input required name="condutor" placeholder="Nome do motorista" defaultValue={editingVeh?.condutor || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Função</label>
                  <input name="funcao" placeholder="e.g. Técnico de Campo" defaultValue={editingVeh?.funcao || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Contato Motorista</label>
                  <input name="contatoMotorista" placeholder="(11) 99999-9999" defaultValue={editingVeh?.contatoMotorista || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Gestor Responsável</label>
                  <input name="gestorResp" placeholder="e.g. Marcos Mendes" defaultValue={editingVeh?.gestorResp || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block">E-mail</label>
                  <input type="email" name="email" placeholder="email@exemplo.com" defaultValue={editingVeh?.email || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Filial</label>
                  <input name="filial" placeholder="Paulínia" defaultValue={editingVeh?.filial || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Contrato</label>
                  <input name="contrato" placeholder="Contrato" defaultValue={editingVeh?.contrato || ""} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Locadora</label>
                  <select 
                    name="locadora" 
                    value={modalLocadora}
                    onChange={(e) => {
                      setModalLocadora(e.target.value);
                      if (e.target.value !== "OUTRA") {
                        setCustomLocadora("");
                      }
                    }}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 text-xs font-semibold"
                  >
                    <option value="">SELECIONE UMA OPÇÃO...</option>
                    <option value="LOCALIZA GESTÃO DE FROTAS">LOCALIZA GESTÃO DE FROTAS</option>
                    <option value="MOVIDA">MOVIDA</option>
                    <option value="SUPER MAIS">SUPER MAIS</option>
                    <option value="FROTA PRÓPRIA">FROTA PRÓPRIA</option>
                    <option value="OUTRA">OUTRA (DIGITAR MANUALMENTE)</option>
                  </select>
                </div>
                {modalLocadora === "OUTRA" && (
                  <div className="space-y-1 col-span-2">
                    <label className="block">Nome da Locadora Personalizada</label>
                    <input 
                      placeholder="DIGITE O NOME DA LOCADORA" 
                      value={customLocadora}
                      onChange={(e) => setCustomLocadora(e.target.value.toUpperCase())}
                      className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 uppercase font-bold"
                    />
                  </div>

                )
}
                <div className="space-y-1">
                  <label className="block">Odômetro Atual (km)</label>
                  <input type="number" name="odometro" defaultValue={editingVeh?.odometro || 0} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block">Status do Veículo (Ativo/Inativo) *</label>
                  <select 
                    name="status" 
                    value={modalStatus} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalStatus(val);
                      if (val === "Inativo" && !modalDataInativacao) {
                        setModalDataInativacao(HOJE_REF);
                      }
                    }}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                {modalStatus === "Inativo" && (
                  <div className="col-span-2 grid grid-cols-2 gap-3 bg-rose-50/60 border border-rose-200/80 p-3 rounded-xl">
                    <div className="space-y-1">
                      <label className="block text-rose-800 font-bold text-[11px]">Data de Inativação *</label>
                      <input 
                        type="date" 
                        name="dataInativacao" 
                        value={modalDataInativacao || HOJE_REF} 
                        onChange={(e) => setModalDataInativacao(e.target.value)}
                        className="w-full border border-rose-300 bg-white px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-rose-500 font-mono text-xs font-bold text-slate-800" 
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-rose-800 font-bold text-[11px]">Motivo da Inativação *</label>
                      <input 
                        type="text" 
                        name="motivoInativacao" 
                        placeholder="e.g. Devolvido para locadora, Vendido, Sinistrado" 
                        value={modalMotivoInativacao} 
                        onChange={(e) => setModalMotivoInativacao(e.target.value)}
                        className="w-full border border-rose-300 bg-white px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-rose-500 text-xs font-bold text-slate-800" 
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsVehModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Salvar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CHECKLIST MODAL */}
      {isCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-lg">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">Preencher Checklist de Inspeção</h3>
              <button onClick={() => setIsCheckModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddChecklist} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs font-bold text-slate-650">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="block">Veículo *</label>
                  <select required name="placa" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-mono">
                    {veiculos.map(v => (
                      <option key={v.id} value={v.placa}>{v.placa} - {v.modelo} ({v.condutor})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="block">Odômetro Atual (km) *</label>
                  <input required type="number" name="odometro" placeholder="Insira o km lido no painel" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>

                <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Itens Avaliados (Norma de Segurança)</span>
                  
                  {[
                    { id: "pneus", label: "Pneus e Calibragem" },
                    { id: "freios", label: "Sistema de Freios" },
                    { id: "farois", label: "Faróis e Lanternas" },
                    { id: "seguranca", label: "Itens de Segurança (Cinto, Triângulo)" },
                    { id: "fluidos", label: "Fluidos (Óleo do motor, Água do radiador)" },
                    { id: "lataria", label: "Lataria e Vidros externos" }
                  ].map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200/50">
                      <span className="text-slate-700">{item.label}</span>
                      <div className="flex gap-2">
                        {["OK", "Atenção", "Crítico"].map(opt => (
                          <label key={opt} className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" required name={item.id} value={opt} defaultChecked={opt === "OK"} />
                            <span className="text-[10px] uppercase font-bold text-slate-500">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="block">Avaliação Final da Inspeção</label>
                  <select name="status" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                    <option value="Aprovado">Aprovado (Pronto para Uso)</option>
                    <option value="Ressalvas">Aprovado com Ressalvas (Atenção moderada)</option>
                    <option value="Retido">Retido (Bloquear veículo para manutenção)</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="block">Observações Técnicas</label>
                  <textarea name="observacoes" rows={3} placeholder="Descreva quaisquer anomalias..." className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsCheckModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Enviar Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RESERVA MODAL */}
      {isResModalOpen && (
        <div id="reserva-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div id="reserva-modal-card" className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-md">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">Agendar Reserva de Veículo</h3>
              <button onClick={() => setIsResModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="reserva-modal-form" onSubmit={handleAddReserva} className="p-5 space-y-4 text-xs font-bold text-slate-650">
              
              {/* Alert de Erro de Validação/Conflito */}
              {reservaError && (
                <div id="reserva-error-alert" className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2.5 rounded-xl text-xs flex items-start gap-2 font-bold animate-in slide-in-from-top-1 duration-200">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{reservaError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block">Selecione o Veículo *</label>
                <select name="placa" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal">
                  {veiculos.filter(v => v.status !== "Inativo" && v.status !== "Em Manutenção").map(v => (
                    <option key={v.id} value={v.placa}>{v.placa} - {v.modelo} ({v.condutor})</option>
                  ))}
                  {veiculos.filter(v => v.status === "Inativo" || v.status === "Em Manutenção").map(v => (
                    <option key={v.id} value={v.placa} disabled>{v.placa} - {v.modelo} (Inativo/Manutenção)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data/Hora Início *</label>
                  <input required type="datetime-local" name="de" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal" />
                </div>
                <div className="space-y-1">
                  <label className="block">Data/Hora Devolução *</label>
                  <input required type="datetime-local" name="ate" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block">Destino / Finalidade da Reserva *</label>
                <input required name="destino" placeholder="e.g. Visita técnica Paulínia ou postos em SP" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button id="btn-cancelar-reserva" type="button" onClick={() => setIsResModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button id="btn-salvar-reserva" type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Agendar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MULTA MODAL */}
      {isFineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-md">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">Registrar Infração de Trânsito</h3>
              <button onClick={() => setIsFineModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMulta} className="p-5 space-y-4 text-xs font-bold text-slate-650">
              <div className="space-y-1">
                <label className="block">Selecione o Veículo Autuado *</label>
                <select name="placa" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                  {veiculos.map(v => (
                    <option key={v.id} value={v.placa}>{v.placa} - {v.modelo} ({v.condutor})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block">Descrição da Infração *</label>
                <input required name="infracao" placeholder="e.g. Excesso de velocidade acima do limite" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="block">Data da Infração *</label>
                  <input required type="date" name="data" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Pontos CNH *</label>
                  <input required type="number" name="pontos" defaultValue={4} min={1} max={20} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block">Valor Cobrado (R$) *</label>
                <input required type="number" step="0.01" name="valor" placeholder="130.16" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsFineModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Salvar Infração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ABASTECIMENTO MODAL */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-md">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">Registrar Novo Abastecimento</h3>
              <button onClick={() => setIsFuelModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAbastecimento} className="p-5 space-y-4 text-xs font-bold text-slate-650">
              <div className="space-y-1">
                <label className="block">Selecione o Veículo *</label>
                <select name="placa" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                  {veiculos.map(v => (
                    <option key={v.id} value={v.placa}>{v.placa} - {v.modelo} ({v.condutor})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data de Registro *</label>
                  <input required type="date" name="data" defaultValue={HOJE_REF} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Odômetro Lido (km) *</label>
                  <input required type="number" name="odometro" placeholder="e.g. 42600" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Litros abastecidos *</label>
                  <input required type="number" step="0.01" name="litros" placeholder="e.g. 40" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Valor Total Pago (R$) *</label>
                  <input required type="number" step="0.01" name="valorTotal" placeholder="e.g. 220.00" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block">Posto de Combustível</label>
                <input name="posto" placeholder="Posto Risel Paulínia ou Shell" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsFuelModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Salvar Abastecimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MANUTENCAO MODAL */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-md">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-display font-bold text-sm">Registrar Ordem de Serviço (Oficina)</h3>
              <button onClick={() => setIsMaintModalOpen(false)} className="text-emerald-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddManutencao} className="p-5 space-y-4 text-xs font-bold text-slate-650">
              <div className="space-y-1">
                <label className="block">Selecione o Veículo *</label>
                <select name="placa" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                  {veiculos.map(v => (
                    <option key={v.id} value={v.placa}>{v.placa} - {v.modelo} ({v.condutor})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Tipo de Manutenção</label>
                  <select name="tipo" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500">
                    <option value="Preventiva">Preventiva (Revisão)</option>
                    <option value="Corretiva">Corretiva (Conserto)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block">Custo Total (R$) *</label>
                  <input required type="number" step="0.01" name="custo" placeholder="e.g. 500.00" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data da OS *</label>
                  <input required type="date" name="data" defaultValue={HOJE_REF} className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-1">
                  <label className="block">Odômetro do Serviço *</label>
                  <input required type="number" name="odometro" placeholder="e.g. 42600" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block">Descrição dos Serviços Prestados *</label>
                <textarea required name="descricao" rows={2} placeholder="Descreva as peças substituídas e mão de obra..." className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 font-normal" />
              </div>
              <div className="space-y-1">
                <label className="block">Oficina / Fornecedor</label>
                <input name="oficina" placeholder="Oficina Credenciada Paulínia" className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-orange-500" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsMaintModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wide cursor-pointer">
                  Gravar OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. GOOGLE SHEETS / APPS SCRIPT INTEGRATION MODAL */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="bg-[#114D38] px-6 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="font-display font-extrabold text-sm tracking-tight">Sincronização com Google Sheets</h3>
                  <p className="text-[11px] text-emerald-100 opacity-90">Planilha Alvo: Risel Abastecimentos (1ap_3Auc...)</p>
                </div>
              </div>
              <button onClick={() => setIsSheetsModalOpen(false)} className="text-emerald-200 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0">
              <button
                onClick={() => setSheetsModalTab("appsscript")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  sheetsModalTab === "appsscript"
                    ? "border-[#114D38] text-[#114D38]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Webhook Apps Script (Recomendado)
              </button>
              <button
                onClick={() => setSheetsModalTab("onedrive")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  sheetsModalTab === "onedrive"
                    ? "border-[#114D38] text-[#114D38]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-sky-600" />
                Importação OneDrive / CSV
              </button>
              <button
                onClick={() => setSheetsModalTab("oauth")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  sheetsModalTab === "oauth"
                    ? "border-[#114D38] text-[#114D38]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Autenticação Google OAuth
              </button>
            </div>

            {/* Modal Content Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 font-medium">
              
              {sheetsModalTab === "appsscript" && (
                <div className="space-y-4">
                  {/* Card com Informações da Planilha Conectada */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 text-left space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-[#114D38]" />
                        <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                          Planilha Mapeada do Google Planilhas
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full border border-emerald-300">
                        Estrutura: Colunas A a BI (61 Colunas)
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1">
                      <p className="text-slate-600 font-medium">
                        <strong>Link da Planilha:</strong>{" "}
                        <a 
                          href="https://docs.google.com/spreadsheets/d/1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY/edit?gid=1773480680#gid=1773480680" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#114D38] font-bold hover:underline inline-flex items-center gap-1"
                        >
                          Abrir no Google Planilhas <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                      <p className="text-slate-500 text-[10px] font-mono">
                        ID: 1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY | Aba GID: 1773480680
                      </p>
                    </div>
                  </div>

                  {/* Bloco de Código do AppsScript.gs com Botão de Copiar */}
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-left space-y-3 shadow-md border border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-amber-400" />
                        <span className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider">
                          Script de Integração Automática (AppsScript.gs)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyAppsScriptCode}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            copiedScript 
                              ? "bg-emerald-600 text-white" 
                              : "bg-amber-500 hover:bg-amber-600 text-slate-950"
                          }`}
                        >
                          {copiedScript ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" /> Código Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copiar Código
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadAppsScriptCode}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar .gs
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Clique no botão acima para copiar todo o código e cole diretamente no Google Apps Script da sua planilha:
                    </p>

                    {showScriptViewer && (
                      <div className="relative max-h-48 overflow-y-auto bg-slate-950 p-3 rounded-xl font-mono text-[10px] text-emerald-400 border border-slate-800 leading-relaxed select-all">
                        <pre>{appScriptCode || "// Carregando código AppsScript.gs..."}</pre>
                      </div>
                    )}
                  </div>

                  {/* Configuração da URL do App da Web */}
                  <div className="space-y-2 text-left bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4">
                    <label className="block font-extrabold text-[#114D38] text-xs uppercase tracking-wider">
                      Cole a URL do App da Web Gerada no Google Apps Script *
                    </label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      value={appsScriptUrlInput}
                      onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                      className="w-full border border-slate-300 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-[#114D38] text-xs font-mono text-slate-800 bg-white shadow-xs"
                    />
                    <p className="text-[10px] text-slate-500 font-medium">
                      O backend enviará automaticamente as 61 colunas (A a BI) para essa URL a cada novo abastecimento.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isSavingAppsScript}
                        onClick={handleSaveAppsScriptUrl}
                        className="px-5 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all"
                      >
                        {isSavingAppsScript ? "Salvando Conexão..." : "Salvar e Ativar Sincronização"}
                      </button>

                      <button
                        type="button"
                        disabled={isExportingToSheets}
                        onClick={handleExportAllToGoogleSheets}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all border border-emerald-900"
                        title="Enviar todos os registros de abastecimento salvos no sistema diretamente para a planilha do Google Sheets"
                      >
                        <FileSpreadsheet className={`w-4 h-4 text-emerald-200 ${isExportingToSheets ? "animate-spin" : ""}`} />
                        {isExportingToSheets ? "Enviando Registros..." : `Exportar ${abastecimentos.length} Abastecimentos para a Planilha`}
                      </button>

                      <a
                        href="https://docs.google.com/spreadsheets/d/1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY/edit?gid=1773480680#gid=1773480680"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir Google Planilhas
                      </a>
                    </div>
                  </div>

                  {/* Passo a Passo Ilustrado */}
                  <div className="border-t border-slate-200 pt-4 text-left space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" /> Passo a Passo para Ativar a Sincronização Automática:
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 font-medium leading-relaxed">
                      <li>
                        Abra a sua planilha no Google Sheets:{" "}
                        <a 
                          href="https://docs.google.com/spreadsheets/d/1orv6kJ5qKxws-FJvFft706dkZOb9DizIXf6aZmHTfDY/edit?gid=1773480680#gid=1773480680" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#114D38] font-bold hover:underline"
                        >
                          Clique aqui para abrir
                        </a>.
                      </li>
                      <li>
                        No menu superior do Google Sheets, clique em <strong>Extensões &gt; Apps Script</strong>.
                      </li>
                      <li>
                        Apague qualquer código que estiver lá, clique no botão <strong>"Copiar Código"</strong> no bloco escuro acima e cole o código.
                      </li>
                      <li>
                        Clique no botão azul superior <strong>Implantar &gt; Nova Implantação</strong>.
                      </li>
                      <li>
                        Escolha o tipo de implantação <strong>App da Web</strong> (defina <em>Executar como: Você</em> e <em>Quem tem acesso: Qualquer pessoa</em>).
                      </li>
                      <li>
                        Clique em <strong>Implantar</strong>, copie a URL do Web App gerada (terminada em <code>/exec</code>) e cole no campo verde acima!
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {sheetsModalTab === "onedrive" && (
                <div className="space-y-4 text-left">
                  <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-4 text-sky-950 leading-relaxed space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-extrabold text-xs text-sky-900 flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 text-sky-600 ${isOneDriveSyncing ? "animate-spin" : ""}`} />
                        Sincronização Semiautomática do OneDrive (Diária às 09:00)
                      </p>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        CRON Ativo 09:00h
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-900 leading-relaxed">
                      O servidor se conecta diretamente à pasta compartilhada da Risel Combustíveis no OneDrive para buscar e processar os relatórios de abastecimento sem necessidade de importação manual.
                    </p>
                  </div>

                  {/* Como liberar acesso no OneDrive / SharePoint */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 text-[11px] space-y-2">
                    <p className="font-extrabold text-amber-900 flex items-center gap-1.5 text-xs">
                      <ExternalLink className="w-4 h-4 text-amber-700" />
                      Como permitir leitura direta sem tela de login corporativo:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-amber-900 font-medium leading-relaxed">
                      <li>Abra a pasta no SharePoint/OneDrive da Risel Combustíveis e clique em <strong>Compartilhar</strong>.</li>
                      <li>Altere as configurações do link de <em>"Pessoas na sua organização"</em> para <strong>"Qualquer pessoa com o link pode exibir"</strong>.</li>
                      <li>Copie e salve a nova URL no campo abaixo para o robô baixar os relatórios de abastecimento automaticamente todos os dias às 09:00!</li>
                    </ol>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Link da Pasta Compartilhada no OneDrive / SharePoint *
                      </label>
                      <a
                        href={oneDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Abrir no OneDrive
                      </a>
                    </div>

                    <input
                      type="url"
                      value={oneDriveUrl}
                      onChange={(e) => setOneDriveUrl(e.target.value)}
                      placeholder="https://riselcombustiveis-my.sharepoint.com/:f:/g/personal/..."
                      className="w-full border border-slate-300 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-[#114D38] text-xs font-mono text-slate-800 bg-white"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        disabled={isSavingOneDriveConfig}
                        onClick={handleSaveOneDriveConfig}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
                      >
                        {isSavingOneDriveConfig ? "Salvando..." : "Salvar Configuração"}
                      </button>

                      <button
                        type="button"
                        disabled={isOneDriveSyncing}
                        onClick={handleOneDriveSyncNow}
                        className="px-5 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isOneDriveSyncing ? "animate-spin" : ""}`} />
                        {isOneDriveSyncing ? "Sincronizando..." : "Testar Sincronização Agora"}
                      </button>
                    </div>
                  </div>

                  {/* Importação em Lote dos Arquivos da Pasta OneDrive (Sincronização Local e em Nuvem) */}
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-[#114D38]" />
                        <span className="font-extrabold text-xs text-[#114D38] uppercase tracking-wider">
                          Carregar Todos os Arquivos CSV da Pasta OneDrive
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-[#114D38] text-white text-[10px] font-black rounded-full shadow-xs">
                        {abastecimentos.length} Registros Carregados
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      Selecione ou solte de uma só vez todos os <strong>relatórios CSV de abastecimento</strong> diretamente da sua pasta local sincronizada do OneDrive (<code>Meus arquivos &gt; Telemetria &gt; Frota Leve &gt; ABASTECIMENTO</code>) para alimentar e atualizar todo o banco de dados do sistema de forma instantânea:
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setCsvType("abastecimentos");
                        if (fileInputRef.current) {
                          fileInputRef.current.click();
                        }
                      }}
                      className="w-full py-3 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                      Selecionar e Importar Todos os Arquivos CSV da Pasta
                    </button>
                  </div>
                  <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        URL de Webhook (Power Automate / Integração Direta):
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">POST HTTP</span>
                    </div>
                    <div className="bg-white border border-slate-300 rounded-xl p-2 flex items-center justify-between font-mono text-[10px] text-slate-700 break-all select-all">
                      {window.location.origin}/api/onedrive/webhook
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Caso possua um fluxo no Power Automate da Risel, basta configurar para enviar o arquivo CSV em um POST HTTP para o endereço acima no momento em que ele for gerado!
                    </p>
                  </div>

                  {/* Log de Sincronização Recente */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-slate-600" /> Histórico de Sincronizações do OneDrive:
                    </h4>

                    {oneDriveLogs.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-[11px]">
                        Nenhuma sincronização executada ainda. Clique em "Sincronizar OneDrive Agora" para testar a busca imediatamente.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {oneDriveLogs.map((log: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {log.status === "sucesso" ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <X className="w-4 h-4 text-rose-500 shrink-0" />
                              )}
                              <div>
                                <p className="font-bold text-slate-800">{log.message}</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {new Date(log.timestamp).toLocaleString("pt-BR")} | Arquivo: {log.filename || "N/A"}
                                </p>
                              </div>
                            </div>
                            {log.addedCount > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-lg text-[10px]">
                                +{log.addedCount} novos
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {sheetsModalTab === "oauth" && (
                <div className="space-y-4 text-left">
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Sincronização utilizando o login oficial de sua conta Google.
                  </p>

                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={handleGoogleSignInPopup}
                      className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 font-extrabold rounded-xl text-xs uppercase tracking-wider border border-slate-300 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      Conectar via Popup do Google
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-300"></div>
                      <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold uppercase">ou Token Manual</span>
                      <div className="flex-grow border-t border-slate-300"></div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Token de Acesso OAuth2</label>
                      <input
                        type="password"
                        placeholder="Cole o token de acesso (Bearer Token)..."
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        className="w-full border border-slate-300 px-3 py-2 rounded-xl text-xs font-mono"
                      />
                      <button
                        type="button"
                        disabled={isTestingToken}
                        onClick={handleSaveManualToken}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
                      >
                        {isTestingToken ? "Validando Token..." : "Salvar Token Manual"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setIsSheetsModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-md w-full animate-in slide-in-from-top-3 fade-in duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100' 
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
              : 'bg-slate-900/90 border-slate-700/50 text-slate-100'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <h4 className="font-bold text-xs uppercase tracking-wider">{toast.title}</h4>
              {toast.desc && <p className="text-xs opacity-90 mt-1 leading-relaxed">{toast.desc}</p>}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState, useEffect } from "react";
import { Sinistro } from "../types";
import { 
  ShieldAlert, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  TrendingUp, 
  FolderSync, 
  ExternalLink, 
  Filter, 
  Building2, 
  FileSpreadsheet, 
  Activity,
  Plus,
  RefreshCw
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from "recharts";
import { GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL } from "../../../services/googleDriveService";
import { syncSinistrosOnline } from "../services/sinistrosService";

const SHAREPOINT_EXCEL_URL = "https://riselcombustiveis-my.sharepoint.com/:x:/r/personal/deny_goncalves_risel_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B08C8A01A-45A5-4439-94F4-5F0505EDE3B3%7D&file=Comunicado%20de%20Sinistro_Frota%20Pesada.xlsx&action=default&mobileredirect=true";
const MICROSOFT_FORMS_URL = "https://forms.cloud.microsoft/Pages/DesignPageV2.aspx?prevorigin=Marketing&origin=NeoPortalPage&subpage=design&id=--soOq0dkkmCvV864R49jTu3qwhCFQBElTcewqtXSeRUQTE2N0tGUjlEMjREQU5OUzFKN1NSR1pQWS4u";

interface SinistrosDashboardProps {
  sinistros: Sinistro[];
  onNavigateToSinistros: () => void;
  onOpenNewSinistroModal: () => void;
  onRefreshData?: () => void;
}

const COLORS_SEVERIDADE: Record<string, string> = {
  "Leve": "#10b981", // Emerald
  "Média": "#f59e0b", // Amber
  "Grave": "#f97316", // Orange
  "Gravíssima": "#ef4444" // Rose/Red
};

const COLORS_CULPABILIDADE: Record<string, string> = {
  "Condutor Risel": "#f43f5e",
  "Terceiro": "#3b82f6",
  "Sem Culpa / Condições Adversas": "#10b981",
  "Em Apuração": "#eab308"
};

const PALETTE = ["#00d664", "#0ea5e9", "#ff9b00", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#64748b"];

export const SinistrosDashboard: React.FC<SinistrosDashboardProps> = ({
  sinistros,
  onNavigateToSinistros,
  onOpenNewSinistroModal,
  onRefreshData
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [selectedGravidade, setSelectedGravidade] = useState<string>("");

  // Atualização contínua direta com os dados da planilha
  useEffect(() => {
    if (onRefreshData) {
      const interval = setInterval(() => {
        onRefreshData();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [onRefreshData]);

  // Extrair meses disponíveis
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    sinistros.forEach(s => {
      if (!s.dataHora) return;
      const d = s.dataHora.includes("T") ? s.dataHora.split("T")[0] : s.dataHora.split(" ")[0];
      let y = "", m = "";
      if (d.includes("-")) {
        const parts = d.split("-");
        y = parts[0];
        m = parts[1];
      } else if (d.includes("/")) {
        const parts = d.split("/");
        d.length === 3 ? (m = parts[1], y = parts[2]) : null;
      }
      if (y && m) {
        const key = `${y}-${m}`;
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = dateObj.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        map.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [sinistros]);

  // Extrair bases únicas
  const availableBases = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [sinistros]);

  // Filtragem dos dados
  const filteredSinistros = useMemo(() => {
    return sinistros.filter(s => {
      if (selectedMonth) {
        const d = s.dataHora.includes("T") ? s.dataHora.split("T")[0] : s.dataHora.split(" ")[0];
        if (!d.startsWith(selectedMonth)) return false;
      }
      if (selectedBase && s.base.trim() !== selectedBase.trim()) return false;
      if (selectedGravidade && s.gravidade !== selectedGravidade) return false;
      return true;
    });
  }, [sinistros, selectedMonth, selectedBase, selectedGravidade]);

  // Métricas de KPI
  const metrics = useMemo(() => {
    const total = filteredSinistros.length;
    const valorPrejuizoTotal = filteredSinistros.reduce((acc, s) => acc + (s.valorEstimadoPrejuizo || 0), 0);
    const valorPagoSeguradora = filteredSinistros.reduce((acc, s) => acc + (s.valorPagoSeguradora || 0), 0);
    const valorFranquiaTotal = filteredSinistros.reduce((acc, s) => acc + (s.valorFranquia || 0), 0);
    const custoEfetivoRisel = filteredSinistros.reduce((acc, s) => acc + (s.custoEfetivoRisel || 0), 0);

    const gravesOuGravissimas = filteredSinistros.filter(s => s.gravidade === "Grave" || s.gravidade === "Gravíssima").length;
    const finalizados = filteredSinistros.filter(s => s.status === "Finalizado / Concluído").length;
    const emReparo = filteredSinistros.filter(s => s.status === "Em Reparo").length;
    const emSeguradora = filteredSinistros.filter(s => s.status === "Aberto na Seguradora" || s.status === "Regulado").length;

    const percentConcluidos = total > 0 ? (finalizados / total) * 100 : 0;
    const percentGraves = total > 0 ? (gravesOuGravissimas / total) * 100 : 0;
    const taxaCoberturaSeguro = valorPrejuizoTotal > 0 ? (valorPagoSeguradora / valorPrejuizoTotal) * 100 : 0;

    return {
      total,
      valorPrejuizoTotal,
      valorPagoSeguradora,
      valorFranquiaTotal,
      custoEfetivoRisel,
      gravesOuGravissimas,
      finalizados,
      emReparo,
      emSeguradora,
      percentConcluidos,
      percentGraves,
      taxaCoberturaSeguro
    };
  }, [filteredSinistros]);

  // Dados para Gráfico 1: Evolução Mensal
  const dataEvolucaoMensal = useMemo(() => {
    const map: Record<string, { mes: string; quantidade: number; valor: number }> = {};

    sinistros.forEach(s => {
      if (!s.dataHora) return;
      const d = s.dataHora.includes("T") ? s.dataHora.split("T")[0] : s.dataHora.split(" ")[0];
      const ym = d.substring(0, 7);
      if (!ym) return;

      if (!map[ym]) {
        const [ano, mes] = ym.split("-");
        const dt = new Date(parseInt(ano), parseInt(mes) - 1, 1);
        const rotulo = dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
        map[ym] = { mes: rotulo.toUpperCase(), quantidade: 0, valor: 0 };
      }
      map[ym].quantidade += 1;
      map[ym].valor += s.valorEstimadoPrejuizo || 0;
    });

    return Object.keys(map)
      .sort()
      .map(k => map[k]);
  }, [sinistros]);

  // Dados para Gráfico 2: Sinistros por Tipo de Evento
  const dataPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSinistros.forEach(s => {
      const tipo = s.tipoEvento || "Outros";
      map[tipo] = (map[tipo] || 0) + 1;
    });

    return Object.entries(map)
      .map(([tipo, qtd]) => ({ tipo, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [filteredSinistros]);

  // Dados para Gráfico 3: Severidade / Gravidade
  const dataPorGravidade = useMemo(() => {
    const map: Record<string, number> = { "Leve": 0, "Média": 0, "Grave": 0, "Gravíssima": 0 };
    filteredSinistros.forEach(s => {
      const g = s.gravidade || "Média";
      map[g] = (map[g] || 0) + 1;
    });

    return Object.entries(map)
      .filter(([_, qtd]) => qtd > 0)
      .map(([gravidade, qtd]) => ({
        gravidade,
        qtd,
        color: COLORS_SEVERIDADE[gravidade] || "#64748b"
      }));
  }, [filteredSinistros]);

  // Dados para Gráfico 4: Sinistros por Base Operacional
  const dataPorBase = useMemo(() => {
    const map: Record<string, { base: string; sinistros: number; valor: number }> = {};
    filteredSinistros.forEach(s => {
      const b = s.base || "Geral";
      if (!map[b]) map[b] = { base: b, sinistros: 0, valor: 0 };
      map[b].sinistros += 1;
      map[b].valor += s.valorEstimadoPrejuizo || 0;
    });

    return Object.values(map).sort((a, b) => b.sinistros - a.sinistros);
  }, [filteredSinistros]);

  // Dados para Gráfico 5: Culpabilidade
  const dataCulpabilidade = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSinistros.forEach(s => {
      const c = s.culpabilidade || "Em Apuração";
      map[c] = (map[c] || 0) + 1;
    });

    return Object.entries(map).map(([culpabilidade, qtd]) => ({
      culpabilidade,
      qtd,
      color: COLORS_CULPABILIDADE[culpabilidade] || "#94a3b8"
    }));
  }, [filteredSinistros]);

  // Dados para Gráfico 6: Top Veículos / Placas com Ocorrências
  const dataTopVeiculos = useMemo(() => {
    const map: Record<string, { placa: string; base: string; qtd: number }> = {};
    filteredSinistros.forEach(s => {
      const p = s.placa || "NÃO IDENTIFICADA";
      if (!map[p]) map[p] = { placa: p, base: s.base, qtd: 0 };
      map[p].qtd += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);
  }, [filteredSinistros]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-12 overflow-y-auto custom-scrollbar h-full">
      {/* Top Header Card com Ações Rápidas */}
      <div className="bg-white/95 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Conectado à Planilha Online (Sheet1)
            </span>
            <span className="text-xs text-slate-300">&bull;</span>
            <span className="text-[11px] font-semibold text-slate-500">Frota Pesada &bull; Risel Combustíveis</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Dashboard Executivo de Sinistros & Avarias
          </h2>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            Painel analítico e indicadores de sinistros conectados diretamente à aba Sheet1 da planilha no SharePoint
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Link Planilha SharePoint */}
          <a
            href={SHAREPOINT_EXCEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer"
            title="Abrir planilha Comunicado de Sinistro_Frota Pesada.xlsx no SharePoint"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Planilha SharePoint</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>

          {/* Link Microsoft Forms */}
          <a
            href={MICROSOFT_FORMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer"
            title="Abrir formulário de comunicado de sinistro"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Microsoft Forms</span>
          </a>

          {/* Link Google Drive */}
          <a
            href={GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer"
            title="Abrir pasta de Sinistros no Google Drive"
          >
            <FolderSync className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Google Drive</span>
          </a>

          {/* Ver Tabela */}
          <button
            onClick={onNavigateToSinistros}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs hover:shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Ver Lista</span>
          </button>

          {/* Novo Comunicado */}
          <button
            onClick={onOpenNewSinistroModal}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Refinada */}
      <div className="bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filtros do Dashboard:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro Mês */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-2 text-xs"
            >
              <option value="">Todos os meses</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro Base */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={selectedBase}
              onChange={(e) => setSelectedBase(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-2 text-xs"
            >
              <option value="">Todas as Bases</option>
              {availableBases.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filtro Gravidade */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <select
              value={selectedGravidade}
              onChange={(e) => setSelectedGravidade(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-2 text-xs"
            >
              <option value="">Todas as Severidades</option>
              <option value="Leve">Leve</option>
              <option value="Média">Média</option>
              <option value="Grave">Grave</option>
              <option value="Gravíssima">Gravíssima</option>
            </select>
          </div>

          {(selectedMonth || selectedBase || selectedGravidade) && (
            <button
              onClick={() => {
                setSelectedMonth("");
                setSelectedBase("");
                setSelectedGravidade("");
              }}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* CARDS DE KPI NO TOPO (Padrão de Excelência Visual) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Total de Sinistros */}
        <div className="p-3.5 rounded-xl border border-rose-150/80 hover:border-rose-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-rose-50/20 to-rose-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Total de Sinistros
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-rose-200/60 bg-rose-50 text-rose-600">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-display font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.total}
            </span>
            <span className="text-[9.5px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
              {metrics.emReparo} em reparo
            </span>
          </div>
          <span className="text-[9.5px] font-semibold text-slate-400 block mt-1">
            {metrics.emSeguradora} c/ seguradora ativa
          </span>
        </div>

        {/* KPI 2: Prejuízo Total Estimado */}
        <div className="p-3.5 rounded-xl border border-amber-150/80 hover:border-amber-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-amber-50/20 to-amber-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Prejuízo Estimado
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-amber-200/60 bg-amber-50 text-amber-600">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent block tracking-tight leading-none truncate">
              {metrics.valorPrejuizoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <span className="text-[9.5px] font-semibold text-slate-400 block mt-1">
            Avaliação preliminar orçamentária
          </span>
        </div>

        {/* KPI 3: Cobertura Seguradora */}
        <div className="p-3.5 rounded-xl border border-blue-150/80 hover:border-blue-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-blue-50/20 to-blue-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Indenizado / Seguro
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-blue-200/60 bg-blue-50 text-blue-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-display font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent block tracking-tight leading-none truncate">
              {metrics.valorPagoSeguradora.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
              {metrics.taxaCoberturaSeguro.toFixed(0)}%
            </span>
          </div>
          <span className="text-[9.5px] font-semibold text-slate-400 block mt-1">
            Recuperado via apólices
          </span>
        </div>

        {/* KPI 4: Custo Efetivo Risel */}
        <div className="p-3.5 rounded-xl border border-indigo-150/80 hover:border-indigo-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-indigo-50/20 to-indigo-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Custo Efetivo Risel
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-indigo-200/60 bg-indigo-50 text-indigo-600">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-display font-black bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent block tracking-tight leading-none truncate">
              {metrics.custoEfetivoRisel.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <span className="text-[9.5px] font-semibold text-slate-400 block mt-1">
            Franquias + reparos diretos
          </span>
        </div>

        {/* KPI 5: Severidade Grave / Gravíssima */}
        <div className="p-3.5 rounded-xl border border-red-150/80 hover:border-red-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-red-50/20 to-red-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Severidade Alta
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-red-200/60 bg-red-50 text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-display font-black bg-gradient-to-r from-red-700 to-red-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.gravesOuGravissimas}
            </span>
            <span className="text-[9.5px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/60">
              {metrics.percentGraves.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${Math.min(metrics.percentGraves, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 6: Taxa de Resolução / Finalizados */}
        <div className="p-3.5 rounded-xl border border-emerald-150/80 hover:border-emerald-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-500/[0.04] min-h-[90px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Casos Finalizados
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-emerald-200/60 bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-display font-black bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.finalizados}
            </span>
            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
              {metrics.percentConcluidos.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(metrics.percentConcluidos, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL DE GRÁFICOS BI (Grid responsivo) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GRÁFICO 1: Evolução Mensal dos Sinistros */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Evolução Histórica de Sinistros
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Volume de ocorrências e tendência temporal</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              Mensal
            </span>
          </div>
          <div className="h-64 w-full">
            {dataEvolucaoMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataEvolucaoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sinistroAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d664" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00d664" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px", border: "none" }}
                    formatter={(val: any) => [`${val} ocorrência(s)`, "Total"]}
                  />
                  <Area type="monotone" dataKey="quantidade" stroke="#00d664" strokeWidth={3} fillOpacity={1} fill="url(#sinistroAreaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem dados históricos para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: Distribuição por Tipo de Ocorrência */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Sinistros por Tipo de Evento
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Colisões, abalroamentos, tombamentos e avarias</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">
              Causas
            </span>
          </div>
          <div className="h-64 w-full">
            {dataPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPorTipo} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" tickLine={false} tick={{ fontSize: 10, fill: "#475569" }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px", border: "none" }}
                    formatter={(val: any) => [`${val} ocorrência(s)`, "Total"]}
                  />
                  <Bar dataKey="qtd" radius={[0, 6, 6, 0]}>
                    {dataPorTipo.map((_, index) => (
                      <Cell key={`cell-tipo-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem ocorrências registradas no filtro
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 3: Severidade / Gravidade (Donut Chart) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Nível de Gravidade & Severidade
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Classificação de impacto operacional e físico</p>
            </div>
          </div>
          <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center">
            {dataPorGravidade.length > 0 ? (
              <>
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataPorGravidade}
                        dataKey="qtd"
                        nameKey="gravidade"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {dataPorGravidade.map((entry, index) => (
                          <Cell key={`cell-grav-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px", border: "none" }}
                        formatter={(val: any) => [`${val} evento(s)`, "Qtd"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col gap-2 pl-4">
                  {dataPorGravidade.map((item) => (
                    <div key={item.gravidade} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-slate-700">{item.gravidade}</span>
                      </div>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {item.qtd} ({((item.qtd / metrics.total) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem dados de gravidade disponíveis
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 4: Sinistros por Base Operacional */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" /> Sinistros por Base Operacional
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Comparativo entre Paulínia, Aguaí, Santos e filiais</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
              Filiais
            </span>
          </div>
          <div className="h-64 w-full">
            {dataPorBase.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataPorBase} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="base" tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px", border: "none" }}
                    formatter={(val: any, name: any) => [name === "sinistros" ? `${val} ocorrência(s)` : `R$ ${val}`, "Sinistros"]}
                  />
                  <Bar dataKey="sinistros" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem registros para as bases no filtro
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 5: Índice de Culpabilidade */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" /> Apuração de Culpabilidade
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Responsabilidade Risel vs Terceiros e Condições Adversas</p>
            </div>
          </div>
          <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center">
            {dataCulpabilidade.length > 0 ? (
              <>
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataCulpabilidade}
                        dataKey="qtd"
                        nameKey="culpabilidade"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {dataCulpabilidade.map((entry, index) => (
                          <Cell key={`cell-culpa-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px", border: "none" }}
                        formatter={(val: any) => [`${val} caso(s)`, "Total"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col gap-2 pl-4">
                  {dataCulpabilidade.map((item) => (
                    <div key={item.culpabilidade} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-slate-700 truncate max-w-[130px]">{item.culpabilidade}</span>
                      </div>
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {item.qtd}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem registros de culpabilidade
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 6: Ranking de Placas / Veículos com Sinistros */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" /> Veículos com Ocorrências (Top 5)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Cavalos mecânicos com maior frequência de sinistros</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
              Frotas
            </span>
          </div>
          <div className="h-64 w-full">
            {dataTopVeiculos.length > 0 ? (
              <div className="h-full flex flex-col justify-around py-2">
                {dataTopVeiculos.map((v, i) => (
                  <div key={v.placa} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                        #{i + 1}
                      </span>
                      <div>
                        <span className="font-mono font-black text-xs text-slate-800 block leading-tight">{v.placa}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Base: {v.base}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-rose-600 block leading-tight">{v.qtd} evento{v.qtd > 1 ? "s" : ""}</span>
                      <span className="text-[9.5px] text-slate-400">Registrado no sistema</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum veículo com ocorrência no filtro selecionado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

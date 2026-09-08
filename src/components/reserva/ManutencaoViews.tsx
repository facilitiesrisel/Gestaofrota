import React, { useMemo, useState, useRef } from "react";
import { 
  Wrench, TrendingUp, TrendingDown, DollarSign, Calendar, MapPin, 
  Gauge, Activity, Search, LayoutDashboard, Table2, BarChart3,
  ChevronDown, ChevronUp, AlertTriangle, Trash2, Edit2, Plus, 
  Building2, X, CheckCircle2, Clock, Car, ShieldAlert,
  HelpCircle, ArrowUpDown, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, AreaChart, Area
} from "recharts";
import { Veiculo } from "../../pages/Frota";
import { MercosulPlateBadge } from "../MercosulPlateBadge";
import { SupabaseManutencao } from "../../services/supabaseService";
import { normalizeBaseOperacional, isSameCityOrBase } from "../../utils/baseOperacional";

export type Manutencao = SupabaseManutencao;

export function parseManutDate(dataStr?: string | null): Date {
  if (!dataStr) return new Date();
  const cleanStr = String(dataStr).trim();
  if (!cleanStr) return new Date();
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
  return isNaN(d.getTime()) ? new Date() : d;
}

export function calcDiasOficina(dataEntrada?: string, dataSaida?: string): number {
  if (!dataEntrada) return 0;
  const dEntrada = parseManutDate(dataEntrada);
  const dSaida = dataSaida ? parseManutDate(dataSaida) : parseManutDate(dataEntrada);
  const diffTime = dSaida.getTime() - dEntrada.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

const formatBRL = (val: number) => {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

const formatKm = (val: number) => {
  return (val || 0).toLocaleString("pt-BR") + " km";
};

export interface ManutencaoViewProps {
  manutencoes: Manutencao[];
  veiculos: Veiculo[];
  filterPlaca: string;
  filterBase: string;
  filterCondutor?: string;
  filterPeriodoInicio: string;
  filterPeriodoFim: string;
  filterTipo?: string;
  filterOficina?: string;
  filterMesAno?: string;
  onMesAnoChange?: (val: string) => void;
  onAddManutencao?: () => void;
  onUpdateManutencao?: (updated: Manutencao) => void;
  onDeleteManutencao?: (id: string) => void;
}

const mapManutencoesComVeiculos = (manutencoes: Manutencao[], veiculos: Veiculo[]): Manutencao[] => {
  if (!Array.isArray(manutencoes)) return [];

  return manutencoes.map(m => {
    const cleanPlate = String(m.placa || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const veic = (veiculos || []).find(v => v && v.placa && v.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === cleanPlate);
    const dataOS = m.data || new Date().toISOString().split("T")[0];
    const dataEntrada = m.dataEntrada || dataOS;
    const dataSaida = m.dataSaida || dataOS;

    return {
      ...m,
      placa: cleanPlate,
      data: dataOS,
      dataEntrada,
      dataSaida,
      base: normalizeBaseOperacional(veic?.filial || m.base || "CAMPINAS"),
      condutor: veic?.condutor || m.condutor || "Sem Motorista Associado",
      modelo: veic?.modelo || m.modelo || "VEÍCULO LEVE",
      custo: typeof m.custo === "number" && !isNaN(m.custo) ? m.custo : 0,
      odometro: typeof m.odometro === "number" && !isNaN(m.odometro) ? m.odometro : 0
    };
  });
};

// -------------------------------------------------------------
// VIEW 1: TABELA GERAL DE MANUTENÇÃO
// -------------------------------------------------------------
export const ManutencaoTableView: React.FC<ManutencaoViewProps> = ({
  manutencoes,
  veiculos,
  filterPlaca,
  filterBase,
  filterCondutor,
  filterPeriodoInicio,
  filterPeriodoFim,
  filterTipo,
  filterOficina,
  filterMesAno,
  onAddManutencao,
  onUpdateManutencao,
  onDeleteManutencao
}) => {
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [expandedPlacas, setExpandedPlacas] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"agrupado" | "linear">("linear");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("data");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingItem, setEditingItem] = useState<Manutencao | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Manutencao | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const togglePlaca = (placa: string) => {
    setExpandedPlacas(prev => ({ ...prev, [placa]: !prev[placa] }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "data" || field === "custo" ? "desc" : "asc");
    }
  };

  const manutencoesMapeadas = useMemo(() => {
    return mapManutencoesComVeiculos(manutencoes, veiculos);
  }, [manutencoes, veiculos]);

  // Filtragem
  const filteredList = useMemo(() => {
    return manutencoesMapeadas.filter(m => {
      if (filterPlaca && !m.placa.includes(filterPlaca)) return false;
      if (filterBase && !isSameCityOrBase(m.base, filterBase)) return false;
      if (filterCondutor && !m.condutor?.toLowerCase().includes(filterCondutor.toLowerCase())) return false;
      if (filterTipo && filterTipo !== "Todos" && m.tipo !== filterTipo) return false;
      if (filterOficina && !m.oficina?.toLowerCase().includes(filterOficina.toLowerCase())) return false;

      if (filterMesAno && m.data && !m.data.startsWith(filterMesAno)) return false;

      if (filterPeriodoInicio || filterPeriodoFim) {
        const d = parseManutDate(m.data);
        if (filterPeriodoInicio) {
          const start = new Date(filterPeriodoInicio + "T00:00:00");
          if (d < start) return false;
        }
        if (filterPeriodoFim) {
          const end = new Date(filterPeriodoFim + "T23:59:59");
          if (d > end) return false;
        }
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchPlaca = m.placa.toLowerCase().includes(term);
        const matchDesc = m.descricao?.toLowerCase().includes(term);
        const matchOficina = m.oficina?.toLowerCase().includes(term);
        const matchCondutor = m.condutor?.toLowerCase().includes(term);
        const matchModelo = m.modelo?.toLowerCase().includes(term);
        if (!matchPlaca && !matchDesc && !matchOficina && !matchCondutor && !matchModelo) {
          return false;
        }
      }

      return true;
    });
  }, [manutencoesMapeadas, filterPlaca, filterBase, filterCondutor, filterTipo, filterOficina, filterMesAno, filterPeriodoInicio, filterPeriodoFim, searchTerm]);

  // Métricas do conjunto filtrado
  const kpis = useMemo(() => {
    let totalCusto = 0;
    let totalPreventiva = 0;
    let custoPreventiva = 0;
    let totalCorretiva = 0;
    let custoCorretiva = 0;

    filteredList.forEach(m => {
      totalCusto += m.custo || 0;
      if (m.tipo === "Preventiva") {
        totalPreventiva++;
        custoPreventiva += m.custo || 0;
      } else {
        totalCorretiva++;
        custoCorretiva += m.custo || 0;
      }
    });

    const mediaPorOS = filteredList.length > 0 ? totalCusto / filteredList.length : 0;

    return {
      totalCusto,
      totalOS: filteredList.length,
      totalPreventiva,
      custoPreventiva,
      totalCorretiva,
      custoCorretiva,
      mediaPorOS
    };
  }, [filteredList]);

  // Lista ordenada linear
  const sortedLinearList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let valA: any = a[sortField as keyof Manutencao] || "";
      let valB: any = b[sortField as keyof Manutencao] || "";

      if (sortField === "custo" || sortField === "odometro") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      if (sortField === "data" || sortField === "dataEntrada" || sortField === "dataSaida") {
        const dA = String(a[sortField as keyof Manutencao] || a.data || "");
        const dB = String(b[sortField as keyof Manutencao] || b.data || "");
        return sortDirection === "asc" ? dA.localeCompare(dB) : dB.localeCompare(dA);
      }

      return sortDirection === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredList, sortField, sortDirection]);

  // Agrupamento por Veículo
  const vehicleGroups = useMemo(() => {
    const groups: Record<string, {
      placa: string;
      modelo: string;
      condutor: string;
      base: string;
      totalCusto: number;
      totalOS: number;
      preventivas: number;
      corretivas: number;
      ultimaData: string;
      ultimoOdometro: number;
      itens: Manutencao[];
    }> = {};

    filteredList.forEach(m => {
      if (!groups[m.placa]) {
        groups[m.placa] = {
          placa: m.placa,
          modelo: m.modelo || "",
          condutor: m.condutor || "",
          base: m.base || "",
          totalCusto: 0,
          totalOS: 0,
          preventivas: 0,
          corretivas: 0,
          ultimaData: m.data,
          ultimoOdometro: m.odometro,
          itens: []
        };
      }

      groups[m.placa].totalCusto += m.custo;
      groups[m.placa].totalOS += 1;
      if (m.tipo === "Preventiva") groups[m.placa].preventivas += 1;
      else groups[m.placa].corretivas += 1;

      if (m.data > groups[m.placa].ultimaData) {
        groups[m.placa].ultimaData = m.data;
        groups[m.placa].ultimoOdometro = m.odometro;
      }

      groups[m.placa].itens.push(m);
    });

    const list = Object.values(groups);
    list.forEach(g => {
      g.itens.sort((a, b) => b.data.localeCompare(a.data));
    });

    return list.sort((a, b) => b.totalCusto - a.totalCusto);
  }, [filteredList]);

  // Handler de salvar edição
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    onUpdateManutencao?.(editingItem);
    setEditingItem(null);
  };

  // Handler de criar nova manutenção
  const handleCreateNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const placa = (formData.get("placa") as string || "").toUpperCase().trim();
    const veic = veiculos.find(v => v.placa === placa);
    const dataOS = (formData.get("data") as string) || new Date().toISOString().split("T")[0];
    const dataEntrada = (formData.get("dataEntrada") as string) || dataOS;
    const dataSaida = (formData.get("dataSaida") as string) || dataOS;

    const nova: Manutencao = {
      id: `mn-${Date.now()}`,
      placa,
      tipo: (formData.get("tipo") as "Preventiva" | "Corretiva") || "Preventiva",
      descricao: (formData.get("descricao") as string || "").trim(),
      data: dataOS,
      dataEntrada,
      dataSaida,
      odometro: Number(formData.get("odometro")) || 0,
      custo: Number(formData.get("custo")) || 0,
      oficina: (formData.get("oficina") as string || "").trim() || "Oficina Credenciada",
      nf_os: (formData.get("nf_os") as string || "").trim(),
      condutor: veic?.condutor,
      base: veic?.filial,
      modelo: veic?.modelo,
      status: "Concluída",
      observacoes: (formData.get("observacoes") as string || "").trim()
    };

    onUpdateManutencao?.(nova);
    setIsNewModalOpen(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3 animate-in fade-in duration-200 overflow-hidden text-left">
      {/* 1. KPIs Rápidos no Topo */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-[#114D38]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custo Total</span>
            <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight block truncate">
              {formatBRL(kpis.totalCusto)}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">{kpis.totalOS} Ordens de Serviço</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Preventivas</span>
            <span className="text-base sm:text-lg font-black text-blue-700 tracking-tight block truncate">
              {kpis.totalPreventiva} OS
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">{formatBRL(kpis.custoPreventiva)}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Corretivas</span>
            <span className="text-base sm:text-lg font-black text-amber-700 tracking-tight block truncate">
              {kpis.totalCorretiva} OS
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">{formatBRL(kpis.custoCorretiva)}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média por OS</span>
            <span className="text-base sm:text-lg font-black text-purple-700 tracking-tight block truncate">
              {formatBRL(kpis.mediaPorOS)}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Custo Médio</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Veículos Atendidos</span>
            <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight block truncate">
              {vehicleGroups.length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">de {veiculos.length} veículos</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Controle da Tabela */}
      <div className="shrink-0 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar placa, oficina, serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#114D38] focus:bg-white"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode("linear")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "linear"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Exibir todas as ordens de serviço em lista contínua"
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Lista de OS</span>
            </button>
            <button
              onClick={() => setViewMode("agrupado")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "agrupado"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Agrupar histórico de manutenções por veículo"
            >
              <Car className="w-3.5 h-3.5" />
              <span>Por Veículo</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95 border border-emerald-800 shrink-0"
          >
            <Plus className="w-4 h-4 text-emerald-300" />
            <span>Nova Manutenção (OS)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela Principal */}
      <div 
        ref={tableScrollRef}
        className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-auto custom-scrollbar"
      >
        {viewMode === "linear" ? (
          /* MODO LISTA LINEAR */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 font-black text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("data")}>
                  <div className="flex items-center gap-1">
                    <span>Data OS</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("dataEntrada")}>
                  <div className="flex items-center gap-1">
                    <span>Entrada / Saída</span>
                    <Clock className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("placa")}>
                  <div className="flex items-center gap-1">
                    <span>Placa / Veículo</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("tipo")}>
                  <div className="flex items-center gap-1">
                    <span>Tipo</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Descrição do Serviço</th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("oficina")}>
                  <div className="flex items-center gap-1">
                    <span>Oficina / Fornecedor</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800" onClick={() => handleSort("base")}>
                  <div className="flex items-center gap-1">
                    <span>Base</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800 text-right" onClick={() => handleSort("odometro")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Odômetro</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-800 text-right" onClick={() => handleSort("custo")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Custo Total</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sortedLinearList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">Nenhuma manutenção encontrada.</p>
                  </td>
                </tr>
              ) : (
                sortedLinearList.map((m) => {
                  const diasOficina = calcDiasOficina(m.dataEntrada || m.data, m.dataSaida || m.data);
                  return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-800">
                      {m.data}
                      {m.nf_os && (
                        <span className="block text-[10px] text-slate-400 font-mono">OS: {m.nf_os}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-[11px] font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Entrada:</span>
                          <span className="font-mono font-bold text-slate-800">{m.dataEntrada || m.data}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Saída:</span>
                          <span className="font-mono font-bold text-slate-800">{m.dataSaida || m.data}</span>
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full font-black text-[9px] border ${
                          diasOficina === 0 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : diasOficina <= 2
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {diasOficina === 0 ? "Mesmo dia (0d)" : `${diasOficina} dias oficina`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <MercosulPlateBadge plate={m.placa} size="sm" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block text-xs truncate">{m.modelo}</span>
                          <span className="text-[10px] text-slate-500 block truncate">{m.condutor}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase ${
                        m.tipo === "Preventiva"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed" title={m.descricao}>
                        {m.descricao}
                      </p>
                      {m.observacoes && (
                        <span className="block text-[10px] text-slate-400 italic truncate mt-0.5">
                          Obs: {m.observacoes}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 block">{m.oficina}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-semibold">
                      {m.base}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-slate-700">
                      {m.odometro > 0 ? formatKm(m.odometro) : "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right font-black text-slate-900 text-sm">
                      {formatBRL(m.custo)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingItem(m)}
                          className="p-1.5 text-slate-400 hover:text-[#114D38] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Ordem de Serviço"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(m)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Registro de Manutenção"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          /* MODO AGRUPADO POR VEÍCULO */
          <div className="divide-y divide-slate-100">
            {vehicleGroups.length === 0 ? (
              <div className="py-14 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Car className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">Nenhum histórico por veículo.</p>
              </div>
            ) : (
              vehicleGroups.map((g) => {
                const isExpanded = !!expandedPlacas[g.placa];
                return (
                  <div key={g.placa} className="hover:bg-slate-50/50 transition-colors">
                    {/* Linha Resumo do Veículo */}
                    <div 
                      onClick={() => togglePlaca(g.placa)}
                      className="p-4 flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button className="p-1 text-slate-400 hover:text-slate-600 rounded">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <MercosulPlateBadge plate={g.placa} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-sm">{g.modelo}</span>
                            <span className="text-xs text-slate-500 font-medium">({g.base})</span>
                          </div>
                          <span className="text-xs text-slate-500 block truncate">Condutor: {g.condutor}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-right">
                        <div className="hidden sm:block">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ordens de Serviço</span>
                          <span className="font-bold text-slate-700 text-xs">
                            {g.totalOS} OS ({g.preventivas} Prev. / {g.corretivas} Corr.)
                          </span>
                        </div>
                        <div className="hidden md:block">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Último Serviço</span>
                          <span className="font-bold text-slate-700 text-xs">{g.ultimaData}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custo Acumulado</span>
                          <span className="font-black text-slate-900 text-base">{formatBRL(g.totalCusto)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Subtabela Expansível de Detalhes daquele Veículo */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50/70 border-t border-slate-150 px-4 py-3"
                        >
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100/80 font-black text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Data OS</th>
                                  <th className="py-2.5 px-3">Entrada / Saída</th>
                                  <th className="py-2.5 px-3">Tipo</th>
                                  <th className="py-2.5 px-3">Descrição do Serviço Realizado</th>
                                  <th className="py-2.5 px-3">Oficina</th>
                                  <th className="py-2.5 px-3 text-right">Odômetro</th>
                                  <th className="py-2.5 px-3 text-right">Custo Total</th>
                                  <th className="py-2.5 px-3 text-center">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {g.itens.map(item => {
                                  const diasItem = calcDiasOficina(item.dataEntrada || item.data, item.dataSaida || item.data);
                                  return (
                                  <tr key={item.id} className="hover:bg-slate-50/80">
                                    <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-800">
                                      {item.data}
                                      {item.nf_os && <span className="block text-[9px] text-slate-400 font-mono">OS: {item.nf_os}</span>}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <div className="text-[10px] font-semibold text-slate-700">
                                        <span>{item.dataEntrada || item.data} ➔ {item.dataSaida || item.data}</span>
                                        <span className={`block font-black text-[9px] ${
                                          diasItem === 0 ? "text-emerald-700" : "text-amber-700"
                                        }`}>
                                          ({diasItem === 0 ? "0d mesmo dia" : `${diasItem} dias oficina`})
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                        item.tipo === "Preventiva"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                                          : "bg-amber-50 text-amber-700 border border-amber-200"
                                      }`}>
                                        {item.tipo}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-700 font-medium">
                                      {item.descricao}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-semibold">
                                      {item.oficina}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-slate-700">
                                      {item.odometro > 0 ? formatKm(item.odometro) : "-"}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap text-right font-bold text-slate-900">
                                      {formatBRL(item.custo)}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                                          className="p-1 text-slate-400 hover:text-[#114D38] rounded transition-colors"
                                          title="Editar"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                          title="Excluir"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. Modal de Edição */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-lg">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-300" />
                <h3 className="font-display font-bold text-sm">Editar Ordem de Serviço</h3>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Veículo / Placa</label>
                  <input
                    type="text"
                    disabled
                    value={`${editingItem.placa} - ${editingItem.modelo || ""}`}
                    className="w-full bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Tipo de Manutenção</label>
                  <select
                    value={editingItem.tipo}
                    onChange={(e) => setEditingItem({ ...editingItem, tipo: e.target.value as any })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  >
                    <option value="Preventiva">Preventiva (Revisão / Periódica)</option>
                    <option value="Corretiva">Corretiva (Conserto / Quebra)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data da OS *</label>
                  <input
                    type="date"
                    required
                    value={editingItem.data}
                    onChange={(e) => setEditingItem({ ...editingItem, data: e.target.value })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Custo Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingItem.custo}
                    onChange={(e) => setEditingItem({ ...editingItem, custo: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              {/* Data Entrada e Saída Oficina */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data Entrada Oficina *</label>
                  <input
                    type="date"
                    required
                    value={editingItem.dataEntrada || editingItem.data}
                    onChange={(e) => setEditingItem({ ...editingItem, dataEntrada: e.target.value })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Data Saída Oficina *</label>
                  <input
                    type="date"
                    required
                    value={editingItem.dataSaida || editingItem.data}
                    onChange={(e) => setEditingItem({ ...editingItem, dataSaida: e.target.value })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] font-bold text-emerald-900">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tempo em Oficina:</span>
                </div>
                <span className="font-black text-emerald-800">
                  {calcDiasOficina(editingItem.dataEntrada || editingItem.data, editingItem.dataSaida || editingItem.data) === 0
                    ? "Mesmo dia (0 dias)"
                    : `${calcDiasOficina(editingItem.dataEntrada || editingItem.data, editingItem.dataSaida || editingItem.data)} dias`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Odômetro (km)</label>
                  <input
                    type="number"
                    value={editingItem.odometro}
                    onChange={(e) => setEditingItem({ ...editingItem, odometro: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Número da OS / NF</label>
                  <input
                    type="text"
                    placeholder="Ex: OS-12345"
                    value={editingItem.nf_os || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, nf_os: e.target.value })}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block">Oficina / Prestador de Serviço *</label>
                <input
                  type="text"
                  required
                  value={editingItem.oficina}
                  onChange={(e) => setEditingItem({ ...editingItem, oficina: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Descrição dos Serviços e Peças *</label>
                <textarea
                  rows={3}
                  required
                  value={editingItem.descricao}
                  onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Observações Complementares</label>
                <input
                  type="text"
                  value={editingItem.observacoes || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, observacoes: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal de Nova Manutenção */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-lg">
            <div className="bg-[#114D38] px-5 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-300" />
                <h3 className="font-display font-bold text-sm">Registrar Ordem de Serviço (Oficina)</h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNew} className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Selecione o Veículo *</label>
                  <select
                    name="placa"
                    required
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  >
                    {veiculos.map(v => (
                      <option key={v.id} value={v.placa}>
                        {v.placa} - {v.modelo} ({v.filial || "Sede"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block">Tipo de Manutenção *</label>
                  <select
                    name="tipo"
                    required
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  >
                    <option value="Preventiva">Preventiva (Revisão Periódica)</option>
                    <option value="Corretiva">Corretiva (Reparo / Quebra)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data da OS *</label>
                  <input
                    type="date"
                    name="data"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Custo Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="custo"
                    required
                    placeholder="Ex: 650.00"
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              {/* Data Entrada e Saída Oficina */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Data Entrada Oficina *</label>
                  <input
                    type="date"
                    name="dataEntrada"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Data Saída Oficina *</label>
                  <input
                    type="date"
                    name="dataSaida"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block">Odômetro do Serviço (km) *</label>
                  <input
                    type="number"
                    name="odometro"
                    required
                    placeholder="Ex: 45000"
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block">Número da OS / NF</label>
                  <input
                    type="text"
                    name="nf_os"
                    placeholder="Ex: OS-2026-90"
                    className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block">Oficina / Prestador de Serviços *</label>
                <input
                  type="text"
                  name="oficina"
                  required
                  placeholder="Ex: Oficina Multimarcas Macaé"
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38]"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Descrição dos Serviços e Peças *</label>
                <textarea
                  name="descricao"
                  rows={3}
                  required
                  placeholder="Ex: Substituição das pastilhas de freio dianteiras, troca de óleo 5W30 e filtro de combustível..."
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="block">Observações Complementares</label>
                <input
                  type="text"
                  name="observacoes"
                  placeholder="Ex: Garantia de 6 meses nas peças substituídas"
                  className="w-full border border-slate-200 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#114D38] font-normal"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                >
                  Gravar Ordem de Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">Excluir Manutenção</h4>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente remover o registro de manutenção do veículo{" "}
                <span className="font-bold text-slate-800">{itemToDelete.placa}</span> de{" "}
                <span className="font-bold text-slate-800">{itemToDelete.data}</span>?
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteManutencao?.(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-sm"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// VIEW 2: BI DASHBOARD DE MANUTENÇÃO (ANÁLISE E INDICADORES)
// -------------------------------------------------------------
export const ManutencaoDashboardView: React.FC<ManutencaoViewProps> = ({
  manutencoes,
  veiculos,
  filterPlaca,
  filterBase,
  filterCondutor,
  filterPeriodoInicio,
  filterPeriodoFim,
  filterTipo,
  filterOficina,
  filterMesAno
}) => {
  const dashboardScrollRef = useRef<HTMLDivElement>(null);

  const manutencoesMapeadas = useMemo(() => {
    return mapManutencoesComVeiculos(manutencoes, veiculos);
  }, [manutencoes, veiculos]);

  // Filtragem
  const filteredList = useMemo(() => {
    return manutencoesMapeadas.filter(m => {
      if (filterPlaca && !m.placa.includes(filterPlaca)) return false;
      if (filterBase && !isSameCityOrBase(m.base, filterBase)) return false;
      if (filterCondutor && !m.condutor?.toLowerCase().includes(filterCondutor.toLowerCase())) return false;
      if (filterTipo && filterTipo !== "Todos" && m.tipo !== filterTipo) return false;
      if (filterOficina && !m.oficina?.toLowerCase().includes(filterOficina.toLowerCase())) return false;
      if (filterMesAno && m.data && !m.data.startsWith(filterMesAno)) return false;

      if (filterPeriodoInicio || filterPeriodoFim) {
        const d = parseManutDate(m.data);
        if (filterPeriodoInicio) {
          const start = new Date(filterPeriodoInicio + "T00:00:00");
          if (d < start) return false;
        }
        if (filterPeriodoFim) {
          const end = new Date(filterPeriodoFim + "T23:59:59");
          if (d > end) return false;
        }
      }

      return true;
    });
  }, [manutencoesMapeadas, filterPlaca, filterBase, filterCondutor, filterTipo, filterOficina, filterMesAno, filterPeriodoInicio, filterPeriodoFim]);

  // Estatísticas e Agregações
  const stats = useMemo(() => {
    let totalCusto = 0;
    let totalPreventiva = 0;
    let custoPreventiva = 0;
    let totalCorretiva = 0;
    let custoCorretiva = 0;
    let totalDiasOficina = 0;

    filteredList.forEach(m => {
      totalCusto += m.custo || 0;
      const dias = calcDiasOficina(m.dataEntrada || m.data, m.dataSaida || m.data);
      totalDiasOficina += dias;
      if (m.tipo === "Preventiva") {
        totalPreventiva++;
        custoPreventiva += m.custo || 0;
      } else {
        totalCorretiva++;
        custoCorretiva += m.custo || 0;
      }
    });

    const totalOS = filteredList.length;
    const mediaPorOS = totalOS > 0 ? totalCusto / totalOS : 0;
    const mediaDiasOficina = totalOS > 0 ? totalDiasOficina / totalOS : 0;
    const percentPreventiva = totalCusto > 0 ? (custoPreventiva / totalCusto) * 100 : 0;
    const percentCorretiva = totalCusto > 0 ? (custoCorretiva / totalCusto) * 100 : 0;

    return {
      totalCusto,
      totalOS,
      totalPreventiva,
      custoPreventiva,
      totalCorretiva,
      custoCorretiva,
      mediaPorOS,
      totalDiasOficina,
      mediaDiasOficina,
      percentPreventiva,
      percentCorretiva
    };
  }, [filteredList]);

  // 1. Dados de Evolução Mensal (Área/Barra)
  const monthlyData = useMemo(() => {
    const monthsMap: Record<string, { month: string; preventiva: number; corretiva: number; total: number; osCount: number }> = {};

    filteredList.forEach(m => {
      const monthKey = m.data ? m.data.substring(0, 7) : "Indefinido";
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          month: monthKey,
          preventiva: 0,
          corretiva: 0,
          total: 0,
          osCount: 0
        };
      }
      if (m.tipo === "Preventiva") {
        monthsMap[monthKey].preventiva += m.custo;
      } else {
        monthsMap[monthKey].corretiva += m.custo;
      }
      monthsMap[monthKey].total += m.custo;
      monthsMap[monthKey].osCount += 1;
    });

    return Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredList]);

  // 2. Top Veículos com Maior Custo
  const topVehicles = useMemo(() => {
    const vehMap: Record<string, { placa: string; modelo: string; custo: number; osCount: number }> = {};

    filteredList.forEach(m => {
      if (!vehMap[m.placa]) {
        vehMap[m.placa] = {
          placa: m.placa,
          modelo: m.modelo || "",
          custo: 0,
          osCount: 0
        };
      }
      vehMap[m.placa].custo += m.custo;
      vehMap[m.placa].osCount += 1;
    });

    return Object.values(vehMap)
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 7);
  }, [filteredList]);

  // 3. Distribuição por Oficina (Custo e Tempo Médio)
  const oficinasData = useMemo(() => {
    const ofMap: Record<string, { oficina: string; custo: number; osCount: number; totalDias: number; mediaDias: number }> = {};

    filteredList.forEach(m => {
      const ofName = m.oficina || "Outros";
      const dias = calcDiasOficina(m.dataEntrada || m.data, m.dataSaida || m.data);
      if (!ofMap[ofName]) {
        ofMap[ofName] = { oficina: ofName, custo: 0, osCount: 0, totalDias: 0, mediaDias: 0 };
      }
      ofMap[ofName].custo += m.custo;
      ofMap[ofName].osCount += 1;
      ofMap[ofName].totalDias += dias;
    });

    return Object.values(ofMap).map(item => ({
      ...item,
      mediaDias: item.osCount > 0 ? Number((item.totalDias / item.osCount).toFixed(1)) : 0
    })).sort((a, b) => b.custo - a.custo).slice(0, 6);
  }, [filteredList]);

  // 4. Distribuição por Base Operacional
  const baseData = useMemo(() => {
    const bMap: Record<string, { base: string; custo: number; osCount: number }> = {};

    filteredList.forEach(m => {
      const baseName = m.base || "CAMPINAS";
      if (!bMap[baseName]) {
        bMap[baseName] = { base: baseName, custo: 0, osCount: 0 };
      }
      bMap[baseName].custo += m.custo;
      bMap[baseName].osCount += 1;
    });

    return Object.values(bMap).sort((a, b) => b.custo - a.custo);
  }, [filteredList]);

  // 5. Veículos com Maior Tempo Imobilizado em Oficina (Dias)
  const topVehiclesDias = useMemo(() => {
    const vehMap: Record<string, { placa: string; modelo: string; dias: number; osCount: number; custo: number }> = {};

    filteredList.forEach(m => {
      const dias = calcDiasOficina(m.dataEntrada || m.data, m.dataSaida || m.data);
      if (!vehMap[m.placa]) {
        vehMap[m.placa] = {
          placa: m.placa,
          modelo: m.modelo || "",
          dias: 0,
          osCount: 0,
          custo: 0
        };
      }
      vehMap[m.placa].dias += dias;
      vehMap[m.placa].osCount += 1;
      vehMap[m.placa].custo += m.custo;
    });

    return Object.values(vehMap)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 6);
  }, [filteredList]);

  return (
    <div 
      ref={dashboardScrollRef}
      className="flex-1 min-h-0 flex flex-col space-y-4 animate-in fade-in duration-200 overflow-y-auto custom-scrollbar text-left pb-6"
    >
      {/* 1. CARDS DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Investimento Total</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-display font-black text-slate-800 block mt-2 tracking-tight">
            {formatBRL(stats.totalCusto)}
          </span>
          <span className="text-xs text-slate-500 font-semibold block mt-1">
            {stats.totalOS} Ordens Realizadas
          </span>
        </div>

        {/* Novo Card: Tempo Médio em Oficina */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempo Médio Oficina</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-display font-black text-teal-800 tracking-tight">
              {stats.mediaDiasOficina.toFixed(1)}
            </span>
            <span className="text-sm font-bold text-teal-700">dias / OS</span>
          </div>
          <span className="text-xs text-slate-500 font-semibold block mt-1">
            Total {stats.totalDiasOficina} dias imobilizados
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preventivas</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-display font-black text-blue-700 tracking-tight">
              {formatBRL(stats.custoPreventiva)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mt-1">
            <span>{stats.totalPreventiva} OS ({stats.percentPreventiva.toFixed(0)}%)</span>
            <span className="text-blue-600 font-black">Saudável</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corretivas</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-display font-black text-amber-700 tracking-tight">
              {formatBRL(stats.custoCorretiva)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mt-1">
            <span>{stats.totalCorretiva} OS ({stats.percentCorretiva.toFixed(0)}%)</span>
            <span className="text-amber-600 font-black">Atenção</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ticket Médio / OS</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-display font-black text-purple-700 block mt-2 tracking-tight">
            {formatBRL(stats.mediaPorOS)}
          </span>
          <span className="text-xs text-slate-500 font-semibold block mt-1">
            Média por intervenção
          </span>
        </div>
      </div>

      {/* 2. GRÁFICOS: EVOLUÇÃO TEMPORAL & COMPARATIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Gráfico 1: Evolução dos Custos Mês a Mês */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-display font-black text-sm text-slate-800">Evolução dos Custos de Manutenção</h4>
              <p className="text-xs text-slate-400 font-medium">Comparativo mensal entre Preventivas e Corretivas</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-slate-600">Preventiva</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-slate-600">Corretiva</span>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Sem dados suficientes no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatBRL(Number(value)), ""]}
                    labelFormatter={(label) => `Mês: ${label}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="preventiva" name="Preventiva" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="corretiva" name="Corretiva" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Top Veículos com Maior Custo */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="mb-3">
            <h4 className="font-display font-black text-sm text-slate-800">Top Veículos por Custo</h4>
            <p className="text-xs text-slate-400 font-medium">Veículos com maior despesa de oficina</p>
          </div>

          <div className="flex-1 min-h-[220px] space-y-2.5 overflow-y-auto custom-scrollbar pr-1">
            {topVehicles.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Sem registros de manutenção.
              </div>
            ) : (
              topVehicles.map((v, idx) => {
                const maxCusto = topVehicles[0]?.custo || 1;
                const pct = (v.custo / maxCusto) * 100;
                return (
                  <div key={v.placa} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <MercosulPlateBadge plate={v.placa} size="sm" />
                        <span className="text-[10px] text-slate-500 truncate max-w-[80px] font-semibold">{v.modelo}</span>
                      </div>
                      <span className="font-black text-xs text-slate-900">{formatBRL(v.custo)}</span>
                    </div>
                    {/* Barra de Progresso */}
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#114D38] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold self-end">{v.osCount} atendimentos</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. GRÁFICOS: OFICINAS & BASES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Distribuição por Oficina */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="mb-4">
            <h4 className="font-display font-black text-sm text-slate-800">Oficinas e Fornecedores</h4>
            <p className="text-xs text-slate-400 font-medium">Volume financeiro por prestador credenciado</p>
          </div>
          <div className="h-56 w-full">
            {oficinasData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Sem registros de oficinas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oficinasData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="oficina" tick={{ fontSize: 10, fill: '#334155' }} width={110} />
                  <Tooltip formatter={(v: any) => [formatBRL(Number(v)), "Total"]} />
                  <Bar dataKey="custo" fill="#114D38" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Distribuição por Base Operacional */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="mb-4">
            <h4 className="font-display font-black text-sm text-slate-800">Custos por Base Operacional</h4>
            <p className="text-xs text-slate-400 font-medium">Distribuição geográfica dos custos de frota</p>
          </div>
          <div className="h-56 w-full">
            {baseData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Sem registros de bases.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={baseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="base" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip formatter={(v: any) => [formatBRL(Number(v)), "Total Base"]} />
                  <Bar dataKey="custo" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 4. ANÁLISE DE TEMPO EM OFICINA (ENTRADA ➔ SAÍDA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Agilidade / Tempo Médio por Oficina */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-display font-black text-sm text-slate-800">Tempo Médio por Oficina (Dias)</h4>
              <p className="text-xs text-slate-400 font-medium">Prazo médio entre a entrada e a saída do veículo</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="h-56 w-full">
            {oficinasData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Sem registros de permanência em oficinas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={oficinasData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `${v}d`} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="oficina" tick={{ fontSize: 10, fill: '#334155' }} width={110} />
                  <Tooltip 
                    formatter={(v: any) => [`${v} dias em média`, "Tempo Médio"]} 
                    labelFormatter={(l) => `Oficina: ${l}`}
                  />
                  <Bar dataKey="mediaDias" fill="#0f766e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Veículos com Maior Tempo Imobilizado */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-display font-black text-sm text-slate-800">Veículos Mais Tempo em Oficina</h4>
              <p className="text-xs text-slate-400 font-medium">Acúmulo total de dias parados em manutenção</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 min-h-[220px] space-y-2.5 overflow-y-auto custom-scrollbar pr-1">
            {topVehiclesDias.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                Nenhum veículo com tempo registrado.
              </div>
            ) : (
              topVehiclesDias.map((v, idx) => {
                const maxDias = topVehiclesDias[0]?.dias || 1;
                const pct = (v.dias / maxDias) * 100;
                return (
                  <div key={v.placa} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <MercosulPlateBadge plate={v.placa} size="sm" />
                        <span className="text-[10px] text-slate-500 truncate max-w-[80px] font-semibold">{v.modelo}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-xs text-teal-900 block">
                          {v.dias === 0 ? "Mesmo dia (0d)" : `${v.dias} dias totais`}
                        </span>
                      </div>
                    </div>
                    {/* Barra de Progresso de Dias */}
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-teal-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(5, pct)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                      <span>{v.osCount} atendimentos</span>
                      <span>Total: {formatBRL(v.custo)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

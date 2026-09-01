import React, { useMemo, useState, useEffect, useRef } from "react";
import { 
  FileSpreadsheet, TrendingUp, TrendingDown, DollarSign, Droplets, MapPin, 
  Gauge, Activity, Search, Crown, Calendar, Users, Eye, LayoutDashboard, Table2, BarChart3,
  ChevronDown, ChevronUp, ChevronsUpDown, Plus, Minus, Info, AlertTriangle, Trash2, Edit2, Save, X,
  Fuel, Sparkles, MoveUp, MoveDown, Building2, Zap, RotateCcw, ArrowUp, ArrowDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, AreaChart, Area, ReferenceLine
} from "recharts";
import { Veiculo, Abastecimento } from "../../pages/Frota";
import { toTitleCase } from "../../lib/utils";

export function parseAbastDate(dataStr?: string | null): Date {
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

interface AbastecimentoViewProps {
  abastecimentos: Abastecimento[];
  veiculos: Veiculo[];
  filterPlaca: string;
  filterBase: string;
  filterCondutor?: string;
  filterPeriodoInicio: string;
  filterPeriodoFim: string;
  filterMesAno?: string;
  onMesAnoChange?: (val: string) => void;
  onImport?: () => void;
  onClearData?: () => void;
  onUpdateAbastecimento?: (updated: Abastecimento) => void;
  onDeleteAbastecimento?: (id: string) => void;
}

const mapAbastecimentosComVeiculos = (abastecimentos: Abastecimento[], veiculos: Veiculo[]): Abastecimento[] => {
  if (!Array.isArray(abastecimentos)) return [];

  const allowedPlates = new Set(
    (veiculos || []).map(v => v && v.placa ? v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '').filter(Boolean)
  );
  
  return abastecimentos
    .filter(ab => {
      if (!ab || typeof ab !== 'object' || !ab.placa) return false;
      const cleanPlate = String(ab.placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (!cleanPlate) return false;
      return allowedPlates.size === 0 || allowedPlates.has(cleanPlate);
    })
    .map(ab => {
      const cleanPlate = String(ab.placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const veic = (veiculos || []).find(v => v && v.placa && v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
      return {
        ...ab,
        placa: cleanPlate,
        base: veic ? veic.filial : (ab.base || "CAMPINEIRA"),
        condutor: veic ? veic.condutor : (ab.condutor || "Sem Motorista Associado"),
        litros: typeof ab.litros === 'number' && !isNaN(ab.litros) ? ab.litros : 0,
        valorTotal: typeof ab.valorTotal === 'number' && !isNaN(ab.valorTotal) ? ab.valorTotal : 0,
        kmPercorrido: typeof ab.kmPercorrido === 'number' && !isNaN(ab.kmPercorrido) ? ab.kmPercorrido : 0
      };
    });
};

// -------------------------------------------------------------
// HELPER FUNCTIONS & TIME-COMPARISON ENGINE
// -------------------------------------------------------------
const getComparisonDates = (
  abastecimentos: Abastecimento[],
  filterPeriodoInicio?: string,
  filterPeriodoFim?: string
) => {
  // Se o usuário selecionou um período específico
  if (filterPeriodoInicio && filterPeriodoFim) {
    const startCurrent = new Date(filterPeriodoInicio + "T00:00:00");
    const endCurrent = new Date(filterPeriodoFim + "T23:59:59");
    
    // Calcular a diferença em milissegundos para retroceder o mesmo intervalo
    const durationMs = endCurrent.getTime() - startCurrent.getTime();
    
    const startPast = new Date(startCurrent.getTime() - durationMs - 1000);
    const endPast = new Date(endCurrent.getTime() - durationMs - 1000);
    
    return { startCurrent, endCurrent, startPast, endPast, isCustomRange: true };
  }

  // Se não há filtro de período, achar a data de referência padrão (última data do dataset para não vir vazio)
  let refDate = new Date();
  if (Array.isArray(abastecimentos) && abastecimentos.length > 0) {
    const timeStamps = abastecimentos
      .map(a => (a && a.data) ? parseAbastDate(a.data).getTime() : NaN)
      .filter(t => !isNaN(t));
    if (timeStamps.length > 0) {
      const maxTs = Math.max(...timeStamps);
      if (!isNaN(maxTs) && maxTs > 0) {
        refDate = new Date(maxTs);
      }
    }
  }

  const currentMonth = refDate.getMonth();
  const currentYear = refDate.getFullYear();
  const currentDay = refDate.getDate();
  
  // Período atual: 1º do mês de referência até o dia de referência
  const startCurrent = new Date(currentYear, currentMonth, 1, 0, 0, 0);
  const endCurrent = new Date(currentYear, currentMonth, currentDay, 23, 59, 59);

  // Período anterior correspondente: 1º do mês anterior até o mesmo dia do mês anterior
  const startPast = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0);
  const daysInPastMonth = new Date(currentYear, currentMonth, 0).getDate();
  const pastEndDay = Math.min(currentDay, daysInPastMonth);
  const endPast = new Date(currentYear, currentMonth - 1, pastEndDay, 23, 59, 59);

  return { startCurrent, endCurrent, startPast, endPast, isCustomRange: false, refDate };
};

const formatCurrency = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNum = (val: number) => (val || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const formatLitros = (val: number) => (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " L";


// -------------------------------------------------------------
// VIEW 1: TABELA DE ABASTECIMENTO (FOCO PRINCIPAL)
// -------------------------------------------------------------
export const AbastecimentoTableView: React.FC<AbastecimentoViewProps> = ({ 
  abastecimentos, veiculos, filterPlaca, filterBase, filterPeriodoInicio, filterPeriodoFim, filterCondutor, filterMesAno, onMesAnoChange, onImport, onClearData, onUpdateAbastecimento, onDeleteAbastecimento
}) => {
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [expandedPlacas, setExpandedPlacas] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<string>("placa");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingItem, setEditingItem] = useState<Abastecimento | null>(null);

  const togglePlaca = (placa: string) => {
    setExpandedPlacas(prev => ({ ...prev, [placa]: !prev[placa] }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const abastecimentosMapeados = useMemo(() => {
    return mapAbastecimentosComVeiculos(abastecimentos, veiculos);
  }, [abastecimentos, veiculos]);

  const { startCurrent, endCurrent, startPast, endPast, isCustomRange } = useMemo(() => {
    return getComparisonDates(abastecimentosMapeados, filterPeriodoInicio, filterPeriodoFim);
  }, [abastecimentosMapeados, filterPeriodoInicio, filterPeriodoFim]);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    abastecimentos.forEach(ab => {
      if (ab.data && ab.data.length >= 7) {
        meses.add(ab.data.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(meses).sort((a, b) => b.localeCompare(a));
  }, [abastecimentos]);

  const rawData = useMemo(() => {
    let filtered = abastecimentosMapeados;
    if (filterPlaca) filtered = filtered.filter(a => a.placa.includes(filterPlaca));
    if (filterBase) filtered = filtered.filter(a => a.base === filterBase);
    if (filterCondutor) filtered = filtered.filter(a => a.condutor.toLowerCase().includes(filterCondutor.toLowerCase()));
    
    // Agrupar por Placa
    const groups: Record<string, any> = {};

    filtered.forEach(ab => {
      const d = parseAbastDate(ab.data);
      if (!groups[ab.placa]) {
        groups[ab.placa] = {
          placa: ab.placa,
          base: ab.base,
          condutor: ab.condutor,
          litrosCurrent: 0,
          litrosPast: 0,
          kmCurrent: 0,
          kmPast: 0,
          valorCurrent: 0,
          valorPast: 0,
          abastecimentosDetalhe: []
        };
      }
      
      if (!groups[ab.placa].base && ab.base) groups[ab.placa].base = ab.base;
      if (!groups[ab.placa].condutor && ab.condutor) groups[ab.placa].condutor = ab.condutor;

      if (d >= startCurrent && d <= endCurrent) {
        groups[ab.placa].litrosCurrent += ab.litros;
        groups[ab.placa].kmCurrent += ab.kmPercorrido;
        groups[ab.placa].valorCurrent += ab.valorTotal;
        groups[ab.placa].abastecimentosDetalhe.push(ab);
      }
      if (d >= startPast && d <= endPast) {
        groups[ab.placa].litrosPast += ab.litros;
        groups[ab.placa].kmPast += ab.kmPercorrido;
        groups[ab.placa].valorPast += ab.valorTotal;
      }
    });

    const list = Object.values(groups).filter((g: any) => g.litrosCurrent > 0 || g.litrosPast > 0);
    list.forEach((g: any) => {
      g.abastecimentosDetalhe.sort((a: any, b: any) => b.data.localeCompare(a.data));
      const maisRecenteComSaldo = g.abastecimentosDetalhe.find((a: any) => a.saldo !== undefined && a.saldo > 0);
      g.saldoAtual = maisRecenteComSaldo ? maisRecenteComSaldo.saldo : 0;
    });

    return list;
  }, [abastecimentos, filterPlaca, filterBase, filterCondutor, startCurrent, endCurrent, startPast, endPast]);

  const sortedData = useMemo(() => {
    const sorted = [...rawData];
    sorted.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "litros") {
        valA = a.litrosCurrent;
        valB = b.litrosCurrent;
      } else if (sortField === "km") {
        valA = a.kmCurrent;
        valB = b.kmCurrent;
      } else if (sortField === "kmL") {
        valA = a.litrosCurrent > 0 ? (a.kmCurrent / a.litrosCurrent) : 0;
        valB = b.litrosCurrent > 0 ? (b.kmCurrent / b.litrosCurrent) : 0;
      } else if (sortField === "valor") {
        valA = a.valorCurrent;
        valB = b.valorCurrent;
      } else if (sortField === "saldo") {
        valA = a.saldoAtual || 0;
        valB = b.saldoAtual || 0;
      }

      if (valA === undefined) valA = "";
      if (valB === undefined) valB = "";

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === "asc" 
          ? (valA > valB ? 1 : -1) 
          : (valA < valB ? 1 : -1);
      }
    });
    return sorted;
  }, [rawData, sortField, sortDirection]);

  const totals = useMemo(() => {
    let litrosC = 0, litrosP = 0;
    let kmC = 0, kmP = 0;
    let valorC = 0, valorP = 0;
    let saldoTotal = 0;

    rawData.forEach(item => {
      litrosC += item.litrosCurrent;
      litrosP += item.litrosPast;
      kmC += item.kmCurrent;
      kmP += item.kmPast;
      valorC += item.valorCurrent;
      valorP += item.valorPast;
      saldoTotal += item.saldoAtual || 0;
    });

    return { litrosC, litrosP, kmC, kmP, valorC, valorP, saldoTotal };
  }, [rawData]);

  const totalKmL = totals.litrosC > 0 ? totals.kmC / totals.litrosC : 0;

  const formatDateLabel = (d: Date) => {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getMesLabel = (mesAno: string) => {
    if (!mesAno) return "";
    const [ano, mes] = mesAno.split("-");
    const mesesLabel: Record<string, string> = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho",
      "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };
    return `${mesesLabel[mes]} de ${ano}`;
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-white/50 inline-block ml-1" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-3.5 h-3.5 text-white inline-block ml-1 font-black" />
      : <ChevronDown className="w-3.5 h-3.5 text-white inline-block ml-1 font-black" />;
  };

  const getKmLBadge = (kmL: number) => {
    if (kmL === 0) {
      return <span className="text-slate-400 font-medium">-</span>;
    }
    if (kmL < 0 || kmL > 20) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-purple-700 animate-bounce" />
          {kmL.toFixed(1)} km/l (Divergência)
        </span>
      );
    }
    if (kmL >= 10 && kmL <= 15) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
          {kmL.toFixed(1)} km/l
        </span>
      );
    }
    if (kmL >= 7 && kmL < 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          {kmL.toFixed(1)} km/l
        </span>
      );
    }
    if (kmL >= 1 && kmL < 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          {kmL.toFixed(1)} km/l
        </span>
      );
    }
    return <span className="text-slate-400 font-medium">{kmL.toFixed(1)} km/l</span>;
  };

  return (
    <div className="bg-white rounded-[24px] border border-slate-150 p-4 space-y-3 shadow-sm text-left animate-in fade-in duration-300 relative flex flex-col h-full overflow-hidden">
      {/* Barra de Título e Período da Tabela */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-150 shrink-0 bg-white pt-1">
        <div className="flex flex-col gap-2">
          {/* Seletor Discreto de Mês/Ano dentro da tabela */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Período de Análise:</span>
            {onMesAnoChange ? (
              <select
                value={filterMesAno || ""}
                onChange={(e) => onMesAnoChange(e.target.value)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-black rounded-lg text-[11px] px-2.5 py-1 outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer transition-all shadow-sm"
              >
                <option value="">Todos os Períodos</option>
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m}>{getMesLabel(m)}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-extrabold text-slate-700">{filterMesAno ? getMesLabel(filterMesAno) : "Todos os Períodos"}</span>
            )}
            <span className="text-[10px] text-slate-400 font-bold">
              {isCustomRange ? (
                <span>(Filtro customizado: {formatDateLabel(startCurrent)} a {formatDateLabel(endCurrent)})</span>
              ) : (
                <span>(Mês ativo: {startCurrent.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Container da Tabela com Rolagem Exclusiva de Dados */}
      <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl relative shadow-inner bg-white">
        <table className="w-full text-left text-xs border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-20 font-bold text-white uppercase tracking-wider text-[9px] bg-[#114D38]">
            <tr className="bg-[#114D38]">
              <th className="bg-[#114D38] py-3.5 px-3 w-[50px] text-center sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap">Det.</th>
              <th className="bg-[#114D38] py-3.5 px-3 cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("placa")}>
                Placa {renderSortIcon("placa")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("base")}>
                Base / Filial {renderSortIcon("base")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("condutor")}>
                Condutor principal {renderSortIcon("condutor")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("litros")}>
                Litros {renderSortIcon("litros")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap">Comp. Anterior</th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("km")}>
                KM Percorrido {renderSortIcon("km")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right text-orange-400 cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("kmL")}>
                Média KM/L {renderSortIcon("kmL")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("valor")}>
                Valor Gasto {renderSortIcon("valor")}
              </th>
              <th className="bg-[#114D38] py-3.5 px-3 text-right text-teal-300 cursor-pointer select-none hover:bg-[#155a42] transition-colors sticky top-0 z-20 border-b border-[#0d3b2b] whitespace-nowrap" onClick={() => handleSort("saldo")}>
                Saldo Atual (AF) {renderSortIcon("saldo")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-650 bg-white">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Droplets className="w-8 h-8 text-slate-300 animate-pulse" />
                    <span className="font-extrabold text-slate-500">Nenhum abastecimento encontrado</span>
                    <span className="text-[10px] text-slate-400 font-medium">Não há abastecimentos fictícios. Por favor, ajuste o mês/ano ou importe seu CSV.</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.map(item => {
              const kmL = item.litrosCurrent > 0 ? (item.kmCurrent / item.litrosCurrent) : 0;
              const difLitrosPercent = item.litrosPast > 0 ? ((item.litrosCurrent - item.litrosPast) / item.litrosPast) * 100 : 0;

              return (
                <React.Fragment key={item.placa}>
                  <tr className={`hover:bg-slate-50/70 transition-colors ${expandedPlacas[item.placa] ? 'bg-slate-50/40' : ''}`}>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button 
                        onClick={() => togglePlaca(item.placa)}
                        className="p-1 hover:bg-[#114D38]/10 rounded-lg text-[#114D38] transition-colors cursor-pointer"
                        title="Ver detalhes diários"
                      >
                        {expandedPlacas[item.placa] ? (
                          <Minus className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-900 font-bold tracking-tight text-[11px] whitespace-nowrap">{item.placa}</td>
                    <td className="py-3 px-3 text-slate-500 text-[10px] whitespace-nowrap">{toTitleCase(item.base) || "Frota Risel"}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium max-w-[180px] truncate whitespace-nowrap">{toTitleCase(item.condutor) || "Sem Motorista Associado"}</td>
                    <td className="py-3 px-3 text-right text-slate-800 font-bold whitespace-nowrap">{formatNum(item.litrosCurrent)} L</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-1.5">
                        <span className="text-slate-400 font-medium text-[10px]">{formatNum(item.litrosPast)} L</span>
                        {item.litrosPast > 0 && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                            difLitrosPercent > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {difLitrosPercent > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {Math.abs(difLitrosPercent).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-800 whitespace-nowrap">{formatNum(item.kmCurrent)} km</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {getKmLBadge(kmL)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-black whitespace-nowrap">{formatCurrency(item.valorCurrent)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-900 font-extrabold bg-teal-50/30 text-[11px] whitespace-nowrap">
                      {item.saldoAtual > 0 ? formatCurrency(item.saldoAtual) : "-"}
                    </td>
                  </tr>

                  {/* VISÃO EXPANSÍVEL DETALHADA POR DIA */}
                  {expandedPlacas[item.placa] && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={10} className="p-3">
                        <div className="bg-white border border-slate-150 rounded-[16px] p-4 shadow-sm text-left mx-6 my-1">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                            <span className="text-[10px] font-black text-[#114D38] uppercase tracking-wider flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-[#114D38]" />
                              Histórico Diário de Abastecimentos — Veículo {item.placa}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">Total do Período: {item.abastecimentosDetalhe.length} transações</span>
                          </div>

                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="text-slate-400 font-bold uppercase text-[8px] border-b border-slate-100 bg-slate-50">
                                <th className="py-2 px-2.5">Data</th>
                                <th className="py-2 px-2 text-right">Litros</th>
                                <th className="py-2 px-2 text-right">Hodômetro informado</th>
                                <th className="py-2 px-2 text-right">Valor Pago</th>
                                <th className="py-2 px-2">Combustível</th>
                                <th className="py-2 px-2">Posto / Estabelecimento</th>
                                <th className="py-2 px-2">Cidade</th>
                                <th className="py-2 px-2 text-right">Saldo do Cartão (AF)</th>
                                <th className="py-2 px-2 text-center">Status Consistência</th>
                                <th className="py-2 px-2 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-semibold text-slate-600">
                              {item.abastecimentosDetalhe.map((det: any, detIdx: number) => {
                                const hasInconsistency = det.litros <= 0 || det.valorTotal <= 0 || (det.kmPercorrido && det.kmPercorrido < 0);
                                return (
                                  <tr key={det.id || detIdx} className={`hover:bg-slate-50/80 transition-colors ${hasInconsistency ? 'bg-red-50/30' : ''}`}>
                                    <td className="py-2 px-2.5 font-mono text-slate-700">
                                      {det.data ? parseAbastDate(det.data).toLocaleDateString('pt-BR') : "-"}
                                    </td>
                                    <td className="py-2 px-2 text-right text-slate-800 font-bold">{formatNum(det.litros)} L</td>
                                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                                      {det.hodometro !== undefined ? `${formatNum(det.hodometro)} km` : "-"}
                                    </td>
                                    <td className="py-2 px-2 text-right text-emerald-700 font-bold">{formatCurrency(det.valorTotal)}</td>
                                    <td className="py-2 px-2 text-slate-500 text-[10px]">{toTitleCase(det.combustivel) || "-"}</td>
                                    <td className="py-2 px-2 text-slate-500 truncate max-w-[180px]" title={toTitleCase(det.posto)}>{toTitleCase(det.posto) || "-"}</td>
                                    <td className="py-2 px-2 text-slate-500">{toTitleCase(det.cidade) || "-"}</td>
                                    <td className="py-2 px-2 text-right font-mono text-slate-600">
                                      {det.saldo !== undefined ? formatCurrency(det.saldo) : "-"}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      {hasInconsistency ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                                          Inconsistente
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                          Regular
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <button
                                        onClick={() => setEditingItem({ ...det })}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 hover:text-emerald-700 border border-slate-200 rounded-md transition-all shadow-2xs cursor-pointer"
                                        title="Editar este registro de abastecimento"
                                      >
                                        <Edit2 className="w-3 h-3 text-slate-500 hover:text-emerald-600" />
                                        Editar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Totais consolidados para inteligência BI */}
          {sortedData.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800 text-[11px] sticky bottom-0 z-10">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-left uppercase text-slate-500 tracking-wider">TOTAIS CONSOLIDADOS (BI)</td>
                <td className="py-3 px-3 text-right text-slate-900 font-extrabold">{formatNum(totals.litrosC)} L</td>
                <td className="py-3 px-3 text-right text-slate-400 font-medium">{formatNum(totals.litrosP)} L</td>
                <td className="py-3 px-3 text-right text-slate-900 font-extrabold">{formatNum(totals.kmC)} km</td>
                <td className="py-3 px-3 text-right text-[#114D38] font-black text-xs">
                  {totalKmL > 0 ? `${totalKmL.toFixed(1)} km/l` : "-"}
                </td>
                <td className="py-3 px-3 text-right text-emerald-800 font-black text-xs">{formatCurrency(totals.valorC)}</td>
                <td colSpan={2} className="py-3 px-3 text-right text-teal-800 font-black text-xs font-mono bg-teal-50/40">
                  {totals.saldoTotal > 0 ? formatCurrency(totals.saldoTotal) : "-"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal de Edição de Abastecimento */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[24px] shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-left space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-base">
                  <Edit2 className="w-5 h-5 text-emerald-600" />
                  Editar Abastecimento
                </div>
                <button 
                  onClick={() => setEditingItem(null)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Placa do Veículo</label>
                  <input 
                    type="text" 
                    value={editingItem.placa || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, placa: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Data da Transação</label>
                  <input 
                    type="date" 
                    value={editingItem.data || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, data: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Qtd Litros (L)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingItem.litros || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, litros: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Valor Total (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingItem.valorTotal || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, valorTotal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Hodômetro / KM</label>
                  <input 
                    type="number" 
                    value={editingItem.hodometro || editingItem.kmPercorrido || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, hodometro: parseFloat(e.target.value) || 0, kmPercorrido: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Combustível</label>
                  <input 
                    type="text" 
                    value={editingItem.combustivel || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, combustivel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Filial / Base</label>
                  <input 
                    type="text" 
                    value={editingItem.base || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, base: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Condutor / Motorista</label>
                  <input 
                    type="text" 
                    value={editingItem.condutor || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, condutor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Posto / Estabelecimento</label>
                  <input 
                    type="text" 
                    value={editingItem.posto || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, posto: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Cidade</label>
                  <input 
                    type="text" 
                    value={editingItem.cidade || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, cidade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                {onDeleteAbastecimento && (
                  <button
                    onClick={() => {
                      if (confirm("Tem certeza que deseja excluir este abastecimento?")) {
                        onDeleteAbastecimento(editingItem.id);
                        setEditingItem(null);
                      }
                    }}
                    className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onUpdateAbastecimento && editingItem) {
                        onUpdateAbastecimento(editingItem);
                      }
                      setEditingItem(null);
                    }}
                    className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Salvar na Planilha e Sistema
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


// -------------------------------------------------------------
// COMPONENT: MÉDIA DE KM/L POR BASE (GRÁFICO DE LINHAS SUAVES BI)
// -------------------------------------------------------------
const KmLPorBaseWidget: React.FC<{
  baseKmLData: Array<{ base: string; kmTotal: number; litrosTotal: number; valorTotal: number; kmL: number }>;
  mediaKmLGeral: number;
}> = ({ baseKmLData, mediaKmLGeral }) => {
  const bestBase = baseKmLData.length > 0 && baseKmLData[0].kmL > 0 ? baseKmLData[0] : null;

  const getEfficiencyBadge = (kmL: number) => {
    if (kmL >= 12) return { text: "Alta Eficiência", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", bar: "bg-emerald-500" };
    if (kmL >= 8.5) return { text: "Bom Rendimento", bg: "bg-teal-500/20 text-teal-300 border-teal-500/30", bar: "bg-teal-500" };
    if (kmL > 0) return { text: "Atenção Rendimento", bg: "bg-amber-500/20 text-amber-300 border-amber-500/30", bar: "bg-amber-500" };
    return { text: "Sem Dado KM", bg: "bg-slate-700 text-slate-300 border-slate-600", bar: "bg-slate-600" };
  };

  return (
    <div className="bg-slate-900 rounded-[24px] p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col gap-6 text-left col-span-full">
      {/* Background subtle SVG decoration */}
      <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
        <Gauge className="w-80 h-80 text-white" />
      </div>

      {/* Header com Titulo e Medias */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40 shrink-0">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              Média de Rendimento (KM/L) por Base
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                Linhas Suaves BI
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Acompanhamento de eficiência em quilômetros por litro por unidade operacional
            </p>
          </div>
        </div>

        {/* Display do Desempenho da Frota */}
        <div className="flex items-center gap-4 bg-black/60 border border-slate-800 px-4 py-2.5 rounded-2xl font-mono shrink-0 shadow-inner">
          <div>
            <span className="text-[8px] uppercase tracking-widest text-slate-400 block">Média Geral Frota</span>
            <span className="text-sm font-black text-emerald-400">
              {mediaKmLGeral > 0 ? `${mediaKmLGeral.toFixed(2)} km/L` : "Calculando..."}
            </span>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <span className="text-[8px] uppercase tracking-widest text-slate-400 block">Base Destaque</span>
            <span className="text-sm font-black text-amber-400">
              {bestBase ? `${bestBase.base} (${bestBase.kmL.toFixed(1)} km/L)` : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* GRÁFICO DE LINHAS SUAVES / AREA MONÓTONA */}
      <div className="h-64 w-full relative z-10">
        {baseKmLData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs font-bold">
            Nenhum registro de rodagem/KM disponível no período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={baseKmLData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorKmLGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="base" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v} km/L`} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const badge = getEfficiencyBadge(data.kmL);
                    return (
                      <div className="bg-slate-900/95 p-3.5 rounded-xl border border-slate-700 shadow-2xl text-left text-xs font-mono space-y-1.5 backdrop-blur-md">
                        <p className="text-white font-black text-sm">{data.base}</p>
                        <p className="text-emerald-400 font-bold">Média: {data.kmL > 0 ? `${data.kmL.toFixed(2)} KM/L` : "Sem Leitura KM"}</p>
                        <p className="text-slate-400">KM Total: {data.kmTotal.toLocaleString('pt-BR')} km</p>
                        <p className="text-slate-400">Litros Total: {data.litrosTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p>
                        <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.text}
                        </span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {mediaKmLGeral > 0 && (
                <ReferenceLine 
                  y={mediaKmLGeral} 
                  stroke="#3b82f6" 
                  strokeDasharray="4 4" 
                  label={{ value: `Média Geral (${mediaKmLGeral.toFixed(1)} km/L)`, fill: '#60a5fa', fontSize: 10, position: 'top', fontWeight: 'bold' }} 
                />
              )}
              <Area 
                type="monotone" 
                dataKey="kmL" 
                name="Rendimento (KM/L)" 
                stroke="#10b981" 
                strokeWidth={3.5} 
                fillOpacity={1} 
                fill="url(#colorKmLGrad)"
                dot={{ r: 5, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
                activeDot={{ r: 8, fill: "#34d399", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Grid de Cards de Bases e seus Índices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 pt-2 border-t border-slate-800">
        {baseKmLData.map((b, idx) => {
          const badge = getEfficiencyBadge(b.kmL);
          return (
            <div key={idx} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between space-y-2 hover:border-slate-600 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-white block truncate">{b.base}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${badge.bg}`}>
                  {badge.text}
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Média KM/L</span>
                <span className="text-sm font-black text-emerald-400">{b.kmL > 0 ? `${b.kmL.toFixed(2)} km/L` : "-"}</span>
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full ${badge.bar}`} style={{ width: `${Math.min(100, (b.kmL / 15) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// VIEW 2: BI DASHBOARD VIEW (DASHBOARD COMPLETO)
// -------------------------------------------------------------
export const AbastecimentoDashboardView: React.FC<AbastecimentoViewProps> = ({ 
  abastecimentos, veiculos, filterPlaca, filterBase, filterPeriodoInicio, filterPeriodoFim, filterCondutor, filterMesAno, onMesAnoChange
}) => {
  const biDashboardScrollRef = useRef<HTMLDivElement>(null);

  const normalizeCityName = (city?: string): string => {
    if (!city) return "NÃO INFORMADO";
    return city
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const abastecimentosMapeados = useMemo(() => {
    return mapAbastecimentosComVeiculos(abastecimentos, veiculos).map(ab => ({
      ...ab,
      cidade: normalizeCityName(ab.cidade)
    }));
  }, [abastecimentos, veiculos]);

  const { startCurrent, endCurrent, startPast, endPast, isCustomRange } = useMemo(() => {
    return getComparisonDates(abastecimentosMapeados, filterPeriodoInicio, filterPeriodoFim);
  }, [abastecimentosMapeados, filterPeriodoInicio, filterPeriodoFim]);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    abastecimentos.forEach(ab => {
      if (ab.data && ab.data.length >= 7) {
        meses.add(ab.data.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(meses).sort((a, b) => b.localeCompare(a));
  }, [abastecimentos]);

  const stats = useMemo(() => {
    let filtered = abastecimentosMapeados;
    if (filterPlaca) filtered = filtered.filter(a => a.placa.includes(filterPlaca));
    if (filterBase) filtered = filtered.filter(a => a.base === filterBase);
    if (filterCondutor) filtered = filtered.filter(a => a.condutor.toLowerCase().includes(filterCondutor.toLowerCase()));
    
    let curValor = 0, pastValor = 0;
    let curLitros = 0, pastLitros = 0;
    let curQtd = 0, pastQtd = 0;
    let curKm = 0, pastKm = 0;

    filtered.forEach(ab => {
      const d = parseAbastDate(ab.data);
      if (d >= startCurrent && d <= endCurrent) {
        curValor += ab.valorTotal;
        curLitros += ab.litros;
        curQtd += 1;
        curKm += ab.kmPercorrido;
      }
      if (d >= startPast && d <= endPast) {
        pastValor += ab.valorTotal;
        pastLitros += ab.litros;
        pastQtd += 1;
        pastKm += ab.kmPercorrido;
      }
    });

    const curKmL = curLitros > 0 ? curKm / curLitros : 0;
    const pastKmL = pastLitros > 0 ? pastKm / pastLitros : 0;

    return {
      valor: { current: curValor, past: pastValor },
      litros: { current: curLitros, past: pastLitros },
      qtd: { current: curQtd, past: pastQtd },
      kmL: { current: curKmL, past: pastKmL },
      km: { current: curKm, past: pastKm }
    };
  }, [abastecimentosMapeados, filterPlaca, filterBase, filterCondutor, startCurrent, endCurrent, startPast, endPast]);

  const chartData = useMemo(() => {
    let filtered = abastecimentosMapeados;
    if (filterPlaca) filtered = filtered.filter(a => a.placa.includes(filterPlaca));
    if (filterBase) filtered = filtered.filter(a => a.base === filterBase);
    if (filterCondutor) filtered = filtered.filter(a => a.condutor.toLowerCase().includes(filterCondutor.toLowerCase()));

    // Filtrar pelo período/mês ativo selecionado se houver intervalo de datas
    if (filterPeriodoInicio || filterPeriodoFim) {
      filtered = filtered.filter(a => {
        if (!a.data) return false;
        const d = parseAbastDate(a.data);
        if (startCurrent && d < startCurrent) return false;
        if (endCurrent && d > endCurrent) return false;
        return true;
      });
    }

    const byMonth: Record<string, { month: string, valor: number, litros: number, km: number }> = {};
    const byBase: Record<string, { base: string, valor: number }> = {};
    const byFuel: Record<string, { name: string, value: number, litros: number }> = {};
    const byPosto: Record<string, { posto: string, cidade: string, count: number, valorTotal: number, litrosTotal: number, valorEtanol: number, countEtanol: number }> = {};
    const byGestor: Record<string, { gestor: string, valor: number, litros: number }> = {};

    filtered.forEach(ab => {
      const m = ab.data.substring(0, 7); // YYYY-MM
      if (!byMonth[m]) byMonth[m] = { month: m, valor: 0, litros: 0, km: 0 };
      byMonth[m].valor += ab.valorTotal;
      byMonth[m].litros += ab.litros;
      byMonth[m].km += ab.kmPercorrido;

      const baseKey = ab.base || "Indefinida";
      if (!byBase[baseKey]) byBase[baseKey] = { base: baseKey, valor: 0 };
      byBase[baseKey].valor += ab.valorTotal;

      const fuelKey = ab.combustivel || "Não Informado";
      if (!byFuel[fuelKey]) byFuel[fuelKey] = { name: fuelKey, value: 0, litros: 0 };
      byFuel[fuelKey].value += ab.valorTotal;
      byFuel[fuelKey].litros += ab.litros;

      const normCidade = normalizeCityName(ab.cidade);
      const pKey = `${ab.posto}-${normCidade}`;
      if (!byPosto[pKey]) {
        byPosto[pKey] = { 
          posto: ab.posto || "Indefinido", 
          cidade: normCidade, 
          count: 0, 
          valorTotal: 0, 
          litrosTotal: 0,
          valorEtanol: 0,
          countEtanol: 0
        };
      }
      byPosto[pKey].count += 1;
      byPosto[pKey].valorTotal += ab.valorTotal;
      byPosto[pKey].litrosTotal += ab.litros;

      if (ab.combustivel && ab.combustivel.toLowerCase().includes("etanol")) {
        const precoPorLitro = ab.litros > 0 ? ab.valorTotal / ab.litros : 0;
        if (precoPorLitro > 0) {
          byPosto[pKey].valorEtanol += precoPorLitro;
          byPosto[pKey].countEtanol += 1;
        }
      }

      // Agrupar por Gestor do veículo real
      const cleanPlate = ab.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const veh = veiculos.find(v => v.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
      const gestorKey = veh?.gestorResp || "Indefinido";
      
      if (!byGestor[gestorKey]) {
        byGestor[gestorKey] = { gestor: gestorKey, valor: 0, litros: 0 };
      }
      byGestor[gestorKey].valor += ab.valorTotal;
      byGestor[gestorKey].litros += ab.litros;
    });

    const byDay: Record<string, { day: string, valor: number, litros: number, km: number }> = {};
    filtered.forEach(ab => {
      const d = ab.data; // YYYY-MM-DD
      if (!byDay[d]) byDay[d] = { day: d, valor: 0, litros: 0, km: 0 };
      byDay[d].valor += ab.valorTotal;
      byDay[d].litros += ab.litros;
      byDay[d].km += ab.kmPercorrido;
    });

    const monthData = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
       const [year, mo] = m.month.split("-");
       const mesesLabel: Record<string, string> = {
         "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
         "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
       };
       return { ...m, label: `${mesesLabel[mo] || mo}/${year}` };
    });

    const dayData = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map(d => {
       const [year, mo, day] = d.day.split("-");
       return { ...d, label: `${day}/${mo}` };
    });

    const baseData = Object.values(byBase).sort((a, b) => b.valor - a.valor);
    const fuelData = Object.values(byFuel).sort((a, b) => b.value - a.value);
    
    const gestorData = Object.values(byGestor)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8); // Top 8 gestores

    const byBasePreco: Record<string, { base: string, valorTotal: number, litrosTotal: number }> = {};
    const byBaseKmL: Record<string, { base: string, kmTotal: number, litrosTotal: number, valorTotal: number }> = {};

    filtered.forEach(ab => {
      const bKey = ab.base || "Indefinida";
      if (!byBasePreco[bKey]) byBasePreco[bKey] = { base: bKey, valorTotal: 0, litrosTotal: 0 };
      byBasePreco[bKey].valorTotal += ab.valorTotal;
      byBasePreco[bKey].litrosTotal += ab.litros;

      if (!byBaseKmL[bKey]) byBaseKmL[bKey] = { base: bKey, kmTotal: 0, litrosTotal: 0, valorTotal: 0 };
      byBaseKmL[bKey].kmTotal += (ab.kmPercorrido || 0);
      byBaseKmL[bKey].litrosTotal += (ab.litros || 0);
      byBaseKmL[bKey].valorTotal += (ab.valorTotal || 0);
    });

    const basePrecoMedioData = Object.values(byBasePreco).map(b => ({
      base: b.base,
      valorTotal: b.valorTotal,
      litrosTotal: b.litrosTotal,
      precoMedio: b.litrosTotal > 0 ? b.valorTotal / b.litrosTotal : 0
    })).sort((a, b) => b.precoMedio - a.precoMedio);

    const baseKmLData = Object.values(byBaseKmL).map(b => {
      const kmL = b.litrosTotal > 0 && b.kmTotal > 0 ? (b.kmTotal / b.litrosTotal) : 0;
      return {
        base: b.base,
        kmTotal: b.kmTotal,
        litrosTotal: b.litrosTotal,
        valorTotal: b.valorTotal,
        kmL: parseFloat(kmL.toFixed(2))
      };
    }).sort((a, b) => b.kmL - a.kmL);

    const postoData = Object.values(byPosto).map(p => {
       return {
         ...p,
         precoMedio: p.litrosTotal > 0 ? p.valorTotal / p.litrosTotal : 0,
         precoMedioEtanol: p.countEtanol > 0 ? p.valorEtanol / p.countEtanol : 0
       }
    });

    return { monthData, dayData, baseData, fuelData, postoData, gestorData, basePrecoMedioData, baseKmLData };
  }, [abastecimentosMapeados, filterPlaca, filterBase, filterCondutor, veiculos, filterPeriodoInicio, filterPeriodoFim, startCurrent, endCurrent]);

  const calcDiff = (cur: number, past: number) => {
    if (past === 0) return 0;
    return ((cur - past) / past) * 100;
  };

  const renderCard = (
    title: string, 
    value: string, 
    cur: number, 
    past: number, 
    icon: any, 
    gradientClass: string, 
    isInverse: boolean = false
  ) => {
     const diff = calcDiff(cur, past);
     const isGood = isInverse ? diff < 0 : diff > 0;
     const isNeutral = diff === 0 || past === 0;

     return (
       <motion.div 
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         whileHover={{ scale: 1.02, y: -2 }}
         transition={{ type: "spring", stiffness: 300, damping: 20 }}
         className={`${gradientClass} p-5 rounded-[22px] shadow-md border-t border-white/10 flex flex-col justify-between relative overflow-hidden`}
       >
         <div className="absolute -right-6 -top-6 w-16 h-16 rounded-full bg-white/10 blur-xl pointer-events-none" />
         
         <div className="flex justify-between items-start gap-1">
           <span className="text-[10px] font-black text-white/70 uppercase tracking-wider block leading-tight">{title}</span>
           <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 text-white">
             {icon}
           </div>
         </div>
         <div className="mt-4 text-left">
           <span className="text-xl font-display font-black text-white tracking-tight block">{value}</span>
           <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
             <span className="text-[9px] text-white/60 font-bold uppercase tracking-wider">vs período ant.</span>
             {past > 0 ? (
               <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                 isNeutral ? 'bg-white/10 text-white' : isGood ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
               }`}>
                 {isNeutral ? null : isGood ? <TrendingDown className="w-3 h-3 text-emerald-200" /> : <TrendingUp className="w-3 h-3 text-rose-200" />}
                 {Math.abs(diff).toFixed(1)}%
               </span>
             ) : (
               <span className="text-[9px] text-white/40 font-semibold">Sem histórico</span>
             )}
           </div>
         </div>
       </motion.div>
     );
  };

  const [filterCidade, setFilterCidade] = useState("");
  const [timeView, setTimeView] = useState<"month"|"day">("month");

  // Reordenação dinâmica dos gráficos
  const DEFAULT_ORDER = [
    "historico",
    "volume_valor",
    "km_mes",
    "preco_base",
    "distribuicao_base",
    "km_l_base",
    "postos_tabela"
  ];

  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("risel_frota_chart_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 7) {
          return parsed.map((id: string) => id === "combustivel_pump" ? "km_l_base" : id);
        }
      }
    } catch {}
    return DEFAULT_ORDER;
  });

  const moveChart = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= chartOrder.length) return;
    const newOrder = [...chartOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[newIndex];
    newOrder[newIndex] = temp;
    setChartOrder(newOrder);
    localStorage.setItem("risel_frota_chart_order", JSON.stringify(newOrder));
  };

  const resetChartOrder = () => {
    setChartOrder(DEFAULT_ORDER);
    localStorage.setItem("risel_frota_chart_order", JSON.stringify(DEFAULT_ORDER));
  };
  
  const tablePostos = useMemo(() => {
    return chartData.postoData
      .filter(p => !filterCidade || p.cidade.toLowerCase().includes(filterCidade.toLowerCase()))
      .sort((a, b) => {
        const priceA = a.precoMedioEtanol > 0 ? a.precoMedioEtanol : 999999;
        const priceB = b.precoMedioEtanol > 0 ? b.precoMedioEtanol : 999999;
        return priceA - priceB;
      });
  }, [chartData.postoData, filterCidade]);

  const lowestPrecoEtanolByCity = useMemo(() => {
    const map: Record<string, number> = {};
    chartData.postoData.forEach(p => {
      if (p.precoMedioEtanol > 0) {
        if (!map[p.cidade] || p.precoMedioEtanol < map[p.cidade]) {
          map[p.cidade] = p.precoMedioEtanol;
        }
      }
    });
    return map;
  }, [chartData.postoData]);

  const COLORS = ['#114D38', '#f97316', '#3b82f6', '#8b5cf6', '#eab308', '#22c55e', '#ec4899'];

  const getMesLabel = (mesAno: string) => {
    if (!mesAno) return "Todos os Períodos";
    const parts = mesAno.split("-");
    if (parts.length < 2) return mesAno;
    const [ano, mes] = parts;
    const mesesLabel: Record<string, string> = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho",
      "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };
    return `${mesesLabel[mes] || mes} de ${ano}`;
  };

  const precoMedioGeral = stats.litros.current > 0 ? stats.valor.current / stats.litros.current : 0;

  // Render individual reorderable chart panel
  const renderChartBlock = (chartId: string, index: number) => {
    const totalCharts = chartOrder.length;

    const renderControls = () => (
      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl shrink-0">
        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider px-1">
          {index + 1}/{totalCharts}
        </span>
        <button
          onClick={() => moveChart(index, -1)}
          disabled={index === 0}
          title="Mover Gráfico para Cima"
          className="p-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition-all shadow-xs cursor-pointer"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={() => moveChart(index, 1)}
          disabled={index === totalCharts - 1}
          title="Mover Gráfico para Baixo"
          className="p-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition-all shadow-xs cursor-pointer"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
    );

    switch (chartId) {
      case "historico":
        return (
          <div key="historico" className="bg-white p-5 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-[#114D38]" /> Valor Abastecido Histórico
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button 
                    onClick={() => setTimeView('month')} 
                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                      timeView === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Mês
                  </button>
                  <button 
                    onClick={() => setTimeView('day')} 
                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                      timeView === 'day' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Dia
                  </button>
                </div>
                {renderControls()}
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(timeView === 'month' ? chartData.monthData : chartData.dayData) as any}>
                  <defs>
                    <linearGradient id="colorValorBi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#114D38" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#114D38" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dx={-10} tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    formatter={(val: number) => [formatCurrency(val), "Valor Abastecido"]}
                  />
                  <Area type="monotone" dataKey="valor" stroke="#114D38" strokeWidth={3} fillOpacity={1} fill="url(#colorValorBi)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "volume_valor":
        return (
          <div key="volume_valor" className="bg-white p-5 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-[#114D38]" /> Volume vs Valor por Período
              </h4>
              {renderControls()}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.monthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} tickFormatter={(val) => `${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="valor" name="Valor Gasto (R$)" fill="#114D38" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="litros" name="Volume Abastecido (L)" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "km_mes":
        return (
          <div key="km_mes" className="bg-white p-5 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-blue-500" /> KM Percorrido por Mês
              </h4>
              {renderControls()}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.monthData} margin={{ left: -20, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    formatter={(val: number) => [`${val.toLocaleString('pt-BR')} km`, "KM Percorrido"]}
                  />
                  <Bar dataKey="km" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "preco_base":
        return (
          <div key="preco_base" className="bg-white p-5 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-emerald-600" /> Preço Médio por Litro por Base
              </h4>
              {renderControls()}
            </div>
            <div className="h-64 w-full">
              {chartData.basePrecoMedioData.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-slate-400 font-medium">Nenhum dado por base disponível.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.basePrecoMedioData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="base" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} domain={['auto', 'auto']} tickFormatter={(val) => `R$ ${val.toFixed(2)}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(val: number) => [`R$ ${val.toFixed(2)} / Litro`, "Preço Médio"]}
                    />
                    {precoMedioGeral > 0 && (
                      <ReferenceLine y={precoMedioGeral} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Média Frota: R$ ${precoMedioGeral.toFixed(2)}`, fill: '#ef4444', fontSize: 9, position: 'top' }} />
                    )}
                    <Bar dataKey="precoMedio" name="Preço Médio (R$/L)" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {chartData.basePrecoMedioData.map((entry, idx) => (
                        <Cell key={`cell-pm-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );

      case "distribuicao_base":
        return (
          <div key="distribuicao_base" className="bg-white p-5 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <Crown className="w-4.5 h-4.5 text-amber-500" /> Distribuição de Gastos por Base / Filial
              </h4>
              {renderControls()}
            </div>
            <div className="h-64 w-full">
              {chartData.baseData.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-slate-400 font-medium">Nenhum dado por base disponível.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.baseData} margin={{ left: -20, top: 10, right: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="base" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(val: number) => [formatCurrency(val), "Gasto Total"]}
                    />
                    <Bar dataKey="valor" fill="#f97316" radius={[4, 4, 0, 0]}>
                      {chartData.baseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );

      case "km_l_base":
        return (
          <div key="km_l_base" className="col-span-full space-y-2">
            <div className="flex justify-end">
              {renderControls()}
            </div>
            <KmLPorBaseWidget 
              baseKmLData={chartData.baseKmLData} 
              mediaKmLGeral={stats.kmL.current || (stats.litros.current > 0 ? stats.km.current / stats.litros.current : 0)} 
            />
          </div>
        );

      case "postos_tabela":
        return (
          <div key="postos_tabela" className="col-span-full bg-white p-6 rounded-[22px] border border-slate-150 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <DollarSign className="w-4.5 h-4.5 text-emerald-600" /> Preço Médio de Etanol por Posto
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Filtrar tabela por cidade..." 
                    value={filterCidade}
                    onChange={(e) => setFilterCidade(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#114D38] transition-all shadow-sm"
                  />
                </div>
                {renderControls()}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-inner max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nome do Posto</th>
                    <th className="py-3 px-4">Cidade</th>
                    <th className="py-3 px-4 text-right">Qtd Transações</th>
                    <th className="py-3 px-4 text-right">Média Geral do Posto (L)</th>
                    <th className="py-3 px-4 text-right text-emerald-700">Média Etanol (L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                  {tablePostos.map((p, idx) => {
                    const isLowestInCity = p.precoMedioEtanol > 0 && p.precoMedioEtanol === lowestPrecoEtanolByCity[p.cidade];
                    
                    return (
                      <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isLowestInCity ? 'bg-emerald-50/20' : ''}`}>
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                          {isLowestInCity && <Crown className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />}
                          {p.posto}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{p.cidade}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{p.count}</td>
                        <td className="py-3 px-4 text-right text-slate-400 font-medium">{formatCurrency(p.precoMedio)}</td>
                        <td className="py-3 px-4 text-right">
                          {p.precoMedioEtanol > 0 ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
                              isLowestInCity ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'text-slate-800 bg-slate-50'
                            }`}>
                              {formatCurrency(p.precoMedioEtanol)}
                              {isLowestInCity && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1 py-0.2 rounded">Menor Preço</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-350 font-normal">Não abastecido</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {tablePostos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">Nenhum posto encontrado para o filtro e período atuais.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-3 animate-in fade-in duration-300 overflow-hidden">
      
      {/* CONTROLES E 5 CARDS BI DO DASHBOARD */}
      <div className="shrink-0 bg-slate-50 pt-2 pb-3.5 border-b border-slate-200 shadow-sm space-y-3 transition-all rounded-2xl p-3">
        {/* Seletor Discreto de Mês/Ano e Botão de Reset de Ordem dos Gráficos */}
        <div className="flex justify-between items-center bg-white px-4 py-2 rounded-[18px] border border-slate-150 shadow-sm text-left">
          <button
            onClick={resetChartOrder}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            title="Restaurar Posição Original dos Gráficos"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            Restaurar Layout Gráficos
          </button>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-3 py-1 rounded-xl">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Período Ativo:</span>
            {onMesAnoChange ? (
              <select
                value={filterMesAno || ""}
                onChange={(e) => onMesAnoChange(e.target.value)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-black rounded-lg text-[11px] px-2.5 py-1 outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer transition-all shadow-sm"
              >
                <option value="">Todos os Períodos</option>
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m}>{getMesLabel(m)}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-extrabold text-slate-700">{filterMesAno ? getMesLabel(filterMesAno) : "Todos os Períodos"}</span>
            )}
          </div>
        </div>

        {/* 5 CARDS BI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {renderCard(
            "Valor Total", 
            formatCurrency(stats.valor.current), 
            stats.valor.current, 
            stats.valor.past, 
            <DollarSign className="w-4 h-4" />, 
            "bg-gradient-to-br from-[#114D38] to-emerald-900",
            true
          )}
          {renderCard(
            "Total Litros", 
            formatLitros(stats.litros.current), 
            stats.litros.current, 
            stats.litros.past, 
            <Droplets className="w-4 h-4" />, 
            "bg-gradient-to-br from-orange-500 to-amber-700",
            false
          )}
          {renderCard(
            "Abastecimentos", 
            stats.qtd.current + " transações", 
            stats.qtd.current, 
            stats.qtd.past, 
            <Activity className="w-4 h-4" />, 
            "bg-gradient-to-br from-blue-600 to-indigo-800",
            false
          )}
          {renderCard(
            "Média KM/L", 
            stats.kmL.current > 0 ? `${stats.kmL.current.toFixed(1)} km/l` : "-", 
            stats.kmL.current, 
            stats.kmL.past, 
            <Gauge className="w-4 h-4" />, 
            "bg-gradient-to-br from-purple-600 to-violet-800",
            false
          )}
          {renderCard(
            "KM Percorrido", 
            formatNum(stats.km.current) + " km", 
            stats.km.current, 
            stats.km.past, 
            <MapPin className="w-4 h-4" />, 
            "bg-gradient-to-br from-slate-600 to-slate-800",
            false
          )}
        </div>
      </div>

      {/* DYNAMIC REORDERABLE CHARTS GRID */}
      <div ref={biDashboardScrollRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-6">
          {chartOrder.map((chartId, idx) => renderChartBlock(chartId, idx))}
        </div>
      </div>
    </div>
  );
};

import { useState, useMemo } from "react";
import { 
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Legend, Cell, PieChart, Pie, LabelList
} from "recharts";
import { 
  LayoutDashboard, Filter, ChevronDown, ChevronUp, CheckCircle, 
  AlertTriangle, Clock, Truck, ClipboardList, HelpCircle, FileSpreadsheet,
  Calendar, CalendarDays, RotateCcw, ArrowRightLeft, Layers, CalendarRange
} from "lucide-react";
import { cn } from "../../lib/utils";

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
  timestamp?: string;
  email?: string;
  tipo?: string;
  base?: string;
  marcaModelo?: string;
  cor?: string;
  nivelTanque?: string;
  listaItens?: string[];
  isGoogleSheet?: boolean;
}

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  base?: string;
  filial?: string;
  status?: string;
  locadora?: string;
}

interface ChecklistDashboardProps {
  checklists: Checklist[];
  vehicles: Vehicle[];
}

type PeriodMode = "mes" | "intervalo" | "trimestre_ano" | "todos";

// Robust date parser for all checklist date formats (ISO, BR, timestamp, etc.)
function parseChecklistDate(dateStr?: string, timestampStr?: string): { year: string; month: string; day: string; key: string; monthYear: string } | null {
  const val = dateStr || timestampStr || "";
  if (!val) return null;
  const clean = val.replace(",", "").trim();
  
  if (clean.includes("/")) {
    const parts = clean.split(" ")[0].split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dPad = d.padStart(2, "0");
      const mPad = m.padStart(2, "0");
      const yStr = y.length === 2 ? `20${y}` : y;
      return { year: yStr, month: mPad, day: dPad, key: `${yStr}-${mPad}`, monthYear: `${mPad}/${yStr}` };
    }
  }
  
  if (clean.includes("-")) {
    const datePart = clean.split("T")[0].split(" ")[0];
    const parts = datePart.split("-");
    if (parts.length >= 2) {
      const [y, m, d] = parts;
      const mPad = m.padStart(2, "0");
      const dPad = (d || "01").padStart(2, "0");
      const yStr = y.length === 2 ? `20${y}` : y;
      return { year: yStr, month: mPad, day: dPad, key: `${yStr}-${mPad}`, monthYear: `${mPad}/${yStr}` };
    }
  }

  const t = new Date(clean).getTime();
  if (!isNaN(t) && t > 0) {
    const d = new Date(t);
    const yStr = String(d.getFullYear());
    const mPad = String(d.getMonth() + 1).padStart(2, "0");
    const dPad = String(d.getDate()).padStart(2, "0");
    return { year: yStr, month: mPad, day: dPad, key: `${yStr}-${mPad}`, monthYear: `${mPad}/${yStr}` };
  }

  return null;
}

export function ChecklistDashboard({ checklists, vehicles }: ChecklistDashboardProps) {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [volumeViewMode, setVolumeViewMode] = useState<"mes" | "dia">("mes");
  
  // Period filter mode: 'mes' | 'intervalo' | 'trimestre_ano' | 'todos'
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");

  // Single Month state
  const [filterMonthYear, setFilterMonthYear] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${mm}/${yyyy}`; // Ex: "08/2026"
  });

  // Range Period state (De MM/AAAA Até MM/AAAA)
  const [rangeStartMonth, setRangeStartMonth] = useState(() => {
    const now = new Date();
    return `01/${now.getFullYear()}`;
  });
  const [rangeEndMonth, setRangeEndMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${mm}/${now.getFullYear()}`;
  });

  // Quarter / Year selection (Ex: "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2026-ALL", "2025-ALL")
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(() => {
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${currentQ}`;
  });

  // Secondary Filters
  const [filterBase, setFilterBase] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterMotorista, setFilterMotorista] = useState("");

  // Populate unique filter options based on raw data
  const monthYearOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => {
      const parsed = parseChecklistDate(c.data, c.timestamp);
      if (parsed) {
        opts.add(parsed.monthYear);
      }
    });

    // Ensure current month is included
    const now = new Date();
    const cur = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    opts.add(cur);

    return Array.from(opts).sort((a, b) => {
      const [mA, yA] = a.split("/");
      const [mB, yB] = b.split("/");
      return `${yB}-${mB}`.localeCompare(`${yA}-${mA}`); // Sort desc
    });
  }, [checklists]);

  // Options for Quarter & Year
  const quarterYearOptions = useMemo(() => {
    const currentY = new Date().getFullYear();
    const years = [currentY, currentY - 1, currentY - 2];
    const options: { value: string; label: string }[] = [];

    years.forEach(y => {
      options.push({ value: `${y}-Q1`, label: `1º Trimestre ${y} (Jan - Mar)` });
      options.push({ value: `${y}-Q2`, label: `2º Trimestre ${y} (Abr - Jun)` });
      options.push({ value: `${y}-Q3`, label: `3º Trimestre ${y} (Jul - Set)` });
      options.push({ value: `${y}-Q4`, label: `4º Trimestre ${y} (Out - Dez)` });
      options.push({ value: `${y}-ALL`, label: `Ano Inteiro ${y}` });
    });

    return options;
  }, []);

  const baseOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.base) opts.add(c.base.toUpperCase().trim()); });
    vehicles.forEach(v => { 
      if (v.filial) opts.add(v.filial.toUpperCase().trim());
      if (v.base) opts.add(v.base.toUpperCase().trim());
    });
    return Array.from(opts).filter(b => b !== "").sort();
  }, [checklists, vehicles]);

  const tipoOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.tipo) opts.add(c.tipo.toUpperCase()); });
    return Array.from(opts).sort();
  }, [checklists]);

  const placaOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.placa) opts.add(c.placa.toUpperCase()); });
    vehicles.forEach(v => { if (v.placa) opts.add(v.placa.toUpperCase()); });
    return Array.from(opts).sort();
  }, [checklists, vehicles]);

  const motoristaOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.condutor) opts.add(c.condutor.trim()); });
    return Array.from(opts).sort();
  }, [checklists]);

  // Helper to check if a date falls in the selected period filter
  const isDateInPeriod = (dateStr?: string, timestampStr?: string) => {
    if (periodMode === "todos") return true;

    const parsed = parseChecklistDate(dateStr, timestampStr);
    if (!parsed) return false;

    const { year: itemY, month: itemM, key: itemYearMonth } = parsed;

    if (periodMode === "mes") {
      if (!filterMonthYear) return true;
      const [m, y] = filterMonthYear.split("/");
      return itemYearMonth === `${y}-${m}`;
    }

    if (periodMode === "intervalo") {
      if (!rangeStartMonth || !rangeEndMonth) return true;
      const [startM, startY] = rangeStartMonth.split("/");
      const [endM, endY] = rangeEndMonth.split("/");
      const startKey = `${startY}-${startM}`;
      const endKey = `${endY}-${endM}`;
      const minKey = startKey <= endKey ? startKey : endKey;
      const maxKey = startKey <= endKey ? endKey : startKey;
      return itemYearMonth >= minKey && itemYearMonth <= maxKey;
    }

    if (periodMode === "trimestre_ano") {
      if (!selectedQuarterYear) return true;
      const [year, quarter] = selectedQuarterYear.split("-");
      if (itemY !== year) return false;
      if (quarter === "ALL") return true;
      
      const mNum = parseInt(itemM, 10);
      if (quarter === "Q1") return mNum >= 1 && mNum <= 3;
      if (quarter === "Q2") return mNum >= 4 && mNum <= 6;
      if (quarter === "Q3") return mNum >= 7 && mNum <= 9;
      if (quarter === "Q4") return mNum >= 10 && mNum <= 12;
    }

    return true;
  };

  // Description label of active period
  const activePeriodLabel = useMemo(() => {
    if (periodMode === "todos") return "Todos os Registros";
    if (periodMode === "mes") return filterMonthYear ? `Mês ${filterMonthYear}` : "Todos os Meses";
    if (periodMode === "intervalo") return `De ${rangeStartMonth} até ${rangeEndMonth}`;
    if (periodMode === "trimestre_ano") {
      const found = quarterYearOptions.find(o => o.value === selectedQuarterYear);
      return found ? found.label : selectedQuarterYear;
    }
    return "";
  }, [periodMode, filterMonthYear, rangeStartMonth, rangeEndMonth, selectedQuarterYear, quarterYearOptions]);

  // Apply filters
  const filteredChecklists = useMemo(() => {
    return checklists.filter(c => {
      if (!isDateInPeriod(c.data, c.timestamp)) return false;

      if (filterBase && (!c.base || c.base.toUpperCase() !== filterBase.toUpperCase())) {
        return false;
      }
      if (filterTipo && (!c.tipo || c.tipo.toUpperCase() !== filterTipo.toUpperCase())) {
        return false;
      }
      if (filterStatus) {
        if (filterStatus === "Aprovado" && c.status !== "Aprovado") return false;
        if (filterStatus === "Ressalvas" && c.status !== "Ressalvas") return false;
        if (filterStatus === "Retido" && c.status !== "Retido") return false;
      }
      if (filterPlaca && c.placa.toUpperCase() !== filterPlaca.toUpperCase()) return false;
      if (filterMotorista && (!c.condutor || !c.condutor.toLowerCase().includes(filterMotorista.toLowerCase()))) return false;
      return true;
    });
  }, [checklists, periodMode, filterMonthYear, rangeStartMonth, rangeEndMonth, selectedQuarterYear, filterBase, filterTipo, filterStatus, filterPlaca, filterMotorista]);

  // Clean filters
  const handleClearFilters = () => {
    setPeriodMode("mes");
    const now = new Date();
    const cur = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    setFilterMonthYear(cur);
    setFilterBase("");
    setFilterTipo("");
    setFilterStatus("");
    setFilterPlaca("");
    setFilterMotorista("");
  };

  // Active vehicles considered
  const activeVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (v.status === "Inativo") return false;
      if (filterBase) {
        const vBase = (v.filial || v.base || "").toUpperCase();
        if (!vBase.includes(filterBase.toUpperCase())) return false;
      }
      if (filterPlaca && v.placa.toUpperCase() !== filterPlaca.toUpperCase()) return false;
      return true;
    });
  }, [vehicles, filterBase, filterPlaca]);

  const totalVehiclesCount = activeVehicles.length || vehicles.length;
  const totalChecklistsCount = filteredChecklists.length;

  // Pending Checklists Calculation in active period
  const pendingChecklistsCount = useMemo(() => {
    const checkedPlatesInPeriod = new Set<string>();
    filteredChecklists.forEach(c => {
      if (c.placa) {
        checkedPlatesInPeriod.add(c.placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      }
    });

    let count = 0;
    activeVehicles.forEach(v => {
      const plate = v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!checkedPlatesInPeriod.has(plate)) {
        count++;
      }
    });
    return count;
  }, [activeVehicles, filteredChecklists]);

  // Stats comparison with previous period
  const statsComparison = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    const currentMonthChecklists = checklists.filter(c => c.data?.startsWith(currentMonthStr)).length;
    const prevMonthChecklists = checklists.filter(c => c.data?.startsWith(prevMonthStr)).length;

    let pctChange = 0;
    if (prevMonthChecklists > 0) {
      pctChange = Math.round(((currentMonthChecklists - prevMonthChecklists) / prevMonthChecklists) * 100);
    } else if (currentMonthChecklists > 0) {
      pctChange = 100;
    }

    return {
      currentCount: currentMonthChecklists,
      prevCount: prevMonthChecklists,
      pctChange,
      isPositive: pctChange >= 0
    };
  }, [checklists]);

  // --- CHARTS DATA GENERATION ---

  // 1. Volume Chart: Checklists Realizados e Linha Alaranjada de Não Realizados na visão mensal
  const volumeChartData = useMemo(() => {
    const totalFrota = activeVehicles.length > 0 ? activeVehicles.length : vehicles.length || 10;

    if (volumeViewMode === "mes") {
      const monthlyDataMap: { 
        [key: string]: { 
          realizadosCount: number; 
          uniquePlates: Set<string>;
          sortingKey: string; 
          label: string; 
          fullLabel: string;
        } 
      } = {};
      
      // We scan all checklists that match other active filters (except period) to show a rich trend
      checklists.forEach(c => {
        const parsed = parseChecklistDate(c.data, c.timestamp);
        if (!parsed) return;
        if (filterBase && (!c.base || c.base.toUpperCase() !== filterBase.toUpperCase())) return;
        if (filterTipo && (!c.tipo || c.tipo.toUpperCase() !== filterTipo.toUpperCase())) return;
        if (filterPlaca && c.placa.toUpperCase() !== filterPlaca.toUpperCase()) return;

        const key = parsed.monthYear;
        const sortingKey = parsed.key;

        if (!monthlyDataMap[key]) {
          monthlyDataMap[key] = {
            realizadosCount: 0,
            uniquePlates: new Set<string>(),
            sortingKey,
            label: key,
            fullLabel: `Mês ${key}`
          };
        }

        monthlyDataMap[key].realizadosCount += 1;
        if (c.placa) {
          monthlyDataMap[key].uniquePlates.add(c.placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
        }
      });

      // Transform map into sorted array with Realizados and Não Realizados
      const sortedKeys = Object.keys(monthlyDataMap).sort((a, b) => 
        monthlyDataMap[a].sortingKey.localeCompare(monthlyDataMap[b].sortingKey)
      );

      // Include at least the last 12 months for trend context
      const selectedSlice = sortedKeys.slice(-12);

      return selectedSlice.map(monthKey => {
        const item = monthlyDataMap[monthKey];
        const uniqueChecked = item.uniquePlates.size;
        const naoRealizados = Math.max(0, totalFrota - uniqueChecked);

        return {
          label: item.label,
          fullLabel: item.fullLabel,
          sortingKey: item.sortingKey,
          "Realizados": item.realizadosCount,
          "Não Realizados": naoRealizados,
          "Veículos Inspecionados": uniqueChecked,
          "Total Frota": totalFrota
        };
      });

    } else {
      // Agrupamento por Dia
      const dailyCounts: { [key: string]: { count: number; dayLabel: string; fullDate: string } } = {};
      
      filteredChecklists.forEach(c => {
        const parsed = parseChecklistDate(c.data, c.timestamp);
        if (!parsed) return;
        const dateKey = `${parsed.year}-${parsed.month}-${parsed.day}`;
        
        if (!dailyCounts[dateKey]) {
          dailyCounts[dateKey] = {
            count: 0,
            dayLabel: `${parsed.day}/${parsed.month}`,
            fullDate: `${parsed.day}/${parsed.month}/${parsed.year}`
          };
        }
        dailyCounts[dateKey].count += 1;
      });

      const list = Object.keys(dailyCounts)
        .map(dateKey => ({
          label: dailyCounts[dateKey].dayLabel,
          fullLabel: dailyCounts[dateKey].fullDate,
          sortingKey: dateKey,
          "Realizados": dailyCounts[dateKey].count
        }))
        .sort((a, b) => a.sortingKey.localeCompare(b.sortingKey));

      return list.length > 31 ? list.slice(-31) : list;
    }
  }, [checklists, filteredChecklists, volumeViewMode, activeVehicles, vehicles, filterBase, filterTipo, filterPlaca]);

  // 2. Comparative Bar Chart: Realizados vs Não Realizados por Mês
  const barChartData = useMemo(() => {
    const monthlyData: { [key: string]: { realizados: number; uniquePlates: Set<string> } } = {};
    const totalFrota = activeVehicles.length > 0 ? activeVehicles.length : vehicles.length || 10;

    filteredChecklists.forEach(c => {
      const parsed = parseChecklistDate(c.data, c.timestamp);
      if (!parsed) return;
      const key = parsed.monthYear;
      if (!monthlyData[key]) {
        monthlyData[key] = { realizados: 0, uniquePlates: new Set<string>() };
      }
      monthlyData[key].realizados += 1;
      if (c.placa) {
        monthlyData[key].uniquePlates.add(c.placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      }
    });

    return Object.keys(monthlyData)
      .map(month => {
        const [m, y] = month.split("/");
        const realizados = monthlyData[month].realizados;
        const unique = monthlyData[month].uniquePlates.size;
        const pendentes = Math.max(0, totalFrota - unique);
        return {
          month,
          sortingKey: `${y}-${m}`,
          "Realizados": realizados,
          "Pendentes": pendentes
        };
      })
      .sort((a, b) => a.sortingKey.localeCompare(b.sortingKey))
      .slice(-6);
  }, [filteredChecklists, activeVehicles, vehicles]);

  // 3. Distribution by Base Chart
  const baseChartData = useMemo(() => {
    const baseCounts: { [key: string]: number } = {};
    filteredChecklists.forEach(c => {
      const baseName = c.base ? c.base.toUpperCase().trim() : "MATRIZ";
      baseCounts[baseName] = (baseCounts[baseName] || 0) + 1;
    });

    return Object.keys(baseCounts)
      .map(base => ({
        name: base,
        "Checklists": baseCounts[base]
      }))
      .sort((a, b) => b["Checklists"] - a["Checklists"]);
  }, [filteredChecklists]);

  const maxChecklists = useMemo(() => {
    if (baseChartData.length === 0) return 0;
    return Math.max(...baseChartData.map(d => d.Checklists));
  }, [baseChartData]);

  // 4. Distribution by Type Chart (Donut Chart)
  const typeChartData = useMemo(() => {
    const typeCounts: { [key: string]: number } = {};
    filteredChecklists.forEach(c => {
      const typeName = c.tipo ? c.tipo.toUpperCase().trim() : "OUTROS";
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    });

    const colors = ["#114D38", "#ff9b00", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f59e0b", "#64748b"];

    return Object.keys(typeCounts)
      .map((type, idx) => ({
        name: type,
        value: typeCounts[type],
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredChecklists]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 text-slate-800 text-left overflow-hidden">
      
      {/* Dynamic Filter Section & KPI Cards (Frozen at top) */}
      <div className="shrink-0 space-y-3">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          {/* Top Always-Visible Bar: Period Filter + Quick Controls + Expand Advanced */}
          <div className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
            
            {/* Left: Período do Checklist com Seleção de Modalidade (Mês, Intervalo, Trimestre/Ano) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#114D38] flex items-center justify-center shrink-0 border border-emerald-100">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    Filtro de Período do Checklist
                  </span>
                  
                  {/* Abas de Modo de Período: Mês / Intervalo / Trimestre & Ano */}
                  <div className="flex items-center gap-1 mt-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => setPeriodMode("mes")}
                      className={cn(
                        "px-2 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer",
                        periodMode === "mes" ? "bg-white text-[#114D38] shadow-xs" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Mês Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodMode("intervalo")}
                      className={cn(
                        "px-2 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1",
                        periodMode === "intervalo" ? "bg-white text-[#114D38] shadow-xs" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Intervalo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodMode("trimestre_ano")}
                      className={cn(
                        "px-2 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1",
                        periodMode === "trimestre_ano" ? "bg-white text-[#114D38] shadow-xs" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <Layers className="w-3 h-3" />
                      <span>Trimestre / Ano</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodMode("todos")}
                      className={cn(
                        "px-2 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer",
                        periodMode === "todos" ? "bg-white text-[#114D38] shadow-xs" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      Todos
                    </button>
                  </div>
                </div>
              </div>

              {/* Controles Dinâmicos conforme o Modo Selecionado */}
              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 sm:pt-4">
                
                {/* 1. Modo Mês Único */}
                {periodMode === "mes" && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={filterMonthYear}
                      onChange={(e) => setFilterMonthYear(e.target.value)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-[#114D38] focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="">Todos os Meses</option>
                      {monthYearOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>

                    {/* Botão Mês Atual */}
                    {(() => {
                      const now = new Date();
                      const cur = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
                      if (filterMonthYear !== cur) {
                        return (
                          <button
                            type="button"
                            onClick={() => setFilterMonthYear(cur)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 hover:bg-emerald-100 text-[#114D38] border border-emerald-200 transition-colors cursor-pointer"
                          >
                            Mês Atual
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* 2. Modo Intervalo entre dois períodos */}
                {periodMode === "intervalo" && (
                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                    <span className="text-[10px] font-black text-slate-400 uppercase px-1">De:</span>
                    <select
                      value={rangeStartMonth}
                      onChange={(e) => setRangeStartMonth(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#114D38] focus:outline-none"
                    >
                      {monthYearOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>

                    <span className="text-[10px] font-black text-slate-400 uppercase px-1">Até:</span>
                    <select
                      value={rangeEndMonth}
                      onChange={(e) => setRangeEndMonth(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#114D38] focus:outline-none"
                    >
                      {monthYearOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Modo Trimestre / Ano */}
                {periodMode === "trimestre_ano" && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedQuarterYear}
                      onChange={(e) => setSelectedQuarterYear(e.target.value)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-[#114D38] focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer shadow-2xs"
                    >
                      {quarterYearOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Badge do período ativo */}
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                  {activePeriodLabel}
                </span>

              </div>

            </div>

            {/* Right: Actions & Advanced Filters Drawer Toggle */}
            <div className="flex items-center gap-2 self-end lg:self-center">
              {(filterBase || filterTipo || filterStatus || filterPlaca || filterMotorista || periodMode !== "mes") && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                  title="Redefinir filtros para o padrão"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar</span>
                </button>
              )}

              <button 
                type="button"
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs border",
                  isFilterExpanded || filterBase || filterTipo || filterStatus || filterPlaca || filterMotorista
                    ? "bg-emerald-50 text-[#114D38] border-emerald-300 hover:bg-emerald-100"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros Avançados</span>
                {(filterBase || filterTipo || filterStatus || filterPlaca || filterMotorista) && (
                  <span className="text-[9px] font-black uppercase bg-emerald-200 text-[#114D38] px-1.5 py-0.5 rounded-md">
                    Ativo
                  </span>
                )}
                {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

          </div>

          {/* Retractable Advanced Filters Sub-Drawer */}
          {isFilterExpanded && (
            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-150 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Base/Filial */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Base Operacional
                </label>
                <select
                  value={filterBase}
                  onChange={(e) => setFilterBase(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todas as Bases</option>
                  {baseOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Tipo de Checklist
                </label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todos os Tipos</option>
                  {tipoOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Status de Inspeção
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todos os Status</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Ressalvas">Com Ressalvas</option>
                  <option value="Retido">Retido / Crítico</option>
                </select>
              </div>

              {/* Placa */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Placa do Veículo
                </label>
                <select
                  value={filterPlaca}
                  onChange={(e) => setFilterPlaca(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todas as Placas</option>
                  {placaOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Motorista / Condutor */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Condutor Responsável
                </label>
                <select
                  value={filterMotorista}
                  onChange={(e) => setFilterMotorista(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todos os Condutores</option>
                  {motoristaOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

            </div>
          )}

          {/* 3 Executive Summary Cards */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Vehicles Card */}
            <div className="bg-gradient-to-br from-[#114D38] to-[#0A3324] text-white p-5 rounded-[24px] shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
              <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start relative z-10 text-left">
                <div>
                  <span className="text-[9px] font-black text-emerald-300 uppercase tracking-wider">Frota Total Monitorada</span>
                  <h3 className="text-sm font-extrabold mt-0.5">Total de Veículos</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-emerald-200" />
                </div>
              </div>
              <div className="mt-2 relative z-10 text-left">
                <span className="text-3xl font-display font-black tracking-tight">{totalVehiclesCount}</span>
                <span className="text-xs font-bold text-emerald-200 block mt-0.5">Veículos leves ativos</span>
              </div>
            </div>

            {/* Checklists Realizados Card */}
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-[#114D38] text-white p-5 rounded-[24px] shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
              <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start relative z-10 text-left">
                <div>
                  <span className="text-[9px] font-black text-emerald-200 uppercase tracking-wider">Inspeções Realizadas</span>
                  <h3 className="text-sm font-extrabold mt-0.5">Checklists Realizados</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-200" />
                </div>
              </div>
              <div className="mt-1 relative z-10 text-left flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-display font-black tracking-tight">{totalChecklistsCount}</span>
                  <span className="text-xs font-bold text-emerald-100 block mt-0.5">Inspecionados no período</span>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-white/10 ${statsComparison.isPositive ? "text-emerald-300" : "text-amber-300"}`}>
                    {statsComparison.isPositive ? "+" : ""}{statsComparison.pctChange}%
                  </span>
                  <span className="text-[8px] font-bold text-emerald-200 block mt-0.5">mês anterior</span>
                </div>
              </div>
            </div>

            {/* Pending Checklists Card */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-[24px] shadow-sm relative overflow-hidden flex flex-col justify-between h-36">
              <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start relative z-10 text-left">
                <div>
                  <span className="text-[9px] font-black text-amber-100 uppercase tracking-wider">Atenção & Cobrança</span>
                  <h3 className="text-sm font-extrabold mt-0.5">Veículos Sem Checklist</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-2 relative z-10 text-left">
                <span className="text-3xl font-display font-black tracking-tight">{pendingChecklistsCount}</span>
                <span className="text-xs font-bold text-amber-100 block mt-0.5">
                  {pendingChecklistsCount === 0 ? "Toda a frota está em dia!" : `${pendingChecklistsCount} veículos pendentes no período`}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scrollable Container for Charts */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8 space-y-6">
        
        {/* Chart 1: Standalone Row - Evolução Mensal: Realizados vs Não Realizados */}
        <div className="w-full bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {volumeViewMode === "mes" ? "Volume Mensal Comparativo" : "Volume Diário"}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2 mt-0.5">
                <ClipboardList className="w-5 h-5 text-[#114D38]" /> 
                {volumeViewMode === "mes" ? "Evolução Mensal: Realizados vs Não Realizados" : "Checklists Realizados por Dia"}
              </h3>
            </div>

            {/* Toggle Buttons: Por Dia / Por Mês */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setVolumeViewMode("dia")}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  volumeViewMode === "dia"
                    ? "bg-[#114D38] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Por Dia</span>
              </button>
              <button
                type="button"
                onClick={() => setVolumeViewMode("mes")}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  volumeViewMode === "mes"
                    ? "bg-[#114D38] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Por Mês</span>
              </button>
            </div>
          </div>

          {/* Legenda Explicativa do Gráfico de Volume */}
          {volumeViewMode === "mes" && (
            <div className="flex flex-wrap items-center gap-5 text-xs font-bold pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-[#114D38] inline-block shadow-2xs" />
                <span className="text-slate-700 font-extrabold">Checklists Realizados (Área Verde)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1.5 rounded-full bg-[#F47920] inline-block shadow-2xs" />
                <span className="text-[#d96512] font-black">Veículos Não Realizados / Pendentes (Linha Laranja)</span>
              </div>
            </div>
          )}

          <div className="h-80 w-full pt-2">
            {volumeChartData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-semibold">
                Nenhum dado de histórico disponível para os filtros atuais.
              </div>
            ) : volumeViewMode === "mes" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeChartData} margin={{ top: 15, right: 25, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRealizados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#114D38" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#114D38" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} 
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f3d2d", borderRadius: "14px", border: "none", boxShadow: "0 10px 20px -3px rgba(0, 0, 0, 0.25)", padding: "12px 16px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "12px", fontWeight: "bold" }}
                    labelStyle={{ color: "#F47920", fontSize: "13px", fontWeight: "900", marginBottom: "4px" }}
                    labelFormatter={(label: string, payload: any) => {
                      if (payload && payload[0] && payload[0].payload && payload[0].payload.fullLabel) {
                        return payload[0].payload.fullLabel;
                      }
                      return label;
                    }}
                  />
                  {/* Área e Linha Verde: Realizados */}
                  <Area 
                    type="monotone" 
                    dataKey="Realizados" 
                    name="Realizados"
                    stroke="#114D38" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRealizados)" 
                  />
                  {/* Linha Alaranjada: Quantidade de veículos que não fizeram checklist */}
                  <Line 
                    type="monotone" 
                    dataKey="Não Realizados" 
                    name="Não Realizados (Pendentes)"
                    stroke="#F47920" 
                    strokeWidth={3}
                    dot={{ fill: "#F47920", stroke: "#ffffff", strokeWidth: 2.5, r: 5 }}
                    activeDot={{ r: 7, stroke: "#F47920", strokeWidth: 2.5, fill: "#ffffff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeChartData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRealizadosDia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#114D38" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#114D38" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} 
                  />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#114D38", borderRadius: "14px", border: "none", padding: "12px 16px" }}
                    itemStyle={{ color: "#ffffff", fontSize: "12px", fontWeight: "bold" }}
                    labelStyle={{ color: "#F47920", fontSize: "12px", fontWeight: "extrabold", marginBottom: "4px" }}
                    formatter={(val: any) => [`${val} checklists`, "Realizados"]}
                    labelFormatter={(label: string, payload: any) => {
                      if (payload && payload[0] && payload[0].payload && payload[0].payload.fullLabel) {
                        return payload[0].payload.fullLabel;
                      }
                      return label;
                    }}
                  />
                  <Area type="monotone" dataKey="Realizados" stroke="#114D38" strokeWidth={3} fillOpacity={1} fill="url(#colorRealizadosDia)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Remaining 3 Charts in a Balanced 3-Column Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-left">

          {/* Chart 2: Comparative Donut Chart (Realizados vs Pendentes no período) */}
          <div className="bg-white p-5 rounded-[28px] border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Eficiência de Cobertura</span>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" /> Aderência da Frota
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#114D38]" />
                  <span className="text-slate-600">Realizados ({totalChecklistsCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Pendentes ({pendingChecklistsCount})</span>
                </div>
              </div>
            </div>

            <div className="h-60 w-full flex items-center justify-center relative my-auto">
              {totalChecklistsCount === 0 && pendingChecklistsCount === 0 ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-semibold">
                  Nenhum dado disponível.
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Realizados", value: totalChecklistsCount },
                          { name: "Pendentes", value: pendingChecklistsCount }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill="#114D38" />
                        <Cell fill="#F47920" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none" }}
                        itemStyle={{ fontSize: "11px", fontWeight: "bold", color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central Text inside Donut */}
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-display font-black text-[#114D38]">
                      {totalChecklistsCount + pendingChecklistsCount}
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Total Geral</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart 3: Distribution by Base */}
          <div className="bg-[#FAFDFB] p-5 rounded-[28px] border border-emerald-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Análise de Campo</span>
              <h3 className="text-sm font-extrabold text-[#114D38] flex items-center gap-1.5 mt-0.5">
                <FileSpreadsheet className="w-4 h-4 text-[#114D38]" /> Por Base Operacional
              </h3>
            </div>
            <div className="h-60 w-full">
              {baseChartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-semibold">
                  Nenhum dado por base disponível.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={baseChartData}
                    margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: "black", fill: "#114D38" }} />
                    <YAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold", fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#114D38", borderRadius: "12px", border: "none" }}
                      itemStyle={{ color: "#ffffff", fontSize: "11px", fontWeight: "bold" }}
                      labelStyle={{ color: "#ff9b00", fontSize: "11px", fontWeight: "extrabold" }}
                    />
                    <Bar dataKey="Checklists" fill="#114D38" radius={[6, 6, 0, 0]} barSize={20}>
                      {baseChartData.map((entry, index) => {
                        const isMax = entry.Checklists === maxChecklists && maxChecklists > 0;
                        const barColor = isMax ? "#22C55E" : "#114D38";
                        return (
                          <Cell key={`cell-${index}`} fill={barColor} />
                        );
                      })}
                      <LabelList dataKey="Checklists" position="top" style={{ fill: "#114D38", fontSize: "9px", fontWeight: "900" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 4: Distribution by Type (Donut Chart) */}
          <div className="bg-[#FAFDFB] p-5 rounded-[28px] border border-emerald-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Finalidade de Uso</span>
              <h3 className="text-sm font-extrabold text-[#114D38] flex items-center gap-1.5 mt-0.5">
                <LayoutDashboard className="w-4 h-4 text-[#114D38]" /> Checklist por Tipo
              </h3>
            </div>
            <div className="h-60 flex flex-col items-center justify-center gap-3 py-1">
              {typeChartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-semibold">
                  Nenhum tipo registrado nos filtros vigentes.
                </div>
              ) : (
                <>
                  <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 bg-white/60 rounded-full border border-emerald-100/50 shadow-inner -z-10" />
                    <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_4px_8px_rgba(17,77,56,0.08)]" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="11"
                      />
                      {(() => {
                        let accumulatedPercent = 0;
                        const totalVal = typeChartData.reduce((acc, d) => acc + d.value, 0);
                        return typeChartData.map((item, idx) => {
                          const percent = (item.value / (totalVal || 1)) * 100;
                          const strokeDashoffset = 100 - accumulatedPercent;
                          accumulatedPercent += percent;

                          return (
                            <circle
                              key={idx}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth="11"
                              strokeDasharray={`${(percent * 2.3876)} 238.76`}
                              strokeDashoffset={-((100 - strokeDashoffset) * 2.3876)}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out hover:stroke-[13px] cursor-pointer"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center bg-white w-20 h-20 rounded-full shadow-md border border-slate-100">
                      <span className="text-xl font-display font-black text-[#114D38]">
                        {typeChartData.reduce((acc, d) => acc + d.value, 0)}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 font-mono">Total</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 w-full pr-1 overflow-y-auto max-h-24">
                    {typeChartData.map((item, idx) => {
                      const totalVal = typeChartData.reduce((acc, d) => acc + d.value, 0);
                      const pct = Math.round((item.value / (totalVal || 1)) * 100);

                      return (
                        <div key={idx} className="space-y-1 text-left px-1.5 py-0.5 rounded-lg hover:bg-slate-50 transition-all duration-200">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <div className="flex items-center gap-1.5 text-slate-700 truncate max-w-[110px]">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
                              <span className="uppercase text-[9px] font-extrabold tracking-wide truncate">{item.name}</span>
                            </div>
                            <div className="font-mono text-slate-800 flex items-center gap-1 shrink-0 font-bold text-[9.5px]">
                              <span>{item.value} un</span>
                              <span className="text-[#114D38] bg-emerald-50 px-1 rounded">({pct}%)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-150 h-1 rounded-full overflow-hidden border border-slate-200/20">
                            <div 
                              className="h-full rounded-full transition-all duration-700 shadow-xs" 
                              style={{ width: `${pct}%`, backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

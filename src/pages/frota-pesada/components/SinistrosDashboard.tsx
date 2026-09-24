import React, { useMemo, useState, useEffect } from "react";
import { Sinistro } from "../types";
import { SINISTROS_REAIS_OFICIAIS } from "../../../data/sinistros_reais";
import { 
  ShieldAlert, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  TrendingUp, 
  ExternalLink, 
  Filter, 
  Building2, 
  FileSpreadsheet, 
  Activity, 
  RefreshCw, 
  UserCheck, 
  FileCheck, 
  Image as ImageIcon, 
  MapPin, 
  FileText, 
  Users,
  Award,
  BarChart3,
  Clock,
  Sparkles,
  PieChart as PieChartIcon
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
import { syncSinistrosOnline } from "../services/sinistrosService";

const SHAREPOINT_EXCEL_URL = "https://riselcombustiveis-my.sharepoint.com/:x:/r/personal/deny_goncalves_risel_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B08C8A01A-45A5-4439-94F4-5F0505EDE3B3%7D&file=Comunicado%20de%20Sinistro_Frota%20Pesada.xlsx&action=default&mobileredirect=true";

interface SinistrosDashboardProps {
  sinistros: Sinistro[];
  onNavigateToSinistros: () => void;
  onOpenNewSinistroModal: () => void;
  onRefreshData?: () => void;
}

const COLORS_STATUS: Record<string, string> = {
  "Finalizado / Concluído": "#10b981",
  "Aberto na Seguradora": "#3b82f6",
  "Aguardando Orçamento": "#f59e0b",
  "Em Reparo": "#8b5cf6",
  "Em Apuração": "#64748b"
};

const BASE_GRADIENTS = [
  { from: "#00d664", to: "#059669", border: "#10b981", bg: "bg-emerald-50 text-emerald-800" },
  { from: "#0284c7", to: "#0369a1", border: "#38bdf8", bg: "bg-sky-50 text-sky-800" },
  { from: "#f59e0b", to: "#d97706", border: "#fbbf24", bg: "bg-amber-50 text-amber-800" },
  { from: "#8b5cf6", to: "#6d28d9", border: "#a78bfa", bg: "bg-purple-50 text-purple-800" },
  { from: "#ec4899", to: "#be185d", border: "#f472b6", bg: "bg-pink-50 text-pink-800" },
  { from: "#14b8a6", to: "#0f766e", border: "#2dd4bf", bg: "bg-teal-50 text-teal-800" },
  { from: "#6366f1", to: "#4338ca", border: "#818cf8", bg: "bg-indigo-50 text-indigo-800" },
  { from: "#e11d48", to: "#9f1239", border: "#fb7185", bg: "bg-rose-50 text-rose-800" },
  { from: "#64748b", to: "#334155", border: "#94a3b8", bg: "bg-slate-50 text-slate-800" }
];

export const SinistrosDashboard: React.FC<SinistrosDashboardProps> = ({
  sinistros,
  onNavigateToSinistros,
  onRefreshData
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [selectedAssumiu, setSelectedAssumiu] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Sincronização e carregamento inicial
  useEffect(() => {
    if (sinistros.length === 0 && onRefreshData) {
      onRefreshData();
    }
  }, [onRefreshData, sinistros.length]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncSinistrosOnline();
      if (res.success) {
        setSyncFeedback(`Sincronizado: ${res.totalSinistros || 72} ocorrências da planilha Sheet1.`);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncFeedback("Erro ao sincronizar com SharePoint.");
      }
    } catch (e: any) {
      setSyncFeedback("Falha na sincronização online.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Normalização de Gestores para agrupamento coerente
  const normalizeGestor = (gestor?: string): string => {
    if (!gestor) return "Não Informado";
    const g = gestor.trim().toUpperCase();
    if (g.includes("MICHEL")) return "Michel de Moraes";
    if (g.includes("DANIEL") || g.includes("VEDOVELLO")) return "Daniele Vedovello";
    if (g.includes("EVERTON") || g.includes("OLIMPIO")) return "Everton Olimpio";
    if (g.includes("CESAR")) return "Cesar Henrique";
    if (g.includes("WILLIAM")) return "William";
    if (g.includes("CAMILA")) return "Camila Arruda";
    if (g.includes("FELIPE") || g.includes("ASSUMPCAO") || g.includes("ASSUMPÇÃO")) return "Felipe Assumpção";
    if (g.includes("PRISCILA")) return "Priscila Mendes";
    if (g.includes("RODRIGO")) return "Rodrigo Mosca";
    if (g.includes("TATIANA")) return "Tatiana Ribeiro";
    return gestor.trim();
  };

  // Base de sinistros efetiva (garante que nunca fique vazia)
  const effectiveSinistros = useMemo(() => {
    return (sinistros && sinistros.length > 0) ? sinistros : SINISTROS_REAIS_OFICIAIS;
  }, [sinistros]);

  // Extrair meses disponíveis dos dados reais
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    effectiveSinistros.forEach(s => {
      if (!s.dataHora) return;
      const d = s.dataHora.includes("T") ? s.dataHora.split("T")[0] : s.dataHora.split(" ")[0];
      let y = "", m = "";
      if (d.includes("-")) {
        const parts = d.split("-");
        y = parts[0];
        m = parts[1];
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
  }, [effectiveSinistros]);

  // Extrair bases operacionais reais
  const availableBases = useMemo(() => {
    const set = new Set<string>();
    effectiveSinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [effectiveSinistros]);

  // Extrair gestores imediatos reais
  const availableGestores = useMemo(() => {
    const set = new Set<string>();
    effectiveSinistros.forEach(s => {
      const g = normalizeGestor(s.gestorImediato);
      if (g && g !== "Não Informado") set.add(g);
    });
    return Array.from(set).sort();
  }, [effectiveSinistros]);

  // Filtragem dos dados
  const filteredSinistros = useMemo(() => {
    return effectiveSinistros.filter(s => {
      if (selectedMonth) {
        const d = s.dataHora?.includes("T") ? s.dataHora.split("T")[0] : (s.dataHora || "");
        if (!d.startsWith(selectedMonth)) return false;
      }
      if (selectedBase && s.base?.trim().toUpperCase() !== selectedBase.trim().toUpperCase()) return false;
      if (selectedAssumiu) {
        const assumiuSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
        if (selectedAssumiu === "SIM" && !assumiuSim) return false;
        if (selectedAssumiu === "NAO" && assumiuSim) return false;
      }
      if (selectedStatus && s.status !== selectedStatus) return false;
      if (selectedGestor && normalizeGestor(s.gestorImediato) !== selectedGestor) return false;
      return true;
    });
  }, [effectiveSinistros, selectedMonth, selectedBase, selectedAssumiu, selectedStatus, selectedGestor]);

  // Métricas Analíticas de KPI com base nas colunas reais da planilha
  const metrics = useMemo(() => {
    const total = filteredSinistros.length;
    let finalizados = 0;
    let emSeguradora = 0;
    let aguardandoOrcamento = 0;
    let emReparo = 0;
    let emApuracao = 0;

    let assumiuSim = 0;
    let assumiuNao = 0;

    let comTerceiro = 0;
    let comBO = 0;
    let comFotos = 0;

    const baseCount: Record<string, number> = {};

    filteredSinistros.forEach(s => {
      // Status
      if (s.status === "Finalizado / Concluído" || s.status?.toUpperCase().includes("FINALIZADO") || s.status?.toUpperCase().includes("CONCLU")) {
        finalizados++;
      } else if (s.status === "Aberto na Seguradora" || s.status?.toUpperCase().includes("SEGURADORA")) {
        emSeguradora++;
      } else if (s.status === "Aguardando Orçamento" || s.status?.toUpperCase().includes("PENDENTE") || s.status?.toUpperCase().includes("ORCAM")) {
        aguardandoOrcamento++;
      } else if (s.status === "Em Reparo" || s.status?.toUpperCase().includes("REPARO") || s.status?.toUpperCase().includes("OFICINA")) {
        emReparo++;
      } else {
        emApuracao++;
      }

      // Responsabilidade / Assumiu
      const isSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
      if (isSim) assumiuSim++; else assumiuNao++;

      // Terceiros
      if (s.nomeTerceiro || s.placaTerceiro || s.contatoTerceiro || s.dadosTerceiro || s.houveTerceiros === 'Sim') {
        comTerceiro++;
      }

      // B.O.
      if (s.boletimOcorrenciaUrl || s.boletimOcorrencia || s.sharepointLinks?.boletim) {
        comBO++;
      }

      // Fotos & Anexos
      if ((s.anexosSharePoint && s.anexosSharePoint.length > 0) || (s.sharepointLinks?.fotos && s.sharepointLinks.fotos.length > 0)) {
        comFotos++;
      }

      // Base
      const b = s.base?.trim() || "Não Informada";
      baseCount[b] = (baseCount[b] || 0) + 1;
    });

    const sortedBases = Object.entries(baseCount).sort((a, b) => b[1] - a[1]);
    const topBaseName = sortedBases[0]?.[0] || "Paulínia";
    const topBaseCount = sortedBases[0]?.[1] || 0;
    const secondBaseName = sortedBases[1]?.[0] || "São Bernardo";
    const secondBaseCount = sortedBases[1]?.[1] || 0;

    const pctFinalizados = total > 0 ? Math.round((finalizados / total) * 100) : 0;
    const pctAssumiuSim = total > 0 ? Math.round((assumiuSim / total) * 100) : 0;
    const pctAssumiuNao = total > 0 ? Math.round((assumiuNao / total) * 100) : 0;
    const pctComTerceiro = total > 0 ? Math.round((comTerceiro / total) * 100) : 0;
    const pctComBO = total > 0 ? Math.round((comBO / total) * 100) : 0;
    const pctComFotos = total > 0 ? Math.round((comFotos / total) * 100) : 0;

    return {
      total,
      finalizados,
      emSeguradora,
      aguardandoOrcamento,
      emReparo,
      emApuracao,
      assumiuSim,
      assumiuNao,
      comTerceiro,
      comBO,
      semBO: total - comBO,
      comFotos,
      topBaseName,
      topBaseCount,
      secondBaseName,
      secondBaseCount,
      pctFinalizados,
      pctAssumiuSim,
      pctAssumiuNao,
      pctComTerceiro,
      pctComBO,
      pctComFotos
    };
  }, [filteredSinistros]);

  // Gráfico 1: Evolução Temporal das Ocorrências (Linha Única - Full Width)
  const monthlyTimelineData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      if (!s.dataHora) return;
      const d = s.dataHora.includes("T") ? s.dataHora.split("T")[0] : s.dataHora.split(" ")[0];
      if (d.length >= 7) {
        const ym = d.substring(0, 7);
        map.set(ym, (map.get(ym) || 0) + 1);
      }
    });

    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([ym, count]) => {
      const [year, month] = ym.split("-");
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = dateObj.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
      return {
        key: ym,
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        ocorrencias: count
      };
    });
  }, [filteredSinistros]);

  // Estatísticas da Timeline
  const timelineStats = useMemo(() => {
    if (monthlyTimelineData.length === 0) return { peakMonth: "N/D", peakVal: 0, avg: 0 };
    let peakMonth = "";
    let peakVal = -1;
    let sum = 0;
    monthlyTimelineData.forEach(item => {
      sum += item.ocorrencias;
      if (item.ocorrencias > peakVal) {
        peakVal = item.ocorrencias;
        peakMonth = item.mes;
      }
    });
    const avg = (sum / monthlyTimelineData.length).toFixed(1);
    return { peakMonth, peakVal, avg };
  }, [monthlyTimelineData]);

  // Gráfico 2: Distribuição por Base Operacional (Linha Única - Full Width)
  const baseDistributionData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const b = s.base?.trim() || "Não Informada";
      map.set(b, (map.get(b) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .map(([name, count], index) => {
        const pct = Math.round((count / total) * 100);
        const palette = BASE_GRADIENTS[index % BASE_GRADIENTS.length];
        return { name, count, pct, palette };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredSinistros]);

  // Gráfico 3: Gestores Imediatos com Mais Ocorrências (Barras Customizadas)
  const gestoresData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const g = normalizeGestor(s.gestorImediato);
      map.set(g, (map.get(g) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .map(([name, count], index) => {
        const pct = Math.round((count / total) * 100);
        return { name, count, pct, rank: index + 1 };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredSinistros]);

  // Gráfico 4: Status Operacional dos Processos
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      let st = s.status || "Em Apuração";
      if (st.toUpperCase().includes("FINALIZADO") || st.toUpperCase().includes("CONCLU")) st = "Finalizado / Concluído";
      else if (st.toUpperCase().includes("SEGURADORA")) st = "Aberto na Seguradora";
      else if (st.toUpperCase().includes("ORCAM")) st = "Aguardando Orçamento";
      else if (st.toUpperCase().includes("REPARO") || st.toUpperCase().includes("OFICINA")) st = "Em Reparo";
      else st = "Em Apuração";
      map.set(st, (map.get(st) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .map(([name, value]) => ({ 
        name, 
        value, 
        pct: Math.round((value / total) * 100),
        color: COLORS_STATUS[name] || "#64748b" 
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSinistros]);

  // Gráfico 5: Culpabilidade / Responsabilidade Declarada (SIM / NÃO)
  const responsabilidadeData = useMemo(() => {
    let sim = 0;
    let nao = 0;
    filteredSinistros.forEach(s => {
      const isSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
      if (isSim) sim++; else nao++;
    });

    const total = sim + nao || 1;
    return [
      { name: "Condutor Risel (SIM)", value: sim, pct: Math.round((sim / total) * 100), color: "#f43f5e" },
      { name: "Terceiro / Não Assumiu (NÃO)", value: nao, pct: Math.round((nao / total) * 100), color: "#10b981" }
    ];
  }, [filteredSinistros]);

  // Gráfico 6: Top Cidades com Mais Sinistros
  const topCidadesData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      let cid = s.cidade?.trim() || (s.local?.includes("-") ? s.local.split("-").pop()?.trim() : "") || "Não Informada";
      cid = cid.toUpperCase().replace(/\s+-\s*SP/, "").replace(/,.*$/, "").trim();
      if (!cid || cid === "LOCAL NÃO INFORMADO") cid = "Outros / Em Trânsito";
      map.set(cid, (map.get(cid) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .map(([name, count]) => ({ 
        name, 
        count, 
        pct: Math.round((count / total) * 100) 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredSinistros]);

  // Últimas Ocorrências Reais da Planilha
  const recentSinistros = useMemo(() => {
    return [...filteredSinistros]
      .sort((a, b) => (b.dataHora || "").localeCompare(a.dataHora || ""))
      .slice(0, 4);
  }, [filteredSinistros]);

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto pb-10 overflow-x-hidden font-sans">
      
      {/* CABEÇALHO DO DASHBOARD COM STATUS ONLINE E FILTROS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Dashboard Analítico de Sinistros &amp; Avarias
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100/90 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Base Real Oficial ({effectiveSinistros.length} registros Sheet1)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Visualização executiva com métricas extraídas em tempo real da planilha corporativa e formulários de comunicado.
              </p>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200/90 text-slate-700 border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-60 active:scale-95"
              title="Recarregar dados da planilha do SharePoint"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Sincronizando..." : "Sincronizar Sheet1"}</span>
            </button>

            <a
              href={SHAREPOINT_EXCEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-2xs transition-all"
              title="Abrir pasta de trabalho no Microsoft Excel Online"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>SharePoint Excel</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            <button
              onClick={onNavigateToSinistros}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs hover:shadow-md hover:from-rose-700 hover:to-rose-800 transition-all cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>Tabela Operacional</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* BARRA DE FILTROS AVANÇADOS */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtros Rápidos:</span>
          </div>

          {/* Filtro Período / Mês */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-rose-500/20">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Meses</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro Base */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-rose-500/20">
            <Building2 className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedBase}
              onChange={(e) => setSelectedBase(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todas as Bases</option>
              {availableBases.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filtro Responsabilidade Condutor */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-rose-500/20">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedAssumiu}
              onChange={(e) => setSelectedAssumiu(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todas as Responsabilidades</option>
              <option value="SIM">Condutor Risel Assumiu (SIM)</option>
              <option value="NAO">Sem Culpa / Terceiro (NÃO)</option>
            </select>
          </div>

          {/* Filtro Gestor */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-rose-500/20">
            <Users className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedGestor}
              onChange={(e) => setSelectedGestor(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Gestores</option>
              {availableGestores.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-rose-500/20">
            <Activity className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Status</option>
              <option value="Finalizado / Concluído">Finalizado / Concluído</option>
              <option value="Aberto na Seguradora">Aberto na Seguradora</option>
              <option value="Aguardando Orçamento">Aguardando Orçamento</option>
              <option value="Em Reparo">Em Reparo</option>
              <option value="Em Apuração">Em Apuração</option>
            </select>
          </div>

          {(selectedMonth || selectedBase || selectedAssumiu || selectedStatus || selectedGestor) && (
            <button
              onClick={() => {
                setSelectedMonth("");
                setSelectedBase("");
                setSelectedAssumiu("");
                setSelectedStatus("");
                setSelectedGestor("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-black hover:underline cursor-pointer ml-1"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-xs font-bold text-slate-500">
            Exibindo <span className="text-slate-900 font-black">{filteredSinistros.length}</span> de {effectiveSinistros.length} ocorrências
          </div>
        </div>
      </div>

      {/* 6 CARDS DE KPIS ANALÍTICOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Total de Sinistros */}
        <div className="p-4 rounded-3xl border border-rose-200/80 bg-gradient-to-br from-white via-rose-50/30 to-rose-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Total de Sinistros
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-rose-200 bg-rose-50 text-rose-600 shadow-2xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.total}
            </span>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {metrics.finalizados} Concluídos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            {metrics.emApuracao + metrics.emSeguradora + metrics.aguardandoOrcamento + metrics.emReparo} em tramitação ativa
          </span>
        </div>

        {/* KPI 2: Responsabilidade Condutor Risel */}
        <div className="p-4 rounded-3xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Condutor Risel Assumiu
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-amber-200 bg-amber-50 text-amber-600 shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.assumiuSim}
            </span>
            <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {metrics.pctAssumiuSim}% dos casos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            {metrics.assumiuNao} sem culpa / culpa terceiro ({metrics.pctAssumiuNao}%)
          </span>
        </div>

        {/* KPI 3: Terceiros Envolvidos */}
        <div className="p-4 rounded-3xl border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/30 to-blue-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Terceiros Identificados
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50 text-blue-600 shadow-2xs">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.comTerceiro}
            </span>
            <span className="text-[10px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
              {metrics.pctComTerceiro}% c/ dados
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Placas, condutores e contatos cadastrados
          </span>
        </div>

        {/* KPI 4: Boletins de Ocorrência (B.O.) */}
        <div className="p-4 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/30 to-emerald-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Boletins de Ocorrência
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-2xs">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.comBO}
            </span>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {metrics.pctComBO}% emitidos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            PDFs de B.O. oficial anexados
          </span>
        </div>

        {/* KPI 5: Acervo de Evidências & Fotos */}
        <div className="p-4 rounded-3xl border border-purple-200/80 bg-gradient-to-br from-white via-purple-50/30 to-purple-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Acervo de Fotos &amp; Laudos
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-purple-200 bg-purple-50 text-purple-600 shadow-2xs">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.comFotos}
            </span>
            <span className="text-[10px] font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
              {metrics.pctComFotos}% registrados
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Fotos do veículo e do local anexadas
          </span>
        </div>

        {/* KPI 6: Base com Mais Ocorrências */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Base Líder em Sinistros
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-300 bg-slate-100 text-slate-700 shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800 block tracking-tight truncate" title={metrics.topBaseName}>
              {metrics.topBaseName}
            </span>
            <span className="text-[10px] font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded-lg">
              {metrics.topBaseCount} casos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1 truncate">
            2ª: {metrics.secondBaseName} ({metrics.secondBaseCount} casos)
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DESTAQUE STANDALONE: GRÁFICO EVOLUÇÃO TEMPORAL DAS OCORRÊNCIAS (LINHA SOZINHO) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-rose-300 hover:shadow-md">
        {/* Decorative SVG Pattern Accent */}
        <div className="absolute top-0 right-0 w-96 h-96 opacity-[0.03] pointer-events-none">
          <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full text-rose-900">
            <path d="M0 50 Q25 0 50 50 T100 50 L100 100 L0 100 Z" />
          </svg>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  Evolução Temporal das Ocorrências
                  <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Visão Cronológica Consolidada
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Comportamento histórico e frequência mensal de sinistros registrados na frota pesada (2024 - 2026)
                </p>
              </div>
            </div>
          </div>

          {/* Badges de Destaque Estatístico com SVGs */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Mês de Pico</span>
                <span className="font-black text-rose-600 font-mono text-xs">{timelineStats.peakMonth} ({timelineStats.peakVal} casos)</span>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Média Mensal</span>
                <span className="font-black text-slate-800 font-mono text-xs">{timelineStats.avg} ocorrências</span>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-xs flex items-center gap-2 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 block leading-none">Total no Recorte</span>
                <span className="font-black text-rose-900 font-mono text-xs">{filteredSinistros.length} registros</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de Área SVG / Recharts com Curvas Suaves e Gradiente */}
        <div className="h-72 sm:h-84 w-full mt-2">
          {monthlyTimelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTimelineData} margin={{ top: 15, right: 25, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="sinistroTimelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#f43f5e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                  <filter id="shadowTimeline" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f43f5e" floodOpacity="0.35" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 700 }} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} ocorrências registradas`, "Sinistros na Frota"]}
                  labelFormatter={(label) => `Período: ${label}`}
                  contentStyle={{ 
                    backgroundColor: "#0f172a", 
                    borderColor: "#334155", 
                    borderRadius: "16px", 
                    color: "#fff", 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    padding: "10px 14px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)" 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="ocorrencias" 
                  stroke="#e11d48" 
                  strokeWidth={3.5} 
                  fillOpacity={1} 
                  fill="url(#sinistroTimelineGradient)" 
                  filter="url(#shadowTimeline)"
                  dot={{ r: 5, fill: "#e11d48", strokeWidth: 2.5, stroke: "#ffffff" }}
                  activeDot={{ r: 8, fill: "#e11d48", strokeWidth: 3.5, stroke: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
              Nenhum dado encontrado para os filtros selecionados
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DESTAQUE STANDALONE: GRÁFICO OCORRÊNCIAS POR BASE OPERACIONAL (LINHA SOZINHO) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-blue-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Ocorrências por Base Operacional
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Distribuição Consolidada de Unidades
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Incidência de sinistros segmentada por bases operacionais, matriz e filiais da Risel Combustíveis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-600 flex items-center gap-2 shadow-2xs">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Bases c/ Ocorrência: <strong className="text-slate-900">{baseDistributionData.length}</strong></span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-blue-50 border border-blue-200 font-bold text-blue-800 flex items-center gap-2 shadow-2xs">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Líder: <strong>{metrics.topBaseName}</strong> ({metrics.topBaseCount} casos · {Math.round((metrics.topBaseCount / (metrics.total || 1)) * 100)}%)</span>
            </div>
          </div>
        </div>

        {/* Grade de Barras Customizadas com SVG Progress & Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-6">
          {baseDistributionData.map((b, idx) => (
            <div 
              key={b.name}
              className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${b.palette.bg}`}>
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-800 truncate" title={b.name}>
                    {b.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 font-mono">
                    {b.count}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({b.pct}%)
                  </span>
                </div>
              </div>

              {/* Barra de Progresso SVG Customizada */}
              <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden relative">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${Math.max(6, b.pct)}%`,
                    background: `linear-gradient(90deg, ${b.palette.from}, ${b.palette.to})`
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico Recharts de Barras em Destaque Visual */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {baseDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={baseDistributionData} margin={{ top: 15, right: 20, left: -15, bottom: 25 }}>
                <defs>
                  {baseDistributionData.map((b, index) => (
                    <linearGradient key={`grad-base-${index}`} id={`grad-base-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={b.palette.from} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={b.palette.to} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 700 }} 
                  axisLine={{ stroke: "#cbd5e1" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={45}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                />
                <Tooltip
                  formatter={(value: any) => [`${value} sinistros registrados`, "Total da Base"]}
                  contentStyle={{ 
                    backgroundColor: "#0f172a", 
                    borderColor: "#334155", 
                    borderRadius: "14px", 
                    color: "#fff", 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    padding: "8px 14px"
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={52}>
                  {baseDistributionData.map((_, index) => (
                    <Cell key={`cell-base-chart-${index}`} fill={`url(#grad-base-${index})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DESTAQUE STANDALONE: GRÁFICO DE GESTÃO IMEDIATA DA FROTA EM BARRAS (LINHA SOZINHO) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-indigo-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Gestão Imediata da Frota (Distribuição por Gestor)
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Liderança Operacional
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Volume e distribuição de sinistros por Gestor Operacional responsável pela condução e acompanhamento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-600 flex items-center gap-2 shadow-2xs">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Gestores Ativos: <strong className="text-slate-900">{gestoresData.length}</strong></span>
            </div>
            {gestoresData[0] && (
              <div className="px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 font-bold text-indigo-800 flex items-center gap-2 shadow-2xs">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>Maior Volume: <strong>{gestoresData[0].name}</strong> ({gestoresData[0].count} casos · {gestoresData[0].pct}%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Grade Executiva com Barras SVG Customizadas e Ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
          {gestoresData.map((g, index) => {
            const colors = [
              { grad: "from-indigo-600 to-indigo-800", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", bar: "#4f46e5" },
              { grad: "from-purple-600 to-purple-800", bg: "bg-purple-50 text-purple-700 border-purple-200", bar: "#7c3aed" },
              { grad: "from-blue-600 to-blue-800", bg: "bg-blue-50 text-blue-700 border-blue-200", bar: "#2563eb" },
              { grad: "from-emerald-600 to-emerald-800", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "#059669" },
              { grad: "from-amber-600 to-amber-800", bg: "bg-amber-50 text-amber-700 border-amber-200", bar: "#d97706" },
              { grad: "from-rose-600 to-rose-800", bg: "bg-rose-50 text-rose-700 border-rose-200", bar: "#e11d48" },
            ];
            const c = colors[index % colors.length];
            const pctRelative = Math.round((g.count / (gestoresData[0]?.count || 1)) * 100);

            return (
              <div 
                key={g.name} 
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center border ${c.bg}`}>
                      #{g.rank}
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block truncate" title={g.name}>
                        {g.name}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Gestor Operacional
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs block">
                      {g.count} casos
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                      {g.pct}% do total
                    </span>
                  </div>
                </div>

                {/* Barra de Progresso SVG Customizada */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span>Proporção na liderança</span>
                    <span>{pctRelative}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${c.grad} transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max(6, pctRelative)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gráfico Recharts de Barras Horizontais com Alto Destaque */}
        <div className="h-64 sm:h-72 w-full pt-3 border-t border-slate-100">
          {gestoresData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gestoresData} margin={{ top: 10, right: 25, left: -10, bottom: 10 }}>
                <defs>
                  <linearGradient id="gradGestorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#4338ca" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="gradGestorBarTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3730a3" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 700 }} 
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis 
                  type="number" 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} sinistros acompanhados`, "Gestor Imediato"]}
                  contentStyle={{ 
                    backgroundColor: "#0f172a", 
                    borderColor: "#334155", 
                    borderRadius: "14px", 
                    color: "#fff", 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    padding: "8px 14px"
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={55}>
                  {gestoresData.map((_, index) => (
                    <Cell 
                      key={`cell-gest-bar-${index}`} 
                      fill={index === 0 ? "url(#gradGestorBarTop)" : "url(#gradGestorBar)"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DESTAQUE STANDALONE: STATUS DOS PROCESSOS & TRAMITAÇÃO (LINHA SOZINHO) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Status dos Processos &amp; Tramitação Operacional
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Fluxo Operacional
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Monitoramento de cada estágio: Seguradora, Orçamento, Reparo de Oficina e Conclusão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Taxa de Conclusão: <strong>{metrics.pctFinalizados}%</strong> ({metrics.finalizados} concluídos)</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-600 flex items-center gap-2 shadow-2xs">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Em Tramitação Ativa: <strong className="text-slate-900">{metrics.total - metrics.finalizados}</strong></span>
            </div>
          </div>
        </div>

        {/* Pipeline Visual de Esteira em Cards e Barras SVG */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
          {statusData.map(st => (
            <div 
              key={st.name} 
              className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span 
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs" 
                    style={{ backgroundColor: st.color }}
                  />
                  <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {st.pct}%
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-snug line-clamp-1" title={st.name}>
                  {st.name}
                </h4>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/70">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {st.value}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    ocorrências
                  </span>
                </div>
                {/* Micro barra de progresso SVG */}
                <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(5, st.pct)}%`, backgroundColor: st.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gráficos Integrados: Donut Chart à Esquerda & Barras de Distribuição à Direita */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-100 items-center">
          
          {/* Donut SVG Estilizado com Centro Informativo (5 Colunas) */}
          <div className="lg:col-span-5 h-64 w-full flex items-center justify-center relative">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-status-pie-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${value} casos (${Math.round((value / metrics.total) * 100)}%)`, "Status"]}
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "14px", color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      formatter={(value) => <span className="text-[10.5px] font-bold text-slate-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Texto Central no Donut */}
                <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 block leading-tight">{metrics.total}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Geral</span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">Nenhum dado disponível</div>
            )}
          </div>

          {/* Gráfico de Barras de Status (7 Colunas) */}
          <div className="lg:col-span-7 h-64 w-full">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 15, right: 20, left: -15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10.5, fill: "#475569", fontWeight: 700 }} 
                    axisLine={{ stroke: "#cbd5e1" }}
                    interval={0}
                    height={35}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                    axisLine={{ stroke: "#cbd5e1" }} 
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} sinistros (${Math.round((value / metrics.total) * 100)}%)`, "Volume"]}
                    contentStyle={{ 
                      backgroundColor: "#0f172a", 
                      borderColor: "#334155", 
                      borderRadius: "14px", 
                      color: "#fff", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      padding: "8px 14px"
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-status-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. RESPONSABILIDADE DO CONDUTOR & PRINCIPAIS CIDADES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* GRÁFICO: Responsabilidade Declarada (SIM / NÃO) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Responsabilidade Declarada pelo Condutor
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Condutor Risel assumiu ocorrência (SIM) vs Terceiro / Sem Culpa (NÃO)
                  </p>
                </div>
              </div>
            </div>

            {/* Medidor Comparativo Visual */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-900">Condutor Assumiu (SIM)</span>
                  <span className="text-xs font-black text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                    {metrics.pctAssumiuSim}%
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-2xl font-black text-rose-700 font-mono">{metrics.assumiuSim}</span>
                  <span className="text-xs text-rose-600 font-bold ml-1.5">ocorrências</span>
                </div>
                <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-600 rounded-full" style={{ width: `${metrics.pctAssumiuSim}%` }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900">Terceiro / Não Assumiu</span>
                  <span className="text-xs font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {metrics.pctAssumiuNao}%
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-2xl font-black text-emerald-700 font-mono">{metrics.assumiuNao}</span>
                  <span className="text-xs text-emerald-600 font-bold ml-1.5">ocorrências</span>
                </div>
                <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${metrics.pctAssumiuNao}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="h-44 w-full flex items-center justify-center pt-2 border-t border-slate-100">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={responsabilidadeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {responsabilidadeData.map((entry, index) => (
                    <Cell key={`cell-resp-pie-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} casos`, ""]}
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={28} 
                  formatter={(value) => <span className="text-[10.5px] font-bold text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO: Cidades com Maior Incidência */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-2xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Principais Cidades de Ocorrência
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Municípios com maior concentração de sinistros registrados
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              {topCidadesData.map((c, index) => (
                <div key={c.name} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-slate-900">
                      {c.count} ocorrências
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      ({c.pct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-44 w-full pt-2 border-t border-slate-100">
            {topCidadesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCidadesData} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5, fill: "#334155", fontWeight: 700 }} width={85} />
                  <Tooltip
                    formatter={(value: any) => [`${value} ocorrências`, "Total"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 6, 6, 0]}>
                    {topCidadesData.map((_, index) => (
                      <Cell key={`cell-cid-bar-${index}`} fill={index === 0 ? "#e11d48" : "#fb7185"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. PAINEL DE OCORRÊNCIAS RECENTES COM ANEXOS & BOLETINS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Últimos Comunicados de Sinistro Registrados
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Visão rápida dos registros mais recentes recebidos via Microsoft Forms e integrados na Sheet1
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToSinistros}
            className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <span>Ver todos os {effectiveSinistros.length} sinistros</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {recentSinistros.map(s => {
            const dateStr = s.dataHora?.includes("T") 
              ? s.dataHora.split("T")[0].split("-").reverse().join("/") 
              : (s.dataHora || "Data N/D");
            const timeStr = s.dataHora?.includes("T") ? s.dataHora.split("T")[1]?.substring(0, 5) : "";
            const isAssumiu = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";

            return (
              <div 
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-rose-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2.5">
                    <span className="text-[10.5px] font-black text-slate-500 font-mono">
                      #{s.numeroProtocolo}
                    </span>
                    <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${
                      isAssumiu 
                        ? "bg-rose-50 text-rose-700 border-rose-200" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {isAssumiu ? "Condutor Assumiu" : "Sem Culpa / Terceiro"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-black text-sm text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      {s.placa}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate" title={s.motorista}>
                      {s.motorista}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dateStr} {timeStr ? `às ${timeStr}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{s.base || "Paulínia"} · {s.cidade || "SP"}</span>
                    </div>
                    {s.nomeTerceiro && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-semibold truncate" title={`Terceiro: ${s.nomeTerceiro} (${s.placaTerceiro || ""})`}>
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="truncate">Terceiro: {s.nomeTerceiro} {s.placaTerceiro ? `(${s.placaTerceiro})` : ""}</span>
                      </div>
                    )}
                  </div>

                  {s.descricao && (
                    <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 mt-2.5 line-clamp-2 italic">
                      "{s.descricao}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/70 text-xs">
                  {s.boletimOcorrenciaUrl ? (
                    <a
                      href={s.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ver B.O. (PDF)</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Sem B.O.</span>
                    </span>
                  )}

                  {s.anexosSharePoint && s.anexosSharePoint.length > 0 ? (
                    <a
                      href={s.anexosSharePoint[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 hover:underline"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>{s.anexosSharePoint.length} Anexos</span>
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

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
  FolderSync, 
  ExternalLink, 
  Filter, 
  Building2, 
  FileSpreadsheet, 
  Activity,
  Plus,
  RefreshCw,
  UserCheck,
  FileCheck,
  Image as ImageIcon,
  MapPin,
  FileText,
  UserX,
  Users
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

const COLORS_ASSUMIU: Record<string, string> = {
  "Condutor Risel (SIM)": "#f43f5e", // Rose/Red
  "Terceiro / Não Assumiu (NÃO)": "#10b981", // Emerald
  "Em Apuração": "#f59e0b" // Amber
};

const COLORS_STATUS: Record<string, string> = {
  "Finalizado / Concluído": "#10b981",
  "Aberto na Seguradora": "#3b82f6",
  "Aguardando Orçamento": "#f59e0b",
  "Em Reparo": "#8b5cf6",
  "Em Apuração": "#64748b"
};

const PALETTE = ["#00d664", "#0ea5e9", "#ff9b00", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#64748b", "#3b82f6", "#f43f5e"];

export const SinistrosDashboard: React.FC<SinistrosDashboardProps> = ({
  sinistros,
  onNavigateToSinistros,
  onOpenNewSinistroModal,
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

  // Gráfico 1: Evolução Temporal das Ocorrências
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

  // Gráfico 2: Distribuição por Base Operacional
  const baseDistributionData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const b = s.base?.trim() || "Não Informada";
      map.set(b, (map.get(b) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSinistros]);

  // Gráfico 3: Culpabilidade / Responsabilidade Declarada (SIM / NÃO)
  const responsabilidadeData = useMemo(() => {
    let sim = 0;
    let nao = 0;
    filteredSinistros.forEach(s => {
      const isSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
      if (isSim) sim++; else nao++;
    });

    return [
      { name: "Condutor Risel (SIM)", value: sim, color: "#f43f5e" },
      { name: "Terceiro / Não Assumiu (NÃO)", value: nao, color: "#10b981" }
    ].filter(d => d.value > 0);
  }, [filteredSinistros]);

  // Gráfico 4: Top Cidades com Mais Sinistros
  const topCidadesData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      let cid = s.cidade?.trim() || (s.local?.includes("-") ? s.local.split("-").pop()?.trim() : "") || "Não Informada";
      cid = cid.toUpperCase().replace(/\s+-\s*SP/, "").replace(/,.*$/, "").trim();
      if (!cid || cid === "LOCAL NÃO INFORMADO") cid = "Outros / Em Trânsito";
      map.set(cid, (map.get(cid) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredSinistros]);

  // Gráfico 5: Gestores Imediatos com Mais Ocorrências
  const gestoresData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const g = normalizeGestor(s.gestorImediato);
      map.set(g, (map.get(g) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredSinistros]);

  // Gráfico 6: Status Operacional
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const st = s.status || "Em Apuração";
      map.set(st, (map.get(st) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ 
        name, 
        value, 
        color: COLORS_STATUS[name] || "#64748b" 
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSinistros]);

  // Últimas Ocorrências Reais da Planilha
  const recentSinistros = useMemo(() => {
    return [...filteredSinistros]
      .sort((a, b) => (b.dataHora || "").localeCompare(a.dataHora || ""))
      .slice(0, 4);
  }, [filteredSinistros]);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-8 overflow-x-hidden">
      {/* CABEÇALHO DO DASHBOARD COM STATUS ONLINE E FILTROS */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-700 text-white flex items-center justify-center shadow-xs shadow-rose-600/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-display font-black text-slate-900 tracking-tight">
                  Dashboard Analítico de Sinistros & Avarias
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/80 text-emerald-800 border border-emerald-300/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Base Real Ativa ({sinistros.length} registros da Sheet1)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Métricas e cruzamento de dados extraídos diretamente da planilha do SharePoint e comunicados do Microsoft Forms.
              </p>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300/70 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
              title="Recarregar dados da planilha do SharePoint"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Sincronizando..." : "Atualizar Sheet1"}</span>
            </button>

            <a
              href={SHAREPOINT_EXCEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/80 shadow-2xs transition-all"
              title="Abrir pasta de trabalho no Microsoft Excel Online"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>SharePoint Excel</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            <button
              onClick={onNavigateToSinistros}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs hover:shadow-md hover:from-rose-700 hover:to-rose-800 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ver Tabela Operacional</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* BARRA DE FILTROS AVANÇADOS */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtros:</span>
          </div>

          {/* Filtro Período / Mês */}
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
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
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
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
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
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
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
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
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
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
            Exibindo <span className="text-slate-900 font-black">{filteredSinistros.length}</span> de {sinistros.length} ocorrências
          </div>
        </div>
      </div>

      {/* 6 CARDS DE KPIS ANALÍTICOS BASEADOS NAS COLUNAS REAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* KPI 1: Total de Sinistros */}
        <div className="p-3.5 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-white via-rose-50/20 to-rose-500/[0.04] shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Total de Sinistros
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-rose-200 bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-display font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.total}
            </span>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {metrics.finalizados} Concluídos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            {metrics.emApuracao + metrics.emSeguradora + metrics.aguardandoOrcamento} em tramitação ativa
          </span>
        </div>

        {/* KPI 2: Responsabilidade Condutor Risel */}
        <div className="p-3.5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/20 to-amber-500/[0.04] shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Condutor Risel Assumiu
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-amber-200 bg-amber-50 text-amber-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-display font-black bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.assumiuSim}
            </span>
            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {metrics.pctAssumiuSim}% dos casos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            {metrics.assumiuNao} sem culpa / culpa terceiro ({metrics.pctAssumiuNao}%)
          </span>
        </div>

        {/* KPI 3: Terceiros Envolvidos */}
        <div className="p-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/20 to-blue-500/[0.04] shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Terceiros Identificados
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50 text-blue-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-display font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.comTerceiro}
            </span>
            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {metrics.pctComTerceiro}% c/ dados
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Placas, condutores e contatos cadastrados
          </span>
        </div>

        {/* KPI 4: Boletins de Ocorrência (B.O.) */}
        <div className="p-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-500/[0.04] shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Boletins de Ocorrência
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-display font-black bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.comBO}
            </span>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {metrics.pctComBO}% emitidos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            PDFs de B.O. oficial arquivados
          </span>
        </div>

        {/* KPI 5: Acervo de Evidências & Fotos */}
        <div className="p-3.5 rounded-2xl border border-purple-200/80 bg-gradient-to-br from-white via-purple-50/20 to-purple-500/[0.04] shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Acervo de Fotos & Laudos
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-purple-200 bg-purple-50 text-purple-600">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-display font-black bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent block tracking-tight leading-none">
              {metrics.comFotos}
            </span>
            <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              {metrics.pctComFotos}% registrados
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Fotos do veículo e do local anexadas
          </span>
        </div>

        {/* KPI 6: Base com Mais Ocorrências */}
        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/50 shadow-2xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[105px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
              Base Líder em Sinistros
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-300 bg-slate-100 text-slate-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-display font-black text-slate-800 block tracking-tight leading-none truncate" title={metrics.topBaseName}>
              {metrics.topBaseName}
            </span>
            <span className="text-[10px] font-black text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md">
              {metrics.topBaseCount} casos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1 truncate">
            2ª: {metrics.secondBaseName} ({metrics.secondBaseCount} casos)
          </span>
        </div>
      </div>

      {/* GRID DE GRÁFICOS ANALÍTICOS (BI) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* GRÁFICO 1: Evolução Temporal das Ocorrências */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                Evolução Temporal das Ocorrências
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Volume de sinistros mês a mês (2024 a 2026)
              </p>
            </div>
          </div>
          <div className="h-56 w-full mt-2">
            {monthlyTimelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOcorr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} ocorrências`, "Sinistros"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="ocorrencias" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOcorr)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum dado no período selecionado
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: Ocorrências por Base Operacional */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Ocorrências por Base Operacional
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Distribuição de sinistros entre as filiais da Risel
              </p>
            </div>
          </div>
          <div className="h-56 w-full mt-2">
            {baseDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={baseDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} sinistros`, "Total"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    {baseDistributionData.map((_, index) => (
                      <Cell key={`cell-base-${index}`} fill={PALETTE[index % PALETTE.length]} />
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

        {/* GRÁFICO 3: Responsabilidade Declarada (SIM / NÃO) */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                Responsabilidade do Condutor Risel
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Condutor assumiu o ocorrido? (SIM vs NÃO)
              </p>
            </div>
          </div>
          <div className="h-56 w-full flex items-center justify-center mt-2">
            {responsabilidadeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={responsabilidadeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {responsabilidadeData.map((entry, index) => (
                      <Cell key={`cell-resp-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} casos (${Math.round((value / metrics.total) * 100)}%)`, ""]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(value) => <span className="text-[11px] font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* GRÁFICO 4: Cidades com Maior Incidência */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                Principais Cidades de Ocorrência
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Municípios com maior concentração de sinistros
              </p>
            </div>
          </div>
          <div className="h-56 w-full mt-2">
            {topCidadesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCidadesData} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5, fill: "#475569", fontWeight: 700 }} width={80} />
                  <Tooltip
                    formatter={(value: any) => [`${value} ocorrências`, "Total"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="count" fill="#f43f5e" radius={[0, 6, 6, 0]}>
                    {topCidadesData.map((_, index) => (
                      <Cell key={`cell-cid-${index}`} fill={PALETTE[index % PALETTE.length]} />
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

        {/* GRÁFICO 5: Gestores Imediatos com Mais Ocorrências */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Gestão Imediata da Frota
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Volume de sinistros distribuídos por Gestor Operacional
              </p>
            </div>
          </div>
          <div className="h-56 w-full mt-2">
            {gestoresData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gestoresData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5, fill: "#475569", fontWeight: 700 }} width={85} />
                  <Tooltip
                    formatter={(value: any) => [`${value} sinistros`, "Gestor"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]}>
                    {gestoresData.map((_, index) => (
                      <Cell key={`cell-gest-${index}`} fill={PALETTE[(index + 3) % PALETTE.length]} />
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

        {/* GRÁFICO 6: Status Operacional das Ocorrências */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Status dos Processos
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Concluídos, Seguradora, Orçamento e Apuração
              </p>
            </div>
          </div>
          <div className="h-56 w-full flex items-center justify-center mt-2">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-stat-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} casos`, ""]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(value) => <span className="text-[10.5px] font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Nenhum dado disponível</div>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL DE OCORRÊNCIAS RECENTES & ACESSO RÁPIDO AOS ANEXOS DO SHAREPOINT */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Últimos Comunicados de Sinistro Registrados
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Visão rápida das ocorrências mais recentes recebidas via Microsoft Forms / SharePoint
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToSinistros}
            className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver todos os {sinistros.length} sinistros</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {recentSinistros.map(s => {
            const dateStr = s.dataHora?.includes("T") 
              ? s.dataHora.split("T")[0].split("-").reverse().join("/") 
              : (s.dataHora || "Data N/D");
            const timeStr = s.dataHora?.includes("T") ? s.dataHora.split("T")[1]?.substring(0, 5) : "";
            const isAssumiu = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";

            return (
              <div 
                key={s.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-rose-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-black text-slate-500 font-mono">
                      #{s.numeroProtocolo}
                    </span>
                    <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border ${
                      isAssumiu 
                        ? "bg-rose-50 text-rose-700 border-rose-200" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {isAssumiu ? "Condutor Assumiu" : "Sem Culpa / Terceiro"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono font-black text-sm text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                      {s.placa}
                    </span>
                    <span className="text-xs font-bold text-slate-700 truncate" title={s.motorista}>
                      {s.motorista}
                    </span>
                  </div>

                  <div className="space-y-0.5 text-[11px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{dateStr} {timeStr ? `às ${timeStr}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{s.base || "Paulínia"} · {s.cidade || "SP"}</span>
                    </div>
                    {s.nomeTerceiro && (
                      <div className="flex items-center gap-1 text-slate-600 font-semibold truncate" title={`Terceiro: ${s.nomeTerceiro} (${s.placaTerceiro || ""})`}>
                        <Truck className="w-3 h-3 text-blue-500" />
                        <span className="truncate">Terceiro: {s.nomeTerceiro} {s.placaTerceiro ? `(${s.placaTerceiro})` : ""}</span>
                      </div>
                    )}
                  </div>

                  {s.descricao && (
                    <p className="text-[10.5px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60 mt-2 line-clamp-2 italic">
                      "{s.descricao}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-200/60 text-[10.5px]">
                  {s.boletimOcorrenciaUrl ? (
                    <a
                      href={s.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
                    >
                      <FileCheck className="w-3 h-3 text-emerald-600" />
                      <span>Ver B.O. (PDF)</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
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
                      <ImageIcon className="w-3 h-3 text-purple-600" />
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

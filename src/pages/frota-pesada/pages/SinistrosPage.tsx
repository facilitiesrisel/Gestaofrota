import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sinistro, GravidadeSinistro, StatusSinistro, CulpabilidadeSinistro, toTitleCase, getPrimeiroNomeGestor } from "../types";
import { SINISTROS_REAIS_OFICIAIS } from "../../../data/sinistros_reais";
import { 
  fetchSinistros, 
  saveOrUpdateSinistro, 
  deleteSinistro, 
  exportSinistrosToExcel,
  syncSinistrosOnline,
  uploadSinistrosSheet,
  fetchSinistrosConfig,
  SinistrosOnlineConfig 
} from "../services/sinistrosService";
import { 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  SlidersHorizontal, 
  ShieldAlert, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileText, 
  Calendar, 
  Truck, 
  User, 
  Building2, 
  Paperclip,
  FolderOpen,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  UserCheck,
  FileCheck,
  Image as ImageIcon,
  MapPin,
  Users,
  Activity,
  Phone,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Maximize2
} from "lucide-react";
import { MercosulPlateBadge } from "../../../components/MercosulPlateBadge";

export function getBaseColorInfo(base?: string) {
  const norm = (base || "").toUpperCase().trim();
  if (norm.includes("PAULINIA") || norm.includes("PAULÍNIA")) {
    return {
      bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
      solid: "#059669",
      from: "#00d664",
      to: "#059669",
      label: "Paulínia"
    };
  }
  if (norm.includes("BERNARDO") || norm.includes("SBC")) {
    return {
      bg: "bg-sky-50 text-sky-800 border-sky-300",
      solid: "#0284c7",
      from: "#0284c7",
      to: "#0369a1",
      label: "São Bernardo"
    };
  }
  if (norm.includes("BARUERI")) {
    return {
      bg: "bg-amber-50 text-amber-800 border-amber-300",
      solid: "#d97706",
      from: "#f59e0b",
      to: "#d97706",
      label: "Barueri"
    };
  }
  if (norm.includes("MATRIZ") || norm.includes("CAMPINAS")) {
    return {
      bg: "bg-purple-50 text-purple-800 border-purple-300",
      solid: "#7c3aed",
      from: "#8b5cf6",
      to: "#6d28d9",
      label: "Campinas / Matriz"
    };
  }
  if (norm.includes("GUARULHOS")) {
    return {
      bg: "bg-indigo-50 text-indigo-800 border-indigo-300",
      solid: "#4f46e5",
      from: "#6366f1",
      to: "#4338ca",
      label: "Guarulhos"
    };
  }
  if (norm.includes("RIBEIRAO") || norm.includes("RIBEIRÃO")) {
    return {
      bg: "bg-teal-50 text-teal-800 border-teal-300",
      solid: "#0d9488",
      from: "#14b8a6",
      to: "#0f766e",
      label: "Ribeirão Preto"
    };
  }
  if (norm.includes("SANTOS") || norm.includes("LITORAL")) {
    return {
      bg: "bg-cyan-50 text-cyan-800 border-cyan-300",
      solid: "#0891b2",
      from: "#06b6d4",
      to: "#0e7490",
      label: "Santos"
    };
  }
  return {
    bg: "bg-slate-100 text-slate-800 border-slate-300",
    solid: "#475569",
    from: "#64748b",
    to: "#334155",
    label: base || "Outras / Em Trânsito"
  };
}

const COLUMNS_DEF = [
  { id: "protocolo", label: "Nº Protocolo / Aviso", default: true },
  { id: "dataHora", label: "Data & Horário", default: true },
  { id: "placa", label: "Placa Frota (Mercosul)", default: true },
  { id: "motorista", label: "Motorista Risel", default: true },
  { id: "base", label: "Base / Filial", default: true },
  { id: "gestorImediato", label: "Gestor Imediato", default: true },
  { id: "condutorAssumiu", label: "Assumiu a Culpa?", default: true },
  { id: "terceiro", label: "Terceiro Envolvido", default: true },
  { id: "cidade", label: "Cidade / Local", default: true },
  { id: "status", label: "Status", default: true },
  { id: "boletimOcorrencia", label: "Boletim (B.O.)", default: true },
  { id: "anexos", label: "Fotos & Anexos", default: true },
  { id: "relato", label: "Relato Resumido", default: false },
  { id: "danosVeiculo", label: "Danos ao Veículo", default: false },
  { id: "enviadoPor", label: "Enviado Por (Forms)", default: false }
];

const MICROSOFT_FORMS_URL = "https://forms.cloud.microsoft/Pages/DesignPageV2.aspx?prevorigin=Marketing&origin=NeoPortalPage&subpage=design&id=--soOq0dkkmCvV864R49jTu3qwhCFQBElTcewqtXSeRUQTE2N0tGUjlEMjREQU5OUzFKN1NSR1pQWS4u";
const SHAREPOINT_EXCEL_URL = "https://riselcombustiveis-my.sharepoint.com/:x:/r/personal/deny_goncalves_risel_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B08C8A01A-45A5-4439-94F4-5F0505EDE3B3%7D&file=Comunicado%20de%20Sinistro_Frota%20Pesada.xlsx&action=default&mobileredirect=true";

export const SinistrosPage: React.FC = () => {
  const [sinistros, setSinistros] = useState<Sinistro[]>(() => SINISTROS_REAIS_OFICIAIS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [baseFilter, setBaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assumiuFilter, setAssumiuFilter] = useState("");
  const [gestorFilter, setGestorFilter] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Ordenação de colunas da lista
  const [sortField, setSortField] = useState<string>("dataHora");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Controle de visibilidade de colunas
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("risel_sinistros_visible_cols_v2");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const initial: Record<string, boolean> = {};
    COLUMNS_DEF.forEach(c => (initial[c.id] = c.default));
    return initial;
  });
  const [showColSelector, setShowColSelector] = useState(false);
  const colSelectorRef = useRef<HTMLDivElement>(null);

  // Modais
  const [viewingSinistro, setViewingSinistro] = useState<Sinistro | null>(null);
  const [editingSinistro, setEditingSinistro] = useState<Sinistro | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Carregar dados na montagem
  useEffect(() => {
    loadSinistros(true);
  }, []);


  const loadSinistros = async (showSpinner: boolean = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await fetchSinistros();
      setSinistros(data || []);
    } catch (e) {
      console.error("Erro ao carregar sinistros:", e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncSinistrosOnline();
      if (res.success) {
        setSyncFeedback(`Sincronizado: ${res.totalSinistros || sinistros.length || 73} ocorrências da aba Sheet1.`);
        await loadSinistros(false);
      } else {
        setSyncFeedback("Erro ao sincronizar com o SharePoint.");
      }
    } catch (e: any) {
      setSyncFeedback("Falha na sincronização online.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSyncing(true);
    setSyncFeedback("Importando planilha e decodificando aba Sheet1...");
    try {
      const res = await uploadSinistrosSheet(file);
      if (res.success) {
        setSyncFeedback(`Sucesso! ${res.totalSinistros} ocorrências importadas da planilha Sheet1.`);
        await loadSinistros(false);
      } else {
        setSyncFeedback(res.error || "Erro ao processar planilha.");
      }
    } catch (err: any) {
      setSyncFeedback("Falha no upload da planilha.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 6000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Salvar preferências de colunas
  useEffect(() => {
    try {
      localStorage.setItem("risel_sinistros_visible_cols_v2", JSON.stringify(visibleCols));
    } catch (e) {}
  }, [visibleCols]);

  // Fechar dropdown de colunas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colSelectorRef.current && !colSelectorRef.current.contains(e.target as Node)) {
        setShowColSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (colId: string) => {
    setVisibleCols(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  const resetColumns = () => {
    const initial: Record<string, boolean> = {};
    COLUMNS_DEF.forEach(c => (initial[c.id] = c.default));
    setVisibleCols(initial);
  };

  // Normalização de Gestores (somente primeiro nome padronizado)
  const normalizeGestor = (gestor?: string): string => {
    return getPrimeiroNomeGestor(gestor);
  };

  // Extrair bases únicas
  const availableBases = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [sinistros]);

  // Extrair gestores únicos (somente primeiro nome)
  const availableGestores = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      const g = getPrimeiroNomeGestor(s.gestorImediato);
      if (g && g !== "-") set.add(g);
    });
    return Array.from(set).sort();
  }, [sinistros]);

  // Filtragem dos sinistros
  const filteredList = useMemo(() => {
    const term = search.toLowerCase().trim();
    return sinistros.filter(s => {
      // Busca geral
      if (term) {
        const matches = 
          (s.numeroProtocolo && s.numeroProtocolo.toLowerCase().includes(term)) ||
          (s.placa && s.placa.toLowerCase().includes(term)) ||
          (s.placaCarreta && s.placaCarreta.toLowerCase().includes(term)) ||
          (s.motorista && s.motorista.toLowerCase().includes(term)) ||
          (s.base && s.base.toLowerCase().includes(term)) ||
          (s.gestorImediato && s.gestorImediato.toLowerCase().includes(term)) ||
          (s.cidade && s.cidade.toLowerCase().includes(term)) ||
          (s.local && s.local.toLowerCase().includes(term)) ||
          (s.nomeTerceiro && s.nomeTerceiro.toLowerCase().includes(term)) ||
          (s.placaTerceiro && s.placaTerceiro.toLowerCase().includes(term)) ||
          (s.descricao && s.descricao.toLowerCase().includes(term)) ||
          (s.danosVeiculo && s.danosVeiculo.toLowerCase().includes(term)) ||
          (s.enviadoPor && s.enviadoPor.toLowerCase().includes(term));

        if (!matches) return false;
      }

      // Filtro Base
      if (baseFilter && s.base?.trim().toUpperCase() !== baseFilter.toUpperCase()) return false;

      // Filtro Status
      if (statusFilter && s.status !== statusFilter) return false;

      // Filtro Condutor Assumiu
      if (assumiuFilter) {
        const assumiu = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
        if (assumiuFilter === "SIM" && !assumiu) return false;
        if (assumiuFilter === "NAO" && assumiu) return false;
      }

      // Filtro Gestor
      if (gestorFilter && normalizeGestor(s.gestorImediato) !== gestorFilter) return false;

      return true;
    }).sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortField) {
        case "protocolo":
          valA = a.numeroProtocolo || "";
          valB = b.numeroProtocolo || "";
          break;
        case "dataHora":
          valA = a.dataHora || "";
          valB = b.dataHora || "";
          break;
        case "placa":
          valA = a.placa || "";
          valB = b.placa || "";
          break;
        case "motorista":
          valA = a.motorista || "";
          valB = b.motorista || "";
          break;
        case "base":
          valA = a.base || "";
          valB = b.base || "";
          break;
        case "gestorImediato":
          valA = a.gestorImediato || "";
          valB = b.gestorImediato || "";
          break;
        case "condutorAssumiu":
          valA = (a.condutorAssumiu === "SIM" || a.culpabilidade === "Condutor Risel") ? "A" : "Z";
          valB = (b.condutorAssumiu === "SIM" || b.culpabilidade === "Condutor Risel") ? "A" : "Z";
          break;
        case "terceiro":
          valA = a.nomeTerceiro || a.placaTerceiro || "";
          valB = b.nomeTerceiro || b.placaTerceiro || "";
          break;
        case "cidade":
          valA = a.cidade || a.local || "";
          valB = b.cidade || b.local || "";
          break;
        case "status":
          valA = a.status || "";
          valB = b.status || "";
          break;
        default:
          valA = a.dataHora || "";
          valB = b.dataHora || "";
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [sinistros, search, baseFilter, statusFilter, assumiuFilter, gestorFilter, sortField, sortDirection]);

  // Exclusão de sinistro
  const handleDelete = async (id: string, placa: string) => {
    if (window.confirm(`Deseja realmente remover o registro de sinistro da placa ${placa}?`)) {
      const updated = await deleteSinistro(id);
      setSinistros(updated);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-10 flex flex-col h-full min-h-0">
      {/* BARRA DE FERRAMENTAS SUPERIOR */}
      <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Lado Esquerdo: Identificação & Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
            <div>
              <h2 className="text-base sm:text-lg font-display font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <span>Gestão Operacional de Sinistros & Avarias</span>
              </h2>
            </div>

            <div className="relative flex-1 max-w-md min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar placa, condutor, B.O., terceiro, gestor, cidade..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-semibold outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lado Direito: Ações de Sincronização, Exportação e Colunas */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300/70 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
              title="Recarregar dados da planilha do SharePoint"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>

            <button
              onClick={() => exportSinistrosToExcel(filteredList)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
              title="Exportar dados filtrados para Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar</span>
            </button>

            {/* Dropdown de Colunas Visíveis */}
            <div className="relative" ref={colSelectorRef}>
              <button
                onClick={() => setShowColSelector(!showColSelector)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer shadow-2xs ${
                  showColSelector ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50"
                }`}
                title="Configurar Colunas Visíveis"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Colunas</span>
              </button>

              {showColSelector && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800">Colunas da Tabela</span>
                    <button
                      onClick={resetColumns}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                    >
                      Padrão
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {COLUMNS_DEF.map(col => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={!!visibleCols[col.id]}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {syncFeedback && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* BARRA DE FILTROS RÁPIDOS */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtros:</span>
          </div>

          {/* Filtro Base */}
          <div className="flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={baseFilter}
              onChange={(e) => setBaseFilter(e.target.value)}
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
              value={assumiuFilter}
              onChange={(e) => setAssumiuFilter(e.target.value)}
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
              value={gestorFilter}
              onChange={(e) => setGestorFilter(e.target.value)}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

          {(baseFilter || statusFilter || assumiuFilter || gestorFilter || search) && (
            <button
              onClick={() => {
                setBaseFilter("");
                setStatusFilter("");
                setAssumiuFilter("");
                setGestorFilter("");
                setSearch("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-black hover:underline cursor-pointer ml-1"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-xs font-bold text-slate-500">
            Total filtrado: <span className="text-slate-900 font-black">{filteredList.length}</span> de {sinistros.length}
          </div>
        </div>
      </div>

      {/* TABELA OPERACIONAL DE SINISTROS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-[500px]">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20 bg-gradient-to-r from-[#114D38] via-[#1a5d44] to-[#114D38] text-white border-b border-[#0d3b2c] shadow-xs select-none">
              <tr className="text-[10.5px] font-black uppercase tracking-wider">
                {/* Ações à Esquerda */}
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-24">
                  Ações
                </th>
                {visibleCols.protocolo && (
                  <th 
                    onClick={() => handleSort("protocolo")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Protocolo"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Protocolo / Aviso</span>
                      {sortField === "protocolo" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.dataHora && (
                  <th 
                    onClick={() => handleSort("dataHora")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Data"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Data & Horário</span>
                      {sortField === "dataHora" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.placa && (
                  <th 
                    onClick={() => handleSort("placa")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Placa"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Placa Frota (Mercosul)</span>
                      {sortField === "placa" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.motorista && (
                  <th 
                    onClick={() => handleSort("motorista")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Motorista"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Motorista Risel</span>
                      {sortField === "motorista" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.base && (
                  <th 
                    onClick={() => handleSort("base")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Base"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Base Operacional</span>
                      {sortField === "base" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.gestorImediato && (
                  <th 
                    onClick={() => handleSort("gestorImediato")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Gestor"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Gestor Imediato</span>
                      {sortField === "gestorImediato" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.condutorAssumiu && (
                  <th 
                    onClick={() => handleSort("condutorAssumiu")}
                    className="py-2.5 px-3 text-center cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para ordenar por Assumiu Culpa"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Assumiu a Culpa?</span>
                      {sortField === "condutorAssumiu" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.terceiro && (
                  <th 
                    onClick={() => handleSort("terceiro")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Terceiro Envolvido</span>
                      {sortField === "terceiro" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.cidade && (
                  <th 
                    onClick={() => handleSort("cidade")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Cidade / Local</span>
                      {sortField === "cidade" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.status && (
                  <th 
                    onClick={() => handleSort("status")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {sortField === "status" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-amber-300" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-emerald-200/60" />
                      )}
                    </div>
                  </th>
                )}
                {visibleCols.boletimOcorrencia && <th className="py-2.5 px-3 text-center">B.O.</th>}
                {visibleCols.anexos && <th className="py-2.5 px-3 text-center">Fotos / Anexos</th>}
                {visibleCols.relato && <th className="py-2.5 px-3">Relato</th>}
                {visibleCols.danosVeiculo && <th className="py-2.5 px-3">Danos</th>}
                {visibleCols.enviadoPor && <th className="py-2.5 px-3">Enviado Por</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] leading-tight font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
                      <span className="font-bold text-slate-600 text-xs">Sincronizando registros da planilha...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="w-9 h-9 text-slate-300" />
                      <span className="font-bold text-slate-600 text-xs">Nenhum sinistro encontrado para os filtros aplicados.</span>
                      <span className="text-[10px] text-slate-400">Verifique os termos de busca ou limpe os filtros.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((s, idx) => {
                  const dateFormatted = s.dataHora?.includes("T") 
                    ? s.dataHora.split("T")[0].split("-").reverse().join("/") 
                    : (s.dataHora || "-");
                  const timeFormatted = s.dataHora?.includes("T") ? s.dataHora.split("T")[1]?.substring(0, 5) : "";
                  const isAssumiu = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
                  const baseColor = getBaseColorInfo(s.base);

                  return (
                    <tr 
                      key={s.id || idx}
                      className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                      onClick={() => setViewingSinistro(s)}
                    >
                      {/* Ações (à esquerda) */}
                      <td className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingSinistro(s)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all shadow-2xs cursor-pointer"
                            title="Visualizar Ocorrência e Fotos"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSinistro(s)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 transition-all cursor-pointer"
                            title="Editar Ocorrência"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.placa)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Protocolo */}
                      {visibleCols.protocolo && (
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          <span className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-200 text-[10.5px] text-slate-800 group-hover:border-emerald-300 transition-colors shadow-2xs">
                            #{s.numeroProtocolo}
                          </span>
                        </td>
                      )}

                      {/* Data & Horário */}
                      {visibleCols.dataHora && (
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-semibold text-[11px]">
                          <div>{dateFormatted}</div>
                          {timeFormatted && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{timeFormatted}</div>}
                        </td>
                      )}

                      {/* Placa Frota (Mercosul) */}
                      {visibleCols.placa && (
                        <td className="py-2 px-3 whitespace-nowrap">
                          <MercosulPlateBadge plate={s.placa} size="sm" />
                        </td>
                      )}

                      {/* Motorista Risel (Título / Primeira Letra Maiúscula) */}
                      {visibleCols.motorista && (
                        <td className="py-2 px-3 font-bold text-slate-900 text-[11px]">
                          <div className="flex items-center gap-1.5 max-w-[200px] truncate" title={s.motorista}>
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{toTitleCase(s.motorista)}</span>
                          </div>
                        </td>
                      )}

                      {/* Base Operacional com Cores Diferentes */}
                      {visibleCols.base && (
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${baseColor.bg}`}>
                            <Building2 className="w-3 h-3 opacity-70" />
                            {toTitleCase(s.base || "Paulínia")}
                          </span>
                        </td>
                      )}

                      {/* Gestor Imediato (Somente Primeiro Nome) */}
                      {visibleCols.gestorImediato && (
                        <td className="py-2 px-3 text-[11px] font-bold text-slate-800 whitespace-nowrap" title={s.gestorImediato}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                            {getPrimeiroNomeGestor(s.gestorImediato)}
                          </span>
                        </td>
                      )}

                      {/* Assumiu a Culpa? (Exclusivamente SIM ou NÃO) */}
                      {visibleCols.condutorAssumiu && (
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-black border tracking-wider shadow-2xs ${
                            isAssumiu 
                              ? "bg-rose-50 text-rose-700 border-rose-300 font-bold" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                          }`}>
                            {isAssumiu ? "SIM" : "NÃO"}
                          </span>
                        </td>
                      )}

                      {/* Terceiro Envolvido (Título / Primeira Letra Maiúscula) */}
                      {visibleCols.terceiro && (
                        <td className="py-2 px-3 text-[11px] text-slate-700 max-w-[200px]">
                          {s.nomeTerceiro || s.placaTerceiro ? (
                            <div className="truncate" title={`Condutor: ${s.nomeTerceiro || 'N/D'} | Placa: ${s.placaTerceiro || 'N/D'} | Tel: ${s.contatoTerceiro || 'N/D'}`}>
                              <span className="font-bold text-slate-900">{toTitleCase(s.nomeTerceiro || "Terceiro")}</span>
                              {s.placaTerceiro && (
                                <span className="ml-1 text-[10px] font-mono text-blue-700 font-black bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                  {s.placaTerceiro.toUpperCase()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Sem terceiro</span>
                          )}
                        </td>
                      )}

                      {/* Cidade / Local (Título / Primeira Letra Maiúscula) */}
                      {visibleCols.cidade && (
                        <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[180px] truncate" title={s.local || s.cidade}>
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{toTitleCase(s.cidade || s.local || "N/D")}</span>
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      {visibleCols.status && (
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            s.status === "Finalizado / Concluído"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : s.status === "Aberto na Seguradora"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : s.status === "Aguardando Orçamento"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {s.status || "Em Apuração"}
                          </span>
                        </td>
                      )}

                      {/* B.O. */}
                      {visibleCols.boletimOcorrencia && (
                        <td className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {s.boletimOcorrenciaUrl ? (
                            <a
                              href={s.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black transition-all shadow-2xs"
                              title="Abrir PDF do B.O. no SharePoint"
                            >
                              <FileCheck className="w-3 h-3 text-emerald-600" />
                              <span>B.O.</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Anexos / Fotos */}
                      {visibleCols.anexos && (
                        <td className="py-2 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {s.anexosSharePoint && s.anexosSharePoint.length > 0 ? (
                            <button
                              onClick={() => setViewingSinistro(s)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-black transition-all cursor-pointer shadow-2xs"
                              title={`Visualizar ${s.anexosSharePoint.length} fotos registradas`}
                            >
                              <ImageIcon className="w-3 h-3 text-purple-600" />
                              <span>{s.anexosSharePoint.length} fotos</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Relato */}
                      {visibleCols.relato && (
                        <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[220px] truncate" title={s.descricao}>
                          {toTitleCase(s.descricao) || "-"}
                        </td>
                      )}

                      {/* Danos */}
                      {visibleCols.danosVeiculo && (
                        <td className="py-2 px-3 text-[11px] text-slate-600 max-w-[170px] truncate" title={s.danosVeiculo}>
                          {toTitleCase(s.danosVeiculo) || "-"}
                        </td>
                      )}

                      {/* Enviado Por */}
                      {visibleCols.enviadoPor && (
                        <td className="py-2 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {toTitleCase(s.enviadoPor) || "-"}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO ELEGANTE COM FOTOS */}
      {viewingSinistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Header Verde Gradiente Premium */}
            <div className="p-5 sm:p-6 border-b border-[#0d3b2c] bg-gradient-to-r from-[#114D38] via-[#1a5d44] to-[#114D38] text-white rounded-t-3xl sticky top-0 z-10 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                    <ShieldAlert className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-black tracking-tight text-white">
                        Sinistro #{viewingSinistro.numeroProtocolo}
                      </h3>
                      <MercosulPlateBadge plate={viewingSinistro.placa} size="sm" />
                      <span className={`text-[10.5px] font-black px-3 py-0.5 rounded-full border shadow-2xs ${
                        viewingSinistro.condutorAssumiu === "SIM" || viewingSinistro.culpabilidade === "Condutor Risel"
                          ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
                          : "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                      }`}>
                        {viewingSinistro.condutorAssumiu === "SIM" || viewingSinistro.culpabilidade === "Condutor Risel"
                          ? "Assumiu Culpa: SIM"
                          : "Assumiu Culpa: NÃO"}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/80 font-medium mt-1">
                      {viewingSinistro.motorista} &bull; Base {viewingSinistro.base || "Paulínia"} &bull; {viewingSinistro.dataHora?.replace("T", " às ")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingSinistro(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo Elegante do Modal */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Grid 1: Informações Principais com Cores por Base */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Condutor Risel</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-black text-slate-800 truncate" title={viewingSinistro.motorista}>{viewingSinistro.motorista}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Gestor Imediato</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-black text-slate-800 truncate">{viewingSinistro.gestorImediato || "Não informado"}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Base Operacional</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-md border ${getBaseColorInfo(viewingSinistro.base).bg}`}>
                      <Building2 className="w-3 h-3 opacity-70" />
                      {viewingSinistro.base || "Paulínia"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Status Operacional</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-black border ${
                      viewingSinistro.status === "Finalizado / Concluído"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : viewingSinistro.status === "Aberto na Seguradora"
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : viewingSinistro.status === "Aguardando Orçamento"
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      {viewingSinistro.status || "Em Apuração"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Seção: Terceiro Envolvido */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    Dados do Terceiro Envolvido
                  </h4>
                  {viewingSinistro.placaTerceiro && (
                    <MercosulPlateBadge plate={viewingSinistro.placaTerceiro} size="sm" />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-700">Nome do Condutor / Proprietário:</span>
                    <p className="text-xs font-black text-slate-800 mt-0.5">{viewingSinistro.nomeTerceiro || "Sem terceiro envolvido"}</p>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-700">Placa do Veículo Terceiro:</span>
                    <p className="text-xs font-mono font-black text-slate-800 mt-0.5">{viewingSinistro.placaTerceiro || "N/D"}</p>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-700">Contato / Telefone:</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      {viewingSinistro.contatoTerceiro || "Não informado"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção: Relato e Dinâmica do Ocorrido */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2.5">
                  <FileText className="w-4 h-4 text-rose-600" />
                  Relato do Ocorrido & Dinâmica do Acidente
                </h4>
                <div className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs whitespace-pre-wrap">
                  {viewingSinistro.descricao || "Sem relato detalhado registrado pelo condutor."}
                </div>

                {viewingSinistro.danosVeiculo && (
                  <div className="mt-3">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Avarias & Danos Constatados:
                    </span>
                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      {viewingSinistro.danosVeiculo}
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Galeria de Fotos e Evidências com Visualização Elegante */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    Fotos do Sinistro & Documentação Anexa
                  </h4>
                  {viewingSinistro.anexosSharePoint && viewingSinistro.anexosSharePoint.length > 0 && (
                    <span className="text-[10.5px] font-black text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-300">
                      {viewingSinistro.anexosSharePoint.length} arquivos disponíveis
                    </span>
                  )}
                </div>

                {/* Grade de Miniaturas de Fotos com Zoom */}
                {viewingSinistro.anexosSharePoint && viewingSinistro.anexosSharePoint.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                    {viewingSinistro.anexosSharePoint.map((fotoUrl, fIdx) => {
                      const isVideo = fotoUrl.toLowerCase().includes(".mp4");
                      return (
                        <div 
                          key={fIdx}
                          onClick={() => setPreviewImage(fotoUrl)}
                          className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-2xs hover:shadow-md transition-all cursor-pointer hover:border-purple-400"
                        >
                          {isVideo ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white bg-slate-800 p-2 text-center">
                              <span className="text-xs font-black">Vídeo do Ocorrido</span>
                              <span className="text-[9.5px] text-slate-300 mt-1">Clique para abrir</span>
                            </div>
                          ) : (
                            <img 
                              src={fotoUrl} 
                              alt={`Foto ${fIdx + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                // Fallback visual se for link de autenticação restrita do SharePoint
                                (e.currentTarget.parentElement as HTMLElement).innerHTML = `
                                  <div class="w-full h-full flex flex-col items-center justify-center text-purple-700 bg-purple-50 p-2 text-center">
                                    <span class="text-xs font-black">Foto #${fIdx + 1}</span>
                                    <span class="text-[9px] text-purple-600 mt-0.5">Abrir no SharePoint</span>
                                  </div>
                                `;
                              }}
                            />
                          )}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Maximize2 className="w-5 h-5 drop-shadow-md" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-400 font-medium mb-3">
                    Nenhuma foto anexada diretamente neste registro.
                  </div>
                )}

                {/* Links de Documentos Oficiais (B.O., CNH, CRLVs) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                  {viewingSinistro.boletimOcorrenciaUrl && (
                    <a
                      href={viewingSinistro.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Boletim de Ocorrência (PDF)</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.cnhMotorista && (
                    <a
                      href={viewingSinistro.sharepointLinks.cnhMotorista}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-blue-800 flex items-center justify-between transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">CNH Motorista Risel</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.docVeiculoFrota && (
                    <a
                      href={viewingSinistro.sharepointLinks.docVeiculoFrota}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-blue-800 flex items-center justify-between transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">CRLV Veículo Frota</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.docVeiculoTerceiro && (
                    <a
                      href={viewingSinistro.sharepointLinks.docVeiculoTerceiro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-indigo-800 flex items-center justify-between transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">CRLV Terceiro</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.declaracao && (
                    <a
                      href={viewingSinistro.sharepointLinks.declaracao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-xs font-bold text-amber-800 flex items-center justify-between transition-all shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">Declaração de Punho</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-3xl">
              <span className="text-xs text-slate-400 font-medium">
                ID do Registro: {viewingSinistro.id}
              </span>
              <button
                onClick={() => setViewingSinistro(null)}
                className="px-5 py-2.5 rounded-xl bg-[#114D38] hover:bg-[#0d3b2c] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX / ZOOM DE FOTO EM TELA CHEIA */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img 
              src={previewImage} 
              alt="Evidência ampliada" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="mt-3 px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Fechar Zoom</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO OPERACIONAL */}
      {editingSinistro && (
        <SinistroEditModal
          sinistro={editingSinistro}
          onClose={() => setEditingSinistro(null)}
          onSave={async (saved) => {
            const updated = await saveOrUpdateSinistro(saved);
            setSinistros(updated);
            setEditingSinistro(null);
          }}
        />
      )}
    </div>
  );
};

// Componente de Edição Operacional
interface SinistroEditModalProps {
  sinistro: Sinistro;
  onClose: () => void;
  onSave: (sinistro: Sinistro) => Promise<void>;
}

const SinistroEditModal: React.FC<SinistroEditModalProps> = ({ sinistro, onClose, onSave }) => {
  const [formData, setFormData] = useState<Sinistro>({ ...sinistro });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Editar Ocorrência #{sinistro.numeroProtocolo}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Atualize o status da seguradora, oficina ou observações da frota
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Status Operacional</label>
            <select
              value={formData.status || "Em Apuração"}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusSinistro })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-emerald-600 bg-white"
            >
              <option value="Finalizado / Concluído">Finalizado / Concluído</option>
              <option value="Aberto na Seguradora">Aberto na Seguradora</option>
              <option value="Aguardando Orçamento">Aguardando Orçamento</option>
              <option value="Em Reparo">Em Reparo</option>
              <option value="Em Apuração">Em Apuração</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Gestor Imediato</label>
            <input
              type="text"
              value={formData.gestorImediato || ""}
              onChange={(e) => setFormData({ ...formData, gestorImediato: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Relato & Observações de Tramitação</label>
            <textarea
              value={formData.descricao || ""}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-emerald-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#114D38] hover:bg-[#0d3b2c] text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

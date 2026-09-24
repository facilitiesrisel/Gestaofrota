import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sinistro, GravidadeSinistro, StatusSinistro, CulpabilidadeSinistro } from "../types";
import { SINISTROS_REAIS_OFICIAIS } from "../../../data/sinistros_reais";
import { 
  fetchSinistros, 
  saveOrUpdateSinistro, 
  deleteSinistro, 
  exportSinistrosToExcel,
  syncSinistrosOnline,
  fetchSinistrosConfig,
  SinistrosOnlineConfig 
} from "../services/sinistrosService";
import { 
  Search, 
  Filter, 
  Plus, 
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
  Info
} from "lucide-react";

const COLUMNS_DEF = [
  { id: "protocolo", label: "Nº Protocolo / Aviso", default: true },
  { id: "dataHora", label: "Data & Horário", default: true },
  { id: "placa", label: "Placa Frota (Cavalo)", default: true },
  { id: "motorista", label: "Motorista Risel", default: true },
  { id: "base", label: "Base / Filial", default: true },
  { id: "gestorImediato", label: "Gestor Imediato", default: true },
  { id: "condutorAssumiu", label: "Condutor Assumiu?", default: true },
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
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Carregar dados na montagem e sincronizar a cada 25 segundos
  useEffect(() => {
    loadSinistros();
    const timer = setInterval(() => {
      loadSinistros();
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  const loadSinistros = async () => {
    setLoading(true);
    try {
      const data = await fetchSinistros();
      setSinistros(data || []);
    } catch (e) {
      console.error("Erro ao carregar sinistros:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncSinistrosOnline();
      if (res.success) {
        setSyncFeedback(`Sincronizado: ${res.totalSinistros || 72} ocorrências atualizadas da planilha Sheet1.`);
        await loadSinistros();
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

  // Normalização de Gestores
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

  // Extrair bases únicas
  const availableBases = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [sinistros]);

  // Extrair gestores únicos
  const availableGestores = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      const g = normalizeGestor(s.gestorImediato);
      if (g && g !== "Não Informado") set.add(g);
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
    });
  }, [sinistros, search, baseFilter, statusFilter, assumiuFilter, gestorFilter]);

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
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Base Real Ativa ({sinistros.length} registros da Sheet1)
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">&bull;</span>
                <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">Comunicado de Sinistro_Frota Pesada.xlsx</span>
              </div>
              <h2 className="text-base sm:text-lg font-display font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
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

          {/* Lado Direito: Ações de Sincronização, Exportação e Formulário */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualSync}
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
              title="Abrir planilha no Microsoft SharePoint / Excel Online"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>SharePoint Excel</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            <a
              href={MICROSOFT_FORMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-blue-50 hover:bg-blue-100/80 text-blue-700 border border-blue-200/80 shadow-2xs transition-all"
              title="Abrir formulário de comunicado de sinistro"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Forms Oficial</span>
            </a>

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

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs hover:shadow-md hover:from-rose-700 hover:to-rose-800 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Sinistro</span>
            </button>
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 z-10">
              <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                {visibleCols.protocolo && <th className="py-3 px-3.5">Protocolo / Aviso</th>}
                {visibleCols.dataHora && <th className="py-3 px-3.5">Data & Horário</th>}
                {visibleCols.placa && <th className="py-3 px-3.5">Placa Frota</th>}
                {visibleCols.motorista && <th className="py-3 px-3.5">Motorista Risel</th>}
                {visibleCols.base && <th className="py-3 px-3.5">Base</th>}
                {visibleCols.gestorImediato && <th className="py-3 px-3.5">Gestor</th>}
                {visibleCols.condutorAssumiu && <th className="py-3 px-3.5 text-center">Assumiu Culpa?</th>}
                {visibleCols.terceiro && <th className="py-3 px-3.5">Terceiro Envolvido</th>}
                {visibleCols.cidade && <th className="py-3 px-3.5">Cidade / Local</th>}
                {visibleCols.status && <th className="py-3 px-3.5">Status</th>}
                {visibleCols.boletimOcorrencia && <th className="py-3 px-3.5 text-center">B.O.</th>}
                {visibleCols.anexos && <th className="py-3 px-3.5 text-center">Fotos / Anexos</th>}
                {visibleCols.relato && <th className="py-3 px-3.5">Relato</th>}
                {visibleCols.danosVeiculo && <th className="py-3 px-3.5">Danos</th>}
                {visibleCols.enviadoPor && <th className="py-3 px-3.5">Enviado Por</th>}
                <th className="py-3 px-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                      <span className="font-bold">Carregando sinistros da planilha...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ShieldAlert className="w-8 h-8 text-slate-300" />
                      <span className="font-bold text-slate-600">Nenhum sinistro encontrado para os filtros aplicados.</span>
                      <span className="text-xs text-slate-400">Verifique os termos de busca ou limpe os filtros.</span>
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

                  return (
                    <tr 
                      key={s.id || idx}
                      className="hover:bg-rose-50/30 transition-colors group cursor-pointer"
                      onClick={() => setViewingSinistro(s)}
                    >
                      {/* Protocolo */}
                      {visibleCols.protocolo && (
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          <span className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] text-slate-800 group-hover:border-rose-300 transition-colors">
                            #{s.numeroProtocolo}
                          </span>
                        </td>
                      )}

                      {/* Data & Horário */}
                      {visibleCols.dataHora && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 font-semibold text-[11.5px]">
                          <div>{dateFormatted}</div>
                          {timeFormatted && <div className="text-[10px] text-slate-400 font-mono">{timeFormatted}</div>}
                        </td>
                      )}

                      {/* Placa Frota */}
                      {visibleCols.placa && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span className="font-mono font-black text-slate-900 bg-slate-50 border border-slate-200/90 px-2 py-0.5 rounded-md shadow-2xs group-hover:border-rose-300">
                            {s.placa}
                          </span>
                        </td>
                      )}

                      {/* Motorista Risel */}
                      {visibleCols.motorista && (
                        <td className="py-2.5 px-3.5 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5 max-w-[200px] truncate" title={s.motorista}>
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{s.motorista}</span>
                          </div>
                        </td>
                      )}

                      {/* Base */}
                      {visibleCols.base && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {s.base || "Paulínia"}
                          </span>
                        </td>
                      )}

                      {/* Gestor */}
                      {visibleCols.gestorImediato && (
                        <td className="py-2.5 px-3.5 text-[11.5px] font-semibold text-slate-600 max-w-[150px] truncate" title={s.gestorImediato}>
                          {s.gestorImediato || "-"}
                        </td>
                      )}

                      {/* Condutor Assumiu? */}
                      {visibleCols.condutorAssumiu && (
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border ${
                            isAssumiu 
                              ? "bg-rose-50 text-rose-700 border-rose-200" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isAssumiu ? "bg-rose-500" : "bg-emerald-500"}`} />
                            {isAssumiu ? "SIM (Assumiu)" : "NÃO (Terceiro)"}
                          </span>
                        </td>
                      )}

                      {/* Terceiro Envolvido */}
                      {visibleCols.terceiro && (
                        <td className="py-2.5 px-3.5 text-[11.5px] text-slate-700 max-w-[190px]">
                          {s.nomeTerceiro || s.placaTerceiro ? (
                            <div className="truncate" title={`Condutor: ${s.nomeTerceiro || 'N/D'} | Placa: ${s.placaTerceiro || 'N/D'} | Tel: ${s.contatoTerceiro || 'N/D'}`}>
                              <span className="font-bold text-slate-800">{s.nomeTerceiro || "Terceiro"}</span>
                              {s.placaTerceiro && (
                                <span className="ml-1 text-[10.5px] font-mono text-blue-700 font-black bg-blue-50 px-1 py-0.2 rounded border border-blue-200/60">
                                  {s.placaTerceiro}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sem terceiro</span>
                          )}
                        </td>
                      )}

                      {/* Cidade / Local */}
                      {visibleCols.cidade && (
                        <td className="py-2.5 px-3.5 text-[11px] text-slate-600 max-w-[160px] truncate" title={s.local || s.cidade}>
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{s.cidade || s.local || "N/D"}</span>
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      {visibleCols.status && (
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
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
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {s.boletimOcorrenciaUrl ? (
                            <a
                              href={s.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black transition-colors"
                              title="Abrir PDF do B.O. no SharePoint"
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>B.O.</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Anexos / Fotos */}
                      {visibleCols.anexos && (
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {s.anexosSharePoint && s.anexosSharePoint.length > 0 ? (
                            <a
                              href={s.anexosSharePoint[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black transition-colors"
                              title={`Abrir fotos (${s.anexosSharePoint.length} anexos)`}
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>{s.anexosSharePoint.length} fotos</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Relato */}
                      {visibleCols.relato && (
                        <td className="py-2.5 px-3.5 text-[11px] text-slate-500 max-w-[200px] truncate" title={s.descricao}>
                          {s.descricao || "-"}
                        </td>
                      )}

                      {/* Danos */}
                      {visibleCols.danosVeiculo && (
                        <td className="py-2.5 px-3.5 text-[11px] text-slate-500 max-w-[150px] truncate" title={s.danosVeiculo}>
                          {s.danosVeiculo || "-"}
                        </td>
                      )}

                      {/* Enviado Por */}
                      {visibleCols.enviadoPor && (
                        <td className="py-2.5 px-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                          {s.enviadoPor || "-"}
                        </td>
                      )}

                      {/* Ações */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingSinistro(s)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                            title="Ver Detalhes Completos"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSinistro(s)}
                            className="p-1 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                            title="Editar Ocorrência"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.placa)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                            title="Excluir"
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
        </div>

        {/* Rodapé da Tabela */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-500">
          <div>
            Mostrando <span className="text-slate-800 font-black">{filteredList.length}</span> de <span className="text-slate-800 font-black">{sinistros.length}</span> registros importados da planilha
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sincronização SharePoint Ativa
            </span>
          </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO COMPLETA DO SINISTRO */}
      {viewingSinistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Header do Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-3xl sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900">
                      Sinistro #{viewingSinistro.numeroProtocolo}
                    </h3>
                    <span className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {viewingSinistro.placa}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      viewingSinistro.condutorAssumiu === "SIM" || viewingSinistro.culpabilidade === "Condutor Risel"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {viewingSinistro.condutorAssumiu === "SIM" || viewingSinistro.culpabilidade === "Condutor Risel"
                        ? "Condutor Risel Assumiu"
                        : "Sem Culpa / Terceiro"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {viewingSinistro.motorista} &bull; Base {viewingSinistro.base} &bull; {viewingSinistro.dataHora?.replace("T", " às ")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingSinistro(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-5">
              {/* Grid 1: Informações Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Condutor Risel</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.motorista}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Gestor Imediato</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.gestorImediato || "Não informado"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Base Operacional</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.base}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Localidade</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.cidade || viewingSinistro.local || "N/D"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Status do Caso</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.status || "Em Apuração"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Enviado Por (Forms)</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">{viewingSinistro.enviadoPor || "Forms Risel"}</span>
                </div>
              </div>

              {/* Seção: Dados do Terceiro Envolvido */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 mb-2.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  Dados do Terceiro Envolvido
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-600">Nome do Condutor / Proprietário:</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{viewingSinistro.nomeTerceiro || "Não informado"}</p>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-600">Placa do Veículo Terceiro:</span>
                    <p className="text-xs font-mono font-black text-slate-800 mt-0.5">{viewingSinistro.placaTerceiro || "Não informada"}</p>
                  </div>
                  <div>
                    <span className="text-[10.5px] font-bold text-blue-600">Contato / Telefone:</span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {viewingSinistro.contatoTerceiro || "Não informado"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção: Relato e Dinâmica do Ocorrido */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-rose-600" />
                  Relato do Ocorrido & Dinâmica
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200/60 whitespace-pre-wrap">
                  {viewingSinistro.descricao || "Sem relato detalhado registrado."}
                </p>

                {viewingSinistro.danosVeiculo && (
                  <div className="mt-3">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                      Danos ao Veículo (Resumido):
                    </span>
                    <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/60">
                      {viewingSinistro.danosVeiculo}
                    </p>
                  </div>
                )}
              </div>

              {/* Seção: Anexos e Links do SharePoint */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  Documentos & Evidências no SharePoint
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {viewingSinistro.boletimOcorrenciaUrl && (
                    <a
                      href={viewingSinistro.boletimOcorrenciaUrl.split(";")[0]?.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-bold text-emerald-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Boletim de Ocorrência</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.cnhMotorista && (
                    <a
                      href={viewingSinistro.sharepointLinks.cnhMotorista}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-blue-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        <span>CNH Motorista Risel</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.docVeiculoFrota && (
                    <a
                      href={viewingSinistro.sharepointLinks.docVeiculoFrota}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs font-bold text-blue-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>CRLV Veículo Frota</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.docVeiculoTerceiro && (
                    <a
                      href={viewingSinistro.sharepointLinks.docVeiculoTerceiro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-indigo-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-600" />
                        <span>CRLV Terceiro</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.cnhTerceiro && (
                    <a
                      href={viewingSinistro.sharepointLinks.cnhTerceiro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-indigo-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-600" />
                        <span>CNH Terceiro</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.avisoSinistro && (
                    <a
                      href={viewingSinistro.sharepointLinks.avisoSinistro}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-xs font-bold text-amber-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>Aviso de Sinistro</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.sharepointLinks?.declaracao && (
                    <a
                      href={viewingSinistro.sharepointLinks.declaracao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-xs font-bold text-amber-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>Declaração de Punho</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  {viewingSinistro.anexosSharePoint && viewingSinistro.anexosSharePoint.length > 0 && (
                    <a
                      href={viewingSinistro.anexosSharePoint[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs font-bold text-purple-800 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        <span>Fotos ({viewingSinistro.anexosSharePoint.length} arquivos)</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-b-3xl">
              <span className="text-xs text-slate-400 font-medium">
                ID do Registro: {viewingSinistro.id}
              </span>
              <button
                onClick={() => setViewingSinistro(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO SINISTRO / EDIÇÃO */}
      {(isNewModalOpen || editingSinistro) && (
        <SinistroFormModal
          sinistro={editingSinistro}
          onClose={() => {
            setIsNewModalOpen(false);
            setEditingSinistro(null);
          }}
          onSave={async (saved) => {
            const updated = await saveOrUpdateSinistro(saved);
            setSinistros(updated);
            setIsNewModalOpen(false);
            setEditingSinistro(null);
          }}
        />
      )}
    </div>
  );
};

// Componente de Modal de Formulário
interface SinistroFormModalProps {
  sinistro: Sinistro | null;
  onClose: () => void;
  onSave: (sinistro: Sinistro) => Promise<void>;
}

const SinistroFormModal: React.FC<SinistroFormModalProps> = ({ sinistro, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Sinistro>>(() => {
    if (sinistro) return { ...sinistro };
    return {
      id: `sin_manual_${Date.now()}`,
      numeroProtocolo: `SIN-${Date.now().toString().slice(-6)}`,
      dataHora: new Date().toISOString().substring(0, 16),
      placa: "",
      motorista: "",
      base: "Paulínia",
      gestorImediato: "",
      condutorAssumiu: "SIM",
      culpabilidade: "Condutor Risel",
      status: "Em Apuração",
      gravidade: "Média",
      tipoEvento: "Colisão",
      cidade: "",
      local: "",
      descricao: "",
      nomeTerceiro: "",
      placaTerceiro: "",
      contatoTerceiro: "",
      origem: "Lançamento Manual"
    };
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa || !formData.motorista) {
      alert("Por favor, preencha a placa do veículo e o nome do motorista.");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData as Sinistro);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {sinistro ? "Editar Sinistro" : "Novo Registro de Sinistro"}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {sinistro ? `Atualizar dados da ocorrência #${sinistro.numeroProtocolo}` : "Preencha as informações do comunicado operacional"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Nº Protocolo</label>
              <input
                type="text"
                value={formData.numeroProtocolo || ""}
                onChange={(e) => setFormData({ ...formData, numeroProtocolo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Placa Frota (Cavalo) *</label>
              <input
                type="text"
                value={formData.placa || ""}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                placeholder="Ex: JCJ3B72"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-rose-500 uppercase"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Data & Hora *</label>
              <input
                type="datetime-local"
                value={formData.dataHora || ""}
                onChange={(e) => setFormData({ ...formData, dataHora: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Motorista Risel *</label>
              <input
                type="text"
                value={formData.motorista || ""}
                onChange={(e) => setFormData({ ...formData, motorista: e.target.value })}
                placeholder="Nome completo"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Base / Filial</label>
              <input
                type="text"
                value={formData.base || ""}
                onChange={(e) => setFormData({ ...formData, base: e.target.value })}
                placeholder="Ex: Paulínia"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Gestor Imediato</label>
              <input
                type="text"
                value={formData.gestorImediato || ""}
                onChange={(e) => setFormData({ ...formData, gestorImediato: e.target.value })}
                placeholder="Ex: Michel de Moraes"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Condutor Risel Assumiu?</label>
              <select
                value={formData.condutorAssumiu || "SIM"}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  condutorAssumiu: e.target.value,
                  culpabilidade: e.target.value === "SIM" ? "Condutor Risel" : "Terceiro"
                })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500 bg-white"
              >
                <option value="SIM">SIM (Condutor Risel)</option>
                <option value="NÃO">NÃO (Terceiro / Sem Culpa)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Status</label>
              <select
                value={formData.status || "Em Apuração"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusSinistro })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500 bg-white"
              >
                <option value="Finalizado / Concluído">Finalizado / Concluído</option>
                <option value="Aberto na Seguradora">Aberto na Seguradora</option>
                <option value="Aguardando Orçamento">Aguardando Orçamento</option>
                <option value="Em Reparo">Em Reparo</option>
                <option value="Em Apuração">Em Apuração</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Cidade / Localidade</label>
              <input
                type="text"
                value={formData.cidade || ""}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="Ex: São Paulo - SP"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Nome do Terceiro</label>
              <input
                type="text"
                value={formData.nomeTerceiro || ""}
                onChange={(e) => setFormData({ ...formData, nomeTerceiro: e.target.value })}
                placeholder="Condutor / Proprietário"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-rose-500 bg-white"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Placa do Terceiro</label>
              <input
                type="text"
                value={formData.placaTerceiro || ""}
                onChange={(e) => setFormData({ ...formData, placaTerceiro: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                placeholder="Ex: ABC1D23"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold outline-none focus:border-rose-500 bg-white uppercase"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-600 block mb-1">Contato do Terceiro</label>
              <input
                type="text"
                value={formData.contatoTerceiro || ""}
                onChange={(e) => setFormData({ ...formData, contatoTerceiro: e.target.value })}
                placeholder="Telefone / Celular"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-rose-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">Relato do Ocorrido</label>
            <textarea
              value={formData.descricao || ""}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
              placeholder="Descreva a dinâmica do acidente/avaria..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-rose-500"
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
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar Sinistro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

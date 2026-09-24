import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sinistro, GravidadeSinistro, StatusSinistro, CulpabilidadeSinistro } from "../types";
import { 
  fetchSinistros, 
  saveOrUpdateSinistro, 
  deleteSinistro, 
  parseSinistrosExcel, 
  exportSinistrosToExcel,
  syncSinistrosOnline,
  fetchSinistrosConfig,
  SinistrosOnlineConfig 
} from "../services/sinistrosService";
import { 
  createOrGetEventFolder, 
  uploadSinistroAttachmentToDrive, 
  listFilesInDriveFolder, 
  GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL,
  formatEventFolderName,
  connectGoogleDrive,
  getValidDriveToken
} from "../../../services/googleDriveService";
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  ExternalLink, 
  SlidersHorizontal, 
  ShieldAlert, 
  FolderSync, 
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
  DollarSign, 
  Paperclip,
  FolderOpen,
  RefreshCw,
  FileSpreadsheet,
  Upload
} from "lucide-react";

const COLUMNS_DEF = [
  { id: "protocolo", label: "Nº Protocolo", default: true },
  { id: "dataHora", label: "Data & Hora", default: true },
  { id: "placa", label: "Placa Cavalo", default: true },
  { id: "placaCarreta", label: "Carreta", default: false },
  { id: "base", label: "Base / Filial", default: true },
  { id: "motorista", label: "Motorista", default: true },
  { id: "tipoEvento", label: "Tipo de Evento", default: true },
  { id: "gravidade", label: "Gravidade", default: true },
  { id: "status", label: "Status", default: true },
  { id: "culpabilidade", label: "Culpabilidade", default: true },
  { id: "local", label: "Local / Rodovia", default: false },
  { id: "boletimOcorrencia", label: "Boletim (B.O.)", default: false },
  { id: "prejuizo", label: "Prejuízo Estimado", default: true },
  { id: "franquia", label: "Franquia", default: false },
  { id: "seguradora", label: "Seguradora", default: false },
  { id: "custoRisel", label: "Custo Risel", default: true },
  { id: "drivePasta", label: "Pasta Google Drive", default: true },
];

const MICROSOFT_FORMS_URL = "https://forms.cloud.microsoft/Pages/DesignPageV2.aspx?prevorigin=Marketing&origin=NeoPortalPage&subpage=design&id=--soOq0dkkmCvV864R49jTu3qwhCFQBElTcewqtXSeRUQTE2N0tGUjlEMjREQU5OUzFKN1NSR1pQWS4u";
const SHAREPOINT_EXCEL_URL = "https://riselcombustiveis-my.sharepoint.com/:x:/r/personal/deny_goncalves_risel_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B08C8A01A-45A5-4439-94F4-5F0505EDE3B3%7D&file=Comunicado%20de%20Sinistro_Frota%20Pesada.xlsx&action=default&mobileredirect=true";

export const SinistrosPage: React.FC = () => {
  const [sinistros, setSinistros] = useState<Sinistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [baseFilter, setBaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gravidadeFilter, setGravidadeFilter] = useState("");

  // Controle de visibilidade de colunas com persistência local
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("risel_sinistros_visible_cols_v1");
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
  const [isDriveUploadModalOpen, setIsDriveUploadModalOpen] = useState(false);
  const [uploadTargetSinistro, setUploadTargetSinistro] = useState<Sinistro | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadFeedback, setDriveUploadFeedback] = useState<string | null>(null);

  // Configuração Online com a Planilha do SharePoint
  const [onlineConfig, setOnlineConfig] = useState<SinistrosOnlineConfig | null>(null);

  // Arquivos para upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar lista de sinistros e configuração online com atualização direta contínua
  useEffect(() => {
    loadSinistros();
    fetchSinistrosConfig().then(cfg => setOnlineConfig(cfg)).catch(() => {});
    const timer = setInterval(() => {
      loadSinistros();
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const loadSinistros = async () => {
    setLoading(true);
    try {
      const data = await fetchSinistros();
      setSinistros(data);
    } catch (e) {
      console.error("Erro ao carregar sinistros:", e);
    } finally {
      setLoading(false);
    }
  };

  // Salvar preferência de colunas
  useEffect(() => {
    try {
      localStorage.setItem("risel_sinistros_visible_cols_v1", JSON.stringify(visibleCols));
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

  // Filtragem dos sinistros
  const filteredList = useMemo(() => {
    return sinistros.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          (s.numeroProtocolo || "").toLowerCase().includes(q) ||
          (s.placa || "").toLowerCase().includes(q) ||
          (s.motorista || "").toLowerCase().includes(q) ||
          (s.base || "").toLowerCase().includes(q) ||
          (s.boletimOcorrencia || "").toLowerCase().includes(q) ||
          (s.tipoEvento || "").toLowerCase().includes(q) ||
          (s.nomeSeguradora || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (baseFilter && s.base.trim() !== baseFilter.trim()) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (gravidadeFilter && s.gravidade !== gravidadeFilter) return false;
      return true;
    });
  }, [sinistros, search, baseFilter, statusFilter, gravidadeFilter]);

  // Lista de bases únicas para filtro
  const uniqueBases = useMemo(() => {
    const set = new Set<string>();
    sinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [sinistros]);

  // Exclusão de sinistro
  const handleDelete = async (id: string, placa: string) => {
    if (window.confirm(`Deseja realmente remover o registro de sinistro do veículo ${placa}? Esta ação não pode ser desfeita.`)) {
      const updated = await deleteSinistro(id);
      setSinistros(updated);
    }
  };

  // Abrir ou criar pasta no Google Drive para o evento
  const handleOpenOrCreateDriveFolder = async (sinistro: Sinistro) => {
    try {
      const token = await getValidDriveToken();
      const folder = await createOrGetEventFolder(sinistro.placa, sinistro.base, sinistro.dataHora, token);

      if (folder && folder.webViewLink) {
        // Atualiza a pasta no sinistro caso não tivesse
        if (!sinistro.driveFolderId || sinistro.driveFolderId.startsWith("folder_")) {
          const updatedSinistro = {
            ...sinistro,
            driveFolderId: folder.id,
            driveFolderUrl: folder.webViewLink
          };
          saveOrUpdateSinistro(updatedSinistro);
          setSinistros(prev => prev.map(s => (s.id === sinistro.id ? updatedSinistro : s)));
        }
        window.open(folder.webViewLink, "_blank");
      } else {
        window.open(GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL, "_blank");
      }
    } catch (e) {
      window.open(GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL, "_blank");
    }
  };

  // Envio de anexo diretamente para o Google Drive
  const handleUploadAttachmentToDrive = async (file: File) => {
    if (!uploadTargetSinistro) return;
    setIsUploadingToDrive(true);
    setDriveUploadFeedback(null);

    try {
      let token = await getValidDriveToken();
      if (!token) {
        try {
          token = await connectGoogleDrive();
        } catch (authErr) {
          alert("Acesso ao Google Drive cancelado ou não autorizado. Conecte sua conta corporativa para salvar os anexos diretamente na pasta do evento.");
          setIsUploadingToDrive(false);
          return;
        }
      }

      // 1. Assegura a pasta do evento no formato brasileiro estipulado
      const folder = await createOrGetEventFolder(
        uploadTargetSinistro.placa,
        uploadTargetSinistro.base,
        uploadTargetSinistro.dataHora,
        token
      );

      // 2. Faz o upload do arquivo para a pasta do evento
      const uploadedFile = await uploadSinistroAttachmentToDrive(folder.id, file, file.name, token);

      // 3. Registra o anexo no sinistro
      const novoAnexo = {
        id: uploadedFile.id || `anx_${Date.now()}`,
        nome: uploadedFile.name,
        url: uploadedFile.webViewLink,
        driveFileId: uploadedFile.id,
        tamanho: typeof uploadedFile.size === "number" ? uploadedFile.size : file.size,
        tipo: uploadedFile.mimeType || file.type,
        dataUpload: new Date().toLocaleDateString("pt-BR")
      };

      const anexosAtualizados = [...(uploadTargetSinistro.anexos || []), novoAnexo];
      const sinistroAtualizado: Sinistro = {
        ...uploadTargetSinistro,
        driveFolderId: folder.id,
        driveFolderUrl: folder.webViewLink,
        anexos: anexosAtualizados
      };

      await saveOrUpdateSinistro(sinistroAtualizado);
      setSinistros(prev => prev.map(s => (s.id === sinistroAtualizado.id ? sinistroAtualizado : s)));
      setUploadTargetSinistro(sinistroAtualizado);

      setDriveUploadFeedback(`Arquivo "${file.name}" salvo com sucesso na pasta do evento no Google Drive!`);
      setTimeout(() => setDriveUploadFeedback(null), 5000);
    } catch (err: any) {
      console.error("Erro no upload do anexo:", err);
      alert(`Falha ao salvar anexo no Google Drive: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-10 flex flex-col h-full min-h-0">
      {/* Barra de Ferramentas Superior */}
      <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Lado Esquerdo: Título & Busca Global */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Conectado à Planilha Online (Sheet1)
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">&bull;</span>
              <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">Comunicado de Sinistro_Frota Pesada.xlsx</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-none flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Lista Geral de Sinistros & Comunicados</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Conexão contínua direta à aba Sheet1 da planilha no SharePoint e formulários Microsoft Forms
            </p>
          </div>

          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por placa, motorista, B.O., protocolo..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs font-semibold outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Ações de Sincronização Online + Colunas */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Abrir Planilha no SharePoint */}
          <a
            href={SHAREPOINT_EXCEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Abrir a planilha do Excel online no SharePoint corporativo da Risel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Planilha SharePoint</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>

          {/* Botão Formulário Microsoft Forms */}
          <a
            href={MICROSOFT_FORMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Abrir o formulário de Comunicado de Sinistro no Microsoft Forms"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Microsoft Forms</span>
          </a>

          {/* Botão Google Drive */}
          <a
            href={GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Abrir pasta de Sinistros no Google Drive"
          >
            <FolderSync className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Google Drive</span>
          </a>

          {/* Botão Discreto de Exibir/Ocultar Colunas */}
          <div className="relative" ref={colSelectorRef}>
            <button
              onClick={() => setShowColSelector(!showColSelector)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Personalizar colunas visíveis da tabela"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Colunas</span>
            </button>

            {/* Popover Discreto de Seleção de Colunas */}
            {showColSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Exibir / Ocultar Colunas</span>
                  <button
                    onClick={resetColumns}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {COLUMNS_DEF.map(col => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 p-1 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(visibleCols[col.id])}
                        onChange={() => toggleColumn(col.id)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                      />
                      <span className="font-medium truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Exportar Excel */}
          <button
            onClick={() => exportSinistrosToExcel(filteredList)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Exportar registros filtrados para Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          {/* Botão Novo Comunicado */}
          <button
            onClick={() => {
              setEditingSinistro(null);
              setIsNewModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Comunicado</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Base */}
          <select
            value={baseFilter}
            onChange={(e) => setBaseFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
          >
            <option value="">Todas as Bases</option>
            {uniqueBases.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
          >
            <option value="">Todos os Status</option>
            <option value="Em Apuração">Em Apuração</option>
            <option value="Aberto na Seguradora">Aberto na Seguradora</option>
            <option value="Aguardando Orçamento">Aguardando Orçamento</option>
            <option value="Em Reparo">Em Reparo</option>
            <option value="Regulado">Regulado</option>
            <option value="Indenizado">Indenizado</option>
            <option value="Finalizado / Concluído">Finalizado / Concluído</option>
          </select>

          {/* Gravidade */}
          <select
            value={gravidadeFilter}
            onChange={(e) => setGravidadeFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
          >
            <option value="">Todas as Gravidades</option>
            <option value="Leve">Leve</option>
            <option value="Média">Média</option>
            <option value="Grave">Grave</option>
            <option value="Gravíssima">Gravíssima</option>
          </select>

          {(baseFilter || statusFilter || gravidadeFilter) && (
            <button
              onClick={() => {
                setBaseFilter("");
                setStatusFilter("");
                setGravidadeFilter("");
              }}
              className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer px-1"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="text-[11px] font-bold text-slate-500">
          Mostrando <span className="text-slate-800 font-black">{filteredList.length}</span> de{" "}
          <span className="text-slate-800 font-black">{sinistros.length}</span> sinistro(s)
        </div>
      </div>

      {/* TABELA ELEGANTE DE SINISTROS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                {visibleCols.protocolo && <th className="py-2.5 px-3 whitespace-nowrap">Protocolo</th>}
                {visibleCols.dataHora && <th className="py-2.5 px-3 whitespace-nowrap">Data / Hora</th>}
                {visibleCols.placa && <th className="py-2.5 px-3 whitespace-nowrap">Placa Cavalo</th>}
                {visibleCols.placaCarreta && <th className="py-2.5 px-3 whitespace-nowrap">Carreta</th>}
                {visibleCols.base && <th className="py-2.5 px-3 whitespace-nowrap">Base</th>}
                {visibleCols.motorista && <th className="py-2.5 px-3 whitespace-nowrap">Motorista</th>}
                {visibleCols.tipoEvento && <th className="py-2.5 px-3 whitespace-nowrap">Tipo Evento</th>}
                {visibleCols.gravidade && <th className="py-2.5 px-3 whitespace-nowrap">Gravidade</th>}
                {visibleCols.status && <th className="py-2.5 px-3 whitespace-nowrap">Status</th>}
                {visibleCols.culpabilidade && <th className="py-2.5 px-3 whitespace-nowrap">Culpabilidade</th>}
                {visibleCols.local && <th className="py-2.5 px-3 whitespace-nowrap">Local / Via</th>}
                {visibleCols.boletimOcorrencia && <th className="py-2.5 px-3 whitespace-nowrap">B.O.</th>}
                {visibleCols.prejuizo && <th className="py-2.5 px-3 whitespace-nowrap text-right">Prejuízo (R$)</th>}
                {visibleCols.franquia && <th className="py-2.5 px-3 whitespace-nowrap text-right">Franquia (R$)</th>}
                {visibleCols.seguradora && <th className="py-2.5 px-3 whitespace-nowrap">Seguradora</th>}
                {visibleCols.custoRisel && <th className="py-2.5 px-3 whitespace-nowrap text-right">Custo Risel</th>}
                {visibleCols.drivePasta && <th className="py-2.5 px-3 whitespace-nowrap text-center">Pasta Drive</th>}
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-50/95 shadow-sm">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-sm">Nenhum sinistro localizado</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Altere os filtros de busca ou clique em "+ Novo Comunicado" para registrar uma nova ocorrência.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const gravidadeBadge =
                    item.gravidade === "Leve"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : item.gravidade === "Média"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : item.gravidade === "Grave"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-rose-50 text-rose-700 border-rose-200";

                  const statusBadge =
                    item.status === "Finalizado / Concluído"
                      ? "bg-emerald-100/70 text-emerald-800 border-emerald-300"
                      : item.status === "Em Reparo"
                      ? "bg-blue-100/70 text-blue-800 border-blue-300"
                      : item.status === "Aberto na Seguradora"
                      ? "bg-purple-100/70 text-purple-800 border-purple-300"
                      : "bg-slate-100 text-slate-700 border-slate-200";

                  // Data formatada para visualização rápida
                  let dataDisplay = item.dataHora;
                  if (item.dataHora && item.dataHora.includes("T")) {
                    const [d, t] = item.dataHora.split("T");
                    const [y, m, dia] = d.split("-");
                    dataDisplay = `${dia}/${m}/${y} ${t || ""}`;
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {visibleCols.protocolo && (
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {item.numeroProtocolo}
                        </td>
                      )}

                      {visibleCols.dataHora && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                          {dataDisplay}
                        </td>
                      )}

                      {visibleCols.placa && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.placa}
                          </span>
                        </td>
                      )}

                      {visibleCols.placaCarreta && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500">
                          {item.placaCarreta || "-"}
                        </td>
                      )}

                      {visibleCols.base && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">
                          {item.base}
                        </td>
                      )}

                      {visibleCols.motorista && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800 max-w-[160px] truncate" title={item.motorista}>
                          {item.motorista}
                        </td>
                      )}

                      {visibleCols.tipoEvento && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                          {item.tipoEvento}
                        </td>
                      )}

                      {visibleCols.gravidade && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${gravidadeBadge}`}>
                            {item.gravidade}
                          </span>
                        </td>
                      )}

                      {visibleCols.status && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusBadge}`}>
                            {item.status}
                          </span>
                        </td>
                      )}

                      {visibleCols.culpabilidade && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[11px] text-slate-600">
                          {item.culpabilidade}
                        </td>
                      )}

                      {visibleCols.local && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 max-w-[150px] truncate" title={item.local}>
                          {item.local}
                        </td>
                      )}

                      {visibleCols.boletimOcorrencia && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {item.boletimOcorrencia || "-"}
                        </td>
                      )}

                      {visibleCols.prejuizo && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900 text-right">
                          {(item.valorEstimadoPrejuizo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      )}

                      {visibleCols.franquia && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-right">
                          {(item.valorFranquia || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      )}

                      {visibleCols.seguradora && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                          {item.nomeSeguradora || (item.seguradoraAcionada === "Sim" ? "Acionada" : "Não")}
                        </td>
                      )}

                      {visibleCols.custoRisel && (
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-rose-700 text-right">
                          {(item.custoEfetivoRisel || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      )}

                      {/* Botão para Pasta no Google Drive */}
                      {visibleCols.drivePasta && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleOpenOrCreateDriveFolder(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                            title={`Abrir pasta do evento: ${formatEventFolderName(item.placa, item.base, item.dataHora)}`}
                          >
                            <FolderSync className="w-3 h-3 text-emerald-600" />
                            <span>Abrir Pasta</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        </td>
                      )}

                      {/* Ações da Linha */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center sticky right-0 bg-white group-hover:bg-slate-50/90 shadow-sm">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingSinistro(item)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Visualizar Detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setUploadTargetSinistro(item);
                              setIsDriveUploadModalOpen(true);
                            }}
                            className="p-1 rounded-md text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                            title="Salvar Anexos no Google Drive"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingSinistro(item);
                              setIsNewModalOpen(true);
                            }}
                            className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                            title="Editar Sinistro"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id, item.placa)}
                            className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Excluir Registro"
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
      </div>

      {/* MODAL 1: VISUALIZAÇÃO DE DETALHES DO SINISTRO */}
      {viewingSinistro && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm leading-tight">
                    {viewingSinistro.numeroProtocolo} &bull; Placa {viewingSinistro.placa}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Base {viewingSinistro.base} &bull; {viewingSinistro.tipoEvento}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingSinistro(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs">
              {/* Pasta no Google Drive */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-emerald-600" /> Pasta no Google Drive
                  </h4>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    Padrão: <span className="font-mono font-bold">{formatEventFolderName(viewingSinistro.placa, viewingSinistro.base, viewingSinistro.dataHora)}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleOpenOrCreateDriveFolder(viewingSinistro)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>Acessar no Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Informações Gerais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Data e Horário</span>
                  <span className="font-black text-slate-800 text-xs">{viewingSinistro.dataHora}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Motorista</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{viewingSinistro.motorista}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Gravidade</span>
                  <span className="font-black text-rose-600 text-xs">{viewingSinistro.gravidade}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Status</span>
                  <span className="font-bold text-slate-800 text-xs">{viewingSinistro.status}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Culpabilidade</span>
                  <span className="font-bold text-slate-800 text-xs">{viewingSinistro.culpabilidade}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Boletim (B.O.)</span>
                  <span className="font-mono text-slate-800 text-xs">{viewingSinistro.boletimOcorrencia || "Não registrado"}</span>
                </div>
              </div>

              {/* Valores Financeiros */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                  Consolidação Financeira & Seguradora
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[9.5px] text-slate-400 block">Prejuízo Total</span>
                    <span className="font-mono font-bold text-slate-900">
                      {(viewingSinistro.valorEstimadoPrejuizo || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block">Franquia</span>
                    <span className="font-mono font-medium text-slate-700">
                      {(viewingSinistro.valorFranquia || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block">Seguradora Cobriu</span>
                    <span className="font-mono font-bold text-blue-600">
                      {(viewingSinistro.valorPagoSeguradora || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] text-slate-400 block">Custo Efetivo Risel</span>
                    <span className="font-mono font-black text-rose-700">
                      {(viewingSinistro.custoEfetivoRisel || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Descrição e Dinâmica */}
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                  Relato da Ocorrência / Dinâmica do Sinistro
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                  {viewingSinistro.descricao || "Nenhum detalhamento registrado."}
                </p>
              </div>

              {/* Avarias */}
              {viewingSinistro.avariasVeiculo && (
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Danos e Avarias no Veículo / Tanque
                  </span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs">
                    {viewingSinistro.avariasVeiculo}
                  </p>
                </div>
              )}

              {/* Anexos Registrados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Anexos & Documentos ({viewingSinistro.anexos?.length || 0})
                  </span>
                  <button
                    onClick={() => {
                      setUploadTargetSinistro(viewingSinistro);
                      setIsDriveUploadModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar Arquivo ao Drive</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(viewingSinistro.anexos || []).length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                      Nenhum anexo salvo para este sinistro ainda.
                    </p>
                  ) : (
                    viewingSinistro.anexos!.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate text-[11px]">{a.nome}</span>
                        </div>
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 shrink-0 ml-2"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button
                onClick={() => setViewingSinistro(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 transition-colors text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO / EDITAR SINISTRO */}
      {isNewModalOpen && (
        <SinistroFormModal
          sinistro={editingSinistro}
          onClose={() => setIsNewModalOpen(false)}
          onSave={async (saved) => {
            const updated = await saveOrUpdateSinistro(saved);
            setSinistros(updated);
            setIsNewModalOpen(false);
          }}
        />
      )}

      {/* MODAL 3: UPLOAD DE ANEXO DIRETO PARA O GOOGLE DRIVE */}
      {isDriveUploadModalOpen && uploadTargetSinistro && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <FolderSync className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Salvar Anexos no Google Drive</h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Placa: {uploadTargetSinistro.placa} &bull; {uploadTargetSinistro.base}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsDriveUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nome da Pasta no Drive:</span>
                <span className="font-mono font-bold text-slate-800 text-[11px] block break-all">
                  {formatEventFolderName(uploadTargetSinistro.placa, uploadTargetSinistro.base, uploadTargetSinistro.dataHora)}
                </span>
              </div>

              {driveUploadFeedback && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{driveUploadFeedback}</span>
                </div>
              )}

              {/* Botão de Selecionar Arquivo */}
              <div
                onClick={() => !isUploadingToDrive && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-emerald-50/20 hover:bg-emerald-50/40 transition-all space-y-2 ${
                  isUploadingToDrive ? "opacity-60 cursor-wait" : "cursor-pointer"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAttachmentToDrive(f);
                    e.target.value = "";
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-800 text-xs block">
                    {isUploadingToDrive ? "Enviando arquivo ao Google Drive..." : "Clique para anexar foto pericial ou B.O."}
                  </span>
                  <span className="text-[10px] text-slate-400">PDF, JPG, PNG até 50MB</span>
                </div>
              </div>

              {/* Atalho para abrir pasta */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => handleOpenOrCreateDriveFolder(uploadTargetSinistro)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Ver pasta deste evento no Google Drive</span>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                onClick={() => setIsDriveUploadModalOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-100 text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Modal Formulário Completo de Cadastro / Edição de Sinistro
 */
function SinistroFormModal({
  sinistro,
  onClose,
  onSave
}: {
  sinistro: Sinistro | null;
  onClose: () => void;
  onSave: (sinistro: Sinistro) => void;
}) {
  const isEditing = Boolean(sinistro);

  const [formData, setFormData] = useState<Partial<Sinistro>>(() => {
    if (sinistro) return { ...sinistro };
    return {
      id: `sin_${Date.now()}`,
      numeroProtocolo: `SIN-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
      dataHora: new Date().toISOString().substring(0, 16),
      dataComunicado: new Date().toLocaleDateString("pt-BR"),
      placa: "",
      placaCarreta: "",
      base: "Paulínia",
      motorista: "",
      tipoEvento: "Colisão Traseira",
      gravidade: "Média" as GravidadeSinistro,
      status: "Em Apuração" as StatusSinistro,
      culpabilidade: "Em Apuração" as CulpabilidadeSinistro,
      local: "",
      municipio: "Paulínia",
      uf: "SP",
      rodoviaOuUrbano: "Rodovia",
      boletimOcorrencia: "",
      houveVitimas: "Não",
      houveTerceiros: "Não",
      seguradoraAcionada: "Não",
      nomeSeguradora: "",
      numeroSinistroSeguradora: "",
      valorEstimadoPrejuizo: 0,
      valorFranquia: 0,
      valorPagoSeguradora: 0,
      custoEfetivoRisel: 0,
      descricao: "",
      avariasVeiculo: "",
      origem: "Lançamento Manual"
    };
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Recalcular custo efetivo Risel
      if (name === "valorEstimadoPrejuizo" || name === "valorPagoSeguradora" || name === "valorFranquia") {
        const prej = Number(updated.valorEstimadoPrejuizo) || 0;
        const seg = Number(updated.valorPagoSeguradora) || 0;
        updated.custoEfetivoRisel = Math.max(0, prej - seg);
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa) {
      alert("Por favor, preencha a placa do veículo.");
      return;
    }
    if (!formData.motorista) {
      alert("Por favor, preencha o nome do motorista.");
      return;
    }

    const finalSinistro: Sinistro = {
      ...(formData as Sinistro),
      placa: (formData.placa || "").trim().toUpperCase(),
      driveFolderUrl: formData.driveFolderUrl || GOOGLE_DRIVE_SINISTROS_ROOT_FOLDER_URL
    };

    onSave(finalSinistro);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header do Modal */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-tight">
                {isEditing ? `Editar Sinistro #${formData.numeroProtocolo}` : "Novo Comunicado de Sinistro"}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Frota Pesada &bull; Risel Combustíveis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={MICROSOFT_FORMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Abrir formulário original no Microsoft Forms"
            >
              <span>Abrir Formulário Forms</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Formulário com Abas Visuais */}
        <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar p-5 space-y-4 text-xs">
          {/* Seção 1: Identificação do Veículo e Motorista */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              1. Identificação do Cavalo, Carreta & Condutor
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Placa Cavalo *</label>
                <input
                  type="text"
                  name="placa"
                  value={formData.placa}
                  onChange={handleChange}
                  required
                  placeholder="Ex: BRL2E19"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Placa Carreta / Tanque</label>
                <input
                  type="text"
                  name="placaCarreta"
                  value={formData.placaCarreta}
                  onChange={handleChange}
                  placeholder="Ex: RIS9B22"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Base / Filial *</label>
                <select
                  name="base"
                  value={formData.base}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                >
                  <option value="Paulínia">Paulínia</option>
                  <option value="Aguaí">Aguaí</option>
                  <option value="Santos">Santos</option>
                  <option value="Betim">Betim</option>
                  <option value="Araucária">Araucária</option>
                  <option value="Ribeirão Preto">Ribeirão Preto</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nome do Motorista *</label>
                <input
                  type="text"
                  name="motorista"
                  value={formData.motorista}
                  onChange={handleChange}
                  required
                  placeholder="Nome completo do condutor"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">CNH do Motorista</label>
                <input
                  type="text"
                  name="cnhMotorista"
                  value={formData.cnhMotorista || ""}
                  onChange={handleChange}
                  placeholder="Nº CNH"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Dados do Evento e Gravidade */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              2. Dados do Evento, Data e Gravidade
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Data e Hora *</label>
                <input
                  type="datetime-local"
                  name="dataHora"
                  value={formData.dataHora}
                  onChange={handleChange}
                  required
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Tipo de Evento</label>
                <select
                  name="tipoEvento"
                  value={formData.tipoEvento}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Colisão Traseira">Colisão Traseira</option>
                  <option value="Colisão Frontal">Colisão Frontal</option>
                  <option value="Abalroamento Lateral">Abalroamento Lateral</option>
                  <option value="Tombamento">Tombamento</option>
                  <option value="Choque com Objeto Fixo">Choque com Objeto Fixo</option>
                  <option value="Furto / Roubo">Furto / Roubo</option>
                  <option value="Incêndio">Incêndio</option>
                  <option value="Avaria de Carga / Válvula">Avaria de Carga / Válvula</option>
                  <option value="Derramamento de Produto">Derramamento de Produto</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Gravidade</label>
                <select
                  name="gravidade"
                  value={formData.gravidade}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-black text-rose-600"
                >
                  <option value="Leve">Leve</option>
                  <option value="Média">Média</option>
                  <option value="Grave">Grave</option>
                  <option value="Gravíssima">Gravíssima</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Status Operacional</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Em Apuração">Em Apuração</option>
                  <option value="Aberto na Seguradora">Aberto na Seguradora</option>
                  <option value="Aguardando Orçamento">Aguardando Orçamento</option>
                  <option value="Em Reparo">Em Reparo</option>
                  <option value="Regulado">Regulado</option>
                  <option value="Indenizado">Indenizado</option>
                  <option value="Finalizado / Concluído">Finalizado / Concluído</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Culpabilidade</label>
                <select
                  name="culpabilidade"
                  value={formData.culpabilidade}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Em Apuração">Em Apuração</option>
                  <option value="Condutor Risel">Condutor Risel</option>
                  <option value="Terceiro">Terceiro</option>
                  <option value="Sem Culpa / Condições Adversas">Sem Culpa / Condições Adversas</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Houve Vítimas?</label>
                <select
                  name="houveVitimas"
                  value={formData.houveVitimas}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Não">Não</option>
                  <option value="Feridos Leves">Feridos Leves</option>
                  <option value="Feridos Graves">Feridos Graves</option>
                  <option value="Óbito">Óbito</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Houve Terceiros?</label>
                <select
                  name="houveTerceiros"
                  value={formData.houveTerceiros}
                  onChange={handleChange}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Local / Rodovia / KM</label>
                <input
                  type="text"
                  name="local"
                  value={formData.local || ""}
                  onChange={handleChange}
                  placeholder="Ex: SP-332, KM 128"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nº do B.O.</label>
                <input
                  type="text"
                  name="boletimOcorrencia"
                  value={formData.boletimOcorrencia || ""}
                  onChange={handleChange}
                  placeholder="Ex: BO-77291/2026"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Financeiro e Seguradora */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              3. Financeiro, Seguradora & Franquia
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Prejuízo Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  name="valorEstimadoPrejuizo"
                  value={formData.valorEstimadoPrejuizo || 0}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Franquia (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  name="valorFranquia"
                  value={formData.valorFranquia || 0}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Pago Seguradora (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  name="valorPagoSeguradora"
                  value={formData.valorPagoSeguradora || 0}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-blue-600 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Custo Efetivo Risel (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  name="custoEfetivoRisel"
                  value={formData.custoEfetivoRisel || 0}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-rose-600 font-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Seguradora</label>
                <input
                  type="text"
                  name="nomeSeguradora"
                  value={formData.nomeSeguradora || ""}
                  onChange={handleChange}
                  placeholder="Ex: Porto Seguro / Tokio Marine / Allianz"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Nº Sinistro Seguradora</label>
                <input
                  type="text"
                  name="numeroSinistroSeguradora"
                  value={formData.numeroSinistroSeguradora || ""}
                  onChange={handleChange}
                  placeholder="Código do sinistro na seguradora"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Relato Detalhado */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
              Dinâmica da Ocorrência / Relato Detalhado *
            </label>
            <textarea
              name="descricao"
              value={formData.descricao || ""}
              onChange={handleChange}
              rows={3}
              required
              placeholder="Descreva minuciosamente como aconteceu o evento..."
              className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs leading-relaxed"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
              Danos e Avarias no Cavalo Mecânico e Tanque
            </label>
            <textarea
              name="avariasVeiculo"
              value={formData.avariasVeiculo || ""}
              onChange={handleChange}
              rows={2}
              placeholder="Peças quebradas, danos estruturais, avarias na pintura ou iluminação..."
              className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs"
            />
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block mb-0.5">
              Organização Automática de Pastas no Google Drive
            </span>
            <p className="text-[10.5px] text-emerald-700">
              Ao salvar, o sistema associará este evento à pasta do Google Drive nomeada no padrão:{" "}
              <strong className="font-mono">{formatEventFolderName(formData.placa || "PLACA", formData.base || "BASE", formData.dataHora || "")}</strong>.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm cursor-pointer"
            >
              {isEditing ? "Salvar Alterações" : "Cadastrar Comunicado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

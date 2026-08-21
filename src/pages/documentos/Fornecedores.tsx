import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, Building2, MapPin, MoreHorizontal, Mail, Phone, Edit2, Trash2, X, Plus, Save, SlidersHorizontal, Check, ArrowUpDown, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { fetchFornecedoresSupabase, saveFornecedorSupabase, deleteFornecedorSupabase } from "../../services/supabaseService";

const DEFAULT_FORNECE_LIST: any[] = [];

export const formatCPFCNPJ = (val: string) => {
  const clean = (val || "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (clean.length === 14 || clean.length > 11) {
    // se for maior, assume CNPJ (máximo 14)
    const truncated = clean.substring(0, 14);
    return truncated.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return val; // fallback se for menor
};

export const getSupplierLogoUrl = (nome: string, logoCustom?: string, email?: string) => {
  if (logoCustom && (logoCustom.startsWith("http") || logoCustom.startsWith("data:image")) && !logoCustom.includes("ui-avatars")) {
    return logoCustom;
  }

  // Se houver e-mail com domínio corporativo, busca logo via Google Favicons
  if (email && email.includes("@")) {
    const emailDomain = email.split("@")[1]?.toLowerCase().trim();
    if (emailDomain && !["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "uol.com.br", "bol.com.br", "terra.com.br"].includes(emailDomain)) {
      return `https://www.google.com/s2/favicons?domain=${emailDomain}&sz=128`;
    }
  }

  const nomeUpper = (nome || "").toUpperCase().trim();

  if (nomeUpper.includes("SHELL") || nomeUpper.includes("RAIZEN") || nomeUpper.includes("RAÍZEN")) return "https://www.google.com/s2/favicons?domain=shell.com.br&sz=128";
  if (nomeUpper.includes("IPIRANGA")) return "https://www.google.com/s2/favicons?domain=ipiranga.com.br&sz=128";
  if (nomeUpper.includes("PETROBRAS") || nomeUpper.includes("BR DISTRIBUIDORA") || nomeUpper.includes("VIBRA")) return "https://www.google.com/s2/favicons?domain=vibraenergia.com.br&sz=128";
  if (nomeUpper.includes("VELOE")) return "https://www.google.com/s2/favicons?domain=veloe.com.br&sz=128";
  if (nomeUpper.includes("SEM PARAR")) return "https://www.google.com/s2/favicons?domain=semparar.com.br&sz=128";
  if (nomeUpper.includes("TICKET")) return "https://www.google.com/s2/favicons?domain=ticketlog.com.br&sz=128";
  if (nomeUpper.includes("LOCALIZA")) return "https://www.google.com/s2/favicons?domain=localiza.com&sz=128";
  if (nomeUpper.includes("MOVIDA")) return "https://www.google.com/s2/favicons?domain=movida.com.br&sz=128";
  if (nomeUpper.includes("UNIDAS")) return "https://www.google.com/s2/favicons?domain=unidas.com.br&sz=128";
  if (nomeUpper.includes("TOTAL") || nomeUpper.includes("TOTALENERGIES")) return "https://www.google.com/s2/favicons?domain=totalenergies.br&sz=128";
  if (nomeUpper.includes("SANTANDER")) return "https://www.google.com/s2/favicons?domain=santander.com.br&sz=128";
  if (nomeUpper.includes("BRADESCO")) return "https://www.google.com/s2/favicons?domain=bradesco.com.br&sz=128";
  if (nomeUpper.includes("ITAU") || nomeUpper.includes("ITAÚ")) return "https://www.google.com/s2/favicons?domain=itau.com.br&sz=128";
  if (nomeUpper.includes("CAIXA")) return "https://www.google.com/s2/favicons?domain=caixa.gov.br&sz=128";
  if (nomeUpper.includes("BANCO DO BRASIL")) return "https://www.google.com/s2/favicons?domain=bb.com.br&sz=128";
  if (nomeUpper.includes("CLARO")) return "https://www.google.com/s2/favicons?domain=claro.com.br&sz=128";
  if (nomeUpper.includes("VIVO") || nomeUpper.includes("TELEFONICA")) return "https://www.google.com/s2/favicons?domain=vivo.com.br&sz=128";
  if (nomeUpper.includes("TIM")) return "https://www.google.com/s2/favicons?domain=tim.com.br&sz=128";
  if (nomeUpper.includes("PORTO SEGURO")) return "https://www.google.com/s2/favicons?domain=portoseguro.com.br&sz=128";
  if (nomeUpper.includes("TOTVS")) return "https://www.google.com/s2/favicons?domain=totvs.com&sz=128";
  if (nomeUpper.includes("SAP")) return "https://www.google.com/s2/favicons?domain=sap.com&sz=128";
  if (nomeUpper.includes("SENIOR")) return "https://www.google.com/s2/favicons?domain=senior.com.br&sz=128";
  if (nomeUpper.includes("VOLVO")) return "https://www.google.com/s2/favicons?domain=volvo.com&sz=128";
  if (nomeUpper.includes("SCANIA")) return "https://www.google.com/s2/favicons?domain=scania.com&sz=128";
  if (nomeUpper.includes("MERCEDES")) return "https://www.google.com/s2/favicons?domain=mercedes-benz.com.br&sz=128";
  if (nomeUpper.includes("MICHELIN")) return "https://www.google.com/s2/favicons?domain=michelin.com.br&sz=128";
  if (nomeUpper.includes("GOODYEAR")) return "https://www.google.com/s2/favicons?domain=goodyear.com.br&sz=128";
  if (nomeUpper.includes("PIRELLI")) return "https://www.google.com/s2/favicons?domain=pirelli.com&sz=128";

  // Tenta extrair a primeira palavra limpa da razão social
  const cleanWords = nomeUpper
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(w => !["AUTO", "POSTO", "COMERCIO", "SERVICOS", "SERVIÇOS", "LTDA", "SA", "ME", "EPP", "GRUPO"].includes(w) && w.length > 2);

  if (cleanWords.length > 0) {
    const cleanWord = cleanWords[0].toLowerCase();
    return `https://www.google.com/s2/favicons?domain=${cleanWord}.com.br&sz=128`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome || "F")}&background=114D38&color=fff&bold=true`;
};

export const SupplierLogo = ({ name, avatarUrl, email }: { name: string; avatarUrl?: string; email?: string }) => {
  const primaryUrl = getSupplierLogoUrl(name, avatarUrl, email);
  const initialsFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "F")}&background=114D38&color=fff&bold=true`;
  
  const [imgSrc, setImgSrc] = useState(primaryUrl);
  const [stage, setStage] = useState(0); // 0: primary, 1: unavatar, 2: initials

  useEffect(() => {
    setImgSrc(getSupplierLogoUrl(name, avatarUrl, email));
    setStage(0);
  }, [name, avatarUrl, email]);

  const handleError = () => {
    if (stage === 0) {
      // Tenta unavatar como fallback
      const cleanFirstWord = (name || "").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanFirstWord.length > 2) {
        setStage(1);
        setImgSrc(`https://unavatar.io/${cleanFirstWord}.com.br`);
      } else {
        setStage(2);
        setImgSrc(initialsFallback);
      }
    } else if (stage === 1) {
      setStage(2);
      setImgSrc(initialsFallback);
    }
  };

  return (
    <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0 p-1">
      <img
        src={imgSrc}
        alt={name}
        onError={handleError}
        className="w-full h-full object-contain rounded-md"
      />
    </div>
  );
};

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<any[]>(() => {
    const saved = localStorage.getItem("risel_fornecedores");
    if (!saved) return DEFAULT_FORNECE_LIST;
    try {
      const parsed = JSON.parse(saved);
      // Limpa dados legados fictícios
      if (Array.isArray(parsed) && parsed.some((x: any) => x.cnpj === "12345678000199" || x.nome?.includes("Postos ABC Locações"))) {
        localStorage.setItem("risel_fornecedores", JSON.stringify([]));
        return [];
      }
      return parsed;
    } catch (e) {
      return DEFAULT_FORNECE_LIST;
    }
  });

  useEffect(() => {
    async function syncSupabase() {
      const dbItems = await fetchFornecedoresSupabase();
      if (Array.isArray(dbItems)) {
        setFornecedores(dbItems);
        localStorage.setItem("risel_fornecedores", JSON.stringify(dbItems));
      }
    }
    syncSupabase();
  }, []);

  useEffect(() => {
    localStorage.setItem("risel_fornecedores", JSON.stringify(fornecedores));
  }, [fornecedores]);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<any>(null);

  // Ordenação de dados (Cabeçalhos clicáveis)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "nome",
    direction: "asc"
  });

  // Seletor discreto de colunas visíveis
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("risel_forn_cols_v2");
    return saved ? JSON.parse(saved) : {
      status: true,
      fornecedor: true,
      cnpj: true,
      codigo: true,
      telefone: true,
      email: true,
      cidade: true,
      uf: true
    };
  });

  const [showColSelector, setShowColSelector] = useState(false);
  const colSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("risel_forn_cols_v2", JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colSelectorRef.current && !colSelectorRef.current.contains(event.target as Node)) {
        setShowColSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [formData, setFormData] = useState({
    cnpj: "",
    nome: "",
    codigoItem: "",
    cidade: "",
    uf: "",
    telefone: "",
    email: "",
    status: "Ativo",
    avatarUrl: ""
  });

  const [logoSearchOpen, setLogoSearchOpen] = useState(false);
  const [logoCandidates, setLogoCandidates] = useState<any[]>([]);

  const handleSearchLogos = () => {
    if (!formData.nome && !formData.email) {
      alert("Informe a Razão Social ou o E-mail para pesquisar o logotipo.");
      return;
    }
    const candidates: any[] = [];
    const addedUrls = new Set<string>();

    // 1. Tenta extrair do E-mail
    if (formData.email && formData.email.includes("@")) {
      const emailDomain = formData.email.split("@")[1]?.toLowerCase().trim();
      if (emailDomain && !["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "uol.com.br"].includes(emailDomain)) {
        const urlFav = `https://www.google.com/s2/favicons?domain=${emailDomain}&sz=128`;
        const urlUnavatar = `https://unavatar.io/${emailDomain}`;
        if (!addedUrls.has(urlFav)) { addedUrls.add(urlFav); candidates.push({ url: urlFav, label: `Google (${emailDomain})` }); }
        if (!addedUrls.has(urlUnavatar)) { addedUrls.add(urlUnavatar); candidates.push({ url: urlUnavatar, label: `Unavatar (${emailDomain})` }); }
      }
    }

    // 2. Tenta extrair da Razão Social
    const words = (formData.nome || "")
      .toUpperCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(w => !["LTDA", "SA", "S/A", "ME", "EPP", "EIRELI", "AUTO", "POSTO", "COMERCIO", "SERVICOS", "SERVIÇOS", "BRASIL", "GRUPO"].includes(w) && w.length > 2);

    if (words.length > 0) {
      const firstWord = words[0].toLowerCase();
      const domainBr = `${firstWord}.com.br`;
      const domainCom = `${firstWord}.com`;

      const urlFavBr = `https://www.google.com/s2/favicons?domain=${domainBr}&sz=128`;
      const urlFavCom = `https://www.google.com/s2/favicons?domain=${domainCom}&sz=128`;
      const urlUnavatarBr = `https://unavatar.io/${domainBr}`;

      if (!addedUrls.has(urlFavBr)) { addedUrls.add(urlFavBr); candidates.push({ url: urlFavBr, label: `Google (${domainBr})` }); }
      if (!addedUrls.has(urlFavCom)) { addedUrls.add(urlFavCom); candidates.push({ url: urlFavCom, label: `Google (${domainCom})` }); }
      if (!addedUrls.has(urlUnavatarBr)) { addedUrls.add(urlUnavatarBr); candidates.push({ url: urlUnavatarBr, label: `Unavatar (${domainBr})` }); }

      if (words.length >= 2) {
        const combo = `${words[0].toLowerCase()}${words[1].toLowerCase()}.com.br`;
        const urlComboFav = `https://www.google.com/s2/favicons?domain=${combo}&sz=128`;
        if (!addedUrls.has(urlComboFav)) { addedUrls.add(urlComboFav); candidates.push({ url: urlComboFav, label: `Google (${combo})` }); }
      }
    }

    setLogoCandidates(candidates);
    setLogoSearchOpen(true);
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return "↑↓";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  const sortedFornecedores = useMemo(() => {
    let filtered = fornecedores.filter(f => {
      const nome = String(f.nome || "").toLowerCase();
      const cnpj = String(f.cnpj || "");
      const cidade = String(f.cidade || "").toLowerCase();
      const s = search.toLowerCase();
      return nome.includes(s) || cnpj.includes(search) || cidade.includes(s);
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let valA = String(a[sortConfig.key] || "").toLowerCase();
        let valB = String(b[sortConfig.key] || "").toLowerCase();

        if (valA < valB) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return filtered;
  }, [fornecedores, search, sortConfig]);

  const handleOpenAddModal = () => {
    setEditingFornecedor(null);
    setFormData({
      cnpj: "",
      nome: "",
      codigoItem: "",
      cidade: "",
      uf: "",
      telefone: "",
      email: "",
      status: "Ativo",
      avatarUrl: ""
    });
    setLogoSearchOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingFornecedor(item);
    setFormData({
      cnpj: item.cnpj,
      nome: item.nome,
      codigoItem: item.codigoItem,
      cidade: item.cidade,
      uf: item.uf,
      telefone: item.telefone,
      email: item.email,
      status: item.status,
      avatarUrl: item.avatarUrl || item.avatar || ""
    });
    setLogoSearchOpen(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: any) => {
    const itemCnpj = typeof item === "object" ? item.cnpj : item;
    if (confirm("Deseja realmente remover este fornecedor permanentemente?")) {
      setFornecedores(prev => prev.filter(f => f.cnpj !== itemCnpj && f.id !== item));
      if (itemCnpj) {
        await deleteFornecedorSupabase(itemCnpj);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDoc = formData.cnpj.replace(/\D/g, "");
    if (!formData.nome || !cleanDoc) {
      alert("Por favor, preencha a Razão Social e o CPF/CNPJ.");
      return;
    }
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      alert("O documento deve ter 11 dígitos para CPF ou 14 dígitos para CNPJ.");
      return;
    }

    const finalAvatar = formData.avatarUrl || getSupplierLogoUrl(formData.nome, "", formData.email);

    const payload = {
      ...formData,
      cnpj: cleanDoc,
      avatar: finalAvatar,
      avatarUrl: finalAvatar
    };

    if (editingFornecedor) {
      setFornecedores(prev => prev.map(f => (f.id === editingFornecedor.id || f.cnpj === editingFornecedor.cnpj) ? {
        ...f,
        ...payload
      } : f));
    } else {
      const newId = Date.now();
      setFornecedores(prev => [
        ...prev,
        {
          id: newId,
          ...payload
        }
      ]);
    }

    await saveFornecedorSupabase(payload);
    setIsModalOpen(false);
  };

  const toggleColumnVisibility = (col: string) => {
    setVisibleCols(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho ultra-compacto integrado para focar na tabela */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl text-[#114D38] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-black text-slate-800 leading-none">Fornecedores</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Base homologada para faturamento rápido</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor Discreto de Colunas */}
          <div className="relative" ref={colSelectorRef}>
            <button 
              onClick={() => setShowColSelector(!showColSelector)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Configurar Colunas Visíveis"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Colunas</span>
            </button>

            {showColSelector && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 z-30 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2 border-b border-slate-100 pb-1.5 text-left">
                  Visualização da Tabela
                </span>
                <div className="space-y-1">
                  {Object.keys(visibleCols).map(col => {
                    const labelMap: Record<string, string> = {
                      status: "Status do Cadastro",
                      fornecedor: "Razão Social / Nome",
                      cnpj: "CPF / CNPJ do Emitente",
                      codigo: "Cód. de Serviço",
                      telefone: "Telefone de Contato",
                      email: "E-mail Faturamento",
                      cidade: "Cidade",
                      uf: "Estado (UF)"
                    };
                    return (
                      <button
                        key={col}
                        onClick={() => toggleColumnVisibility(col)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>{labelMap[col] || col}</span>
                        {visibleCols[col] ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded border border-slate-300 block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#114D38] text-white shadow-sm hover:bg-[#0d3b2b] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Tabela de Fornecedores Redesenhada - Layout moderno com ocupação de tela e densidade otimizada de dados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden min-h-[580px] flex flex-col">
        <div className="py-2.5 px-4 border-b border-slate-150 flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50/40">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por CNPJ, Fornecedor ou Cidade..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/10 focus:border-[#114D38] outline-none transition-all text-xs font-semibold text-slate-700"
            />
          </div>
          <div className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-1.5">
            <span>🏢 Total Homologados:</span>
            <span className="text-[#114D38] font-black font-mono text-xs">{sortedFornecedores.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[520px] flex-1">
          <table className="w-full text-[10px] font-aptos text-left border-collapse border border-slate-200/70">
            <thead className="text-white text-[10px] font-black uppercase tracking-wider sticky top-0 z-20 bg-[#114D38]">
              <tr>
                <th className="px-3.5 py-3 w-20 text-center sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">AÇÕES</th>
                {visibleCols.status && <th onClick={() => handleSort("status")} className="px-3.5 py-3 cursor-pointer hover:bg-[#0c3728] transition-colors sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">STATUS {getSortIcon("status")}</th>}
                {visibleCols.fornecedor && <th onClick={() => handleSort("nome")} className="px-3.5 py-3 cursor-pointer hover:bg-[#0c3728] transition-colors sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">FORNECEDOR / EMITENTE {getSortIcon("nome")}</th>}
                {visibleCols.cnpj && <th onClick={() => handleSort("cnpj")} className="px-3.5 py-3 cursor-pointer hover:bg-[#0c3728] transition-colors sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">CPF / CNPJ {getSortIcon("cnpj")}</th>}
                {visibleCols.codigo && <th onClick={() => handleSort("codigoItem")} className="px-3.5 py-3 cursor-pointer hover:bg-[#0c3728] transition-colors sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20 whitespace-nowrap">CÓD. SERVIÇO {getSortIcon("codigoItem")}</th>}
                {visibleCols.telefone && <th className="px-3.5 py-3 sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">TELEFONE</th>}
                {visibleCols.email && <th className="px-3.5 py-3 sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">E-MAIL</th>}
                {visibleCols.cidade && <th onClick={() => handleSort("cidade")} className="px-3.5 py-3 cursor-pointer hover:bg-[#0c3728] transition-colors sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20">CIDADE {getSortIcon("cidade")}</th>}
                {visibleCols.uf && <th onClick={() => handleSort("uf")} className="px-3.5 py-3 text-right cursor-pointer hover:bg-[#00b263] transition-colors sticky top-0 bg-[#00CA71] z-20 border-b border-slate-200/20">UF {getSortIcon("uf")}</th>}
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-700 text-[10px]">
              {sortedFornecedores.map((item) => (
                <tr key={item.id} className="hover:bg-slate-100/50 transition-colors odd:bg-slate-50/15 even:bg-white border-b border-slate-200/50 last:border-b-0 group">
                  <td className="px-3.5 py-3 text-center border-r border-slate-200/50">
                    <div className="flex items-center justify-center gap-3 text-slate-400">
                      <button 
                        onClick={() => handleOpenEditModal(item)} 
                        className="hover:text-emerald-600 transition-colors p-1.5 hover:bg-slate-100 rounded cursor-pointer"
                        title="Editar Fornecedor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item)} 
                        className="hover:text-rose-600 transition-colors p-1.5 hover:bg-slate-100 rounded cursor-pointer"
                        title="Excluir Fornecedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {visibleCols.status && (
                    <td className="px-3.5 py-3 border-r border-slate-200/50">
                      <span className={cn(
                        "px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded shadow-inner flex items-center gap-1 w-fit",
                        item.status === 'Ativo' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-55 border-slate-200 text-slate-500"
                      )}>
                        <span className={cn(
                          "w-1 h-1 rounded-full",
                          item.status === 'Ativo' ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        )}/>
                        {(item.status || "").toUpperCase()}
                      </span>
                    </td>
                  )}
                  {visibleCols.fornecedor && (
                    <td className="px-3.5 py-3 border-r border-slate-200/50">
                      <div className="flex items-center gap-2">
                        <SupplierLogo name={item.nome} avatarUrl={item.avatar} />
                        <div className="font-extrabold text-slate-800 leading-snug max-w-[320px] truncate uppercase" title={item.nome}>
                          {(item.nome || "").toUpperCase()}
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleCols.cnpj && (
                    <td className="px-3.5 py-3 font-mono text-slate-850 font-extrabold whitespace-nowrap border-r border-slate-200/50">
                      {formatCPFCNPJ(item.cnpj)}
                    </td>
                  )}
                  {visibleCols.codigo && (
                    <td className="px-3.5 py-3 text-slate-900 font-mono font-black border-r border-slate-200/50 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold uppercase whitespace-nowrap">
                        {(item.codigoItem || "---").toUpperCase()}
                      </span>
                    </td>
                  )}
                  {visibleCols.telefone && (
                    <td className="px-3.5 py-3 border-r border-slate-200/50 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" /> 
                        <span className="font-bold text-slate-750">{(item.telefone || "---").toUpperCase()}</span>
                      </div>
                    </td>
                  )}
                  {visibleCols.email && (
                    <td className="px-3.5 py-3 border-r border-slate-200/50 truncate max-w-[200px]">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" /> 
                        <span className="font-bold text-slate-600 truncate" title={item.email}>{item.email || "---"}</span>
                      </div>
                    </td>
                  )}
                  {visibleCols.cidade && (
                    <td className="px-3.5 py-3 border-r border-slate-200/50">
                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <MapPin className="w-3 h-3 text-[#114D38] flex-none" />
                        <span>{(item.cidade || "---").toUpperCase()}</span>
                      </div>
                    </td>
                  )}
                  {visibleCols.uf && (
                    <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900 bg-emerald-50/15">
                      {(item.uf || "---").toUpperCase()}
                    </td>
                  )}
                </tr>
              ))}
              {sortedFornecedores.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400 bg-slate-50/50 font-bold">
                    Nenhum fornecedor encontrado para essa busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Adição/Edição de Fornecedores */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-[#114D38] px-6 py-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold font-display">{editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
                <p className="text-xs text-emerald-100 mt-0.5">Cadastre ou edite as informações cadastrais do fornecedor</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-emerald-100 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Razão Social *</label>
                  <input 
                    type="text" 
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-semibold text-slate-800 shadow-sm"
                    placeholder="Ex: Auto Posto Paulínia Ltda"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">CPF/CNPJ *</label>
                  <input 
                    type="text" 
                    value={formData.cnpj}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value.replace(/\D/g, "") }))}
                    maxLength={14}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-mono text-slate-800 shadow-sm"
                    placeholder="Somente números (11 ou 14 dígitos)"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Código de Item/Serviço</label>
                  <input 
                    type="text" 
                    value={formData.codigoItem}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigoItem: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-mono text-slate-800 shadow-sm"
                    placeholder="Ex: SV-0012"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Telefone de Contato</label>
                  <input 
                    type="text" 
                    value={formData.telefone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm text-slate-800 shadow-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">E-mail para Faturamento</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm text-slate-800 shadow-sm"
                    placeholder="financeiro@empresa.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cidade</label>
                  <input 
                    type="text" 
                    value={formData.cidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm text-slate-800 shadow-sm"
                    placeholder="Cidade"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado (UF)</label>
                  <input 
                    type="text" 
                    value={formData.uf}
                    onChange={(e) => setFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                    maxLength={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm uppercase text-slate-800 shadow-sm"
                    placeholder="SP"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status do Cadastro</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-bold text-slate-800 shadow-sm"
                  >
                    <option value="Ativo">🟢 Ativo</option>
                    <option value="Inativo">🔴 Inativo</option>
                  </select>
                </div>

                {/* LOGOTIPO DA EMPRESA & PESQUISA AVANÇADA */}
                <div className="space-y-2 col-span-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#114D38]" />
                      Logotipo Personalizado da Empresa
                    </label>
                    <button
                      type="button"
                      onClick={handleSearchLogos}
                      className="text-xs font-extrabold text-[#114D38] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Search className="w-3.5 h-3.5" /> Pesquisar Logotipo na Web
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-2xs">
                      <SupplierLogo name={formData.nome || "F"} avatarUrl={formData.avatarUrl} email={formData.email} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input 
                        type="url"
                        value={formData.avatarUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                        placeholder="Cole a URL direta da imagem da logo ou use a pesquisa acima"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-700 focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none shadow-2xs"
                      />
                    </div>
                    {formData.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatarUrl: "" }))}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded bg-rose-50 border border-rose-200 shrink-0 cursor-pointer"
                      >
                        Resetar
                      </button>
                    )}
                  </div>

                  {/* PAINEL DE RESULTADOS DA PESQUISA AVANÇADA */}
                  {logoSearchOpen && (
                    <div className="bg-gradient-to-br from-emerald-50/90 to-slate-50 p-3 rounded-xl border border-emerald-200 space-y-2 mt-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-900 flex items-center gap-1">
                          ✨ Logotipos Encontrados para "{formData.nome || formData.email}"
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setLogoSearchOpen(false)}
                          className="text-[10px] text-slate-500 font-bold hover:text-slate-800"
                        >
                          Fechar
                        </button>
                      </div>

                      {logoCandidates.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {logoCandidates.map((cand, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, avatarUrl: cand.url }));
                                setLogoSearchOpen(false);
                              }}
                              className="bg-white p-2 rounded-lg border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col items-center justify-between text-center gap-1.5 cursor-pointer group"
                            >
                              <div className="w-8 h-8 rounded bg-slate-50 p-1 border border-slate-100 flex items-center justify-center overflow-hidden">
                                <img 
                                  src={cand.url} 
                                  alt={cand.label}
                                  className="w-full h-full object-contain"
                                  onError={(e: any) => {
                                    e.target.onerror = null;
                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.nome || "F")}&background=114D38&color=fff`;
                                  }}
                                />
                              </div>
                              <span className="text-[9px] font-bold text-slate-600 group-hover:text-emerald-800 truncate w-full">
                                {cand.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-2">Nenhum logotipo comercial encontrado para os termos informados.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 rounded-lg text-sm font-bold bg-[#114D38] text-white hover:bg-[#0d3b2b] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

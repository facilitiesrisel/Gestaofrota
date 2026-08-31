import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, CheckCircle2, Clock, Truck, Search, Filter, 
  Calendar, Phone, Mail, MessageSquare, Download, Copy, Check,
  ChevronRight, RefreshCw, AlertCircle, ArrowUpDown, ShieldAlert,
  Building2, UserX, ExternalLink, Sparkles
} from "lucide-react";
import { cn, toTitleCase } from "../../lib/utils";

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
}

interface Vehicle {
  id: string;
  placa: string;
  modelo: string;
  condutor?: string;
  funcao?: string;
  contatoMotorista?: string;
  gestorResp?: string;
  email?: string;
  filial?: string;
  locadora?: string;
  status?: string;
  odometro?: number;
  base?: string;
}

interface ChecklistAlertasProps {
  checklists: Checklist[];
  vehicles: Vehicle[];
  onOpenChecklistFormForPlate?: (plate: string) => void;
}

export function ChecklistAlertas({ 
  checklists, 
  vehicles,
  onOpenChecklistFormForPlate 
}: ChecklistAlertasProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

  // Estado do Mês/Ano selecionado para a análise de pendências
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(`${currentMonth}/${currentYear}`);
  
  // Filtros adicionais
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBase, setFilterBase] = useState("");
  const [filterLocadora, setFilterLocadora] = useState("");
  const [filterStatusVeiculo, setFilterStatusVeiculo] = useState("Ativo");
  const [copiedPlate, setCopiedPlate] = useState<string | null>(null);

  // Lista de opções de meses disponíveis para consulta (últimos 24 meses)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string; year: number; month: number }[] = [];
    const date = new Date(currentYear, now.getMonth(), 1);

    for (let i = 0; i < 24; i++) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const monthName = monthNames[date.getMonth()];
      
      options.push({
        value: `${m}/${y}`,
        label: `${monthName} de ${y}`,
        year: y,
        month: date.getMonth() + 1
      });

      date.setMonth(date.getMonth() - 1);
    }
    return options;
  }, [currentYear, now]);

  // Lista única de bases/filiais
  const baseOptions = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => {
      if (v.filial) set.add(v.filial.toUpperCase().trim());
      if (v.base) set.add(v.base.toUpperCase().trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [vehicles]);

  // Lista única de locadoras
  const locadoraOptions = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => {
      if (v.locadora) set.add(v.locadora.toUpperCase().trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [vehicles]);

  // Mapeamento dos checklists do mês selecionado
  const monthData = useMemo(() => {
    const [m, y] = selectedMonthYear.split("/");
    const prefix = `${y}-${m}`;

    // Map com o último checklist de cada placa no mês
    const checklistMapByPlate = new Map<string, Checklist>();
    // Map com o último checklist histórico global de cada placa
    const lastGlobalChecklistByPlate = new Map<string, Checklist>();

    // Ordena checklists por data decrescente
    const sortedChecklists = [...checklists].sort((a, b) => {
      const dateA = new Date(a.data || 0).getTime();
      const dateB = new Date(b.data || 0).getTime();
      return dateB - dateA;
    });

    sortedChecklists.forEach(c => {
      if (!c.placa) return;
      const cleanPlate = c.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (!lastGlobalChecklistByPlate.has(cleanPlate)) {
        lastGlobalChecklistByPlate.set(cleanPlate, c);
      }

      if (c.data && c.data.startsWith(prefix)) {
        if (!checklistMapByPlate.has(cleanPlate)) {
          checklistMapByPlate.set(cleanPlate, c);
        }
      }
    });

    // Veículos considerados
    const consideredVehicles = vehicles.filter(v => {
      if (filterStatusVeiculo === "Ativo" && v.status === "Inativo") return false;
      if (filterStatusVeiculo === "Inativo" && v.status !== "Inativo") return false;
      if (filterBase) {
        const vBase = (v.filial || v.base || "").toUpperCase();
        if (!vBase.includes(filterBase.toUpperCase())) return false;
      }
      if (filterLocadora) {
        const vLoc = (v.locadora || "").toUpperCase();
        if (!vLoc.includes(filterLocadora.toUpperCase())) return false;
      }
      return true;
    });

    const realizadosList: { vehicle: Vehicle; checklist: Checklist }[] = [];
    const pendentesList: { 
      vehicle: Vehicle; 
      lastChecklist?: Checklist; 
      diasSemChecklist: number | null;
      statusAlerta: "Critico" | "Alerta" | "Pendente";
    }[] = [];

    consideredVehicles.forEach(v => {
      const cleanPlate = v.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const checkInMonth = checklistMapByPlate.get(cleanPlate);

      if (checkInMonth) {
        realizadosList.push({ vehicle: v, checklist: checkInMonth });
      } else {
        const lastGlobal = lastGlobalChecklistByPlate.get(cleanPlate);
        let dias = null;
        let statusAlerta: "Critico" | "Alerta" | "Pendente" = "Pendente";

        if (lastGlobal && lastGlobal.data) {
          const lastDate = new Date(lastGlobal.data);
          const diffTime = Math.abs(now.getTime() - lastDate.getTime());
          dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (dias > 60) {
            statusAlerta = "Critico";
          } else if (dias > 30) {
            statusAlerta = "Alerta";
          } else {
            statusAlerta = "Pendente";
          }
        } else {
          statusAlerta = "Critico"; // Nunca realizou checklist
        }

        pendentesList.push({
          vehicle: v,
          lastChecklist: lastGlobal,
          diasSemChecklist: dias,
          statusAlerta
        });
      }
    });

    // Ordenar pendentes: Críticos primeiro, depois mais dias sem checklist
    pendentesList.sort((a, b) => {
      const diasA = a.diasSemChecklist ?? 9999;
      const diasB = b.diasSemChecklist ?? 9999;
      return diasB - diasA;
    });

    return {
      totalConsiderados: consideredVehicles.length,
      realizadosCount: realizadosList.length,
      pendentesCount: pendentesList.length,
      realizadosList,
      pendentesList,
      taxaAderencia: consideredVehicles.length > 0 
        ? Math.round((realizadosList.length / consideredVehicles.length) * 100) 
        : 0
    };
  }, [checklists, vehicles, selectedMonthYear, filterStatusVeiculo, filterBase, filterLocadora]);

  // Filtro de busca na lista de pendentes
  const filteredPendentes = useMemo(() => {
    if (!searchQuery.trim()) return monthData.pendentesList;
    const query = searchQuery.toLowerCase().trim();

    return monthData.pendentesList.filter(item => {
      const v = item.vehicle;
      const p = v.placa.toLowerCase();
      const m = (v.modelo || "").toLowerCase();
      const c = (v.condutor || "").toLowerCase();
      const g = (v.gestorResp || "").toLowerCase();
      const f = (v.filial || v.base || "").toLowerCase();
      const em = (v.email || "").toLowerCase();
      return p.includes(query) || m.includes(query) || c.includes(query) || g.includes(query) || f.includes(query) || em.includes(query);
    });
  }, [monthData.pendentesList, searchQuery]);

  const handleSendWhatsAppReminder = (item: typeof monthData.pendentesList[0]) => {
    const v = item.vehicle;
    const condutorNome = v.condutor ? toTitleCase(v.condutor.trim()) : "Condutor(a)";
    const linkChecklist = `${window.location.origin}/c`;
    
    // Mensagem gentil, profissional e corporativa
    const mensagem = `Olá, ${condutorNome}! Tudo bem? Esperamos que você esteja tendo um excelente dia. 🚗✨

Aqui é da equipe de Gestão de Frota da *Risel Combustíveis*.

Identificamos em nosso sistema que a inspeção mensal de checklist do veículo *${v.placa}* (${v.modelo || "Frota"}) referente à competência de *${selectedMonthYear}* ainda está pendente de realização.

Por favor, reserve alguns minutos para preencher o formulário no link abaixo:
👉 ${linkChecklist}

Se já tiver preenchido recentemente ou tiver qualquer dúvida, fique à vontade para nos avisar. Agradecemos muito pela parceria e cuidado de sempre! 

Atenciosamente,
*Gestão de Frota • Risel Combustíveis*`;

    // Limpar telefone: remover caracteres não numéricos
    let rawPhone = (v.contatoMotorista || "").replace(/\D/g, "");
    if (rawPhone) {
      // Se não tiver DDI (55), adiciona se tiver tamanho de celular brasileiro (10 ou 11 dígitos)
      if (rawPhone.length === 10 || rawPhone.length === 11) {
        rawPhone = "55" + rawPhone;
      }
      const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(mensagem)}`;
      window.open(whatsappUrl, "_blank");
    } else {
      // Caso o condutor não tenha telefone cadastrado na planilha de frota, copia o texto e abre WhatsApp Web
      navigator.clipboard.writeText(mensagem);
      setCopiedPlate(v.placa);
      setTimeout(() => setCopiedPlate(null), 3000);
      alert(`⚠️ O condutor ${v.condutor || "do veículo"} não possui telefone cadastrado no Controle de Frota.\n\nA mensagem gentil e profissional foi copiada para sua Área de Transferência!`);
      window.open(`https://web.whatsapp.com/`, "_blank");
    }
  };

  const handleCopyNotification = (item: typeof monthData.pendentesList[0]) => {
    const v = item.vehicle;
    const condutorNome = v.condutor ? toTitleCase(v.condutor.trim()) : "Condutor(a)";
    const text = `Olá, ${condutorNome}! Tudo bem? 

Lembramos que a inspeção veicular obrigatória da *Risel Combustíveis* para o veículo *${v.placa}* (${v.modelo || "Frota"}) referente a *${selectedMonthYear}* está pendente.

Por gentileza, realize o checklist através do link seguro:
👉 ${window.location.origin}/c

Agradecemos pela colaboração!
*Gestão de Frota Risel*`;

    navigator.clipboard.writeText(text);
    setCopiedPlate(v.placa);
    setTimeout(() => setCopiedPlate(null), 2500);
  };

  const handleExportCsv = () => {
    const [m, y] = selectedMonthYear.split("/");
    const headers = [
      "Placa",
      "Modelo",
      "Condutor",
      "Funcao",
      "Telefone",
      "Email",
      "Gestor",
      "Filial/Base",
      "Locadora",
      "Status Veiculo",
      "Mes Referencia",
      "Ultimo Checklist Data",
      "Dias Sem Checklist",
      "Gravidade Alerta"
    ];

    const rows = filteredPendentes.map(item => {
      const v = item.vehicle;
      return [
        v.placa,
        `"${v.modelo || ""}"`,
        `"${v.condutor || ""}"`,
        `"${v.funcao || ""}"`,
        `"${v.contatoMotorista || ""}"`,
        `"${v.email || ""}"`,
        `"${v.gestorResp || ""}"`,
        `"${v.filial || v.base || ""}"`,
        `"${v.locadora || ""}"`,
        v.status || "Ativo",
        selectedMonthYear,
        item.lastChecklist?.data ? item.lastChecklist.data.substring(0, 10) : "Nunca Realizado",
        item.diasSemChecklist !== null ? item.diasSemChecklist : "N/D",
        item.statusAlerta
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `veiculos_sem_checklist_${m}_${y}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyFullReport = () => {
    const [m, y] = selectedMonthYear.split("/");
    let text = `🚨 *RELATÓRIO DE VEÍCULOS SEM CHECKLIST - RISEL COMBUSTÍVEIS*\n`;
    text += `📅 *Mês de Referência:* ${selectedMonthYear}\n`;
    text += `📊 *Total da Frota Analisada:* ${monthData.totalConsiderados} veículos\n`;
    text += `✅ *Checklists Realizados:* ${monthData.realizadosCount} (${monthData.taxaAderencia}%)\n`;
    text += `❌ *Pendentes no Mês:* ${monthData.pendentesCount} veículos\n\n`;
    text += `*LISTA DE VEÍCULOS PENDENTES:*\n`;

    filteredPendentes.forEach((item, idx) => {
      const v = item.vehicle;
      const ultimo = item.lastChecklist?.data ? item.lastChecklist.data.substring(0, 10) : "Nunca";
      text += `${idx + 1}. *${v.placa}* - ${v.modelo} | Condutor: ${v.condutor || "N/I"} | Base: ${v.filial || "Matriz"} | Último: ${ultimo}\n`;
    });

    text += `\n🔗 *Link para preenchimento pelos motoristas:* ${window.location.origin}/c`;

    navigator.clipboard.writeText(text);
    alert("📋 Relatório completo copiado para a área de transferência!");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 text-slate-800 text-left overflow-hidden">
      
      {/* Barra Superior de Filtro & Mês de Referência (Congelada no Topo) */}
      <div className="shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Seletor de Mês/Ano com Navegação Rápida */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                  Mês de Referência do Alerta
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={selectedMonthYear}
                    onChange={(e) => setSelectedMonthYear(e.target.value)}
                    className="bg-amber-50/50 hover:bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-black text-amber-900 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer shadow-2xs"
                  >
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} {opt.value === `${currentMonth}/${currentYear}` ? " (Mês Atual)" : ""}
                      </option>
                    ))}
                  </select>

                  {/* Botão Atalho Mês Atual */}
                  {selectedMonthYear !== `${currentMonth}/${currentYear}` && (
                    <button
                      type="button"
                      onClick={() => setSelectedMonthYear(`${currentMonth}/${currentYear}`)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 hover:bg-emerald-100 text-[#114D38] border border-emerald-200 transition-colors cursor-pointer"
                    >
                      Ir para Mês Atual
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ações e Exportação */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFullReport}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copiar texto consolidado para enviar por WhatsApp ou E-mail"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copiar Relatório</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-bold text-[#114D38] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Baixar lista em formato CSV (Excel)"
            >
              <Download className="w-3.5 h-3.5 text-[#114D38]" />
              <span>Exportar Excel/CSV</span>
            </button>
          </div>
        </div>

        {/* Filtros em Linha: Busca, Base e Status do Veículo */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Busca por Placa, Condutor, Modelo */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por placa, condutor..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filtro Filial/Base */}
          <div>
            <select
              value={filterBase}
              onChange={(e) => setFilterBase(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="">Todas as Filiais/Bases</option>
              {baseOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filtro Locadora */}
          <div>
            <select
              value={filterLocadora}
              onChange={(e) => setFilterLocadora(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="">Todas as Locadoras</option>
              {locadoraOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Status do Veículo */}
          <div>
            <select
              value={filterStatusVeiculo}
              onChange={(e) => setFilterStatusVeiculo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="Ativo">Apenas Frota Ativa</option>
              <option value="Todos">Todos (Ativos e Inativos)</option>
              <option value="Inativo">Apenas Inativos</option>
            </select>
          </div>

        </div>
      </div>

      {/* Cards de Resumo & Indicadores de Alerta */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Card 1: Total da Frota Analisada */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Frota Analisada no Mês
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-display font-black text-slate-800">
                {monthData.totalConsiderados}
              </span>
              <span className="text-[11px] font-bold text-slate-500">veículos</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Checklists Realizados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">
              Checklists Realizados ({selectedMonthYear})
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-display font-black text-emerald-600">
                {monthData.realizadosCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {monthData.taxaAderencia}% em dia
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Veículos Sem Checklist (Pendentes / Alerta) */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-100 tracking-wider block">
              Veículos Sem Checklist no Mês
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-display font-black text-white">
                {monthData.pendentesCount}
              </span>
              <span className="text-[11px] font-black text-amber-100 bg-black/20 px-2 py-0.5 rounded-md">
                {100 - monthData.taxaAderencia}% pendente
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Tabela de Veículos com Checklist Pendente */}
      <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
        
        {/* Cabeçalho da Tabela */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Lista de Veículos Não Inspecionados ({selectedMonthYear})
            </h3>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-full">
              {filteredPendentes.length} pendentes
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Exibindo veículos que não possuem registro de checklist na competência selecionada
          </div>
        </div>

        {/* Corpo com Scroll da Tabela */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredPendentes.length === 0 ? (
            <div className="h-full py-16 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800">Parabéns! Nenhum veículo pendente</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Todos os veículos com os filtros selecionados realizaram o checklist com sucesso no mês {selectedMonthYear}.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 z-10">
                <tr>
                  <th className="py-3 px-4">Veículo / Placa</th>
                  <th className="py-3 px-4">Condutor & Função</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Filial / Base</th>
                  <th className="py-3 px-4">Último Checklist</th>
                  <th className="py-3 px-4">Gravidade</th>
                  <th className="py-3 px-4 text-right">Ações de Cobrança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPendentes.map((item) => {
                  const v = item.vehicle;
                  const last = item.lastChecklist;
                  const isCopied = copiedPlate === v.placa;

                  return (
                    <tr key={v.id || v.placa} className="hover:bg-amber-50/30 transition-colors">
                      
                      {/* Veículo / Placa */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md font-black text-slate-800 text-[11.5px]">
                            {v.placa}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-xs truncate max-w-[160px]">
                              {v.modelo}
                            </span>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              {v.locadora || "Próprio"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Condutor & Função */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 block">
                            {v.condutor || <span className="text-slate-400 italic">Não alocado</span>}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {v.funcao || "Motorista Operacional"}
                          </span>
                        </div>
                      </td>

                      {/* E-mail (do cadastro na Gestão de Frota Leve) */}
                      <td className="py-3 px-4">
                        {v.email ? (
                          <a 
                            href={`mailto:${v.email}`} 
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#114D38] hover:underline group"
                            title={`Enviar e-mail para ${v.email}`}
                          >
                            <Mail className="w-3.5 h-3.5 text-[#114D38] shrink-0" />
                            <span className="truncate max-w-[190px]">{v.email}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Não cadastrado</span>
                        )}
                      </td>

                      {/* Filial / Base */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10.5px] border border-slate-200/60 inline-block">
                          {v.filial || v.base || "Matriz"}
                        </span>
                      </td>

                      {/* Último Checklist */}
                      <td className="py-3 px-4">
                        {last && last.data ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block">
                              {new Date(last.data).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              há {item.diasSemChecklist} dias
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10.5px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            Nunca Realizado
                          </span>
                        )}
                      </td>

                      {/* Gravidade */}
                      <td className="py-3 px-4">
                        {item.statusAlerta === "Critico" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                            <AlertCircle className="w-3 h-3" /> Crítico
                          </span>
                        ) : item.statusAlerta === "Alerta" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" /> Atenção
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Botão de Enviar Lembrete no WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsAppReminder(item)}
                            className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Enviar lembrete gentil e profissional no WhatsApp do Condutor"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Lembrete WhatsApp</span>
                          </button>

                          {/* Copiar mensagem de cobrança formatada */}
                          <button
                            type="button"
                            onClick={() => handleCopyNotification(item)}
                            className={cn(
                              "p-1.5 rounded-lg text-[10.5px] font-extrabold transition-all flex items-center gap-1 border cursor-pointer",
                              isCopied
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white hover:bg-amber-50 text-amber-700 border-amber-200"
                            )}
                            title="Copiar texto do lembrete para colar manualmente"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Link de preenchimento rápido */}
                          {onOpenChecklistFormForPlate && (
                            <button
                              type="button"
                              onClick={() => onOpenChecklistFormForPlate(v.placa)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                              title="Preencher checklist para este veículo agora"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}

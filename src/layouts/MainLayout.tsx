import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, CalendarDays, Home, Bell, Search, ChevronLeft, ChevronRight, LogOut, Settings, Shield, Mail, Eye, X, AlertTriangle, Edit2, Check, CheckSquare, ShieldAlert, Navigation, LayoutGrid, Clock, Activity, DollarSign, BarChart3, Plus, FileSpreadsheet, Map, KeyRound, Siren, BellRing, Car, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth, hasModuleAccess, hasSubmoduleAccess } from "../context/AuthContext";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { UserProfileBadge } from "../components/UserProfileBadge";
import { DocumentoAnexoModal } from "../components/documentos/DocumentoAnexoModal";

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [selectedDocToView, setSelectedDocToView] = useState<any | null>(null);
  const [vencimentosAlerta, setVencimentosAlerta] = useState<any[]>([]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Marcar uma notificação como lida
  const handleMarkAsRead = (id: string | number) => {
    const lidasSaved = localStorage.getItem("risel_notificacoes_lidas");
    const lidasIds: string[] = lidasSaved ? JSON.parse(lidasSaved) : [];
    if (!lidasIds.includes(String(id))) {
      lidasIds.push(String(id));
      localStorage.setItem("risel_notificacoes_lidas", JSON.stringify(lidasIds));
    }
    // Remove da lista exibida na hora
    setVencimentosAlerta(prev => prev.filter(v => String(v.id) !== String(id)));
  };

  // Carregar os alertas com base no localStorage de faturas reais com status Aguardando Aprovação que vencem em até 7 dias
  useEffect(() => {
    const loadAlertas = () => {
      const savedLanc = localStorage.getItem("risel_lancamentos");
      const lidasSaved = localStorage.getItem("risel_notificacoes_lidas");
      const lidasIds: string[] = lidasSaved ? JSON.parse(lidasSaved) : [];

      if (savedLanc) {
        try {
          const todos = JSON.parse(savedLanc);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          const alertas = todos
            .filter((item: any) => {
              // Se já foi lida, não exibe no sininho
              const isLida = lidasIds.includes(String(item.id));
              if (isLida) return false;

              // REGRA ESTRITA: Apenas status "Aguardando aprovação"
              const st = (item.status || "").toLowerCase().trim();
              const isAguardando = st === "aguardando aprovação" || st === "aguardando aprovacao" || st === "aguardando";
              if (!isAguardando) return false;

              // Calcular dias para vencimento
              let dias = 0;
              if (item.dataVencimento) {
                const dateStr = String(item.dataVencimento).trim();
                const dataVenc = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00");
                if (!isNaN(dataVenc.getTime())) {
                  const diffTime = dataVenc.getTime() - hoje.getTime();
                  dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
              }

              // REGRA ESTRITA: Vencimentos a partir de 7 dias (vencem em até 7 dias ou vencidos)
              return dias <= 7;
            })
            .map((item: any) => {
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              let dias = 0;
              if (item.dataVencimento) {
                const dateStr = String(item.dataVencimento).trim();
                const dataVenc = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00");
                if (!isNaN(dataVenc.getTime())) {
                  const diffTime = dataVenc.getTime() - hoje.getTime();
                  dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
              }
              return {
                id: item.id,
                fornecedor: item.fornecedor,
                doc: item.doc || `NFe-${item.idSys || item.id}`,
                valor: item.valor,
                vencimento: item.dataVencimento,
                status: item.status,
                dias: dias,
                nomeArquivoAnexo: item.nomeArquivoAnexo || "",
                arquivoAnexoBase64: item.arquivoAnexoBase64 || ""
              };
            })
            .sort((a: any, b: any) => a.dias - b.dias);

          setVencimentosAlerta(alertas);
        } catch (e) {
          setVencimentosAlerta([]);
        }
      } else {
        setVencimentosAlerta([]);
      }
    };

    loadAlertas();

    window.addEventListener("risel_lancamentos_updated", loadAlertas);
    window.addEventListener("storage", loadAlertas);
    const interval = setInterval(loadAlertas, 20000);

    return () => {
      window.removeEventListener("risel_lancamentos_updated", loadAlertas);
      window.removeEventListener("storage", loadAlertas);
      clearInterval(interval);
    };
  }, [isNotificationsOpen]);

  const isFrota = location.pathname.startsWith("/frota");
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get("tab") || "portal";

  // Verificar se o submódulo da frota está autenticado no localStorage
  const [authUpdate, setAuthUpdate] = useState(0);
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthUpdate(prev => prev + 1);
    };
    window.addEventListener("risel_submodule_auth_change", handleAuthChange);
    return () => window.removeEventListener("risel_submodule_auth_change", handleAuthChange);
  }, []);

  const isSubModuleAuthenticated = (tab: string) => {
    if (tab === "portal") return true;
    if (user && user.email) return true;
    const auths = localStorage.getItem("risel_auth_submodules");
    if (!auths) return false;
    try {
      const parsed = JSON.parse(auths);
      return !!parsed[tab];
    } catch (e) {
      return false;
    }
  };

  const isCleanView = isFrota && (activeTab === "portal" || !isSubModuleAuthenticated(activeTab));
  
  // Filtrar os itens de menu com base nas permissões do usuário logado e módulo ativo
  let baseMenuItems = [];

  if (isFrota) {
    if (activeTab === "portal") {
      baseMenuItems = [
        { name: "Início", path: "/", icon: Home, visible: true },
        { name: "Portal da Frota", path: "/frota?tab=portal", icon: LayoutGrid, visible: true },
      ];
    } else {
      // Estamos em um submódulo autenticado da Frota Leve!
      // Mostrar "Início" e as sub-seções específicas do módulo atual no menu lateral
      baseMenuItems = [
        { name: "Início", path: "/", icon: Home, visible: true },
      ];

      if (activeTab === "frota") {
        baseMenuItems.push(
          { name: "Todos os Veículos", path: "/frota?tab=frota&sub=veiculos", icon: Car, visible: true },
          { name: "Contratos Próximos", path: "/frota?tab=frota&sub=vencidos", icon: Clock, visible: true },
          { name: "Abastecimento", path: "/frota?tab=frota&sub=custos", icon: DollarSign, visible: true },
          { name: "Manutenção", path: "/frota?tab=frota&sub=manutencao", icon: Wrench, visible: true }
        );
      } else if (activeTab === "checklist") {
        baseMenuItems.push(
          { name: "Dashboard", path: "/frota?tab=checklist&sub=dashboard", icon: LayoutDashboard, visible: true },
          { name: "Checklists Realizados", path: "/frota?tab=checklist&sub=realizados", icon: FileSpreadsheet, visible: true },
          { name: "Checklists Pendentes", path: "/frota?tab=checklist&sub=alertas", icon: AlertTriangle, visible: true },
          { name: "Formulário Checklist", path: "/frota?tab=checklist&sub=formulario", icon: CheckSquare, visible: true }
        );
      } else if (activeTab === "reservas") {
        const isAdminLogado = Boolean(user && user.email) || localStorage.getItem("reserva_admin_logado") === "true";
        if (isAdminLogado) {
          baseMenuItems.push(
            { name: "Dashboard Analítico", path: "/frota?tab=reservas&sub=dashboard", icon: BarChart3, visible: true },
            { name: "Gestão de Reservas", path: "/frota?tab=reservas&sub=reservations", icon: FileText, visible: true },
            { name: "Diário de Bordo", path: "/frota?tab=reservas&sub=dailyUse", icon: CheckSquare, visible: true },
            { name: "Frota de Veículos", path: "/frota?tab=reservas&sub=vehicles", icon: Car, visible: true },
            { name: "Status da Frota", path: "/frota?tab=reservas&sub=fleetStatus", icon: Activity, visible: true },
            { name: "Locações RAC", path: "/frota?tab=reservas&sub=racRentals", icon: DollarSign, visible: true },
            { name: "Sair do Admin", path: "/frota?tab=reservas&sub=logout_reservas", icon: LogOut, visible: true }
          );
        } else {
          baseMenuItems.push(
            { name: "Solicitar Reserva", path: "/frota?tab=reservas&sub=request", icon: FileText, visible: true },
            { name: "Solicitar Veículo Locado", path: "/frota?tab=reservas&sub=racRequest", icon: Car, visible: true },
            { name: "Uso Diário", path: "/frota?tab=reservas&sub=dailyUse", icon: CheckSquare, visible: true },
            { name: "Status da Frota", path: "/frota?tab=reservas&sub=fleetStatus", icon: Activity, visible: true },
            { name: "Área Administrativa", path: "/frota?tab=reservas&sub=login", icon: Shield, visible: true }
          );
        }
      } else if (activeTab === "multas") {
        baseMenuItems.push(
          { name: "Dashboard", path: "/frota?tab=multas&sub=dashboard", icon: LayoutDashboard, visible: true },
          { name: "Multas", path: "/frota?tab=multas&sub=multas", icon: Siren, visible: true },
          { name: "Alertas", path: "/frota?tab=multas&sub=alertas", icon: BellRing, visible: true },
          { name: "Configurações", path: "/frota?tab=multas&sub=config", icon: Settings, visible: true }
        );
      } else if (activeTab === "rastreamento") {
        baseMenuItems.push(
          { name: "Dashboard Telemetria", path: "/frota?tab=rastreamento&sub=dashboard", icon: LayoutDashboard, visible: true },
          { name: "Mapa e Grid ao Vivo", path: "/frota?tab=rastreamento&sub=mapa", icon: Navigation, visible: true },
          { name: "Alertas e Sensores", path: "/frota?tab=rastreamento&sub=alertas", icon: Activity, visible: true },
          { name: "Relatórios e Cercas", path: "/frota?tab=rastreamento&sub=relatorios", icon: FileSpreadsheet, visible: true }
        );
      }
    }
  } else {
    baseMenuItems = [
      { name: "Início", path: "/", icon: Home, visible: true },
      { name: "Dashboard", path: "/documentos/dashboard", icon: LayoutDashboard, visible: hasModuleAccess(user?.permissions, "dashboard") },
      { name: "Lançamento", path: "/documentos/lancamento", icon: FileText, visible: hasModuleAccess(user?.permissions, "lancamentos") },
      { name: "Fornecedores", path: "/documentos/fornecedores", icon: Users, visible: hasModuleAccess(user?.permissions, "fornecedores") },
    ];
  }

  const menuItems = baseMenuItems.filter(item => item.visible);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (isCleanView) {
    return (
      <div className="min-h-screen bg-slate-100/80 w-full overflow-y-auto relative">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden w-full text-left">
      {/* Sidebar - Estilo Premium Matte Escuro, mais estreito para CRM moderno */}
      <aside className={cn(
        "bg-[#07110C] border-r border-slate-800/40 py-8 hidden md:flex flex-col relative z-20 flex-shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16 pl-3 pr-0" : "w-52 pl-4 pr-0"
      )}>
        <div className={cn("mb-10 flex items-center gap-2.5 transition-all", isCollapsed ? "pr-3" : "pr-4")}>
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg shadow-emerald-500/20 shrink-0">
            <img 
              src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" 
              alt="Logo Risel" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
              <h1 className="text-sm font-display font-black text-white leading-none">Risel</h1>
              <p className="text-[8px] text-emerald-400 font-black tracking-wider uppercase mt-1">Combustíveis</p>
            </div>
          )}
        </div>
        
        <nav className="flex-1 space-y-1 overflow-x-hidden pr-2">
          {menuItems.map((item) => {
            const currentFull = location.pathname + location.search;
            
            // Verificação inteligente de link ativo para sub-abas de frota e crm
            let isActive = false;
            if (item.path.includes("?")) {
              try {
                const itemUrl = new URL(item.path, window.location.origin);
                const currentUrl = new URL(currentFull, window.location.origin);
                
                const itemTab = itemUrl.searchParams.get("tab");
                const currentTab = currentUrl.searchParams.get("tab") || "portal";
                
                if (itemTab === currentTab) {
                  const itemSub = itemUrl.searchParams.get("sub");
                  const currentSub = currentUrl.searchParams.get("sub");
                  
                  if (itemSub) {
                    const isAdminLogado = localStorage.getItem("reserva_admin_logado") === "true";
                    const defaultReservaSub = isAdminLogado ? "dashboard" : "request";
                    isActive = itemSub === currentSub || (!currentSub && (
                      (currentTab === "frota" && itemSub === "veiculos") || 
                      (currentTab === "checklist" && itemSub === "dashboard") || 
                      (currentTab === "reservas" && itemSub === defaultReservaSub) || 
                      (currentTab === "multas" && itemSub === "dashboard") || 
                      (currentTab === "rastreamento" && itemSub === "dashboard")
                    ));
                  } else {
                    isActive = !currentSub;
                  }
                }
              } catch (e) {
                isActive = currentFull === item.path;
              }
            } else {
              isActive = location.pathname === item.path;
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 relative transition-all duration-200 font-bold text-xs gap-3 rounded-xl",
                  isActive 
                    ? isFrota
                      ? "bg-orange-500/10 text-orange-500 shadow-sm border-l-4 border-orange-500 font-extrabold"
                      : "bg-emerald-500/10 text-emerald-400 shadow-sm border-l-4 border-emerald-500 font-extrabold" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? (isFrota ? "text-orange-500" : "text-emerald-400") : "text-slate-400 group-hover:text-slate-200")} />
                {!isCollapsed && <span className="animate-in fade-in duration-300 whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        
        {/* Adicionado menu inferior condicional de Usuários (Restrito a deny.goncalves@risel.com.br) */}
        <div className="mt-auto space-y-1 pr-2">
          {!isFrota && (user?.email?.toLowerCase() === "deny.goncalves@risel.com.br") && (
            <Link
              to="/documentos/usuarios"
              className={cn(
                "flex items-center py-2.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded-xl transition-all duration-200 font-bold text-xs gap-3 px-3",
                location.pathname === "/documentos/usuarios" ? "bg-emerald-500/10 text-emerald-400 shadow-sm border-l-4 border-emerald-500 font-extrabold" : ""
              )}
              title={isCollapsed ? "Usuários" : undefined}
            >
              <Users className="w-[18px] h-[18px] shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">Usuários</span>}
            </Link>
          )}
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute top-4 w-6 h-6 bg-[#114D38]/20 hover:bg-[#114D38]/40 border border-emerald-500/25 rounded-full shadow-md flex items-center justify-center text-slate-300 hover:text-emerald-400 z-30 transition-all cursor-pointer",
            isCollapsed ? "left-1/2 -translate-x-1/2 mt-12" : "right-3"
          )}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Top Header - Apenas para o módulo de Documentos (No módulo de Frota, o cabeçalho integrado no topo da página une título, menu e perfil do usuário para ganho máximo de espaço) */}
        {!isFrota && (
          <header className="h-16 px-6 flex items-center justify-between gap-5 flex-shrink-0 bg-slate-50/80 backdrop-blur-md z-40 border-b border-slate-200/40">
            {/* Opção discreta no Header para transição direta para o Controle de Frota quando em Documentos */}
            {hasModuleAccess(user?.permissions, "frota") ? (
              <Link
                to="/frota?tab=portal"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100/90 border border-orange-200/80 text-orange-700 font-bold text-xs transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                title="Ir para o Módulo de Controle de Frota Leve Direto"
              >
                <Car className="w-3.5 h-3.5 text-orange-600" />
                <span className="hidden sm:inline">Módulo de Frota Leve</span>
              </Link>
            ) : <div />}

            <div className="flex items-center gap-3">
              {/* Ícone de Notificações Funcional */}
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-9 h-9 rounded-full bg-white shadow-sm border border-slate-150 flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-colors relative cursor-pointer animate-in fade-in"
                >
                  <Bell className="w-4 h-4" />
                  {vencimentosAlerta.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full ring-2 ring-white min-w-[16px] h-[16px] flex items-center justify-center shadow-sm">
                      {vencimentosAlerta.length}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-white rounded-2xl shadow-xl border border-slate-150/80 p-2 z-50 animate-in fade-in slide-in-from-top-3 duration-250 text-left">
                    <div className="px-3.5 py-2.5 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-[#114D38] uppercase tracking-wide">Alertas de Vencimento</span>
                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded-full">{vencimentosAlerta.length} pendentes</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 mt-1">
                      {vencimentosAlerta.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-400 font-semibold">Sem novos alertas no momento.</p>
                      ) : (
                        vencimentosAlerta.map(v => {
                          const isOverdue = v.dias < 0 || v.status === "Atrasado";
                          return (
                            <div 
                              key={v.id} 
                              onClick={() => handleMarkAsRead(v.id)}
                              className="p-3 hover:bg-slate-50/80 transition-colors flex flex-col gap-1 text-xs relative group/item cursor-pointer"
                              title="Clique em qualquer lugar para marcar como lida"
                            >
                              <div className="flex justify-between items-start pr-6">
                                <span className="font-extrabold text-slate-800 truncate max-w-[130px]">{v.fornecedor}</span>
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0",
                                  isOverdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                                )}>
                                  {isOverdue ? "Vencido" : `Vence em ${v.dias} dias`}
                                </span>
                              </div>
                              <p className="text-slate-400 font-semibold text-[10px]">Documento: <span className="font-bold text-slate-650">{v.doc}</span></p>
                              <div className="flex justify-between items-center mt-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="font-black text-[#114D38] font-mono text-[11px]">{v.valor}</span>
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => {
                                      setSelectedDocToView(v);
                                      setIsNotificationsOpen(false);
                                    }}
                                    className="text-[9px] font-bold text-emerald-600 hover:text-[#114D38] flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-emerald-50 border border-slate-150 px-2 py-0.5 rounded"
                                  >
                                    <Eye className="w-2.5 h-2.5" /> Ver
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setIsNotificationsOpen(false);
                                      handleMarkAsRead(v.id);
                                      navigate("/documentos/lancamento", { state: { editLancamentoId: v.id } });
                                    }}
                                    className="text-[9px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-amber-50 border border-slate-150 px-2 py-0.5 rounded"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" /> Editar
                                  </button>
                                </div>
                              </div>

                              {/* Botão flutuante de Check discreto no canto superior */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(v.id);
                                }}
                                className="absolute right-2 top-2.5 w-4 h-4 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity text-slate-400 cursor-pointer"
                                title="Marcar como lida e ocultar"
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-xl text-center">
                      <button 
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate("/documentos/vencimentos");
                        }}
                        className="text-[10px] font-extrabold text-[#114D38] uppercase hover:underline"
                      >
                        Ver Painel de Alertas
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-6 bg-slate-200 mx-0.5" />

              {/* Menu Dropdown de Perfil de Usuário */}
              <UserProfileBadge />
            </div>
          </header>
        )}

        {/* Content Area - Para rotas da Frota, utiliza container de altura total sem perda vertical */}
        <div className={cn(
          "flex-1 w-full max-w-full mx-auto relative",
          isFrota 
            ? "h-screen overflow-hidden flex flex-col min-h-0 px-3 sm:px-4 md:px-5 pt-2 pb-2" 
            : "overflow-y-auto px-4 md:px-6 pb-20 pt-4"
        )}>
          {isFrota && (
            <>
              {/* Imagem de Fundo suave no módulo de Frota */}
              <div 
                className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-15"
                style={{
                  backgroundImage: `url('https://i.ibb.co/vvh5kBgG/f-UNDO-SISTEMA.jpg')`,
                }}
              />
              <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-slate-50/80 via-slate-50/60 to-slate-100/90 backdrop-blur-[0.5px]" />
            </>
          )}
          <div className={cn("max-w-full w-full mx-auto relative z-10", isFrota && "h-full flex flex-col min-h-0 overflow-hidden")}>
            {children}
          </div>
        </div>
      </main>

      {/* Modal Seguro de Visualização de Documento do Alerta */}
      <DocumentoAnexoModal
        isOpen={!!selectedDocToView}
        onClose={() => setSelectedDocToView(null)}
        documento={selectedDocToView ? {
          nome: selectedDocToView.nomeArquivoAnexo || `Documento_${selectedDocToView.doc || "Fiscal"}.pdf`,
          fornecedor: selectedDocToView.fornecedor,
          fornecedorCnpj: selectedDocToView.cnpj,
          cnpj: selectedDocToView.cnpj,
          valor: selectedDocToView.valor,
          doc: selectedDocToView.doc,
          descricao: selectedDocToView.descricao,
          tipo: selectedDocToView.tipo,
          estabelecimento: selectedDocToView.estabelecimento,
          centroCusto: selectedDocToView.centroCusto,
          aprovadores: selectedDocToView.aprovadores,
          formaPagto: selectedDocToView.formaPagto,
          dataEmissao: selectedDocToView.dataEmissao,
          dataVencimento: selectedDocToView.vencimento || selectedDocToView.dataVencimento,
          arquivoAnexoBase64: selectedDocToView.arquivoAnexoBase64
        } : null}
      />

      {/* Modal de Alteração Obrigatoria ou Solicitada de Senha */}
      <ChangePasswordModal 
        isOpen={!!user?.mustChangePassword || isChangePasswordOpen}
        isForced={!!user?.mustChangePassword}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}


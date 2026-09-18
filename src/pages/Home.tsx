import React, { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { FileText, Car, Truck, ArrowRight, ShieldCheck, LogOut, UserCheck, Lock, Sparkles, LogIn } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth, hasModuleAccess } from "../context/AuthContext";
import { Login } from "../components/Login";

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loginModalState, setLoginModalState] = useState<{
    isOpen: boolean;
    targetModule: string;
    targetPath: string;
  }>({
    isOpen: false,
    targetModule: "",
    targetPath: ""
  });
  const [deniedModalMessage, setDeniedModalMessage] = useState<string | null>(null);

  const docsAllowed = user ? hasModuleAccess(user.permissions, "documentos", user.email) : false;
  const frotaAllowed = user ? hasModuleAccess(user.permissions, "frota", user.email) : false;
  
  // Módulo de Frota Pesada exibido por enquanto apenas para deny.goncalves@risel.com.br
  const isDenyUser = Boolean(
    user && (
      user.email?.toLowerCase() === "deny.goncalves@risel.com.br" ||
      user.email?.toLowerCase() === "deny.risel@gmail.com"
    )
  );
  const pesadaAllowed = isDenyUser;

  const handleCardClick = (moduleKey: "documentos" | "frota" | "frota_pesada", moduleName: string, path: string) => {
    if (user) {
      let allowed = false;
      if (moduleKey === "documentos") allowed = docsAllowed;
      else if (moduleKey === "frota") allowed = frotaAllowed;
      else if (moduleKey === "frota_pesada") allowed = pesadaAllowed;

      if (!allowed) {
        setDeniedModalMessage(`Seu usuário (${user.email}) não possui permissão ativa para acessar o módulo ${moduleName}. Solicite a liberação no Menu de Usuários.`);
        return;
      }
      navigate(path);
    } else {
      // Primeira vez / Usuário não logado: exige login para o módulo selecionado
      setLoginModalState({
        isOpen: true,
        targetModule: moduleName,
        targetPath: path
      });
    }
  };

  const handleLoginSuccess = () => {
    const dest = loginModalState.targetPath || "/";
    setLoginModalState({ isOpen: false, targetModule: "", targetPath: "" });
    navigate(dest);
  };

  // Se o modal de login estiver ativo na Home para autenticar a primeira vez
  if (loginModalState.isOpen) {
    return (
      <Login
        targetModule={loginModalState.targetModule}
        onSuccess={handleLoginSuccess}
        onCancel={() => setLoginModalState({ isOpen: false, targetModule: "", targetPath: "" })}
      />
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col justify-between p-4 sm:p-6 lg:p-8 bg-slate-100/80 overflow-x-hidden">
      {/* Imagem de Fundo com Transparência Elegante */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-25"
        style={{
          backgroundImage: `url('https://i.ibb.co/vvh5kBgG/f-UNDO-SISTEMA.jpg')`,
        }}
      />
      {/* Camada sutil de gradiente e desfoque suave para garantir contraste e legibilidade impecáveis */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-slate-50/70 via-slate-50/40 to-slate-100/80 backdrop-blur-[1px]" />

      {/* Barra Superior de Identificação & Status da Sessão */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-slate-200/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-600/30 shadow-sm bg-white/90 backdrop-blur-sm">
            <img
              src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg"
              alt="Risel Combustíveis"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-slate-800 text-base">Risel ERP</span>
            </div>
          </div>
        </div>

        {/* Status de Login do Usuário */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                {user.name?.charAt(0) || "U"}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>{user.name}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sessão Ativa" />
                </div>
                <div className="text-[10px] text-slate-500 font-medium capitalize">
                  {user.role === "admin" ? "Administrador" : "Colaborador"} &bull; <span className="text-emerald-600 font-semibold">Autenticado</span>
                </div>
              </div>
              <button
                onClick={logout}
                className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Encerrar Sessão (Logout)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setLoginModalState({ isOpen: true, targetModule: "Acesso Geral", targetPath: "/" })}
              className="flex items-center gap-2 bg-white/90 backdrop-blur-md hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-700 px-4 py-2 rounded-2xl border border-slate-200/80 shadow-sm text-xs font-bold transition-all group"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              <span>Identificar-se / Login</span>
              <LogIn className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="relative z-10 max-w-5xl w-full mx-auto py-10 my-auto">
        <div className="text-center mb-10">
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-display font-black text-slate-900 tracking-tight"
          >
            Bem-vindo ao Sistema <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent">Risel</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm sm:text-base text-slate-600 mt-3 max-w-xl mx-auto font-medium leading-relaxed"
          >
            {user 
              ? "Selecione o módulo corporativo que deseja utilizar. Sua sessão está ativa."
              : "Selecione o módulo para iniciar. O login será solicitado no primeiro acesso ao módulo desejado."
            }
          </motion.p>
        </div>

        {/* Grid de Módulos */}
        <div className={cn(
          "items-stretch mx-auto",
          isDenyUser 
            ? "grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-6xl" 
            : "grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl"
        )}>
          {/* Card 1: Lançamento de Documentos */}
          <ModuleCard
            title="Lançamento de Documentos"
            badge="Fiscal & Contábil"
            description="Gestão centralizada de notas fiscais, faturas e recibos com fluxo de aprovação e dashboard analítico."
            icon={FileText}
            theme="emerald"
            delay={0.15}
            isLoggedIn={Boolean(user)}
            hasAccess={docsAllowed}
            onClick={() => handleCardClick("documentos", "Lançamento de Documentos", "/documentos/dashboard")}
          />

          {/* Card 2: Controle de Frota Leve */}
          <ModuleCard
            title="Controle de Frota Leve"
            badge="75 Veículos Utilitários"
            description="Gestão operacional de veículos, telemetria ao vivo, vistorias de checklist, manutenções e reservas."
            icon={Car}
            theme="orange"
            delay={0.25}
            isLoggedIn={Boolean(user)}
            hasAccess={frotaAllowed}
            onClick={() => handleCardClick("frota", "Controle de Frota Leve", "/frota")}
          />

          {/* Card 3: Frota Pesada - Exibição restrita temporariamente ao Deny Gonçalves */}
          {isDenyUser && (
            <ModuleCard
              title="Controle de Frota Pesada"
              badge="260+ Veículos & Multas"
              description="Gestão de caminhões e carretas, automação de multas e AITs, controle de motoristas e termos de desconto."
              icon={Truck}
              theme="blue"
              delay={0.35}
              isLoggedIn={Boolean(user)}
              hasAccess={pesadaAllowed}
              onClick={() => handleCardClick("frota_pesada", "Frota Pesada", "/frota-pesada")}
            />
          )}
        </div>

        {/* Modal de Acesso Negado */}
        {deniedModalMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Acesso Restrito ao Módulo</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {deniedModalMessage}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setDeniedModalMessage(null)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Links Públicos Diretos para Colaboradores (Sem exigência de senha/módulos restritos) */}
        <div className="mt-8 max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate("/reservas")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/90 backdrop-blur-md hover:bg-emerald-50/90 border border-emerald-300/80 text-[#114D38] text-xs font-black shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Portal Público de Reservas (/reservas)</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      </main>

      {/* Rodapé Institucional */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto text-center py-4 border-t border-slate-200/60 text-xs text-slate-500 font-medium">
        <p>
          &copy; {new Date().getFullYear()} Risel Combustíveis Ltda. &bull; Sistema de Gestão Empresarial ERP
        </p>
      </footer>
    </div>
  );
}

interface ModuleCardProps {
  title: string;
  badge?: string;
  description: string;
  icon: any;
  theme: "emerald" | "orange" | "blue";
  delay: number;
  isLoggedIn: boolean;
  hasAccess?: boolean;
  onClick: () => void;
}

function ModuleCard({
  title,
  badge,
  description,
  icon: Icon,
  theme,
  delay,
  isLoggedIn,
  hasAccess = true,
  onClick
}: ModuleCardProps) {
  const isEmerald = theme === "emerald";
  const isOrange = theme === "orange";
  const isBlue = theme === "blue";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="h-full"
    >
      <div 
        onClick={onClick}
        className="cursor-pointer group h-full bg-white/90 backdrop-blur-md rounded-[26px] p-6 sm:p-7 border border-white/80 sm:border-slate-200/80 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1.5 hover:bg-white relative overflow-hidden flex flex-col justify-between"
      >
        {/* Glow decorativo de fundo com assimetria sutil */}
        <div className={cn(
          "absolute -top-24 -right-24 w-52 h-52 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-40",
          isEmerald && "bg-emerald-500",
          isOrange && "bg-orange-500",
          isBlue && "bg-blue-600"
        )} />
        
        <div>
          {/* Topo do Card: Ícone e Status de Acesso */}
          <div className="flex items-center justify-between mb-5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs border transition-all duration-500 group-hover:scale-105 relative z-10",
              isEmerald && "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/60 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:-rotate-3",
              isOrange && "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200/60 text-orange-600 group-hover:bg-orange-500 group-hover:text-white group-hover:rotate-3",
              isBlue && "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200/60 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:-rotate-2"
            )}>
              <Icon className="w-7 h-7" />
            </div>

            {/* Badge de Requisito de Login ou Acesso Liberado */}
            <div className="relative z-10">
              {isLoggedIn ? (
                hasAccess ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    Liberado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                    <Lock className="w-3 h-3 text-rose-600" />
                    Acesso Restrito
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold group-hover:border-slate-300 group-hover:bg-slate-50 transition-colors">
                  <Lock className="w-3 h-3" />
                  Requer Senha
                </span>
              )}
            </div>
          </div>

          {/* Subtítulo / Badge de Categoria para Assimetria Visual Refinada */}
          {badge && (
            <div className="mb-2 relative z-10">
              <span className={cn(
                "inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase",
                isEmerald && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                isOrange && "bg-orange-50 text-orange-700 border border-orange-100",
                isBlue && "bg-blue-50 text-blue-700 border border-blue-100"
              )}>
                {badge}
              </span>
            </div>
          )}
          
          <h2 className="text-xl font-display font-bold text-slate-900 mb-2.5 relative z-10 group-hover:text-slate-950 transition-colors">
            {title}
          </h2>
          <p className="text-slate-500 leading-relaxed mb-6 text-xs sm:text-[13px] relative z-10 line-clamp-3">
            {description}
          </p>
        </div>
        
        <div className={cn(
          "inline-flex items-center gap-2 font-bold tracking-wide uppercase text-[11px] transition-all relative z-10 mt-auto pt-4 border-t border-slate-100",
          isEmerald && "text-emerald-600 group-hover:text-emerald-700",
          isOrange && "text-orange-600 group-hover:text-orange-700",
          isBlue && "text-blue-600 group-hover:text-blue-700"
        )}>
          <span>{isLoggedIn ? "Acessar Módulo" : "Entrar com Login & Senha"}</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
        </div>
      </div>
    </motion.div>
  );
}

import React, { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { FileText, Truck, ArrowRight, ShieldCheck, LogOut, UserCheck, Lock, Sparkles, LogIn } from "lucide-react";
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

  const handleCardClick = (moduleName: string, path: string) => {
    if (user) {
      // Usuário já está logado na sessão atual: acessa tudo livremente sem pedir senha
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Barra Superior de Identificação & Status da Sessão */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-600/30 shadow-sm">
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
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
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
              className="flex items-center gap-2 bg-white hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 px-4 py-2 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold transition-all group"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              <span>Identificar-se / Login</span>
              <LogIn className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="max-w-5xl w-full mx-auto py-10 my-auto">
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
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {/* Card 1: Lançamento de Documentos */}
          <ModuleCard
            title="Lançamento de Documentos"
            description="Gestão centralizada de notas fiscais, faturas e recibos com fluxo de aprovação e dashboard analítico."
            icon={FileText}
            theme="emerald"
            delay={0.15}
            isLoggedIn={Boolean(user)}
            onClick={() => handleCardClick("Lançamento de Documentos", "/documentos/dashboard")}
          />

          {/* Card 2: Controle de Frota Leve */}
          <ModuleCard
            title="Controle de Frota Leve"
            description="Gestão operacional de veículos, telemetria ao vivo, vistorias de checklist, manutenções e reservas."
            icon={Truck}
            theme="orange"
            delay={0.25}
            isLoggedIn={Boolean(user)}
            onClick={() => handleCardClick("Controle de Frota Leve", "/frota")}
          />
        </div>
      </main>

      {/* Rodapé Institucional */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 border-t border-slate-200/60 text-xs text-slate-400 font-medium">
        <p>
          &copy; {new Date().getFullYear()} Risel Combustíveis Ltda. &bull; Sistema de Gestão Empresarial ERP
        </p>
      </footer>
    </div>
  );
}

interface ModuleCardProps {
  title: string;
  description: string;
  icon: any;
  theme: "emerald" | "orange";
  delay: number;
  isLoggedIn: boolean;
  onClick: () => void;
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  theme,
  delay,
  isLoggedIn,
  onClick
}: ModuleCardProps) {
  const isEmerald = theme === "emerald";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div 
        onClick={onClick}
        className="cursor-pointer group h-full bg-white rounded-[28px] p-8 border border-slate-200/90 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1.5 relative overflow-hidden flex flex-col justify-between"
      >
        {/* Glow decorativo de fundo */}
        <div className={cn(
          "absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-40",
          isEmerald ? "bg-emerald-500" : "bg-orange-500"
        )} />
        
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className={cn(
              "w-16 h-16 rounded-[20px] flex items-center justify-center shadow-sm border transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 relative z-10",
              isEmerald 
                ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/60 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
                : "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200/60 text-orange-600 group-hover:bg-orange-500 group-hover:text-white"
            )}>
              <Icon className="w-8 h-8" />
            </div>

            {/* Badge de Requisito de Login ou Acesso Liberado */}
            <div className="relative z-10">
              {isLoggedIn ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-bold">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  Liberado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10.5px] font-bold group-hover:border-emerald-300 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                  <Lock className="w-3 h-3" />
                  Requer Senha
                </span>
              )}
            </div>
          </div>
          
          <h2 className="text-2xl font-display font-bold text-slate-800 mb-3 relative z-10 group-hover:text-slate-900 transition-colors">
            {title}
          </h2>
          <p className="text-slate-500 leading-relaxed mb-8 text-sm relative z-10">
            {description}
          </p>
        </div>
        
        <div className={cn(
          "inline-flex items-center gap-2 font-bold tracking-wide uppercase text-xs transition-all relative z-10 mt-auto pt-4 border-t border-slate-100",
          isEmerald ? "text-emerald-600 group-hover:text-emerald-700" : "text-orange-600 group-hover:text-orange-700"
        )}>
          <span>{isLoggedIn ? "Acessar Módulo" : "Entrar com Login & Senha"}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-2" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/documentos/Dashboard";
import Lancamento from "./pages/documentos/Lancamento";
import Vencimentos from "./pages/documentos/Vencimentos";
import Fornecedores from "./pages/documentos/Fornecedores";
import Usuarios from "./pages/documentos/Usuarios";
import Frota from "./pages/Frota";
import ResetPassword from "./pages/ResetPassword";

import ChecklistPublico from "./pages/ChecklistPublico";
import ReservaPublica from "./pages/ReservaPublica";
import { AuthProvider, useAuth, hasModuleAccess } from "./context/AuthContext";
import { Login } from "./components/Login";
import { pingSupabaseKeepAlive } from "./services/supabaseService";
import { Lock } from "lucide-react";

function ProtectedRoute({ 
  children, 
  module 
}: { 
  children: React.ReactNode; 
  module?: "documentos" | "frota" | "usuarios";
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const isFrota = location.pathname.startsWith("/frota");
    const moduleName = isFrota ? "Controle de Frota Leve" : "Lançamento de Documentos";
    return <Login targetModule={moduleName} redirectTo={location.pathname} />;
  }

  // Se o módulo for Gestão de Usuários e não tiver acesso
  if (module === "usuarios" && !hasModuleAccess(user.permissions, "usuarios", user.email)) {
    return <Navigate to="/" replace />;
  }

  // Se for Lançamento de Documentos e o usuário não tiver acesso
  if (module === "documentos" && !hasModuleAccess(user.permissions, "documentos", user.email)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Seu usuário (<span className="font-semibold text-slate-800">{user.email}</span>) não possui permissão ativa para acessar o módulo de Lançamento de Documentos.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {hasModuleAccess(user.permissions, "frota", user.email) && (
              <a href="/frota" className="px-4 py-2.5 bg-[#F47920] hover:bg-[#d86615] text-white text-xs font-bold rounded-xl shadow-xs transition-all">
                Acessar Módulo de Frota Leve
              </a>
            )}
            <a href="/" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all">
              Voltar ao Início
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Se for Frota e o usuário não tiver acesso
  if (module === "frota" && !hasModuleAccess(user.permissions, "frota", user.email)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Seu usuário (<span className="font-semibold text-slate-800">{user.email}</span>) não possui permissão ativa para acessar o módulo de Controle de Frota Leve.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {hasModuleAccess(user.permissions, "documentos", user.email) && (
              <a href="/documentos/dashboard" className="px-4 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white text-xs font-bold rounded-xl shadow-xs transition-all">
                Acessar Lançamento de Documentos
              </a>
            )}
            <a href="/" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all">
              Voltar ao Início
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent() {
  // Inicialização e agendamento automático do serviço Anti-Inatividade do Supabase (Keep-Alive)
  useEffect(() => {
    // Ping imediato na inicialização do app
    pingSupabaseKeepAlive();

    // Re-executa o ping a cada 5 minutos (300.000 ms) para vencer a inatividade no Supabase Free Tier
    const interval = setInterval(() => {
      pingSupabaseKeepAlive();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <Routes>
        {/* Rotas públicas para colaboradores preencherem checklist sem login */}
        <Route path="/checklist-publico" element={<ChecklistPublico />} />
        <Route path="/checklist" element={<ChecklistPublico />} />
        <Route path="/c" element={<ChecklistPublico />} />
        <Route path="/publico" element={<ChecklistPublico />} />

        {/* Rotas públicas exclusivas e diretas para colaboradores solicitarem reservas sem login */}
        <Route path="/reservas" element={<ReservaPublica />} />
        <Route path="/reserva" element={<ReservaPublica />} />
        <Route path="/r" element={<ReservaPublica />} />
        <Route path="/solicitar-reserva" element={<ReservaPublica />} />
        <Route path="/rac" element={<ReservaPublica initialView="racRequest" />} />
        <Route path="/uso-diario" element={<ReservaPublica initialView="dailyUse" />} />
        <Route path="/status-frota" element={<ReservaPublica initialView="fleetStatus" />} />

        {/* Rota pública de redefinição de senha com token */}
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route path="/recuperar-senha" element={<ResetPassword />} />

        {/* Rota inicial: tela de Bem-vindo ao Sistema Risel com portais dos módulos */}
        <Route path="/" element={<Home />} />
        
        {/* Rotas protegidas (exigem login e mantém sessão) */}
        <Route path="/documentos/dashboard" element={<ProtectedRoute module="documentos"><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/lancamento" element={<ProtectedRoute module="documentos"><MainLayout><Lancamento /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/vencimentos" element={<ProtectedRoute module="documentos"><MainLayout><Vencimentos /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/fornecedores" element={<ProtectedRoute module="documentos"><MainLayout><Fornecedores /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/usuarios" element={<ProtectedRoute module="usuarios"><MainLayout><Usuarios /></MainLayout></ProtectedRoute>} />
        <Route path="/frota" element={<ProtectedRoute module="frota"><MainLayout><Frota /></MainLayout></ProtectedRoute>} />

        {/* Fallback de redirecionamento para Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}



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
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./components/Login";
import { pingSupabaseKeepAlive } from "./services/supabaseService";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const isFrota = location.pathname.startsWith("/frota");
    const moduleName = isFrota ? "Controle de Frota Leve" : "Lançamento de Documentos";
    return <Login targetModule={moduleName} redirectTo={location.pathname} />;
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
        <Route path="/documentos/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/lancamento" element={<ProtectedRoute><MainLayout><Lancamento /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/vencimentos" element={<ProtectedRoute><MainLayout><Vencimentos /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/fornecedores" element={<ProtectedRoute><MainLayout><Fornecedores /></MainLayout></ProtectedRoute>} />
        <Route path="/documentos/usuarios" element={<ProtectedRoute><MainLayout><Usuarios /></MainLayout></ProtectedRoute>} />
        <Route path="/frota" element={<ProtectedRoute><MainLayout><Frota /></MainLayout></ProtectedRoute>} />

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



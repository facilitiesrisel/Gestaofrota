import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, KeyRound, Mail, AlertCircle, Sparkles, Eye, EyeOff, ShieldCheck, ArrowRight, Lock, Check } from "lucide-react";
import { motion } from "motion/react";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import { useNavigate } from "react-router-dom";

interface LoginProps {
  targetModule?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function Login({
  targetModule,
  redirectTo,
  onSuccess,
  onCancel
}: LoginProps = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    setTimeout(() => {
      const success = login(email, password, rememberMe);
      setIsLoading(false);
      if (success) {
        if (onSuccess) {
          onSuccess();
        } else if (redirectTo) {
          navigate(redirectTo);
        }
      } else {
        setError("E-mail ou senha incorretos. Verifique suas credenciais ou use 'Esqueci a senha'.");
      }
    }, 600);
  };

  const fillDefaultCredentials = () => {
    setEmail("deny.goncalves@risel.com.br");
    setPassword("@Cap150957");
    setError("");
  };

  const handleOpenResetFromForgot = (token: string, userEmail: string) => {
    navigate(`/redefinir-senha?token=${token}&email=${encodeURIComponent(userEmail)}`);
  };

  return (
    <div className="min-h-screen bg-[#060c09] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decorativo premium de alta tecnologia com efeito bioluminescente */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,rgba(5,150,105,0.05),transparent_50%)] pointer-events-none" />
      
      {/* Círculos decorativos flutuantes */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-zinc-950/85 backdrop-blur-xl border border-emerald-900/35 p-8 rounded-[32px] shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-4">
            {/* Logo da Risel solicitada */}
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-xl shadow-emerald-500/10">
              <img 
                src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" 
                alt="Risel Combustíveis" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full text-[9px] font-bold uppercase border-2 border-zinc-950 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> ERP
            </span>
          </div>

          <h2 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
            Risel Combustíveis
          </h2>

          {targetModule ? (
            <div className="mt-2.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/40 rounded-full flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-300">
                Acesso ao Módulo: {targetModule}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1.5 font-medium max-w-[280px]">
              Insira suas credenciais para autenticar seu acesso ao Sistema Risel ERP
            </p>
          )}
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 p-4 bg-rose-950/40 border border-rose-800/30 text-rose-300 rounded-2xl text-xs font-semibold flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wider block">
              E-mail funcional
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deny.goncalves@risel.com.br"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-emerald-950 bg-zinc-900/70 focus:bg-zinc-900/95 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wider block">
                Senha de Acesso
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-[11px] text-emerald-400/90 hover:text-emerald-300 font-semibold transition-colors underline-offset-2 hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-emerald-950 bg-zinc-900/70 focus:bg-zinc-900/95 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                rememberMe ? "bg-emerald-600 border-emerald-500" : "bg-zinc-900 border-zinc-700"
              }`}>
                {rememberMe && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs text-slate-400 font-medium">Manter conectado</span>
            </label>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Voltar
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 mt-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Modal de Esqueci a Senha */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
        onOpenResetPassword={handleOpenResetFromForgot}
      />
    </div>
  );
}

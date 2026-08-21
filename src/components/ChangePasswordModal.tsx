import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle, X, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

interface ChangePasswordModalProps {
  isOpen: boolean;
  isForced?: boolean; // Se true, o usuário é obrigado a trocar no primeiro acesso e não pode fechar sem trocar
  onClose?: () => void;
}

export function ChangePasswordModal({ isOpen, isForced = false, onClose }: ChangePasswordModalProps) {
  const { user, changePassword } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen || !user) return null;

  // Cálculo da Força da Senha
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Não informada", color: "bg-slate-200" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: "Fraca", color: "bg-rose-500", textColor: "text-rose-600" };
    if (score <= 4) return { score, label: "Média", color: "bg-amber-500", textColor: "text-amber-600" };
    return { score, label: "Forte e Segura", color: "bg-emerald-500", textColor: "text-emerald-600" };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || newPassword.length < 6) {
      setError("A nova senha deve possuir pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação de senha não confere com a nova senha digitada.");
      return;
    }

    if (newPassword === "Risel@2026!" || newPassword === "Rs@2026") {
      setError("Por favor, crie uma senha pessoal diferente da senha provisória padrão.");
      return;
    }

    setIsLoading(true);
    try {
      const ok = await changePassword(newPassword.trim());
      if (ok) {
        setSuccess("Sua senha foi atualizada e gravada com sucesso no banco de dados!");
        setTimeout(() => {
          setIsLoading(false);
          if (onClose) onClose();
        }, 1200);
      } else {
        setError("Não foi possível atualizar a senha. Tente novamente.");
        setIsLoading(false);
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor. Verifique sua conexão.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#114D38] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 text-emerald-300">
              <KeyRound className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold leading-tight">
                {isForced ? "Aviso de Segurança - Primeiro Acesso" : "Alteração de Senha Pessoal"}
              </h3>
              <p className="text-xs text-emerald-200/90 font-medium">
                {isForced ? "Defina sua senha definitiva para continuar" : "Mantenha sua conta protegida e atualizada"}
              </p>
            </div>
          </div>

          {!isForced && onClose && (
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isForced && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                <strong>Olá, {user.name}!</strong> Por medida de segurança da política corporativa Risel, é obrigatório alterar sua senha provisória no primeiro acesso.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block">
              Nova Senha Pessoal *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-medium text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Medidor de força da senha */}
            {newPassword.length > 0 && (
              <div className="pt-1.5 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">Força da Senha:</span>
                  <span className={strength.textColor}>{strength.label}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex gap-1">
                  <div className={cn("h-full transition-all duration-300 flex-1", strength.score >= 1 ? strength.color : "bg-transparent")} />
                  <div className={cn("h-full transition-all duration-300 flex-1", strength.score >= 3 ? strength.color : "bg-transparent")} />
                  <div className={cn("h-full transition-all duration-300 flex-1", strength.score >= 5 ? strength.color : "bg-transparent")} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider block">
              Confirmar Nova Senha *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-[#114D38]/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Salvando no Banco de Dados...</span>
              ) : (
                <>
                  <span>Salvar Nova Senha e Acessar Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

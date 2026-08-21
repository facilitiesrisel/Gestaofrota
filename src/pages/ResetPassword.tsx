import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Lock, ShieldCheck, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyResetToken, resetPassword, login } = useAuth();

  const tokenParam = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [userEmail, setUserEmail] = useState(emailParam);
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Validação do Token ao carregar a página
  useEffect(() => {
    if (!tokenParam) {
      setIsVerifying(false);
      setIsValidToken(false);
      setErrorMessage("Link de redefinição inválido ou ausente.");
      return;
    }

    const verification = verifyResetToken(tokenParam);
    setIsVerifying(false);

    if (verification.valid) {
      setIsValidToken(true);
      setUserEmail(verification.email || emailParam);
      setUserName(verification.user?.name || "Colaborador(a)");
      setToken(tokenParam);
    } else {
      setIsValidToken(false);
      setErrorMessage("Este link de redefinição expirou ou já foi utilizado. Solicite um novo link.");
    }
  }, [tokenParam, verifyResetToken, emailParam]);

  // Medidor de Força da Senha
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 8) score += 15;
    if (/[A-Z]/.test(pass)) score += 20;
    if (/[0-9]/.test(pass)) score += 20;
    if (/[^A-Za-z0-9]/.test(pass)) score += 20;
    return Math.min(100, score);
  };

  const strength = calculateStrength(newPassword);

  const getStrengthLabel = () => {
    if (newPassword.length === 0) return { text: "Digite sua nova senha", color: "text-slate-500", bar: "bg-slate-700" };
    if (strength < 40) return { text: "Senha Fraca", color: "text-rose-400", bar: "bg-rose-500" };
    if (strength < 70) return { text: "Senha Moderada", color: "text-amber-400", bar: "bg-amber-500" };
    if (strength < 90) return { text: "Senha Forte", color: "text-emerald-400", bar: "bg-emerald-500" };
    return { text: "Excelente Segurança", color: "text-emerald-300", bar: "bg-emerald-400" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 6) {
      setErrorMessage("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("As senhas digitadas não coincidem. Verifique a confirmação.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPassword(token, newPassword);
      setIsLoading(false);

      if (res.success) {
        setSuccess(true);
        // Tenta fazer o login automático em background
        if (userEmail) {
          login(userEmail, newPassword);
        }
      } else {
        setErrorMessage(res.message || "Falha ao alterar senha. Tente novamente.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Erro inesperado ao gravar nova senha.");
    }
  };

  return (
    <div className="min-h-screen bg-[#060c09] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background bioluminescente refinado */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,rgba(5,150,105,0.05),transparent_50%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-zinc-950/85 backdrop-blur-xl border border-emerald-900/35 p-8 rounded-[32px] shadow-2xl relative z-10"
      >
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-xl shadow-emerald-500/10">
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

          <h2 className="text-2xl font-bold font-display tracking-tight text-white">
            Redefinição de Senha
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Segurança Corporativa Risel Combustíveis
          </p>
        </div>

        {/* Verificação inicial do Token */}
        {isVerifying ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Validando token de segurança corporativo...</p>
          </div>
        ) : success ? (
          /* SUCESSO: Senha alterada */
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Senha Alterada com Sucesso!</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Sua credencial de acesso corporativo foi atualizada com sucesso no banco de dados da Risel.
              </p>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-900/40 p-4 rounded-2xl text-xs text-emerald-300 font-medium">
              Sessão iniciada automaticamente para <span className="font-mono text-white font-bold">{userEmail}</span>.
            </div>

            <button
              onClick={() => navigate("/")}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Acessar o Sistema Risel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : !isValidToken ? (
          /* TOKEN INVÁLIDO OU EXPIRADO */
          <div className="space-y-6 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Link Expirado ou Inválido</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {errorMessage || "Por questões de conformidade e segurança, links de redefinição possuem tempo limite de utilização."}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                to="/"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all text-center"
              >
                Voltar à Tela Inicial e Solicitar Novo Link
              </Link>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE NOVA SENHA */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identificação do Usuário */}
            <div className="p-3 bg-zinc-900/90 border border-emerald-950 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Usuário:</span>
              <span className="font-bold text-emerald-400 font-mono">{userEmail}</span>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/40 text-rose-300 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Campo Nova Senha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-emerald-950 bg-zinc-900/80 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-100 font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Medidor de Força */}
              {newPassword.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthLabel().bar}`}
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className={getStrengthLabel().color}>{getStrengthLabel().text}</span>
                    <span className="text-slate-500 font-mono">{strength}% seguro</span>
                  </div>
                </div>
              )}
            </div>

            {/* Campo Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-emerald-950 bg-zinc-900/80 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-100 font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Requisitos recomendados */}
            <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Dicas para uma senha segura:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                <li>Mínimo de 6 caracteres (recomendado 8+)</li>
                <li>Misture letras maiúsculas, números e símbolos</li>
              </ul>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Definir Nova Senha</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Cancelar e Voltar ao Início
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

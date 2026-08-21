import React, { useState } from "react";
import { Mail, CheckCircle2, ArrowRight, Copy, Check, ExternalLink, ShieldCheck, RefreshCw, X, AlertCircle, Sparkles, FileCode2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onOpenResetPassword?: (token: string, email: string) => void;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = "",
  onOpenResetPassword
}: ForgotPasswordModalProps) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{
    token: string;
    email: string;
    name: string;
    htmlEmail: string;
    link: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await forgotPassword(email.trim());
      setIsLoading(false);

      if (result.success && result.resetToken && result.htmlEmail) {
        setSuccessData({
          token: result.resetToken,
          email: email.trim().toLowerCase(),
          name: result.user?.name || "Colaborador",
          htmlEmail: result.htmlEmail,
          link: `${window.location.origin}/redefinir-senha?token=${result.resetToken}&email=${encodeURIComponent(email.trim().toLowerCase())}`
        });
      } else {
        setError(result.message || "E-mail não localizado na base cadastral.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setError("Ocorreu um erro ao processar a solicitação. Tente novamente.");
    }
  };

  const handleCopyLink = () => {
    if (!successData) return;
    navigator.clipboard.writeText(successData.link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyHtml = () => {
    if (!successData) return;
    navigator.clipboard.writeText(successData.htmlEmail);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2500);
  };

  const handleOpenReset = () => {
    if (successData && onOpenResetPassword) {
      onOpenResetPassword(successData.token, successData.email);
      onClose();
    } else if (successData) {
      window.location.href = successData.link;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.3 }}
        className={`w-full ${successData ? 'max-w-3xl' : 'max-w-md'} bg-zinc-950 border border-emerald-900/40 rounded-[28px] shadow-2xl overflow-hidden relative text-slate-100 my-8`}
      >
        {/* Header do Modal */}
        <div className="p-6 bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-zinc-950 border-b border-emerald-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                Recuperação de Acesso
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  Risel ERP
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {successData ? "E-mail corporativo enviado com sucesso" : "Redefina sua senha corporativa via e-mail"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6">
          {!successData ? (
            /* ETAPA 1: Formulário de Solicitação */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-2xl p-4 text-xs text-emerald-300/90 leading-relaxed flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Informe seu e-mail funcional cadastrado. Enviaremos um link exclusivo e seguro para redefinição da sua senha de acesso.
                </span>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-800/40 text-rose-300 rounded-xl text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  E-mail Funcional Cadastrado
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: deny.goncalves@risel.com.br"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-emerald-950 bg-zinc-900/90 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-100 font-medium placeholder:text-slate-600 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-zinc-900 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Link de Redefinição</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Dica rápida */}
              <div className="mt-4 pt-4 border-t border-zinc-900 text-center">
                <p className="text-[11px] text-slate-500">
                  E-mail corporativo cadastrado para teste: <span className="text-emerald-400 font-mono">deny.goncalves@risel.com.br</span>
                </p>
              </div>
            </form>
          ) : (
            /* ETAPA 2: E-mail Enviado & Visualizador de E-mail HTML Real */
            <div className="space-y-5">
              {/* Notificação de Envio com Sucesso */}
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      E-mail de Segurança Enviado para <span className="font-mono text-white">{successData.email}</span>
                    </h4>
                    <p className="text-[11px] text-emerald-400/80">
                      O link de redefinição expira em 2 horas. Você pode clicar no botão abaixo para redefinir agora.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenReset}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Tela de Redefinição</span>
                  </button>
                </div>
              </div>

              {/* Barra de Ações & Abas de Prévia */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === "preview"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Visualização do E-mail (HTML)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === "code"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>Código HTML</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
                    title="Copiar Link de Redefinição"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Link Copiado!" : "Copiar Link"}</span>
                  </button>
                  <button
                    onClick={handleCopyHtml}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
                    title="Copiar Código HTML do E-mail"
                  >
                    {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedHtml ? "HTML Copiado!" : "Copiar HTML"}</span>
                  </button>
                </div>
              </div>

              {/* Caixa de Visualização do E-mail */}
              <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-white text-slate-800">
                {/* Barra do Webmail Simulado */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-800">De:</span>
                    <span className="text-slate-600">Risel ERP &lt;seguranca@risel.com.br&gt;</span>
                    <span className="text-slate-300">|</span>
                    <span className="font-bold text-slate-800">Para:</span>
                    <span className="text-slate-600 font-mono">{successData.email}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">Agora</span>
                </div>

                {activeTab === "preview" ? (
                  <div className="p-2 max-h-[400px] overflow-y-auto bg-[#0b1410]">
                    <iframe
                      srcDoc={successData.htmlEmail}
                      title="Pré-visualização do E-mail"
                      className="w-full min-h-[500px] rounded-xl border-0"
                    />
                  </div>
                ) : (
                  <div className="p-4 max-h-[400px] overflow-y-auto bg-zinc-950 text-emerald-400 font-mono text-[11px] leading-relaxed select-all">
                    <pre className="whitespace-pre-wrap">{successData.htmlEmail}</pre>
                  </div>
                )}
              </div>

              {/* Rodapé de Fechamento */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setSuccessData(null)}
                  className="text-xs text-slate-400 hover:text-emerald-400 font-medium transition-colors"
                >
                  &larr; Enviar para outro e-mail
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-slate-300 transition-all"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleOpenReset}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                  >
                    <span>Prosseguir para Redefinição</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

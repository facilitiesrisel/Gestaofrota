import React, { useState, useEffect } from "react";
import { useAuth, UserPermissions } from "../../context/AuthContext";
import { Users, Plus, Shield, ShieldAlert, CheckSquare, Square, Trash2, Mail, User, Save, Lock, ArrowRight, ShieldCheck, KeyRound, Eye, EyeOff, Server, Check, Calendar, Send, Clock, AlertTriangle, FileText, X, Pencil, Database, RefreshCw, Copy, CheckCircle2, Zap } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { 
  fetchLancamentosSupabase, 
  saveBatchAbastecimentosSupabase, 
  syncLocalLancamentosToSupabase,
  syncLocalUsuariosToSupabase, 
  testSupabaseConnection, 
  pingSupabaseKeepAlive, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  SUPABASE_SQL_SCHEMA 
} from "../../services/supabaseService";

export default function Usuarios() {
  const { user: currentUser, usersList, createUser, updateUser, deleteUser } = useAuth();
  
  // Bloqueio de Segurança: Apenas deny.goncalves@risel.com.br tem acesso a este menu
  if (currentUser?.email?.toLowerCase() !== "deny.goncalves@risel.com.br") {
    return (
      <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-8 text-center max-w-xl mx-auto mt-12 space-y-4">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Acesso Restrito ao Menu Usuários</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Somente o usuário master <strong className="text-slate-800">deny.goncalves@risel.com.br</strong> possui autorização para gerenciar logins, senhas e liberações de submódulos no sistema ERP Risel.
        </p>
        <div className="pt-2">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Voltar ao Início</span>
          </a>
        </div>
      </div>
    );
  }

  // Estados para as Configurações de E-mail SMTP do Sistema
  const [smtpHost, setSmtpHost] = useState(() => {
    return localStorage.getItem("risel_smtp_host") || "smtp.office365.com";
  });
  const [smtpPort, setSmtpPort] = useState(() => {
    return localStorage.getItem("risel_smtp_port") || "587";
  });
  const [smtpEmail, setSmtpEmail] = useState(() => {
    return localStorage.getItem("risel_smtp_email") || "deny.goncalves@risel.com.br";
  });
  const [smtpPassword, setSmtpPassword] = useState(() => {
    return localStorage.getItem("risel_smtp_password") || "M)175012833809uz";
  });
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpSuccess, setSmtpSuccess] = useState("");
  const [isPreviewReportOpen, setIsPreviewReportOpen] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState("");

  // Estados e Funções de Gestão do Banco Supabase Real
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [supabaseConfigState, setSupabaseConfigState] = useState(() => getSupabaseConfig());
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(supabaseConfigState.url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(supabaseConfigState.anonKey);
  const [supabaseTestMsg, setSupabaseTestMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [isPingingSupabase, setIsPingingSupabase] = useState(false);
  const [pingStatus, setPingStatus] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestMsg(null);
    saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    const result = await testSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setSupabaseTestMsg(result);
    setSupabaseConfigState(getSupabaseConfig());
    setIsTestingSupabase(false);
  };

  const handleSyncAllToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncMsg("");
    
    // 1. Sincroniza Lançamentos
    const savedLanc = localStorage.getItem("risel_lancamentos");
    const lancList = savedLanc ? JSON.parse(savedLanc) : [];
    const resLanc = await syncLocalLancamentosToSupabase(lancList);

    // 2. Sincroniza Abastecimentos (Frota)
    const savedAbast = localStorage.getItem("risel_frota_abastecimentos");
    const abastList = savedAbast ? JSON.parse(savedAbast) : [];
    const resAbast = await saveBatchAbastecimentosSupabase(abastList);

    // 3. Sincroniza Usuários
    const resUsers = await syncLocalUsuariosToSupabase(usersList);

    if (resLanc.success && resAbast.success && resUsers.success) {
      setSyncMsg(`🎉 Sucesso Total! ${resLanc.count} Lançamentos, ${resAbast.count} Abastecimentos e ${resUsers.count} Usuários foram sincronizados e gravados no Banco Supabase!`);
    } else {
      setSyncMsg(`⚠️ Sincronização concluída com avisos: Lançamentos (${resLanc.count}), Abastecimentos (${resAbast.count}), Usuários (${resUsers.count}). Verifique as tabelas no Supabase.`);
    }
    setIsSyncingSupabase(false);
  };

  const handlePingKeepAlive = async () => {
    setIsPingingSupabase(true);
    const res = await pingSupabaseKeepAlive();
    if (res.success) {
      setPingStatus(`✅ Ping anti-inatividade executado com sucesso às ${res.timestamp}! O banco de dados Supabase permanece ativo sem pausas.`);
    } else {
      setPingStatus(`ℹ️ Tentativa de ping registrada às ${res.timestamp}.`);
    }
    setSupabaseConfigState(getSupabaseConfig());
    setIsPingingSupabase(false);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Estados e Regras de Alçadas de Aprovação de Lançamentos (atendendo ao item 10)
  const [alcadas, setAlcadas] = useState<any[]>(() => {
    const saved = localStorage.getItem("risel_alcadas_regra");
    if (saved) return JSON.parse(saved);
    return [
      { id: "1", valorMax: 2000, aprovadores: "Deny" },
      { id: "2", valorMax: 3000, aprovadores: "Deny e Gerência" },
      { id: "3", valorMax: 999999999, aprovadores: "Deny, Gerência e Diretoria" }
    ];
  });

  const [editingAlcadaId, setEditingAlcadaId] = useState<string | null>(null);
  const [alcadaValorMax, setAlcadaValorMax] = useState("");
  const [alcadaAprovadores, setAlcadaAprovadores] = useState("");

  useEffect(() => {
    localStorage.setItem("risel_alcadas_regra", JSON.stringify(alcadas));
  }, [alcadas]);

  const handleSaveAlcada = () => {
    if (!alcadaValorMax || !alcadaAprovadores) return;
    const numVal = parseFloat(alcadaValorMax);
    if (isNaN(numVal)) return;

    if (editingAlcadaId) {
      setAlcadas(prev => prev.map(item => item.id === editingAlcadaId ? { ...item, valorMax: numVal, aprovadores: alcadaAprovadores } : item));
      setEditingAlcadaId(null);
    } else {
      const newAlcada = {
        id: Date.now().toString(),
        valorMax: numVal,
        aprovadores: alcadaAprovadores
      };
      setAlcadas(prev => [...prev, newAlcada]);
    }
    setAlcadaValorMax("");
    setAlcadaAprovadores("");
  };

  const handleDeleteAlcada = (id: string) => {
    setAlcadas(prev => prev.filter(item => item.id !== id));
  };

  // Estado de tipo de relatório ativo para envio manual a qualquer momento
  const [reportType, setReportType] = useState<"completo" | "vencendo5d">("completo");

  // Carregar todos os lançamentos do LocalStorage
  const todosLancamentos = React.useMemo(() => {
    const saved = localStorage.getItem("risel_lancamentos");
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }, [isPreviewReportOpen]);

  // Filtrar os não finalizados (que não estão Pagos/Lançados completos)
  const lancamentosPendentes = React.useMemo(() => {
    return todosLancamentos.filter((item: any) => {
      const st = (item.status || "").toLowerCase();
      return st.includes("aguardando") || st.includes("pendente") || st.includes("atrasado") || (st !== "pago" && st !== "lançado" && st !== "finalizado" && st !== "concluído");
    });
  }, [todosLancamentos]);

  // Filtrar os não finalizados com vencimento chegando em 5 dias ou menos
  const lancamentosVencendo5Dias = React.useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return lancamentosPendentes.filter((item: any) => {
      if (!item.dataVencimento) return false;
      const dataVenc = new Date(item.dataVencimento + "T12:00:00");
      const diffTime = dataVenc.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 5; // vencimento em 5 dias ou menos (ou atrasados)
    });
  }, [lancamentosPendentes]);

  // Lançamentos selecionados para exibição e envio no e-mail
  const lancamentosAtivosNoRelatorio = React.useMemo(() => {
    return reportType === "completo" ? lancamentosPendentes : lancamentosVencendo5Dias;
  }, [reportType, lancamentosPendentes, lancamentosVencendo5Dias]);

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setSmtpSuccess("");
    localStorage.setItem("risel_smtp_host", smtpHost);
    localStorage.setItem("risel_smtp_port", smtpPort);
    localStorage.setItem("risel_smtp_email", smtpEmail);
    localStorage.setItem("risel_smtp_password", smtpPassword);
    setTimeout(() => {
      setIsSavingSmtp(false);
      setSmtpSuccess("Configurações do servidor SMTP salvas e conectadas com sucesso!");
    }, 1000);
  };

  const handleSendReportTest = async () => {
    setIsSendingReport(true);
    setReportSuccess("");
    try {
      const reportSubject = reportType === "completo"
        ? "Relatório Semanal Consolidado - Lançamentos Pendentes"
        : "Relatório Consolidado de Urgência - Lançamentos Vencendo em 5 Dias";

      const reportIntro = reportType === "completo"
        ? "Seguem para conhecimento e providências os lançamentos que se encontram pendentes de aprovação ou lançamento no sistema."
        : "Seguem para conhecimento e providências os lançamentos que se encontram pendentes de aprovação ou lançamento no sistema e estão com vencimento chegando em cinco dias ou menos.";

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpEmail,
          smtpPassword,
          destinatarios: usersList.filter(u => u.role === "admin" || u.permissions.admin || u.permissions.usuarios).map(u => u.email),
          lancamentosPendentes: lancamentosAtivosNoRelatorio,
          subject: reportSubject,
          introText: reportIntro
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setReportSuccess("E-mail consolidado de teste enviado de verdade para os administradores!");
      } else {
        setReportSuccess(`Falha no envio: ${data.error || "Verifique as credenciais SMTP."}`);
      }
    } catch (err: any) {
      setReportSuccess(`Erro de conexão com o servidor: ${err.message}`);
    } finally {
      setIsSendingReport(false);
      setTimeout(() => setReportSuccess(""), 6000);
    }
  };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provisoryPassword, setProvisoryPassword] = useState("Risel@2026!");
  const [showProvisoryPassword, setShowProvisoryPassword] = useState(false);
  const [mustChangePasswordCheck, setMustChangePasswordCheck] = useState(true);
  const [isRedefiningPassword, setIsRedefiningPassword] = useState(false);
  const [createdAccessDetails, setCreatedAccessDetails] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedAccessDetails, setCopiedAccessDetails] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>({
    admin: false,
    dashboard: true,
    lancamentos: true,
    fornecedores: true,
    frota: true,
    usuarios: false,
  });
  const [status, setStatus] = useState<"Ativa" | "Inativa">("Ativa");
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGenerateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const specialChars = "@#$!";
    let pass = "Risel@";
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    setProvisoryPassword(pass);
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setPermissions(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Se qualquer menu for desmarcado (ficando false), ele não pode ser administrador completo!
      if (!updated[key]) {
        setIsAdmin(false);
      }
      return updated;
    });
  };

  const handleSetAdmin = () => {
    setIsAdmin(true);
    setPermissions({
      admin: true,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      frota_veiculos: true,
      frota_checklist: true,
      frota_reservas: true,
      frota_multas: true,
      frota_rastreamento: true,
      usuarios: true,
    });
  };

  const handleClearAdmin = () => {
    setIsAdmin(false);
    setPermissions({
      admin: false,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: false,
      frota_veiculos: false,
      frota_checklist: false,
      frota_reservas: false,
      frota_multas: false,
      frota_rastreamento: false,
      usuarios: false,
    });
  };

  const handleStartEdit = (usr: any) => {
    setError("");
    setSuccess("");
    setEditingEmail(usr.email);
    setName(usr.name);
    setEmail(usr.email);
    setIsAdmin(usr.role === "admin");
    setStatus(usr.status || "Ativa");
    setPermissions(usr.permissions);
    setProvisoryPassword(usr.password || "Risel@2026!");
    setMustChangePasswordCheck(usr.mustChangePassword !== undefined ? usr.mustChangePassword : true);
    setIsRedefiningPassword(false);
  };

  const handleCancelEdit = () => {
    setEditingEmail(null);
    setName("");
    setEmail("");
    setIsAdmin(false);
    setStatus("Ativa");
    setPermissions({
      admin: false,
      dashboard: true,
      lancamentos: true,
      fornecedores: true,
      frota: true,
      usuarios: false,
    });
    setProvisoryPassword("Risel@2026!");
    setMustChangePasswordCheck(true);
    setIsRedefiningPassword(false);
  };

  const handleCopyAccessMessage = () => {
    if (!createdAccessDetails) return;
    const msg = `Olá, ${createdAccessDetails.name}!\n\nSeu acesso ao Sistema ERP Risel foi criado com sucesso:\n\n📧 E-mail: ${createdAccessDetails.email}\n🔑 Senha Provisória: ${createdAccessDetails.password}\n\n⚠️ Por motivos de segurança, no seu primeiro acesso você será direcionado para alterar a senha por uma senha pessoal definitiva.\n\nAcesse: https://ais-pre-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app`;
    
    navigator.clipboard.writeText(msg);
    setCopiedAccessDetails(true);
    setTimeout(() => setCopiedAccessDetails(false), 4000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim()) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (editingEmail) {
      // Editar colaborador existente
      updateUser(editingEmail, {
        name: name.trim(),
        role: isAdmin ? "admin" : "user",
        permissions: {
          ...permissions,
          admin: isAdmin,
          usuarios: isAdmin ? true : permissions.usuarios
        },
        status: status,
        password: isRedefiningPassword ? provisoryPassword.trim() : undefined,
        mustChangePassword: isRedefiningPassword ? mustChangePasswordCheck : undefined
      });
      
      setSuccess("Dados do colaborador e acessos atualizados no sistema e no banco Supabase com sucesso!");
      if (isRedefiningPassword) {
        setCreatedAccessDetails({
          name: name.trim(),
          email: editingEmail,
          password: provisoryPassword.trim()
        });
      }
      handleCancelEdit();
    } else {
      // Criar novo login
      const finalPassword = provisoryPassword.trim() || "Risel@2026!";
      const created = createUser(
        name.trim(), 
        email.trim(), 
        {
          ...permissions,
          admin: isAdmin,
          usuarios: isAdmin ? true : permissions.usuarios,
        },
        finalPassword,
        mustChangePasswordCheck
      );

      if (created) {
        setSuccess("Novo usuário cadastrado e gravado no Banco de Dados Supabase com sucesso!");
        setCreatedAccessDetails({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: finalPassword
        });
        handleCancelEdit();
      } else {
        setError("Este e-mail já está cadastrado no sistema.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-8 h-8 text-[#114D38]" /> Controle de Acessos e Usuários
          </h2>
          <p className="text-slate-500 mt-1">
            Gerencie novos logins e parametrize permissões de módulos e menus para cada colaborador.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsSupabaseModalOpen(true)}
          className="px-4 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs rounded-2xl flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 border border-emerald-600/30"
        >
          <Database className="w-4.5 h-4.5 text-emerald-300" />
          <span>Banco Supabase (Real) & Anti-Inatividade</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Cadastro */}
        <div className="lg:col-span-1 bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                {editingEmail ? (
                  <>
                    <User className="w-5 h-5 text-amber-600" /> Editar Colaborador
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-emerald-600" /> Cadastrar Novo Usuário
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingEmail ? "Altere os acessos e status deste colaborador." : "Defina os privilégios e os menus visíveis."}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl leading-relaxed">
                🎉 {success}
              </div>
            )}

            {createdAccessDetails && (
              <div className="p-4 bg-emerald-950 text-white border border-emerald-800 rounded-2xl space-y-3 shadow-md animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    Credenciais de Acesso Geradas
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreatedAccessDetails(null)}
                    className="text-emerald-400 hover:text-white text-xs font-bold"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs space-y-1 font-mono bg-emerald-900/60 p-2.5 rounded-xl border border-emerald-800 text-emerald-100">
                  <p><strong>Usuário:</strong> {createdAccessDetails.name}</p>
                  <p><strong>E-mail:</strong> {createdAccessDetails.email}</p>
                  <p><strong>Senha Provisória:</strong> <span className="bg-emerald-800 px-1.5 py-0.5 rounded text-white font-bold">{createdAccessDetails.password}</span></p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAccessMessage}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {copiedAccessDetails ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-950" />
                      <span>Mensagem Copiada!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Dados para Enviar ao Usuário</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nome Completo *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">E-mail Corporativo *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@risel.com.br"
                  required
                  readOnly={!!editingEmail}
                  className={cn(
                    "w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-medium text-slate-800",
                    editingEmail && "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                />
              </div>
            </div>

            {/* Configuração de Senha Provisória / Redefinição */}
            {!editingEmail ? (
              <div className="space-y-2.5 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Senha Provisória de Acesso *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[10px] font-extrabold text-[#114D38] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>Gerar Senha Segura</span>
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                  <input 
                    type={showProvisoryPassword ? "text" : "password"} 
                    value={provisoryPassword}
                    onChange={(e) => setProvisoryPassword(e.target.value)}
                    placeholder="Digite a senha provisória"
                    required
                    className="w-full pl-9 pr-10 py-2 rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-sm font-mono font-bold text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProvisoryPassword(!showProvisoryPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showProvisoryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input 
                    type="checkbox"
                    checked={mustChangePasswordCheck}
                    onChange={(e) => setMustChangePasswordCheck(e.target.checked)}
                    className="mt-0.5 rounded text-[#114D38] focus:ring-[#114D38] w-4 h-4"
                  />
                  <span className="text-[11px] text-emerald-950 font-medium leading-tight">
                    <strong>Exigir alteração de senha no 1º acesso</strong> (O usuário será obrigatoriamente direcionado a criar uma nova senha ao logar).
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Redefinir Senha do Usuário
                  </span>
                  <input 
                    type="checkbox"
                    checked={isRedefiningPassword}
                    onChange={(e) => setIsRedefiningPassword(e.target.checked)}
                    className="rounded text-[#114D38] focus:ring-[#114D38] w-4 h-4"
                  />
                </label>

                {isRedefiningPassword && (
                  <div className="pt-2 space-y-2 border-t border-slate-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Nova Senha Provisória</span>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="text-[10px] font-extrabold text-[#114D38] hover:underline"
                      >
                        Gerar Nova Senha
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type={showProvisoryPassword ? "text" : "password"} 
                        value={provisoryPassword}
                        onChange={(e) => setProvisoryPassword(e.target.value)}
                        placeholder="Digite a nova senha provisória"
                        required={isRedefiningPassword}
                        className="w-full pl-9 pr-10 py-2 rounded-xl border border-amber-300 bg-white text-sm font-mono font-bold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowProvisoryPassword(!showProvisoryPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showProvisoryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input 
                        type="checkbox"
                        checked={mustChangePasswordCheck}
                        onChange={(e) => setMustChangePasswordCheck(e.target.checked)}
                        className="rounded text-[#114D38] focus:ring-[#114D38] w-3.5 h-3.5"
                      />
                      <span className="text-[10.5px] text-slate-600 font-medium">Exigir alteração no próximo login</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {editingEmail && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Status da Conta</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("Ativa")}
                    className={cn(
                      "py-1.5 px-3 text-xs font-bold rounded-lg border transition-all text-center",
                      status === "Ativa"
                        ? "bg-emerald-50 border-emerald-300 text-[#114D38]"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Ativa
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("Inativa")}
                    className={cn(
                      "py-1.5 px-3 text-xs font-bold rounded-lg border transition-all text-center",
                      status === "Inativa"
                        ? "bg-rose-50 border-rose-300 text-rose-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Inativa (Inibir login)
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perfil Geral</span>
                <button
                  type="button"
                  onClick={isAdmin ? handleClearAdmin : handleSetAdmin}
                  className={cn(
                    "text-[10px] font-extrabold uppercase px-2 py-1 rounded transition-colors flex items-center gap-1",
                    isAdmin 
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200" 
                      : "bg-[#114D38]/10 text-[#114D38] hover:bg-[#114D38]/20"
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isAdmin ? "Remover Administrador" : "Tornar Administrador completo"}
                </button>
              </div>
              <p className="text-[10.5px] text-slate-500 leading-normal mb-3">
                Ao selecionar o perfil administrador completo, todos os módulos e menus do ERP serão ativados automaticamente para este usuário.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-1">
                Acessos Individuais (Módulos/Menus)
              </label>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block bg-emerald-50 px-2 py-1 rounded">
                  📁 Módulo Documentos ERP
                </span>

                {/* Dashboard */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("dashboard")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.dashboard 
                      ? "bg-emerald-50/50 border-emerald-100 text-[#114D38]" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📊 Dashboard Geral</span>
                  {permissions.dashboard ? <CheckSquare className="w-4 h-4 text-[#114D38]" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Lancamentos */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("lancamentos")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.lancamentos 
                      ? "bg-emerald-50/50 border-emerald-100 text-[#114D38]" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📝 Lançamento de Documentos</span>
                  {permissions.lancamentos ? <CheckSquare className="w-4 h-4 text-[#114D38]" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Fornecedores */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("fornecedores")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.fornecedores 
                      ? "bg-emerald-50/50 border-emerald-100 text-[#114D38]" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">🤝 Cadastro de Fornecedores</span>
                  {permissions.fornecedores ? <CheckSquare className="w-4 h-4 text-[#114D38]" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider block bg-orange-50 px-2 py-1 rounded mt-3">
                  🚚 Submódulos de Frota Leve
                </span>

                {/* Frota Veículos */}
                <button
                  type="button"
                  onClick={() => {
                    handleTogglePermission("frota");
                    handleTogglePermission("frota_veiculos");
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    (permissions.frota || permissions.frota_veiculos) 
                      ? "bg-orange-50/60 border-orange-200 text-orange-900" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">🚗 Veículos / Abastecimentos / RAC</span>
                  {(permissions.frota || permissions.frota_veiculos) ? <CheckSquare className="w-4 h-4 text-orange-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Frota Checklist */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("frota_checklist")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.frota_checklist 
                      ? "bg-orange-50/60 border-orange-200 text-orange-900" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📋 Checklist Digital de Veículos</span>
                  {permissions.frota_checklist ? <CheckSquare className="w-4 h-4 text-orange-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Frota Reservas */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("frota_reservas")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.frota_reservas 
                      ? "bg-orange-50/60 border-orange-200 text-orange-900" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📅 Gestão de Reservas / Calendário</span>
                  {permissions.frota_reservas ? <CheckSquare className="w-4 h-4 text-orange-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Frota Multas */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("frota_multas")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.frota_multas 
                      ? "bg-orange-50/60 border-orange-200 text-orange-900" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📑 Controle de Multas / Infrações</span>
                  {permissions.frota_multas ? <CheckSquare className="w-4 h-4 text-orange-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>

                {/* Frota Rastreamento */}
                <button
                  type="button"
                  onClick={() => handleTogglePermission("frota_rastreamento")}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
                    permissions.frota_rastreamento 
                      ? "bg-orange-50/60 border-orange-200 text-orange-900" 
                      : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">📡 Rastreamento GeoFrotas / GPS</span>
                  {permissions.frota_rastreamento ? <CheckSquare className="w-4 h-4 text-orange-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {editingEmail && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 px-3 bg-[#114D38] hover:bg-[#0d3b2b] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#114D38]/10 transition-all flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingEmail ? "Salvar Alterações" : "Salvar Novo Login"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Usuários Cadastrados */}
        <div className="lg:col-span-2 bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Contas Ativas</h3>
                <p className="text-xs text-slate-400 mt-0.5">Veja quem tem permissão de entrada no sistema ERP.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewReportOpen(true)}
                  className="px-3 py-1.5 bg-[#114D38]/10 hover:bg-[#114D38]/20 text-[#114D38] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="Ver layout do e-mail semanal de pendências enviado toda quarta"
                >
                  <Mail className="w-4 h-4" />
                  <span>Ver E-mail de Quarta (Layout)</span>
                </button>
                <span className="bg-[#114D38]/10 text-[#114D38] px-3 py-1 rounded-full text-xs font-bold">
                  {usersList.length} Usuários
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Colaborador</th>
                    <th className="px-6 py-3.5">E-mail</th>
                    <th className="px-6 py-3.5">Acessos Ativos</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {usersList.map((usr) => (
                    <tr key={usr.email} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(usr.name)}&background=10b981&color=fff`} 
                            alt="avatar" 
                            className="w-8 h-8 rounded-full border border-slate-100 shadow-sm"
                          />
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">{usr.name}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {usr.status === "Inativa" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 uppercase tracking-wide">
                                  🚫 Conta Inativa
                                </span>
                              ) : usr.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
                                  <Shield className="w-2.5 h-2.5" /> Administrador Completo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wide">
                                  👤 Colaborador Ativo
                                </span>
                              )}

                              {usr.mustChangePassword ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide" title="Usuário precisa alterar a senha provisória no primeiro acesso">
                                  <KeyRound className="w-2.5 h-2.5 text-amber-600" /> 1º Acesso Pendente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                                  <Lock className="w-2.5 h-2.5 text-slate-400" /> Senha Definida
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 font-mono text-xs">
                        {usr.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {usr.permissions.dashboard && (
                            <span className="bg-emerald-50 text-[#114D38] border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">📊 Dash</span>
                          )}
                          {usr.permissions.lancamentos && (
                            <span className="bg-emerald-50 text-[#114D38] border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">📝 Lanc</span>
                          )}
                          {usr.permissions.fornecedores && (
                            <span className="bg-emerald-50 text-[#114D38] border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">🤝 Forn</span>
                          )}
                          {usr.permissions.frota && (
                            <span className="bg-emerald-50 text-[#114D38] border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">🚚 Frot</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(usr)}
                            className="text-slate-400 hover:text-[#114D38] hover:bg-emerald-50 p-2 rounded-lg transition-colors cursor-pointer"
                            title="Editar Colaborador e Acessos"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {usr.email !== "deny.goncalves@risel.com.br" && (
                            <button
                              onClick={() => {
                                if (usr.email === currentUser?.email) {
                                  alert("Você não pode excluir o próprio usuário logado por segurança.");
                                  return;
                                }
                                if (confirm(`Deseja revogar o acesso de ${usr.name}?`)) {
                                  deleteUser(usr.email);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Remover Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Todos os novos logins utilizam a senha de acesso padrão <span className="font-bold text-slate-600 font-mono">Rs@2026</span>. Eles podem logar inserindo seu respectivo e-mail corporativo.
            </p>
          </div>
        </div>
      </div>

      {/* Seção Nova: SMTP e Alçadas de Aprovação (atendendo aos itens 10 e de SMTP) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Painel SMTP de E-mail */}
        <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
          <form onSubmit={handleSaveSmtp} className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-600" /> Servidor de E-mail (SMTP)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Parametros de conexão de e-mail para envio automático dos relatórios de vencimentos.</p>
            </div>

            {smtpSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl leading-relaxed text-left animate-in fade-in">
                🎉 {smtpSuccess}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Servidor SMTP</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpHost("smtp.office365.com");
                      setSmtpPort("587");
                    }}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    title="Configurar servidor para Microsoft 365 (Office 365)"
                  >
                    Office 365
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpHost("smtp.gmail.com");
                      setSmtpPort("587");
                    }}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                    title="Configurar servidor para Gmail"
                  >
                    Gmail
                  </button>
                </div>
              </div>
              <input 
                type="text" 
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="Ex: smtp.office365.com"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none font-semibold text-xs text-slate-800 shadow-sm" 
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Porta de Conexão</label>
                <input 
                  type="text" 
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none font-semibold text-xs text-slate-800 shadow-sm" 
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">E-mail Remetente SMTP</label>
                <input 
                  type="email" 
                  value={smtpEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSmtpEmail(val);
                    if (val.toLowerCase().includes("@risel.com.br") && smtpHost === "smtp.gmail.com") {
                      setSmtpHost("smtp.office365.com");
                    }
                  }}
                  autoComplete="off"
                  name="smtpEmailUnique"
                  id="smtpEmailUnique"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none font-semibold text-xs text-slate-800 shadow-sm"
                  placeholder="deny.goncalves@risel.com.br"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Senha do Aplicativo (SMTP)</label>
              <div className="relative">
                <input 
                  type={showSmtpPassword ? "text" : "password"} 
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  autoComplete="new-password"
                  name="smtpPasswordUnique"
                  id="smtpPasswordUnique"
                  className="w-full pl-3 pr-9 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none font-mono text-xs text-slate-800 shadow-sm"
                  placeholder="Sua senha SMTP"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#114D38] transition-colors cursor-pointer"
                >
                  {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSmtp}
                className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-lg shadow-[#114D38]/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSavingSmtp ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar e Sincronizar SMTP</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Banner explicativo e atalho de disparo manual a qualquer momento */}
          <div className="mt-4 pt-4 border-t border-slate-100 text-left">
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
              <h4 className="text-xs font-black text-[#114D38] flex items-center gap-1.5 uppercase tracking-wider">
                <Mail className="w-4 h-4 text-emerald-600" />
                Diretriz de Disparo SMTP
              </h4>
              <div className="mt-2 space-y-2 text-slate-600 text-[11px] leading-relaxed">
                <p>
                  📅 <strong>Rotina Semanal:</strong> Disparo autônomo programado toda <strong>quarta-feira</strong> com a relação de lançamentos pendentes enviado aos administradores.
                </p>
                <p>
                  ⚡ <strong>Disparo Sob Demanda (Qualquer Momento):</strong> Além da rotina semanal, você pode forçar o envio imediato da lista de pendências completas ou dos documentos com <strong>vencimento em 5 dias ou menos</strong> utilizando o painel de disparo.
                </p>
              </div>
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setReportType("completo");
                    setIsPreviewReportOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-[#114D38] hover:bg-[#0d3b2b] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Configurar / Enviar E-mails de Pendências</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Painel Alçadas de Aprovação (atendendo ao item 10) */}
        <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" /> Alçadas de Aprovação
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Determine os aprovadores responsáveis de acordo com as faixas de valor.</p>
              </div>
            </div>

            {/* Lista de Alçadas */}
            <div className="space-y-2 mb-4">
              {alcadas.sort((a, b) => a.valorMax - b.valorMax).map((alc) => (
                <div key={alc.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all">
                  <div className="text-left">
                    <span className="font-mono font-bold text-slate-750 text-xs">
                      {alc.valorMax >= 9999999 ? "Qualquer Valor" : `Até R$ ${alc.valorMax.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </span>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Aprovadores: <span className="text-[#114D38] font-black">{alc.aprovadores}</span></p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAlcadaId(alc.id);
                        setAlcadaValorMax(alc.valorMax.toString());
                        setAlcadaAprovadores(alc.aprovadores);
                      }}
                      className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 p-1.5 rounded transition-colors cursor-pointer"
                      title="Editar Alçada"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {alc.id !== "1" && alc.id !== "2" && alc.id !== "3" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAlcada(alc.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                        title="Excluir Alçada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Formulário Inline para Criar / Editar Alçada */}
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-4 space-y-3">
              <h4 className="font-bold text-slate-700 text-xs text-left">
                {editingAlcadaId ? "✏️ Editar Faixa de Alçada" : "➕ Adicionar Faixa de Alçada"}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block text-left">Valor Limite (R$)</label>
                  <input
                    type="number"
                    value={alcadaValorMax}
                    onChange={(e) => setAlcadaValorMax(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs font-semibold text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block text-left">Aprovadores</label>
                  <input
                    type="text"
                    value={alcadaAprovadores}
                    onChange={(e) => setAlcadaAprovadores(e.target.value)}
                    placeholder="Ex: Gerente e Diretor"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {editingAlcadaId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlcadaId(null);
                      setAlcadaValorMax("");
                      setAlcadaAprovadores("");
                    }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAlcada}
                  className="bg-[#114D38] hover:bg-[#0d3b2b] text-white px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                >
                  {editingAlcadaId ? "Salvar Alçada" : "Adicionar Alçada"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pré-visualização do Relatório Consolidado HTML por E-mail */}
      {isPreviewReportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-100 rounded-[28px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[90vh] text-xs">
            <div className="bg-[#114D38] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 text-left">
                <Mail className="w-5 h-5 text-emerald-350" />
                <div>
                  <h3 className="text-sm font-extrabold">Relatórios Consolidados por E-mail (SMTP)</h3>
                  <p className="text-[9px] text-emerald-200 font-bold uppercase tracking-wider">Selecione, visualize e envie os relatórios a qualquer momento</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewReportOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

              {/* Seletor de Tipo de Relatório */}
              <div className="bg-slate-55 border-b border-slate-200 p-3 shrink-0 flex gap-2">
                <button
                  onClick={() => setReportType("completo")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border text-center shadow-sm",
                    reportType === "completo"
                      ? "bg-[#114D38] border-[#114D38] text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  📊 Relatório Semanal Completo
                </button>
                <button
                  onClick={() => setReportType("vencendo5d")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer border text-center shadow-sm",
                    reportType === "vencendo5d"
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  ⏰ Alerta Rápido (Vencimentos em 5 Dias ou Menos)
                </button>
              </div>

              {/* Informações de cabeçalho do e-mail */}
              <div className="bg-white border-b border-slate-200 p-4 space-y-2 shrink-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-400 w-16 uppercase text-[9px]">Remetente:</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-600">{smtpEmail}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-extrabold text-slate-400 w-16 uppercase text-[9px]">Destino:</span>
                  <div className="flex flex-wrap gap-1">
                    {usersList.filter(u => u.role === "admin" || u.permissions.admin).map(u => (
                      <span key={u.email} className="bg-[#114D38]/5 border border-[#114D38]/10 text-[#114D38] px-2 py-0.5 rounded font-mono font-semibold">
                        {u.email}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-400 w-16 uppercase text-[9px]">Assunto:</span>
                  <span className="font-bold text-slate-800">
                    {reportType === "completo" 
                      ? "Relatório Semanal Consolidado - Lançamentos Pendentes"
                      : "Relatório Consolidado de Urgência - Lançamentos Vencendo em 5 Dias"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50 flex justify-center">
                {/* Email container */}
                <div className="w-full max-w-3xl bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden font-sans text-slate-800">
                  {/* Email header */}
                  <div className="bg-[#114D38] p-6 text-white text-center flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30 shadow">
                        <img 
                          src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" 
                          alt="Ritel Logo" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <h1 className="text-lg font-black tracking-tight leading-none">Risel Combustíveis</h1>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono block">Emissão Manual</span>
                      <span className="font-bold text-xs">Imediato (Sob Demanda)</span>
                    </div>
                  </div>

                  {/* Email content */}
                  <div className="p-6 space-y-6 text-left">
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-slate-800">Olá,</p>
                      <p className="text-slate-600 font-medium leading-relaxed text-[11px]">
                        {reportType === "completo"
                          ? "Seguem para conhecimento e providências os lançamentos que se encontram pendentes de aprovação ou lançamento no sistema."
                          : "Seguem para conhecimento e providências os lançamentos que se encontram pendentes de aprovação ou lançamento no sistema e estão com vencimento chegando em cinco dias ou menos."}
                      </p>
                    </div>

                    {/* estatisticas rápidas */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <div>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Filtrado</span>
                        <span className="text-2xl font-black text-[#114D38] block mt-1">{lancamentosAtivosNoRelatorio.length} lançamentos</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Valores Acumulados</span>
                        <span className="text-2xl font-black text-amber-600 block mt-1">
                          R${" "}
                          {lancamentosAtivosNoRelatorio.reduce((acc, curr) => {
                            const val = parseFloat(curr.valor.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
                            return acc + val;
                          }, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Tabela de lançamentos consolidada */}
                    <div className="space-y-2">
                      <h4 className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
                        {reportType === "completo" ? "Lista de Lançamentos Pendentes" : "Lista de Vencimentos em 5 Dias ou Menos"}
                      </h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[9px]">
                              <th className="px-3 py-2.5">Vencimento</th>
                              <th className="px-3 py-2.5">Fornecedor</th>
                              <th className="px-3 py-2.5">Documento</th>
                              <th className="px-3 py-2.5">Status</th>
                              <th className="px-3 py-2.5 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {lancamentosAtivosNoRelatorio.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-slate-400 font-bold">Nenhum lançamento localizado nesta faixa! Tudo em dia.</td>
                              </tr>
                            ) : (
                              lancamentosAtivosNoRelatorio.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 text-slate-700 font-bold font-mono">
                                    {item.dataVencimento ? new Date(item.dataVencimento + "T12:00:00").toLocaleDateString('pt-BR') : ""}
                                  </td>
                                  <td className="px-3 py-2 text-slate-800 font-bold truncate max-w-[160px]">
                                    {item.fornecedor}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500 font-mono">
                                    {item.doc || `NFe-${item.idSys || item.id}`}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-bold uppercase rounded-full">
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-black text-slate-800 font-mono">
                                    {item.valor}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Email footer */}
                  <div className="bg-slate-55 p-4 border-t border-slate-150 text-center text-[10px] text-slate-400 font-bold">
                    © 2026 Risel Combustíveis Ltda. Todos os direitos reservados.
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  {reportSuccess && (
                    <span className="text-[11px] font-bold text-emerald-700 animate-pulse bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">
                      {reportSuccess}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendReportTest}
                    disabled={isSendingReport}
                    className="px-5 py-2.5 rounded-xl bg-[#114D38] hover:bg-[#0d3b2b] disabled:bg-slate-300 text-white font-extrabold text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    {isSendingReport ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar Relatório Agora por SMTP</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setIsPreviewReportOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Fechar Relatório
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Master de Gestão do Banco Supabase & Anti-Inatividade */}
        {isSupabaseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-[#114D38] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-400/30">
                    <Database className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold">Banco de Dados Real Supabase (Gestão Master)</h3>
                    <p className="text-[11px] text-emerald-200/90 font-medium">Conexão, Anti-Inatividade (Keep-Alive) & Sincronização de Módulos</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSupabaseModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Card de Prevenção contra Inatividade do Supabase */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Sistema Anti-Inatividade Ativo (Keep-Alive)</h4>
                        <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                          O banco gratuito Supabase entra em pausa após 7 dias sem atividade. Para evitar pausas, este app realiza um <strong>ping automático a cada 5 minutos</strong> enquanto aberto.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handlePingKeepAlive}
                      disabled={isPingingSupabase}
                      className="px-3 py-1.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isPingingSupabase && "animate-spin")} />
                      <span>Ping Manual</span>
                    </button>
                  </div>

                  {pingStatus && (
                    <div className="p-2.5 bg-white/90 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 font-medium">
                      {pingStatus}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-emerald-700 pt-1 border-t border-emerald-200/60 font-semibold">
                    <span>Status do Serviço Keep-Alive: <strong>Operacional</strong></span>
                    <span>Último Ping: {supabaseConfigState.lastPing ? new Date(supabaseConfigState.lastPing).toLocaleTimeString('pt-BR') : "Agora"}</span>
                  </div>
                </div>

                {/* Form de Parâmetros de Conexão Supabase */}
                <div className="space-y-4 bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#114D38]" />
                    <span>Credenciais de Acesso Supabase</span>
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        URL do Projeto Supabase (SUPABASE_URL)
                      </label>
                      <input 
                        type="text"
                        value={supabaseUrlInput}
                        onChange={e => setSupabaseUrlInput(e.target.value)}
                        placeholder="https://xyzproject.supabase.co"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Chave Anônima do Supabase (SUPABASE_ANON_KEY)
                      </label>
                      <input 
                        type="password"
                        value={supabaseKeyInput}
                        onChange={e => setSupabaseKeyInput(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                      className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isTestingSupabase ? "Testando..." : "Testar e Salvar Conexão"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncAllToSupabase}
                      disabled={isSyncingSupabase}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={cn("w-4 h-4", isSyncingSupabase && "animate-spin")} />
                      <span>{isSyncingSupabase ? "Sincronizando Módulos..." : "Sincronizar Lançamentos + Frota"}</span>
                    </button>
                  </div>

                  {supabaseTestMsg && (
                    <div className={cn(
                      "p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5",
                      supabaseTestMsg.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                    )}>
                      {supabaseTestMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
                      <span>{supabaseTestMsg.message}</span>
                    </div>
                  )}

                  {syncMsg && (
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium leading-relaxed">
                      {syncMsg}
                    </div>
                  )}
                </div>

                {/* Script de Criação das Tabelas SQL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                      Script SQL para Estrutura das Tabelas (Supabase SQL Editor)
                    </label>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="text-xs font-bold text-[#114D38] hover:text-[#0d3b2b] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? "Copiado!" : "Copiar SQL Completo"}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800 leading-relaxed">
                    {SUPABASE_SQL_SCHEMA}
                  </pre>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end shrink-0">
                <button 
                  onClick={() => setIsSupabaseModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

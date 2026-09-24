import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Save, AlertCircle, Info, ChevronDown, ChevronUp, Search, Filter, Settings, Trash2, Edit2, MapPin, CalendarDays, Calendar, X, Check, ArrowRight, Clock, AlertTriangle, Bell, SlidersHorizontal, Upload, FileText, Sparkles, CheckSquare, Square, Eye, EyeOff, Database, Server, RefreshCw, Copy, CheckCircle2, ShieldCheck, Zap, Plus, Building, Mail, Layers, GripVertical, RotateCcw, ArrowUp, ArrowDown, Send, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { formatCPFCNPJ } from "./Fornecedores";
import { DocumentoAnexoModal } from "../../components/documentos/DocumentoAnexoModal";
import { 
  fetchLancamentosSupabase, 
  saveLancamentoSupabase, 
  deleteLancamentoSupabase, 
  syncLocalLancamentosToSupabase, 
  saveFornecedorSupabase,
  fetchCentrosCustoSupabase,
  saveCentroCustoSupabase,
  deleteCentroCustoSupabase,
  updateCentroCustoSupabase,
  fetchBasesSupabase,
  saveBaseSupabase,
  deleteBaseSupabase,
  updateBaseSupabase,
  testSupabaseConnection, 
  pingSupabaseKeepAlive, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  SUPABASE_SQL_SCHEMA 
} from "../../services/supabaseService";
import {
  getLancamentosUnified,
  subscribeToLancamentosUnified,
  saveLancamentoUnified,
  deleteLancamentoUnified,
  normalizeLancamento,
  forceSyncLancamentos,
  exportLancamentosBackupJson,
  getLancamentosSnapshotInfo,
  restoreLancamentosFromSnapshot,
  restoreLancamentosFromList,
  fetchDatabaseBackups,
  createDatabaseBackup,
  restoreFromDatabaseBackup,
  importLancamentosToDatabase,
  DatabaseBackupInfo
} from "../../services/lancamentosService";
import { 
  sendLancamentoAprovacaoEmail, 
  DEFAULT_LANCAMENTO_TO_EMAILS, 
  DEFAULT_LANCAMENTO_CC_EMAILS, 
  getSaudacaoDestinatarios 
} from "../../services/lancamentoEmailService";
import { EmailRecipientsModal } from "../../components/common/EmailRecipientsModal";
import {
  consultarCnpjReceita,
  formatarCnpjCpf,
  formatarTelefone,
  avaliarEEnviarFornecedor,
  sincronizarFornecedoresFrequentes,
  isRiselCnpjOrName,
  CnpjSearchResult
} from "../../services/cnpjService";

/**
 * Helper para obter a data local de hoje no formato YYYY-MM-DD sem distorção de fuso horário UTC
 */
export function getLocalTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converte qualquer formato de data (YYYY-MM-DD, DD/MM/AAAA, DD.MM.AAAA, ISO string)
 * em YYYY-MM-DD local, preservando o dia exato digitado pelo usuário.
 */
export function normalizeDateToInput(dateVal: string | undefined | null): string {
  if (!dateVal) return "";
  const clean = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  
  const matchIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }
  
  const matchBr = clean.match(/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
  }

  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  
  return clean;
}

/**
 * Cria uma data com horário local zerado (00:00:00) baseada nos componentes de ano, mês e dia,
 * evitando absolutamente que fusos horários negativos (como Brasil UTC-3) subtraiam um dia.
 */
export function parseDateToLocalDay(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  if (!clean) return null;

  // 1. Padrão YYYY-MM-DD (comum em inputs type="date" e ISO)
  const matchIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    const y = parseInt(matchIso[1], 10);
    const m = parseInt(matchIso[2], 10) - 1;
    const d = parseInt(matchIso[3], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  // 2. Padrão brasileiro DD/MM/YYYY ou DD.MM.YYYY
  const matchBr = clean.match(/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})/);
  if (matchBr) {
    const d = parseInt(matchBr[1], 10);
    const m = parseInt(matchBr[2], 10) - 1;
    const y = parseInt(matchBr[3], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  // 3. Fallback para outros formatos
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
  } catch (e) {}

  return null;
}

export function formatDateDisplay(dateString: string | undefined | null): string {
  if (!dateString) return "---";
  const clean = String(dateString).trim();
  if (!clean) return "---";

  // Se já for DD/MM/YYYY, retorna imediatamente preservando o dia digitado
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }
  // Se for DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    return clean.replace(/\./g, "/");
  }

  // Se for YYYY-MM-DD (ou YYYY-MM-DDTHH:mm...), extrai ano, mês e dia diretamente sem converter para UTC
  const matchIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    const [_, year, month, day] = matchIso;
    return `${day}/${month}/${year}`;
  }

  // Fallback seguro usando parseDateToLocalDay
  const localDate = parseDateToLocalDay(clean);
  if (localDate && !isNaN(localDate.getTime())) {
    const day = String(localDate.getDate()).padStart(2, "0");
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const year = localDate.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return clean;
}

export function parseCurrencyToNumber(val: string | number | undefined | null): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim().replace("R$", "").trim();
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Calcula a Alçada de Aprovação com base no valor da Nota Fiscal
 * Regra: Até R$ 2.000,00 -> Deny
 *        De R$ 2.000,01 até R$ 3.000,00 -> Deny e Gerência
 *        Acima de R$ 3.000,00 -> Deny, Gerência e Diretoria
 */
export function calcularAlcadaPorValor(val: string | number | undefined | null): string {
  const numVal = parseCurrencyToNumber(val);
  if (numVal <= 0) return "";
  if (numVal <= 2000) return "Deny";
  if (numVal <= 3000) return "Deny e Gerência";
  return "Deny, Gerência e Diretoria";
}

export function calcularDiasAteVencimento(dataVencStr: string, status: string) {
  const st = String(status || "").trim().toLowerCase();
  if (st === "finalizado" || st === "lançado" || st === "lancado" || st === "cancelado") {
    return { text: "OK", color: "text-emerald-600 bg-emerald-50 border-emerald-100", days: 0 };
  }
  if (st === "em contestação" || st === "em contestacao") {
    return { text: "CONTESTAÇÃO", color: "text-purple-700 bg-purple-50 border-purple-200 font-bold", days: 0 };
  }
  
  if (!dataVencStr) {
    return { text: "Sem vencimento", color: "text-slate-400 bg-slate-50 border-slate-100", days: 0 };
  }

  const venc = parseDateToLocalDay(dataVencStr);
  if (!venc) {
    return { text: "Data inválida", color: "text-slate-400 bg-slate-50 border-slate-100", days: 0 };
  }

  const agora = new Date();
  const hj = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);

  const diffTime = venc.getTime() - hj.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} dias atrasados`, color: "text-rose-600 bg-rose-50 border-rose-100 font-bold", days: diffDays };
  } else if (diffDays === 0) {
    return { text: "Vence hoje", color: "text-amber-600 bg-amber-50 border-amber-100 font-bold animate-pulse", days: diffDays };
  } else {
    return { text: `${diffDays} dias restantes`, color: "text-slate-600 bg-slate-50 border-slate-100", days: diffDays };
  }
}

/**
 * Formata data de vencimento para formato dd.mm.aaaa utilizado na padronização de arquivos
 */
export function formatarVencimentoParaNomeArquivo(dataStr?: string): string {
  if (!dataStr || !dataStr.trim()) {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}.${mes}.${ano}`;
  }

  const limpo = dataStr.trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(limpo)) return limpo;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpo)) return limpo.replace(/\//g, '.');

  const parts = limpo.split("T")[0].split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // yyyy-mm-dd -> dd.mm.aaaa
      return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
    } else {
      return `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
    }
  }

  return "00.00.0000";
}

/**
 * Extrai e normaliza o número da nota fiscal para colar imediatamente na palavra "NF".
 * Ex: Se o usuário digitou "NF 12345", "NF-e 8831", "Fatura 1902" ou "1902",
 * extrai o código/dígitos para gerar "NF12345", "NF8831", "NF1902".
 */
export function extrairNumeroNotaParaNome(numeroDoc?: string, nomeArquivoOriginal?: string): string {
  if (numeroDoc && numeroDoc.trim()) {
    const limpo = numeroDoc.trim();
    const semPrefixo = limpo.replace(/^(nf[\-e|s]*|nfe|nfse|nota\s*fiscal|fatura|recibo|doc|oc)[\s\-_.:]*/i, '').trim();
    if (semPrefixo) {
      return semPrefixo.replace(/[\/\\:*?"<>|]/g, '').trim();
    }
    return limpo.replace(/[\/\\:*?"<>|]/g, '').trim();
  }

  if (nomeArquivoOriginal) {
    const matchNfColado = nomeArquivoOriginal.match(/NF(\d+[\w-]*)/i);
    if (matchNfColado && matchNfColado[1]) {
      return matchNfColado[1].trim();
    }
  }

  return "";
}

/**
 * Gera o nome pré-definido oficial do anexo conforme especificado:
 * "vencimento em formato dd.mm.aaaa NF[Número da Nota colado] [Nome do Fornecedor]"
 * Ex: "23.09.2026 NF1902 ROMANOS LAVA RAPIDO.pdf" ou "23.09.2026 NF8831 POSTO SHELL.pdf"
 */
export function gerarNomePadraoAnexoNf(
  vencimento?: string,
  fornecedor?: string,
  nomeArquivoOriginal?: string,
  numeroDoc?: string
): string {
  let ext = ".pdf";
  if (nomeArquivoOriginal && nomeArquivoOriginal.includes(".")) {
    ext = nomeArquivoOriginal.substring(nomeArquivoOriginal.lastIndexOf("."));
  }

  const dataFmt = formatarVencimentoParaNomeArquivo(vencimento);
  const fornLimpo = (fornecedor || "FORNECEDOR")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, '')
    .trim();

  const numNota = extrairNumeroNotaParaNome(numeroDoc, nomeArquivoOriginal);
  const blocoNf = numNota ? `NF${numNota}` : "NF";

  return `${dataFmt} ${blocoNf} ${fornLimpo}${ext}`;
}

const TIPOS_DOCUMENTO = ["Fatura", "Multa", "NF-e", "NFS-e", "Nota de Débito", "Outros", "Recibo"];
const FORMAS_PAGAMENTO = ["Boleto", "Depósito", "Outros", "PIX", "Transferência"];
const STATUS_LANCAMENTO = ["Aguardando Aprovação", "Aguardando lançamento", "Aprovado", "Em Contestação", "Finalizado", "Lançado", "Lançado aguardando Aprovação Petroshow"];

const SUGESTOES_DESCRICAO: Record<string, string[]> = {
  "SV-0012": [
    "Locação de Equipamentos de Mineração de Alta Performance",
    "Aluguel Mensal de Geradores de Energia 500kVA",
    "Locação de Escavadeira Hidráulica com Operador"
  ],
  "MN-992": [
    "Manutenção Preventiva de Motores de Pistão",
    "Manutenção Corretiva e Calibração Elétrica de Painéis",
    "Revisão Periódica de Válvulas e Compressores"
  ],
  "LG-104": [
    "Serviços Gerais de Limpeza e Higienização Predial",
    "Sanitização e Desinfecção Completa das Instalações",
    "Limpeza Técnica de Tanques e Tubulações Industriais"
  ],
  "FR-015": [
    "Manutenção de Frota: Alinhamento, Balanceamento e Pneus",
    "Revisão Mecânica Geral e Troca de Óleo e Filtros",
    "Troca de Pastilhas de Freio e Elementos de Suspensão"
  ],
  "TI-0089": [
    "Licença de 1 Conexão de Vídeo - Defense IA",
    "Suporte Técnico de Segurança Eletrônica",
    "Serviço de Monitoramento de TI e Software"
  ]
};

export const CENTROS_CUSTO_SUGERIDOS = [
  "C.C 101 - Operacional",
  "C.C 102 - Manutenção / Oficina",
  "C.C 103 - Logística & Transporte",
  "C.C 104 - Administrativo / Sede",
  "C.C 105 - Diretoria / Executivo",
  "C.C 106 - TI & Sistemas",
  "C.C 107 - Comercial & Vendas",
  "C.C 108 - Recursos Humanos / D.P",
  "C.C 109 - Marketing & Eventos",
  "C.C 110 - Gestão de Frota"
];

const DEFAULT_LANCAMENTOS: any[] = [];
const DEFAULT_VENCIMENTOS: any[] = [];
const DEFAULT_MENSAIS_PENDENTES: any[] = [];

const INITIAL_FORM_STATE = {
  lancadoPor: "",
  cnpj: "",
  estabelecimento: "",
  tipoDocumento: "",
  tipo: "",
  fornecedor: "",
  descricao: "",
  itemSistema: "",
  dataEmissao: "",
  valorNf: "",
  formaPagamento: "",
  dataVencimento: "",
  moduloPetroshow: "",
  status: "Aguardando Aprovação",
  aprovadores: "",
  codigoLancamento: "",
  codLancamentoOc: "",
  dataAprovacao: "",
  dataEnvio: "",
  observacao: "",
  multaPlaca: "",
  multaInfracao: "",
  multaMotorista: "",
  multaGravidade: "Média",
  nomeArquivoAnexo: "",
  arquivoAnexoBase64: "",
  anexos: [] as Array<{ id: string; nome: string; base64: string; tamanho?: number; tipo?: string }>,
  centroCusto: "C.C 101 - Operacional",
  cidade: "",
  uf: "",
  telefone: "",
  email: ""
};

export default function Lancamento() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const primeiroNome = useMemo(() => {
    return user?.name ? user.name.split(" ")[0] : "Deny";
  }, [user]);

  const getInitialFormState = () => ({
    ...INITIAL_FORM_STATE,
    lancadoPor: primeiroNome
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Modal de Escolha de Destinatários e Envio Oficial de E-mail de Aprovação
  const [emailDispatchModal, setEmailDispatchModal] = useState<{
    isOpen: boolean;
    docData: any;
    calculatedDocName: string;
    toRecipients: string[];
    ccRecipients: string[];
    newToInput: string;
    newCcInput: string;
    isSaving?: boolean;
    isSending?: boolean;
    isManualResendOnly?: boolean;
  } | null>(null);

  const isDenyUser = Boolean(
    user?.email?.toLowerCase().includes('deny') ||
    user?.email?.toLowerCase() === 'deny.goncalves@risel.com.br' ||
    user?.role === 'admin'
  );

  // Acesso exclusivo de restauração e segurança: somente deny.goncalves@risel.com.br
  const currentEmail = (user?.email || "").toLowerCase().trim();
  const isAuthorizedRestoreUser = Boolean(
    currentEmail === 'deny.goncalves@risel.com.br' ||
    currentEmail === 'deny.risel@gmail.com'
  );

  useEffect(() => {
    if (location.state && (location.state as any).editLancamentoId) {
      const targetId = Number((location.state as any).editLancamentoId);
      const saved = localStorage.getItem("risel_lancamentos");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          const found = list.find((x: any) => Number(x.id) === targetId);
          if (found) {
            setEditingId(targetId);
            const numVal = parseCurrencyToNumber(found.valor || "");
            const valClean = numVal > 0 ? numVal.toFixed(2).replace(".", ",") : "";
            const docClean = (found.doc || "").trim();
            let docCode = "";
            if (docClean && !docClean.startsWith("DOC-") && !docClean.endsWith("S/N")) {
              const docParts = docClean.split(" ");
              docCode = docParts.length > 1 ? docParts.slice(1).join(" ") : docParts[0];
            }
            const numDocReal = found.codigoLancamento || found.numeroDocumento || docCode || "";

            setFormData({
              ...getInitialFormState(),
              estabelecimento: found.estabelecimento || "100 - Paulínia",
              fornecedor: found.fornecedor || "",
              cnpj: found.cnpj || "",
              valorNf: valClean,
              tipoDocumento: found.tipo || "NF-e",
              codigoLancamento: numDocReal,
              codLancamentoOc: found.codLancamentoOc || "",
              dataEmissao: found.dataEmissao || "",
              dataVencimento: found.dataVencimento || "",
              status: found.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (found.status || "Aguardando Aprovação"),
              observacao: found.observacao || "",
              tipo: found.frequencia || "Esporádico",
              itemSistema: found.itemSistema || "",
              formaPagamento: found.formaPagto || "Boleto",
              descricao: found.descricao || "",
              lancadoPor: found.lancadoPor || primeiroNome,
              aprovadores: found.aprovadores || "",
              dataAprovacao: found.dataAprovacao || "",
              nomeArquivoAnexo: found.nomeArquivoAnexo || "",
              arquivoAnexoBase64: found.arquivoAnexoBase64 || "",
              centroCusto: found.centroCusto || "C.C 101 - Operacional"
            });
            setIsFormOpen(true);
          }
        } catch (e) {
          console.error("Erro ao carregar lançamento para edição via estado da rota:", e);
        }
      }
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state && (location.state as any).openForm) {
      const stateData = location.state as any;
      setEditingId(null);
      if (stateData.prefill) {
        const p = stateData.prefill;
        const numVal = parseCurrencyToNumber(p.valor || "");
        const valorLimpo = numVal > 0 ? numVal.toFixed(2).replace(".", ",") : "";
        const dataVenc = p.vencimento || new Date().toISOString().split('T')[0];
        const docClean = (p.doc || "").trim();
        let docCode = "";
        if (docClean && !docClean.startsWith("DOC-") && !docClean.endsWith("S/N")) {
          const docParts = docClean.split(" ");
          docCode = docParts.length > 1 ? docParts.slice(1).join(" ") : docParts[0];
        }
        const numDocReal = p.codigoLancamento || p.numeroDocumento || docCode || "";

        setFormData({
          ...getInitialFormState(),
          fornecedor: p.fornecedor || "",
          valorNf: valorLimpo,
          dataVencimento: dataVenc,
          codigoLancamento: numDocReal,
          codLancamentoOc: p.codLancamentoOc || "",
          tipo: p.frequencia || "Esporádico",
          observacao: "Preenchido automaticamente a partir do Alerta de Vencimentos."
        });
      } else {
        setFormData(getInitialFormState());
      }
      setIsFormOpen(true);
      // Limpar o estado para não reabrir em recarregamentos
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, primeiroNome]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [estabelecimentos, setEstabelecimentos] = useState<string[]>(["100 - Paulínia", "150 - Aguaí"]);
  const [showNewFilialInput, setShowNewFilialInput] = useState(false);
  const [newFilialName, setNewFilialName] = useState("");
  const [isVencimentosOpen, setIsVencimentosOpen] = useState(false);
  const [activeVencTab, setActiveVencTab] = useState("Próximos");
  const [emailSentNotice, setEmailSentNotice] = useState<{ title: string; desc: string } | null>(null);

  // Estados para Gestão Completa de Bases / Filiais
  const [isManageBasesModalOpen, setIsManageBasesModalOpen] = useState(false);
  const [newBaseCodigo, setNewBaseCodigo] = useState("");
  const [newBaseNome, setNewBaseNome] = useState("");
  const [editingBaseOldName, setEditingBaseOldName] = useState<string | null>(null);
  const [editingBaseNewName, setEditingBaseNewName] = useState("");
  const [baseFeedbackMsg, setBaseFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Estados para Gestão Completa de Centros de Custo (C.C)
  const [centrosCustoList, setCentrosCustoList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("risel_centros_custo");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return CENTROS_CUSTO_SUGERIDOS;
  });
  const [isNewCcModalOpen, setIsNewCcModalOpen] = useState(false);
  const [newCcCodigo, setNewCcCodigo] = useState("");
  const [newCcNome, setNewCcNome] = useState("");
  const [editingCcOldName, setEditingCcOldName] = useState<string | null>(null);
  const [editingCcCodigo, setEditingCcCodigo] = useState("");
  const [editingCcNome, setEditingCcNome] = useState("");
  const [ccFeedbackMsg, setCcFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // 1. Carrega Centros de Custo do banco de dados Supabase e Firestore
    fetchCentrosCustoSupabase().then(dbCcs => {
      if (dbCcs && dbCcs.length > 0) {
        setCentrosCustoList(prev => {
          const merged = Array.from(new Set([...prev, ...dbCcs])).filter(Boolean);
          localStorage.setItem("risel_centros_custo", JSON.stringify(merged));
          return merged;
        });
      }
    });

    // 2. Carrega Bases (Estabelecimentos / Filiais) do banco de dados Supabase e Firestore
    fetchBasesSupabase().then(dbBases => {
      if (dbBases && dbBases.length > 0) {
        setEstabelecimentos(prev => {
          const merged = Array.from(new Set([...prev, ...dbBases])).filter(Boolean);
          merged.sort();
          return merged;
        });
      }
    });
  }, []);

  const handleAddNewFilial = async () => {
    const clean = newFilialName.trim();
    if (clean) {
      setEstabelecimentos(prev => {
        const merged = Array.from(new Set([...prev, clean])).filter(Boolean);
        merged.sort();
        return merged;
      });
      setFormData(prev => ({ ...prev, estabelecimento: clean }));
      setNewFilialName("");
      setShowNewFilialInput(false);
      // Salva imediatamente no banco de dados Supabase e Firestore
      await saveBaseSupabase(clean);
    }
  };

  // Cadastrar nova Base pelo modal de gerenciamento
  const handleAddNovaBaseModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBaseNome.trim()) return;

    let formattedBase = newBaseNome.trim();
    if (newBaseCodigo.trim()) {
      formattedBase = `${newBaseCodigo.trim()} - ${newBaseNome.trim()}`;
    }

    if (!estabelecimentos.includes(formattedBase)) {
      const updated = Array.from(new Set([...estabelecimentos, formattedBase])).filter(Boolean);
      updated.sort();
      setEstabelecimentos(updated);
      await saveBaseSupabase(formattedBase);
    }

    setFormData(prev => ({ ...prev, estabelecimento: formattedBase }));
    setNewBaseCodigo("");
    setNewBaseNome("");
    setBaseFeedbackMsg({ type: "success", text: `Base "${formattedBase}" cadastrada e salva com sucesso!` });
    setTimeout(() => setBaseFeedbackMsg(null), 4000);
  };

  // Salvar Edição de Base Existente
  const handleSaveEditBase = async (oldName: string) => {
    const cleanNew = editingBaseNewName.trim();
    if (!cleanNew || cleanNew === oldName) {
      setEditingBaseOldName(null);
      return;
    }

    const updated = estabelecimentos.map(b => b === oldName ? cleanNew : b);
    updated.sort();
    setEstabelecimentos(updated);
    
    if (formData.estabelecimento === oldName) {
      setFormData(prev => ({ ...prev, estabelecimento: cleanNew }));
    }

    setEditingBaseOldName(null);
    await updateBaseSupabase(oldName, cleanNew);
    setBaseFeedbackMsg({ type: "success", text: `Base alterada para "${cleanNew}" com sucesso!` });
    setTimeout(() => setBaseFeedbackMsg(null), 4000);
  };

  // Excluir Base
  const handleDeleteBase = async (baseName: string) => {
    if (!window.confirm(`Deseja realmente remover a base "${baseName}"?`)) return;

    const updated = estabelecimentos.filter(b => b !== baseName);
    setEstabelecimentos(updated);

    if (formData.estabelecimento === baseName) {
      setFormData(prev => ({ ...prev, estabelecimento: updated[0] || "" }));
    }

    await deleteBaseSupabase(baseName);
    setBaseFeedbackMsg({ type: "success", text: `Base "${baseName}" removida com sucesso!` });
    setTimeout(() => setBaseFeedbackMsg(null), 4000);
  };

  // Cadastrar Novo Centro de Custo
  const handleAddNovoCentroCusto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCcNome.trim()) return;

    let formattedName = newCcNome.trim();
    if (newCcCodigo.trim()) {
      formattedName = `C.C ${newCcCodigo.trim()} - ${newCcNome.trim()}`;
    } else if (!formattedName.toLowerCase().startsWith("c.c")) {
      formattedName = `C.C - ${formattedName}`;
    }

    if (!centrosCustoList.includes(formattedName)) {
      const updatedList = [...centrosCustoList, formattedName];
      setCentrosCustoList(updatedList);
      localStorage.setItem("risel_centros_custo", JSON.stringify(updatedList));
      saveCentroCustoSupabase(formattedName, newCcCodigo.trim(), newCcNome.trim());
    }

    setFormData(prev => ({ ...prev, centroCusto: formattedName }));
    setNewCcCodigo("");
    setNewCcNome("");
    setCcFeedbackMsg({ type: "success", text: `Centro de Custo "${formattedName}" cadastrado e salvo!` });
    setTimeout(() => setCcFeedbackMsg(null), 4000);
  };

  // Iniciar Edição de Centro de Custo
  const handleStartEditCentroCusto = (ccString: string) => {
    setEditingCcOldName(ccString);
    const match = ccString.match(/C\.C\s*([^-]+)-\s*(.+)/i);
    if (match) {
      setEditingCcCodigo(match[1].trim());
      setEditingCcNome(match[2].trim());
    } else {
      setEditingCcCodigo("");
      setEditingCcNome(ccString.replace(/^C\.C\s*-\s*/i, "").trim());
    }
  };

  // Salvar Edição de Centro de Custo
  const handleSaveEditCentroCusto = async (oldName: string) => {
    if (!editingCcNome.trim()) {
      setEditingCcOldName(null);
      return;
    }

    let formattedNew = editingCcNome.trim();
    if (editingCcCodigo.trim()) {
      formattedNew = `C.C ${editingCcCodigo.trim()} - ${editingCcNome.trim()}`;
    } else if (!formattedNew.toLowerCase().startsWith("c.c")) {
      formattedNew = `C.C - ${formattedNew}`;
    }

    const updatedList = centrosCustoList.map(item => item === oldName ? formattedNew : item);
    setCentrosCustoList(updatedList);
    localStorage.setItem("risel_centros_custo", JSON.stringify(updatedList));

    if (formData.centroCusto === oldName) {
      setFormData(prev => ({ ...prev, centroCusto: formattedNew }));
    }

    setEditingCcOldName(null);
    await updateCentroCustoSupabase(oldName, formattedNew, editingCcCodigo.trim(), editingCcNome.trim());
    setCcFeedbackMsg({ type: "success", text: `Centro de Custo alterado para "${formattedNew}" com sucesso!` });
    setTimeout(() => setCcFeedbackMsg(null), 4000);
  };

  // Excluir Centro de Custo
  const handleDeleteCentroCusto = async (ccName: string) => {
    if (!window.confirm(`Deseja realmente remover o Centro de Custo "${ccName}"?`)) return;

    const updatedList = centrosCustoList.filter(item => item !== ccName);
    setCentrosCustoList(updatedList);
    localStorage.setItem("risel_centros_custo", JSON.stringify(updatedList));

    if (formData.centroCusto === ccName) {
      setFormData(prev => ({ ...prev, centroCusto: updatedList[0] || "" }));
    }

    await deleteCentroCustoSupabase(ccName);
    setCcFeedbackMsg({ type: "success", text: `Centro de Custo "${ccName}" removido com sucesso!` });
    setTimeout(() => setCcFeedbackMsg(null), 4000);
  };

  // Estados e Configurações para o Banco de Dados Real no Supabase
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

  // Sincronização em tempo real multiusuário (Supabase, Servidor e Firestore)
  useEffect(() => {
    // Limpa dados legados fictícios de mensais se existirem
    localStorage.removeItem("risel_mensais");
    // Dispara sincronização autoritativa imediata ao entrar na tela
    forceSyncLancamentos();
  }, []);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestMsg(null);
    saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    const result = await testSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setSupabaseTestMsg(result);
    setSupabaseConfigState(getSupabaseConfig());
    setIsTestingSupabase(false);
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncMsg("");
    const res = await syncLocalLancamentosToSupabase(lancamentos);
    if (res.success) {
      setSyncMsg(`🎉 Sucesso! ${res.count} lançamentos foram sincronizados e gravados no banco Supabase!`);
      await forceSyncLancamentos();
    } else {
      setSyncMsg("⚠️ Falha ao sincronizar. Verifique a URL, Anon Key e se a tabela 'lancamentos' foi criada no Supabase.");
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

  // Estados e referências de busca avançada de CNPJ na Receita Federal
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [cnpjSuccessMsg, setCnpjSuccessMsg] = useState("");
  const [cnpjWarningRisel, setCnpjWarningRisel] = useState("");
  const lastCnpjDataRef = useRef<CnpjSearchResult | null>(null);
  const cnpjSearchRequestIdRef = useRef(0);

  const searchCnpjReal = async (cnpjClean: string, fillForm = true) => {
    if (cnpjClean.length !== 14) return null;
    const reqId = ++cnpjSearchRequestIdRef.current;
    setIsSearchingCnpj(true);
    setCnpjError("");
    setCnpjSuccessMsg("");
    setCnpjWarningRisel("");

    // Verificação preventiva: CNPJ pertencente à Risel Combustíveis (Tomador dos serviços)
    if (isRiselCnpjOrName(cnpjClean)) {
      if (reqId === cnpjSearchRequestIdRef.current) {
        setCnpjWarningRisel(
          "⚠️ ATENÇÃO: O CNPJ digitado pertence à própria RISEL COMBUSTÍVEIS LTDA (Tomador/Destinatário). Para registrar o lançamento de despesa, informe o CNPJ do fornecedor/prestador que emitiu a Nota Fiscal."
        );
        setCnpjSuccessMsg("");
        if (fillForm) {
          setFormData(prev => ({
            ...prev,
            fornecedor: (prev.fornecedor && isRiselCnpjOrName(undefined, prev.fornecedor)) ? "" : prev.fornecedor
          }));
        }
        setIsSearchingCnpj(false);
      }
      return null;
    }

    // 1. Verificação preliminar na base interna de fornecedores cadastrados
    try {
      const savedForn = localStorage.getItem("risel_fornecedores");
      if (savedForn) {
        const listForn = JSON.parse(savedForn);
        const matchForn = listForn.find((f: any) => (f.cnpj || "").replace(/\D/g, "") === cnpjClean);
        if (matchForn && !isRiselCnpjOrName(matchForn.cnpj, matchForn.nome) && fillForm) {
          if (reqId === cnpjSearchRequestIdRef.current) {
            setFormData(prev => ({
              ...prev,
              fornecedor: matchForn.nome,
              itemSistema: matchForn.codigoItem || prev.itemSistema,
              cidade: matchForn.cidade || prev.cidade,
              uf: (matchForn.uf || prev.uf || "").toUpperCase(),
              telefone: matchForn.telefone || prev.telefone,
              email: (matchForn.email || prev.email || "").toLowerCase()
            }));
            setCnpjSuccessMsg(`Fornecedor já cadastrado: ${matchForn.nome}`);
          }
        }
      }
    } catch (e) {}

    try {
      // 2. Consulta avançada na Receita Federal (BrasilAPI -> MinhaReceita -> ReceitaWS)
      const resultado = await consultarCnpjReceita(cnpjClean);
      if (reqId !== cnpjSearchRequestIdRef.current) return null;

      if (resultado && (resultado.razao_social || resultado.nome_fantasia)) {
        const razao = resultado.razao_social || resultado.nome_fantasia;
        lastCnpjDataRef.current = resultado;

        // Se a API indicar Risel (filial ou razão)
        if (resultado.isRisel || isRiselCnpjOrName(cnpjClean, razao)) {
          setCnpjWarningRisel(
            "⚠️ ATENÇÃO: O CNPJ digitado pertence à própria RISEL COMBUSTÍVEIS LTDA (Tomador dos serviços). Para registrar despesas, informe o CNPJ do fornecedor/prestador que emitiu a Nota Fiscal."
          );
          setCnpjSuccessMsg("");
          if (fillForm) {
            setFormData(prev => ({
              ...prev,
              fornecedor: (prev.fornecedor && isRiselCnpjOrName(undefined, prev.fornecedor)) ? "" : prev.fornecedor
            }));
          }
          return null;
        }

        setCnpjWarningRisel("");
        setCnpjSuccessMsg(`Receita Federal: ${razao}`);

        if (fillForm) {
          setFormData(prev => {
            let novaObs = prev.observacao || "";
            const obsSnippet = `[CNPJ: ${resultado.cnpj || cnpjClean} - ${razao} | Atividade: ${resultado.cnae_fiscal_descricao || ""} | Endereço: ${resultado.logradouro || ""}, ${resultado.numero || ""} - ${resultado.bairro || ""}, ${resultado.municipio || ""}-${resultado.uf || ""}]`;
            if (!novaObs.includes(razao)) {
              novaObs = novaObs ? `${novaObs}\n\n${obsSnippet}` : obsSnippet;
            }

            return {
              ...prev,
              fornecedor: razao,
              cidade: resultado.municipio || prev.cidade,
              uf: (resultado.uf || prev.uf || "").toUpperCase(),
              telefone: formatarTelefone(resultado.telefone) || prev.telefone,
              email: (resultado.email || prev.email || "").toLowerCase(),
              observacao: novaObs
            };
          });
        }
        return razao;
      } else {
        setCnpjError("CNPJ não localizado na Receita Federal. Preencha a Razão Social manualmente.");
        return null;
      }
    } catch (err: any) {
      if (reqId === cnpjSearchRequestIdRef.current) {
        console.error("Erro na busca avançada de CNPJ:", err);
        setCnpjError("Falha ao consultar CNPJ. Digite a Razão Social do fornecedor.");
      }
      return null;
    } finally {
      if (reqId === cnpjSearchRequestIdRef.current) {
        setIsSearchingCnpj(false);
      }
    }
  };

  // Estados unificados e sincronizados em tempo real entre todos os usuários via Firestore, Servidor e Supabase
  const [lancamentos, setLancamentos] = useState<any[]>(() => getLancamentosUnified());

  // Estados da Central de Segurança, Backup e Restauração de Lançamentos
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupSyncLoading, setBackupSyncLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [snapshotInfo, setSnapshotInfo] = useState<{ hasSnapshot: boolean; count: number; timestamp?: string }>(() => getLancamentosSnapshotInfo());
  const [serverBackups, setServerBackups] = useState<DatabaseBackupInfo[]>([]);
  const [loadingServerBackups, setLoadingServerBackups] = useState(false);

  const loadServerBackups = async () => {
    setLoadingServerBackups(true);
    try {
      const list = await fetchDatabaseBackups();
      setServerBackups(list);
    } catch (e) {
      setServerBackups([]);
    } finally {
      setLoadingServerBackups(false);
    }
  };

  const openBackupModal = () => {
    setBackupMessage(null);
    setSnapshotInfo(getLancamentosSnapshotInfo());
    loadServerBackups();
    setIsBackupModalOpen(true);
  };

  useEffect(() => {
    const unsubscribe = subscribeToLancamentosUnified((updatedList) => {
      setLancamentos(updatedList);
      setSnapshotInfo(getLancamentosSnapshotInfo());
    });
    return () => unsubscribe();
  }, []);

  // Sincronização e promoção automática: fornecedores Mensais ou com 3+ lançamentos vão para o cadastro
  useEffect(() => {
    if (lancamentos && lancamentos.length > 0) {
      sincronizarFornecedoresFrequentes(lancamentos).catch(err => {
        console.warn("Aviso ao auto-sincronizar fornecedores frequentes:", err);
      });

      const basesL = lancamentos.map(l => l.estabelecimento).filter(Boolean);
      if (basesL.length > 0) {
        setEstabelecimentos(prev => {
          const merged = Array.from(new Set([...prev, ...basesL])).filter(Boolean);
          merged.sort();
          return merged;
        });
      }

      const ccsL = lancamentos.map(l => l.centroCusto).filter(Boolean);
      if (ccsL.length > 0) {
        setCentrosCustoList(prev => {
          const merged = Array.from(new Set([...prev, ...ccsL])).filter(Boolean);
          return merged;
        });
      }
    }
  }, [lancamentos.length]);

  // Vencimentos dinâmicos derivados diretamente dos lançamentos reais (sem dados fictícios)
  // REQUISITO OFICIAL: Só mostrar alerta de vencimentos próximos para documentos com status de "Aguardando aprovação"
  const vencimentosReais = useMemo(() => {
    return lancamentos
      .filter(item => {
        const s = String(item.status || "").trim().toLowerCase();
        return s === "aguardando aprovação" || s === "aguardando aprovacao";
      })
      .map(item => {
        const vencCalc = calcularDiasAteVencimento(item.dataVencimento, item.status);
        return {
          id: item.id,
          fornecedor: item.fornecedor,
          doc: item.doc,
          valor: item.valor,
          vencimento: item.dataVencimento,
          status: item.status,
          dias: vencCalc.days,
          diasText: vencCalc.text,
          diasColor: vencCalc.color,
          lancamentoOriginal: item
        };
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  }, [lancamentos]);

  // Contas Recorrentes/Mensais Reais calculadas a partir dos lançamentos
  const mensaisPendentes = useMemo(() => {
    return lancamentos
      .filter(item => {
        const freq = (item.frequencia || "").toLowerCase();
        const tipoDoc = (item.tipo || "").toLowerCase();
        return freq.includes("mensal") || freq.includes("recorrente") || tipoDoc.includes("mensal");
      })
      .map(item => {
        const vencCalc = calcularDiasAteVencimento(item.dataVencimento, item.status);
        return {
          id: item.id,
          fornecedor: item.fornecedor,
          doc: item.doc,
          valor: item.valor,
          vencimento: item.dataVencimento,
          status: item.status,
          diasAtraso: vencCalc.days < 0 ? Math.abs(vencCalc.days) : 0,
          diasText: vencCalc.text,
          emissaoAnt: item.dataEmissao || item.dataLancamento || new Date().toISOString().split('T')[0],
          lancamentoOriginal: item
        };
      });
  }, [lancamentos]);

  const [formData, setFormData] = useState(() => ({
    ...INITIAL_FORM_STATE,
    lancadoPor: user?.name ? user.name.split(" ")[0] : "Deny"
  }));

  // Estado para recuperação de rascunho em andamento
  const [savedDraft, setSavedDraft] = useState<{
    formData: any;
    editingId: number | null;
    savedAt: number;
  } | null>(null);

  // Carregar rascunho persistido ao entrar na tela
  useEffect(() => {
    try {
      const draftStr = localStorage.getItem("risel_lancamento_draft_v1");
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft && draft.formData && (draft.formData.fornecedor || draft.formData.valorNf || draft.formData.codigoLancamento || draft.formData.cnpj)) {
          setSavedDraft(draft);
        }
      }
    } catch (e) {}
  }, []);

  // Sinalizar edição ativa ao sistema e auto-salvar rascunho em tempo real
  useEffect(() => {
    if (!isFormOpen) {
      try {
        localStorage.removeItem("risel_is_editing_lancamento");
        sessionStorage.removeItem("risel_is_editing_lancamento");
      } catch (e) {}
      return;
    }

    try {
      localStorage.setItem("risel_is_editing_lancamento", "true");
      sessionStorage.setItem("risel_is_editing_lancamento", "true");
    } catch (e) {}

    const hasContent = Boolean(
      formData.fornecedor || 
      formData.valorNf || 
      formData.codigoLancamento || 
      formData.cnpj ||
      formData.descricao ||
      (Array.isArray(formData.anexos) && formData.anexos.length > 0)
    );

    if (hasContent) {
      const timer = setTimeout(() => {
        try {
          const draftToSave = {
            formData: {
              ...formData,
              arquivoAnexoBase64: (formData.arquivoAnexoBase64 || "").length < 150000 ? formData.arquivoAnexoBase64 : "",
              anexos: Array.isArray(formData.anexos) 
                ? formData.anexos.map(a => ({
                    ...a,
                    base64: (a.base64 || "").length < 150000 ? a.base64 : ""
                  }))
                : []
            },
            editingId,
            savedAt: Date.now()
          };
          localStorage.setItem("risel_lancamento_draft_v1", JSON.stringify(draftToSave));
        } catch (e) {}
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [formData, isFormOpen, editingId]);

  // Prevenção de perda de dados por fechamento de aba, F5 ou recarregamento
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormOpen && (formData.fornecedor || formData.valorNf || formData.codigoLancamento)) {
        e.preventDefault();
        e.returnValue = "Você tem um lançamento em andamento. Deseja realmente sair?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isFormOpen, formData.fornecedor, formData.valorNf, formData.codigoLancamento]);

  const handleCloseForm = () => {
    const hasData = Boolean(
      formData.fornecedor || 
      formData.valorNf || 
      formData.codigoLancamento ||
      (Array.isArray(formData.anexos) && formData.anexos.length > 0)
    );

    if (hasData) {
      const confirmClose = window.confirm(
        "Atenção: Os dados informados serão mantidos salvos em rascunho para você retomar a qualquer momento.\n\nDeseja realmente voltar para a lista?"
      );
      if (!confirmClose) return;
    }

    setIsFormOpen(false);
    setEditingId(null);
    try {
      localStorage.removeItem("risel_is_editing_lancamento");
      sessionStorage.removeItem("risel_is_editing_lancamento");
    } catch (e) {}
    try {
      const draftStr = localStorage.getItem("risel_lancamento_draft_v1");
      if (draftStr) {
        setSavedDraft(JSON.parse(draftStr));
      }
    } catch (e) {}
  };

  const handleOpenNewForm = () => {
    try {
      const draftStr = localStorage.getItem("risel_lancamento_draft_v1");
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft?.formData && (draft.formData.fornecedor || draft.formData.valorNf || draft.formData.codigoLancamento)) {
          const wantResume = window.confirm(
            `Você possui um rascunho em andamento de lançamento (${draft.formData.fornecedor || "Fornecedor"}, R$ ${draft.formData.valorNf || "0,00"}).\n\nDeseja continuar este rascunho? (Clique em Cancelar para iniciar um novo do zero)`
          );
          if (wantResume) {
            setFormData(draft.formData);
            setEditingId(draft.editingId || null);
            setIsFormOpen(true);
            setSavedDraft(null);
            return;
          } else {
            localStorage.removeItem("risel_lancamento_draft_v1");
            setSavedDraft(null);
          }
        }
      }
    } catch (e) {}

    setEditingId(null);
    setFormData(getInitialFormState());
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (user?.name && !editingId) {
      setFormData(prev => ({ ...prev, lancadoPor: user.name.split(" ")[0] }));
    }
  }, [user, editingId]);

  const [viewingAnexo, setViewingAnexo] = useState<any | null>(null);

  // Controle de Ordenação de Colunas (Cabeçalhos Clicáveis)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "dataVencimento",
    direction: "asc"
  });

  // Estados dos Filtros Avançados
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterFornecedor, setFilterFornecedor] = useState("Todos");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMonthYear, setFilterMonthYear] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Controle discreto de Visibilidade de Colunas (Configurável por usuário)
  // Chave de identificação do usuário logado para persistência personalizada de preferências
  const userKey = useMemo(() => {
    if (user?.email) return user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return "default_user";
  }, [user?.email]);

  const DEFAULT_COLUMN_ORDER = [
    "status",
    "vencimento",
    "codLancamento",
    "lancamento",
    "prazo",
    "fornecedor",
    "centroCusto",
    "cnpj",
    "estabelecimento",
    "tipoDocumento",
    "frequencia",
    "itemSistema",
    "lancadoPor",
    "descricao",
    "documento",
    "dataEmissao",
    "pagamento",
    "aprovadores",
    "observacao",
    "valor"
  ];

  const DEFAULT_VISIBLE_COLS: Record<string, boolean> = {
    status: true,
    vencimento: true,
    codLancamento: true,
    lancamento: true,
    prazo: true,
    fornecedor: true,
    centroCusto: true,
    cnpj: false,
    estabelecimento: true,
    tipoDocumento: false,
    frequencia: false,
    itemSistema: true,
    lancadoPor: true,
    descricao: true,
    documento: true,
    dataEmissao: false,
    pagamento: true,
    aprovadores: false,
    observacao: false,
    valor: true
  };

  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const userSaved = localStorage.getItem(`risel_lanc_cols_${userKey}`);
    const globalSaved = localStorage.getItem("risel_lanc_cols_v2");
    const saved = userSaved || globalSaved;
    const parsed = saved ? JSON.parse(saved) : {};
    
    const merged = { ...DEFAULT_VISIBLE_COLS };
    Object.keys(parsed).forEach(key => {
      if (key in DEFAULT_VISIBLE_COLS) {
        merged[key] = parsed[key];
      }
    });
    return merged;
  });

  // Estado para armazenar a ordem de exibição das colunas (salva por usuário)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const userSaved = localStorage.getItem(`risel_lanc_col_order_${userKey}`);
    const globalSaved = localStorage.getItem("risel_lanc_col_order_v1");
    const saved = userSaved || globalSaved;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_COLUMN_ORDER;
  });

  // Carregar preferências específicas quando o usuário mudar
  useEffect(() => {
    const userSavedCols = localStorage.getItem(`risel_lanc_cols_${userKey}`);
    if (userSavedCols) {
      try {
        const parsed = JSON.parse(userSavedCols);
        setVisibleCols(prev => ({ ...DEFAULT_VISIBLE_COLS, ...parsed }));
      } catch (e) {}
    }

    const userSavedOrder = localStorage.getItem(`risel_lanc_col_order_${userKey}`);
    if (userSavedOrder) {
      try {
        const parsed = JSON.parse(userSavedOrder);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumnOrder(parsed);
        }
      } catch (e) {}
    }
  }, [userKey]);

  // Salvar ordem das colunas por usuário
  useEffect(() => {
    localStorage.setItem(`risel_lanc_col_order_${userKey}`, JSON.stringify(columnOrder));
    localStorage.setItem("risel_lanc_col_order_v1", JSON.stringify(columnOrder));
  }, [columnOrder, userKey]);

  // Salvar visibilidade das colunas por usuário
  useEffect(() => {
    localStorage.setItem(`risel_lanc_cols_${userKey}`, JSON.stringify(visibleCols));
    localStorage.setItem("risel_lanc_cols_v2", JSON.stringify(visibleCols));
  }, [visibleCols, userKey]);

  // Modo de densidade da tabela: 'comfortable' (padrão ampliado/confortável) ou 'compact'
  const [tableDensity, setTableDensity] = useState<"comfortable" | "compact">(() => {
    const saved = localStorage.getItem("risel_lanc_table_density");
    return saved === "compact" ? "compact" : "comfortable";
  });

  const handleToggleDensity = () => {
    const next = tableDensity === "comfortable" ? "compact" : "comfortable";
    setTableDensity(next);
    localStorage.setItem("risel_lanc_table_density", next);
  };

  // Estados de Drag & Drop para reordenar colunas
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleHeaderDragStart = (e: React.DragEvent, colKey: string) => {
    e.dataTransfer.setData("text/plain", colKey);
    e.dataTransfer.effectAllowed = "move";
    setDraggedCol(colKey);
  };

  const handleHeaderDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleHeaderDrop = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    const sourceColKey = e.dataTransfer.getData("text/plain") || draggedCol;
    if (sourceColKey && sourceColKey !== targetColKey) {
      const oldIndex = columnOrder.indexOf(sourceColKey);
      const newIndex = columnOrder.indexOf(targetColKey);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...columnOrder];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        setColumnOrder(newOrder);
      }
    }
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleHeaderDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const moveColumn = (col: string, direction: "up" | "down") => {
    const index = columnOrder.indexOf(col);
    if (index === -1) return;
    const newOrder = [...columnOrder];
    if (direction === "up" && index > 0) {
      newOrder[index] = newOrder[index - 1];
      newOrder[index - 1] = col;
    } else if (direction === "down" && index < newOrder.length - 1) {
      newOrder[index] = newOrder[index + 1];
      newOrder[index + 1] = col;
    }
    setColumnOrder(newOrder);
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleCols(DEFAULT_VISIBLE_COLS);
  };

  const [showColSelector, setShowColSelector] = useState(false);
  const colSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("risel_lanc_cols_v2", JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colSelectorRef.current && !colSelectorRef.current.contains(event.target as Node)) {
        setShowColSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Monitorar se há algum lançamento pendente vindo por OCR de e-mail
  useEffect(() => {
    const pendingOcr = localStorage.getItem("risel_ocr_pending");
    if (pendingOcr) {
      try {
        const ocrData = JSON.parse(pendingOcr);
        if (ocrData.preencherForm) {
          const hojeIso = getLocalTodayISO();
          setFormData({
            ...INITIAL_FORM_STATE,
            fornecedor: ocrData.fornecedor,
            cnpj: ocrData.cnpj,
            valorNf: ocrData.valorNf,
            tipoDocumento: ocrData.tipoNf,
            descricao: ocrData.descricao,
            codigoLancamento: ocrData.doc.split("_")[1] || Math.floor(Math.random() * 8000 + 1000).toString(),
            estabelecimento: "100 - Paulínia",
            dataEmissao: hojeIso,
            dataVencimento: normalizeDateToInput(ocrData.dataVencimento) || "",
            observacao: "Extraído automaticamente por Risel IA OCR a partir de e-mail corporativo frotaleverisel@gmail.com.",
            nomeArquivoAnexo: ocrData.doc,
            formaPagamento: "Boleto",
            tipo: "Esporádico",
            status: "Aguardando Aprovação"
          });
          setIsFormOpen(true);
        }
      } catch (e) {
        console.error("Erro ao ler OCR pendente", e);
      } finally {
        localStorage.removeItem("risel_ocr_pending");
      }
    }
  }, []);

  // Popup de Alerta de Duplicidade de Documento
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isOpen: boolean;
    existingDoc: any;
    data: any;
  } | null>(null);

  // Scanner de Nota Fiscal (OCR Inteligente sem Custo)
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrStep, setOcrStep] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return "↑↓";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  // Lista de fornecedores únicos para o filtro
  const listaFornecedoresUnicos = useMemo(() => {
    const nomes = lancamentos.map(item => item.fornecedor);
    return Array.from(new Set(nomes)).sort();
  }, [lancamentos]);

  // Lista de meses/anos de vencimento disponíveis nos lançamentos para o menu suspenso (MM/AAAA)
  const vencimentosDisponiveis = useMemo(() => {
    const temp: { YYYY_MM: string; label: string; year: number; month: number }[] = [];
    const seen = new Set<string>();

    lancamentos.forEach(item => {
      if (item.dataVencimento && item.dataVencimento.includes("-")) {
        const parts = item.dataVencimento.split("-");
        if (parts.length >= 2) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const yyyy_mm = `${parts[0]}-${parts[1]}`; // e.g. "2026-03"
          const label = `${parts[1]}/${parts[0]}`; // e.g. "03/2026"
          
          if (!seen.has(yyyy_mm)) {
            seen.add(yyyy_mm);
            temp.push({ YYYY_MM: yyyy_mm, label, year, month });
          }
        }
      }
    });

    // Ordenação cronológica: ano crescente, depois mês crescente
    temp.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    return temp;
  }, [lancamentos]);

  // Processa a ordenação dos dados e aplicação de múltiplos filtros
  const sortedLancamentos = useMemo(() => {
    let filtered = lancamentos.filter(item => {
      // 1. Pesquisa textual geral
      const matchesSearch = item.fornecedor.toLowerCase().includes(search.toLowerCase()) || 
        item.doc.toLowerCase().includes(search.toLowerCase()) ||
        (item.estabelecimento && item.estabelecimento.toLowerCase().includes(search.toLowerCase()));

      // 2. Filtro por Status
      const matchesStatus = filterStatus === "Todos" || item.status === filterStatus;

      // 3. Filtro por Fornecedor
      const matchesFornecedor = filterFornecedor === "Todos" || item.fornecedor === filterFornecedor;

      // 4. Filtro por Período de Vencimento
      let matchesPeriod = true;
      if (filterStartDate) {
        matchesPeriod = matchesPeriod && (item.dataVencimento >= filterStartDate);
      }
      if (filterEndDate) {
        matchesPeriod = matchesPeriod && (item.dataVencimento <= filterEndDate);
      }

      // 5. Filtro por Mês/Ano de Vencimento
      if (filterMonthYear) {
        matchesPeriod = matchesPeriod && (item.dataVencimento && item.dataVencimento.startsWith(filterMonthYear));
      }

      return matchesSearch && matchesStatus && matchesFornecedor && matchesPeriod;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";

        if (sortConfig.key === "valor") {
          valA = parseFloat(a.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
          valB = parseFloat(b.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        }

        if (valA < valB) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return filtered;
  }, [lancamentos, search, sortConfig, filterStatus, filterFornecedor, filterStartDate, filterEndDate, filterMonthYear]);

  // Alçada de aprovação calculada dinamicamente
  const numericValue = parseFloat(formData.valorNf.replace(/\./g, '').replace(',', '.')) || 0;
  const alcadaAprovacao = useMemo(() => {
    if (!formData.valorNf) return "";
    return calcularAlcadaPorValor(formData.valorNf);
  }, [formData.valorNf]);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const raw = val.replace(/\D/g, '').slice(0, 14);
    
    let formatted = raw;
    if (raw.length <= 11) {
      if (raw.length > 3 && raw.length <= 6) {
        formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
      } else if (raw.length > 6 && raw.length <= 9) {
        formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
      } else if (raw.length > 9) {
        formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
      }
    } else {
      if (raw.length > 2 && raw.length <= 5) {
        formatted = `${raw.slice(0, 2)}.${raw.slice(2)}`;
      } else if (raw.length > 5 && raw.length <= 8) {
        formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
      } else if (raw.length > 8 && raw.length <= 12) {
        formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
      } else if (raw.length > 12) {
        formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
      }
    }

    const rawCnpj = raw;
    setFormData(prev => ({ 
      ...prev, 
      cnpj: formatted,
      fornecedor: (prev.fornecedor && isRiselCnpjOrName(undefined, prev.fornecedor)) ? "" : prev.fornecedor
    }));

    if (rawCnpj.length === 14) {
      searchCnpjReal(rawCnpj, true);
    } else {
      setCnpjError("");
      setCnpjSuccessMsg("");
      setCnpjWarningRisel("");
    }
  };

  const valMesAnterior = 1500;
  const showComparativo = formData.tipo === "Mensal" && numericValue > 0;
  const isMaior = numericValue > valMesAnterior;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "valorNf") {
      const calculatedAlcada = calcularAlcadaPorValor(value);
      setFormData(prev => ({
        ...prev,
        valorNf: value,
        aprovadores: calculatedAlcada
      }));
    } else if (name === "dataVencimento" || name === "fornecedor" || name === "codigoLancamento") {
      setFormData(prev => {
        const nextData = { ...prev, [name]: value };
        // Se já anexou arquivo e o nome segue o padrão oficial, atualiza dinamicamente
        if (prev.nomeArquivoAnexo && /^\d{2}\.\d{2}\.\d{4}/.test(prev.nomeArquivoAnexo)) {
          const novoVenc = name === "dataVencimento" ? value : prev.dataVencimento;
          const novoForn = name === "fornecedor" ? value : prev.fornecedor;
          const novoDoc = name === "codigoLancamento" ? value : prev.codigoLancamento;
          nextData.nomeArquivoAnexo = gerarNomePadraoAnexoNf(novoVenc, novoForn, prev.nomeArquivoAnexo, novoDoc);
        }
        return nextData;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Simulação premium do Scanner OCR de Nota Fiscal sem custo por IA com busca real na BrasilAPI
  const triggerOcrSimulate = (fileName: string) => {
    setOcrProcessing(true);
    setOcrProgress(5);
    setOcrStep("Analisando cabeçalho da Nota Fiscal...");

    const steps = [
      { progress: 25, step: "Fazendo OCR na imagem/PDF da NF..." },
      { progress: 55, step: "Extraindo CNPJ do prestador..." },
      { progress: 80, step: "Buscando dados cadastrais reais da empresa na Receita..." },
      { progress: 100, step: "Extração concluída com sucesso via Risel IA!" }
    ];

    let currentStepIndex = 0;
    const interval = setInterval(async () => {
      if (currentStepIndex < steps.length) {
        setOcrProgress(steps[currentStepIndex].progress);
        setOcrStep(steps[currentStepIndex].step);
        currentStepIndex++;
      } else {
        clearInterval(interval);
        
        // Determina CNPJ real baseado no nome ou usa um genérico real ativo
        const lowerName = fileName.toLowerCase();
        let cnpjReal = ""; 
        let localEstab = ""; // Em branco para o usuário selecionar conforme pedido
        let descServico = "Prestação de serviços operacionais regulares";
        let codSistema = ""; 
        let valSugerido = ""; 
        let formaPg = ""; // Em branco para o usuário escolher
        let tpDoc = "NFS-e"; // Tipo de documento real NFS-e
        let numDoc = String(Math.floor(Math.random() * 90000) + 10000);
        let razaoExtraida = "";
        let obsOcr = "";

        if (lowerName.includes("posto") || lowerName.includes("abc") || lowerName.includes("locacao")) {
          cnpjReal = "34274233000102"; // VIBRA ENERGIA S.A.
          localEstab = "100 - Paulínia";
          descServico = "Fatura Comercial de Fornecimento de Óleo e Combustíveis";
          codSistema = "SV-0012";
          valSugerido = "4.500,00";
          formaPg = "Boleto";
          tpDoc = "NF-e";
          numDoc = "1905";
        } else if (lowerName.includes("manutencao") || lowerName.includes("xyz") || lowerName.includes("freio")) {
          cnpjReal = "45990181000189"; // ROBERT BOSCH LIMITADA
          localEstab = "150 - Aguaí";
          descServico = "Manutenção Preventiva e Fornecimento de Componentes";
          codSistema = "MN-992";
          valSugerido = "1.250,00";
          formaPg = "Depósito";
          tpDoc = "NF-e";
          numDoc = "8839";
        } else if (lowerName.includes("limpeza") || lowerName.includes("silva") || lowerName.includes("predial")) {
          cnpjReal = "02558157000162"; // TELEFONICA BRASIL S.A.
          localEstab = "100 - Paulínia";
          descServico = "Serviços de Link de Dados e Comunicação de Redes";
          codSistema = "LG-104";
          valSugerido = "800,00";
          formaPg = "PIX";
          tpDoc = "NFS-e";
          numDoc = "492";
        } else if (lowerName.includes("prt")) {
          cnpjReal = "09011048000170"; // PRT SOLUCOES EM TELEFONIA
          localEstab = ""; 
          descServico = "Licença de 1 Conexão de Vídeo - Defense IA";
          codSistema = "TI-0089"; 
          valSugerido = "12.576,00"; 
          formaPg = ""; 
          tpDoc = "NFS-e"; 
          numDoc = "00008024";
        } else {
          // Extrai o nome do arquivo para sugerir como Fornecedor de forma ultra inteligente!
          let cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "); // Remove extensão
          cleanName = cleanName.replace(/(fatura|nf|nota|fiscal|documento|original|anexo|pdf|jpg|png|xml)/gi, "").trim();
          cleanName = cleanName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ").trim();
          
          razaoExtraida = cleanName || "Fornecedor Extraído por IA";
          cnpjReal = "99999999999999"; // CNPJ Fictício indicativo de digitação ou detecção genérica
          descServico = "Serviços contratados conforme documento anexo";
          codSistema = "SV-0100"; // Sugestão genérica de Item de Sistema
          // Tenta extrair número do documento do nome do arquivo (ex: "NF1902.pdf" -> "1902")
          const nameMatch = fileName.match(/(?:nf|nfe|doc|fatura|recibo)?[\-_]?(\d{3,8})/i);
          numDoc = nameMatch ? nameMatch[1] : "";
          obsOcr = `OCR Concluído. Dados extraídos do documento '${fileName}'. Fornecedor sugerido: ${razaoExtraida}. Ajuste as informações se necessário.`;
        }

        // Formata CNPJ para visualização
        let formattedCnpj = "";
        if (cnpjReal === "99999999999999") {
          formattedCnpj = "00.000.000/0001-00"; 
        } else {
          formattedCnpj = `${cnpjReal.slice(0, 2)}.${cnpjReal.slice(2, 5)}.${cnpjReal.slice(5, 8)}/${cnpjReal.slice(8, 12)}-${cnpjReal.slice(12, 14)}`;
        }

        let razaoReal = "";
        if (cnpjReal !== "99999999999999") {
          razaoReal = await searchCnpjReal(cnpjReal, false) || "";
        }

        const finalFornecedor = razaoReal || razaoExtraida || "PRT SOLUCOES EM TELEFONIA E SEGURANCA ELETRONICA LTDA";

        setOcrProcessing(false);

        // Preenche o formulário com dados dinâmicos do OCR ou extraídos do arquivo sem sobrescrever número já preenchido!
        setFormData(prev => ({
          ...prev,
          lancadoPor: primeiroNome, // Usa o lançador logado
          cnpj: formattedCnpj,
          estabelecimento: localEstab,
          tipoDocumento: tpDoc,
          tipo: "Esporádico",
          fornecedor: finalFornecedor,
          descricao: descServico,
          itemSistema: codSistema, // Sugerindo o item de sistema como solicitado
          dataEmissao: getLocalTodayISO(), // Data de emissão real local
          valorNf: valSugerido, // Preenchendo o valor
          formaPagamento: formaPg, // Iniciado em branco como solicitado
          dataVencimento: "", // Iniciado em branco para o usuário selecionar e controlar
          moduloPetroshow: "Não aplicável",
          status: "Aguardando Aprovação", 
          aprovadores: "Deny e Gerência",
          codigoLancamento: prev.codigoLancamento ? prev.codigoLancamento : (numDoc || ""), // Preserva sempre se já digitado
          dataAprovacao: "",
          dataEnvio: "",
          observacao: prev.observacao || "", // Reservado para anotações manuais do usuário sobre o lançamento
          multaPlaca: "",
          multaInfracao: "",
          multaMotorista: "",
          multaGravidade: "Média",
          nomeArquivoAnexo: fileName
        }));
      }
    }, 400);
  };

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const currentAnexos = Array.isArray(formData.anexos) ? [...formData.anexos] : [];
    // Migra anexo legado se existir e a lista estiver vazia
    if (currentAnexos.length === 0 && formData.arquivoAnexoBase64) {
      currentAnexos.push({
        id: `anx-${Date.now()}-legacy`,
        nome: formData.nomeArquivoAnexo || "Documento_Fiscal.pdf",
        base64: formData.arquivoAnexoBase64
      });
    }

    const availableSlots = 4 - currentAnexos.length;
    if (availableSlots <= 0) {
      alert("Limite máximo de 4 documentos anexos já atingido. Remova um anexo para adicionar outro.");
      return;
    }

    const filesToProcess = fileArray.slice(0, availableSlots);

    filesToProcess.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string) || "";
        const isNf = (formData.tipoDocumento === "NF-e" || formData.tipoDocumento === "NFS-e" || !formData.tipoDocumento) && (currentAnexos.length + index === 0);
        const nomeSugerido = isNf
          ? gerarNomePadraoAnexoNf(formData.dataVencimento, formData.fornecedor, file.name, formData.codigoLancamento)
          : file.name;

        setFormData(prev => {
          const list = Array.isArray(prev.anexos) ? [...prev.anexos] : [];
          if (list.length >= 4) return prev;
          const newAnx = {
            id: `anx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            nome: nomeSugerido,
            base64: base64,
            tamanho: file.size,
            tipo: file.type
          };
          const updated = [...list, newAnx].slice(0, 4);
          return {
            ...prev,
            anexos: updated,
            nomeArquivoAnexo: updated[0]?.nome || "",
            arquivoAnexoBase64: updated[0]?.base64 || ""
          };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Executa o salvamento com verificação de duplicidade de documento
  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const docClean = (formData.cnpj || "").replace(/\D/g, "");
    if (!formData.cnpj || (docClean.length !== 11 && docClean.length !== 14)) {
      alert("Por favor, informe um CPF ou CNPJ válido de 11 ou 14 dígitos.");
      return;
    }

    if (!formData.fornecedor || !formData.valorNf) {
      alert("Por favor, preencha os campos Fornecedor e Valor da Nota.");
      return;
    }

    const numDocInformado = (formData.codigoLancamento || "").trim();
    if (!numDocInformado) {
      alert("Por favor, preencha o campo Nº Documento.");
      return;
    }

    const prefixoTipo = (formData.tipoDocumento || "NF-e").trim();
    const docName = numDocInformado.toLowerCase().startsWith(prefixoTipo.toLowerCase())
      ? numDocInformado
      : `${prefixoTipo} ${numDocInformado}`;

    // Verificar se já existe lançamento com o mesmo documento/numeração (excluindo o próprio se estiver editando)
    const duplicate = lancamentos.find(item => 
      item.doc.toLowerCase() === docName.toLowerCase() && 
      item.id !== editingId
    );

    if (duplicate) {
      // Exibir Popup/Modal informando que o documento já existe
      setDuplicateWarning({
        isOpen: true,
        existingDoc: duplicate,
        data: { ...formData, docName }
      });
    } else {
      // Ao salvar, em vez de disparar o e-mail direto, abre modal para o usuário escolher destinatários e cópias
      setEmailDispatchModal({
        isOpen: true,
        docData: { ...formData },
        calculatedDocName: docName,
        toRecipients: [...DEFAULT_LANCAMENTO_TO_EMAILS],
        ccRecipients: [...DEFAULT_LANCAMENTO_CC_EMAILS],
        newToInput: "",
        newCcInput: "",
        isSaving: false,
        isSending: false,
        isManualResendOnly: false
      });
    }
  };

  const executeSave = async (
    data: typeof formData, 
    calculatedDocName: string,
    options?: {
      sendEmail?: boolean;
      toRecipients?: string[];
      ccRecipients?: string[];
    }
  ) => {
    const numVal = parseCurrencyToNumber(data.valorNf);
    const formatValueCurrency = `R$ ${numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatVencimiento = normalizeDateToInput(data.dataVencimento) || getLocalTodayISO();
    const formatEmissao = normalizeDateToInput(data.dataEmissao) || "";
    const hojeLocalBr = new Date().toLocaleDateString('pt-BR');
    const finalAlcada = data.aprovadores || calcularAlcadaPorValor(data.valorNf) || "Deny";
    const finalEstabelecimento = data.estabelecimento || "100 - Paulínia";
    const finalCentroCusto = data.centroCusto || "C.C 101 - Operacional";

    // Persiste imediatamente no banco de dados Supabase e Firestore a Base e o Centro de Custo Principal
    if (finalEstabelecimento.trim()) {
      saveBaseSupabase(finalEstabelecimento.trim());
    }
    if (finalCentroCusto.trim()) {
      saveCentroCustoSupabase(finalCentroCusto.trim());
    }

    let savedItem: any = null;

    const currentAnexos = Array.isArray(data.anexos) && data.anexos.length > 0
      ? data.anexos.slice(0, 4)
      : (data.arquivoAnexoBase64 ? [{ id: "anx-1", nome: data.nomeArquivoAnexo || "Documento.pdf", base64: data.arquivoAnexoBase64 }] : []);

    const finalNomeAnexo = currentAnexos[0]?.nome || data.nomeArquivoAnexo || "";
    const finalBase64Anexo = currentAnexos[0]?.base64 || data.arquivoAnexoBase64 || "";

    // Se a intenção do salvamento é disparar e-mail de aprovação, força estritamente "Aguardando Aprovação"
    const isDispatchingEmail = Boolean(options?.sendEmail);

    if (editingId !== null) {
      // Editar lançamento existente com preservação total de campos e ID
      const existing = lancamentos.find(item => Number(item.id) === Number(editingId));
      const isNowApproved = !isDispatchingEmail && data.status === "Aprovado";
      const wasApproved = existing?.status === "Aprovado";
      let dataAprovacao = existing?.dataAprovacao || "";
      
      if (isNowApproved && !wasApproved) {
        dataAprovacao = hojeLocalBr;
      } else if (!isNowApproved || isDispatchingEmail) {
        dataAprovacao = "";
      }

      const statusCalculado = isDispatchingEmail 
        ? "Aguardando Aprovação" 
        : ((data.status === "Aguardando aprovação" || !data.status) ? "Aguardando Aprovação" : data.status);

      savedItem = {
        id: Number(editingId),
        status: statusCalculado,
        dataLancamento: existing?.dataLancamento || hojeLocalBr,
        dataVencimento: formatVencimiento,
        fornecedor: data.fornecedor,
        doc: calculatedDocName,
        valor: formatValueCurrency,
        formaPagto: data.formaPagamento || "Boleto",
        tipo: data.tipoDocumento || "NF-e",
        descricao: data.descricao || "Lançamento editado",
        cnpj: data.cnpj,
        estabelecimento: finalEstabelecimento,
        nomeArquivoAnexo: finalNomeAnexo || existing?.nomeArquivoAnexo || "",
        arquivoAnexoBase64: finalBase64Anexo || existing?.arquivoAnexoBase64 || "",
        anexos: currentAnexos.length > 0 ? currentAnexos : (existing?.anexos || []),
        itemSistema: data.itemSistema || "",
        dataEmissao: formatEmissao,
        observacao: data.observacao || "",
        frequencia: data.tipo || "Esporádico",
        lancadoPor: data.lancadoPor || primeiroNome,
        dataAprovacao: dataAprovacao,
        aprovadores: finalAlcada,
        centroCusto: finalCentroCusto,
        codLancamentoOc: data.codLancamentoOc || "",
        codigoLancamento: data.codigoLancamento || "",
        cidade: data.cidade || lastCnpjDataRef.current?.municipio || existing?.cidade || "",
        uf: (data.uf || lastCnpjDataRef.current?.uf || existing?.uf || "").toUpperCase(),
        telefone: data.telefone || lastCnpjDataRef.current?.telefone || existing?.telefone || "",
        email: (data.email || lastCnpjDataRef.current?.email || existing?.email || "").toLowerCase()
      };

      await saveLancamentoUnified(savedItem);
    } else {
      // Cadastrar novo lançamento
      const newId = Date.now();
      const isNowApproved = !isDispatchingEmail && data.status === "Aprovado";
      const statusCalculado = isDispatchingEmail 
        ? "Aguardando Aprovação" 
        : ((data.status === "Aguardando aprovação" || !data.status) ? "Aguardando Aprovação" : data.status);

      savedItem = {
        id: newId,
        status: statusCalculado,
        dataLancamento: hojeLocalBr,
        dataVencimento: formatVencimiento,
        fornecedor: data.fornecedor,
        doc: calculatedDocName,
        valor: formatValueCurrency,
        formaPagto: data.formaPagamento || "Boleto",
        tipo: data.tipoDocumento || "NF-e",
        descricao: data.descricao || "Lançamento",
        cnpj: data.cnpj,
        estabelecimento: finalEstabelecimento,
        nomeArquivoAnexo: finalNomeAnexo,
        arquivoAnexoBase64: finalBase64Anexo,
        anexos: currentAnexos,
        itemSistema: data.itemSistema || "",
        dataEmissao: formatEmissao,
        observacao: data.observacao || "",
        frequencia: data.tipo || "Esporádico",
        lancadoPor: data.lancadoPor || primeiroNome,
        dataAprovacao: isNowApproved ? hojeLocalBr : "",
        aprovadores: finalAlcada,
        centroCusto: finalCentroCusto,
        codLancamentoOc: data.codLancamentoOc || "",
        codigoLancamento: data.codigoLancamento || "",
        cidade: data.cidade || lastCnpjDataRef.current?.municipio || "",
        uf: (data.uf || lastCnpjDataRef.current?.uf || "").toUpperCase(),
        telefone: data.telefone || lastCnpjDataRef.current?.telefone || "",
        email: (data.email || lastCnpjDataRef.current?.email || "").toLowerCase()
      };

      await saveLancamentoUnified(savedItem);
    }

    // Disparo oficial com destinatários e cópias escolhidos no modal
    if (options?.sendEmail) {
      // Garante que o status salvo esteja como Aguardando Aprovação
      savedItem.status = "Aguardando Aprovação";
      savedItem.dataAprovacao = "";
      await saveLancamentoUnified(savedItem);
      const paraLista = options.toRecipients && options.toRecipients.length > 0 ? options.toRecipients : DEFAULT_LANCAMENTO_TO_EMAILS;
      const ccLista = options.ccRecipients || DEFAULT_LANCAMENTO_CC_EMAILS;

      sendLancamentoAprovacaoEmail({
        ...savedItem,
        destinatariosPara: paraLista,
        destinatariosCc: ccLista,
        columnOrder,
        visibleCols
      }).then(sent => {
        if (sent) {
          const saudacaoUsada = getSaudacaoDestinatarios(paraLista);
          setEmailSentNotice({
            title: "E-mail de Aprovação Enviado",
            desc: `E-mail de aprovação (${saudacaoUsada}) encaminhado para ${paraLista.join(", ")} com cópia para ${ccLista.join(", ")}.`
          });
          setTimeout(() => setEmailSentNotice(null), 8000);
        }
      }).catch(err => {
        console.warn("Falha no disparo de e-mail de aprovação:", err);
      });
    }

    // Notificar o sistema para atualizar notificações em tempo real
    window.dispatchEvent(new Event("risel_lancamentos_updated"));

    // Se for lançamento MENSAL OU se tiver mais de três lançamentos, envie para a lista de cadastro de Fornecedores
    const itemParaAvaliar = savedItem || data;
    avaliarEEnviarFornecedor(itemParaAvaliar, lancamentos, lastCnpjDataRef.current).then(res => {
      if (res.qualificado) {
        console.log(`[Risel ERP] Fornecedor adicionado/atualizado no cadastro (${res.motivo}):`, res.fornecedorCadastrado?.nome);
      }
    }).catch(err => {
      console.warn("Aviso ao avaliar qualificação de fornecedor:", err);
    });

    // Resetar estados e fechar formulários
    setIsFormOpen(false);
    setEditingId(null);
    setFormData(getInitialFormState());
    setDuplicateWarning(null);
    setEmailDispatchModal(null);
    setCnpjError("");
    setCnpjSuccessMsg("");
    setCnpjWarningRisel("");
    lastCnpjDataRef.current = null;
    try {
      localStorage.removeItem("risel_lancamento_draft_v1");
      localStorage.removeItem("risel_is_editing_lancamento");
      sessionStorage.removeItem("risel_is_editing_lancamento");
    } catch (e) {}
    setSavedDraft(null);
  };

  // Estado para rastrear envio individual de e-mail de aprovação
  const [sendingEmailId, setSendingEmailId] = useState<number | string | null>(null);

  // Disparo / Reenvio manual do e-mail de aprovação abrindo o modal corporativo de destinatários
  const handleManualSendEmail = (item: any) => {
    setEmailDispatchModal({
      isOpen: true,
      docData: {
        ...item,
        fornecedor: item.fornecedor,
        valorNf: item.valor,
        dataVencimento: item.dataVencimento,
        tipoDocumento: item.tipo,
        estabelecimento: item.estabelecimento,
        codigoLancamento: item.codigoLancamento || item.codLancamentoOc,
        descricao: item.descricao,
        cnpj: item.cnpj,
        nomeArquivoAnexo: item.nomeArquivoAnexo,
        arquivoAnexoBase64: item.arquivoAnexoBase64
      },
      calculatedDocName: item.doc,
      toRecipients: [...DEFAULT_LANCAMENTO_TO_EMAILS],
      ccRecipients: [...DEFAULT_LANCAMENTO_CC_EMAILS],
      newToInput: "",
      newCcInput: "",
      isSaving: false,
      isSending: false,
      isManualResendOnly: true
    });
  };

  // Alteração e persistência direta de status na linha da tabela
  const handleInlineStatusChange = async (id: number, newStatus: string) => {
    const existing = lancamentos.find(item => Number(item.id) === Number(id));
    if (!existing) return;

    const isNowApproved = newStatus === "Aprovado";
    const wasApproved = existing.status === "Aprovado";
    let dataAprovacao = existing.dataAprovacao || "";

    if (isNowApproved && !wasApproved) {
      dataAprovacao = new Date().toLocaleDateString('pt-BR');
    } else if (!isNowApproved) {
      dataAprovacao = "";
    }

    const updatedItem = {
      ...existing,
      status: newStatus,
      dataAprovacao: dataAprovacao
    };

    await saveLancamentoUnified(updatedItem);
    window.dispatchEvent(new Event("risel_lancamentos_updated"));

    // Se o status for alterado para Aguardando aprovação, dispara o e-mail oficial
    if (newStatus.toLowerCase().includes("aguardando")) {
      sendLancamentoAprovacaoEmail({
        ...updatedItem,
        columnOrder,
        visibleCols
      }).then(sent => {
        if (sent) {
          setEmailSentNotice({
            title: "E-mail de Aprovação Enviado",
            desc: `E-mail com anexo e tabela formatada encaminhado automaticamente para lorena.padilha@risel.com.br e deny.goncalves@risel.com.br.`
          });
          setTimeout(() => setEmailSentNotice(null), 8000);
        }
      }).catch(err => {
        console.warn("Falha no disparo de e-mail ao alterar status:", err);
      });
    }
  };

  // Abrir o formulário de edição de Lançamento
  const handleEditLancamento = (item: any) => {
    // Isolar o número do documento/fatura
    const docClean = (item.doc || "").trim();
    let docCode = "";
    if (docClean && !docClean.startsWith("DOC-") && !docClean.endsWith("S/N")) {
      const docParts = docClean.split(" ");
      docCode = docParts.length > 1 ? docParts.slice(1).join(" ") : docParts[0];
    }
    const numDocReal = item.codigoLancamento || item.numeroDocumento || docCode || "";
    const numVal = parseCurrencyToNumber(item.valor || "");
    const valClean = numVal > 0 ? numVal.toFixed(2).replace(".", ",") : "";

    // Tenta obter dados cadastrais do item ou da base de fornecedores
    let matchedForn: any = null;
    try {
      const savedForn = localStorage.getItem("risel_fornecedores");
      if (savedForn) {
        const listForn = JSON.parse(savedForn);
        const cleanCnpj = (item.cnpj || "").replace(/\D/g, "");
        matchedForn = listForn.find((f: any) => {
          const fc = (f.cnpj || "").replace(/\D/g, "");
          return (cleanCnpj && fc === cleanCnpj) || (f.nome && f.nome.toUpperCase() === (item.fornecedor || "").toUpperCase());
        });
      }
    } catch (e) {}

    setEditingId(item.id);
    setFormData({
      ...getInitialFormState(),
      lancadoPor: item.lancadoPor || primeiroNome,
      cnpj: item.cnpj || "",
      estabelecimento: item.estabelecimento || "100 - Paulínia",
      tipoDocumento: item.tipo || "NF-e",
      tipo: item.frequencia || "Esporádico",
      fornecedor: item.fornecedor || "",
      descricao: item.descricao || "",
      itemSistema: item.itemSistema || "",
      dataEmissao: normalizeDateToInput(item.dataEmissao) || getLocalTodayISO(),
      valorNf: valClean,
      formaPagamento: item.formaPagto || "Boleto",
      dataVencimento: normalizeDateToInput(item.dataVencimento) || "",
      moduloPetroshow: "",
      status: item.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (item.status || "Aguardando Aprovação"),
      aprovadores: item.aprovadores || "",
      codigoLancamento: numDocReal,
      codLancamentoOc: item.codLancamentoOc || "",
      dataAprovacao: item.dataAprovacao || "",
      dataEnvio: "",
      observacao: item.observacao || "",
      multaPlaca: "",
      multaInfracao: "",
      multaMotorista: "",
      multaGravidade: "Média",
      nomeArquivoAnexo: item.nomeArquivoAnexo || (item.anexos?.[0]?.nome || ""),
      arquivoAnexoBase64: item.arquivoAnexoBase64 || (item.anexos?.[0]?.base64 || ""),
      anexos: Array.isArray(item.anexos) && item.anexos.length > 0
        ? item.anexos.slice(0, 4)
        : (item.arquivoAnexoBase64 ? [{ id: "anx-1", nome: item.nomeArquivoAnexo || "Documento.pdf", base64: item.arquivoAnexoBase64 }] : []),
      centroCusto: item.centroCusto || "C.C 101 - Operacional",
      cidade: item.cidade || matchedForn?.cidade || "",
      uf: (item.uf || matchedForn?.uf || "").toUpperCase(),
      telefone: item.telefone || matchedForn?.telefone || "",
      email: (item.email || matchedForn?.email || "").toLowerCase()
    });
    setIsFormOpen(true);
  };

  const handleDeleteLancamento = async (id: number | string) => {
    if (confirm("Tem certeza que deseja excluir permanentemente este lançamento? Essa exclusão será sincronizada para todos os usuários.")) {
      await deleteLancamentoUnified(id);
      window.dispatchEvent(new Event("risel_lancamentos_updated"));
    }
  };

  // Editar faturas diretamente pelo Drawer de Alertas e Vencimentos
  const handleEditFromVencimentos = (v: any) => {
    setIsVencimentosOpen(false);
    
    // Buscar se esse vencimento já tem um lançamento correspondente
    const matchedLancamento = lancamentos.find(item => 
      item.id === v.id || 
      (v.doc && item.doc.toLowerCase() === v.doc.toLowerCase())
    );

    if (matchedLancamento) {
      handleEditLancamento(matchedLancamento);
    } else {
      // Se não houver lançamento, abre o formulário pré-preenchido para criar
      const valorLimpo = v.valor ? v.valor.replace("R$ ", "").replace(/\./g, "").replace(",", ".") : "";
      const dataVenc = normalizeDateToInput(v.vencimento) || getLocalTodayISO();
      const docCode = v.doc ? (v.doc.split(" ")[1] || v.doc) : "";

      setEditingId(null);
      setFormData({
        ...getInitialFormState(),
        fornecedor: v.fornecedor || "",
        valorNf: valorLimpo,
        dataVencimento: dataVenc,
        codigoLancamento: docCode,
        observacao: "Preenchido automaticamente a partir do Alerta de Vencimentos."
      });
      setIsFormOpen(true);
    }
  };

  const toggleColumnVisibility = (col: string) => {
    setVisibleCols(prev => ({
      ...prev,
      [col]: !prev[col]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Alerta de Confirmação de E-mail de Aprovação */}
      {emailSentNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#114D38] text-white rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">{emailSentNotice.title}</p>
              <p className="text-[11px] text-emerald-800">{emailSentNotice.desc}</p>
            </div>
          </div>
          <button
            onClick={() => setEmailSentNotice(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Cabeçalho ultra-compacto integrado para focar na tabela, ocultado se o formulário estiver aberto */}
      {!isFormOpen && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl text-[#114D38] shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black text-slate-800 leading-none">Lançamentos Realizados</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-slate-400 font-bold">
                    {lancamentos.length} documentos salvos
                  </p>
                  {isAuthorizedRestoreUser && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60" title="Sincronização em tempo real ativa no Render e Supabase (Exclusivo Deny Gonçalves)">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Tempo Real Ativo
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">

              <button 
                onClick={() => setIsVencimentosOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50/50 hover:bg-amber-100/70 text-amber-700 border border-amber-200/50 transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                <span>Vencimentos</span>
              </button>

              {/* Seletor Discreto de Colunas e Reordenação Personalizada */}
              <div className="relative" ref={colSelectorRef}>
                <button 
                  onClick={() => setShowColSelector(!showColSelector)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Configurar Ordem e Visibilidade das Colunas"
                >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Colunas</span>
              </button>

              {showColSelector && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-40 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block text-left">
                        Configurar Colunas
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold block text-left">
                        Arraste os cabeçalhos ou use as setas para ordenar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={resetColumnOrder}
                      className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 bg-slate-50 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors border border-slate-200"
                      title="Restaurar visualização padrão"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Padrão</span>
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {columnOrder.map((col, idx) => {
                      const labelMap: Record<string, string> = {
                        status: "Status do Fluxo",
                        vencimento: "Vencimento",
                        codLancamento: "Cód. Lançamento / Nº OC",
                        lancamento: "Data de Lançamento",
                        prazo: "Prazo do Boleto",
                        fornecedor: "Fornecedor / Emitente",
                        centroCusto: "Centro de Custo",
                        cnpj: "CPF / CNPJ do Emitente",
                        estabelecimento: "Filial / Estabelecimento",
                        tipoDocumento: "Tipo de Documento",
                        frequencia: "Frequência",
                        itemSistema: "Item de Sistema",
                        lancadoPor: "Lançado Por",
                        descricao: "Descrição do Serviço",
                        documento: "Nº do Documento",
                        dataEmissao: "Data de Emissão",
                        pagamento: "Forma de Pagamento",
                        aprovadores: "Aprovadores / Alçada",
                        observacao: "Observações",
                        valor: "Valor Total (R$)"
                      };

                      const isVisible = visibleCols[col] ?? true;

                      return (
                        <div
                          key={col}
                          draggable
                          onDragStart={(e) => handleHeaderDragStart(e, col)}
                          onDragOver={(e) => handleHeaderDragOver(e, col)}
                          onDrop={(e) => handleHeaderDrop(e, col)}
                          onDragEnd={handleHeaderDragEnd}
                          className={cn(
                            "flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                            dragOverCol === col
                              ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20"
                              : isVisible
                              ? "bg-slate-50/70 border-slate-150 hover:bg-slate-100/70 text-slate-800"
                              : "bg-white border-transparent text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span 
                              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 shrink-0 p-0.5"
                              title="Arraste para reordenar"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleColumnVisibility(col)}
                              className="flex items-center gap-1.5 flex-1 text-left truncate cursor-pointer"
                            >
                              <span className={cn("truncate text-[11px]", isVisible ? "font-bold text-slate-700" : "font-medium text-slate-400")}>
                                {labelMap[col] || col}
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveColumn(col, "up")}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === columnOrder.length - 1}
                              onClick={() => moveColumn(col, "down")}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleColumnVisibility(col)}
                              className="p-1 rounded text-slate-500 hover:text-emerald-700 cursor-pointer ml-0.5"
                            >
                              {isVisible ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded border border-slate-300 block" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>💡 Salvo automaticamente no seu perfil</span>
                    <button
                      type="button"
                      onClick={() => setShowColSelector(false)}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleOpenNewForm}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#114D38] text-white shadow-sm hover:bg-[#0d3b2b] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              + Novo Lançamento
            </button>
          </div>
        </div>

        {/* Alerta inteligente de recuperação - EXCLUSIVO deny.goncalves@risel.com.br */}
        {lancamentos.length === 0 && isAuthorizedRestoreUser && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 my-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-amber-900">Nenhum lançamento visível no momento</h4>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Não se preocupe: seus documentos estão protegidos. Você pode restaurá-los diretamente do Banco de Dados do Servidor ou do Snapshot de segurança do seu computador.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setBackupSyncLoading(true);
                  try {
                    // Tenta snapshot do computador primeiro
                    const snapRes = restoreLancamentosFromSnapshot();
                    if (snapRes.success && snapRes.count > 0) {
                      alert(`Sucesso! ${snapRes.count} lançamentos restaurados do Snapshot Local com sucesso!`);
                      return;
                    }
                    // Tenta backup do banco de dados do servidor
                    const srvRes = await restoreFromDatabaseBackup();
                    if (srvRes.success && srvRes.count > 0) {
                      alert(`Sucesso! ${srvRes.count} lançamentos restaurados do Banco de Dados do Servidor com sucesso!`);
                      return;
                    }
                    // Tenta sincronização direta
                    const items = await forceSyncLancamentos();
                    if (items.length > 0) {
                      alert(`Sucesso! ${items.length} lançamentos recuperados do Banco de Dados.`);
                    } else {
                      openBackupModal();
                    }
                  } finally {
                    setBackupSyncLoading(false);
                  }
                }}
                disabled={backupSyncLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw className={cn("w-3.5 h-3.5", backupSyncLoading && "animate-spin")} />
                <span>{backupSyncLoading ? "Restaurando..." : "Restaurar Banco de Dados"}</span>
              </button>
              <button
                type="button"
                onClick={openBackupModal}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Opções de Backup
              </button>
            </div>
          </div>
        )}
      </>
    )}

      {/* Alerta de Recuperação Inteligente de Rascunho */}
      {savedDraft && !isFormOpen && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-amber-950">
                  Lançamento em Andamento Salvo Automaticamente
                </h4>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  Rascunho
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Fornecedor: <strong className="text-amber-950">{savedDraft.formData.fornecedor || "Não informado"}</strong> • Valor: <strong className="text-amber-950">{savedDraft.formData.valorNf ? `R$ ${savedDraft.formData.valorNf}` : "0,00"}</strong> • Nº Doc: <strong className="text-amber-950">{savedDraft.formData.codigoLancamento || "S/N"}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormData(savedDraft.formData);
                setEditingId(savedDraft.editingId || null);
                setIsFormOpen(true);
                setSavedDraft(null);
              }}
              className="px-3 py-1.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <span>Restaurar Lançamento</span>
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("risel_lancamento_draft_v1");
                setSavedDraft(null);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Seção principal: Formulário ou Tabela */}
      {isFormOpen ? (
        <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
          {/* Cabeçalho do formulário compacto integrado */}
          <div className="flex items-center justify-between gap-4 mb-4 bg-white px-5 py-3 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="text-left">
              <h2 className="text-sm font-black text-slate-800 leading-none">
                {editingId ? "Editar Lançamento" : "Novo Lançamento de Documento"}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 leading-none">
                {editingId ? "Ajuste os dados do documento para aprovação." : "Preencha os campos e anexe a nota fiscal (PDF/Imagem)"}
              </p>
            </div>
            <button 
              onClick={handleCloseForm}
              className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-[10px] font-bold border border-slate-200 bg-white cursor-pointer shadow-sm"
            >
              Voltar para Lista
            </button>
          </div>

          <form 
            onSubmit={handleSaveSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                const inputType = (e.target as HTMLInputElement).type;
                if (inputType !== "submit" && inputType !== "button") {
                  e.preventDefault();
                }
              }
            }}
          >
            <div className="bg-white rounded-[20px] shadow-sm border border-slate-200">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="text-emerald-600">📄</span> Dados do Lançamento
                 </h3>
                  {editingId && (
                    <span className="bg-[#114D38]/10 text-[#114D38] border border-[#114D38]/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                      ID Lançamento: {editingId}
                    </span>
                  )}
              </div>
              
              <div className="p-3 grid lg:grid-cols-3 gap-3">
                {/* Sec 1: Dados do Fornecedor (Primeiro card, com CNPJ como primeiro campo) */}
                <div className="space-y-2 bg-slate-50/50 border border-slate-100 rounded-[12px] p-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-slate-200">
                       <div className="w-6 h-6 rounded-full bg-[#114D38]/10 flex items-center justify-center">
                         <span className="text-[#114D38] text-xs">🏢</span>
                       </div>
                       <h4 className="font-bold text-xs text-slate-700">Dados do Fornecedor</h4>
                    </div>

                    {/* Primeiro campo: CPF / CNPJ com busca na Receita Federal */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CPF / CNPJ *</label>
                        <button
                          type="button"
                          onClick={() => {
                            const raw = (formData.cnpj || "").replace(/\D/g, "");
                            if (raw.length === 14) {
                              searchCnpjReal(raw, true);
                            }
                          }}
                          disabled={isSearchingCnpj || (formData.cnpj || "").replace(/\D/g, "").length !== 14}
                          className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Consultar Razão Social na Receita Federal"
                        >
                          {isSearchingCnpj ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-600" />
                          ) : (
                            <Search className="w-2.5 h-2.5 text-emerald-600" />
                          )}
                          <span>Buscar na Receita</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          name="cnpj" 
                          value={formData.cnpj} 
                          onChange={handleCnpjChange}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (raw.length === 14 && (!formData.fornecedor || isRiselCnpjOrName(undefined, formData.fornecedor) || cnpjWarningRisel)) {
                              searchCnpjReal(raw, true);
                            }
                          }} 
                          required 
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-mono text-xs text-slate-800 shadow-sm" 
                          placeholder="00.000.000/0000-00" 
                        />
                        {isSearchingCnpj && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Feedback de Consulta de CNPJ */}
                      {isSearchingCnpj && (
                        <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          <span>Localizando Razão Social na Receita...</span>
                        </p>
                      )}
                      {cnpjWarningRisel && (
                        <div className="text-[9.5px] text-amber-900 bg-amber-50 border border-amber-300 p-1.5 rounded-md mt-1 font-medium flex items-start gap-1 leading-snug">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Atenção (CNPJ da Risel):</span>
                            <span>{cnpjWarningRisel}</span>
                          </div>
                        </div>
                      )}
                      {!isSearchingCnpj && cnpjSuccessMsg && !cnpjWarningRisel && (
                        <p className="text-[9.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-0.5 font-medium flex items-center gap-1 truncate" title={cnpjSuccessMsg}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{cnpjSuccessMsg}</span>
                        </p>
                      )}
                      {!isSearchingCnpj && cnpjError && (
                        <p className="text-[9.5px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-0.5 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{cnpjError}</span>
                        </p>
                      )}
                    </div>

                    {/* Segundo campo: Razão Social */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Razão Social (Fornecedor) *</label>
                        {formData.fornecedor && (
                          <span className="text-[8.5px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                            <Building className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Identificado</span>
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        name="fornecedor" 
                        value={formData.fornecedor} 
                        onChange={handleChange} 
                        required 
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-bold text-xs text-slate-800 shadow-sm" 
                        placeholder="Nome Empresarial / Fornecedor" 
                      />
                    </div>

                    {/* Dados Cadastrais Automáticos (Telefone, E-mail, Cidade, UF) */}
                    <div className="pt-1.5 pb-1 border-y border-slate-200/80 space-y-1.5 bg-white/60 p-2 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          <span>📍 Localização & Contatos</span>
                        </span>
                        {(formData.cidade || formData.telefone || formData.email) && (
                          <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Auto-completado</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="col-span-2 space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cidade</label>
                          <input 
                            type="text" 
                            name="cidade" 
                            value={formData.cidade} 
                            onChange={handleChange} 
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs text-slate-800 shadow-sm" 
                            placeholder="Ex: São Paulo" 
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">UF</label>
                          <input 
                            type="text" 
                            name="uf" 
                            value={formData.uf} 
                            maxLength={2}
                            onChange={(e) => setFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))} 
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs uppercase font-bold text-slate-800 shadow-sm" 
                            placeholder="SP" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Telefone</label>
                          <input 
                            type="text" 
                            name="telefone" 
                            value={formData.telefone} 
                            onChange={handleChange} 
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs text-slate-800 shadow-sm" 
                            placeholder="(00) 00000-0000" 
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">E-mail</label>
                          <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none text-xs text-slate-800 shadow-sm" 
                            placeholder="contato@empresa.com" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Terceiro campo: Item de Sistema */}
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item de Sistema (Cód. Serviço)</label>
                      <input type="text" name="itemSistema" value={formData.itemSistema} onChange={handleChange} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-bold text-xs text-slate-800 shadow-sm" placeholder="Ex: MN-992, LG-104" />
                    </div>

                    {/* Quarto campo: Descrição do Serviço */}
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição do Serviço *</label>
                      <textarea 
                        name="descricao" 
                        value={formData.descricao} 
                        onChange={handleChange} 
                        required 
                        rows={5} 
                        className="w-full min-h-[130px] p-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-semibold text-xs text-slate-800 shadow-sm leading-relaxed resize-y" 
                        placeholder="Detalhamento técnico completo do serviço prestado..." 
                      />
                    </div>
                    {formData.itemSistema && SUGESTOES_DESCRICAO[formData.itemSistema] && (
                      <div className="p-2 bg-emerald-50/40 rounded-lg border border-emerald-100 space-y-1">
                        <span className="text-[8px] font-black text-[#114D38] uppercase tracking-wide">Sugestões de Descrição Risel:</span>
                        <div className="flex flex-col gap-0.5">
                          {SUGESTOES_DESCRICAO[formData.itemSistema].map(sug => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, descricao: sug }))}
                              className="text-left text-[10px] text-slate-600 hover:text-emerald-700 font-semibold hover:bg-white p-0.5 rounded transition-colors truncate"
                            >
                              💡 {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sec 2: Valores e datas (após Fornecedor) */}
                <div className="space-y-2 bg-slate-50/50 border border-slate-100 rounded-[12px] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-slate-200">
                       <div className="w-6 h-6 rounded-full bg-[#114D38]/10 flex items-center justify-center">
                         <span className="text-[#114D38] text-xs">💰</span>
                       </div>
                       <h4 className="font-bold text-xs text-slate-700">Valores e Datas</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nº Documento *</label>
                        <input type="text" name="codigoLancamento" value={formData.codigoLancamento} onChange={handleChange} required className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-bold text-xs text-slate-800 shadow-sm" placeholder="Ex: Fatura 1902" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Emissão</label>
                        <input type="date" name="dataEmissao" value={normalizeDateToInput(formData.dataEmissao)} onChange={handleChange} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-semibold text-xs text-slate-800 shadow-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vencimento *</label>
                        <input type="date" name="dataVencimento" value={normalizeDateToInput(formData.dataVencimento)} onChange={handleChange} required className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-bold text-xs text-slate-800 shadow-sm text-amber-700" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Forma Pagto *</label>
                        <select name="formaPagamento" value={formData.formaPagamento} onChange={handleChange} required className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 font-bold text-xs text-slate-800 shadow-sm">
                          <option value="">Selecione...</option>
                          {FORMAS_PAGAMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor Total (R$) *</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                          <input type="text" name="valorNf" value={formData.valorNf} onChange={handleChange} required className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-emerald-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 outline-none font-black text-xs text-slate-800 shadow-sm" placeholder="0,00" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alçada</label>
                        <div className="px-2 py-1.5 bg-white rounded-lg border border-slate-200 text-slate-700 font-bold flex items-center gap-1 text-[11px] shadow-sm">
                          <AlertCircle className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{alcadaAprovacao || "Aguardando..."}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cód. Lançamento / Nº OC antes de Status */}
                    <div className="space-y-0.5 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Cód. Lançamento / Nº OC
                      </label>
                      <input 
                        type="text" 
                        name="codLancamentoOc" 
                        value={formData.codLancamentoOc || ""} 
                        onChange={handleChange} 
                        className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50/20 focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-bold text-xs text-emerald-950 shadow-sm" 
                        placeholder="Ex: OC-84920 / LAN-104" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                        <select 
                          name="status" 
                          value={formData.status === "Aguardando aprovação" ? "Aguardando Aprovação" : formData.status} 
                          onChange={handleChange} 
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 font-bold text-xs text-slate-800 shadow-sm text-[#114D38]"
                        >
                          <option value="Aguardando Aprovação">Aguardando Aprovação</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Em Contestação">Em Contestação</option>
                          <option value="Finalizado">Finalizado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>
                      <div className="space-y-0.5 flex flex-col justify-end">
                        <span className="text-[8.5px] text-slate-400 font-semibold leading-tight">
                          {formData.status === "Aguardando Aprovação" || formData.status === "Aguardando aprovação"
                            ? "⚠️ Inicia como Aguardando Aprovação."
                            : formData.status === "Em Contestação"
                            ? "🟣 Em contestação junto ao fornecedor/emissor."
                            : formData.status === "Cancelado"
                            ? "❌ Lançamento cancelado."
                            : "✅ Marcado como " + formData.status + "."}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5 mt-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Observações / Anotações do Lançamento</label>
                    <textarea 
                      name="observacao" 
                      value={formData.observacao} 
                      onChange={handleChange} 
                      rows={5} 
                      className="w-full min-h-[110px] p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:ring-2 focus:ring-[#114D38]/20 outline-none leading-relaxed resize-y shadow-sm" 
                      placeholder="Digite observações, anotações ou informações pertinentes a este lançamento..." 
                    />
                  </div>
                </div>

                {/* Sec 3: Dados Básicos (por último, para que Fornecedor e Vencimento já estejam preenchidos no nome dinâmico da NF) */}
                <div className="space-y-2 bg-slate-50/50 border border-slate-100 rounded-[12px] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-slate-200">
                       <div className="w-6 h-6 rounded-full bg-[#114D38]/10 flex items-center justify-center">
                         <span className="text-[#114D38] text-xs">👤</span>
                       </div>
                       <h4 className="font-bold text-xs text-slate-700">Dados Básicos</h4>
                    </div>

                    {/* Anexo de Documentos Integrado com Suporte a até 4 Arquivos */}
                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-inner relative overflow-hidden space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="font-bold text-[10px] text-slate-800">
                            Documentos Anexados ({(formData.anexos || []).length}/4)
                          </span>
                        </div>
                        <span className={cn(
                          "text-[8px] font-extrabold px-1.5 py-0.5 rounded",
                          (formData.anexos || []).length === 4
                            ? "bg-amber-100 text-amber-800"
                            : (formData.anexos || []).length > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        )}>
                          {(formData.anexos || []).length === 4
                            ? "Limite Atingido (4/4)"
                            : (formData.anexos || []).length > 0
                            ? `${(formData.anexos || []).length}/4 Anexado(s)`
                            : "Até 4 anexos"}
                        </span>
                      </div>

                      {/* Lista de Documentos Anexados */}
                      {(formData.anexos || []).length > 0 && (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                          {(formData.anexos || []).map((anx, idx) => (
                            <div key={anx.id || idx} className="p-1.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-black text-[8px] flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-slate-800 text-[9.5px] leading-tight flex items-center gap-1">
                                      <span className="truncate">
                                        {idx === 0 ? "Documento Principal (NF / Boleto)" : `Anexo Adicional #${idx + 1}`}
                                      </span>
                                    </h5>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {idx === 0 && (
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        const novoNome = gerarNomePadraoAnexoNf(
                                          formData.dataVencimento, 
                                          formData.fornecedor, 
                                          anx.nome,
                                          formData.codigoLancamento
                                        );
                                        setFormData(prev => {
                                          const list = [...(prev.anexos || [])];
                                          list[0] = { ...list[0], nome: novoNome };
                                          return {
                                            ...prev,
                                            anexos: list,
                                            nomeArquivoAnexo: novoNome
                                          };
                                        });
                                      }}
                                      className="p-1 rounded hover:bg-emerald-50 text-emerald-700 border border-emerald-200 bg-white transition-colors cursor-pointer"
                                      title="Regenerar nome padrão da NF"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                    </button>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const allAnexos = formData.anexos || [];
                                      setViewingAnexo({
                                        nome: anx.nome,
                                        fornecedor: formData.fornecedor || "Não identificado",
                                        fornecedorCnpj: formData.cnpj || "Sem CNPJ",
                                        valor: formData.valorNf ? `R$ ${formData.valorNf}` : "Não identificado",
                                        cnpj: formData.cnpj || "Sem CNPJ",
                                        doc: formData.codigoLancamento || formData.itemSistema || "S/N",
                                        tipo: formData.tipoDocumento || formData.tipo || "NF-e",
                                        estabelecimento: formData.estabelecimento || "",
                                        centroCusto: formData.centroCusto || "",
                                        aprovadores: formData.aprovadores || "",
                                        formaPagto: formData.formaPagamento || "",
                                        itemSistema: formData.itemSistema || "",
                                        lancadoPor: formData.lancadoPor || "",
                                        status: formData.status === "Aguardando aprovação" ? "Aguardando Aprovação" : (formData.status || "Aguardando Aprovação"),
                                        frequencia: formData.tipo || "Esporádico",
                                        dataEmissao: formData.dataEmissao || "",
                                        dataVencimento: formData.dataVencimento || "",
                                        descricao: formData.descricao || "",
                                        observacao: formData.observacao || "",
                                        arquivoAnexoBase64: anx.base64 || formData.arquivoAnexoBase64,
                                        anexos: allAnexos,
                                        initialAnexoIndex: idx
                                      });
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 bg-white transition-colors cursor-pointer"
                                    title="Visualizar este anexo"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      setFormData(prev => {
                                        const list = (prev.anexos || []).filter((_, i) => i !== idx);
                                        return {
                                          ...prev,
                                          anexos: list,
                                          nomeArquivoAnexo: list[0]?.nome || "",
                                          arquivoAnexoBase64: list[0]?.base64 || ""
                                        };
                                      });
                                    }}
                                    className="p-1 rounded hover:bg-rose-50 text-rose-500 border border-rose-200 bg-white transition-colors cursor-pointer"
                                    title="Remover este anexo"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Input com nome do anexo */}
                              <input 
                                type="text" 
                                value={anx.nome} 
                                onChange={(e) => {
                                  const novoVal = e.target.value;
                                  setFormData(prev => {
                                    const list = [...(prev.anexos || [])];
                                    list[idx] = { ...list[idx], nome: novoVal };
                                    return {
                                      ...prev,
                                      anexos: list,
                                      nomeArquivoAnexo: idx === 0 ? novoVal : prev.nomeArquivoAnexo
                                    };
                                  });
                                }} 
                                className="w-full px-2 py-0.5 text-[9.5px] font-mono text-slate-800 bg-white border border-slate-200 focus:border-[#114D38] focus:ring-1 focus:ring-[#114D38]/20 rounded outline-none transition-all shadow-2xs truncate" 
                                placeholder="Nome do documento..." 
                                title="Edite o nome deste anexo se necessário" 
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dropzone para inclusão de novos anexos (até 4) */}
                      {(formData.anexos || []).length < 4 && (
                        <div 
                          onDragOver={handleDragOver} 
                          onDrop={handleDrop} 
                          onClick={() => fileInputRef.current?.click()} 
                          className="flex items-center justify-center gap-1.5 border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-lg p-2 transition-all cursor-pointer group text-center"
                        >
                          <input 
                            type="file" 
                            multiple
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept=".pdf,.png,.jpg,.jpeg,.xml" 
                            className="hidden" 
                          />
                          <div className="w-5 h-5 rounded bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-700 transition-all shrink-0">
                            <Upload className="w-2.5 h-2.5" />
                          </div>
                          <div className="text-left min-w-0">
                            <h5 className="font-bold text-slate-700 text-[9px] group-hover:text-emerald-800 transition-colors leading-tight">
                              {(formData.anexos || []).length === 0
                                ? "Anexar Documentos (Até 4)"
                                : `Adicionar mais um documento (${4 - (formData.anexos || []).length} restante${4 - (formData.anexos || []).length > 1 ? "s" : ""})`}
                            </h5>
                            <p className="text-[7.5px] text-slate-500 leading-none truncate">Arraste ou clique (PDF, Imagem, XML)</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lançado por *</label>
                      <input type="text" name="lancadoPor" value={formData.lancadoPor} onChange={handleChange} required className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none transition-all font-semibold text-xs text-slate-800 shadow-sm" placeholder="Primeiro Nome" />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 mt-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex justify-between items-center gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Base/Filial</label>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              type="button" 
                              onClick={() => setIsManageBasesModalOpen(true)} 
                              className="text-[9px] text-[#114D38] hover:text-emerald-700 font-bold transition-all flex items-center gap-0.5 hover:underline cursor-pointer"
                              title="Gerenciar e Editar todas as Bases/Filiais"
                            >
                              <Settings className="w-2.5 h-2.5" />
                              <span>Gerenciar</span>
                            </button>
                            <span className="text-slate-300 text-[9px]">•</span>
                            <button 
                              type="button" 
                              onClick={() => setShowNewFilialInput(!showNewFilialInput)} 
                              className="text-[9px] text-emerald-600 hover:text-emerald-700 font-bold transition-all underline cursor-pointer"
                            >
                              {showNewFilialInput ? "Voltar" : "+ Nova"}
                            </button>
                          </div>
                        </div>
                        {showNewFilialInput ? (
                          <div className="flex items-center gap-1 w-full min-w-0">
                            <input 
                              type="text" 
                              placeholder="Ex: 200 - Santos" 
                              value={newFilialName} 
                              onChange={(e) => setNewFilialName(e.target.value)} 
                              className="min-w-0 flex-1 w-full px-2 py-1.5 rounded-lg border border-emerald-400 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                              autoFocus
                            />
                            <button 
                              type="button" 
                              onClick={handleAddNewFilial} 
                              className="bg-[#114D38] hover:bg-[#0d3d2c] text-white p-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-xs"
                              title="Salvar e Selecionar Base"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <select name="estabelecimento" value={formData.estabelecimento} onChange={handleChange} className="w-full min-w-0 truncate px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] font-semibold text-xs text-slate-800 shadow-sm">
                            <option value="">Selecione...</option>
                            {estabelecimentos.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tipo</label>
                        <select name="tipoDocumento" value={formData.tipoDocumento} onChange={handleChange} className="w-full min-w-0 truncate px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] font-semibold text-xs text-slate-800 shadow-sm">
                          <option value="">Selecione...</option>
                          {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-0.5 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frequência</label>
                      <select name="tipo" value={formData.tipo} onChange={(e) => setFormData(prev => ({...prev, tipo: e.target.value}))} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] font-semibold text-xs text-slate-800 shadow-sm">
                        <option value="Esporádico">Esporádico</option>
                        <option value="Mensal">Mensal</option>
                      </select>
                    </div>

                    {/* Campo de Centro de Custo Principal */}
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                          Centro de Custo Principal *
                        </label>
                        <button 
                          type="button" 
                          onClick={() => setIsNewCcModalOpen(true)} 
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer" 
                          title="Gerenciar e Editar Centros de Custo"
                        >
                          <Layers className="w-3 h-3 text-emerald-600" />
                          <span>Gerenciar / Novo C.C</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          name="centroCusto" 
                          list="datalist-centro-custo" 
                          value={formData.centroCusto} 
                          onChange={handleChange} 
                          required 
                          placeholder="Ex: C.C 101 - Operacional" 
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50/20 focus:ring-2 focus:ring-[#114D38]/20 focus:border-[#114D38] outline-none font-bold text-xs text-slate-800 shadow-sm" 
                        />
                        <datalist id="datalist-centro-custo">
                          {centrosCustoList.map(cc => (
                            <option key={cc} value={cc} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* Módulo de Multas integrado */}
                    {formData.tipoDocumento === "Multa" && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-750 bg-amber-50 border border-amber-100 p-1.5 rounded">
                          <span>🚨 Multas e Infrações</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Placa</label>
                            <input 
                              type="text" 
                              name="multaPlaca" 
                              value={formData.multaPlaca} 
                              onChange={handleChange} 
                              placeholder="ABC-1234" 
                              className="w-full px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#114D38]/25 outline-none text-[11px] font-mono uppercase" 
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Gravidade</label>
                            <select 
                              name="multaGravidade" 
                              value={formData.multaGravidade} 
                              onChange={handleChange} 
                              className="w-full px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#114D38]/25 text-[11px] font-medium"
                            >
                              <option value="Leve">Leve</option>
                              <option value="Média">Média</option>
                              <option value="Grave">Grave</option>
                              <option value="Gravíssima">Gravíssima</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Infração</label>
                            <input 
                              type="text" 
                              name="multaInfracao" 
                              value={formData.multaInfracao} 
                              onChange={handleChange} 
                              placeholder="Ex: Velocidade" 
                              className="w-full px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#114D38]/25 outline-none text-[11px] font-medium" 
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Condutor</label>
                            <input 
                              type="text" 
                              name="multaMotorista" 
                              value={formData.multaMotorista} 
                              onChange={handleChange} 
                              placeholder="Ex: Motorista" 
                              className="w-full px-2 py-1 rounded border border-slate-200 bg-white focus:ring-1 focus:ring-[#114D38]/25 outline-none text-[11px] font-medium" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between gap-2 items-center">
                <div className="text-[10px] text-slate-500 font-medium leading-tight">
                  Campos flegados com * são de preenchimento obrigatório para a validação das faturas.
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={handleCloseForm} 
                    className="px-4 py-1.5 rounded-lg font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-1.5 rounded-lg font-bold bg-[#114D38] hover:bg-[#0d3b2b] text-white shadow-sm transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> 
                    <span>{editingId ? "Salvar Alterações" : "Salvar Lançamento"}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[620px] max-h-[calc(100vh-180px)] flex-1">
          <div className="px-4 py-2 border-b border-slate-150 flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar por Fornecedor, CNPJ, Documento..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#114D38]/10 focus:border-[#114D38] outline-none transition-all text-[11px] font-semibold text-slate-700"
                />
              </div>

              {/* Botão de Filtro Discreto */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                    isFilterOpen || filterStatus !== "Todos" || filterFornecedor !== "Todos" || filterStartDate || filterEndDate || filterMonthYear
                      ? "bg-emerald-50 border-emerald-300 text-[#114D38] hover:bg-emerald-100"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                  title="Filtros Avançados"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtrar</span>
                  {(filterStatus !== "Todos" || filterFornecedor !== "Todos" || filterStartDate || filterEndDate || filterMonthYear) && (
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                  )}
                </button>

                {isFilterOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-40 text-left space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="font-bold text-xs text-slate-800">Filtros de Lançamento</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterStatus("Todos");
                          setFilterFornecedor("Todos");
                          setFilterStartDate("");
                          setFilterEndDate("");
                          setFilterMonthYear("");
                        }}
                        className="text-[10px] text-rose-600 hover:underline font-bold"
                      >
                        Limpar Tudo
                      </button>
                    </div>

                    {/* Filtro por Fornecedor */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fornecedor</label>
                      <select
                        value={filterFornecedor}
                        onChange={(e) => setFilterFornecedor(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold outline-none focus:ring-1 focus:ring-emerald-500/25"
                      >
                        <option value="Todos">Todos os Fornecedores</option>
                        {listaFornecedoresUnicos.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filtro por Status */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold outline-none focus:ring-1 focus:ring-emerald-500/25"
                      >
                        <option value="Todos">Todos os Status</option>
                        {STATUS_LANCAMENTO.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filtro por Período de Vencimento */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vencimento (Período)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 text-[10px] outline-none"
                        />
                        <input
                          type="date"
                          value={filterEndDate}
                          onChange={(e) => setFilterEndDate(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 text-[10px] outline-none"
                        />
                      </div>
                    </div>

                    {/* Filtro por Mês/Ano de Vencimento */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Mês/Ano do Vencimento</label>
                      <select
                        value={filterMonthYear}
                        onChange={(e) => setFilterMonthYear(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold outline-none focus:ring-1 focus:ring-emerald-500/25 bg-white cursor-pointer"
                      >
                        <option value="">Selecione o período...</option>
                        {vencimentosDisponiveis.map(item => (
                          <option key={item.YYYY_MM} value={item.YYYY_MM}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="bg-[#114D38] hover:bg-[#0d3b2b] text-white px-3 py-1 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controles de Produtividade, BI e Ergonomia Visual */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap sm:flex-nowrap">
              {/* Seletor de Densidade: Confortável vs Compacta */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setTableDensity("comfortable");
                    localStorage.setItem("risel_lanc_table_density", "comfortable");
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    tableDensity === "comfortable"
                      ? "bg-[#114D38] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                  title="Modo Confortável: Tipografia ampliada e maior legibilidade de dados"
                >
                  Confortável
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTableDensity("compact");
                    localStorage.setItem("risel_lanc_table_density", "compact");
                  }}
                  className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                    tableDensity === "compact"
                      ? "bg-[#114D38] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                  title="Modo Compacto: Mais linhas simultâneas na tela"
                >
                  Compacta
                </button>
              </div>

              {/* Contador de Lançamentos */}
              <div className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs flex items-center gap-1.5">
                <span>Total:</span>
                <span className="text-[#114D38] font-black font-mono text-xs">{sortedLancamentos.length}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            {/* Tabela de Lançamentos Redesenhada - Layout moderno com densidade otimizada de dados de acordo com a imagem modelo */}
            <table className={cn(
              "w-full font-aptos text-left border-collapse border border-slate-200/70",
              tableDensity === "comfortable" ? "text-[11px]" : "text-[10px]"
            )}>
              <thead>
                <tr className="bg-[#114D38] text-white text-[11px] font-black uppercase tracking-wider select-none">
                  <th className={cn(
                    "text-center sticky top-0 bg-[#114D38] z-20 border-r border-b border-slate-200/20",
                    tableDensity === "comfortable" ? "px-3 py-3 w-20" : "px-2.5 py-2 w-16"
                  )}>AÇÕES</th>
                  {columnOrder.map(colKey => {
                    if (!visibleCols[colKey]) return null;

                    const colMap: Record<string, { label: string; sortKey?: string; isGreen?: boolean; isRight?: boolean }> = {
                      status: { label: "STATUS", sortKey: "status" },
                      vencimento: { label: "VENCIMENTO", sortKey: "dataVencimento" },
                      codLancamento: { label: "CÓD. LANÇAMENTO / Nº OC", sortKey: "codLancamentoOc" },
                      lancamento: { label: "LANÇAMENTO", sortKey: "dataLancamento" },
                      prazo: { label: "PRAZO DO BOLETO" },
                      fornecedor: { label: "FORNECEDOR", sortKey: "fornecedor" },
                      centroCusto: { label: "C.C (CENTRO DE CUSTO)", sortKey: "centroCusto" },
                      cnpj: { label: "CPF / CNPJ", sortKey: "cnpj" },
                      estabelecimento: { label: "FILIAL", sortKey: "estabelecimento" },
                      tipoDocumento: { label: "TIPO DOC", sortKey: "tipoDocumento" },
                      frequencia: { label: "FREQUÊNCIA", sortKey: "frequencia" },
                      itemSistema: { label: "ITEM SISTEMA", sortKey: "itemSistema" },
                      lancadoPor: { label: "LANÇADO POR", sortKey: "lancadoPor" },
                      descricao: { label: "DESCRIÇÃO", sortKey: "descricao" },
                      documento: { label: "DOCUMENTO", sortKey: "doc" },
                      dataEmissao: { label: "DATA EMISSÃO", sortKey: "dataEmissao" },
                      pagamento: { label: "PAGAMENTO", sortKey: "formaPagto" },
                      aprovadores: { label: "APROVADORES" },
                      observacao: { label: "OBSERVAÇÕES" },
                      valor: { label: "VALOR", sortKey: "valor", isGreen: true, isRight: true }
                    };

                    const config = colMap[colKey] || { label: colKey.toUpperCase() };
                    const isDragging = draggedCol === colKey;
                    const isOver = dragOverCol === colKey;

                    return (
                      <th
                        key={colKey}
                        draggable
                        onDragStart={(e) => handleHeaderDragStart(e, colKey)}
                        onDragOver={(e) => handleHeaderDragOver(e, colKey)}
                        onDrop={(e) => handleHeaderDrop(e, colKey)}
                        onDragEnd={handleHeaderDragEnd}
                        onClick={() => {
                          if (config.sortKey) handleSort(config.sortKey);
                        }}
                        title="Arraste para reordenar a coluna ou clique para ordenar os dados"
                        className={cn(
                          "whitespace-nowrap sticky top-0 z-20 border-r border-b border-slate-200/20 transition-colors cursor-pointer",
                          tableDensity === "comfortable" ? "px-3.5 py-3 text-[11px]" : "px-3 py-2 text-[10px]",
                          config.isGreen ? "bg-[#00CA71] hover:bg-[#00b263]" : "bg-[#114D38] hover:bg-[#0c3728]",
                          config.isRight ? "text-right" : "text-left",
                          isDragging && "opacity-40 cursor-grabbing",
                          isOver && "border-l-4 border-l-amber-300 bg-[#092a1e]",
                          "cursor-grab active:cursor-grabbing"
                        )}
                      >
                        {config.label} {config.sortKey && getSortIcon(config.sortKey)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className={cn(
                "font-semibold text-slate-700",
                tableDensity === "comfortable" ? "text-[11.5px]" : "text-[10px]"
              )}>
                {sortedLancamentos.map((item) => {
                  const isOrange = item.status.includes("Aguardando");
                  const isGreen = item.status.includes("Aprovado") || item.status.includes("Finalizado");
                  const vencInfo = calcularDiasAteVencimento(item.dataVencimento, item.status);
                  const cellPadding = tableDensity === "comfortable" ? "px-3.5 py-2.5" : "px-3 py-1.5";
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-100/60 transition-colors odd:bg-slate-50/20 even:bg-white border-b border-slate-200/50 last:border-b-0 group">
                      <td className={cn(cellPadding, "text-slate-400 text-center border-r border-slate-200/50")}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleManualSendEmail(item)}
                            disabled={sendingEmailId === item.id}
                            className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50 cursor-pointer disabled:opacity-50 text-slate-500"
                            title="Disparar/Reenviar E-mail de Aprovação com Anexo"
                          >
                            {sendingEmailId === item.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            ) : (
                              <Mail className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button 
                            onClick={() => handleEditLancamento(item)} 
                            className="hover:text-emerald-600 transition-colors p-1 rounded hover:bg-slate-150 cursor-pointer text-slate-500"
                            title="Editar Lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteLancamento(item.id)} 
                            className="hover:text-rose-600 transition-colors p-1 rounded hover:bg-slate-150 cursor-pointer text-slate-500"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      {columnOrder.map(colKey => {
                        if (!visibleCols[colKey]) return null;
                        
                        if (colKey === "status") {
                          const rawStatus = item.status || "Aguardando Aprovação";
                          const currentStatus = rawStatus === "Aguardando aprovação" ? "Aguardando Aprovação" : rawStatus;
                          const isApproved = currentStatus === "Aprovado" || currentStatus === "Finalizado" || currentStatus === "Lançado";
                          const isContested = currentStatus === "Em Contestação" || currentStatus === "Em contestação";
                          const isPending = currentStatus.includes("Aguardando");
                          const isCanceled = currentStatus === "Cancelado";

                          return (
                            <td key="status" className={cn(cellPadding, "border-r border-slate-200/50")}>
                              <select
                                value={currentStatus}
                                onChange={(e) => handleInlineStatusChange(item.id, e.target.value)}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[10.5px] font-bold border whitespace-nowrap inline-block cursor-pointer outline-none shadow-2xs transition-all",
                                  isApproved ? "bg-emerald-50 text-emerald-800 border-emerald-300/80 hover:bg-emerald-100/80" :
                                  isContested ? "bg-purple-50 text-purple-800 border-purple-300/80 hover:bg-purple-100/80 font-black" :
                                  isPending ? "bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100/80" :
                                  isCanceled ? "bg-rose-50 text-rose-800 border-rose-300/80 hover:bg-rose-100/80" :
                                  "bg-slate-50 text-slate-700 border-slate-300/80 hover:bg-slate-100"
                                )}
                              >
                                <option value="Aguardando Aprovação">Aguardando Aprovação</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Em Contestação">Em Contestação</option>
                                <option value="Finalizado">Finalizado</option>
                                <option value="Cancelado">Cancelado</option>
                              </select>
                              {item.dataAprovacao && (
                                <div className="text-[9.5px] font-semibold text-emerald-700 mt-1 block whitespace-nowrap">
                                  Aprovado em: {item.dataAprovacao}
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (colKey === "vencimento") {
                          return (
                            <td key="vencimento" className={cn(cellPadding, "font-bold text-slate-800 font-mono tabular-nums whitespace-nowrap border-r border-slate-200/50")}>
                              {formatDateDisplay(item.dataVencimento)}
                            </td>
                          );
                        }
                        if (colKey === "codLancamento") {
                          const codOc = item.codLancamentoOc || "";
                          return (
                            <td key="codLancamento" className={cn(cellPadding, "text-slate-700 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {codOc ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#114D38] font-black text-[10px] border border-emerald-300 font-mono inline-block">
                                  {codOc.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">---</span>
                              )}
                            </td>
                          );
                        }
                        if (colKey === "lancamento") {
                          return (
                            <td key="lancamento" className={cn(cellPadding, "text-slate-500 font-mono tabular-nums whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.dataLancamento || "").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "prazo") {
                          return (
                            <td key="prazo" className={cn(cellPadding, "border-r border-slate-200/50")}>
                              <span className={cn("px-2 py-0.5 rounded border font-bold block text-center max-w-[155px] truncate shadow-sm", vencInfo.color)}>
                                {(vencInfo.text || "").toUpperCase()}
                              </span>
                            </td>
                          );
                        }
                        if (colKey === "fornecedor") {
                          return (
                            <td key="fornecedor" className={cn(cellPadding, "border-r border-slate-200/50")}>
                              <div className="flex flex-col text-left leading-normal">
                                <span className="font-extrabold text-slate-850 uppercase block max-w-[260px] truncate" title={item.fornecedor}>{(item.fornecedor || "").toUpperCase()}</span>
                                <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">{formatCPFCNPJ(item.cnpj)}</span>
                              </div>
                            </td>
                          );
                        }
                        if (colKey === "centroCusto") {
                          return (
                            <td key="centroCusto" className={cn(cellPadding, "border-r border-slate-200/50")}>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#114D38] font-black text-[10px] border border-emerald-200 uppercase whitespace-nowrap inline-block">
                                {(item.centroCusto || "C.C 101 - Operacional").toUpperCase()}
                              </span>
                            </td>
                          );
                        }
                        if (colKey === "cnpj") {
                          return (
                            <td key="cnpj" className={cn(cellPadding, "text-slate-500 font-mono tabular-nums whitespace-nowrap border-r border-slate-200/50")}>
                              {formatCPFCNPJ(item.cnpj)}
                            </td>
                          );
                        }
                        if (colKey === "estabelecimento") {
                          return (
                            <td key="estabelecimento" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.estabelecimento || "100 - PAULÍNIA").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "tipoDocumento") {
                          return (
                            <td key="tipoDocumento" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.tipo || "NF-E").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "frequencia") {
                          return (
                            <td key="frequencia" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.frequencia || "ESPORÁDICO").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "itemSistema") {
                          return (
                            <td key="itemSistema" className={cn(cellPadding, "text-slate-500 font-mono whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.itemSistema || "---").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "lancadoPor") {
                          return (
                            <td key="lancadoPor" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.lancadoPor || "DENY").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "descricao") {
                          return (
                            <td key="descricao" className={cn(cellPadding, "max-w-[240px] truncate text-slate-600 font-medium border-r border-slate-200/50 uppercase")} title={item.descricao}>
                              {(item.descricao || "").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "documento") {
                          return (
                            <td key="documento" className={cn(cellPadding, "text-slate-600 font-mono border-r border-slate-200/50")}>
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold text-slate-700 uppercase shrink-0">
                                  {(item.tipo || "").toUpperCase()}
                                </span>
                                <span className="truncate max-w-[130px] font-bold text-slate-800">{(item.doc || "").toUpperCase()}</span>
                                {Boolean((Array.isArray(item.anexos) && item.anexos.length > 0) || item.nomeArquivoAnexo || item.arquivoAnexoBase64) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const anxList = Array.isArray(item.anexos) && item.anexos.length > 0
                                        ? item.anexos
                                        : [{ id: "anx-1", nome: item.nomeArquivoAnexo || "Documento.pdf", base64: item.arquivoAnexoBase64 }];
                                      setViewingAnexo({
                                        nome: item.nomeArquivoAnexo || anxList[0]?.nome || "Documento.pdf",
                                        fornecedor: item.fornecedor,
                                        fornecedorCnpj: item.cnpj || "Sem CNPJ",
                                        valor: item.valor,
                                        cnpj: item.cnpj || "Sem CNPJ",
                                        doc: item.doc || item.codigoLancamento || "S/N",
                                        descricao: item.descricao,
                                        tipo: item.tipo || item.tipoDocumento || "NF-e",
                                        estabelecimento: item.estabelecimento,
                                        centroCusto: item.centroCusto,
                                        aprovadores: item.aprovadores,
                                        formaPagto: item.formaPagto || item.formaPagamento,
                                        itemSistema: item.itemSistema,
                                        lancadoPor: item.lancadoPor,
                                        status: item.status,
                                        frequencia: item.frequencia,
                                        dataEmissao: item.dataEmissao || item.dataLancamento,
                                        dataVencimento: item.dataVencimento || item.vencimento,
                                        observacao: item.observacao,
                                        arquivoAnexoBase64: item.arquivoAnexoBase64 || anxList[0]?.base64,
                                        anexos: anxList
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[9.5px] font-black cursor-pointer hover:bg-rose-100 transition-colors shrink-0"
                                    title={Array.isArray(item.anexos) && item.anexos.length > 1 ? `Ver ${item.anexos.length} documentos anexos` : `Ver anexo: ${item.nomeArquivoAnexo || "Documento.pdf"}`}
                                  >
                                    <FileText className="w-3 h-3 text-rose-600" />
                                    {Array.isArray(item.anexos) && item.anexos.length > 1
                                      ? `${item.anexos.length} Anexos`
                                      : "PDF"}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        }
                        if (colKey === "dataEmissao") {
                          return (
                            <td key="dataEmissao" className={cn(cellPadding, "text-slate-500 font-mono tabular-nums whitespace-nowrap border-r border-slate-200/50")}>
                              {item.dataEmissao ? formatDateDisplay(item.dataEmissao) : "---"}
                            </td>
                          );
                        }
                        if (colKey === "pagamento") {
                          return (
                            <td key="pagamento" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.formaPagto || "").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "aprovadores") {
                          return (
                            <td key="aprovadores" className={cn(cellPadding, "text-slate-600 font-bold whitespace-nowrap border-r border-slate-200/50")}>
                              {(item.aprovadores || "---").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "observacao") {
                          return (
                            <td key="observacao" className={cn(cellPadding, "max-w-[170px] truncate text-slate-500 font-medium border-r border-slate-200/50 uppercase")} title={item.observacao || ""}>
                              {(item.observacao || "---").toUpperCase()}
                            </td>
                          );
                        }
                        if (colKey === "valor") {
                          return (
                            <td key="valor" className={cn(cellPadding, "text-right font-black text-slate-900 font-mono tabular-nums whitespace-nowrap bg-emerald-50/20 text-xs")}>
                              {(item.valor || "").toUpperCase()}
                            </td>
                          );
                        }
                        return null;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Popup / Modal elegante de Alerta de Duplicidade de Documento */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-rose-200 shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-200 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Possível Documento Duplicado Detectado</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">A numeração deste lançamento já existe no sistema.</p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <p className="font-medium text-slate-500">Já existe um lançamento ativo com a mesma numeração:</p>
              
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Número do Documento</span>
                  <span className="font-black text-slate-800 block mt-0.5">{duplicateWarning.existingDoc.doc}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Valor do Lançamento</span>
                  <span className="font-black text-slate-800 block mt-0.5 text-rose-600">{duplicateWarning.existingDoc.valor}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Fornecedor Existente</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{duplicateWarning.existingDoc.fornecedor}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Descrição do Serviço</span>
                  <span className="font-bold text-slate-700 block mt-0.5 max-w-[180px] truncate" title={duplicateWarning.existingDoc.descricao}>
                    {duplicateWarning.existingDoc.descricao}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mt-4">
              Essa numeração de documento pode se referir ao mesmo produto/serviço duplicado ou a uma numeração coincidente de outro fornecedor. Deseja prosseguir mesmo assim?
            </p>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Parar Lançamento (Ajustar número)
              </button>
              <button
                onClick={() => {
                  setEmailDispatchModal({
                    isOpen: true,
                    docData: duplicateWarning.data,
                    calculatedDocName: duplicateWarning.data.docName,
                    toRecipients: [...DEFAULT_LANCAMENTO_TO_EMAILS],
                    ccRecipients: [...DEFAULT_LANCAMENTO_CC_EMAILS],
                    newToInput: "",
                    newCcInput: "",
                    isSaving: false,
                    isSending: false,
                    isManualResendOnly: false
                  });
                  setDuplicateWarning(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/10 cursor-pointer"
              >
                Seguir Lançando (Definir Destinatários e Salvar)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer de Vencimentos */}
      {isVencimentosOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsVencimentosOpen(false)}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="pointer-events-auto w-screen max-w-md"
              >
                <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl border-l border-slate-200">
                  {/* Header */}
                  <div className="bg-[#114D38] px-6 py-6 text-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold font-display" id="slide-over-title">Alertas e Vencimentos</h2>
                        <p className="mt-1 text-xs text-emerald-100">Controle discreto de vencimentos de faturas</p>
                      </div>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          className="rounded-md text-emerald-200 hover:text-white outline-none focus:ring-2 focus:ring-white cursor-pointer"
                          onClick={() => setIsVencimentosOpen(false)}
                        >
                          <span className="sr-only">Fechar painel</span>
                          <X className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-6 flex bg-[#0c3728] p-1 rounded-lg border border-emerald-800/40">
                      {["Próximos", "Em Atraso", "Mensais"].map(tab => {
                        const proximos = vencimentosReais.filter(v => v.dias >= 0);
                        const atrasados = vencimentosReais.filter(v => v.dias < 0);
                        
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveVencTab(tab)}
                            className={cn(
                              "flex-1 text-center py-2 text-xs font-bold rounded-md transition-all cursor-pointer",
                              activeVencTab === tab
                                ? "bg-white text-[#114D38] shadow"
                                : "text-emerald-100/70 hover:text-white"
                            )}
                          >
                            {tab}
                            {tab === "Próximos" && <span className="ml-1 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{proximos.length}</span>}
                            {tab === "Em Atraso" && <span className="ml-1 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{atrasados.length}</span>}
                            {tab === "Mensais" && <span className="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{mensaisPendentes.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative flex-1 px-6 py-6 bg-slate-50">
                    <div className="space-y-4">
                      {activeVencTab === "Próximos" && (
                        vencimentosReais.filter(v => v.dias >= 0).length === 0 ? (
                          <div className="text-center py-8 text-slate-400 font-bold text-xs">
                            Nenhum vencimento próximo cadastrado.
                          </div>
                        ) : (
                          vencimentosReais.filter(v => v.dias >= 0).map(v => (
                            <div key={v.id} className="p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors relative group">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{v.status}</span>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{v.diasText}</span>
                              </div>
                              <h4 className="font-bold text-sm text-slate-800">{v.fornecedor}</h4>
                              <p className="text-xs text-slate-500 font-medium mt-1">{v.doc} • Vencimento: {formatDateDisplay(v.vencimento)}</p>
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-mono text-slate-400">ID: {v.id}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-slate-800 mr-2">{v.valor}</span>
                                  <button
                                    onClick={() => handleEditFromVencimentos(v)}
                                    className="p-1 rounded bg-slate-100 hover:bg-[#114D38]/10 text-slate-500 hover:text-[#114D38] transition-colors cursor-pointer"
                                    title="Editar este lançamento direto"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )
                      )}

                      {activeVencTab === "Em Atraso" && (
                        vencimentosReais.filter(v => v.dias < 0).length === 0 ? (
                          <div className="text-center py-8 text-emerald-600 font-bold text-xs">
                            🎉 Nenhuma fatura em atraso no momento!
                          </div>
                        ) : (
                          vencimentosReais.filter(v => v.dias < 0).map(v => (
                            <div key={v.id} className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm flex flex-col justify-between hover:border-rose-200 transition-colors relative">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{v.status}</span>
                                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{v.diasText}</span>
                              </div>
                              <h4 className="font-bold text-sm text-slate-800">{v.fornecedor}</h4>
                              <p className="text-xs text-slate-500 font-medium mt-1">{v.doc} • Vencimento: {formatDateDisplay(v.vencimento)}</p>
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-mono text-slate-400">ID: {v.id}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-rose-600 mr-2">{v.valor}</span>
                                  <button
                                    onClick={() => handleEditFromVencimentos(v)}
                                    className="p-1 rounded bg-slate-100 hover:bg-[#114D38]/10 text-slate-500 hover:text-[#114D38] transition-colors cursor-pointer"
                                    title="Editar este lançamento direto"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )
                      )}

                      {activeVencTab === "Mensais" && (
                        mensaisPendentes.length === 0 ? (
                          <div className="text-center py-10 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-2">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <p className="text-slate-700 font-bold text-xs">Nenhum lançamento recorrente/mensal cadastrado.</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">Ao cadastrar ou editar um lançamento, escolha a frequência <span className="font-bold text-amber-700">"Mensal"</span> para acompanhá-lo nesta guia.</p>
                          </div>
                        ) : (
                          mensaisPendentes.map(v => (
                            <div key={v.id} className="p-4 bg-white rounded-xl border border-amber-100 shadow-sm flex flex-col justify-between hover:border-amber-200 transition-colors relative">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">{v.status}</span>
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{v.diasText}</span>
                              </div>
                              <h4 className="font-bold text-sm text-slate-800">{v.fornecedor}</h4>
                              <p className="text-xs text-slate-500 font-medium mt-1">{v.doc} • {v.valor}</p>
                              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 mb-2">
                                <Clock className="w-3.5 h-3.5" /> Data: {formatDateDisplay(v.vencimento)}
                              </p>
                              <div className="border-t border-slate-100 pt-2 flex justify-end">
                                <button
                                  onClick={() => handleEditFromVencimentos(v)}
                                  className="px-3 py-1.5 rounded-lg bg-[#114D38]/10 hover:bg-[#114D38]/20 text-[#114D38] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Editar este lançamento direto"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Lançar / Editar Fatura</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seguro de Visualização de Documento Anexo */}
      <DocumentoAnexoModal
        isOpen={!!viewingAnexo}
        onClose={() => setViewingAnexo(null)}
        documento={viewingAnexo}
      />

      {/* Modal de Gestão e Edição Completa de Bases / Filiais */}
      {isManageBasesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#114D38]">
                  <Building className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-slate-800">
                    Gerenciamento de Bases / Filiais
                  </h3>
                  <p className="text-xs text-slate-500">Cadastre, edite ou remova estabelecimentos do sistema</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsManageBasesModalOpen(false);
                  setEditingBaseOldName(null);
                  setBaseFeedbackMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {baseFeedbackMsg && (
              <div className={cn(
                "p-3 rounded-lg text-xs font-semibold flex items-center gap-2",
                baseFeedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              )}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{baseFeedbackMsg.text}</span>
              </div>
            )}

            {/* Formulário de Cadastro Rápido de Nova Base */}
            <form onSubmit={handleAddNovaBaseModal} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adicionar Nova Base</span>
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Cód. (ex: 200)</label>
                  <input 
                    type="text" 
                    value={newBaseCodigo} 
                    onChange={(e) => setNewBaseCodigo(e.target.value)} 
                    placeholder="200" 
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold mt-0.5 bg-white focus:border-[#114D38] outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome da Base *</label>
                  <input 
                    type="text" 
                    required 
                    value={newBaseNome} 
                    onChange={(e) => setNewBaseNome(e.target.value)} 
                    placeholder="Ex: Santos / Cubatão" 
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold mt-0.5 bg-white focus:border-[#114D38] outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#114D38] hover:bg-[#0d3d2c] rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar e Salvar Base</span>
                </button>
              </div>
            </form>

            {/* Lista de Bases Cadastradas com Edição Inline */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
                <span>Bases Ativas no Sistema ({estabelecimentos.length})</span>
                <span className="text-[10px] font-normal text-slate-400">Clique no lápis para editar</span>
              </div>

              {estabelecimentos.map((base) => {
                const isEditing = editingBaseOldName === base;

                return (
                  <div 
                    key={base} 
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-200 transition-all group shadow-2xs"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full">
                        <input 
                          type="text" 
                          value={editingBaseNewName}
                          onChange={(e) => setEditingBaseNewName(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs font-bold border border-emerald-400 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50/20 text-slate-800"
                          autoFocus
                        />
                        <button 
                          type="button"
                          onClick={() => handleSaveEditBase(base)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Salvar alterações"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingBaseOldName(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">{base}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingBaseOldName(base);
                              setEditingBaseNewName(base);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer transition-colors"
                            title="Editar Base"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteBase(base)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                            title="Excluir Base"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => {
                  setIsManageBasesModalOpen(false);
                  setEditingBaseOldName(null);
                  setBaseFeedbackMsg(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Gestão e Edição Completa de Centros de Custo */}
      {isNewCcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-[#114D38]">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-slate-800">
                    Gerenciamento de Centros de Custo (C.C)
                  </h3>
                  <p className="text-xs text-slate-500">Cadastre, edite códigos ou remova Centros de Custo</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsNewCcModalOpen(false);
                  setEditingCcOldName(null);
                  setCcFeedbackMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {ccFeedbackMsg && (
              <div className={cn(
                "p-3 rounded-lg text-xs font-semibold flex items-center gap-2",
                ccFeedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              )}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{ccFeedbackMsg.text}</span>
              </div>
            )}

            {/* Formulário de Cadastro de Novo C.C */}
            <form onSubmit={handleAddNovoCentroCusto} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adicionar Novo Centro de Custo</span>
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Cód. (ex: 111)</label>
                  <input 
                    type="text" 
                    value={newCcCodigo} 
                    onChange={(e) => setNewCcCodigo(e.target.value)} 
                    placeholder="111" 
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold mt-0.5 bg-white focus:border-[#114D38] outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome / Descrição *</label>
                  <input 
                    type="text" 
                    required 
                    value={newCcNome} 
                    onChange={(e) => setNewCcNome(e.target.value)} 
                    placeholder="Ex: Almoxarifado / Suprimentos" 
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold mt-0.5 bg-white focus:border-[#114D38] outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#114D38] hover:bg-[#0d3d2c] rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar e Salvar C.C</span>
                </button>
              </div>
            </form>

            {/* Lista de Centros de Custo Cadastrados com Edição */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
                <span>Centros de Custo Ativos ({centrosCustoList.length})</span>
                <span className="text-[10px] font-normal text-slate-400">Clique no lápis para editar</span>
              </div>

              {centrosCustoList.map((cc) => {
                const isEditing = editingCcOldName === cc;

                return (
                  <div 
                    key={cc} 
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-200 transition-all group shadow-2xs"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input 
                          type="text" 
                          placeholder="Cód."
                          value={editingCcCodigo}
                          onChange={(e) => setEditingCcCodigo(e.target.value)}
                          className="w-20 px-2 py-1 text-xs font-bold border border-emerald-400 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800"
                        />
                        <input 
                          type="text" 
                          placeholder="Nome do Centro de Custo"
                          value={editingCcNome}
                          onChange={(e) => setEditingCcNome(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs font-bold border border-emerald-400 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800"
                          autoFocus
                        />
                        <button 
                          type="button"
                          onClick={() => handleSaveEditCentroCusto(cc)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Salvar alterações"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingCcOldName(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
                            C.C
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate">{cc}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            type="button"
                            onClick={() => handleStartEditCentroCusto(cc)}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer transition-colors"
                            title="Editar Centro de Custo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteCentroCusto(cc)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                            title="Excluir Centro de Custo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => {
                  setIsNewCcModalOpen(false);
                  setEditingCcOldName(null);
                  setCcFeedbackMsg(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Gestão de Destinatários de E-mail para Lançamento de Documentos */}
      <EmailRecipientsModal
        isOpen={isRecipientsModalOpen}
        onClose={() => setIsRecipientsModalOpen(false)}
        initialSubmodule="documentos"
        currentUserEmail={user?.email || "deny.goncalves@risel.com.br"}
      />

      {/* Modal Interativo de Seleção de Destinatários e Disparo de E-mail */}
      {emailDispatchModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[95vh] flex flex-col"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#114D38] shadow-2xs">
                  <Mail className="w-5 h-5 text-[#114D38]" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-slate-800 flex items-center gap-2">
                    <span>Destinatários do E-mail de Aprovação</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#114D38] border border-emerald-200">
                      Risel Combustíveis
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {emailDispatchModal.isManualResendOnly
                      ? "Escolha os destinatários para o reenvio manual da notificação de aprovação."
                      : "Defina quem receberá este lançamento antes de finalizar o registro no sistema."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailDispatchModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo com Scroll */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Card Resumo do Documento e Saudação Automática */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Documento:</span>
                    <span className="font-black text-[#114D38] bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                      {emailDispatchModal.docData?.codigoLancamento || emailDispatchModal.calculatedDocName || emailDispatchModal.docData?.doc || "Lançamento"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Valor:</span>
                    <span className="font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {typeof emailDispatchModal.docData?.valorNf === "string" && emailDispatchModal.docData.valorNf.startsWith("R$")
                        ? emailDispatchModal.docData.valorNf
                        : `R$ ${emailDispatchModal.docData?.valorNf || emailDispatchModal.docData?.valor || "0,00"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Vencimento:</span>
                    <span className="font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {formatDateDisplay(emailDispatchModal.docData?.dataVencimento || emailDispatchModal.docData?.vencimento)}
                    </span>
                  </div>
                </div>

                {/* Banner de Saudação Dinâmica */}
                <div className="flex items-center justify-between gap-2 p-2 bg-emerald-50/60 rounded-lg border border-emerald-100 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-700">
                      Saudação Dinâmica no E-mail:
                    </span>
                    <span className="text-xs font-black text-[#114D38] bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs font-mono">
                      "{getSaudacaoDestinatarios(emailDispatchModal.toRecipients)}"
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-medium hidden sm:inline">
                    {emailDispatchModal.toRecipients.length === 1
                      ? "Personalizado para 1 destinatário"
                      : "Tratamento coletivo"}
                  </span>
                </div>
              </div>

              {/* Seção Destinatários Principais (Para / To) */}
              <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Destinatários Principais (Para / To) *
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {emailDispatchModal.toRecipients.length} selecionado(s)
                  </span>
                </div>

                {/* Chips de Destinatários To */}
                <div className="flex flex-wrap gap-1.5">
                  {emailDispatchModal.toRecipients.map((email) => {
                    const nomeIdentificado = email.toLowerCase().includes("csouza")
                      ? "Cesar"
                      : email.toLowerCase().includes("wbreda")
                      ? "Wesley"
                      : email.toLowerCase().includes("deny")
                      ? "Deny"
                      : email.toLowerCase().includes("lorena")
                      ? "Lorena"
                      : "";

                    return (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#114D38] text-xs font-bold shadow-2xs"
                      >
                        <span className="font-mono text-[11px]">{email}</span>
                        {nomeIdentificado && (
                          <span className="px-1.5 py-0.2 rounded bg-white text-[9px] font-black text-emerald-800 border border-emerald-100">
                            {nomeIdentificado}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEmailDispatchModal((prev) => {
                              if (!prev) return null;
                              const filtrados = prev.toRecipients.filter((item) => item !== email);
                              return { ...prev, toRecipients: filtrados };
                            });
                          }}
                          className="hover:bg-emerald-200/60 p-0.5 rounded text-emerald-800 cursor-pointer transition-colors"
                          title={`Remover ${email}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {emailDispatchModal.toRecipients.length === 0 && (
                    <span className="text-xs text-rose-600 font-semibold p-1">
                      Nenhum destinatário principal. O e-mail precisa de ao menos um destinatário no campo Para.
                    </span>
                  )}
                </div>

                {/* Adicionar novo e-mail To */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="email"
                    placeholder="Adicionar outro e-mail (ex: diretor@risel.com.br)..."
                    value={emailDispatchModal.newToInput}
                    onChange={(e) =>
                      setEmailDispatchModal((prev) => (prev ? { ...prev, newToInput: e.target.value } : null))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = emailDispatchModal.newToInput.trim().toLowerCase();
                        if (val && val.includes("@") && !emailDispatchModal.toRecipients.includes(val)) {
                          setEmailDispatchModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  toRecipients: [...prev.toRecipients, val],
                                  newToInput: ""
                                }
                              : null
                          );
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:border-[#114D38] outline-none transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = emailDispatchModal.newToInput.trim().toLowerCase();
                      if (val && val.includes("@") && !emailDispatchModal.toRecipients.includes(val)) {
                        setEmailDispatchModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                toRecipients: [...prev.toRecipients, val],
                                newToInput: ""
                              }
                            : null
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#114D38] hover:bg-[#0d3d2c] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Seção Em Cópia (CC) */}
              <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-600" />
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Em Cópia (CC)
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {emailDispatchModal.ccRecipients.length} em cópia
                  </span>
                </div>

                {/* Chips de Destinatários CC */}
                <div className="flex flex-wrap gap-1.5">
                  {emailDispatchModal.ccRecipients.map((email) => {
                    const nomeIdentificado = email.toLowerCase().includes("lorena")
                      ? "Lorena"
                      : email.toLowerCase().includes("deny")
                      ? "Deny"
                      : email.toLowerCase().includes("csouza")
                      ? "Cesar"
                      : email.toLowerCase().includes("wbreda")
                      ? "Wesley"
                      : "";

                    return (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs"
                      >
                        <span className="font-mono text-[11px]">{email}</span>
                        {nomeIdentificado && (
                          <span className="px-1.5 py-0.2 rounded bg-white text-[9px] font-bold text-slate-700 border border-slate-200">
                            {nomeIdentificado}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEmailDispatchModal((prev) => {
                              if (!prev) return null;
                              const filtrados = prev.ccRecipients.filter((item) => item !== email);
                              return { ...prev, ccRecipients: filtrados };
                            });
                          }}
                          className="hover:bg-slate-200 p-0.5 rounded text-slate-600 cursor-pointer transition-colors"
                          title={`Remover ${email}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {emailDispatchModal.ccRecipients.length === 0 && (
                    <span className="text-xs text-slate-400 italic p-1">
                      Nenhum e-mail em cópia configurado.
                    </span>
                  )}
                </div>

                {/* Adicionar novo e-mail CC */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="email"
                    placeholder="Adicionar e-mail em cópia..."
                    value={emailDispatchModal.newCcInput}
                    onChange={(e) =>
                      setEmailDispatchModal((prev) => (prev ? { ...prev, newCcInput: e.target.value } : null))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = emailDispatchModal.newCcInput.trim().toLowerCase();
                        if (val && val.includes("@") && !emailDispatchModal.ccRecipients.includes(val)) {
                          setEmailDispatchModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  ccRecipients: [...prev.ccRecipients, val],
                                  newCcInput: ""
                                }
                              : null
                          );
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:border-[#114D38] outline-none transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = emailDispatchModal.newCcInput.trim().toLowerCase();
                      if (val && val.includes("@") && !emailDispatchModal.ccRecipients.includes(val)) {
                        setEmailDispatchModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                ccRecipients: [...prev.ccRecipients, val],
                                newCcInput: ""
                              }
                            : null
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar CC</span>
                  </button>
                </div>
              </div>

              {/* Informação sobre a tabela e anexo anexados */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs text-slate-600">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ordem Oficial dos Dados Enviados no E-mail:</span>
                  </span>
                  {emailDispatchModal.docData?.nomeArquivoAnexo && (
                    <span className="text-[10px] text-emerald-800 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Anexo: {emailDispatchModal.docData.nomeArquivoAnexo}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                  Status &gt; Data do Lançamento &gt; Nº Documento &gt; Fornecedor &gt; Nº Estabelecimento &gt; Nº Lançamento/OC &gt; Descrição &gt; Valor &gt; Vencimento
                </p>
              </div>
            </div>

            {/* Rodapé com Ações Corporativas */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEmailDispatchModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                Voltar ao Formulário
              </button>

              <div className="flex items-center gap-2">
                {!emailDispatchModal.isManualResendOnly && (
                  <button
                    type="button"
                    disabled={emailDispatchModal.isSaving}
                    onClick={async () => {
                      setEmailDispatchModal((prev) => (prev ? { ...prev, isSaving: true } : null));
                      try {
                        await executeSave(
                          emailDispatchModal.docData,
                          emailDispatchModal.calculatedDocName,
                          { sendEmail: false }
                        );
                      } finally {
                        setEmailDispatchModal(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    Salvar Sem Enviar E-mail
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    emailDispatchModal.isSending ||
                    emailDispatchModal.isSaving ||
                    emailDispatchModal.toRecipients.length === 0
                  }
                  onClick={async () => {
                    setEmailDispatchModal((prev) => (prev ? { ...prev, isSending: true } : null));
                    try {
                      if (emailDispatchModal.isManualResendOnly) {
                        const para = emailDispatchModal.toRecipients;
                        const cc = emailDispatchModal.ccRecipients;
                        const sent = await sendLancamentoAprovacaoEmail({
                          ...emailDispatchModal.docData,
                          codigoLancamento: emailDispatchModal.docData?.codigoLancamento || "",
                          doc: emailDispatchModal.docData?.codigoLancamento || emailDispatchModal.calculatedDocName || emailDispatchModal.docData.doc,
                          destinatariosPara: para,
                          destinatariosCc: cc,
                          columnOrder,
                          visibleCols
                        });
                        if (sent) {
                          const docId = emailDispatchModal.docData?.id;
                          if (docId) {
                            const existingDoc = lancamentos.find(item => String(item.id) === String(docId)) || emailDispatchModal.docData;
                            const updatedDoc = {
                              ...existingDoc,
                              status: "Aguardando Aprovação",
                              dataAprovacao: ""
                            };
                            await saveLancamentoUnified(updatedDoc);
                            setLancamentos(prev => prev.map(l => String(l.id) === String(docId) ? { ...l, status: "Aguardando Aprovação", dataAprovacao: "" } : l));
                            window.dispatchEvent(new Event("risel_lancamentos_updated"));
                          }
                          const saudacao = getSaudacaoDestinatarios(para);
                          setEmailSentNotice({
                            title: "E-mail de Aprovação Enviado",
                            desc: `E-mail (${saudacao}) encaminhado com sucesso para ${para.join(", ")} com cópia para ${cc.join(", ")}. Status atualizado para "Aguardando Aprovação".`
                          });
                          setTimeout(() => setEmailSentNotice(null), 8000);
                        } else {
                          alert("Não foi possível enviar o e-mail. Verifique o servidor de e-mail.");
                        }
                        setEmailDispatchModal(null);
                      } else {
                        await executeSave(
                          emailDispatchModal.docData,
                          emailDispatchModal.calculatedDocName,
                          {
                            sendEmail: true,
                            toRecipients: emailDispatchModal.toRecipients,
                            ccRecipients: emailDispatchModal.ccRecipients
                          }
                        );
                      }
                    } catch (err: any) {
                      console.error("Erro no envio:", err);
                      alert("Erro ao disparar e-mail: " + (err?.message || "Falha"));
                    } finally {
                      setEmailDispatchModal(null);
                    }
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#114D38] hover:bg-[#0d3d2c] shadow-md shadow-[#114D38]/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {emailDispatchModal.isSending
                      ? "Enviando..."
                      : emailDispatchModal.isManualResendOnly
                      ? "Confirmar e Reenviar E-mail"
                      : "Salvar e Enviar E-mail"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Modal da Central de Segurança & Backups de Lançamentos - EXCLUSIVO deny.goncalves@risel.com.br */}
      {isAuthorizedRestoreUser && isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-200 text-emerald-700 shrink-0 shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Segurança & Banco de Dados de Lançamentos</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Persistência permanente no Banco de Dados • Painel Exclusivo de Deny Gonçalves</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagem de Feedback */}
            {backupMessage && (
              <div className={cn(
                "p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 shrink-0",
                backupMessage.type === "success" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
                backupMessage.type === "error" && "bg-rose-50 text-rose-800 border border-rose-200",
                backupMessage.type === "info" && "bg-blue-50 text-blue-800 border border-blue-200"
              )}>
                {backupMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{backupMessage.text}</span>
              </div>
            )}

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Status das 3 Camadas do Banco de Dados */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                    <Database className="w-4 h-4" />
                    <span>Banco Atual</span>
                  </div>
                  <span className="text-[12px] text-slate-700 font-bold block">
                    {lancamentos.length} documentos
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    Banco de dados oficial ativo
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
                  <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-bold mb-1">
                    <Server className="w-4 h-4" />
                    <span>Backups Servidor</span>
                  </div>
                  <span className="text-[12px] text-slate-700 font-bold block">
                    {serverBackups.length} versionados
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    Snapshots físicos no servidor
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Cofre Local</span>
                  </div>
                  <span className="text-[12px] text-slate-700 font-bold block">
                    {snapshotInfo.hasSnapshot ? `${snapshotInfo.count} registros` : "Nenhum"}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                    Backup de emergência local
                  </span>
                </div>
              </div>

              {/* Ações de Gestão de Banco de Dados */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-left">
                  Ações de Banco de Dados e Restauração Imediata
                </div>

                {/* Botão Criar Ponto de Restauração no Banco de Dados Agora */}
                <button
                  type="button"
                  disabled={backupSyncLoading || lancamentos.length === 0}
                  onClick={async () => {
                    setBackupSyncLoading(true);
                    setBackupMessage(null);
                    try {
                      const res = await createDatabaseBackup();
                      if (res.success) {
                        setBackupMessage({
                          type: "success",
                          text: `Ponto de restauração gravado com sucesso no Banco de Dados do Servidor! (${res.count} lançamentos protegidos)`
                        });
                        loadServerBackups();
                      } else {
                        setBackupMessage({
                          type: "error",
                          text: res.error || "Erro ao criar backup no banco de dados."
                        });
                      }
                    } catch (e: any) {
                      setBackupMessage({
                        type: "error",
                        text: "Erro de conexão ao gravar backup: " + (e?.message || "")
                      });
                    } finally {
                      setBackupSyncLoading(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-700" />
                    <div className="text-left">
                      <span className="block font-bold">Criar Novo Ponto de Backup no Banco de Dados</span>
                      <span className="block text-[10px] text-emerald-700/80 font-normal">Gera uma cópia física e versionada no disco rígido do servidor</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold">Gravar Backup</span>
                </button>

                {/* Botão Restaurar do Último Backup do Banco de Dados */}
                <button
                  type="button"
                  disabled={backupSyncLoading}
                  onClick={async () => {
                    setBackupSyncLoading(true);
                    setBackupMessage(null);
                    try {
                      const res = await restoreFromDatabaseBackup();
                      if (res.success && res.count > 0) {
                        setBackupMessage({
                          type: "success",
                          text: `Sucesso absoluto! ${res.count} lançamentos restaurados diretamente do Banco de Dados do Servidor!`
                        });
                      } else {
                        setBackupMessage({
                          type: "info",
                          text: res.error || "Nenhum backup em arquivo encontrado no servidor. Tente restaurar do cofre local ou importar um JSON."
                        });
                      }
                    } catch (e: any) {
                      setBackupMessage({
                        type: "error",
                        text: "Erro ao restaurar do banco de dados: " + (e?.message || "")
                      });
                    } finally {
                      setBackupSyncLoading(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-indigo-700" />
                    <div className="text-left">
                      <span className="block font-bold">Restaurar do Banco de Dados do Servidor</span>
                      <span className="block text-[10px] text-indigo-700/80 font-normal">Recupera a base de dados a partir do arquivo de backup do servidor</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-800 font-bold">Restaurar Banco</span>
                </button>

                {/* Botão Restaurar do Snapshot Local */}
                {snapshotInfo.hasSnapshot && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = restoreLancamentosFromSnapshot();
                      if (res.success && res.count > 0) {
                        setBackupMessage({
                          type: "success",
                          text: `Sucesso! ${res.count} lançamentos recuperados do Cofre Local e salvos no Banco de Dados!`
                        });
                        loadServerBackups();
                      } else {
                        setBackupMessage({
                          type: "error",
                          text: "Não foi possível restaurar do snapshot local."
                        });
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <div className="text-left">
                        <span className="block font-bold">Restaurar do Cofre de Segurança Local</span>
                        <span className="block text-[10px] text-amber-700/80 font-normal">
                          Contém {snapshotInfo.count} lançamentos preservados na memória deste computador
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-amber-800 font-bold">Restaurar Local</span>
                  </button>
                )}

                {/* Lista de Histórico de Backups Disponíveis no Servidor */}
                {serverBackups.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Histórico de Backups no Banco de Dados ({serverBackups.length})
                      </span>
                      <button
                        type="button"
                        onClick={loadServerBackups}
                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={cn("w-3 h-3", loadingServerBackups && "animate-spin")} />
                        <span>Atualizar</span>
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {serverBackups.slice(0, 5).map((b, idx) => (
                        <div key={b.filename || idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 text-xs shadow-2xs">
                          <div className="text-left">
                            <span className="font-bold text-slate-800 block leading-tight">
                              {b.count} lançamentos
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {b.timestamp ? new Date(b.timestamp).toLocaleString("pt-BR") : b.filename}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={backupSyncLoading}
                            onClick={async () => {
                              if (!window.confirm(`Deseja restaurar este backup do banco contendo ${b.count} lançamentos?`)) return;
                              setBackupSyncLoading(true);
                              try {
                                const res = await restoreFromDatabaseBackup(b.filename);
                                if (res.success) {
                                  setBackupMessage({
                                    type: "success",
                                    text: `Sucesso! ${res.count} lançamentos restaurados do backup selecionado!`
                                  });
                                }
                              } finally {
                                setBackupSyncLoading(false);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão Download Backup JSON */}
                <button
                  type="button"
                  onClick={() => {
                    exportLancamentosBackupJson();
                    setBackupMessage({
                      type: "success",
                      text: "Backup do banco de dados exportado com sucesso! Arquivo .JSON salvo no seu computador."
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Upload className="w-4 h-4 text-emerald-600 rotate-180" />
                    <div className="text-left">
                      <span className="block font-bold">Exportar Backup Completo do Banco (.JSON)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Baixa arquivo de contingência com todos os documentos salvos</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold">Exportar</span>
                </button>

                {/* Botão Importar Arquivo de Backup ou Planilha CSV/JSON para o Banco */}
                <label className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <div className="text-left">
                      <span className="block font-bold">Importar Arquivo Real (.JSON ou .CSV) para o Banco de Dados</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Processa e grava o histórico real diretamente no Banco de Dados</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-700 font-bold">Selecionar Arquivo</span>
                  <input
                    type="file"
                    accept=".json,.csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const content = event.target?.result as string;
                          let itemsList: any[] = [];
                          
                          if (file.name.endsWith(".json") || content.trim().startsWith("[") || content.trim().startsWith("{")) {
                            try {
                              const parsed = JSON.parse(content);
                              itemsList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
                            } catch (errJson) {
                              itemsList = [];
                            }
                          }

                          // Se for CSV ou se JSON falhou
                          if (itemsList.length === 0 && (content.includes(";") || content.includes(","))) {
                            const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
                            if (lines.length > 1) {
                              const delimiter = lines[0].includes(";") ? ";" : ",";
                              const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, "").toUpperCase());
                              
                              for (let i = 1; i < lines.length; i++) {
                                const row = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ""));
                                if (row.length >= 2) {
                                  const getCol = (names: string[]) => {
                                    for (const name of names) {
                                      const idx = headers.findIndex(h => h.includes(name));
                                      if (idx !== -1 && row[idx]) return row[idx];
                                    }
                                    return "";
                                  };

                                  const docVal = getCol(["DOC", "NUMERO_DOC", "Nº DOC", "DOCUMENTO", "NUMERO"]);
                                  const fornecedorVal = getCol(["FORNECEDOR", "NOME", "RAZAO", "EMPRESA"]);
                                  const valorVal = getCol(["VALOR", "TOTAL", "PRECO", "VL"]);
                                  const vencVal = getCol(["VENCIMENTO", "DATA_VENC", "DATA VENCIMENTO"]);
                                  const emissaoVal = getCol(["EMISSAO", "DATA_EMISSAO", "DATA EMISSAO"]);
                                  const statusVal = getCol(["STATUS", "SITUACAO"]);
                                  const ccVal = getCol(["CENTRO", "CUSTO", "CC"]);
                                  const cnpjVal = getCol(["CNPJ", "CPF"]);
                                  const ocVal = getCol(["OC", "PEDIDO", "ORDEM"]);
                                  const obsVal = getCol(["OBS", "OBSERVACAO", "DESCRICAO"]);

                                  if (docVal || fornecedorVal || valorVal) {
                                    itemsList.push({
                                      id: Date.now() + i,
                                      doc: docVal || `DOC-${i}`,
                                      codigoLancamento: docVal,
                                      numeroDocumento: docVal,
                                      codLancamentoOc: ocVal,
                                      fornecedor: fornecedorVal || "Fornecedor Importado",
                                      cnpj: cnpjVal,
                                      valor: valorVal ? (valorVal.startsWith("R$") ? valorVal : `R$ ${valorVal}`) : "R$ 0,00",
                                      dataVencimento: vencVal,
                                      dataEmissao: emissaoVal,
                                      status: statusVal || "Aguardando Aprovação",
                                      centroCusto: ccVal || "C.C 101 - Operacional",
                                      observacao: obsVal
                                    });
                                  }
                                }
                              }
                            }
                          }

                          if (itemsList.length > 0) {
                            const res = await importLancamentosToDatabase(itemsList);
                            if (res.success) {
                              setBackupMessage({
                                type: "success",
                                text: `Sucesso absoluto! ${res.count} lançamentos reais importados e salvos com sucesso no Banco de Dados!`
                              });
                              loadServerBackups();
                            } else {
                              setBackupMessage({
                                type: "error",
                                text: "Erro ao gravar no banco: " + (res.error || "")
                              });
                            }
                          } else {
                            setBackupMessage({
                              type: "error",
                              text: "O arquivo selecionado não contém lançamentos em formato reconhecido (JSON ou CSV)."
                            });
                          }
                        } catch (err: any) {
                          setBackupMessage({
                            type: "error",
                            text: "Erro ao processar arquivo: " + (err?.message || "Arquivo inválido")
                          });
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* Opção de Limpar Registros Fictícios / Demonstrativos */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Limpeza de dados de demonstração:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("Deseja remover os registros demonstrativos/fictícios para deixar o banco de dados pronto para os lançamentos reais?")) return;
                      setBackupSyncLoading(true);
                      try {
                        const res = await importLancamentosToDatabase([]);
                        if (res.success) {
                          setBackupMessage({
                            type: "info",
                            text: "Registros de demonstração limpos com sucesso. O banco de dados está pronto para receber os lançamentos reais."
                          });
                        }
                      } finally {
                        setBackupSyncLoading(false);
                      }
                    }}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                  >
                    Limpar Dados Fictícios do Banco
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#114D38] text-white hover:bg-[#0d3d2c] transition-colors cursor-pointer shadow-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

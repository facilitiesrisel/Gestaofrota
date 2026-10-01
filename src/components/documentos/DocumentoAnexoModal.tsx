import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, X, Download, Printer, ExternalLink, Eye, RotateCw, ZoomIn, 
  ZoomOut, ShieldCheck, Building, Calendar, DollarSign, UserCheck, 
  CheckCircle2, CreditCard, ChevronLeft, ChevronRight, Sparkles, RefreshCw,
  Clock, Tag, User, HelpCircle, FileCheck, Layers
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { cn } from "../../lib/utils";
import { fetchLancamentoAnexoOriginal } from "../../services/lancamentosService";

// Configurar worker do PDF.js para processamento em background seguro
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

export interface AnexoItem {
  id?: string;
  nome: string;
  base64?: string;
  arquivoAnexoBase64?: string;
  content?: string;
  tamanho?: number;
  tipo?: string;
  url?: string;
}

export interface DocumentoAnexoData {
  id?: number | string;
  nome?: string;
  fornecedor?: string;
  fornecedorCnpj?: string;
  cnpj?: string;
  valor?: string;
  doc?: string;
  descricao?: string;
  tipo?: string;
  estabelecimento?: string;
  centroCusto?: string;
  aprovadores?: string;
  formaPagto?: string;
  dataEmissao?: string;
  dataVencimento?: string;
  itemSistema?: string;
  lancadoPor?: string;
  status?: string;
  frequencia?: string;
  observacao?: string;
  arquivoAnexoBase64?: string;
  arquivoAnexoUrl?: string;
  anexos?: AnexoItem[];
  anexoAtivoIndex?: number;
}

interface DocumentoAnexoModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoAnexoData | null;
}

// Helpers de formatação segura para dados reais
function formatBrDate(dateStr?: string): string {
  if (!dateStr || dateStr === "---" || dateStr === "-") return "Não informada";
  const clean = dateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return clean;
}

function formatCnpjClean(cnpjStr?: string): string {
  if (!cnpjStr || cnpjStr === "Sem CNPJ" || cnpjStr === "Não informado") return "Não informado";
  const nums = cnpjStr.replace(/\D/g, "");
  if (nums.length === 14) {
    return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (nums.length === 11) {
    return nums.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return cnpjStr;
}

function formatValorDisplay(val?: string): string {
  if (!val || val === "Não identificado" || val === "R$ 0,00") return val || "R$ 0,00";
  const clean = val.trim();
  if (clean.startsWith("R$")) return clean;
  const num = parseFloat(clean.replace(/\./g, "").replace(",", "."));
  if (!isNaN(num)) {
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return `R$ ${clean}`;
}

export const DocumentoAnexoModal: React.FC<DocumentoAnexoModalProps> = ({
  isOpen,
  onClose,
  documento
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pdf" | "image" | "voucher">("pdf");
  const [pdfRenderMode, setPdfRenderMode] = useState<"native" | "canvas">("native");
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remoteData, setRemoteData] = useState<{ arquivoAnexoBase64?: string; anexos?: AnexoItem[]; nome?: string } | null>(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState<boolean>(false);

  // Busca remota transparente se o anexo não veio pré-carregado no objeto em memória
  useEffect(() => {
    if (!isOpen || !documento) {
      setRemoteData(null);
      setIsFetchingRemote(false);
      return;
    }

    const hasImmediateAnexo = Boolean(
      (documento.arquivoAnexoBase64 && documento.arquivoAnexoBase64.trim().length > 50) ||
      (documento.arquivoAnexoUrl && documento.arquivoAnexoUrl.trim().length > 5) ||
      (Array.isArray(documento.anexos) && documento.anexos.some(a => (a?.base64 && a.base64.trim().length > 50) || (a?.arquivoAnexoBase64 && a.arquivoAnexoBase64.trim().length > 50) || a?.url))
    );

    if (!hasImmediateAnexo && documento.id) {
      setIsFetchingRemote(true);
      setIsLoading(true);
      fetchLancamentoAnexoOriginal(documento.id).then(res => {
        if (res && (res.arquivoAnexoBase64 || (Array.isArray(res.anexos) && res.anexos.length > 0))) {
          setRemoteData(res);
        }
      }).catch(err => {
        console.warn("[DocumentoAnexoModal] Aviso ao recuperar anexo do servidor:", err);
      }).finally(() => {
        setIsFetchingRemote(false);
      });
    } else {
      setIsFetchingRemote(false);
    }
  }, [isOpen, documento]);

  // Lista normalizada de anexos (até 4) garantindo herança do base64 original da fatura
  const anexosList = React.useMemo<AnexoItem[]>(() => {
    if (!documento) return [];

    const fallbackBase64 = (
      documento.arquivoAnexoBase64 ||
      remoteData?.arquivoAnexoBase64 ||
      documento.arquivoAnexoUrl ||
      ""
    ).trim();

    // 1. Prioriza anexos com conteúdo base64 presentes em documento
    if (Array.isArray(documento.anexos) && documento.anexos.length > 0 && documento.anexos.some(a => a?.base64 || a?.arquivoAnexoBase64 || a?.url)) {
      return documento.anexos.slice(0, 4).map((anx, idx) => ({
        id: anx.id || `anx-${idx + 1}`,
        nome: anx.nome || (idx === 0 ? (documento.nome || "Documento_Fiscal.pdf") : `Anexo_${idx + 1}.pdf`),
        base64: anx.base64 || anx.arquivoAnexoBase64 || (idx === 0 ? fallbackBase64 : ""),
        url: anx.url
      }));
    }

    // 2. Anexos vindos da busca remota no servidor
    if (remoteData?.anexos && Array.isArray(remoteData.anexos) && remoteData.anexos.length > 0) {
      return remoteData.anexos.slice(0, 4).map((anx, idx) => ({
        id: anx.id || `anx-${idx + 1}`,
        nome: anx.nome || (idx === 0 ? (remoteData.nome || documento.nome || "Documento_Fiscal.pdf") : `Anexo_${idx + 1}.pdf`),
        base64: anx.base64 || anx.arquivoAnexoBase64 || (idx === 0 ? fallbackBase64 : ""),
        url: anx.url
      }));
    }

    // 3. Anexos presentes em documento (mesmo que vindos do cache sem base64 interno, recebem o fallback)
    if (Array.isArray(documento.anexos) && documento.anexos.length > 0) {
      return documento.anexos.slice(0, 4).map((anx, idx) => ({
        id: anx.id || `anx-${idx + 1}`,
        nome: anx.nome || (idx === 0 ? (documento.nome || "Documento_Fiscal.pdf") : `Anexo_${idx + 1}.pdf`),
        base64: anx.base64 || anx.arquivoAnexoBase64 || (idx === 0 ? fallbackBase64 : ""),
        url: anx.url
      }));
    }

    // 4. Arquivo único de fatura
    if (fallbackBase64) {
      return [{
        id: "anx-1",
        nome: documento.nome || remoteData?.nome || "Documento_Fiscal.pdf",
        base64: fallbackBase64
      }];
    }

    return [];
  }, [documento, remoteData]);

  const [activeAnexoIndex, setActiveAnexoIndex] = useState<number>(0);

  // Reseta ou ajusta o índice quando o documento mudar
  useEffect(() => {
    if (documento?.anexoAtivoIndex !== undefined && documento.anexoAtivoIndex >= 0) {
      setActiveAnexoIndex(documento.anexoAtivoIndex);
    } else {
      setActiveAnexoIndex(0);
    }
  }, [documento]);

  const currentAnexo = anexosList[activeAnexoIndex] || anexosList[0] || null;
  const fileName = currentAnexo?.nome || documento?.nome || remoteData?.nome || "Documento Fiscal.pdf";
  
  // Estados para renderização do PDF via Canvas (PDF.js)
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Fechar no ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Converter Base64/URL e Inicializar visualizador nativo ou PDF.js/Imagem
  useEffect(() => {
    if (!isOpen || !documento) {
      setBlobUrl(null);
      setPdfDoc(null);
      return;
    }

    if (isFetchingRemote) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setZoom(1.0);
    setRotation(0);
    setCurrentPage(1);
    setNumPages(0);
    setPdfDoc(null);

    const rawData = (
      currentAnexo?.base64 || 
      currentAnexo?.arquivoAnexoBase64 || 
      currentAnexo?.content || 
      currentAnexo?.url ||
      remoteData?.arquivoAnexoBase64 || 
      documento.arquivoAnexoBase64 || 
      documento.arquivoAnexoUrl ||
      ""
    )?.trim();

    if (!rawData) {
      setBlobUrl(null);
      // Se não há dados brutos e não está buscando remotamente, libera loading para mostrar opções
      setIsLoading(false);
      return;
    }

    try {
      let isImg = false;
      let rawBytes: Uint8Array | null = null;
      let urlCreated: string | null = null;
      let mime = "application/pdf";

      if (rawData.startsWith("http://") || rawData.startsWith("https://") || rawData.startsWith("blob:")) {
        urlCreated = rawData;
        setBlobUrl(rawData);
        const lower = rawData.toLowerCase();
        isImg = lower.includes(".png") || lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".webp");
      } else {
        // Data URL ou Base64 puro
        let base64Part = rawData;
        if (rawData.startsWith("data:")) {
          const parts = rawData.split(",");
          if (parts.length >= 2) {
            const mimeMatch = parts[0].match(/:(.*?);/);
            if (mimeMatch) mime = mimeMatch[1].toLowerCase();
            base64Part = parts[1];
          }
        }

        // Limpa espaços e formatações
        base64Part = base64Part.replace(/\s/g, "");

        // Decodificar Base64 para binário
        const binaryStr = atob(base64Part);
        const len = binaryStr.length;
        rawBytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          rawBytes[i] = binaryStr.charCodeAt(i);
        }

        // Detecção de tipo por Magic Bytes se necessário
        if (mime === "application/octet-stream" || !mime || mime === "application/pdf") {
          if (len >= 4 && rawBytes[0] === 0x89 && rawBytes[1] === 0x50 && rawBytes[2] === 0x4E && rawBytes[3] === 0x47) {
            mime = "image/png";
          } else if (len >= 3 && rawBytes[0] === 0xFF && rawBytes[1] === 0xD8 && rawBytes[2] === 0xFF) {
            mime = "image/jpeg";
          } else if (len >= 4 && rawBytes[0] === 0x25 && rawBytes[1] === 0x50 && rawBytes[2] === 0x44 && rawBytes[3] === 0x46) {
            mime = "application/pdf";
          }
        }

        if (mime === "application/octet-stream" || !mime) {
          const fName = (fileName || "").toLowerCase();
          if (fName.endsWith(".png")) mime = "image/png";
          else if (fName.endsWith(".jpg") || fName.endsWith(".jpeg")) mime = "image/jpeg";
          else if (fName.endsWith(".webp")) mime = "image/webp";
          else mime = "application/pdf";
        }

        isImg = mime.startsWith("image/") || rawData.startsWith("data:image/");
        const blob = new Blob([rawBytes], { type: mime });
        urlCreated = URL.createObjectURL(blob);
        setBlobUrl(urlCreated);
      }

      if (isImg) {
        setViewMode("image");
        setIsLoading(false);
      } else {
        // PDF: define visualização como PDF (Prioridade 1: Documento Original)
        setViewMode("pdf");
        setIsLoading(false);

        // Se tiver rawBytes e PDF.js estiver disponível, carrega em background para dar suporte a modo Canvas
        if (rawBytes) {
          pdfjsLib.getDocument({ data: rawBytes }).promise.then(doc => {
            setPdfDoc(doc);
            setNumPages(doc.numPages);
            setCurrentPage(1);
          }).catch(err => {
            console.warn("[DocumentoAnexoModal] Aviso Canvas PDF (modo nativo ativo):", err);
            setPdfRenderMode("native");
          });
        }
      }

      return () => {
        if (urlCreated && urlCreated.startsWith("blob:")) {
          URL.revokeObjectURL(urlCreated);
        }
      };
    } catch (err: any) {
      console.warn("Aviso ao processar anexo de documento:", err);
      setLoadError(err?.message || "Erro ao processar arquivo");
      setViewMode("voucher");
      setIsLoading(false);
    }
  }, [isOpen, documento, activeAnexoIndex, currentAnexo, remoteData, isFetchingRemote]);

  // Renderizar a página atual no Canvas quando mudar a página, zoom ou rotação
  useEffect(() => {
    if (!pdfDoc || viewMode !== "pdf" || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        setRenderingPage(true);
        
        // Cancela renderização anterior se ainda estiver rodando
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ 
          scale: zoom, 
          rotation: (page.rotate + rotation) % 360 
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setRenderingPage(false);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Erro ao desenhar página do PDF no canvas:", err);
        }
        setRenderingPage(false);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc, currentPage, zoom, rotation, viewMode]);

  if (!isOpen || !documento) return null;

  const cnpjDisplay = formatCnpjClean(documento.fornecedorCnpj || documento.cnpj);
  const dataEmissaoDisplay = formatBrDate(documento.dataEmissao);
  const dataVencimentoDisplay = formatBrDate(documento.dataVencimento);
  const valorDisplay = formatValorDisplay(documento.valor);
  const statusRaw = documento.status || "Aguardando Aprovação";
  const statusDisplay = statusRaw === "Aguardando aprovação" ? "Aguardando Aprovação" : statusRaw;

  const handleDownload = () => {
    try {
      if (blobUrl) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Erro ao baixar documento:", err);
      if (blobUrl) window.open(blobUrl, "_blank");
    }
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    } else {
      window.print();
    }
  };

  const handlePrint = () => {
    if (viewMode === "pdf" && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`
          <html>
            <head><title>${fileName}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#fff;">
              <img src="${dataUrl}" style="max-width:100%; height:auto;" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        win.document.close();
      } else {
        window.print();
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-900 rounded-3xl border border-slate-750 shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[900px] text-slate-100">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-gradient-to-r from-[#0d3b2b] via-[#114D38] to-[#186047] text-white px-5 py-3 flex items-center justify-between shrink-0 border-b border-emerald-900/50 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 text-emerald-200 shrink-0 shadow-inner">
              <FileText className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold truncate max-w-md text-white tracking-tight">
                  {documento.fornecedor || fileName}
                </h3>
                {documento.doc && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-black text-emerald-200 shrink-0 font-mono">
                    DOC: {documento.doc}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-emerald-100/80 font-medium">
                <span className="font-mono text-[10px] opacity-90 truncate max-w-xs">{fileName}</span>
                {valorDisplay && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-emerald-300">{valorDisplay}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CONTROLES RÁPIDOS & FECHAR */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Alternador de Modo */}
            <div className="bg-black/35 p-1 rounded-xl border border-white/10 flex items-center gap-1 mr-1">
              <button
                onClick={() => setViewMode(blobUrl && !pdfDoc ? "image" : "pdf")}
                disabled={!blobUrl && !isFetchingRemote && anexosList.length === 0}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  viewMode !== "voucher" 
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20" 
                    : "text-emerald-200 hover:text-white hover:bg-white/10"
                )}
                title="Visualizar documento / fatura original anexada"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF / Fatura Original
              </button>
              <button
                onClick={() => setViewMode("voucher")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === "voucher" 
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20" 
                    : "text-emerald-200 hover:text-white hover:bg-white/10"
                )}
                title="Visualizar espelho fiscal digital padronizado"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Espelho Fiscal Digital
              </button>
            </div>

            {/* Atalho Corporativo para o Google Drive de Lançamentos */}
            <a
              href="https://drive.google.com/drive/folders/1jakLnREoQ8W0-lz2aLWA1wXK4oaE_9Jz?hl=pt-br"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-600/60 shadow-sm cursor-pointer"
              title="Abrir Pasta Oficial de Documentos no Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Google Drive</span>
            </a>

            {blobUrl && (
              <button
                onClick={handleOpenInNewTab}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/15 cursor-pointer"
                title="Abrir em nova guia"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Nova Guia</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15 cursor-pointer"
              title="Baixar arquivo"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15 cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-600/80 hover:border-rose-500 flex items-center justify-center text-white transition-all border border-white/15 cursor-pointer ml-1"
              title="Fechar (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BARRA DE SELEÇÃO DE ANEXOS MÚLTIPLOS (ATÉ 4 ARQUIVOS) */}
        {anexosList.length > 1 && (
          <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Anexos ({anexosList.length}/4):
            </span>
            <div className="flex items-center gap-1.5">
              {anexosList.map((anx, idx) => {
                const isCurrent = activeAnexoIndex === idx;
                return (
                  <button
                    key={anx.id || idx}
                    type="button"
                    onClick={() => {
                      setActiveAnexoIndex(idx);
                      setViewMode("pdf");
                    }}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                      isCurrent
                        ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/80"
                    )}
                    title={`Visualizar Anexo ${idx + 1}: ${anx.nome}`}
                  >
                    <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[150px]">{anx.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CORPO DO VISUALIZADOR */}
        <div className="flex-1 overflow-hidden bg-slate-950 flex flex-col relative">
          
          {isFetchingRemote ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-slate-950 p-6 text-center">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-200 font-bold">Carregando PDF original da fatura...</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Recuperando o arquivo binário original do documento fiscal no banco de dados.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-slate-950">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-semibold">Carregando visualizador...</p>
            </div>
          ) : viewMode === "pdf" && blobUrl ? (
            /* VISUALIZAÇÃO DE PDF ORIGINAL - SUPORTE NATIVO ROBUSTO E CANVAS */
            <div className="flex-1 w-full h-full flex flex-col bg-slate-900">
              
              {/* SUBTOOLBAR DO VISUALIZADOR */}
              <div className="bg-slate-850 px-4 py-2 border-b border-slate-750 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Documento Original ({fileName})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pdfDoc && pdfRenderMode === "canvas" && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1 || renderingPage}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
                        title="Página Anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700">
                        {currentPage} / {numPages || 1}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages || renderingPage}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
                        title="Próxima Página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {renderingPage && (
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin ml-1" />
                      )}
                      
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.2).toFixed(1))))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="Diminuir Zoom"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-mono font-bold text-slate-400 w-10 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setZoom(z => Math.min(3.0, Number((z + 0.2).toFixed(1))))}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="Aumentar Zoom"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRotation(r => (r + 90) % 360)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer ml-0.5"
                          title="Girar 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {pdfDoc && (
                    <button
                      onClick={() => setPdfRenderMode(m => m === "native" ? "canvas" : "native")}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
                      title={pdfRenderMode === "native" ? "Mudar para visualizador interativo Canvas" : "Mudar para visualizador nativo de PDF"}
                    >
                      <Layers className="w-3 h-3 text-emerald-400" />
                      {pdfRenderMode === "native" ? "Modo Canvas" : "Modo Nativo"}
                    </button>
                  )}

                  <button
                    onClick={handleOpenInNewTab}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
                    title="Abrir PDF em nova aba em tela cheia"
                  >
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                    Nova Aba
                  </button>

                  <button
                    onClick={handleDownload}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                    title="Baixar arquivo PDF original"
                  >
                    <Download className="w-3 h-3" />
                    Baixar PDF
                  </button>
                </div>
              </div>

              {/* ÁREA DE VISUALIZAÇÃO DO PDF */}
              {pdfRenderMode === "canvas" && pdfDoc ? (
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950 custom-scrollbar">
                  <canvas 
                    ref={canvasRef} 
                    className="rounded-xl shadow-2xl bg-white transition-all duration-150 border border-slate-800"
                    style={{
                      maxWidth: zoom <= 1.0 ? '100%' : 'none',
                      maxHeight: zoom <= 1.0 ? '100%' : 'none',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 w-full h-full p-2 sm:p-4 bg-slate-950 flex flex-col">
                  <iframe
                    src={`${blobUrl}#view=FitH&toolbar=1`}
                    className="w-full h-full border border-slate-800 rounded-2xl bg-white shadow-2xl"
                    title={fileName}
                  />
                </div>
              )}

            </div>
          ) : viewMode === "pdf" && !blobUrl ? (
            /* AVISO QUANDO NÃO HÁ ARQUIVO ANEXO CADASTRADO */
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
                <FileText className="w-8 h-8 text-slate-500" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h4 className="text-base font-bold text-slate-200">Nenhum arquivo PDF de fatura anexado</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Este lançamento não possui um arquivo PDF ou imagem anexado diretamente. Você pode visualizar o Espelho Fiscal Digital padronizado com todos os dados cadastrais da fatura.
                </p>
              </div>
              <button
                onClick={() => setViewMode("voucher")}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Visualizar Espelho Fiscal Digital
              </button>
            </div>
          ) : viewMode === "image" && blobUrl ? (
            /* VISUALIZAÇÃO DE IMAGEM */
            <div className="flex-1 flex flex-col w-full h-full bg-slate-900">
              <div className="bg-slate-850 px-4 py-2 border-b border-slate-750 flex items-center justify-end text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-slate-400 w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer ml-1"
                    title="Girar 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
                <img
                  src={blobUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain transition-transform duration-200 rounded-xl shadow-2xl border border-slate-800"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: "center center"
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          ) : (
            /* MODO ESPELHO FISCAL DIGITAL COMPLETO COM DADOS REAIS */
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-950 custom-scrollbar">
              <div className="w-full max-w-3xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
                
                {/* TOPO DO COMPROVANTE OFICIAL */}
                <div className="bg-[#114D38] p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-4 border-[#0b3325]">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-emerald-300" />
                      <h2 className="text-lg font-black tracking-tight font-display">RISEL COMBUSTÍVEIS LTDA</h2>
                    </div>
                    <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider mt-0.5">
                      Espelho Fiscal Digital de Lançamento
                    </p>
                  </div>
                  <div className="sm:text-right bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                    <span className="text-[10px] text-emerald-200 uppercase font-black block">Documento de Registro</span>
                    <span className="text-sm font-black font-mono text-white">Nº {documento.doc || "S/N"}</span>
                  </div>
                </div>

                {/* CONTEÚDO PRINCIPAL DO ESPELHO FISCAL */}
                <div className="p-6 sm:p-8 space-y-6">
                  
                  {/* STATUS & FORNECEDOR & VALOR DESTAQUE */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Status do Lançamento:</span>
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md border",
                          statusDisplay === 'Aprovado' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                          (statusDisplay === 'Aguardando Aprovação' || statusDisplay === 'Aguardando aprovação') ? "bg-amber-50 border-amber-200 text-amber-700" :
                          statusDisplay === 'Programado' ? "bg-sky-50 border-sky-200 text-sky-700" :
                          statusDisplay === 'Pago' ? "bg-blue-50 border-blue-200 text-blue-700" :
                          "bg-slate-100 border-slate-200 text-slate-700"
                        )}>
                          {statusDisplay}
                        </span>
                      </div>
                      {documento.frequencia && (
                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">
                          Tipo: {documento.frequencia}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="md:col-span-2 space-y-1">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Razão Social / Fornecedor</span>
                        <h3 className="text-base font-black text-slate-800">{documento.fornecedor || "Não informado"}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono font-bold mt-1">
                          <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px]">CNPJ: {cnpjDisplay}</span>
                          {documento.tipo && (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                              {documento.tipo}
                            </span>
                          )}
                          {documento.itemSistema && (
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                              Item: {documento.itemSistema}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center items-start md:items-end">
                        <span className="text-[10px] font-black uppercase text-emerald-800 block">Valor Total Registrado</span>
                        <span className="text-xl font-black text-emerald-700 font-mono tracking-tight mt-0.5">
                          {valorDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GRID DE DETALHES OPERACIONAIS REAIS */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-[#114D38]" /> Data de Emissão
                      </span>
                      <span className="font-bold text-slate-800 font-mono text-sm block mt-1">
                        {dataEmissaoDisplay}
                      </span>
                    </div>

                    <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-150">
                      <span className="text-[9px] font-extrabold uppercase text-rose-500 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-rose-600" /> Data de Vencimento
                      </span>
                      <span className="font-black text-rose-700 font-mono text-sm block mt-1">
                        {dataVencimentoDisplay}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-[#114D38]" /> Estabelecimento / Filial
                      </span>
                      <span className="font-bold text-slate-800 text-sm block mt-1 truncate" title={documento.estabelecimento || "Não informado"}>
                        {documento.estabelecimento || "Não informado"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-emerald-600" /> Centro de Custo
                      </span>
                      <span className="font-bold text-slate-800 text-sm block mt-1 truncate" title={documento.centroCusto || "Não informado"}>
                        {documento.centroCusto || "Não informado"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3 text-blue-600" /> Forma de Pagamento
                      </span>
                      <span className="font-bold text-slate-800 text-sm block mt-1 truncate uppercase">
                        {documento.formaPagto || "Não informada"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                        <UserCheck className="w-3 h-3 text-purple-600" /> Aprovador Responsável
                      </span>
                      <span className="font-bold text-slate-800 text-sm block mt-1 truncate" title={documento.aprovadores || "Não informado"}>
                        {documento.aprovadores || "Não informado"}
                      </span>
                    </div>

                    {documento.lancadoPor && (
                      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150 col-span-2 sm:col-span-1">
                        <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-600" /> Lançado Por
                        </span>
                        <span className="font-bold text-slate-800 text-sm block mt-1 truncate">
                          {documento.lancadoPor}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* DESCRIÇÃO DOS SERVIÇOS / PRODUTOS */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Descrição dos Serviços / Produtos</span>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                      {documento.descricao || "Sem observações adicionais descritas no lançamento."}
                    </p>
                  </div>

                  {/* OBSERVAÇÕES ADICIONAIS DO LANÇAMENTO (SE HOUVER) */}
                  {documento.observacao && (
                    <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                        <FileCheck className="w-3 h-3" /> Observações Internas do Registro
                      </span>
                      <p className="text-xs text-amber-900 leading-relaxed font-medium whitespace-pre-wrap font-mono">
                        {documento.observacao}
                      </p>
                    </div>
                  )}

                  {/* AVISO DO DOCUMENTO DIGITAL */}
                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Comprovante de Lançamento Autenticado no ERP</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Dados fiscais consolidados conforme registro interno Risel Combustíveis Ltda.
                      </p>
                    </div>
                  </div>

                </div>

                {/* RODAPÉ DO LAUDO */}
                <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-mono">
                  <span>Arquivo: {fileName}</span>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir Espelho
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* FOOTER INFERIOR */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-3 flex justify-end items-center gap-2 shrink-0 text-xs">
          {blobUrl && (
            <button
              onClick={handleOpenInNewTab}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir em Nova Aba
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Arquivo
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

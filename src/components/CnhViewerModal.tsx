import React, { useState, useEffect } from "react";
import { 
  FileText, 
  X, 
  Download, 
  ExternalLink, 
  FolderOpen, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Eye, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from "lucide-react";

export const CNH_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1tIJ67ADpN6blterYogPq9SObDVHr3xsk?usp=sharing";

interface CnhViewerModalProps {
  rawUrl: string;
  nome?: string;
  condutor?: string;
  placa?: string;
  onClose: () => void;
}

export const CnhViewerModal: React.FC<CnhViewerModalProps> = ({
  rawUrl,
  nome = "CNH_Condutor",
  condutor = "Condutor",
  placa = "",
  onClose
}) => {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("application/pdf");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const convertBase64ToBlobUrl = (inputB64: string, fallbackName: string): { url: string; mime: string } | null => {
      try {
        let base64Pure = inputB64.trim();
        let detectedMime = "application/pdf";

        if (base64Pure.startsWith("data:")) {
          const commaIdx = base64Pure.indexOf(",");
          if (commaIdx !== -1) {
            const header = base64Pure.slice(0, commaIdx);
            base64Pure = base64Pure.slice(commaIdx + 1);
            const matchMime = header.match(/data:([^;]+)/);
            if (matchMime) detectedMime = matchMime[1];
          }
        }

        if (fallbackName.toLowerCase().endsWith(".pdf")) detectedMime = "application/pdf";
        else if (fallbackName.toLowerCase().endsWith(".jpg") || fallbackName.toLowerCase().endsWith(".jpeg")) detectedMime = "image/jpeg";
        else if (fallbackName.toLowerCase().endsWith(".png")) detectedMime = "image/png";

        const cleanBase64 = base64Pure.replace(/\s+/g, "");
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Magic bytes detection
        if (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
          detectedMime = "application/pdf";
        } else if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          detectedMime = "image/jpeg";
        } else if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
          detectedMime = "image/png";
        }

        const blob = new Blob([bytes], { type: detectedMime });
        return { url: URL.createObjectURL(blob), mime: detectedMime };
      } catch (_) {
        return null;
      }
    };

    const processUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const trimmed = (rawUrl || "").trim();
        const isDriveFolderUrl = trimmed.includes("drive.google.com/drive/folders");
        const isDirectDriveFileUrl = trimmed.includes("drive.google.com/file/d/");

        // 1. Caso seja Data URI base64 direta
        if (trimmed.startsWith("data:")) {
          const conv = convertBase64ToBlobUrl(trimmed, nome);
          if (conv && active) {
            createdUrl = conv.url;
            setMimeType(conv.mime);
            setBlobUrl(conv.url);
            setLoading(false);
            return;
          }
        }

        // 2. Caso seja link direto de um arquivo individual no Google Drive (/file/d/ID)
        if (isDirectDriveFileUrl) {
          const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (matchD && active) {
            setMimeType("application/pdf");
            setBlobUrl(`https://drive.google.com/file/d/${matchD[1]}/preview`);
            setLoading(false);
            return;
          }
        }

        // 3. Caso seja uma rota da API (/api/cnh/... ou /api/rac/cnh/...)
        if (trimmed.startsWith("/api/") && !isDriveFolderUrl) {
          try {
            const sep = trimmed.includes("?") ? "&" : "?";
            const resp = await fetch(`${trimmed}${sep}json=true`);
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.base64) {
                const conv = convertBase64ToBlobUrl(data.base64, data.nomeArquivo || nome);
                if (conv && active) {
                  createdUrl = conv.url;
                  setMimeType(conv.mime);
                  setBlobUrl(conv.url);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (e) {
            console.warn("Aviso ao consultar rota direta de CNH, tentando resolução unificada:", e);
          }
        }

        // 4. Resolução inteligente via /api/cnh/resolve (por placa, condutor e nome do arquivo)
        try {
          const queryParams = new URLSearchParams({
            placa: placa || "",
            condutor: condutor || "",
            nome: nome || "",
            json: "true"
          });
          const resolveResp = await fetch(`/api/cnh/resolve?${queryParams.toString()}`);
          if (resolveResp.ok) {
            const resolveData = await resolveResp.json();
            if (resolveData && resolveData.base64) {
              const conv = convertBase64ToBlobUrl(resolveData.base64, resolveData.nomeArquivo || nome);
              if (conv && active) {
                createdUrl = conv.url;
                setMimeType(conv.mime);
                setBlobUrl(conv.url);
                setLoading(false);
                return;
              }
            }
          }
        } catch (_) {}

        // 5. Tenta localizar no cofre local (localStorage) de CNHs ou na Frota Leve local
        try {
          const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const targetCond = norm(condutor);
          const targetPlaca = (placa || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

          const rawFrota = localStorage.getItem("risel_frota_veiculos_v2");
          if (rawFrota) {
            const list = JSON.parse(rawFrota);
            if (Array.isArray(list)) {
              const vMatch = list.find((v: any) => {
                const p = String(v.placa || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                return (targetPlaca && p === targetPlaca) || (targetCond && norm(v.condutor) === targetCond);
              });
              if (vMatch?.cnhAnexoBase64 && vMatch.cnhAnexoBase64.startsWith("data:")) {
                const conv = convertBase64ToBlobUrl(vMatch.cnhAnexoBase64, vMatch.cnhNomeArquivo || nome);
                if (conv && active) {
                  createdUrl = conv.url;
                  setMimeType(conv.mime);
                  setBlobUrl(conv.url);
                  setLoading(false);
                  return;
                }
              }
            }
          }

          const rawVault = localStorage.getItem("risel_driver_cnh_vault");
          if (rawVault) {
            const vault = JSON.parse(rawVault);
            const rec: any = Object.values(vault).find((r: any) => targetCond && norm(r?.driverName) === targetCond && r?.cnhData?.startsWith("data:"));
            if (rec?.cnhData) {
              const conv = convertBase64ToBlobUrl(rec.cnhData, rec.fileName || nome);
              if (conv && active) {
                createdUrl = conv.url;
                setMimeType(conv.mime);
                setBlobUrl(conv.url);
                setLoading(false);
                return;
              }
            }
          }
        } catch (_) {}

        // 6. Última tentativa: se trimmed for base64 puro sem prefixo data:
        if (trimmed && !trimmed.startsWith("http") && !trimmed.startsWith("/api/") && trimmed.length > 100) {
          const conv = convertBase64ToBlobUrl(trimmed, nome);
          if (conv && active) {
            createdUrl = conv.url;
            setMimeType(conv.mime);
            setBlobUrl(conv.url);
            setLoading(false);
            return;
          }
        }

        if (active) {
          setError("A cópia digital desta CNH ainda não foi anexada ou está disponível apenas na pasta do Google Drive.");
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Erro ao carregar o documento da CNH.");
          setLoading(false);
        }
      }
    };

    processUrl();

    return () => {
      active = false;
      if (createdUrl && createdUrl.startsWith("blob:")) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [rawUrl, nome, condutor, placa]);

  const isPdf = mimeType.includes("pdf") || (nome || "").toLowerCase().endsWith(".pdf");

  const handleDownload = () => {
    if (!blobUrl) return;
    const cleanExt = isPdf ? ".pdf" : (mimeType.includes("png") ? ".png" : ".jpg");
    let safeName = nome || `CNH_${condutor}_${placa}${cleanExt}`;
    if (!safeName.toLowerCase().endsWith(cleanExt)) safeName += cleanExt;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenDriveFolder = () => {
    window.open(CNH_DRIVE_FOLDER_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden w-full max-w-4xl max-h-[92vh] flex flex-col">
        
        {/* Header Superior */}
        <div className="bg-[#114D38] px-5 py-3.5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm sm:text-base text-white truncate max-w-lg">
                {nome || `CNH - ${condutor}`}
              </h3>
              <p className="text-[11px] text-emerald-200/90 truncate flex items-center gap-2">
                <span>Condutor: <strong className="text-white">{condutor}</strong></span>
                {placa && (
                  <>
                    <span className="text-emerald-400">•</span>
                    <span>Placa: <strong className="font-mono text-white">{placa}</strong></span>
                  </>
                )}
                <span className="text-emerald-400">•</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono text-[10px]">
                  {isPdf ? "PDF NATIVO" : "IMAGEM"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenDriveFolder}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Abrir pasta oficial de CNHs no Google Drive"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-300" /> Pasta Drive
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-white/10 rounded-xl text-emerald-100 hover:text-white cursor-pointer transition-colors"
              title="Fechar visualizador"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Barra de Ferramentas / Controles de Visualização */}
        <div className="bg-slate-50 px-5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sincronizado Google Drive
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isPdf && (
              <>
                <button
                  onClick={() => setZoom(prev => Math.max(prev - 25, 50))}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-500 px-1">{zoom}%</span>
                <button
                  onClick={() => setZoom(prev => Math.min(prev + 25, 300))}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold cursor-pointer ml-1"
                  title="Girar Imagem"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={handleOpenNewTab}
              disabled={!blobUrl}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              title="Abrir em Nova Aba do Navegador"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Nova Aba
            </button>
            <button
              onClick={handleDownload}
              disabled={!blobUrl}
              className="px-3 py-1.5 bg-[#114D38] hover:bg-[#1a664c] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
              title="Baixar CNH"
            >
              <Download className="w-3.5 h-3.5" /> Baixar
            </button>
          </div>
        </div>

        {/* Área Central de Visualização */}
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 min-h-[420px] relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#114D38]" />
              <p className="text-xs font-medium">Carregando cópia da CNH em alta resolução...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center max-w-md bg-white rounded-2xl shadow-sm border border-slate-200">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <h4 className="font-bold text-slate-800 text-sm">Visualização Indisponível</h4>
              <p className="text-xs text-slate-500">{error}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleOpenDriveFolder}
                  className="px-4 py-2 bg-[#114D38] hover:bg-[#1a664c] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Ver na Pasta do Drive
                </button>
              </div>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex flex-col items-center justify-center min-h-[460px]">
              <object
                data={blobUrl}
                type="application/pdf"
                className="w-full h-[520px] rounded-2xl border border-slate-300 shadow-sm bg-white"
              >
                {/* Fallback caso o navegador bloqueie tag object em sandboxes */}
                <iframe
                  src={blobUrl}
                  className="w-full h-[520px] rounded-2xl border border-slate-300 shadow-sm bg-white"
                  title="Cópia da CNH (PDF)"
                >
                  <div className="p-8 text-center bg-white rounded-2xl shadow-sm">
                    <p className="text-sm font-bold text-slate-800 mb-2">Documento PDF Pronto para Visualização</p>
                    <p className="text-xs text-slate-500 mb-4">Seu navegador requer a abertura em tela cheia.</p>
                    <button
                      onClick={handleOpenNewTab}
                      className="px-4 py-2 bg-[#114D38] text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <Eye className="w-4 h-4" /> Abrir PDF Completo
                    </button>
                  </div>
                </iframe>
              </object>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={blobUrl}
                alt={`CNH de ${condutor}`}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: "transform 0.15s ease-out"
                }}
                className="max-h-[500px] w-auto max-w-full object-contain rounded-2xl shadow-md border border-slate-300 bg-white"
              />
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Pasta Google Drive Oficial:</span>
            <a 
              href={CNH_DRIVE_FOLDER_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#114D38] font-bold hover:underline flex items-center gap-1 font-mono text-[10px]"
            >
              1tIJ67ADpN6blterYogPq9SObDVHr3xsk <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenDriveFolder}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#114D38] border border-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-700" /> Abrir Pasta no Drive
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

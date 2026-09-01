import { useState, useMemo } from "react";
import { 
  Search, Filter, ChevronDown, ChevronUp, Table, Kanban, Eye, 
  CheckCircle, AlertTriangle, Clock, Columns, FileText, ExternalLink, 
  User, Calendar, Gauge, MapPin, Download, AlertOctagon, CornerDownRight, Check,
  Trash2, ChevronRight, ChevronLeft, Image as ImageIcon
} from "lucide-react";

// Função utilitária robusta para converter formatos de data e carimbo de data/hora brasileiros ou ISO para milissegundos comparáveis
function parseDateToComparable(val: string): number {
  if (!val) return 0;
  try {
    const clean = val.replace(",", "").trim();
    if (clean.includes("/")) {
      const parts = clean.split(" ");
      const datePart = parts[0];
      const timePart = parts[1] || "00:00:00";
      const [d, m, y] = datePart.split("/");
      const [hr, min, sec] = timePart.split(":");
      const isoStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hr.padStart(2, "0")}:${min.padStart(2, "0")}:${sec ? sec.padStart(2, "0") : "00"}`;
      const t = new Date(isoStr).getTime();
      return isNaN(t) ? 0 : t;
    }
    if (clean.includes("-")) {
      const parts = clean.replace("T", " ").split(" ");
      const datePart = parts[0];
      const timePart = parts[1] || "12:00:00";
      const [y, m, d] = datePart.split("-");
      const [hr, min, sec] = timePart.split(":");
      const isoStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hr.padStart(2, "0")}:${min.padStart(2, "0")}:${sec ? sec.padStart(2, "0") : "00"}`;
      const t = new Date(isoStr).getTime();
      return isNaN(t) ? 0 : t;
    }
    const t = new Date(clean).getTime();
    return isNaN(t) ? 0 : t;
  } catch (e) {
    return 0;
  }
}

function formatDateRobustly(dataStr: string, timestampStr?: string): string {
  const val = timestampStr || dataStr || "";
  if (!val) return "N/D";
  const time = parseDateToComparable(val);
  if (time > 0) {
    const d = new Date(time);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hrs = d.getHours();
    const mins = d.getMinutes();
    if (timestampStr && (hrs !== 0 || mins !== 0)) {
      const hrStr = String(hrs).padStart(2, "0");
      const minStr = String(mins).padStart(2, "0");
      return `${day}/${month}/${year} ${hrStr}:${minStr}`;
    }
    return `${day}/${month}/${year}`;
  }
  return val;
}

function getDirectImageUrl(url: string | undefined): string {
  if (!url) return "";
  const firstUrl = url.split(",")[0].trim();
  if (firstUrl.startsWith("data:") || firstUrl.startsWith("/") || firstUrl.startsWith("blob:")) {
    return firstUrl;
  }
  const idMatch = firstUrl.match(/id=([a-zA-Z0-9_-]+)/) || firstUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return firstUrl;
}

export function generateLocalPDF(c: any) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita popups para gerar o PDF.");
    return;
  }

  const formatarData = (dStr: string) => {
    if (!dStr) return "";
    const parts = dStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const getImg = (url: string | undefined) => {
    if (!url) return "";
    return getDirectImageUrl(url);
  };

  const obsDianteira = c.obsDianteira || "Ok";
  const obsTraseira = c.obsTraseira || "Ok";
  const obsMotorista = c.obsMotorista || "Ok";
  const obsPassageiro = c.obsPassageiro || "Ok";

  const checklistItems = c.listaItens && c.listaItens.length > 0
    ? c.listaItens.join(", ")
    : "CRLV, TAG PEDÁGIOS, CARTÃO ABASTECIMENTO, CHAVE RESERVA, SOM, MANUAL, TAPETE, TRIÂNGULO, MACACO, CHAVE DE RODA, EXTINTOR";

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Checklist Frota Leve - ${c.placa}</title>
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #2D3748; font-size: 11px; background-color: #FFFFFF; }
      
      /* Divisores de Seções */
      .section-title { 
        background-color: #F1F5F9; 
        color: #005C30; 
        padding: 10px 14px; 
        font-weight: bold; 
        font-size: 12px; 
        margin-top: 15px; 
        border-left: 4px solid #F47920; 
        border-radius: 0 4px 4px 0;
        text-transform: uppercase; 
      }
      
      /* Tabelas Gerais */
      table { 
        width: 100%; 
        border-collapse: separate; 
        border-spacing: 0; 
        margin-top: 6px; 
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        overflow: hidden;
      }
      th, td { 
        padding: 12px 14px; 
        text-align: left; 
        vertical-align: middle; 
        border-bottom: 1px solid #E2E8F0;
        border-right: 1px solid #E2E8F0;
        line-height: 1.5;
      }
      tr:last-child th, tr:last-child td { border-bottom: none; }
      th:last-child, td:last-child { border-right: none; }
      
      th { 
        background-color: #F8FAFC; 
        color: #4A5568; 
        font-weight: 600; 
        width: 25%; 
        font-size: 9.5px; 
        text-transform: uppercase; 
      }
      td { font-size: 11px; font-weight: bold; color: #1A202C; background-color: #FFFFFF; }
      
      .item-icon {
        display: inline-block;
        width: 8px;
        height: 8px;
        background-color: #005C30; 
        border-radius: 2px;
        margin-right: 8px;
        vertical-align: middle;
      }

      /* Grid 2x2 para Fotos Maximizadas */
      .photo-grid { width: 100%; border-collapse: separate; border-spacing: 12px; margin-top: 10px; border: none; }
      .photo-grid td { width: 50%; border: none; padding: 0; background: none; }
      .photo-card { border: 1px solid #E2E8F0; padding: 8px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .photo-card img { 
        width: 100%; 
        height: 250px; 
        border-radius: 6px; 
        object-fit: cover; 
        display: block;
      }
      .photo-title { font-size: 9.5px; color: #4A5568; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; text-align: center; }

      /* Cards do Interior Ampliados */
      .interior-photo-card { border: 1px solid #E2E8F0; padding: 10px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .interior-photo-card img { 
        width: 100%; 
        height: 380px; 
        border-radius: 6px; 
        object-fit: cover; 
        display: block;
      }

      @media print {
        body { padding: 0; }
        .no-print { display: none; }
        .page-break { page-break-before: always; }
      }
    </style>
  </head>
  <body>
    <!-- HEADER -->
    <table style="width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 15px; background: linear-gradient(135deg, #005C30 0%, #00361C 100%) !important; border-bottom: 5px solid #F47920 !important; border-radius: 6px 6px 0 0;">
      <tr style="background: none !important;">
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: left; width: 30%;">
          <div style="background: #FFFFFF; padding: 6px 12px; border-radius: 6px; display: inline-block;">
            <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" style="height: 35px; display: block;" alt="Logo Risel" referrerpolicy="no-referrer" />
          </div>
        </td>
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: right; width: 70%;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF !important; letter-spacing: 1px;">CHECKLIST FROTA LEVE</h1>
        </td>
      </tr>
    </table>

    <div class="section-title">📋 Dados Gerais do Checklist</div>
    <table>
      <tr>
        <th>📅 DATA DO REGISTRO</th><td>${formatarData(c.data)}</td>
        <th>📋 TIPO DE CHECKLIST</th><td>${c.tipo || "MENSAL"}</td>
      </tr>
      <tr>
        <th>🏢 BASE OPERACIONAL</th><td>${c.base || "PAULÍNIA"}</td>
        <th>🚗 PLACA DO VEÍCULO</th><td>${c.placa}</td>
      </tr>
      <tr>
        <th>🚘 MARCA / MODELO</th><td>${c.marcaModelo || c.modelo || "-"}</td>
        <th>🎨 COR DO VEÍCULO</th><td>${c.cor || "-"}</td>
      </tr>
      <tr>
        <th>⛽ NÍVEL DO TANQUE</th><td>${c.nivelTanque || "CHEIO"}</td>
        <th>🛣️ KM ATUAL</th><td>${c.odometro?.toLocaleString("pt-BR") || "0"}</td>
      </tr>
    </table>

    <div class="section-title">🛠️ Componentes e Pneus</div>
    <table>
      <tr>
        <th style="width: 25%;"><span class="item-icon"></span>ITENS INTEGRADOS</th>
        <td colspan="3" style="font-weight: normal; color: #2D3748; line-height: 1.4;">${checklistItems}</td>
      </tr>
    </table>

    <div style="margin-top: 15px; font-weight: bold; color: #005C30; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">🛞 Conservação Física dos Pneus</div>
    <table>
      <tr>
        <th>DIANTEIRO DIREITO</th><td>${c.pneuDianteiroDireito || "BOM"}</td>
        <th>DIANTEIRO ESQUERDO</th><td>${c.pneuDianteiroEsquerdo || "BOM"}</td>
      </tr>
      <tr>
        <th>TRASEIRO DIREITO</th><td>${c.pneuTraseiroDireito || "BOM"}</td>
        <th>TRASEIRO ESQUERDO</th><td>${c.pneuTraseiroEsquerdo || "BOM"}</td>
      </tr>
      <tr>
        <th>ESTEPE AUXILIAR</th><td colspan="3">${c.pneuEstepe || "BOM"}</td>
      </tr>
    </table>

    <div class="section-title">⚠️ Avarias e Observações</div>
    <table style="width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; margin-top: 6px;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 9px; color: #005C30; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">⚠️ Dianteira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 30px; line-height: 1.4;">${obsDianteira}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-bottom: 1px solid #E2E8F0;">
          <div style="font-size: 9px; color: #005C30; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">⚠️ Traseira</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 30px; line-height: 1.4;">${obsTraseira}</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; vertical-align: top; padding: 12px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 9px; color: #005C30; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">⚠️ Lado Motorista</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 30px; line-height: 1.4;">${obsMotorista}</div>
        </td>
        <td style="width: 50%; vertical-align: top; padding: 12px;">
          <div style="font-size: 9px; color: #005C30; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">⚠️ Lado Passageiro</div>
          <div style="font-size: 11px; color: #1A202C; font-weight: bold; min-height: 30px; line-height: 1.4;">${obsPassageiro}</div>
        </td>
      </tr>
    </table>

    <!-- FOTOS PARTE 1 -->
    <div class="page-break"></div>
    <table style="width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 15px; background: linear-gradient(135deg, #005C30 0%, #00361C 100%) !important; border-bottom: 5px solid #F47920 !important;">
      <tr style="background: none !important;">
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: left; width: 30%;">
          <div style="background: #FFFFFF; padding: 6px 12px; border-radius: 6px; display: inline-block;">
            <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" style="height: 35px; display: block;" alt="Logo Risel" referrerpolicy="no-referrer" />
          </div>
        </td>
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: right; width: 70%;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF !important;">REGISTRO FOTOGRÁFICO - PARTE 1</h1>
        </td>
      </tr>
    </table>

    <table class="photo-grid">
      <tr>
        <td>
          <div class="photo-card">
            <div class="photo-title">Frente</div>
            ${c.fotoFrente ? '<img src="' + getImg(c.fotoFrente) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
        <td>
          <div class="photo-card">
            <div class="photo-title">Traseira</div>
            ${c.fotoTraseira ? '<img src="' + getImg(c.fotoTraseira) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="photo-card">
            <div class="photo-title">Lado Motorista</div>
            ${c.fotoMotorista ? '<img src="' + getImg(c.fotoMotorista) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
        <td>
          <div class="photo-card">
            <div class="photo-title">Lado Passageiro</div>
            ${c.fotoPassageiro ? '<img src="' + getImg(c.fotoPassageiro) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
      </tr>
    </table>

    <!-- FOTOS PARTE 2 -->
    <div class="page-break"></div>
    <table style="width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 15px; background: linear-gradient(135deg, #005C30 0%, #00361C 100%) !important; border-bottom: 5px solid #F47920 !important;">
      <tr style="background: none !important;">
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: left; width: 30%;">
          <div style="background: #FFFFFF; padding: 6px 12px; border-radius: 6px; display: inline-block;">
            <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" style="height: 35px; display: block;" alt="Logo Risel" referrerpolicy="no-referrer" />
          </div>
        </td>
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: right; width: 70%;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF !important;">REGISTRO FOTOGRÁFICO - PARTE 2</h1>
        </td>
      </tr>
    </table>

    <table class="photo-grid">
      <tr>
        <td>
          <div class="photo-card">
            <div class="photo-title">Retrovisor Motorista</div>
            ${c.fotoRetrovisorMotorista ? '<img src="' + getImg(c.fotoRetrovisorMotorista) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
        <td>
          <div class="photo-card">
            <div class="photo-title">Retrovisor Passageiro</div>
            ${c.fotoRetrovisorPassageiro ? '<img src="' + getImg(c.fotoRetrovisorPassageiro) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="photo-card">
            <div class="photo-title">Faróis Dianteiros</div>
            ${c.fotoFaroisDianteiros ? '<img src="' + getImg(c.fotoFaroisDianteiros) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
        <td>
          <div class="photo-card">
            <div class="photo-title">Lanternas Traseiras</div>
            ${c.fotoFaroisTraseiros ? '<img src="' + getImg(c.fotoFaroisTraseiros) + '" referrerpolicy="no-referrer" />' : '<p style="color:#A0AEC0; text-align:center; padding: 80px 0;">Sem foto</p>'}
          </div>
        </td>
      </tr>
    </table>

    <!-- FOTOS INTERIOR & RESPONSÁVEIS -->
    <div class="page-break"></div>
    <table style="width: 100%; border-collapse: collapse; border: none !important; margin-bottom: 15px; background: linear-gradient(135deg, #005C30 0%, #00361C 100%) !important; border-bottom: 5px solid #F47920 !important;">
      <tr style="background: none !important;">
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: left; width: 30%;">
          <div style="background: #FFFFFF; padding: 6px 12px; border-radius: 6px; display: inline-block;">
            <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" style="height: 35px; display: block;" alt="Logo Risel" referrerpolicy="no-referrer" />
          </div>
        </td>
        <td style="border: none !important; padding: 15px 20px !important; background: none !important; vertical-align: middle !important; text-align: right; width: 70%;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #FFFFFF !important;">FOTOS DO INTERIOR & RESPONSÁVEIS</h1>
        </td>
      </tr>
    </table>

    <div class="section-title">📸 Registro Fotográfico do Interior</div>
    <div style="margin-top: 10px;">
      ${c.fotosInterior ? '<div class="interior-photo-card"><img src="' + getImg(c.fotosInterior) + '" referrerpolicy="no-referrer" /></div>' : '<p style="color:#A0AEC0; padding: 15px 0;">Nenhuma foto do interior enviada.</p>'}
    </div>

    <div class="section-title" style="margin-top: 30px;">👥 Responsáveis pelo Registro</div>
    <table style="width: 100%; border-collapse: separate; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-top: 12px;">
      <tr>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; background-color: #F8FAFC !important;">📤 ENTREGUE POR</th>
        <th style="width: 50%; padding: 15px; text-align: center; color: #4A5568; font-size: 10px; font-weight: bold; background-color: #F8FAFC !important;">📥 RECEBIDO POR</th>
      </tr>
      <tr>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; background-color: #FFFFFF !important;">
          ${c.entreguePor || c.condutor || "Não Informado"}
        </td>
        <td style="padding: 22px; text-align: center; font-size: 13px; color: #1A202C; font-weight: bold; background-color: #FFFFFF !important;">
          ${c.recebidoPor || "Não Informado"}
        </td>
      </tr>
    </table>

    <script>
      function printWhenLoaded() {
        const images = document.getElementsByTagName('img');
        let loadedCount = 0;
        const totalImages = images.length;
        
        if (totalImages === 0) {
          window.print();
          return;
        }

        function onImageLoad() {
          loadedCount++;
          if (loadedCount === totalImages) {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        }

        for (let i = 0; i < totalImages; i++) {
          if (images[i].complete) {
            onImageLoad();
          } else {
            images[i].addEventListener('load', onImageLoad);
            images[i].addEventListener('error', onImageLoad);
          }
        }
      }
      
      window.onload = printWhenLoaded;
    </script>
  </body>
  </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

interface Checklist {
  id: string;
  placa: string;
  condutor: string;
  data: string;
  odometro: number;
  itens: {
    pneus: "OK" | "Atenção" | "Crítico";
    freios: "OK" | "Atenção" | "Crítico";
    farois: "OK" | "Atenção" | "Crítico";
    seguranca: "OK" | "Atenção" | "Crítico";
    fluidos: "OK" | "Atenção" | "Crítico";
    lataria: "OK" | "Atenção" | "Crítico";
  };
  observacoes: string;
  status: "Aprovado" | "Ressalvas" | "Retido";
  
  // Rich details from Google Sheets
  timestamp?: string;
  email?: string;
  tipo?: string;
  base?: string;
  marcaModelo?: string;
  cor?: string;
  nivelTanque?: string;
  listaItens?: string[];
  pneuDianteiroDireito?: string;
  pneuDianteiroEsquerdo?: string;
  pneuTraseiroDireito?: string;
  pneuTraseiroEsquerdo?: string;
  pneuEstepe?: string;
  obsDianteira?: string;
  fotoFrente?: string;
  obsMotorista?: string;
  fotoMotorista?: string;
  obsPassageiro?: string;
  fotoPassageiro?: string;
  obsTraseira?: string;
  fotoTraseira?: string;
  entreguePor?: string;
  recebidoPor?: string;
  fotosInterior?: string;
  fotoRetrovisorMotorista?: string;
  fotoRetrovisorPassageiro?: string;
  fotoFaroisTraseiros?: string;
  fotoFaroisDianteiros?: string;
  mergedDocUrl?: string;
  isGoogleSheet?: boolean;
}

interface ChecklistRealizadosProps {
  checklists: Checklist[];
  onDeleteChecklist?: (id: string) => Promise<void> | void;
}

export function ChecklistRealizados({ checklists, onDeleteChecklist }: ChecklistRealizadosProps) {
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<Checklist | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters State
  const [filterMonthYear, setFilterMonthYear] = useState("");
  const [filterBase, setFilterBase] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterMotorista, setFilterMotorista] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>("data");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // Column Selector State (Sem coluna de status pois o parâmetro não existe)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    timestamp: false,
    email: false,
    data: true,
    placa: true,
    modelo: true,
    cor: false,
    condutor: true,
    tipo: true,
    base: true,
    odometro: true,
    tanque: true,
    pneuDianteiroDireito: false,
    pneuDianteiroEsquerdo: false,
    pneuTraseiroDireito: false,
    pneuTraseiroEsquerdo: false,
    pneuEstepe: false,
    obsDianteira: false,
    obsMotorista: false,
    obsPassageiro: false,
    obsTraseira: false,
    entreguePor: false,
    recebidoPor: false,
    mergedDoc: true
  });

  // Unique lists for dropdown filters
  const monthYearOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => {
      if (c.data && c.data.length >= 7) {
        const [year, month] = c.data.split("-");
        opts.add(`${month}/${year}`);
      }
    });
    return Array.from(opts).sort((a, b) => {
      const [mA, yA] = a.split("/");
      const [mB, yB] = b.split("/");
      return `${yB}-${mB}`.localeCompare(`${yA}-${mA}`);
    });
  }, [checklists]);

  const baseOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.base) opts.add(c.base.toUpperCase().trim()); });
    return Array.from(opts).filter(b => b !== "").sort();
  }, [checklists]);

  const tipoOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.tipo) opts.add(c.tipo.toUpperCase()); });
    return Array.from(opts).sort();
  }, [checklists]);

  const placaOptions = useMemo(() => {
    const opts = new Set<string>();
    checklists.forEach(c => { if (c.placa) opts.add(c.placa.toUpperCase()); });
    return Array.from(opts).sort();
  }, [checklists]);

  // Sorting Helper
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Filtering Logic
  const filteredData = useMemo(() => {
    return checklists.filter(c => {
      if (filterMonthYear) {
        const [m, y] = filterMonthYear.split("/");
        if (!c.data || !c.data.startsWith(`${y}-${m}`)) return false;
      }
      if (filterBase && (!c.base || c.base.toUpperCase() !== filterBase.toUpperCase())) return false;
      if (filterTipo && (!c.tipo || c.tipo.toUpperCase() !== filterTipo.toUpperCase())) return false;
      if (filterPlaca && c.placa !== filterPlaca) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesPlaca = c.placa.toLowerCase().includes(q);
        const matchesCondutor = c.condutor.toLowerCase().includes(q);
        const matchesModelo = c.marcaModelo?.toLowerCase().includes(q);
        const matchesBase = c.base?.toLowerCase().includes(q);
        if (!matchesPlaca && !matchesCondutor && !matchesModelo && !matchesBase) return false;
      }

      if (filterMotorista) {
        const matches = c.condutor.toLowerCase().includes(filterMotorista.toLowerCase());
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortColumn === "data" || sortColumn === "timestamp") {
        const timeA = parseDateToComparable(a.timestamp || a.data || "");
        const timeB = parseDateToComparable(b.timestamp || b.data || "");
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      } else if (sortColumn === "placa") {
        valA = a.placa || "";
        valB = b.placa || "";
      } else if (sortColumn === "modelo") {
        valA = a.marcaModelo || "";
        valB = b.marcaModelo || "";
      } else if (sortColumn === "condutor") {
        valA = a.condutor || "";
        valB = b.condutor || "";
      } else if (sortColumn === "tipo") {
        valA = a.tipo || "";
        valB = b.tipo || "";
      } else if (sortColumn === "base") {
        valA = a.base || "";
        valB = b.base || "";
      } else if (sortColumn === "odometro") {
        valA = a.odometro || 0;
        valB = b.odometro || 0;
      } else if (sortColumn === "tanque") {
        valA = a.nivelTanque || "";
        valB = b.nivelTanque || "";
      } else if (sortColumn === "email") {
        valA = a.email || "";
        valB = b.email || "";
      } else if (sortColumn === "cor") {
        valA = a.cor || "";
        valB = b.cor || "";
      } else if (sortColumn === "entreguePor") {
        valA = a.entreguePor || "";
        valB = b.entreguePor || "";
      } else if (sortColumn === "recebidoPor") {
        valA = a.recebidoPor || "";
        valB = b.recebidoPor || "";
      } else {
        valA = (a as any)[sortColumn] || "";
        valB = (b as any)[sortColumn] || "";
      }

      let cmp = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), "pt-BR");
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [checklists, filterMonthYear, filterBase, filterTipo, filterPlaca, filterMotorista, searchQuery, sortColumn, sortDirection]);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <div className="space-y-6 text-slate-800 text-left">
      
      {/* Top Header Controls with Switcher Buttons and Dynamic Filters */}
      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search bar and filter expander */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por placa, motorista ou modelo..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isFilterExpanded 
                ? "bg-emerald-50 border-emerald-200 text-[#114D38]" 
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {isFilterExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Column toggler (discreet!) */}
          {viewMode === "table" && (
            <div className="relative">
              <button
                onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Columns className="w-3.5 h-3.5" />
                Colunas
              </button>

              {isColumnSelectorOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-150 rounded-2xl shadow-xl p-3 z-50 text-left">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block px-2 pb-1.5 border-b border-slate-100 mb-1.5">Exibir colunas</span>
                  
                  <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
                    {Object.keys(visibleColumns).map((col) => {
                      const colName = col;
                      const labelMap: { [key: string]: string } = {
                        timestamp: "Carimbo Data/Hora",
                        email: "E-mail do Condutor",
                        data: "Data da Inspeção",
                        placa: "Placa do Veículo",
                        modelo: "Marca / Modelo",
                        cor: "Cor do Veículo",
                        condutor: "Condutor",
                        tipo: "Tipo de Inspeção",
                        base: "Base Operacional",
                        status: "Status da Inspeção",
                        odometro: "Odômetro Atual",
                        tanque: "Nível de Combustível",
                        pneuDianteiroDireito: "Pneu Diant. Direito",
                        pneuDianteiroEsquerdo: "Pneu Diant. Esquerdo",
                        pneuTraseiroDireito: "Pneu Tras. Direito",
                        pneuTraseiroEsquerdo: "Pneu Tras. Esquerdo",
                        pneuEstepe: "Pneu Estepe (Reserva)",
                        obsDianteira: "Obs. Dianteira",
                        obsMotorista: "Obs. Lado Motorista",
                        obsPassageiro: "Obs. Lado Passageiro",
                        obsTraseira: "Obs. Traseira",
                        entreguePor: "Entregue Por",
                        recebidoPor: "Recebido Por",
                        mergedDoc: "Documento Integrado (PDF)"
                      };

                      return (
                        <button
                          key={col}
                          onClick={() => toggleColumn(colName)}
                          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                        >
                          <span className="truncate mr-2">{labelMap[col] || col}</span>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            visibleColumns[colName] ? "bg-[#114D38] border-[#114D38] text-white" : "border-slate-300"
                          }`}>
                            {visibleColumns[colName] && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Expanded filters row */}
      {isFilterExpanded && (
        <div className="bg-white px-6 py-5 rounded-3xl border border-slate-150 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Mês/Ano</label>
            <select
              value={filterMonthYear}
              onChange={(e) => setFilterMonthYear(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
            >
              <option value="">Todos</option>
              {monthYearOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Base</label>
            <select
              value={filterBase}
              onChange={(e) => setFilterBase(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
            >
              <option value="">Todas</option>
              {baseOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Tipo</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
            >
              <option value="">Todos</option>
              {tipoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">Placa</label>
            <select
              value={filterPlaca}
              onChange={(e) => setFilterPlaca(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="">Todas</option>
              {placaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* --- CONTENT AREA: TABLE OR KANBAN --- */}

      {viewMode === "table" && (
        <div className="bg-white rounded-[24px] border border-slate-150 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#114D38] font-bold text-white uppercase tracking-wider text-[10px] border-b border-slate-150">
                  {visibleColumns.timestamp && (
                    <th onClick={() => handleSort("timestamp")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Carimbo Data/Hora {sortColumn === "timestamp" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.email && (
                    <th onClick={() => handleSort("email")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        E-mail {sortColumn === "email" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.data && (
                    <th onClick={() => handleSort("data")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Data {sortColumn === "data" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.placa && (
                    <th onClick={() => handleSort("placa")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Placa {sortColumn === "placa" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.modelo && (
                    <th onClick={() => handleSort("modelo")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Marca / Modelo {sortColumn === "modelo" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.cor && (
                    <th onClick={() => handleSort("cor")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Cor {sortColumn === "cor" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.condutor && (
                    <th onClick={() => handleSort("condutor")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Condutor {sortColumn === "condutor" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.tipo && (
                    <th onClick={() => handleSort("tipo")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Tipo {sortColumn === "tipo" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.base && (
                    <th onClick={() => handleSort("base")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Base {sortColumn === "base" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.odometro && (
                    <th onClick={() => handleSort("odometro")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        KM Atual {sortColumn === "odometro" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.tanque && (
                    <th onClick={() => handleSort("tanque")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Combustível {sortColumn === "tanque" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.pneuDianteiroDireito && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Pneu D. Dir.</th>
                  )}
                  {visibleColumns.pneuDianteiroEsquerdo && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Pneu D. Esq.</th>
                  )}
                  {visibleColumns.pneuTraseiroDireito && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Pneu T. Dir.</th>
                  )}
                  {visibleColumns.pneuTraseiroEsquerdo && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Pneu T. Esq.</th>
                  )}
                  {visibleColumns.pneuEstepe && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Pneu Estepe</th>
                  )}
                  {visibleColumns.obsDianteira && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Obs. Dianteira</th>
                  )}
                  {visibleColumns.obsMotorista && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Obs. Motorista</th>
                  )}
                  {visibleColumns.obsPassageiro && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Obs. Passageiro</th>
                  )}
                  {visibleColumns.obsTraseira && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Obs. Traseira</th>
                  )}
                  {visibleColumns.entreguePor && (
                    <th onClick={() => handleSort("entreguePor")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Entregue Por {sortColumn === "entreguePor" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.recebidoPor && (
                    <th onClick={() => handleSort("recebidoPor")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Recebido Por {sortColumn === "recebidoPor" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th onClick={() => handleSort("status")} className="py-3.5 px-4 cursor-pointer select-none hover:bg-[#1d7053] transition-colors sticky top-0 bg-[#114D38] z-20 shadow-sm">
                      <div className="flex items-center gap-1">
                        Status {sortColumn === "status" && (sortDirection === "asc" ? "▲" : "▼")}
                      </div>
                    </th>
                  )}
                  {visibleColumns.mergedDoc && (
                    <th className="py-3.5 px-4 sticky top-0 bg-[#114D38] z-20 shadow-sm">Doc</th>
                  )}
                  <th className="py-3.5 px-4 text-center sticky top-0 bg-[#114D38] z-20 shadow-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-650">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="py-12 text-center text-slate-400 font-bold">
                      Nenhum checklist localizado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((c) => {
                    const dateFormatted = formatDateRobustly(c.data, c.timestamp);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        {visibleColumns.timestamp && (
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {c.timestamp || "N/A"}
                          </td>
                        )}
                        {visibleColumns.email && (
                          <td className="py-3 px-4 text-slate-650 truncate max-w-[150px]" title={c.email}>
                            {c.email || "N/A"}
                          </td>
                        )}
                        {visibleColumns.data && (
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-800 font-bold">
                            {dateFormatted}
                          </td>
                        )}
                        {visibleColumns.placa && (
                          <td className="py-3 px-4">
                            <span className="font-mono bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-lg text-xs font-black text-slate-800">
                              {c.placa}
                            </span>
                          </td>
                        )}
                        {visibleColumns.modelo && (
                          <td className="py-3 px-4 text-slate-700 font-bold truncate max-w-[150px]">
                            {c.marcaModelo || "FIAT / MOBI"}
                          </td>
                        )}
                        {visibleColumns.cor && (
                          <td className="py-3 px-4 text-slate-650 font-bold uppercase text-[11px]">
                            {c.cor || "N/D"}
                          </td>
                        )}
                        {visibleColumns.condutor && (
                          <td className="py-3 px-4 text-slate-800 font-black truncate max-w-[150px]">
                            {c.condutor ? c.condutor.toUpperCase() : "N/D"}
                          </td>
                        )}
                        {visibleColumns.tipo && (
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              {c.tipo || "MENSAL"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.base && (
                          <td className="py-3 px-4 text-[10px] uppercase font-extrabold text-slate-500">
                            {c.base || "MATRIZ"}
                          </td>
                        )}
                        {visibleColumns.odometro && (
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {c.odometro ? c.odometro.toLocaleString("pt-BR") : "N/D"} km
                          </td>
                        )}
                        {visibleColumns.tanque && (
                          <td className="py-3 px-4 text-[10px] font-black uppercase text-amber-600">
                            ⛽ {c.nivelTanque || "CHEIO"}
                          </td>
                        )}
                        {visibleColumns.pneuDianteiroDireito && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.pneuDianteiroDireito === "OK" || c.pneuDianteiroDireito === "BOM" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>{c.pneuDianteiroDireito || "OK"}</span>
                          </td>
                        )}
                        {visibleColumns.pneuDianteiroEsquerdo && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.pneuDianteiroEsquerdo === "OK" || c.pneuDianteiroEsquerdo === "BOM" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>{c.pneuDianteiroEsquerdo || "OK"}</span>
                          </td>
                        )}
                        {visibleColumns.pneuTraseiroDireito && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.pneuTraseiroDireito === "OK" || c.pneuTraseiroDireito === "BOM" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>{c.pneuTraseiroDireito || "OK"}</span>
                          </td>
                        )}
                        {visibleColumns.pneuTraseiroEsquerdo && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.pneuTraseiroEsquerdo === "OK" || c.pneuTraseiroEsquerdo === "BOM" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>{c.pneuTraseiroEsquerdo || "OK"}</span>
                          </td>
                        )}
                        {visibleColumns.pneuEstepe && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.pneuEstepe === "OK" || c.pneuEstepe === "BOM" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>{c.pneuEstepe || "OK"}</span>
                          </td>
                        )}
                        {visibleColumns.obsDianteira && (
                          <td className="py-3 px-4 truncate max-w-[120px]" title={c.obsDianteira || ""}>
                            {c.obsDianteira || <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.obsMotorista && (
                          <td className="py-3 px-4 truncate max-w-[120px]" title={c.obsMotorista || ""}>
                            {c.obsMotorista || <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.obsPassageiro && (
                          <td className="py-3 px-4 truncate max-w-[120px]" title={c.obsPassageiro || ""}>
                            {c.obsPassageiro || <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.obsTraseira && (
                          <td className="py-3 px-4 truncate max-w-[120px]" title={c.obsTraseira || ""}>
                            {c.obsTraseira || <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.entreguePor && (
                          <td className="py-3 px-4 text-slate-800 font-bold">
                            {c.entreguePor ? c.entreguePor.toUpperCase() : <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.recebidoPor && (
                          <td className="py-3 px-4 text-slate-800 font-bold">
                            {c.recebidoPor ? c.recebidoPor.toUpperCase() : <span className="text-slate-300">-</span>}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              c.status === "Aprovado" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                              c.status === "Ressalvas" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                              "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}>
                              {c.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.mergedDoc && (
                          <td className="py-3 px-4">
                            {c.data >= "2026-07-15" ? (
                              <button 
                                onClick={() => generateLocalPDF(c)}
                                className="text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider cursor-pointer bg-transparent border-none p-0 outline-none"
                              >
                                PDF <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : c.mergedDocUrl ? (
                              <a 
                                href={c.mergedDocUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                              >
                                PDF <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedChecklist(c)}
                              title="Visualizar Checklist Completo"
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 hover:text-[#114D38] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteChecklist && (
                              <button
                                onClick={() => setChecklistToDelete(c)}
                                title="Excluir Checklist"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
            <span>Risel Auditorias de Frota</span>
            <span>Total: {filteredData.length} registros filtrados</span>
          </div>
        </div>
      )}

      {/* --- DETAILED VIEW MODAL DRAWER --- */}
      {selectedChecklist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-50 transition-opacity">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col justify-between shadow-2xl relative overflow-y-auto">
            
            {/* Modal Header */}
            <div className="bg-[#114D38] text-white p-6 sticky top-0 z-10 flex justify-between items-center">
              <div>
                <span className="font-mono bg-white/15 border border-white/20 px-3 py-1 rounded-lg text-xs font-black uppercase text-white tracking-widest inline-block">
                  {selectedChecklist.placa}
                </span>
                <h3 className="text-lg font-black mt-2 text-white">Visualização de Auditoria</h3>
                <p className="text-xs font-bold text-emerald-200 mt-1">Checklist enviado por {selectedChecklist.condutor}</p>
              </div>
              <button 
                onClick={() => setSelectedChecklist(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 bg-slate-100 overflow-y-auto">
              {selectedChecklist.data >= "2026-07-15" ? (
                /* NEW PREMIUM DOCUMENT VIEW */
                <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-2xl border border-slate-200 overflow-hidden text-slate-800 p-6 space-y-6 text-left">
                  {/* Document Header */}
                  <div className="bg-gradient-to-br from-[#005C30] to-[#00361C] p-4 -mx-6 -mt-6 border-b-4 border-[#F47920] flex items-center justify-between">
                    <div className="bg-white px-3 py-1.5 rounded-lg">
                      <img 
                        src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" 
                        alt="Risel" 
                        className="h-8 object-contain"
                      />
                    </div>
                    <span className="text-white text-xs font-black tracking-widest uppercase">
                      Checklist Frota Leve
                    </span>
                  </div>

                  {/* Section 1: Dados Gerais */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#F47920] bg-slate-50 px-3 py-2 rounded-r-lg">
                      <h4 className="text-xs font-extrabold text-[#005C30] uppercase tracking-wider">📋 Dados Gerais do Checklist</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs border border-slate-150 rounded-xl p-4 bg-white">
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">📅 Data do Registro</span>
                        <span className="font-bold">{selectedChecklist.data ? new Date(selectedChecklist.data + "T12:00:00").toLocaleDateString("pt-BR") : "-"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">📋 Tipo de Checklist</span>
                        <span className="font-black text-slate-800 uppercase">{selectedChecklist.tipo || "MENSAL"}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🏢 Base Operacional</span>
                        <span className="font-black text-slate-800 uppercase">{selectedChecklist.base || "PAULÍNIA"}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🚗 Placa do Veículo</span>
                        <span className="font-black text-[#005C30] font-mono">{selectedChecklist.placa}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2 col-span-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🚘 Marca / Modelo</span>
                        <span className="font-bold">{selectedChecklist.marcaModelo || (selectedChecklist as any).modelo || "-"}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🎨 Cor do Veículo</span>
                        <span className="font-bold">{selectedChecklist.cor || "-"}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">⛽ Nível do Tanque</span>
                        <span className="font-black text-slate-800">⛽ {selectedChecklist.nivelTanque || "CHEIO"}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2 col-span-2">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🛣️ KM Atual</span>
                        <span className="font-bold font-mono">{selectedChecklist.odometro?.toLocaleString("pt-BR") || "0"} km</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Itens Integrados */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#F47920] bg-slate-50 px-3 py-2 rounded-r-lg">
                      <h4 className="text-xs font-extrabold text-[#005C30] uppercase tracking-wider">🛠️ Componentes e Pneus</h4>
                    </div>
                    <div className="border border-slate-150 rounded-xl p-4 bg-white text-xs space-y-2">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Itens do Veículo</span>
                      <p className="text-slate-700 font-semibold leading-relaxed">
                        {selectedChecklist.listaItens && selectedChecklist.listaItens.length > 0 
                          ? selectedChecklist.listaItens.join(", ")
                          : "CRLV, TAG PEDÁGIOS, CARTÃO ABASTECIMENTO, CHAVE RESERVA, SOM, MANUAL, TAPETE, TRIÂNGULO, MACACO, CHAVE DE RODA, EXTINTOR"}
                      </p>
                    </div>
                    
                    {/* Tires */}
                    <div className="border border-slate-150 rounded-xl p-4 bg-white space-y-3">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase block">🛞 Conservação Física dos Pneus</span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase">D. Direito</span>
                          <span className="text-[10px] font-black text-emerald-600 block mt-0.5">{selectedChecklist.pneuDianteiroDireito || "BOM"}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase">D. Esquerdo</span>
                          <span className="text-[10px] font-black text-emerald-600 block mt-0.5">{selectedChecklist.pneuDianteiroEsquerdo || "BOM"}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase">T. Direito</span>
                          <span className="text-[10px] font-black text-emerald-600 block mt-0.5">{selectedChecklist.pneuTraseiroDireito || "BOM"}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase">T. Esquerdo</span>
                          <span className="text-[10px] font-black text-emerald-600 block mt-0.5">{selectedChecklist.pneuTraseiroEsquerdo || "BOM"}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase">Estepe</span>
                          <span className="text-[10px] font-black text-emerald-600 block mt-0.5">{selectedChecklist.pneuEstepe || "BOM"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Avarias e Obs */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#F47920] bg-slate-50 px-3 py-2 rounded-r-lg">
                      <h4 className="text-xs font-extrabold text-[#005C30] uppercase tracking-wider">⚠️ Avarias e Observações</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="border border-slate-150 p-3 rounded-xl bg-white">
                        <span className="text-[9px] text-[#005C30] font-black uppercase block border-b border-slate-100 pb-1">⚠️ Dianteira</span>
                        <p className="font-bold text-slate-700 mt-1.5">{selectedChecklist.obsDianteira || "Ok"}</p>
                      </div>
                      <div className="border border-slate-150 p-3 rounded-xl bg-white">
                        <span className="text-[9px] text-[#005C30] font-black uppercase block border-b border-slate-100 pb-1">⚠️ Traseira</span>
                        <p className="font-bold text-slate-700 mt-1.5">{selectedChecklist.obsTraseira || "Ok"}</p>
                      </div>
                      <div className="border border-slate-150 p-3 rounded-xl bg-white">
                        <span className="text-[9px] text-[#005C30] font-black uppercase block border-b border-slate-100 pb-1">⚠️ Lado Motorista</span>
                        <p className="font-bold text-slate-700 mt-1.5">{selectedChecklist.obsMotorista || "Ok"}</p>
                      </div>
                      <div className="border border-slate-150 p-3 rounded-xl bg-white">
                        <span className="text-[9px] text-[#005C30] font-black uppercase block border-b border-slate-100 pb-1">⚠️ Lado Passageiro</span>
                        <p className="font-bold text-slate-700 mt-1.5">{selectedChecklist.obsPassageiro || "Ok"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Fotos */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#F47920] bg-slate-50 px-3 py-2 rounded-r-lg">
                      <h4 className="text-xs font-extrabold text-[#005C30] uppercase tracking-wider">📸 Registro Fotográfico do Laudo</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-slate-150 p-2 rounded-xl bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Frente</span>
                        {selectedChecklist.fotoFrente ? (
                          <img src={getDirectImageUrl(selectedChecklist.fotoFrente)} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-350 text-[10px] font-semibold">Sem foto</div>
                        )}
                      </div>
                      <div className="border border-slate-150 p-2 rounded-xl bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Traseira</span>
                        {selectedChecklist.fotoTraseira ? (
                          <img src={getDirectImageUrl(selectedChecklist.fotoTraseira)} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-350 text-[10px] font-semibold">Sem foto</div>
                        )}
                      </div>
                      <div className="border border-slate-150 p-2 rounded-xl bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Lado Motorista</span>
                        {selectedChecklist.fotoMotorista ? (
                          <img src={getDirectImageUrl(selectedChecklist.fotoMotorista)} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-350 text-[10px] font-semibold">Sem foto</div>
                        )}
                      </div>
                      <div className="border border-slate-150 p-2 rounded-xl bg-slate-50 text-center">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Lado Passageiro</span>
                        {selectedChecklist.fotoPassageiro ? (
                          <img src={getDirectImageUrl(selectedChecklist.fotoPassageiro)} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="h-32 bg-slate-100 flex items-center justify-center text-slate-350 text-[10px] font-semibold">Sem foto</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 5: Responsáveis */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#F47920] bg-slate-50 px-3 py-2 rounded-r-lg">
                      <h4 className="text-xs font-extrabold text-[#005C30] uppercase tracking-wider">👥 Responsáveis</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border border-slate-150 rounded-xl p-4 bg-white text-center">
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">📤 Entregue Por</span>
                        <span className="text-xs font-bold text-slate-800">{selectedChecklist.entreguePor || selectedChecklist.condutor || "Não Informado"}</span>
                      </div>
                      <div className="border-l border-slate-150">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block">📥 Recebido Por</span>
                        <span className="text-xs font-bold text-slate-800">{selectedChecklist.recebidoPor || "Não Informado"}</span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Download Button Inside Modal */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-800">Checklist PDF Oficial</h5>
                      <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Versão premium idêntica ao laudo de auditoria</p>
                    </div>
                    <button
                      onClick={() => generateLocalPDF(selectedChecklist)}
                      className="px-4 py-2 bg-[#005C30] hover:bg-[#00361C] text-xs font-black text-white rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      Exportar PDF <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* DEFAULT CLASSIC VIEW FOR PRE-2026 CHECKLISTS */
                <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-6 text-slate-800">
                  {/* General metadata */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Data Envio</span>
                      <p className="text-xs font-bold text-slate-800">
                        {selectedChecklist.timestamp || (selectedChecklist.data ? new Date(selectedChecklist.data + "T12:00:00").toLocaleDateString("pt-BR") : "N/D")}
                      </p>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Tipo de Inspeção</span>
                      <p className="text-xs font-black text-slate-800 uppercase">{selectedChecklist.tipo || "MENSAL"}</p>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Base Operacional</span>
                      <p className="text-xs font-black text-slate-800 uppercase">{selectedChecklist.base || "MATRIZ"}</p>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Odômetro Atual</span>
                      <p className="text-xs font-bold text-slate-800">{selectedChecklist.odometro?.toLocaleString("pt-BR")} km</p>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Nível de Tanque</span>
                      <p className="text-xs font-black text-slate-800">⛽ {selectedChecklist.nivelTanque || "CHEIO"}</p>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[10px] font-black text-slate-400 uppercase">E-mail do Condutor</span>
                      <p className="text-xs font-bold text-slate-600 truncate">{selectedChecklist.email || "N/A"}</p>
                    </div>
                  </div>

                  {/* Tires and mechanical status grids */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Inspeção Detalhada de Pneus</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <TireIndicator label="D. Direito" state={selectedChecklist.pneuDianteiroDireito || selectedChecklist.itens.pneus} />
                      <TireIndicator label="D. Esquerdo" state={selectedChecklist.pneuDianteiroEsquerdo || selectedChecklist.itens.pneus} />
                      <TireIndicator label="T. Direito" state={selectedChecklist.pneuTraseiroDireito || selectedChecklist.itens.pneus} />
                      <TireIndicator label="T. Esquerdo" state={selectedChecklist.pneuTraseiroEsquerdo || selectedChecklist.itens.pneus} />
                      <TireIndicator label="Estepe" state={selectedChecklist.pneuEstepe || "BOM"} />
                    </div>
                  </div>

                  {/* Items in Vehicle */}
                  {selectedChecklist.listaItens && selectedChecklist.listaItens.length > 0 && (
                    <div className="space-y-2 text-left">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentos & Acessórios Inspecionados</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedChecklist.listaItens.map((item, idx) => (
                          <span key={idx} className="bg-emerald-50 text-[#114D38] border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase">
                            ✓ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Observations and damage */}
                  <div className="space-y-3 text-left">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registro Fotográfico e Observações</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PhotoAndObsBlock title="Dianteira" obs={selectedChecklist.obsDianteira} photoUrl={selectedChecklist.fotoFrente} />
                      <PhotoAndObsBlock title="Lado Motorista" obs={selectedChecklist.obsMotorista} photoUrl={selectedChecklist.fotoMotorista} />
                      <PhotoAndObsBlock title="Lado Passageiro" obs={selectedChecklist.obsPassageiro} photoUrl={selectedChecklist.fotoPassageiro} />
                      <PhotoAndObsBlock title="Traseira" obs={selectedChecklist.obsTraseira} photoUrl={selectedChecklist.fotoTraseira} />
                      
                      {selectedChecklist.fotosInterior && (
                        <PhotoAndObsBlock title="Interior do Veículo" obs="Verificação geral do interior" photoUrl={selectedChecklist.fotosInterior} />
                      )}
                      {selectedChecklist.fotoRetrovisorMotorista && (
                        <PhotoAndObsBlock title="Retrovisor Motorista" obs="Retrovisor lado condutor" photoUrl={selectedChecklist.fotoRetrovisorMotorista} />
                      )}
                      {selectedChecklist.fotoRetrovisorPassageiro && (
                        <PhotoAndObsBlock title="Retrovisor Passageiro" obs="Retrovisor lado passageiro" photoUrl={selectedChecklist.fotoRetrovisorPassageiro} />
                      )}
                      {selectedChecklist.fotoFaroisDianteiros && (
                        <PhotoAndObsBlock title="Faróis Dianteiros" obs="Faróis principais" photoUrl={selectedChecklist.fotoFaroisDianteiros} />
                      )}
                      {selectedChecklist.fotoFaroisTraseiros && (
                        <PhotoAndObsBlock title="Faróis Traseiros" obs="Lanternas e piscas traseiros" photoUrl={selectedChecklist.fotoFaroisTraseiros} />
                      )}
                    </div>
                  </div>

                  {/* Document Link Merged */}
                  {selectedChecklist.mergedDocUrl && (
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-left">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-[#114D38]">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800">Checklist Consolidado PDF</h5>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">Laudo de inspeção integrado e armazenado no Drive</p>
                        </div>
                      </div>
                      <a 
                        href={selectedChecklist.mergedDocUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-xs font-black text-[#114D38] border border-slate-200 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        Abrir Laudo <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 sticky bottom-0 z-10">
              <button 
                onClick={() => setSelectedChecklist(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-extrabold rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {checklistToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden text-left border border-slate-100 transform scale-100 transition-transform duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-800">Confirmar Exclusão</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Tem certeza de que deseja excluir permanentemente o checklist do veículo de placa{" "}
                <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-extrabold text-[11px]">
                  {checklistToDelete.placa}
                </span>
                ? Esta ação é irreversível e o removerá permanentemente do sistema.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setChecklistToDelete(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-extrabold text-slate-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (onDeleteChecklist) {
                    setIsDeleting(true);
                    try {
                      await onDeleteChecklist(checklistToDelete.id);
                    } catch (e) {
                      console.error("Erro ao deletar checklist:", e);
                    } finally {
                      setIsDeleting(false);
                      setChecklistToDelete(null);
                    }
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-black text-white rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponents for Details Modal

function TireIndicator({ label, state }: { label: string; state: string }) {
  const s = (state || "").toUpperCase();
  const isRuim = s.includes("RUIM");
  const isRegular = s.includes("REGULAR");
  const isNovoOrBom = s.includes("BOM") || s.includes("NOVO");

  return (
    <div className="bg-white border border-slate-150 rounded-xl p-2 text-center text-left">
      <span className="text-[8px] font-black text-slate-400 uppercase block">{label}</span>
      <span className={`text-[10px] font-black block mt-1 uppercase ${
        isRuim ? "text-rose-600" :
        isRegular ? "text-amber-500" :
        isNovoOrBom ? "text-emerald-600" :
        "text-slate-600"
      }`}>
        {state || "BOM"}
      </span>
    </div>
  );
}

function PhotoAndObsBlock({ title, obs, photoUrl }: { title: string; obs?: string; photoUrl?: string }) {
  const hasAvaria = obs && obs.toLowerCase().trim() !== "ok" && obs.toLowerCase().trim() !== "ok ";
  const displaySrc = getDirectImageUrl(photoUrl);
  const rawUrl = photoUrl ? photoUrl.split(",")[0].trim() : "";
  
  return (
    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2 text-left">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{title}</span>
        {hasAvaria ? (
          <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Ressalva</span>
        ) : (
          <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Ok</span>
        )}
      </div>

      {photoUrl ? (
        <a 
          href={rawUrl} 
          target="_blank" 
          rel="noreferrer"
          className="relative block h-28 w-full bg-slate-200 rounded-xl overflow-hidden border border-slate-300 group shadow-sm cursor-pointer"
        >
          <img 
            src={displaySrc} 
            alt={`Foto ${title}`} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-wider">
            Ver Foto Ampliada <ExternalLink className="w-3 h-3 ml-1" />
          </div>
        </a>
      ) : (
        <div className="h-16 w-full bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
          <span className="text-[9px] font-bold uppercase">Sem Foto Anexada</span>
        </div>
      )}

      {obs ? (
        <p className="text-[10px] font-semibold text-slate-600 leading-relaxed bg-white border border-slate-150/60 p-2 rounded-xl">
          <strong className="text-[9px] uppercase tracking-wide block text-slate-400 mb-0.5">Comentários:</strong>
          {obs}
        </p>
      ) : (
        <p className="text-[9px] font-bold text-slate-400 text-center italic">Nenhuma observação informada.</p>
      )}
    </div>
  );
}

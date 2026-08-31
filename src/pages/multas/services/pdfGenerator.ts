import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Multa } from '../types';

export interface GeneratedPdfResult {
  dataUrl: string;
  blob: Blob;
  fileName: string;
  doc: jsPDF;
  download: () => void;
  multaData?: Partial<Multa>;
}

// URL oficial da logomarca Risel
export const RISEL_LOGO_URL = 'https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg';

// Helper para carregar o logotipo em DataURL/Base64 para o jsPDF
const loadLogoBase64 = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 120;
          canvas.height = img.naturalHeight || img.height || 120;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.95);
          resolve(dataURL);
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch (e) {
      resolve(null);
    }
  });
};

export const generateAutorizacaoDescontoPdf = async (multa: Partial<Multa>): Promise<GeneratedPdfResult> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Tenta carregar o logotipo
  const logoDataUrl = await loadLogoBase64(RISEL_LOGO_URL);

  const placa = (multa.placa || 'SEM-PLACA').toUpperCase().trim();
  const ait = (multa.ait || 'SEM-AIT').toUpperCase().trim();
  const motorista = (multa.responsavelNome || '').toUpperCase().trim();
  const cpfMatricula = (multa.responsavelCodigo || '').trim();
  const base = (multa.base || 'FILIAL').toUpperCase().trim();
  const frota = (multa.frota || placa).toUpperCase().trim();
  const orgao = (multa.orgaoAutuador || 'ÓRGÃO DE TRÂNSITO').toUpperCase().trim();
  const enquadramento = (multa.enquadramento || '-').toUpperCase().trim();
  const artigo = (multa.artigoCtb || '-').toUpperCase().trim();
  const descricao = (multa.descricaoInfracao || 'INFRAÇÃO DE TRÂNSITO').toUpperCase().trim();
  const pontos = multa.pontosCnh !== undefined ? String(multa.pontosCnh) : '0';
  const endereco = (multa.endereco || '-').toUpperCase().trim();
  const municipio = (multa.municipio || '-').toUpperCase().trim();
  const uf = (multa.uf || '-').toUpperCase().trim();
  const via = multa.rodoviaOuUrbano === 'RODOVIA' ? 'RODOVIA' : 'URBANO';
  
  const valorOriginal = Number(multa.valor || 0);
  const desconto = Number(multa.desconto || 0);
  const valorFinal = Number(multa.valorComDesconto ?? (valorOriginal - desconto));

  const fmtMoney = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const fmtDate = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      if (dStr.includes('T')) {
        const [dPart, t] = dStr.split('T');
        const [y, m, dNum] = dPart.split('-');
        return `${dNum}/${m}/${y} ${t ? t.substring(0, 5) : ''}`.trim();
      }
      if (dStr.includes('-')) {
        const [y, m, dNum] = dStr.split('-');
        return `${dNum}/${m}/${y}`;
      }
    } catch (e) {}
    return dStr;
  };

  // Cores do Padrão Risel
  const primaryColor: [number, number, number] = [17, 77, 56]; // #114D38
  const accentColor: [number, number, number] = [0, 168, 89]; // #00A859
  const darkTextColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const lightBgColor: [number, number, number] = [248, 250, 252]; // Slate 50

  // 1. Cabeçalho Superior Institucional com Logo Risel
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 26, 'F');

  // Faixa de Destaque Verde Acento
  doc.setFillColor(...accentColor);
  doc.rect(0, 26, 210, 2, 'F');

  // Inserção do Logotipo Risel
  if (logoDataUrl) {
    try {
      // Fundo branco circular/arredondado para o logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 3.5, 19, 19, 2.5, 2.5, 'F');
      doc.addImage(logoDataUrl, 'JPEG', 13, 4.5, 17, 17);
    } catch (e) {
      console.warn("Aviso ao desenhar logo no PDF:", e);
    }
  }

  // Texto do Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('RISEL COMBUSTÍVEIS LTDA', logoDataUrl ? 112 : 105, 11, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA & INDICAÇÃO DE CONDUTOR', logoDataUrl ? 112 : 105, 18, { align: 'center' });

  let currentY = 34;

  // Seção 1: Dados do Condutor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('1. DADOS DO CONDUTOR RESPONSÁVEL', 14, currentY);

  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Nome Completo do Motorista', 'CPF / Matrícula', 'Base / Filial', 'Tipo de Responsabilidade']],
    body: [[
      motorista || '',
      cpfMatricula || '',
      base,
      multa.empresaOuCondutor || 'CONDUTOR'
    ]],
    styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 6, textColor: darkTextColor },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 32 }
    },
    margin: { left: 14, right: 14 }
  });

  // Espaçamento aprimorado entre Item 1 e Item 2
  currentY = (doc as any).lastAutoTable.finalY + 6.5;

  // Seção 2: Dados do Veículo e da Infração
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('2. DADOS DA INFRAÇÃO DE TRÂNSITO E DO VEÍCULO', 14, currentY);

  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Placa', 'Frota', 'Auto de Infração (AIT)', 'Data / Hora da Infração', 'Prazo Indicação']],
    body: [[
      placa,
      frota,
      ait,
      fmtDate(multa.dataHoraInfracao),
      fmtDate(multa.prazoIndicacao)
    ]],
    styles: { fontSize: 8, cellPadding: 2.2, textColor: darkTextColor },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Órgão Autuador', 'Cód. Enquadramento', 'Artigo CTB', 'Pontos CNH', 'Tipo de Via']],
    body: [[
      orgao,
      enquadramento,
      artigo,
      `${pontos} PONTOS`,
      via
    ]],
    styles: { fontSize: 8, cellPadding: 2.2, textColor: darkTextColor },
    headStyles: { fillColor: [40, 95, 75], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 1;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Descrição da Infração Cometida', 'Local / Endereço Completo', 'Município / UF']],
    body: [[
      descricao,
      endereco,
      `${municipio} - ${uf}`
    ]],
    styles: { fontSize: 8, cellPadding: 2.2, textColor: darkTextColor },
    headStyles: { fillColor: [40, 95, 75], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: 42 }
    },
    margin: { left: 14, right: 14 }
  });

  // Espaçamento aprimorado entre Item 2 e Item 3
  currentY = (doc as any).lastAutoTable.finalY + 6.5;

  // Seção 3: Demonstrativo Financeiro (Apenas os 3 valores fundamentais)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('3. DEMONSTRATIVO FINANCEIRO E VALOR DO DESCONTO', 14, currentY);

  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Valor Integral (R$)', 'Desconto Concedido (R$)', 'Valor Líquido a Descontar (R$)']],
    body: [[
      fmtMoney(valorOriginal),
      fmtMoney(desconto),
      fmtMoney(valorFinal)
    ]],
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: darkTextColor, halign: 'center' },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60 },
      2: { cellWidth: 62, fontStyle: 'bold', textColor: [0, 120, 60] }
    },
    margin: { left: 14, right: 14 }
  });

  // Espaçamento aprimorado entre Item 3 e Item 4
  currentY = (doc as any).lastAutoTable.finalY + 6.5;

  // Seção 4: Termo Legal e Declaração de Responsabilidade
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(14, currentY, 182, 38, 2, 2, 'FD');
  doc.setDrawColor(200, 215, 210);
  doc.roundedRect(14, currentY, 182, 38, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('4. DECLARAÇÃO DE RESPONSABILIDADE E AUTORIZAÇÃO EXPRESSA DE DESCONTO', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  const identificacaoCondutor = motorista 
    ? `Eu, ${motorista}, identificado(a) neste termo` 
    : `Eu, __________________________________________________, condutor(a)`;

  const declarationText = `${identificacaoCondutor}, declaro para todos os fins de direito que me encontrava na condução do veículo placa ${placa} (Frota ${frota}) na data e horário indicados, sendo de minha inteira responsabilidade a infração de trânsito autuada sob o AIT nº ${ait}.\n\n` +
  `Com fulcro no Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT) e no Regulamento Interno de Uso de Veículos da Empresa, AUTORIZO EXPRESSAMENTE a empresa RISEL COMBUSTÍVEIS LTDA a efetuar o desconto em minha folha de pagamento no valor de ${fmtMoney(valorFinal)} referente à referida infração, bem como concordo com a pontuação atribuída ao meu prontuário de habilitação.`;

  const splitText = doc.splitTextToSize(declarationText, 174);
  doc.text(splitText, 18, currentY + 12);

  currentY += 46;

  // Seção 5: Assinaturas e Datação (Garantindo que fique tudo em 1 página só)
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const localCidade = municipio && municipio !== '-' ? municipio : 'Campinas';
  const localUF = uf && uf !== '-' ? uf : 'SP';

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${localCidade} - ${localUF}, ${dataHoje}.`, 105, currentY, { align: 'center' });

  currentY += 16;

  // Linhas de Assinatura
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.5);

  // Assinatura do Condutor
  doc.line(20, currentY, 95, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkTextColor);
  doc.text('ASSINATURA DO CONDUTOR', 57.5, currentY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('(Idêntica à assinatura constante na CNH)', 57.5, currentY + 8, { align: 'center' });
  if (motorista) {
    doc.text(motorista.substring(0, 35), 57.5, currentY + 12, { align: 'center' });
  } else {
    doc.text('Nome Legível: ____________________________', 57.5, currentY + 12, { align: 'center' });
  }

  // Assinatura da Empresa (Gerenciamento de Riscos)
  doc.line(115, currentY, 190, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkTextColor);
  doc.text('RISEL COMBUSTÍVEIS LTDA', 152.5, currentY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Gerenciamento de Riscos', 152.5, currentY + 8, { align: 'center' });

  // Rodapé do Documento
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento gerado eletronicamente pelo Sistema de Gestão Risel Combustíveis. Obrigatório anexar cópia da CNH.', 105, 288, { align: 'center' });

  const fileName = `Autorizacao_Desconto_${placa}_AIT_${ait}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const blob = doc.output('blob');
  const dataUrl = doc.output('datauristring');

  return {
    dataUrl,
    blob,
    fileName,
    doc,
    download: () => {
      doc.save(fileName);
    },
    multaData: multa
  };
};

export const openTermoInNewTab = async (multa: Partial<Multa>, existingUrl?: string) => {
  try {
    let targetUrl = existingUrl;
    let fileName = `Autorizacao_Desconto_${multa.placa || 'MULTA'}.pdf`;

    if (!targetUrl || (!targetUrl.startsWith('blob:') && !targetUrl.startsWith('http') && !targetUrl.startsWith('data:application/pdf'))) {
      const res = await generateAutorizacaoDescontoPdf(multa);
      fileName = res.fileName;
      targetUrl = URL.createObjectURL(res.blob);
    } else if (targetUrl.startsWith('data:application/pdf')) {
      const parts = targetUrl.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      targetUrl = URL.createObjectURL(blob);
    }
    
    if (targetUrl) {
      // Método seguro de abertura em nova aba (sem nunca quebrar o iframe do app)
      const link = document.createElement('a');
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try { document.body.removeChild(link); } catch (e) {}
      }, 300);
    }
  } catch (error) {
    console.error("Erro ao abrir Termo em nova aba:", error);
    // Em caso de erro, efetua o download direto com segurança
    try {
      const res = await generateAutorizacaoDescontoPdf(multa);
      res.download();
    } catch (e) {}
  }
};


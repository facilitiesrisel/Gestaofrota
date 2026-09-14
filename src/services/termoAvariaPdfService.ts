import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { RISEL_LOGO_URL } from '../pages/multas/services/pdfGenerator';

export interface ServicoManutencaoItem {
  id: string;
  descricao: string;
  tipo: "Serviço" | "Peça / Produto";
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface AnexoManutencao {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  dataUrl: string;
  criadoEm?: string;
}

export interface AutorizacaoDescontoAvaria {
  id: string;
  colaboradorNome: string;
  base: string;
  cpfMatricula?: string;
  cargoFuncao?: string;
  descricaoOcorrencia: string;
  dataOcorrencia: string;
  valorTotalReparo: number;
  subsidioEmpresa?: number;
  valorDesconto: number;
  quantidadeParcelas: number;
  valorParcela: number;
  geradoEm: string;
  pdfDataUrl?: string;
  enviadoEmail?: boolean;
  destinatarioEmail?: string;
  dataEnvioEmail?: string;
}

export interface ManutencaoComAvaria {
  id: string;
  placa: string;
  tipo: "Preventiva" | "Corretiva";
  descricao: string;
  data: string;
  dataEntrada?: string;
  dataSaida?: string;
  odometro: number;
  custo: number;
  oficina: string;
  condutor?: string;
  base?: string;
  modelo?: string;
  nf_os?: string;
  status?: "Concluída" | "Em Andamento" | "Agendada";
  observacoes?: string;
  servicos?: ServicoManutencaoItem[];
  anexos?: AnexoManutencao[];
  autorizacaoAvaria?: AutorizacaoDescontoAvaria;
}

export interface GeneratedAvariaPdfResult {
  dataUrl: string;
  blob: Blob;
  fileName: string;
  doc: jsPDF;
  download: () => void;
}

// Carregador de Logo em Base64 para o jsPDF
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
          resolve(canvas.toDataURL('image/jpeg', 0.95));
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

// Conversor seguro de Uint8Array para Base64 (evita estouro de pilha em arquivos grandes)
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

// Conversor de DataURL Base64 para Uint8Array
const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Prepara imagens de qualquer formato (WebP, PNG, JPG) para inserção confiável no jsPDF via Canvas
const prepareImageForJsPdf = async (dataUrl: string): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' }> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDimension = 1600;
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDimension || h > maxDimension) {
            if (w > h) {
              h = Math.round((h * maxDimension) / w);
              w = maxDimension;
            } else {
              w = Math.round((w * maxDimension) / h);
              h = maxDimension;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl, format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG' });
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.88), format: 'JPEG' });
        } catch {
          resolve({ dataUrl, format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG' });
        }
      };
      img.onerror = () => resolve({ dataUrl, format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG' });
      img.src = dataUrl;
    } catch {
      resolve({ dataUrl, format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG' });
    }
  });
};

export const generateTermoAvariaPdf = async (
  maint: ManutencaoComAvaria,
  avaria: AutorizacaoDescontoAvaria,
  anexos?: AnexoManutencao[]
): Promise<GeneratedAvariaPdfResult> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoDataUrl = await loadLogoBase64(RISEL_LOGO_URL);

  const placa = (maint.placa || 'SEM-PLACA').toUpperCase().trim();
  const modelo = (maint.modelo || 'Veículo Leve').toUpperCase().trim();
  const colaborador = (avaria.colaboradorNome || maint.condutor || 'COLABORADOR NÃO INFORMADO').toUpperCase().trim();
  const base = (avaria.base || maint.base || 'FILIAL').toUpperCase().trim();
  const cpfMatricula = (avaria.cpfMatricula || '-').trim();
  const cargoFuncao = (avaria.cargoFuncao || 'Condutor / Operador').trim();
  const osNum = maint.nf_os || `OS-${placa}-${Date.now().toString().slice(-4)}`;
  const oficina = (maint.oficina || 'Oficina Credenciada').trim();
  const dataOS = maint.data || new Date().toISOString().split('T')[0];
  const dataOcorr = avaria.dataOcorrencia || dataOS;

  const fmtMoney = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (dStr?: string) => {
    if (!dStr) return '-';
    try {
      if (dStr.includes('T')) {
        const [dPart] = dStr.split('T');
        const [y, m, dNum] = dPart.split('-');
        return `${dNum}/${m}/${y}`;
      }
      if (dStr.includes('-')) {
        const [y, m, dNum] = dStr.split('-');
        return `${dNum}/${m}/${y}`;
      }
    } catch (e) {}
    return dStr;
  };

  // Cores Oficiais Risel
  const primaryColor: [number, number, number] = [17, 77, 56]; // #114D38
  const accentColor: [number, number, number] = [0, 168, 89]; // #00A859
  const darkTextColor: [number, number, number] = [30, 41, 59]; // Slate 800

  // 1. Cabeçalho Superior Institucional com Logo Risel
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 26, 'F');

  // Faixa de Destaque Verde Acento
  doc.setFillColor(...accentColor);
  doc.rect(0, 26, 210, 2, 'F');

  // Logotipo Risel
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 3.5, 19, 19, 2.5, 2.5, 'F');
      doc.addImage(logoDataUrl, 'JPEG', 13, 4.5, 17, 17);
    } catch (e) {
      console.warn('Aviso ao desenhar logo:', e);
    }
  }

  // Textos do Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('RISEL COMBUSTÍVEIS LTDA', logoDataUrl ? 112 : 105, 11, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA POR AVARIA DE VEÍCULO',
    logoDataUrl ? 112 : 105,
    18,
    { align: 'center' }
  );

  let currentY = 33;

  // Seção 1: Dados do Colaborador
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('1. DADOS DO COLABORADOR / CONDUTOR RESPONSÁVEL', 14, currentY);

  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Nome Completo do Colaborador', 'CPF / Matrícula', 'Base / Filial', 'Cargo / Função']],
    body: [[
      colaborador,
      cpfMatricula,
      base,
      cargoFuncao
    ]],
    styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 6, textColor: darkTextColor },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 75, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 37 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Seção 2: Dados do Veículo e da Ordem de Serviço
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('2. DADOS DO VEÍCULO E DA ORDEM DE SERVIÇO (OS)', 14, currentY);

  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Placa', 'Modelo do Veículo', 'Odômetro', 'Data Ocorrência / OS', 'Nº Ordem Serviço / NF', 'Oficina Prestadora']],
    body: [[
      placa,
      modelo,
      maint.odometro > 0 ? `${maint.odometro.toLocaleString('pt-BR')} km` : '-',
      fmtDate(dataOcorr),
      osNum,
      oficina
    ]],
    styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 6, textColor: darkTextColor },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 40 },
      2: { cellWidth: 26 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Seção 3: Discriminação dos Serviços e Produtos/Peças
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('3. DISCRIMINAÇÃO DOS SERVIÇOS E PRODUTOS / PEÇAS DANIFICADAS', 14, currentY);

  currentY += 2;

  // Monta linhas dos serviços/produtos
  const servicos = Array.isArray(maint.servicos) && maint.servicos.length > 0
    ? maint.servicos
    : [{
        id: '1',
        descricao: maint.descricao || 'Reparo de avaria veicular',
        tipo: 'Serviço' as const,
        quantidade: 1,
        valorUnitario: avaria.valorTotalReparo || maint.custo,
        valorTotal: avaria.valorTotalReparo || maint.custo
      }];

  const tableBody = servicos.map((s, idx) => [
    String(idx + 1).padStart(2, '0'),
    s.descricao,
    s.tipo || 'Serviço',
    String(s.quantidade || 1),
    fmtMoney(s.valorUnitario),
    fmtMoney(s.valorTotal)
  ]);

  // Linha de Totalizador
  const totalReparos = avaria.valorTotalReparo || maint.custo;
  tableBody.push([
    '',
    'VALOR TOTAL DOS REPAROS E PEÇAS',
    '',
    '',
    '',
    fmtMoney(totalReparos)
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Item', 'Descrição do Serviço ou Produto / Peça', 'Categoria', 'Qtd', 'Vlr. Unitário', 'Subtotal']],
    body: tableBody,
    styles: { fontSize: 7.5, cellPadding: 2, minCellHeight: 5.5, textColor: darkTextColor },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 84 },
      2: { cellWidth: 26 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Destaque para a linha de Total
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 1) {
          data.cell.styles.textColor = primaryColor;
        }
        if (data.column.index === 5) {
          data.cell.styles.textColor = [180, 20, 20];
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Seção 4: Demonstrativo Financeiro e Condição de Desconto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('4. DEMONSTRATIVO FINANCEIRO E FORMA DE DESCONTO EM FOLHA', 14, currentY);

  currentY += 2;

  const parcelas = avaria.quantidadeParcelas || 1;
  const valorDesconto = avaria.valorDesconto || totalReparos;
  const valorParcela = avaria.valorParcela || (valorDesconto / parcelas);
  const subsidio = avaria.subsidioEmpresa || (totalReparos - valorDesconto > 0 ? totalReparos - valorDesconto : 0);

  const parcelamentoDescricao = parcelas === 1
    ? `Desconto em cota única de ${fmtMoney(valorDesconto)}`
    : `Desconto em ${parcelas}x de ${fmtMoney(valorParcela)} na Folha`;

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [['Valor Total do Reparo', 'Participação Empresa', 'Valor a Descontar', 'Condição de Parcelamento']],
    body: [[
      fmtMoney(totalReparos),
      fmtMoney(subsidio),
      fmtMoney(valorDesconto),
      parcelamentoDescricao
    ]],
    styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 6, textColor: darkTextColor, halign: 'center' },
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40 },
      2: { cellWidth: 42, fontStyle: 'bold', textColor: [180, 20, 20] },
      3: { cellWidth: 60, fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Seção 5: Declaração Legal e Autorização Expressa (Artigo 462, § 1º CLT)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('5. DECLARAÇÃO DE RESPONSABILIDADE E AUTORIZAÇÃO EXPRESSA DE DESCONTO', 14, currentY);

  currentY += 3;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, 182, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  const textoClt1 = `Eu, ${colaborador}, devidamente qualificado(a) neste termo, declaro para todos os fins de direito e efeitos legais que me encontrava na posse/condução do veículo placa ${placa} (${modelo}) da frota corporativa da empresa RISEL COMBUSTÍVEIS LTDA, assumindo expressamente a responsabilidade pelos danos e avarias ocorridos.`;
  const split1 = doc.splitTextToSize(textoClt1, 174);
  doc.text(split1, 18, currentY + 4.5);

  let textOffset = currentY + 4.5 + split1.length * 3.5;

  const textoClt2 = `Com fulcro no Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT), AUTORIZO EXPRESSAMENTE a empresa RISEL COMBUSTÍVEIS LTDA a efetuar o desconto do montante de ${fmtMoney(valorDesconto)} (${parcelamentoDescricao}) em minha folha de pagamento para ressarcimento das despesas decorrentes das avarias supracitadas.`;
  const split2 = doc.splitTextToSize(textoClt2, 174);
  doc.text(split2, 18, textOffset);

  currentY = currentY + 38;

  // Datação
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mes = meses[hoje.getMonth()];
  const ano = hoje.getFullYear();
  const dataHojeExtenso = `${base}, ${dia} de ${mes} de ${ano}.`;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(dataHojeExtenso, 105, currentY, { align: 'center' });

  currentY += 12;

  // Seção de Assinaturas
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);

  // Linha 1 - Colaborador
  doc.line(25, currentY, 95, currentY);
  // Linha 2 - Risel
  doc.line(115, currentY, 185, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('ASSINATURA DO COLABORADOR', 60, currentY + 4, { align: 'center' });
  doc.text('RISEL COMBUSTÍVEIS LTDA', 150, currentY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const infoAssinante = cpfMatricula && cpfMatricula !== '-'
    ? `${colaborador} (CPF: ${cpfMatricula})`
    : colaborador;
  doc.text(infoAssinante, 60, currentY + 7.5, { align: 'center' });
  // Nota: O texto "Gestão de Frotas / Recursos Humanos" foi removido da assinatura a pedido

  // Seção 6: Registro Fotográfico Direto no PDF (todas as fotos anexadas)
  const allAnexos = (anexos && anexos.length > 0) ? anexos : (maint.anexos || []);
  const imageAttachments = allAnexos.filter(
    a => a && a.dataUrl && (
      a.tipo?.startsWith('image/') || 
      a.dataUrl.startsWith('data:image/') ||
      /\.(jpe?g|png|webp|gif|bmp)$/i.test(a.nome || '')
    )
  );

  if (imageAttachments.length > 0) {
    const photoWidth = 85;
    const photoHeight = 65;
    const gapX = 12;
    const gapY = 14;

    for (let i = 0; i < imageAttachments.length; i++) {
      const pageIndex = Math.floor(i / 4);
      const indexOnPage = i % 4;

      if (indexOnPage === 0) {
        doc.addPage('a4', 'portrait');

        // Cabeçalho da página fotográfica
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setFillColor(...accentColor);
        doc.rect(0, 20, 210, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('RISEL COMBUSTÍVEIS LTDA', 105, 9, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`REGISTRO FOTOGRÁFICO DE AVARIAS - VEÍCULO: ${placa} (${modelo})`, 105, 15, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...primaryColor);
        doc.text(
          pageIndex === 0
            ? '6. REGISTRO FOTOGRÁFICO DAS AVARIAS E PEÇAS DANIFICADAS'
            : `6. REGISTRO FOTOGRÁFICO DAS AVARIAS (CONTINUAÇÃO - PÁGINA ${pageIndex + 1})`,
          14,
          30
        );
      }

      const att = imageAttachments[i];
      const col = indexOnPage % 2;
      const row = Math.floor(indexOnPage / 2);
      const posX = 14 + col * (photoWidth + gapX);
      const posY = 35 + row * (photoHeight + gapY);

      try {
        // Moldura fotográfica elegante
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(posX, posY, photoWidth, photoHeight, 2, 2, 'FD');

        const processedImg = await prepareImageForJsPdf(att.dataUrl);
        doc.addImage(
          processedImg.dataUrl,
          processedImg.format,
          posX + 2,
          posY + 2,
          photoWidth - 4,
          photoHeight - 12
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(51, 65, 85);
        const caption = att.nome ? `Foto ${i + 1}: ${att.nome}` : `Registro Fotográfico ${i + 1}`;
        doc.text(caption, posX + photoWidth / 2, posY + photoHeight - 4, { align: 'center' });
      } catch (err) {
        console.warn('Erro ao inserir foto no PDF:', err);
      }
    }
  }

  // Seção 7: Arquivos em PDF Anexados -> União em um Único Arquivo Consolidado via pdf-lib
  const pdfAttachments = allAnexos.filter(
    a => a && a.dataUrl && (
      a.tipo === 'application/pdf' ||
      a.dataUrl.startsWith('data:application/pdf') ||
      /\.pdf$/i.test(a.nome || '')
    )
  );

  const jsPdfArrayBuffer = doc.output('arraybuffer');
  let finalPdfBytes: Uint8Array;

  if (pdfAttachments.length > 0) {
    try {
      const mergedDoc = await PDFDocument.load(jsPdfArrayBuffer);

      for (const anexoPdf of pdfAttachments) {
        try {
          let donorBytes: Uint8Array;
          if (anexoPdf.dataUrl.startsWith('data:')) {
            donorBytes = dataUrlToUint8Array(anexoPdf.dataUrl);
          } else {
            const resp = await fetch(anexoPdf.dataUrl);
            const buf = await resp.arrayBuffer();
            donorBytes = new Uint8Array(buf);
          }

          const donorDoc = await PDFDocument.load(donorBytes);
          const copiedPages = await mergedDoc.copyPages(donorDoc, donorDoc.getPageIndices());
          copiedPages.forEach((page) => mergedDoc.addPage(page));
        } catch (donorErr) {
          console.error(`Falha ao mesclar páginas do anexo PDF "${anexoPdf.nome}":`, donorErr);
        }
      }

      finalPdfBytes = await mergedDoc.save();
    } catch (mergeErr) {
      console.error('Erro ao unir documentos PDF:', mergeErr);
      finalPdfBytes = new Uint8Array(jsPdfArrayBuffer);
    }
  } else {
    finalPdfBytes = new Uint8Array(jsPdfArrayBuffer);
  }

  const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
  const pdfDataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(finalPdfBytes)}`;
  const cleanPlate = placa.replace(/[^A-Z0-9]/g, '');
  const fileName = `Termo_Autorizacao_Avaria_${cleanPlate}_${Date.now().toString().slice(-4)}.pdf`;

  return {
    dataUrl: pdfDataUrl,
    blob: pdfBlob,
    fileName,
    doc,
    download: () => {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  };
};

export const generateTermoAvariaEmailHtml = (
  maint: ManutencaoComAvaria,
  avaria: AutorizacaoDescontoAvaria,
  logoUrl: string = RISEL_LOGO_URL
): string => {
  const placa = (maint.placa || 'SEM-PLACA').toUpperCase().trim();
  const modelo = (maint.modelo || 'Veículo Leve').toUpperCase().trim();
  const colaborador = (avaria.colaboradorNome || maint.condutor || 'Colaborador').toUpperCase().trim();
  const base = (avaria.base || maint.base || 'Filial').toUpperCase().trim();
  const osNum = maint.nf_os || `OS-${placa}`;
  const valorDesconto = avaria.valorDesconto || avaria.valorTotalReparo || maint.custo;
  const parcelas = avaria.quantidadeParcelas || 1;
  const valorParcela = avaria.valorParcela || (valorDesconto / parcelas);

  const fmtMoney = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const servicos = Array.isArray(maint.servicos) && maint.servicos.length > 0
    ? maint.servicos
    : [{
        id: '1',
        descricao: maint.descricao || 'Reparo de avaria veicular',
        tipo: 'Serviço' as const,
        quantidade: 1,
        valorUnitario: valorDesconto,
        valorTotal: valorDesconto
      }];

  const servicosRows = servicos
    .map(
      (s, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">${s.descricao}</td>
        <td style="padding: 8px 10px; text-align: center; color: #475569;">${s.tipo}</td>
        <td style="padding: 8px 10px; text-align: center; color: #475569;">${s.quantidade}</td>
        <td style="padding: 8px 10px; text-align: right; color: #1e293b; font-weight: 700;">${fmtMoney(s.valorTotal)}</td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Autorização de Desconto em Folha por Avaria - Risel Combustíveis</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Aptos', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="650" cellpadding="0" cellspacing="0" style="max-width: 650px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Topo Institucional Timbrado Risel -->
          <tr>
            <td style="background-color: #114D38; border-bottom: 3px solid #00A859; padding: 20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60" valign="middle">
                    <img src="${logoUrl}" alt="Risel" width="52" height="52" style="display: block; border-radius: 8px; background: #ffffff; padding: 2px;" />
                  </td>
                  <td style="padding-left: 16px; color: #ffffff;" valign="middle">
                    <h1 style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">RISEL COMBUSTÍVEIS LTDA</h1>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #a7f3d0; font-weight: 500;">TERMO DE AUTORIZAÇÃO DE DESCONTO EM FOLHA POR AVARIA DE VEÍCULO</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 24px 28px;">
              <p style="font-size: 14px; margin-top: 0; color: #334155; line-height: 1.5;">
                Prezado(a) <strong>${colaborador}</strong>,
              </p>
              <p style="font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                Informamos que foi formalizado o registro da <strong>Ordem de Serviço (${osNum})</strong> referente aos reparos de avarias ocorridos no veículo <strong>${placa} (${modelo})</strong>, alocado na base <strong>${base}</strong>.
              </p>

              <!-- Card de Resumo Rápido -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="font-size: 12px; color: #64748b; padding-bottom: 6px;">
                          <strong>Placa do Veículo:</strong> <span style="color: #0f172a; font-weight: 800; font-family: monospace;">${placa}</span>
                        </td>
                        <td width="50%" style="font-size: 12px; color: #64748b; padding-bottom: 6px;">
                          <strong>Modelo:</strong> <span style="color: #0f172a; font-weight: 600;">${modelo}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="font-size: 12px; color: #64748b; padding-bottom: 6px;">
                          <strong>Colaborador Responsável:</strong> <span style="color: #0f172a; font-weight: 600;">${colaborador}</span>
                        </td>
                        <td width="50%" style="font-size: 12px; color: #64748b; padding-bottom: 6px;">
                          <strong>Base Operacional:</strong> <span style="color: #0f172a; font-weight: 600;">${base}</span>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="font-size: 12px; color: #64748b;">
                          <strong>Condição de Desconto:</strong> <span style="color: #b91c1c; font-weight: 700;">${parcelas === 1 ? '1 parcela única' : `${parcelas}x de ${fmtMoney(valorParcela)}`}</span>
                        </td>
                        <td width="50%" style="font-size: 12px; color: #64748b;">
                          <strong>Valor Total a Descontar:</strong> <span style="color: #b91c1c; font-weight: 800; font-size: 14px;">${fmtMoney(valorDesconto)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Tabela de Serviços e Produtos -->
              <h3 style="font-size: 13px; font-weight: 800; color: #114D38; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 0.3px;">
                Serviços e Peças Discriminadas
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 22px;">
                <thead>
                  <tr style="background-color: #114D38; color: #ffffff; font-size: 11px; text-transform: uppercase; font-weight: 700;">
                    <th style="padding: 8px 10px; text-align: center; width: 40px;">#</th>
                    <th style="padding: 8px 10px; text-align: left;">Descrição do Serviço / Peça</th>
                    <th style="padding: 8px 10px; text-align: center; width: 90px;">Categoria</th>
                    <th style="padding: 8px 10px; text-align: center; width: 50px;">Qtd</th>
                    <th style="padding: 8px 10px; text-align: right; width: 100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${servicosRows}
                </tbody>
              </table>

              <!-- Notificação Legal CLT -->
              <div style="background-color: #ecfdf5; border-left: 4px solid #114D38; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 11.5px; color: #064e3b; line-height: 1.5;">
                  <strong>Fundamento Legal:</strong> Conforme preceitua o <em>Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT)</em>, o termo de autorização em anexo formaliza a ciência e anuência do colaborador para o respectivo desconto em folha.
                </p>
              </div>

              <!-- Anexos e PDF -->
              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
                📎 <strong>Documentos em anexo:</strong> O <em>Termo de Autorização de Desconto em Folha (PDF Oficial Timbrado Risel)</em> com o detalhamento dos serviços e as fotos das avarias encontra-se anexado a esta mensagem para arquivamento e conferência.
              </p>
            </td>
          </tr>

          <!-- Rodapé Corporativo -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                <strong>Risel Combustíveis Ltda</strong> &bull; Departamento de Frotas & Operações
              </p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8;">
                Mensagem gerada automaticamente pelo Sistema de Gestão de Frotas Risel.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

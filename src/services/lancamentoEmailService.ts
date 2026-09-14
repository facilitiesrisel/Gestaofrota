import { sendEmail } from "./firebaseService";

export interface LancamentoEmailData {
  id?: number | string;
  fornecedor: string;
  descricao?: string;
  valor: string;
  dataVencimento: string;
  dataEmissao?: string;
  dataLancamento?: string;
  formaPagto?: string;
  formaPagamento?: string;
  tipo?: string;
  tipoDocumento?: string;
  frequencia?: string;
  cnpj?: string;
  estabelecimento?: string;
  centroCusto?: string;
  aprovadores?: string;
  codLancamentoOc?: string;
  codigoLancamento?: string;
  doc?: string;
  status?: string;
  observacao?: string;
  lancadoPor?: string;
  prazo?: string;
  itemSistema?: string;
  nomeArquivoAnexo?: string;
  arquivoAnexoBase64?: string;
  columnOrder?: string[];
  visibleCols?: Record<string, boolean>;
}

/**
 * Converte data ISO (yyyy-mm-dd) ou qualquer formato para dd/mm/aaaa
 */
export function formatDataParaBrasileiro(dataStr?: string): string {
  if (!dataStr) return "-";
  const clean = dataStr.trim();
  if (!clean) return "-";

  // Se já estiver no formato dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }

  // Se estiver no formato yyyy-mm-dd ou similar
  const parts = clean.split("T")[0].split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // yyyy-mm-dd -> dd/mm/aaaa
      const [ano, mes, dia] = parts;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
  }

  // Tenta parse de Date
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  return clean;
}

/**
 * Gera o corpo HTML elegante no padrão corporativo Risel para o e-mail de aprovação de lançamento
 * Tabela Horizontal seguindo a ordem de colunas do usuário com fonte estrita Aptos Narrow 11
 */
export function generateLancamentoAprovacaoEmailHtml(data: LancamentoEmailData): { subject: string; html: string } {
  const fornecedorNome = data.fornecedor || "Fornecedor Não Informado";
  const descricaoServico = data.descricao?.trim() || "Prestação de serviços operacionais / corporativos";
  const vencimentoBr = formatDataParaBrasileiro(data.dataVencimento);
  const emissaoBr = formatDataParaBrasileiro(data.dataEmissao);
  const lancamentoBr = formatDataParaBrasileiro(data.dataLancamento || new Date().toISOString().split("T")[0]);
  const docNumero = data.doc || data.codigoLancamento || "S/N";
  const formaPagto = data.formaPagto || data.formaPagamento || "Boleto";
  const tipoDoc = data.tipo || data.tipoDocumento || "NF-e";
  const frequencia = data.frequencia || "Esporádico";
  const filialBase = data.estabelecimento || "100 - Paulínia";
  const centroCusto = data.centroCusto || "C.C 101 - Operacional";
  const aprovadores = data.aprovadores || "Deny e Gerência";
  const rawStatus = data.status || "Aguardando Aprovação";
  const statusAtual = rawStatus === "Aguardando aprovação" ? "Aguardando Aprovação" : rawStatus;
  const lancadoPor = data.lancadoPor || "Colaborador Risel";
  const codOc = data.codLancamentoOc || data.codigoLancamento || "-";
  const observacoes = data.observacao?.trim() || "";
  const valorFormatado = data.valor || "R$ 0,00";

  // Ordem padrão caso não seja fornecida
  const defaultOrder = [
    "status",
    "vencimento",
    "codLancamento",
    "fornecedor",
    "cnpj",
    "estabelecimento",
    "tipoDocumento",
    "pagamento",
    "centroCusto",
    "valor"
  ];

  const colsToRender = (data.columnOrder && data.columnOrder.length > 0)
    ? data.columnOrder.filter(colKey => {
        if (data.visibleCols && typeof data.visibleCols[colKey] === "boolean") {
          return data.visibleCols[colKey];
        }
        return true;
      })
    : defaultOrder;

  // Dicionário com cabeçalhos e células HTML de cada coluna
  const columnDefs: Record<string, { label: string; align?: string; renderCell: () => string }> = {
    status: {
      label: "STATUS",
      renderCell: () => `
        <span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; border: 1px solid #fde68a; font-weight: 800; font-size: 9pt; text-transform: uppercase; display: inline-block;">
          ⏳ ${statusAtual}
        </span>
      `
    },
    vencimento: {
      label: "VENCIMENTO",
      renderCell: () => `
        <span style="font-weight: 800; color: #b45309; font-size: 11pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${vencimentoBr}
        </span>
      `
    },
    codLancamento: {
      label: "CÓD. / OC",
      renderCell: () => `
        <span style="font-weight: 700; color: #475569; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${codOc}
        </span>
      `
    },
    lancamento: {
      label: "LANÇAMENTO",
      renderCell: () => `
        <span style="color: #475569; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${lancamentoBr}
        </span>
      `
    },
    prazo: {
      label: "PRAZO BOLETO",
      renderCell: () => `
        <span style="color: #475569; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${data.prazo || "-"}
        </span>
      `
    },
    fornecedor: {
      label: "FORNECEDOR",
      renderCell: () => `
        <span style="font-weight: 800; color: #0f172a; font-size: 10.5pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${fornecedorNome}
        </span>
      `
    },
    centroCusto: {
      label: "C.C (CENTRO CUSTO)",
      renderCell: () => `
        <span style="background-color: #ecfdf5; color: #065f46; padding: 4px 8px; border-radius: 4px; border: 1px solid #a7f3d0; font-weight: 800; font-size: 9.5pt; display: inline-block;">
          ${centroCusto}
        </span>
      `
    },
    cnpj: {
      label: "CPF / CNPJ",
      renderCell: () => `
        <span style="color: #475569; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${data.cnpj || "-"}
        </span>
      `
    },
    estabelecimento: {
      label: "FILIAL",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${filialBase}
        </span>
      `
    },
    tipoDocumento: {
      label: "TIPO DOC",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${tipoDoc}
        </span>
      `
    },
    frequencia: {
      label: "FREQUÊNCIA",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${frequencia}
        </span>
      `
    },
    itemSistema: {
      label: "ITEM SISTEMA",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${data.itemSistema || "-"}
        </span>
      `
    },
    lancadoPor: {
      label: "LANÇADO POR",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${lancadoPor}
        </span>
      `
    },
    descricao: {
      label: "DESCRIÇÃO",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${descricaoServico}
        </span>
      `
    },
    documento: {
      label: "DOCUMENTO",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <strong>${tipoDoc}</strong> ${docNumero}
        </span>
      `
    },
    dataEmissao: {
      label: "DATA EMISSÃO",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${emissaoBr}
        </span>
      `
    },
    pagamento: {
      label: "FORMA PAGTO",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${formaPagto}
        </span>
      `
    },
    aprovadores: {
      label: "APROVADORES",
      renderCell: () => `
        <span style="color: #334155; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${aprovadores}
        </span>
      `
    },
    observacao: {
      label: "OBSERVAÇÕES",
      renderCell: () => `
        <span style="color: #475569; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${observacoes || "-"}
        </span>
      `
    },
    valor: {
      label: "VALOR",
      align: "right",
      renderCell: () => `
        <span style="font-weight: 900; color: #065f46; font-size: 12pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${valorFormatado}
        </span>
      `
    }
  };

  // Gerar o HTML dos headers (<th ...>)
  const headersHtml = colsToRender.map(key => {
    const def = columnDefs[key];
    if (!def) return "";
    const align = def.align === "right" ? "text-align: right;" : "text-align: left;";
    return `<th style="padding: 10px 12px; ${align} font-size: 9.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #f47920; border-right: 1px solid rgba(255,255,255,0.15); white-space: nowrap;">${def.label}</th>`;
  }).join("\n");

  // Gerar o HTML das células (<td ...>)
  const cellsHtml = colsToRender.map(key => {
    const def = columnDefs[key];
    if (!def) return "";
    const align = def.align === "right" ? "text-align: right;" : "text-align: left;";
    return `<td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; ${align} white-space: nowrap; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${def.renderCell()}</td>`;
  }).join("\n");

  // Assunto exigido: Aprovação - Nome do Fornecedor - Vencimento
  const subject = `Aprovação - ${fornecedorNome} - ${vencimentoBr}`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body, table, td, th, p, h1, h2, h3, div, span, strong, a { 
          font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
        }
        body { 
          background-color: #f1f5f9; 
          margin: 0; 
          padding: 0; 
          -webkit-font-smoothing: antialiased;
        }
      </style>
    </head>
    <body style="background-color: #f1f5f9; padding: 24px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
      <div style="max-width: 960px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        
        <!-- Header Corporativo Risel -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
          <tr>
            <td bgcolor="#09392b" style="padding: 22px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="52" valign="middle" style="width: 52px; vertical-align: middle;">
                    <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.3); object-fit: cover;" />
                  </td>
                  <td valign="middle" style="padding-left: 18px; vertical-align: middle;">
                    <h1 style="color: #ffffff !important; margin: 0; font-size: 16pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">Solicitação de Aprovação de Lançamento</h1>
                    <p style="color: #86efac !important; margin: 3px 0 0 0; font-size: 10pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Risel Combustíveis Ltda • Sistema de Lançamento de Documentos</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Conteúdo do E-mail -->
        <div style="padding: 26px 28px 26px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b;">
          
          <!-- Texto de Introdução para Encaminhamento Fácil -->
          <p style="font-size: 11pt; color: #334155; margin: 0 0 16px 0; line-height: 1.6; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            Prezados(as), segue para validação e aprovação o documento/fatura lançado(a) no Sistema:
          </p>

          <!-- Bloco em Destaque: Descrição Formatada -->
          <div style="background-color: #f0fdf4; border-left: 5px solid #16a34a; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; border-top: 1px solid #dcfce7; border-right: 1px solid #dcfce7; border-bottom: 1px solid #dcfce7; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <div style="font-size: 10pt; font-weight: 900; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              📝 Descrição:
            </div>
            <div style="font-size: 11.5pt; color: #0f172a; font-weight: 700; line-height: 1.6; white-space: pre-wrap; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              ${descricaoServico}
            </div>
          </div>

          <!-- Tabela Horizontal com Dados do Lançamento (Padrão Tela de Lançamentos) -->
          <div>
            <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <h3 style="margin: 0; font-size: 11.5pt; font-weight: 900; color: #0d4a36; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                📊 Detalhamento do Lançamento
              </h3>
            </div>
            
            <div style="overflow-x: auto;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <thead>
                  <tr bgcolor="#114D38" style="background-color: #114D38; color: #ffffff;">
                    ${headersHtml}
                  </tr>
                </thead>
                <tbody>
                  <tr bgcolor="#ffffff" style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
                    ${cellsHtml}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Envia o e-mail de aprovação com anexo automático para lorena.padilha@risel.com.br e deny.goncalves@risel.com.br
 */
export async function sendLancamentoAprovacaoEmail(data: LancamentoEmailData): Promise<boolean> {
  const DESTINATARIOS_OFICIAIS = ["lorena.padilha@risel.com.br", "deny.goncalves@risel.com.br"];
  
  try {
    const { subject, html } = generateLancamentoAprovacaoEmailHtml(data);

    const attachments: Array<{ filename: string; content?: string; dataUrl?: string; contentType?: string; path?: string }> = [];

    // Suporta todas as variações de propriedades onde o anexo pode estar no objeto
    const anyData = data as any;
    const nomeAnexo = data.nomeArquivoAnexo || anyData.nomeArquivo || anyData.fileName || anyData.name || "Documento_Fiscal.pdf";
    const base64Data = data.arquivoAnexoBase64 || anyData.arquivo_anexo_base64 || anyData.base64 || anyData.dataUrl || anyData.fileBase64;
    const urlAnexo = anyData.anexoUrl || anyData.comprovanteUrl || anyData.url || anyData.driveUrl;

    if (base64Data && typeof base64Data === 'string' && base64Data.trim().length > 0) {
      attachments.push({
        filename: nomeAnexo,
        content: base64Data,
        dataUrl: base64Data
      });
      console.log(`[Risel Email] Anexo detectado para envio: ${nomeAnexo} (${Math.round(base64Data.length / 1024)} KB)`);
    } else if (urlAnexo && typeof urlAnexo === 'string' && urlAnexo.startsWith('http')) {
      attachments.push({
        filename: nomeAnexo,
        path: urlAnexo
      });
      console.log(`[Risel Email] Anexo por URL detectado para envio: ${nomeAnexo} -> ${urlAnexo}`);
    }

    console.log(`[Risel Email] Disparando e-mail de aprovação para [${DESTINATARIOS_OFICIAIS.join(', ')}]: "${subject}" | Anexos: ${attachments.length}`);

    await sendEmail(DESTINATARIOS_OFICIAIS, subject, html, {
      fromName: "Sistema de Documentos Risel",
      source: "documentos",
      attachments: attachments.length > 0 ? attachments : undefined
    });

    return true;
  } catch (err) {
    console.error("[Risel Email] Erro ao enviar e-mail de aprovação de lançamento:", err);
    return false;
  }
}

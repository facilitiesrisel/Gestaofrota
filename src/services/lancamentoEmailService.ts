import { sendEmail } from "./firebaseService";
import { getSubmoduleRecipientsSync } from "./emailRecipientsService";

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
  destinatariosPara?: string[];
  destinatariosCc?: string[];
  saudacaoPersonalizada?: string;
}

/**
 * Destinatários e cópias padrão corporativos oficiais da Risel para lançamentos
 */
export const DEFAULT_LANCAMENTO_TO_EMAILS = [
  "csouza@risel.com.br",
  "wbreda@risel.com.br",
  "deny.goncalves@risel.com.br"
];

export const DEFAULT_LANCAMENTO_CC_EMAILS = [
  "lorena.padilha@risel.com.br",
  "deny.goncalves@risel.com.br"
];

/**
 * Retorna a saudação específica caso haja apenas 1 destinatário, ou "Prezados(as)," se houver múltiplos
 */
export function getSaudacaoDestinatarios(recipients?: string[]): string {
  if (!recipients || recipients.length === 0) {
    return "Prezados(as),";
  }

  const valid = recipients
    .map(r => (typeof r === "string" ? r.trim().toLowerCase() : ""))
    .filter(r => r.length > 0 && r.includes("@"));

  if (valid.length === 1) {
    const email = valid[0];
    if (email.includes("csouza") || email.includes("cesar")) {
      return "Prezado Cesar,";
    }
    if (email.includes("wbreda") || email.includes("wesley")) {
      return "Prezado Wesley,";
    }
    if (email.includes("deny.goncalves") || email.includes("deny")) {
      return "Prezado Deny,";
    }
    if (email.includes("lorena.padilha") || email.includes("lorena")) {
      return "Prezada Lorena,";
    }

    const namePart = email.split("@")[0].split(/[._-]/)[0];
    if (namePart && namePart.length >= 2) {
      const formatted = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
      return `Prezado(a) ${formatted},`;
    }
  }

  return "Prezados(as),";
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
 * Tabela Horizontal alinhada à esquerda na ordem solicitada:
 * Status, Data do Lançamento, Nº Documento, Fornecedor, Nº Estabelecimento, Nº Lançamento/OC, Descrição, Valor, Vencimento.
 * Sem textos externos ao layout corporativo.
 */
export function generateLancamentoAprovacaoEmailHtml(data: LancamentoEmailData): { subject: string; html: string; saudacao: string } {
  const fornecedorNome = data.fornecedor || "Fornecedor Não Informado";
  const descricaoServico = data.descricao?.trim() || "Prestação de serviços operacionais / corporativos";
  const vencimentoBr = formatDataParaBrasileiro(data.dataVencimento);
  const emissaoBr = formatDataParaBrasileiro(data.dataEmissao);
  const lancamentoBr = formatDataParaBrasileiro(data.dataLancamento || new Date().toISOString().split("T")[0]);
  const tipoDoc = data.tipo || data.tipoDocumento || "NF-e";

  // No e-mail enviado, no campo Nº DOCUMENTO, deixar somente o que for digitado no campo Nº Documento
  let docNumero = (data.codigoLancamento && String(data.codigoLancamento).trim()) 
    ? String(data.codigoLancamento).trim() 
    : (data.doc ? String(data.doc).trim() : "S/N");

  // Se o número herdado do campo doc contiver o prefixo do tipo (ex: "NF-e 1902" ou "Fatura 554"), limpa o tipo
  if (tipoDoc && docNumero.toLowerCase().startsWith(tipoDoc.toLowerCase() + " ")) {
    docNumero = docNumero.substring(tipoDoc.length).trim();
  } else if (data.tipoDocumento && docNumero.toLowerCase().startsWith(data.tipoDocumento.toLowerCase() + " ")) {
    docNumero = docNumero.substring(data.tipoDocumento.length).trim();
  }
  const formaPagto = data.formaPagto || data.formaPagamento || "Boleto";
  const filialBase = data.estabelecimento || "100 - Paulínia";
  const rawStatus = data.status || "Aguardando Aprovação";
  const statusAtual = rawStatus === "Aguardando aprovação" ? "Aguardando Aprovação" : rawStatus;
  const lancadoPor = data.lancadoPor || "Colaborador Risel";
  const codOc = data.codLancamentoOc || data.codigoLancamento || "-";
  const observacoes = data.observacao?.trim() || "";
  const valorFormatado = data.valor || "R$ 0,00";

  // Saudação contextual
  const saudacao = data.saudacaoPersonalizada || getSaudacaoDestinatarios(data.destinatariosPara);

  // Ordem estrita solicitada pelo usuário:
  // 1. Status
  // 2. Data do Lançamento
  // 3. Nº Documento
  // 4. Fornecedor
  // 5. Nº Estabelecimento
  // 6. Nº Lançamento/OC
  // 7. Descrição (mais larga com textos longos)
  // 8. Valor
  // 9. Vencimento
  const colsToRender = [
    "status",
    "lancamento",
    "documento",
    "fornecedor",
    "estabelecimento",
    "codLancamento",
    "descricao",
    "valor",
    "vencimento"
  ];

  // Dicionário com cabeçalhos e células HTML de cada coluna
  const columnDefs: Record<string, { label: string; align?: string; minWidth?: string; maxWidth?: string; renderCell: () => string }> = {
    status: {
      label: "STATUS",
      minWidth: "140px",
      renderCell: () => `
        <span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; border: 1px solid #fde68a; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; display: inline-block; white-space: nowrap;">
          ⏳ ${statusAtual}
        </span>
      `
    },
    lancamento: {
      label: "DATA DO LANÇAMENTO",
      minWidth: "130px",
      renderCell: () => `
        <span style="color: #334155; font-size: 9.5pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${lancamentoBr}
        </span>
      `
    },
    documento: {
      label: "Nº DOCUMENTO",
      minWidth: "120px",
      renderCell: () => `
        <span style="color: #0f172a; font-size: 9.5pt; font-weight: 700; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${docNumero}
        </span>
      `
    },
    fornecedor: {
      label: "FORNECEDOR",
      minWidth: "180px",
      renderCell: () => `
        <span style="font-weight: 700; color: #0f172a; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${fornecedorNome}
        </span>
      `
    },
    estabelecimento: {
      label: "Nº ESTABELECIMENTO",
      minWidth: "140px",
      renderCell: () => `
        <span style="color: #334155; font-size: 9.5pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${filialBase}
        </span>
      `
    },
    codLancamento: {
      label: "Nº LANÇAMENTO / OC",
      minWidth: "130px",
      renderCell: () => `
        <span style="color: #475569; font-size: 9.5pt; font-weight: 600; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${codOc}
        </span>
      `
    },
    descricao: {
      label: "DESCRIÇÃO",
      minWidth: "280px",
      maxWidth: "420px",
      renderCell: () => `
        <div style="color: #334155; font-size: 9.5pt; line-height: 1.4; word-break: break-word; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${descricaoServico}
        </div>
      `
    },
    valor: {
      label: "VALOR",
      align: "right",
      minWidth: "110px",
      renderCell: () => `
        <span style="font-weight: 800; color: #065f46; font-size: 10.5pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${valorFormatado}
        </span>
      `
    },
    vencimento: {
      label: "VENCIMENTO",
      minWidth: "110px",
      renderCell: () => `
        <span style="font-weight: 700; color: #b45309; font-size: 10pt; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; white-space: nowrap;">
          ${vencimentoBr}
        </span>
      `
    }
  };

  // Gerar o HTML dos headers (<th ...>)
  const headersHtml = colsToRender.map(key => {
    const def = columnDefs[key];
    if (!def) return "";
    const align = def.align === "right" ? "text-align: right;" : "text-align: left;";
    const minW = def.minWidth ? `min-width: ${def.minWidth};` : "";
    const maxW = def.maxWidth ? `max-width: ${def.maxWidth};` : "";
    return `<th style="padding: 10px 12px; ${align} ${minW} ${maxW} font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #f47920; border-right: 1px solid rgba(255,255,255,0.15); white-space: nowrap;">${def.label}</th>`;
  }).join("\n");

  // Gerar o HTML das células (<td ...>)
  const cellsHtml = colsToRender.map(key => {
    const def = columnDefs[key];
    if (!def) return "";
    const align = def.align === "right" ? "text-align: right;" : "text-align: left;";
    const minW = def.minWidth ? `min-width: ${def.minWidth};` : "";
    const maxW = def.maxWidth ? `max-width: ${def.maxWidth};` : "";
    return `<td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; ${align} ${minW} ${maxW} font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${def.renderCell()}</td>`;
  }).join("\n");

  // Assunto exigido: Aprovação - Nome do Fornecedor - Vencimento
  const subject = `Aprovação - ${fornecedorNome} - ${vencimentoBr}`;

  // NOTA CRÍTICA: Não adicionamos tag <title> ou preheaders soltos que apareçam fora da tabela elegante nos webmails/clientes de e-mail!
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    <body style="background-color: #f1f5f9; padding: 20px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt;">
      <!-- Preheader oculto para evitar que visualizadores mostrem textos soltos acima do card -->
      <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 0px; line-height: 0px; opacity: 0;">
        Solicitação de Aprovação de Lançamento - Risel Combustíveis Ltda
      </div>

      <div style="max-width: 1060px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #cbd5e1; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        
        <!-- Header Corporativo Risel -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
          <tr>
            <td bgcolor="#09392b" style="padding: 20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td width="52" valign="middle" style="width: 52px; vertical-align: middle;">
                    <img src="https://i.ibb.co/My6STcDv/71144827-2525571747712417-6231227587708846080-n.jpg" alt="Logo Risel" width="48" height="48" style="width: 48px; height: 48px; border-radius: 8px; display: block; border: 2px solid rgba(255,255,255,0.3); object-fit: cover;" />
                  </td>
                  <td valign="middle" style="padding-left: 16px; vertical-align: middle;">
                    <h1 style="color: #ffffff !important; margin: 0; font-size: 15pt; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">SOLICITAÇÃO DE APROVAÇÃO DE LANÇAMENTO</h1>
                    <p style="color: #86efac !important; margin: 3px 0 0 0; font-size: 9.5pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Risel Combustíveis Ltda • Sistema de Lançamento de Documentos</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Conteúdo do E-mail -->
        <div style="padding: 24px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; text-align: left;">
          
          <!-- Saudação e Introdução com Descrição Integrada -->
          <div style="background-color: #f8fafc; border-left: 5px solid #0d4a36; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; text-align: left;">
            <p style="font-size: 11.5pt; color: #0d4a36; margin: 0 0 6px 0; font-weight: 800; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              ${saudacao}
            </p>
            <p style="font-size: 10.5pt; color: #334155; margin: 0; line-height: 1.5; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              Segue documento fiscal para conferência e aprovação de lançamento.
            </p>
          </div>

          <!-- Tabela Horizontal com Dados do Lançamento alinhada à esquerda -->
          <div style="text-align: left; margin: 0;">
            <div style="margin-bottom: 8px; text-align: left;">
              <h3 style="margin: 0; font-size: 11pt; font-weight: 900; color: #0d4a36; text-transform: uppercase; letter-spacing: 0.4px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                📋 Detalhamento do Lançamento
              </h3>
            </div>
            
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; text-align: left; margin: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" align="left" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; text-align: left; margin: 0;">
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

          ${observacoes ? `
          <div style="margin-top: 18px; padding: 10px 14px; background-color: #f1f5f9; border-radius: 6px; font-size: 9.5pt; color: #475569; text-align: left;">
            <strong>Observações do Lançador:</strong> ${observacoes}
          </div>
          ` : ""}

          <!-- Assinatura Oficial Padronizada Risel Combustíveis Ltda -->
          <table cellpadding="0" cellspacing="0" border="0" align="left" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; width: 100%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; text-align: left;">
            <tr>
              <td style="vertical-align: middle; width: 52px; padding-right: 14px; border-right: 2px solid #e2e8f0;">
                <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                  <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Risel Combustíveis" style="max-height: 38px; width: auto; display: block; border: 0;" />
                </a>
              </td>
              <td style="vertical-align: middle; padding-left: 14px; text-align: left;">
                <div style="font-size: 11.5pt; font-weight: 800; color: #0d4a36; line-height: 1.2;">
                  Risel Combustíveis Ltda
                </div>
                <div style="font-size: 9pt; color: #64748b; margin-top: 3px; line-height: 1.4;">
                  Sistema Integrado de Gestão Corporativa | Gestão Financeira & Lançamentos
                </div>
                <div style="font-size: 8.5pt; color: #94a3b8; margin-top: 2px;">
                  Mensagem corporativa gerada automaticamente para fluxo de aprovação de documentos.
                </div>
              </td>
            </tr>
          </table>

        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html, saudacao };
}

/**
 * Envia o e-mail de aprovação com anexo automático para os destinatários selecionados
 * e quem vai em cópia (com padrões oficiais predefinidos)
 */
export async function sendLancamentoAprovacaoEmail(data: LancamentoEmailData): Promise<boolean> {
  // Destinatários principais: usar os passados em data.destinatariosPara ou o padrão
  const targetTo = (data.destinatariosPara && data.destinatariosPara.length > 0)
    ? Array.from(new Set(data.destinatariosPara.filter(Boolean)))
    : DEFAULT_LANCAMENTO_TO_EMAILS;

  // Cópia (CC): usar os passados em data.destinatariosCc ou o padrão
  const targetCc = (data.destinatariosCc && data.destinatariosCc.length > 0)
    ? Array.from(new Set(data.destinatariosCc.filter(Boolean)))
    : DEFAULT_LANCAMENTO_CC_EMAILS;
  
  try {
    const { subject, html } = generateLancamentoAprovacaoEmailHtml({
      ...data,
      destinatariosPara: targetTo,
      destinatariosCc: targetCc
    });

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

    console.log(`[Risel Email] Disparando e-mail de aprovação para [${targetTo.join(', ')}] (CC: [${targetCc.join(', ')}]): "${subject}" | Anexos: ${attachments.length}`);

    await sendEmail(targetTo, subject, html, {
      fromName: "Sistema de Documentos Risel",
      source: "documentos",
      cc: targetCc.length > 0 ? targetCc : undefined,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    return true;
  } catch (err) {
    console.error("[Risel Email] Erro ao enviar e-mail de aprovação de lançamento:", err);
    return false;
  }
}


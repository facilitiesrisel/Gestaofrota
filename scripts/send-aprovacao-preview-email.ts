import nodemailer from "nodemailer";
import { generateLancamentoAprovacaoEmailHtml, LancamentoEmailData } from "../src/services/lancamentoEmailService";

/**
 * Script de Envio do E-mail Oficial de Aprovação de Lançamento
 * Destinatário Único Solicitado: deny.goncalves@risel.com.br
 * Validação: Tabela horizontal exclusiva com campos em negrito nos cabeçalhos e valores despoluídos sem negrito.
 */

const TARGET_EMAIL = "deny.goncalves@risel.com.br";
const SMTP_USER = "gestaodefrotarisel@gmail.com";
const SMTP_PASS = "aeczbopvnpocoezw";
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

async function main() {
  console.log(`[Aprovação Lançamento] Gerando e-mail de aprovação oficial para ${TARGET_EMAIL}...`);

  const mockLancamento: LancamentoEmailData = {
    fornecedor: "Posto Modelo de Paulínia Comércio Ltda",
    descricao: "Fornecimento de combustível e insumos operacionais - Frota Operacional",
    valor: "R$ 48.750,00",
    dataVencimento: "2026-10-05",
    dataEmissao: "2026-09-12",
    dataLancamento: "2026-09-15",
    formaPagto: "Boleto Bancário (30 DD)",
    tipo: "NF-e",
    frequencia: "Mensal",
    cnpj: "45.892.314/0001-82",
    estabelecimento: "100 - Paulínia",
    centroCusto: "C.C 101 - Operacional",
    aprovadores: "Deny Gonçalves e Diretoria",
    codLancamentoOc: "OC-2026-9812",
    codigoLancamento: "OC-2026-9812",
    doc: "184920",
    status: "Aguardando Aprovação",
    observacao: "Faturamento com vencimento em 05/10/2026. Documentação fiscal anexada e conferida.",
    lancadoPor: "Deny Gonçalves",
    prazo: "30 Dias",
    itemSistema: "Combustível Frota",
    columnOrder: [
      "status",
      "vencimento",
      "codLancamento",
      "fornecedor",
      "cnpj",
      "estabelecimento",
      "tipoDocumento",
      "centroCusto",
      "pagamento",
      "valor"
    ]
  };

  const { subject, html } = generateLancamentoAprovacaoEmailHtml(mockLancamento);

  console.log(`[Aprovação Lançamento] Assunto gerado: "${subject}"`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: '"Risel Combustíveis" <gestaodefrotarisel@gmail.com>',
    to: TARGET_EMAIL,
    subject: subject,
    html: html,
  });

  console.log(`[Aprovação Lançamento] E-mail enviado com sucesso para ${TARGET_EMAIL}! MessageId: ${info.messageId}`);
}

main().catch((err) => {
  console.error("[Aprovação Lançamento] Erro no envio:", err);
  process.exit(1);
});

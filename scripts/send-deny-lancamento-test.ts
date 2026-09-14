import nodemailer from "nodemailer";
import { generateLancamentoAprovacaoEmailHtml } from "../src/services/lancamentoEmailService";

const TARGET_EMAIL = "deny.goncalves@risel.com.br";

async function sendEmailDeny() {
  console.log(`Disparando e-mail de teste atualizado para ${TARGET_EMAIL}...`);

  const dummyPdfBase64 = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
  ).toString("base64");

  const emailData = generateLancamentoAprovacaoEmailHtml({
    fornecedor: "Posto Modelo de Paulínia Comércio de Combustíveis Ltda",
    descricao: "Fornecimento de combustível diesel S-10 a granel para abastecimento da frota de carretas bitrem da unidade Paulínia, referente à 2ª quinzena.",
    valor: "R$ 48.750,00",
    dataVencimento: "2026-10-05",
    dataEmissao: "2026-09-20",
    cnpj: "45.892.314/0001-82",
    doc: "184920",
    tipoDocumento: "NF-e",
    formaPagamento: "Boleto Bancário (30 DD)",
    frequencia: "Mensal",
    estabelecimento: "100 - Paulínia Matriz",
    centroCusto: "C.C 101 - Operacional Frotas",
    aprovadores: "Deny e Diretoria Executiva",
    status: "Aguardando aprovação",
    lancadoPor: "Lorena Padilha",
    codLancamentoOc: "OC-2026-9812",
    observacao: "Fatura validada com medição do tanque central e notas de abastecimento assinadas.",
    nomeArquivoAnexo: "NFe_184920_Posto_Modelo_Paulinea.pdf",
    arquivoAnexoBase64: dummyPdfBase64
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "gestaodefrotarisel@gmail.com",
      pass: "aeczbopvnpocoezw"
    }
  });

  const info = await transporter.sendMail({
    from: `"Sistema de Documentos Risel" <gestaodefrotarisel@gmail.com>`,
    to: TARGET_EMAIL,
    subject: emailData.subject,
    html: emailData.html,
    attachments: [
      {
        filename: "NFe_184920_Posto_Modelo_Paulinea.pdf",
        content: dummyPdfBase64,
        encoding: "base64",
        contentType: "application/pdf"
      }
    ]
  });

  console.log("Sucesso! Message ID:", info.messageId);
  console.log("Assunto enviado:", emailData.subject);
}

sendEmailDeny().catch(console.error);

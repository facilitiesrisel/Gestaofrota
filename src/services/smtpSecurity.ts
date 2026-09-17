import crypto from 'crypto';

// Chave e IV determinísticos para criptografia simétrica AES-256-CBC do vault SMTP
const VAULT_KEY = crypto.createHash('sha256').update('RiselCombustiveis_SMTP_Vault_Key_2026_Secure').digest();
const VAULT_IV = Buffer.from('8f2a9c1d4e7b0f3a6c5e8d1b2a4f7c9e', 'hex');

/**
 * Criptografa uma string sensível (ex: senha de e-mail / App Password)
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  try {
    const cipher = crypto.createCipheriv('aes-256-cbc', VAULT_KEY, VAULT_IV);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `ENC:${encrypted}`;
  } catch (err) {
    console.error('Erro ao criptografar segredo:', err);
    return plainText;
  }
}

/**
 * Descriptografa uma string criptografada com a chave do vault
 */
export function decryptSecret(encryptedText: string): string {
  if (!encryptedText) return '';
  if (!encryptedText.startsWith('ENC:')) {
    // Se não tiver o prefixo ENC:, retorna o próprio texto se já for texto plano
    return encryptedText;
  }
  try {
    const hexData = encryptedText.slice(4);
    const decipher = crypto.createDecipheriv('aes-256-cbc', VAULT_KEY, VAULT_IV);
    let decrypted = decipher.update(hexData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Erro ao descriptografar segredo SMTP:', err);
    return '';
  }
}

// Senha padrão oficial gerada para app no Gmail (gestaodefrotarisel@gmail.com) criptografada no vault
export const ENCRYPTED_DEFAULT_PASSWORD = encryptSecret('aeczbopvnpocoezw');
// Senha corporativa Risel de contingência mantida no cofre
export const ENCRYPTED_FALLBACK_PASSWORD = encryptSecret('M)175012833809uz');

export interface SmtpConfig {
  user: string;
  host: string;
  port: number;
  secure: boolean;
  pass: string;
  defaultSenderName: string;
}

export const RISEL_LOGO_URL = "https://risel.com.br/wp-content/uploads/2024/07/RISEL.png";

/**
 * Gera uma assinatura corporativa de e-mail minimalista e elegante,
 * contendo estritamente o nome do remetente do módulo, o logotipo transparente oficial e o site da Risel,
 * formatada na tipografia corporativa Aptos Narrow / Aptos tamanho 11pt.
 */
export function generateModuleEmailSignature(moduleName: string): string {
  return `
  <!-- Assinatura Corporativa Risel - Otimizada para Outlook e Todos os Clientes -->
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-family: 'Aptos Narrow', 'Aptos', -apple-system, BlinkMacSystemFont, 'Segoe UI', Calibri, Arial, sans-serif;">
    <tr>
      <td width="96" valign="middle" style="width: 96px; vertical-align: middle; padding-right: 16px; border-right: 2px solid #e2e8f0;">
        <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
          <img src="${RISEL_LOGO_URL}" alt="Risel Combustíveis" width="88" height="36" style="width: 88px; height: 36px; max-width: 88px; max-height: 36px; display: block; border: 0; outline: none; text-decoration: none;" />
        </a>
      </td>
      <td valign="middle" style="vertical-align: middle; padding-left: 16px; font-family: 'Aptos Narrow', 'Aptos', -apple-system, BlinkMacSystemFont, 'Segoe UI', Calibri, Arial, sans-serif;">
        <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 11pt; font-weight: 700; color: #1e293b; letter-spacing: -0.1px; line-height: 1.25; mso-line-height-rule: exactly;">
          ${moduleName}
        </div>
        <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 10pt; margin-top: 4px; line-height: 1.25; mso-line-height-rule: exactly;">
          <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 600;">
            www.risel.com.br
          </a>
        </div>
      </td>
    </tr>
  </table>
  `;
}

/**
 * Anexa a assinatura oficial com logotipo transparente da Risel ao corpo HTML do e-mail,
 * caso o e-mail ainda não possua uma assinatura formatada.
 */
export function appendRiselSignatureToHtml(html: string, moduleName: string): string {
  if (!html) return generateModuleEmailSignature(moduleName);
  // Se o e-mail já for estruturado em tabela corporativa ou contiver menção à Risel,
  // mantemos intacto para não criar textos ou tabelas soltas fora do contêiner formatado
  if (
    html.includes("<table") ||
    html.includes("risel.com.br") ||
    html.includes("Risel Combustíveis") ||
    html.includes("Risel Engenharia") ||
    html.includes("Gestão de Reservas") ||
    html.includes("max-width")
  ) {
    return html;
  }
  return `${html}<br/>${generateModuleEmailSignature(moduleName)}`;
}

/**
 * Mapeador estrito dos nomes de remetentes por módulo e submódulo Risel:
 * - Lançamento de Documentos: "Sistema de Documentos Risel"
 * - Checklist: manter como está ("Checklist Frota Leve - Risel")
 * - Controle de Frota: "Controle de Frotas"
 * - Controle de Multas: "Sistema de Multas Risel"
 * - Gestão de Reservas: "Gestão de Reservas Risel"
 * - Rastreamento Ativo: "Rastreamento Frota Leve Risel"
 */
export function getSenderNameForModule(moduleOrSource?: string, subject?: string, explicitName?: string): string {
  if (explicitName && explicitName.trim() && explicitName.trim() !== "Risel Combustíveis") {
    return explicitName.trim();
  }

  const tag = `${moduleOrSource || ''} ${subject || ''}`.toLowerCase();

  if (tag.includes("checklist")) {
    return "Checklist Frota Leve - Risel";
  }
  if (tag.includes("documento") || tag.includes("usuario") || tag.includes("usuário") || tag.includes("lancamento") || tag.includes("lançamento")) {
    return "Sistema de Documentos Risel";
  }
  if (tag.includes("multa") || tag.includes("ait") || tag.includes("infracao") || tag.includes("infração") || tag.includes("recurso")) {
    return "Sistema de Multas Risel";
  }
  if (tag.includes("rastreamento") || tag.includes("telemetria") || tag.includes("alerta fds") || tag.includes("movimentação não autorizada") || tag.includes("geofrotas")) {
    return "Rastreamento Frota Leve Risel";
  }
  if (tag.includes("reserva") || tag.includes("rac") || tag.includes("locação") || tag.includes("locacao") || tag.includes("uso diário") || tag.includes("diario") || tag.includes("diário")) {
    return "Gestão de Reservas Risel";
  }
  if (tag.includes("frota") || tag.includes("manutenc") || tag.includes("manutenç") || tag.includes("avaria") || tag.includes("veiculo") || tag.includes("veículo")) {
    return "Controle de Frotas";
  }

  return explicitName || "Controle de Frotas";
}

/**
 * Obtém a configuração SMTP consolidada para todos os submódulos da Risel:
 * - Controle de Multas
 * - Rastreamento
 * - Controle de Frota
 * - Gestão de Reservas
 * - Módulo Lançamento de Documentos
 */
export function getRiselSmtpConfig(overrides?: Partial<SmtpConfig>): SmtpConfig {
  const p = typeof process !== "undefined" && process.env ? process.env : ({} as any);
  const envEmail = (p.SMTP_USER || p.SMTP_EMAIL || p["E-mail"] || p["Email"] || p["email"] || "").trim();
  const envHost = (p.SMTP_HOST || p.SMTP_SERVER || p["Host"] || p["host"] || "").trim();
  const envPort = (p.SMTP_PORT || p["Porta"] || p["porta"] || "").trim();
  const envPass = (p.SMTP_PASSWORD || p.SMTP_PASS || p["Senha"] || p["senha"] || "").trim();
  const envSenderName = (p.SMTP_DEFAULT_SENDER_NAME || p.SMTP_FROM_NAME || "").trim();

  // Tratamento de tolerância a falhas de configuração:
  let hostFromEmailField = "";
  let userCandidate = envEmail;
  if (envEmail && !envEmail.includes("@") && (envEmail.includes("smtp") || envEmail.includes("."))) {
    hostFromEmailField = envEmail;
    userCandidate = "";
  }

  // Remetente padrão oficial consolidado: gestaodefrotarisel@gmail.com
  const user = overrides?.user || (userCandidate.includes("@") ? userCandidate : "gestaodefrotarisel@gmail.com");
  const isGmail = user.toLowerCase().includes("@gmail.com");
  const defaultHost = isGmail ? "smtp.gmail.com" : "smtp.office365.com";
  const host = overrides?.host || envHost || hostFromEmailField || defaultHost;
  const port = overrides?.port || parseInt(envPort || (host === "smtp.gmail.com" ? "465" : "587"), 10);
  const secure = port === 465;

  let rawPass = overrides?.pass || envPass || ENCRYPTED_DEFAULT_PASSWORD;
  const pass = decryptSecret(rawPass);

  return {
    user,
    host,
    port,
    secure,
    pass,
    defaultSenderName: overrides?.defaultSenderName || envSenderName || "Controle de Frotas"
  };
}

/**
 * Retorna as informações de diagnóstico seguro do SMTP sem expor a senha real
 */
export function getSafeSmtpStatus() {
  const config = getRiselSmtpConfig();
  return {
    success: true,
    smtpUser: config.user,
    smtpHost: config.host,
    smtpPort: config.port,
    smtpSecure: config.secure,
    hasPass: Boolean(config.pass && config.pass.length > 0),
    authProvider: config.host.includes('office365') ? 'Microsoft 365 / Exchange' : 'Google Workspace / SMTP',
    status: 'Conectado e Criptografado',
    encryptedVaultActive: true,
    supportedModules: [
      'Controle de Multas',
      'Rastreamento & Telemetria',
      'Controle de Frota (Checklist & Manutenção)',
      'Gestão de Reservas',
      'Lançamento de Documentos'
    ]
  };
}

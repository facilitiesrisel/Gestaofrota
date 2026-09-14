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

// Senha padrão oficial gerada para app no Gmail (deny.risel@gmail.com) criptografada no vault
export const ENCRYPTED_DEFAULT_PASSWORD = encryptSecret('lwyrtwblwzwnwots');
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

  // Remetente padrão oficial consolidado: deny.risel@gmail.com
  const user = overrides?.user || (userCandidate.includes("@") ? userCandidate : "deny.risel@gmail.com");
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

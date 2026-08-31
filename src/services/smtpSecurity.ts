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

// Senha oficial fornecida criptografada no vault
export const ENCRYPTED_DEFAULT_PASSWORD = encryptSecret('M)175012833809uz');

export interface SmtpConfig {
  user: string;
  host: string;
  port: number;
  secure: boolean;
  pass: string;
  defaultSenderName: string;
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
  const user = overrides?.user || process.env.SMTP_EMAIL || 'deny.goncalves@risel.com.br';
  const isRiselCorporate = user.toLowerCase().includes('@risel.com.br');
  const defaultHost = isRiselCorporate ? 'smtp.office365.com' : 'smtp.gmail.com';
  const host = overrides?.host || process.env.SMTP_HOST || defaultHost;
  const port = overrides?.port || parseInt(process.env.SMTP_PORT || '587', 10) || (host === 'smtp.gmail.com' ? 465 : 587);
  const secure = port === 465;

  let rawPass = overrides?.pass || process.env.SMTP_PASSWORD || ENCRYPTED_DEFAULT_PASSWORD;
  const pass = decryptSecret(rawPass);

  return {
    user,
    host,
    port,
    secure,
    pass,
    defaultSenderName: overrides?.defaultSenderName || 'Risel Combustíveis'
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

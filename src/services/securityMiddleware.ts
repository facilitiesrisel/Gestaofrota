import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

/**
 * Opções restritas de sanitização de HTML para e-mails e inputs
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span', 'img'
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'style', 'class'],
    img: ['src', 'alt', 'width', 'height', 'style', 'class'],
    div: ['style', 'class', 'id'],
    span: ['style', 'class'],
    table: ['style', 'class', 'border', 'cellpadding', 'cellspacing', 'width'],
    tr: ['style', 'class'],
    td: ['style', 'class', 'colspan', 'rowspan', 'width'],
    th: ['style', 'class', 'colspan', 'rowspan', 'width'],
    p: ['style', 'class'],
    h1: ['style', 'class'],
    h2: ['style', 'class'],
    h3: ['style', 'class'],
    h4: ['style', 'class']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  selfClosing: ['img', 'br', 'hr']
};

/**
 * Sanitiza conteúdo HTML para prevenir Cross-Site Scripting (XSS)
 */
export function cleanHtmlContent(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

/**
 * Middleware para validar e sanitizar strings recebidas no body
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: any) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Se for campo de html mantemos tags permitidas, senão limpamos tags perigosas como <script>
      if (key === 'html' || key === 'htmlContent') {
        obj[key] = cleanHtmlContent(val);
      } else {
        // Remove tags HTML de campos normais (ex: subject, names, emails)
        obj[key] = sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} });
      }
    } else if (typeof val === 'object' && val !== null && !Buffer.isBuffer(val)) {
      sanitizeObject(val);
    }
  }
}

/**
 * Verifica se um host é de rede privada, loopback ou endereço de metadados de nuvem (Prevenção de SSRF)
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim();

  // Bloqueia nomes óbvios de loopback e metadados
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal' ||
    host === '169.254.169.254' // Endereço de metadados AWS/GCP/Azure
  ) {
    return true;
  }

  // Se for endereço IPv4, verifica faixas privadas RFC 1918 e Link-Local
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const b0 = parseInt(ipv4Match[1], 10);
    const b1 = parseInt(ipv4Match[2], 10);

    // 10.0.0.0/8
    if (b0 === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (b0 === 127) return true;
    // 172.16.0.0/12
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (b0 === 169 && b1 === 254) return true;
    // 0.0.0.0/8
    if (b0 === 0) return true;
  }

  return false;
}

/**
 * Validador estrito de URLs externas para prevenir SSRF (Server-Side Request Forgery)
 */
export function isValidSafeHttpsUrl(urlString: string, allowedHostSuffixes?: string[]): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== 'https:') return false;
    if (isPrivateOrLoopbackHost(parsed.hostname)) return false;

    if (allowedHostSuffixes && allowedHostSuffixes.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const isAllowed = allowedHostSuffixes.some(suffix => host === suffix || host.endsWith('.' + suffix));
      if (!isAllowed) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validação de URL do Google Apps Script
 */
export function validateAppsScriptUrl(url: string): boolean {
  return isValidSafeHttpsUrl(url, ['script.google.com', 'script.googleusercontent.com']);
}

/**
 * Validação de URL do Microsoft OneDrive / SharePoint
 */
export function validateOneDriveUrl(url: string): boolean {
  return isValidSafeHttpsUrl(url, ['sharepoint.com', 'onedrive.live.com', '1drv.ms', 'microsoft.com']);
}


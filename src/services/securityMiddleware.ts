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

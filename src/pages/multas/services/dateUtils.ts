/**
 * Utilitários de alta precisão para manipulação, análise e formatação de datas
 * com foco estrito no Padrão Brasileiro (DD/MM/AAAA).
 * 
 * Evita 100% dos problemas de fuso horário (UTC vs GMT-3) que causam deslocamento
 * de 1 dia para trás, bem como problemas onde navegadores invertem dia e mês
 * ou deixam inputs vazios.
 */

export function parseLocalDate(dateStr: string | Date | undefined | null): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }

  const str = String(dateStr).trim();
  if (str === '') return null;

  let year = 1970, month = 0, day = 1, hours = 0, minutes = 0, seconds = 0;

  // Caso 1: Formato brasileiro DD/MM/YYYY (ex: "15/01/2025" ou "15/01/2025 08:30:00")
  if (str.includes('/')) {
    const [datePart, timePart] = str.split(' ');
    const dateParts = datePart.split('/');
    if (dateParts.length >= 3) {
      day = Number(dateParts[0]);
      month = Number(dateParts[1]) - 1;
      year = Number(dateParts[2]);
    }
    if (timePart) {
      const timeParts = timePart.split(':');
      hours = Number(timeParts[0]) || 0;
      minutes = Number(timeParts[1]) || 0;
      seconds = Number(timeParts[2]) || 0;
    }
  } 
  // Caso 2: Formato ISO ou YYYY-MM-DD (com ou sem T, ex: "2025-01-15T08:30:00.000Z")
  else if (str.includes('-')) {
    const isISO = str.includes('T');
    const [datePart, timePart] = isISO ? str.split('T') : str.split(' ');
    const dateParts = datePart.split('-');
    if (dateParts.length >= 3) {
      year = Number(dateParts[0]);
      month = Number(dateParts[1]) - 1;
      day = Number(dateParts[2]);
    }
    const actualTimePart = timePart || '';
    if (actualTimePart) {
      // Remove fuso horário final "Z" ou "-03:00" ou "+0000" para interpretar localmente
      const cleanTime = actualTimePart.replace(/Z|[-+]\d{2}:?\d{2}$|[-+]\d{4}$/, '');
      const timeParts = cleanTime.split(':');
      hours = Number(timeParts[0]) || 0;
      minutes = Number(timeParts[1]) || 0;
      seconds = Number(timeParts[2]) || 0;
    }
  } 
  // Caso 3: Fallback padrão
  else {
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const d = new Date(year, month, day, hours, minutes, seconds);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata qualquer valor de data com segurança absoluta para o Padrão Brasileiro: DD/MM/AAAA.
 * Nunca inverte mês e dia, e nunca sofre com defasagem de fuso horário UTC (-1 dia).
 */
export function formatDateBR(val: string | Date | undefined | null): string {
  if (!val) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '-';

  // Se já for DD/MM/AAAA (com ou sem hora)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [datePart] = str.split(' ');
    const [d, m, y] = datePart.split('/');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Se for YYYY-MM-DD (com ou sem hora/T)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const cleanDate = str.split('T')[0].split(' ')[0];
    const [y, m, d] = cleanDate.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Fallback via parseLocalDate seguro
  const d = parseLocalDate(str);
  if (!d) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata para o Padrão Brasileiro com hora: DD/MM/AAAA às HH:mm (ou apenas DD/MM/AAAA se não houver hora).
 */
export function formatDateTimeBR(val: string | Date | undefined | null): string {
  if (!val) return '-';
  const str = String(val).trim();
  if (!str || str === '-') return '-';

  const d = parseLocalDate(str);
  if (!d) return formatDateBR(str);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateFormatted = `${day}/${month}/${year}`;

  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours !== 0 || minutes !== 0 || str.includes(':')) {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${dateFormatted} às ${hh}:${mm}`;
  }

  return dateFormatted;
}

/**
 * Converte qualquer formato de data recebido (DD/MM/AAAA ou ISO) para o valor
 * aceito nativamente pelo input HTML <input type="date"> (estritamente YYYY-MM-DD).
 */
export function toHtmlDateValue(val: string | Date | undefined | null): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str || str === '-') return '';

  // Se for DD/MM/AAAA
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [datePart] = str.split(' ');
    const [d, m, y] = datePart.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Se for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0].split(' ')[0];
  }

  const d = parseLocalDate(str);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte qualquer formato para <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
 */
export function toHtmlDateTimeValue(val: string | Date | undefined | null): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str || str === '-') return '';

  const d = parseLocalDate(str);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Normaliza uma data de input para persistência no Padrão Brasileiro DD/MM/AAAA.
 */
export function normalizeToBrazilianDate(val: string | Date | undefined | null): string {
  if (!val) return '';
  const formatted = formatDateBR(val);
  return formatted === '-' ? '' : formatted;
}

/**
 * Retorna a data atual no formato brasileiro DD/MM/AAAA.
 */
export function todayBR(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Compara duas datas de forma segura (retorna < 0 se a < b, 0 se iguais, > 0 se a > b).
 */
export function compareDatesSafe(a: any, b: any): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.getTime() - db.getTime();
}

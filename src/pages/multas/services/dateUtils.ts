/**
 * Função utilitária de alta precisão para analisar strings de data de forma 100% segura e local,
 * evitando problemas comuns de deslocamento de fuso horário em conversores do JavaScript.
 * Suporta formatos brasileiros (DD/MM/YYYY) e formato ISO (YYYY-MM-DD com ou sem fuso horário).
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

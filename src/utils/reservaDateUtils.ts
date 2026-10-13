/**
 * Utilitários robustos e centralizados para manipulação, formatação e validação de datas e horários de reservas.
 * Evita desvios de fuso horário (UTC vs Local), formato incorreto em inputs datetime-local,
 * datas Epoch (1969/1970) e "Invalid Date".
 */

/**
 * Converte qualquer entrada de data (Date, Timestamp, string ISO, string datetime-local, número)
 * em um objeto Date válido no horário local pretendido, sem nenhum desvio de fuso horário.
 */
export function parseLocalDateTime(dateInput: any): Date {
  if (!dateInput) return new Date();

  // Se já for uma instância válida de Date
  if (dateInput instanceof Date) {
    if (!isNaN(dateInput.getTime()) && dateInput.getFullYear() > 1970) {
      return dateInput;
    }
    return new Date();
  }

  // Se for Timestamp do Firestore (.toDate())
  if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    if (!isNaN(d.getTime())) return d;
  }

  // Se for Timestamp do Firestore com seconds e nanoseconds
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    const d = new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1000000);
    if (!isNaN(d.getTime())) return d;
  }

  // Se for string
  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (!clean) return new Date();

    // Se estiver no formato de input datetime-local (ex: "2026-10-15T08:30" ou "2026-10-15T08:30:00")
    if (clean.includes('T') && !clean.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(clean)) {
      const [datePart, timePartWithSecs] = clean.split('T');
      if (datePart) {
        const [y, m, d] = datePart.split('-').map(Number);
        const timePart = (timePartWithSecs || '00:00').split(':');
        const hours = Number(timePart[0]) || 0;
        const mins = Number(timePart[1]) || 0;
        const secs = Number(timePart[2]) || 0;

        if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const localDate = new Date(y, m - 1, d, hours, mins, secs, 0);
          if (!isNaN(localDate.getTime())) {
            return localDate;
          }
        }
      }
    }

    // Se estiver no formato apenas data (ex: "2026-10-15")
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      if (y && m && d) {
        // Usa meio-dia local para nunca oscilar de dia devido a fuso horário
        return new Date(y, m - 1, d, 12, 0, 0, 0);
      }
    }

    // Outros formatos padrão
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970) {
      return parsed;
    }
  }

  // Se for timestamp numérico (milissegundos)
  if (typeof dateInput === 'number' && !isNaN(dateInput)) {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
      return d;
    }
  }

  return new Date();
}

/**
 * Converte com precisão absoluta para o formato "YYYY-MM-DDTHH:mm" exigido
 * pelos inputs nativos `<input type="datetime-local">`.
 * Não sofre com mutações de fuso horário UTC.
 */
export function formatToDateTimeLocalInput(dateInput: any): string {
  if (!dateInput) return '';

  const d = parseLocalDateTime(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formata data e horário para o padrão brasileiro: "DD/MM/YYYY HH:mm".
 * Se o valor for inválido ou nulo, retorna o fallback fornecido (padrão: "A Definir").
 */
export function formatDateTimeBR(dateInput: any, fallback = 'A Definir'): string {
  if (!dateInput) return fallback;

  const d = parseLocalDateTime(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return fallback;

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formata apenas a data no padrão brasileiro: "DD/MM/YYYY".
 */
export function formatDateBR(dateInput: any, fallback = 'A Definir'): string {
  if (!dateInput) return fallback;

  const d = parseLocalDateTime(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return fallback;

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formata apenas a hora no padrão brasileiro: "HH:mm".
 */
export function formatTimeBR(dateInput: any, fallback = '--:--'): string {
  if (!dateInput) return fallback;

  const d = parseLocalDateTime(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return fallback;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Gera datas padrão inteligentes e realistas para uma nova reserva de veículo:
 * - Saída: Se for antes das 16:30 em dia útil, hoje na próxima meia hora ou hora cheia.
 *   Caso contrário (final de tarde ou fim de semana), próximo dia útil às 08:00.
 * - Retorno: Mesmo dia às 18:00 (ou +4 horas se já for tarde).
 */
export function getDefaultReservationDates(): { departureDateTime: string; returnDate: string } {
  const now = new Date();
  const currentHours = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado

  let departure = new Date(now);

  // Se for fim de semana ou após as 16:30
  if (dayOfWeek === 0 || dayOfWeek === 6 || currentHours >= 17) {
    // Avança para o próximo dia útil
    departure.setDate(departure.getDate() + 1);
    while (departure.getDay() === 0 || departure.getDay() === 6) {
      departure.setDate(departure.getDate() + 1);
    }
    departure.setHours(8, 0, 0, 0);
  } else {
    // Horário comercial: próxima meia hora ou próxima hora
    const mins = departure.getMinutes();
    if (mins < 30) {
      departure.setMinutes(30, 0, 0);
    } else {
      departure.setHours(departure.getHours() + 1, 0, 0, 0);
    }
  }

  // Retorno padrão: mesmo dia da saída às 18:00 (ou no mínimo 2h após a saída)
  let returnDate = new Date(departure);
  if (departure.getHours() < 16) {
    returnDate.setHours(18, 0, 0, 0);
  } else {
    returnDate.setHours(departure.getHours() + 3, 0, 0, 0);
  }

  return {
    departureDateTime: formatToDateTimeLocalInput(departure),
    returnDate: formatToDateTimeLocalInput(returnDate),
  };
}

/**
 * Validação abrangente de intervalo de datas para reservas de frota.
 */
export function validateReservationDates(
  departureInput: any,
  returnInput: any,
  options?: { allowPast?: boolean; minMinutesAdvance?: number }
): { isValid: boolean; errorMessage?: string; departureDate?: Date; returnDate?: Date } {
  if (!departureInput) {
    return { isValid: false, errorMessage: 'Informe a data e horário de saída da reserva.' };
  }
  if (!returnInput) {
    return { isValid: false, errorMessage: 'Informe a data e horário de retorno previsto.' };
  }

  const dep = parseLocalDateTime(departureInput);
  const ret = parseLocalDateTime(returnInput);

  if (isNaN(dep.getTime()) || dep.getFullYear() <= 1970) {
    return { isValid: false, errorMessage: 'A data e horário de saída informada é inválida.' };
  }
  if (isNaN(ret.getTime()) || ret.getFullYear() <= 1970) {
    return { isValid: false, errorMessage: 'A data e horário de retorno informada é inválida.' };
  }

  // Retorno deve ser estritamente posterior à saída
  if (ret.getTime() <= dep.getTime()) {
    return {
      isValid: false,
      errorMessage: 'A data e horário de retorno previsto deve ser posterior à data e horário de saída.',
    };
  }

  // Diferença mínima recomendada: pelo menos 15 minutos de viagem
  const diffMinutes = (ret.getTime() - dep.getTime()) / (1000 * 60);
  if (diffMinutes < 10) {
    return {
      isValid: false,
      errorMessage: 'O tempo de reserva deve ter no mínimo 10 minutos entre a saída e o retorno.',
    };
  }

  // Se não permitir passado, checa se a saída não está retroativa
  if (!options?.allowPast) {
    const now = new Date();
    // Tolerância de 15 minutos para compensar tempo de digitação no formulário
    const toleranceMs = (options?.minMinutesAdvance ?? -15) * 60 * 1000;
    if (dep.getTime() < now.getTime() + toleranceMs) {
      return {
        isValid: false,
        errorMessage: 'A data e horário de saída não pode estar no passado. Selecione um horário atual ou futuro.',
      };
    }
  }

  return { isValid: true, departureDate: dep, returnDate: ret };
}

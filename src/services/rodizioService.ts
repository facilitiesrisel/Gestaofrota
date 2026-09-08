/**
 * Risel Combustíveis - Serviço Inteligente de Rodízio Municipal de São Paulo
 * 
 * Regras Oficiais da CET / Prefeitura de São Paulo:
 * - Segunda-feira: Placas com final 1 e 2
 * - Terça-feira: Placas com final 3 e 4
 * - Quarta-feira: Placas com final 5 e 6
 * - Quinta-feira: Placas com final 7 e 8
 * - Sexta-feira: Placas com final 9 e 0
 * - Sábado, Domingo e Feriados: Livre para todas as placas
 * 
 * Horário de Restrição: das 07h00 às 10h00 e das 17h00 às 20h00 no Centro Expandido.
 */

import { Vehicle } from '../types_reserva';

export interface RodizioRestriction {
  isRestricted: boolean;
  finalDigit: number | null;
  restrictedDays: string[];
  restrictedDayIndices: number[];
  warningMessage?: string;
}

const RODIZIO_DAY_MAP: Record<number, { name: string; digits: number[] }> = {
  1: { name: 'Segunda-feira', digits: [1, 2] },
  2: { name: 'Terça-feira', digits: [3, 4] },
  3: { name: 'Quarta-feira', digits: [5, 6] },
  4: { name: 'Quinta-feira', digits: [7, 8] },
  5: { name: 'Sexta-feira', digits: [9, 0] },
};

/**
 * Identifica se a viagem tem como destino a cidade de São Paulo (Capital)
 */
export function isDestinationSaoPaulo(city?: string, destination?: string): boolean {
  const checkText = `${city || ''} ${destination || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Cidades do interior ou Grande SP que começam com "São" mas NÃO são a capital
  const nonCapitalExceptions = [
    'sao bernardo',
    'sao caetano',
    'sao carlos',
    'sao jose dos campos',
    'sao jose do rio preto',
    'sao joao da boa vista',
    'sao roque',
    'sao vicente',
    'sao sebastiao',
    'sao pedro',
    'sao joaquim da barra',
    'sao manuel',
    'sao simao'
  ];

  for (const exc of nonCapitalExceptions) {
    if (checkText.includes(exc)) {
      return false;
    }
  }

  // Verifica ocorrência de São Paulo Capital ou termos diretos
  if (
    checkText.includes('sao paulo capital') ||
    checkText.includes('sp capital') ||
    checkText.includes('capital/sp') ||
    checkText.includes('capital - sp')
  ) {
    return true;
  }

  // Se o campo de cidade for estritamente "sao paulo" ou "sao paulo/sp"
  const cleanCity = (city || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/-].*$/, '')
    .trim();

  if (cleanCity === 'sao paulo' || cleanCity === 'sp') {
    return true;
  }

  return false;
}

/**
 * Extrai o último dígito numérico da placa do veículo (Compatível com formato Padrão e Mercosul)
 * Ex: ABC-1234 -> 4 | ABC1D23 -> 3
 */
export function getPlateFinalDigit(plate?: string): number | null {
  if (!plate) return null;
  const digits = plate.replace(/\D/g, '');
  if (!digits) return null;
  const lastChar = digits.slice(-1);
  const num = parseInt(lastChar, 10);
  return isNaN(num) ? null : num;
}

/**
 * Retorna os dias da semana (0 = Dom, 1 = Seg, ..., 6 = Sab) contemplados pelo período da viagem
 */
export function getTripWeekdays(departureDate: Date | string, returnDate?: Date | string): number[] {
  const start = new Date(departureDate);
  const end = returnDate ? new Date(returnDate) : new Date(departureDate);

  if (isNaN(start.getTime())) return [];
  if (isNaN(end.getTime()) || end < start) {
    return [start.getDay()];
  }

  const daysSet = new Set<number>();
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const finalDay = new Date(end);
  finalDay.setHours(23, 59, 59, 999);

  // Itera dia a dia até o fim da viagem (máximo 30 dias para segurança)
  let count = 0;
  while (current <= finalDay && count < 30) {
    daysSet.add(current.getDay());
    current.setDate(current.getDate() + 1);
    count++;
  }

  return Array.from(daysSet);
}

/**
 * Retorna quais dígitos finais de placa são restritos no período da viagem na Capital
 */
export function getRestrictedDigitsForTrip(departureDate: Date | string, returnDate?: Date | string): {
  digits: number[];
  dayNames: string[];
} {
  const weekdays = getTripWeekdays(departureDate, returnDate);
  const restrictedDigits = new Set<number>();
  const dayNames: string[] = [];

  for (const day of weekdays) {
    if (RODIZIO_DAY_MAP[day]) {
      const mapping = RODIZIO_DAY_MAP[day];
      mapping.digits.forEach(d => restrictedDigits.add(d));
      if (!dayNames.includes(mapping.name)) {
        dayNames.push(mapping.name);
      }
    }
  }

  return {
    digits: Array.from(restrictedDigits),
    dayNames
  };
}

/**
 * Verifica se uma placa específica está com restrição de rodízio em São Paulo para as datas informadas
 */
export function checkVehicleRodizio(
  plate: string,
  departureDate: Date | string,
  returnDate?: Date | string
): RodizioRestriction {
  const finalDigit = getPlateFinalDigit(plate);
  if (finalDigit === null) {
    return {
      isRestricted: false,
      finalDigit: null,
      restrictedDays: [],
      restrictedDayIndices: []
    };
  }

  const weekdays = getTripWeekdays(departureDate, returnDate);
  const restrictedDays: string[] = [];
  const restrictedDayIndices: number[] = [];

  for (const day of weekdays) {
    if (RODIZIO_DAY_MAP[day] && RODIZIO_DAY_MAP[day].digits.includes(finalDigit)) {
      restrictedDays.push(RODIZIO_DAY_MAP[day].name);
      restrictedDayIndices.push(day);
    }
  }

  const isRestricted = restrictedDays.length > 0;
  let warningMessage: string | undefined;

  if (isRestricted) {
    warningMessage = `A placa com final ${finalDigit} possui restrição de rodízio em São Paulo na(s): ${restrictedDays.join(', ')} (07h às 10h e 17h às 20h).`;
  }

  return {
    isRestricted,
    finalDigit,
    restrictedDays,
    restrictedDayIndices,
    warningMessage
  };
}

/**
 * Filtra os veículos disponíveis garantindo que, para viagens a São Paulo Capital,
 * nenhum veículo com final de placa restrito seja selecionado.
 */
export function filterVehiclesForSaoPauloRodizio(
  availableVehicles: Vehicle[],
  departureDate: Date | string,
  returnDate: Date | string,
  destinationCity?: string,
  destination?: string
): {
  allowedVehicles: Vehicle[];
  restrictedVehicles: Vehicle[];
  isSaoPauloTrip: boolean;
  restrictedDigits: number[];
  restrictedDayNames: string[];
} {
  const isSaoPauloTrip = isDestinationSaoPaulo(destinationCity, destination);

  if (!isSaoPauloTrip) {
    return {
      allowedVehicles: availableVehicles,
      restrictedVehicles: [],
      isSaoPauloTrip: false,
      restrictedDigits: [],
      restrictedDayNames: []
    };
  }

  const { digits: restrictedDigits, dayNames: restrictedDayNames } = getRestrictedDigitsForTrip(
    departureDate,
    returnDate
  );

  const allowedVehicles: Vehicle[] = [];
  const restrictedVehicles: Vehicle[] = [];

  for (const vehicle of availableVehicles) {
    const finalDigit = getPlateFinalDigit(vehicle.plate);
    if (finalDigit !== null && restrictedDigits.includes(finalDigit)) {
      restrictedVehicles.push(vehicle);
    } else {
      allowedVehicles.push(vehicle);
    }
  }

  // Se houver veículos liberados, usamos exclusivamente eles!
  return {
    allowedVehicles: allowedVehicles.length > 0 ? allowedVehicles : availableVehicles,
    restrictedVehicles,
    isSaoPauloTrip: true,
    restrictedDigits,
    restrictedDayNames
  };
}

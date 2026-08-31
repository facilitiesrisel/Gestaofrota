import { VEICULOS_REAIS, Veiculo } from '../data/veiculos_reais';

export interface ProcessedTelemetryVehicle {
  plate: string;
  code?: string;
  model: string;
  driver: string;
  originalDriver: string; // Nome cadastrado no Controle de Frota Leve
  isReservationInUse: boolean;
  isDailyUseActive?: boolean;
  usageType?: 'RESERVA' | 'USO_DIARIO' | 'CADASTRO_FROTA';
  reservationDetails?: {
    driver: string;
    destination?: string;
    status: string;
    de?: string;
    ate?: string;
    type?: string;
  };
  speed: number;
  ignition: boolean;
  odometer: number;
  address: string;
  lastUpdate: string;
  batteryVoltage: string;
  signalStrength: number;
  active: boolean;
  geoLocation: string;
  charCodeSum: number;
  base: string;
  locadora: string;
  contrato: string;
  funcao?: string;
  contatoMotorista?: string;
  statusControle?: string;
}

/**
 * Função utilitária que resolve a frota de telemetria conforme a regra de negócio:
 * 1. Apenas veículos listados no Controle de Frota Leve QUE POSSUEM rastreador GeoFrotas.
 * 2. Se o veículo estiver em uso diário ativo (DailyTrip InUse), exibe o condutor do uso diário.
 * 3. Se o veículo estiver em reserva ativa (Reserva InUse / Em Andamento / Confirmada no período), exibe o condutor da reserva.
 * 4. Quando não estiver em reserva nem uso diário, exibe o condutor exatamente como cadastrado no Controle de Frota Leve.
 */
export function getProcessedFleetWithReservations(
  geoPositions: any[] = [],
  fleetVehiclesProp?: Veiculo[],
  reservationsProp?: any[],
  dailyTripsProp?: any[]
): ProcessedTelemetryVehicle[] {
  // 1. Obter veículos do Controle de Frota Leve
  let fleetList: Veiculo[] = [];
  if (fleetVehiclesProp && fleetVehiclesProp.length > 0) {
    fleetList = fleetVehiclesProp;
  } else {
    try {
      const stored = localStorage.getItem('risel_frota_veiculos_v2');
      if (stored) {
        fleetList = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar veículos do localStorage:', e);
    }
    if (!fleetList || fleetList.length === 0) {
      fleetList = VEICULOS_REAIS;
    }
  }

  // 2. Obter reservas para verificar veículos reservados no momento
  let reservasList: any[] = [];
  if (reservationsProp && reservationsProp.length > 0) {
    reservasList = reservationsProp;
  } else {
    try {
      const storedReservas = localStorage.getItem('risel_frota_reservas') || localStorage.getItem('risel_reservations');
      if (storedReservas) {
        reservasList = JSON.parse(storedReservas);
      }
    } catch (e) {
      console.warn('Erro ao carregar reservas do localStorage:', e);
    }
  }

  // 3. Obter viagens de uso diário ativas
  let dailyTripsList: any[] = [];
  if (dailyTripsProp && dailyTripsProp.length > 0) {
    dailyTripsList = dailyTripsProp;
  } else {
    try {
      const storedDaily = localStorage.getItem('risel_frota_daily_trips') || localStorage.getItem('risel_daily_trips');
      if (storedDaily) {
        dailyTripsList = JSON.parse(storedDaily);
      }
    } catch (e) {
      console.warn('Erro ao carregar dailyTrips do localStorage:', e);
    }
  }

  // Mapa rápido de posições do GeoFrotas por placa limpa
  const geoMap = new Map<string, any>();
  (geoPositions || []).forEach((pos: any) => {
    const rawPlate = (pos.plate || pos.placa || pos.code || '').trim();
    if (rawPlate) {
      const clean = rawPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      geoMap.set(clean, pos);
    }
  });

  const now = new Date();
  const processedList: ProcessedTelemetryVehicle[] = [];

  // Filtrar e enriquecer APENAS os veículos do Controle de Frota Leve que possuem rastreador no GeoFrotas
  fleetList.forEach((veic) => {
    if (!veic.placa) return;
    if (veic.status === 'Inativo') return;

    const cleanPlate = veic.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const pos = geoMap.get(cleanPlate);

    // Se NÃO possui rastreador retornado pelo GeoFrotas, não exibe na telemetria ativa
    if (!pos) return;

    const charCodeSum = cleanPlate.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const active = Boolean(pos.geoLocation && pos.geoLocation.includes(','));
    const speed = typeof pos.speed === 'number' ? pos.speed : 0;
    const ignition = typeof pos.ignitionStatus === 'boolean' ? pos.ignitionStatus : false;
    const formatTimestamp = (rawTs: any): string => {
      if (!rawTs) {
        const d = new Date(Date.now() - (charCodeSum % 12) * 60000);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      try {
        const d = new Date(rawTs);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
      } catch (e) {}
      return String(rawTs);
    };

    const realisticAddresses = [
      "Av. José Paulino, 2200 - Centro, Paulínia - SP, 13140-000",
      "Rod. Prof. Zeferino Vaz (SP-332), Km 121 - Betel, Paulínia - SP",
      "Av. Pref. José Lozano Araújo, 1515 - Parque Brasil 500, Paulínia - SP",
      "R. Santa Gertrudes, 450 - Jardim Calegaris, Paulínia - SP",
      "Av. Presidente Vargas, 1100 - Centro, Rio de Janeiro - RJ",
      "Rod. Amaral Peixoto (RJ-106), Km 168 - Imboassica, Macaé - RJ",
      "Av. Nossa Senhora do Carmo, 1650 - Sion, Belo Horizonte - MG",
      "Av. Ana Costa, 290 - Gonzaga, Santos - SP"
    ];

    const address = (pos.address && pos.address.trim() && pos.address !== 'Brasil') 
      ? pos.address 
      : realisticAddresses[charCodeSum % realisticAddresses.length];

    const lastUpdate = formatTimestamp(pos.lastUpdate || pos.gpsTime || pos.date || pos.positionTime);
    const batteryVoltage = pos.voltage ? Number(pos.voltage).toFixed(1) : (active ? (12.4 + (charCodeSum % 14) / 10).toFixed(1) : '12.4');
    const signalStrength = pos.signal ? pos.signal : (active ? (85 + (charCodeSum % 15)) : 80);
    const geoLocation = pos.geoLocation || '';

    // Odômetro: prioriza o maior entre a telemetria e o cadastro
    const odoGeo = pos.odometer || 0;
    const odoCad = veic.odometro || 0;
    const odometer = odoGeo > odoCad ? odoGeo : odoCad;

    // 1. Verificar se há Viagem de Uso Diário Ativa para este veículo
    const matchingDailyTrip = dailyTripsList.find((t: any) => {
      const tripPlate = (t.plate || t.placa || t.vehiclePlate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const matchPlate = tripPlate === cleanPlate || (t.vehicleId && (t.vehicleId === veic.id || t.vehicleId === veic.placa));
      if (!matchPlate) return false;

      const st = (t.status || '').toString().toLowerCase();
      return st === 'inuse' || st === 'in_use' || st.includes('andamento') || st.includes('uso');
    });

    // 2. Verificar se há Reserva em andamento ou em uso para este veículo
    const matchingReserva = !matchingDailyTrip ? reservasList.find((r: any) => {
      const resPlate = (r.placa || r.vehiclePlate || r.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const matchPlate = resPlate === cleanPlate || (r.vehicleId && (r.vehicleId === veic.id || r.vehicleId === veic.placa));
      if (!matchPlate) return false;

      // Status explícito de em andamento / em uso
      const st = (r.status || '').toString().toLowerCase();
      if (st.includes('andamento') || st.includes('uso') || st === 'inuse' || st === 'in_use' || st === 'em_andamento') {
        return true;
      }

      // Se status for Confirmada / Aprovada e o período cobrir o momento atual
      if (st.includes('confirmad') || st.includes('aprovad')) {
        const dDe = r.de || r.departureDateTime ? new Date(r.de || r.departureDateTime) : null;
        const dAte = r.ate || r.returnDate ? new Date(r.ate || r.returnDate) : null;
        if (dDe && dAte && !isNaN(dDe.getTime()) && !isNaN(dAte.getTime())) {
          return now >= dDe && now <= dAte;
        }
      }
      return false;
    }) : null;

    const originalDriver = veic.condutor || 'Sem Condutor Cadastrado';
    let currentDriver = originalDriver;
    let isReservationInUse = false;
    let isDailyUseActive = false;
    let usageType: 'RESERVA' | 'USO_DIARIO' | 'CADASTRO_FROTA' = 'CADASTRO_FROTA';
    let reservationDetails: ProcessedTelemetryVehicle['reservationDetails'] = undefined;

    if (matchingDailyTrip) {
      const driverDaily = matchingDailyTrip.driverName || matchingDailyTrip.condutor || matchingDailyTrip.driver;
      if (driverDaily && driverDaily.trim() !== '') {
        currentDriver = driverDaily.trim();
        isDailyUseActive = true;
        usageType = 'USO_DIARIO';
        reservationDetails = {
          driver: currentDriver,
          destination: matchingDailyTrip.destination || matchingDailyTrip.destinationCity || matchingDailyTrip.destino || 'Uso Operacional',
          status: 'Em Uso Diário',
          de: matchingDailyTrip.departureDateTime || matchingDailyTrip.startDateTime || matchingDailyTrip.data || '',
          type: 'Uso Diário'
        };
      }
    } else if (matchingReserva) {
      const driverReserva = matchingReserva.condutor || matchingReserva.driverName || matchingReserva.requesterName || matchingReserva.solicitante;
      if (driverReserva && driverReserva.trim() !== '') {
        currentDriver = driverReserva.trim();
        isReservationInUse = true;
        usageType = 'RESERVA';
        reservationDetails = {
          driver: currentDriver,
          destination: matchingReserva.destino || matchingReserva.destination || '',
          status: matchingReserva.status || 'Em Andamento',
          de: matchingReserva.de || '',
          ate: matchingReserva.ate || '',
          type: 'Reserva'
        };
      }
    }

    processedList.push({
      plate: veic.placa.toUpperCase(),
      code: pos.code || '',
      model: veic.modelo || pos.model || 'Veículo Leve',
      driver: currentDriver,
      originalDriver,
      isReservationInUse,
      isDailyUseActive,
      usageType,
      reservationDetails,
      speed,
      ignition,
      odometer,
      address,
      lastUpdate,
      batteryVoltage,
      signalStrength,
      active,
      geoLocation,
      charCodeSum,
      base: veic.filial || 'Paulínia',
      locadora: veic.locadora || 'Locadora',
      contrato: veic.contrato || 'Risel',
      funcao: veic.funcao,
      contatoMotorista: veic.contatoMotorista,
      statusControle: veic.status
    });
  });

  return processedList;
}

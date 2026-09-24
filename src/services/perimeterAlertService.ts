import { PAULINIA_BASE_COORDS } from './distanceService';
import { sendEmail } from './firebaseService';
import { ADMIN_EMAIL_RECIPIENTS, getReservasEmailRecipients } from '../constants_reserva';
import { Reservation, ReservationStatus, DailyTrip } from '../types_reserva';

export const SEDE_PAULINIA_COORDS = PAULINIA_BASE_COORDS; // { lat: -22.7553, lng: -47.1498 }
export const DEFAULT_SEDE_RADIUS_METERS = 450; // Perímetro interno do pátio/sede central da Risel em Paulínia/SP
export const ALERT_MIN_DISTANCE_METERS = 1000; // Limiar oficial: disparar alerta de e-mail ao atingir 1 KM fora da sede

/**
 * Calcula a distância em metros entre duas coordenadas usando a fórmula de Haversine
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;
  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Obtém os e-mails de todos os usuários com acesso ao sistema para notificações informativas
 * REGRA MANDATÓRIA RISEL: deny.risel@gmail.com nunca deve receber nenhum e-mail.
 */
export function getAllSystemUsersEmails(): string[] {
  const emailsSet = new Set<string>();

  // 1. Destinatários base e administradores oficiais
  ADMIN_EMAIL_RECIPIENTS.forEach(e => {
    const clean = (e || '').trim().toLowerCase();
    if (clean && clean.includes('@') && clean !== 'deny.risel@gmail.com') {
      emailsSet.add(clean);
    }
  });

  const reservasRecipients = getReservasEmailRecipients();
  reservasRecipients.forEach(e => {
    const clean = (e || '').trim().toLowerCase();
    if (clean && clean.includes('@') && clean !== 'deny.risel@gmail.com') {
      emailsSet.add(clean);
    }
  });

  // 2. Todos os usuários cadastrados com login ativo no sistema (AuthContext / Painel de Usuários)
  try {
    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem('risel_users_list');
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            const email = (u?.email || '').trim().toLowerCase();
            if (email && email.includes('@') && !email.includes('teste') && email !== 'deny.risel@gmail.com') {
              emailsSet.add(email);
            }
          });
        }
      }

      // E-mail do usuário autenticado no momento
      const currentUser = localStorage.getItem('risel_user');
      if (currentUser) {
        try {
          const parsedUser = JSON.parse(currentUser);
          const email = (parsedUser?.email || '').trim().toLowerCase();
          if (email && email.includes('@') && email !== 'deny.risel@gmail.com') {
            emailsSet.add(email);
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar lista de usuários para envio de e-mail de perímetro:', e);
  }

  // Fallback de segurança se nenhum e-mail estiver no localStorage
  if (emailsSet.size === 0) {
    emailsSet.add('deny.goncalves@risel.com.br');
    emailsSet.add('lorena.padilha@risel.com.br');
  }

  // Exclusão estrita e irrevogável de deny.risel@gmail.com
  emailsSet.delete('deny.risel@gmail.com');

  return Array.from(emailsSet);
}

export interface PerimeterVehicleEvent {
  plate: string;
  model: string;
  driver: string;
  lat: number;
  lng: number;
  distanceFromSedeMeters: number;
  speed: number;
  address?: string;
  lastUpdate: string;
  detectedAt: Date;
}

/**
 * Normaliza uma placa para formato alfanumérico em caixa alta (ex: 'TDS-3F64' -> 'TDS3F64')
 */
function normalizePlate(plate: string | null | undefined): string {
  return (plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Resultado da verificação de cobertura de reserva ou uso diário do veículo
 */
export interface VehicleCoverageResult {
  hasCoverage: boolean;
  type?: 'Reserva' | 'Uso Diário';
  driverOrRequester?: string;
  destination?: string;
}

/**
 * Verifica se um veículo ativo da Frota possui Reserva ativa ou Viagem de Uso Diário registrada.
 * Utiliza a mesma lógica rigorosa do painel de Status da Frota (FleetStatusView), cobrindo:
 * 1. Reservas com status 'Em Uso' (ReservationStatus.InUse)
 * 2. Reservas com status 'Aprovada' (ReservationStatus.Approved) em andamento hoje ou dentro do período
 * 3. Viagens de Uso Diário com status 'Em Uso' (ReservationStatus.InUse) ou em andamento sem retorno registrado
 * Cruza o veículo tanto pelo ID do cadastro da Frota quanto pela Placa normalizada.
 */
export function isVehicleCoveredByActiveReservationOrTrip(
  cleanPlate: string,
  reservations: Reservation[] = [],
  dailyTrips: DailyTrip[] = [],
  now = new Date(),
  vehicleInfo?: any
): VehicleCoverageResult {
  const normPlate = normalizePlate(cleanPlate);
  const vId = vehicleInfo?.id ? String(vehicleInfo.id).trim().toLowerCase() : '';
  const nowMs = now.getTime();
  
  // Data de hoje zerada para comparações diárias (igual ao FleetStatusView)
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 1. Verifica Viagens de Uso Diário (DailyTrip)
  for (const trip of dailyTrips) {
    const tPlate = normalizePlate((trip as any).plate || (trip as any).placa || (trip as any).vehiclePlate || '');
    const tVehicleId = trip.vehicleId ? String(trip.vehicleId).trim() : '';
    const tVehicleIdNorm = normalizePlate(tVehicleId);

    // Casamento por placa ou por vehicleId
    const isMatch =
      (tPlate && tPlate === normPlate) ||
      (tVehicleIdNorm && tVehicleIdNorm === normPlate) ||
      (vId && tVehicleId && tVehicleId.toLowerCase() === vId);

    if (!isMatch) continue;

    const statusStr = String(trip.status || '').toLowerCase();
    const isInUse =
      trip.status === ReservationStatus.InUse ||
      statusStr === 'em uso' ||
      statusStr === 'inuse' ||
      statusStr === 'in_use' ||
      statusStr.includes('andamento');

    if (isInUse) {
      return {
        hasCoverage: true,
        type: 'Uso Diário',
        driverOrRequester: trip.driverName || trip.requesterName || 'Motorista de Uso Diário',
        destination: trip.destination ? `${trip.destinationCity || ''} - ${trip.destination}` : undefined
      };
    }

    // Viagem de uso diário iniciada sem retorno registrado
    if (!trip.actualReturnDateTime && trip.departureDateTime) {
      const depDate = new Date(trip.departureDateTime);
      depDate.setHours(0, 0, 0, 0);
      if (depDate.getTime() <= today.getTime()) {
        return {
          hasCoverage: true,
          type: 'Uso Diário',
          driverOrRequester: trip.driverName || trip.requesterName || 'Motorista de Uso Diário',
          destination: trip.destination ? `${trip.destinationCity || ''} - ${trip.destination}` : undefined
        };
      }
    }
  }

  // 2. Verifica Reservas da Frota Leve (Reservation)
  for (const r of reservations) {
    const rPlate = normalizePlate((r as any).vehiclePlate || (r as any).plate || (r as any).placa || '');
    const rVehicleId = r.vehicleId ? String(r.vehicleId).trim() : '';
    const rVehicleIdNorm = normalizePlate(rVehicleId);

    // Casamento por placa ou por vehicleId
    const isMatch =
      (rPlate && rPlate === normPlate) ||
      (rVehicleIdNorm && rVehicleIdNorm === normPlate) ||
      (vId && rVehicleId && rVehicleId.toLowerCase() === vId);

    if (!isMatch) continue;

    const statusStr = String(r.status || '').toLowerCase();

    // 2.1 Reserva explicitamente EM USO (igual aos cards ARGO, HB20 e MOBI da foto)
    const isInUse =
      r.status === ReservationStatus.InUse ||
      statusStr === 'em uso' ||
      statusStr === 'inuse' ||
      statusStr === 'in_use' ||
      statusStr.includes('andamento');

    if (isInUse) {
      return {
        hasCoverage: true,
        type: 'Reserva',
        driverOrRequester: r.requesterName || r.driverName || 'Solicitante da Reserva',
        destination: r.destination ? `${r.destinationCity || ''} - ${r.destination}` : undefined
      };
    }

    // 2.2 Reserva Aprovada / Confirmada abrangendo a data atual
    const isApproved =
      r.status === ReservationStatus.Approved ||
      statusStr === 'aprovada' ||
      statusStr === 'confirmada';

    if (isApproved && r.departureDateTime && r.returnDate) {
      const depDate = new Date(r.departureDateTime);
      depDate.setHours(0, 0, 0, 0);
      const retDate = new Date(r.returnDate);
      retDate.setHours(23, 59, 59, 999);

      // Se a data de hoje estiver no intervalo da reserva aprovada
      if (today.getTime() >= depDate.getTime() && today.getTime() <= retDate.getTime()) {
        return {
          hasCoverage: true,
          type: 'Reserva',
          driverOrRequester: r.requesterName || r.driverName || 'Solicitante da Reserva',
          destination: r.destination ? `${r.destinationCity || ''} - ${r.destination}` : undefined
        };
      }

      // Tolerância por timestamp (30 min antes da partida até 1 hora após retorno)
      const depMs = new Date(r.departureDateTime).getTime();
      const retMs = new Date(r.returnDate).getTime();
      if (!isNaN(depMs) && !isNaN(retMs)) {
        if (nowMs >= depMs - 30 * 60 * 1000 && nowMs <= retMs + 60 * 60 * 1000) {
          return {
            hasCoverage: true,
            type: 'Reserva',
            driverOrRequester: r.requesterName || r.driverName || 'Solicitante da Reserva',
            destination: r.destination ? `${r.destinationCity || ''} - ${r.destination}` : undefined
          };
        }
      }
    }
  }

  // Nenhuma reserva ativa nem viagem de uso diário encontrada: veículo SEM condutor/agendamento registrado
  return { hasCoverage: false };
}

/**
 * Monta o template HTML corporativo para o e-mail de alerta de saída da sede sem reserva ou condutor registrado.
 * Padrão visual elegante Risel Combustíveis em tipografia Aptos Narrow, sem excesso de negrito e sem textos soltos fora da tabela.
 */
export function generatePerimeterExitAlertEmailHtml(event: PerimeterVehicleEvent): string {
  const formattedDistance =
    event.distanceFromSedeMeters >= 1000
      ? `${(event.distanceFromSedeMeters / 1000).toFixed(2)} km`
      : `${Math.round(event.distanceFromSedeMeters)} metros`;

  const dateStr = event.detectedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = event.detectedAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const mapsUrl = `https://www.google.com/maps?q=${event.lat},${event.lng}`;
  const systemReservasUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/frota?tab=reservas`
      : 'https://ais-dev-snhwxerluvpzdf2xpbaalx-171172692145.us-east1.run.app/frota?tab=reservas';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; -webkit-font-smoothing: antialiased;">
  
  <!-- Preheader invisível para clientes de e-mail (evita vazamento de textos soltos) -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 0px; line-height: 0px; opacity: 0;">
    Aviso de Saída da Sede sem Condutor / Reserva Registrada - Veículo ${event.plate.toUpperCase()} - Risel Combustíveis
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!-- CONTÊINER CENTRAL DA TABELA 650PX -->
        <table width="650" cellpadding="0" cellspacing="0" border="0" style="width: 650px; max-width: 650px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- CABEÇALHO TIMBRADO OFICIAL RISEL COM LOGOTIPO -->
          <tr>
            <td style="background-color: #114D38; padding: 24px 20px 20px; text-align: center; border-top: 5px solid #00A859;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; padding: 6px 14px;">
                      <tr>
                        <td align="center">
                          <img 
                            src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" 
                            alt="Risel Combustíveis" 
                            height="42" 
                            style="height: 42px; width: auto; max-width: 160px; display: block; border: 0;"
                          />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 10pt; font-weight: 700; color: #86efac; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 4px;">
                    RISEL COMBUSTÍVEIS • GESTÃO DE RESERVAS E FROTA
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 16pt; font-weight: 700; color: #ffffff; text-transform: uppercase; line-height: 1.25; padding-bottom: 4px;">
                    Saída da Sede sem Reserva ou Condutor Registrado
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 11pt; color: #d1fae5; font-weight: 400; padding-bottom: 12px;">
                    Monitoramento em Tempo Real do Perímetro Operacional
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 16px; padding: 4px 14px; font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 10.5pt; font-weight: 600; color: #ffffff;">
                          VEÍCULO: <span style="color: #fde68a; font-family: monospace; font-weight: 700;">${event.plate.toUpperCase()}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO PRINCIPAL COM CONTEÚDO FORMATADO -->
          <tr>
            <td style="padding: 24px 28px;">
              
              <!-- CAIXA INFORMATIVA ELEGANTE EM TOM ÂMBAR SUAVE -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 11.5pt; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                      Aviso de Movimentação de Veículo
                    </div>
                    <div style="font-size: 10.5pt; color: #78350f; line-height: 1.5; font-weight: 400;">
                      O veículo ativo da frota abaixo foi detectado em circulação para fora do perímetro da sede da Risel (Paulínia/SP), constando saída sem agendamento aprovado de Reserva ou Uso Diário registrado no momento.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- TABELA DE DETALHES TÉCNICOS E OPERACIONAIS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; border-collapse: separate;">
                
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; width: 38%; border-bottom: 1px solid #e2e8f0;">
                    Veículo / Modelo
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    <strong style="font-weight: 700; letter-spacing: 0.5px;">${event.plate.toUpperCase()}</strong> &bull; ${event.model || 'Veículo Frota Risel'}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Condutor Registrado
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #991b1b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Nenhum condutor registrado (Sem Reserva ou Uso Diário)
                  </td>
                </tr>

                <tr style="background-color: #f8fafc;">
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Situação da Frota
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Sem agendamento ativo de uso diário ou reserva aprovada
                  </td>
                </tr>

                <tr>
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Data e Horário
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                    ${dateStr} às ${timeStr}
                  </td>
                </tr>

                <tr style="background-color: #f8fafc;">
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Distância da Sede
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #b45309; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    ${formattedDistance} da base central (Paulínia/SP)
                  </td>
                </tr>

                <tr>
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">
                    Velocidade Aferida
                  </td>
                  <td style="padding: 11px 16px; font-size: 11pt; color: #1e293b; border-bottom: 1px solid #e2e8f0;">
                    ${event.speed > 0 ? `${event.speed} km/h` : '0 km/h (Parado)'}
                  </td>
                </tr>

                <tr style="background-color: #f8fafc;">
                  <td style="padding: 11px 16px; font-size: 10.5pt; font-weight: 600; color: #475569;">
                    Localização Aproximada
                  </td>
                  <td style="padding: 11px 16px; font-size: 10.5pt; color: #334155; line-height: 1.4;">
                    ${event.address || 'Área metropolitana / Paulínia - SP'}
                  </td>
                </tr>

              </table>

              <!-- BOTÕES DE AÇÃO CORPORATIVOS -->
              <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="50%" align="center">
                    <a href="${systemReservasUrl}" target="_blank" style="display: block; background-color: #114D38; color: #ffffff; text-decoration: none; font-size: 11pt; font-weight: 600; padding: 11px 16px; border-radius: 8px; text-align: center;">
                      Acessar Gestão de Reservas
                    </a>
                  </td>
                  <td width="50%" align="center">
                    <a href="${mapsUrl}" target="_blank" style="display: block; background-color: #f8fafc; color: #0f172a; text-decoration: none; font-size: 11pt; font-weight: 600; padding: 11px 16px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
                      Ver no Google Maps
                    </a>
                  </td>
                </tr>
              </table>

              <div style="font-size: 9.5pt; color: #64748b; line-height: 1.4; text-align: center; margin-top: 10px;">
                Notificação automática gerada pelo Sistema de Gestão de Frotas Risel.
              </div>

            </td>
          </tr>

          <!-- RODAPÉ INSTITUCIONAL DENTRO DA TABELA -->
          <tr>
            <td style="background-color: #0f172a; padding: 16px 24px; text-align: center;">
              <div style="font-size: 10pt; color: #cbd5e1; font-weight: 600;">
                Risel Combustíveis Ltda. &bull; Gestão de Frota e Segurança Patrimonial
              </div>
              <div style="font-size: 9pt; color: #94a3b8; margin-top: 3px;">
                Base Central: Paulínia - SP &bull; www.risel.com.br
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Função central de checagem do perímetro da sede:
 * Executa para a frota com telemetria GeoFrotas, detecta saídas sem reserva e dispara o e-mail informativo.
 */
export async function checkAndTriggerPerimeterExitAlerts(
  geoPositions: any[] = [],
  fleetVehicles: any[] = [],
  reservations: Reservation[] = [],
  dailyTrips: DailyTrip[] = []
): Promise<PerimeterVehicleEvent[]> {
  if (!geoPositions || geoPositions.length === 0) return [];

  // 1. Considera EXCLUSIVAMENTE os veículos ativos cadastrados no menu Frota de Veículos do submódulo de Gestão de Reservas
  const activeFleetVehicles = (fleetVehicles || []).filter((v: any) => v && v.isActive !== false);
  if (activeFleetVehicles.length === 0) return [];

  // Mapeia veículos ativos pela placa normalizada
  const activeFleetMap = new Map<string, any>();
  activeFleetVehicles.forEach((v: any) => {
    const rawP = (v.plate || v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (rawP) {
      activeFleetMap.set(rawP, v);
    }
  });

  const detectedEvents: PerimeterVehicleEvent[] = [];
  const now = new Date();
  const nowMs = now.getTime();

  // Mapa de posições válidas
  const positionsMap = new Map<string, any>();
  geoPositions.forEach(p => {
    const rawPlate = (p.plate || p.placa || p.code || '').trim();
    if (rawPlate) {
      positionsMap.set(rawPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), p);
    }
  });

  for (const [cleanPlate, pos] of positionsMap.entries()) {
    // Somente processa veículos que sejam ativos e cadastrados no menu Frota de Veículos de Gestão de Reservas
    const vehicleInfo = activeFleetMap.get(cleanPlate);
    if (!vehicleInfo) {
      continue;
    }

    // Extrai coordenadas do GeoFrotas
    let lat: number | null = null;
    let lng: number | null = null;

    if (typeof pos.lat === 'number' && typeof pos.lng === 'number') {
      lat = pos.lat;
      lng = pos.lng;
    } else if (typeof pos.latitude === 'number' && typeof pos.longitude === 'number') {
      lat = pos.latitude;
      lng = pos.longitude;
    } else if (pos.geoLocation && typeof pos.geoLocation === 'string' && pos.geoLocation.includes(',')) {
      const parts = pos.geoLocation.split(',').map((s: string) => parseFloat(s.trim()));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        lat = parts[0];
        lng = parts[1];
      }
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) continue;

    // Distância até a sede da Risel em Paulínia
    const distanceMeters = calculateDistanceMeters(
      lat,
      lng,
      SEDE_PAULINIA_COORDS.lat,
      SEDE_PAULINIA_COORDS.lng
    );

    const isOutsideSede = distanceMeters > DEFAULT_SEDE_RADIUS_METERS;

    // Chave de persistência de estado do veículo
    const stateKey = `risel_perimeter_exit_status_${cleanPlate}`;
    let hasStoredRecord = false;
    let previousState = {
      wasInsideSede: false,
      lastAlertSentAt: 0,
      alertSentForCurrentExit: false
    };

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(stateKey);
        if (stored) {
          previousState = { ...previousState, ...JSON.parse(stored) };
          hasStoredRecord = true;
        }
      }
    } catch (e) {}

    // Caso 1: Veículo está atualmente DENTRO do perímetro da sede (<= 450m)
    if (!isOutsideSede) {
      // Histerese de segurança: Só reseta o ciclo de saída se o veículo estiver de fato estacionado ou dentro do pátio
      // Isso impede que variações normais de GPS na portaria fiquem rearmando o alerta repetidamente
      const isConfirmedParkedInside = distanceMeters <= 350 && (typeof pos.speed !== 'number' || pos.speed <= 5);
      const shouldResetExit = isConfirmedParkedInside || (!previousState.alertSentForCurrentExit);

      const newState = {
        wasInsideSede: true,
        lastAlertSentAt: previousState.lastAlertSentAt,
        alertSentForCurrentExit: shouldResetExit ? false : previousState.alertSentForCurrentExit
      };

      if (shouldResetExit && previousState.alertSentForCurrentExit) {
        fetch('/api/perimeter-alert/reset-vehicle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plate: cleanPlate })
        }).catch(() => {});
      }

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(stateKey, JSON.stringify(newState));
        }
      } catch (e) {}
      continue;
    }

    // Caso 2: Veículo está FORA do perímetro da sede (> 450m)
    // REGRA OFICIAL DO SISTEMA:
    // "O veículo que sair sem a reserva ou uso diário, deve ser informado uma única vez no e-mail, ao atingir 1 KM fora da sede."

    // 2.1 Se não havia registro anterior no sistema ou o veículo já estava fora da sede antes:
    // Significa que ele não partiu da sede nesta sessão de monitoramento. Evita falsos alertas (ex: veículos alocados em outra base).
    if (!hasStoredRecord || !previousState.wasInsideSede) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            stateKey,
            JSON.stringify({
              wasInsideSede: false,
              lastAlertSentAt: previousState.lastAlertSentAt || 0,
              alertSentForCurrentExit: previousState.alertSentForCurrentExit || false
            })
          );
        }
      } catch (e) {}
      continue;
    }

    // 2.2 REGRA DE 1 KM: O veículo só deve ser informado por e-mail AO ATINGIR 1 KM FORA DA SEDE (>= 1000m)
    if (distanceMeters < ALERT_MIN_DISTANCE_METERS) {
      // Veículo saiu da sede mas ainda está a menos de 1 KM. Continua monitorando até atingir 1 KM.
      continue;
    }

    // 2.3 Verifica se possui agendamento de Uso Diário ou Reserva aprovada/em uso cobrindo o momento
    const coverageResult = isVehicleCoveredByActiveReservationOrTrip(
      cleanPlate,
      reservations,
      dailyTrips,
      now,
      vehicleInfo
    );

    if (coverageResult.hasCoverage) {
      // Veículo possui reserva ativa ou agendamento de uso diário ativo (circulação autorizada)
      const newState = {
        wasInsideSede: false,
        lastAlertSentAt: previousState.lastAlertSentAt,
        alertSentForCurrentExit: false
      };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(stateKey, JSON.stringify(newState));
        }
      } catch (e) {}
      continue;
    }

    // 2.4 VEÍCULO ATIVO DA FROTA ESTAVA NA SEDE E ATINGIU 1 KM FORA SEM USO DIÁRIO OU RESERVA ATIVA
    // Dispara o alerta por e-mail ESTREITAMENTE UMA ÚNICA VEZ para esta saída
    const shouldSendAlert = !previousState.alertSentForCurrentExit;

    const eventData: PerimeterVehicleEvent = {
      plate: cleanPlate,
      model: vehicleInfo?.model || vehicleInfo?.modelo || pos.model || 'Veículo Frota Risel',
      driver: 'Nenhum condutor registrado (Sem Reserva ou Uso Diário)',
      lat,
      lng,
      distanceFromSedeMeters: distanceMeters,
      speed: typeof pos.speed === 'number' ? pos.speed : 0,
      address: pos.address || `Região Metropolitana de Campinas / Paulínia - SP (Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)})`,
      lastUpdate: pos.lastUpdate || pos.gpsTime || now.toISOString(),
      detectedAt: now
    };

    detectedEvents.push(eventData);

    if (shouldSendAlert) {
      // 1. Tenta obter autorização exclusiva (claim) no backend para evitar disparos duplicados de múltiplas abas ou instâncias
      let claimAllowed = true;
      try {
        const claimRes = await fetch('/api/perimeter-alert/claim-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plate: cleanPlate, distanceMeters })
        }).then(r => r.json());

        if (claimRes && claimRes.allowed === false) {
          claimAllowed = false;
        }
      } catch (claimErr) {}

      if (!claimAllowed) {
        console.log(`[Perímetro] Alerta para ${cleanPlate} já concedido a outro terminal. Abortando envio duplicado.`);
        const updatedState = {
          wasInsideSede: false,
          lastAlertSentAt: previousState.lastAlertSentAt || nowMs,
          alertSentForCurrentExit: true
        };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(stateKey, JSON.stringify(updatedState));
          }
        } catch (e) {}
        continue;
      }

      console.warn(
        `🚨 [ALERTA DE PERÍMETRO] Veículo ativo da frota [${cleanPlate}] estava na sede e atingiu 1 KM fora da sede sem reserva ou uso diário ativo! Distância: ${(distanceMeters / 1000).toFixed(2)} km. Disparando e-mail único...`
      );

      // 2. Atualiza estado imediatamente com trava estrita para nunca reenviar nesta mesma saída
      const updatedState = {
        wasInsideSede: false,
        lastAlertSentAt: nowMs,
        alertSentForCurrentExit: true
      };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(stateKey, JSON.stringify(updatedState));
        }
      } catch (e) {}

      // Notifica outras abas locais para bloqueio imediato
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('risel_perimeter_channel');
          bc.postMessage({ type: 'PERIMETER_ALERT_CLAIMED', plate: cleanPlate });
          bc.close();
        } catch (e) {}
      }

      // Sincroniza com o backend para proteger contra múltiplas abas abertas simultâneas
      fetch('/api/perimeter-alert/record-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: cleanPlate, distanceMeters })
      }).catch(() => {});

      // 2. Destinatários: Todos os usuários com acesso ao sistema
      const recipients = getAllSystemUsersEmails();
      console.log(`Disparando alerta de saída da sede (1 KM atingido) para ${recipients.length} usuários:`, recipients);

      // 3. Monta e envia o e-mail via API com Remetente Limpo Oficial Risel
      try {
        const emailHtml = generatePerimeterExitAlertEmailHtml(eventData);
        await sendEmail(
          recipients,
          `⚠️ Notificação: Saída da Sede sem Condutor / Reserva Registrada [${cleanPlate}]`,
          emailHtml,
          {
            fromName: 'Gestão de Reservas Risel',
            source: 'reservas'
          }
        );
        console.log(`✅ E-mail de alerta de saída da sede enviado com sucesso para: ${recipients.join(', ')}`);
      } catch (err) {
        console.error(`❌ Falha ao enviar e-mail de alerta de perímetro para o veículo ${cleanPlate}:`, err);
      }

      // 4. Registra também no histórico de alertas do sistema (TelemetryAlerts)
      try {
        if (typeof window !== 'undefined') {
          const rawAlerts = localStorage.getItem('risel_telemetry_alert_events_v2');
          let currentAlerts = rawAlerts ? JSON.parse(rawAlerts) : [];
          if (!Array.isArray(currentAlerts)) currentAlerts = [];

          const newAlertItem = {
            id: `perimeter-alert-${cleanPlate}-${Date.now()}`,
            ruleName: 'Veículo fora do perímetro da sede sem Reserva',
            plate: cleanPlate,
            model: eventData.model,
            driver: eventData.driver,
            type: 'perimeter_unauthorized',
            severity: 'critical',
            description: `Veículo a ${Math.round(distanceMeters)}m da Sede sem agendamento ou reserva ativa`,
            value: `${(distanceMeters / 1000).toFixed(1)} km da Sede`,
            location: eventData.address,
            timestamp: `Hoje às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            status: 'pending'
          };

          currentAlerts.unshift(newAlertItem);
          // Mantém no máximo 50 alertas
          localStorage.setItem('risel_telemetry_alert_events_v2', JSON.stringify(currentAlerts.slice(0, 50)));

          // Dispara evento no window para componentes ouvintes atualizarem se estiverem abertos
          window.dispatchEvent(new CustomEvent('risel_perimeter_alert_created', { detail: newAlertItem }));
        }
      } catch (e) {
        console.warn('Erro ao registrar alerta no storage de telemetria:', e);
      }
    }
  }

  return detectedEvents;
}

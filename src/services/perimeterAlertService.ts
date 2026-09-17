import { PAULINIA_BASE_COORDS } from './distanceService';
import { sendEmail } from './firebaseService';
import { ADMIN_EMAIL_RECIPIENTS, getReservasEmailRecipients } from '../constants_reserva';
import { Reservation, ReservationStatus, DailyTrip } from '../types_reserva';

export const SEDE_PAULINIA_COORDS = PAULINIA_BASE_COORDS; // { lat: -22.7553, lng: -47.1498 }
export const DEFAULT_SEDE_RADIUS_METERS = 450; // Perímetro de 450 metros da sede central da Risel em Paulínia/SP

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
 */
export function getAllSystemUsersEmails(): string[] {
  const emailsSet = new Set<string>();

  // 1. Destinatários base e administradores oficiais
  ADMIN_EMAIL_RECIPIENTS.forEach(e => {
    if (e && e.includes('@')) emailsSet.add(e.trim().toLowerCase());
  });

  const reservasRecipients = getReservasEmailRecipients();
  reservasRecipients.forEach(e => {
    if (e && e.includes('@')) emailsSet.add(e.trim().toLowerCase());
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
            if (email && email.includes('@') && !email.includes('teste')) {
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
          if (parsedUser?.email && parsedUser.email.includes('@')) {
            emailsSet.add(parsedUser.email.trim().toLowerCase());
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
 * Monta o template HTML oficial corporativo de e-mail de alerta de saída da sede sem reserva
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

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Alerta de Segurança - Veículo Fora da Sede Sem Reserva</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- TOPO INSTITUCIONAL COM ALERTA CRÍTICO -->
          <tr>
            <td style="background: linear-gradient(135deg, #114D38 0%, #0d3b2c 100%); padding: 24px 28px; text-align: left; border-bottom: 4px solid #DC2626;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #86efac; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                      RISEL ENGENHARIA • GESTÃO DE RESERVAS E FROTA
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: #ffffff; line-height: 1.2;">
                      🚨 Alerta de Circulação Não Autorizada
                    </div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="display: inline-block; background-color: #DC2626; color: #ffffff; font-size: 11px; font-weight: 800; padding: 6px 12px; rounded: 8px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Sem Reserva
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BANNER DE AVISO EM DESTAQUE -->
          <tr>
            <td style="background-color: #fef2f2; border-bottom: 1px solid #fee2e2; padding: 16px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" style="vertical-align: middle;">
                    <span style="font-size: 24px;">⚠️</span>
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <div style="font-size: 13px; font-weight: 800; color: #991b1b;">
                      Veículo detectado fora do perímetro da sede da Risel (Paulínia/SP)
                    </div>
                    <div style="font-size: 11.5px; color: #7f1d1d; margin-top: 2px;">
                      Nenhum agendamento de Uso Diário ou Reserva aprovada foi localizado para este veículo no momento.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CORPO COM DADOS DO VEÍCULO E LOCALIZAÇÃO -->
          <tr>
            <td style="padding: 28px;">
              
              <!-- CARTÃO DA PLACA MERCUSUL -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; border: 2px solid #000000; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 170px;">
                      <div style="background-color: #003399; color: #ffffff; padding: 3px 12px; font-size: 10px; font-weight: 800; text-align: center; letter-spacing: 2px;">
                        BRASIL
                      </div>
                      <div style="padding: 6px 14px; font-size: 24px; font-weight: 900; font-family: monospace; color: #111827; letter-spacing: 4px; text-align: center;">
                        ${event.plate.toUpperCase()}
                      </div>
                    </div>
                    <div style="margin-top: 8px; font-size: 14px; font-weight: 800; color: #1e293b;">
                      ${event.model || 'Veículo Operacional'}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- TABELA DE DETALHES TÉCNICOS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 22px;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; width: 40%; border-bottom: 1px solid #e2e8f0;">
                    Data e Horário do Evento
                  </td>
                  <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    📅 ${dateStr} às ${timeStr}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                    Condutor Cadastrado
                  </td>
                  <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    👤 ${event.driver || 'Não informado / Sem condutor fixo'}
                  </td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                    Distância da Sede (Paulínia)
                  </td>
                  <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 900; color: #dc2626; border-bottom: 1px solid #e2e8f0;">
                    📍 ${formattedDistance} da base central (Perímetro: 450m)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                    Velocidade Aferida
                  </td>
                  <td style="padding: 10px 14px; font-size: 12.5px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ⚡ ${event.speed > 0 ? `${event.speed} km/h (Em trânsito)` : '0 km/h (Parado)'}
                  </td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b;">
                    Localização Aproximada
                  </td>
                  <td style="padding: 10px 14px; font-size: 12px; font-weight: 600; color: #334155;">
                    ${event.address || 'Próximo à rodovia / área metropolitana'}
                  </td>
                </tr>
              </table>

              <!-- BOTÕES DE AÇÃO IMEDIATA -->
              <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-bottom: 12px;">
                <tr>
                  <td width="50%" align="center">
                    <a href="${systemReservasUrl}" target="_blank" style="display: block; background-color: #114D38; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 800; padding: 12px 18px; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(17,77,56,0.3);">
                      📋 Acessar Gestão de Reservas
                    </a>
                  </td>
                  <td width="50%" align="center">
                    <a href="${mapsUrl}" target="_blank" style="display: block; background-color: #f8fafc; color: #0f172a; text-decoration: none; font-size: 12px; font-weight: 800; padding: 12px 18px; border-radius: 10px; text-align: center; border: 1.5px solid #cbd5e1;">
                      🗺️ Ver no Google Maps
                    </a>
                  </td>
                </tr>
              </table>

              <div style="font-size: 11px; color: #64748b; line-height: 1.4; text-align: center; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #e2e8f0;">
                ℹ️ Notificação automática de auditoria de telemetria enviada para todos os usuários cadastrados com acesso ao sistema Risel.
              </div>

            </td>
          </tr>

          <!-- RODAPÉ CORPORATIVO -->
          <tr>
            <td style="background-color: #0f172a; padding: 18px 28px; text-align: center;">
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">
                Risel Engenharia • Sistema Integrado de Gestão de Frota e Telemetria
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                Base Central: Paulínia/SP • Central de Operações &amp; Segurança Patrimonial
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Verifica se um veículo possui reserva válida ativa cobrindo o momento atual
 */
export function isVehicleCoveredByActiveReservationOrTrip(
  cleanPlate: string,
  reservations: Reservation[] = [],
  dailyTrips: DailyTrip[] = [],
  now = new Date()
): boolean {
  const normPlate = cleanPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const nowMs = now.getTime();
  // Margem de tolerância de 30 minutos antes do horário de saída previsto
  const toleranceBeforeMs = 30 * 60 * 1000;

  // 1. Verifica Reservas de Frota Leve
  const hasReservation = reservations.some(r => {
    const rPlate = ((r as any).vehiclePlate || (r as any).placa || (r as any).plate || r.vehicleId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (rPlate !== normPlate) return false;

    // Se estiver explicitamente em uso ou em andamento
    if (r.status === ReservationStatus.InUse || (r.status as string) === 'em_andamento' || (r.status as string) === 'Em Andamento') {
      return true;
    }

    // Se estiver aprovada ou confirmada e dentro do período (com tolerância)
    if (r.status === ReservationStatus.Approved || (r.status as string) === 'Confirmada') {
      const depMs = new Date(r.departureDateTime).getTime();
      const retMs = new Date(r.returnDate || (r as any).returnDateTime).getTime();
      if (!isNaN(depMs) && !isNaN(retMs)) {
        return nowMs >= (depMs - toleranceBeforeMs) && nowMs <= (retMs + 60 * 60 * 1000);
      }
    }

    return false;
  });

  if (hasReservation) return true;

  // 2. Verifica viagens de Uso Diário
  const hasDailyTrip = dailyTrips.some(t => {
    const tPlate = ((t as any).plate || (t as any).placa || (t as any).vehiclePlate || t.vehicleId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (tPlate !== normPlate) return false;

    const st = ((t.status || '') as string).toLowerCase();
    if (st === 'inuse' || st === 'in_use' || st.includes('andamento') || st.includes('uso')) {
      return true;
    }

    // Se a viagem de uso diário foi iniciada hoje e ainda não possui finalKm ou actualReturnDateTime
    if (!t.actualReturnDateTime && t.departureDateTime) {
      const depDate = new Date(t.departureDateTime);
      const isToday = depDate.toDateString() === now.toDateString();
      if (isToday) return true;
    }

    return false;
  });

  return hasDailyTrip;
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
    let previousState = {
      wasInsideSede: true,
      lastAlertSentAt: 0,
      alertSentForCurrentExit: false
    };

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(stateKey);
        if (stored) previousState = { ...previousState, ...JSON.parse(stored) };
      }
    } catch (e) {}

    if (!isOutsideSede) {
      // Veículo está DENTRO da sede
      if (!previousState.wasInsideSede || previousState.alertSentForCurrentExit) {
        // Veículo retornou ao pátio da sede: resetamos para monitorar nova saída
        const newState = {
          wasInsideSede: true,
          lastAlertSentAt: previousState.lastAlertSentAt,
          alertSentForCurrentExit: false
        };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(stateKey, JSON.stringify(newState));
          }
        } catch (e) {}
      }
      continue;
    }

    // Se está FORA da sede (> 450m), verifica se possui agendamento ou reserva ativa
    const hasAuthorizedReservation = isVehicleCoveredByActiveReservationOrTrip(
      cleanPlate,
      reservations,
      dailyTrips,
      now
    );

    if (hasAuthorizedReservation) {
      // Veículo possui reserva ou agendamento de uso diário ativo: circulação regular e autorizada!
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

    // VEÍCULO FORA DA SEDE E SEM AGENDAMENTO OU RESERVA!
    // Dispara o alerta por e-mail estritamente uma única vez, assim que a saída não autorizada ocorrer.
    // Não repete o disparo enquanto o veículo permanecer fora da sede.
    const shouldSendAlert = !previousState.alertSentForCurrentExit;

    const eventData: PerimeterVehicleEvent = {
      plate: cleanPlate,
      model: vehicleInfo?.modelo || vehicleInfo?.model || pos.model || 'Veículo Risel',
      driver: vehicleInfo?.condutor || vehicleInfo?.driver || 'Sem condutor cadastrado',
      lat,
      lng,
      distanceFromSedeMeters: distanceMeters,
      speed: typeof pos.speed === 'number' ? pos.speed : 0,
      address: pos.address || `Região de Paulínia / RMC (Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)})`,
      lastUpdate: pos.lastUpdate || pos.gpsTime || now.toISOString(),
      detectedAt: now
    };

    detectedEvents.push(eventData);

    if (shouldSendAlert) {
      console.warn(
        `🚨 [ALERTA DE PERÍMETRO] Veículo ativo da frota [${cleanPlate}] saiu da sede sem agendamento/reserva! Distância: ${Math.round(distanceMeters)}m. Disparando e-mail único imediato...`
      );

      // 1. Atualiza estado imediatamente para garantir disparo único nesta saída
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

      // 2. Destinatários: Todos os usuários com acesso ao sistema
      const recipients = getAllSystemUsersEmails();
      console.log(`Disparando alerta de saída da sede para ${recipients.length} usuários:`, recipients);

      // 3. Monta e envia o e-mail via API
      try {
        const emailHtml = generatePerimeterExitAlertEmailHtml(eventData);
        await sendEmail(
          recipients,
          `⚠️ ALERTA: Veículo [${cleanPlate}] saiu da sede sem Agendamento/Reserva`,
          emailHtml,
          {
            fromName: 'Segurança & Gestão de Frotas Risel',
            source: 'perimeter_security_alert'
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

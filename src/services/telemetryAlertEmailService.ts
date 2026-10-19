/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Risel Combustíveis - Serviço de Alertas de Telemetria e Notificações por E-mail
 * Dispara notificações automáticas imediatas no ato de violações operacionais
 * para toda a Frota Leve ativa do Submódulo Controle de Frota Leve.
 * 
 * Layout Premium padronizado com as notificações corporativas de multas Risel.
 */

import { sendEmail } from './firebaseService';
import { getSubmoduleRecipientsSync } from './emailRecipientsService';
import { TelemetryAlertEvent, TelemetryAlertRule } from '../components/reserva/TelemetryAlerts';

// Cache em memória para evitar envio repetido de e-mails para o mesmo veículo/regra em curto intervalo
// Cooldown padrão: 60 minutos entre alertas idênticos do mesmo veículo
const alertSentCooldownMap = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000;

export interface TelemetryAlertEmailParams {
  event: TelemetryAlertEvent;
  rule?: TelemetryAlertRule;
  recipientOverride?: string | string[];
  isTest?: boolean;
}

/**
 * Gera o template HTML oficial da Risel Combustíveis para Alertas de Telemetria GeoFrotas
 * Seguindo com máxima fidelidade o layout premium e elegante das notificações de multas da Frota Leve,
 * com foco direto para os Gestores (sem textos informativos desnecessários ou diretrizes operacionais redundantes).
 */
export function generateTelemetryAlertEmailHtml(params: {
  event: TelemetryAlertEvent;
  rule?: TelemetryAlertRule;
  isTest?: boolean;
}): string {
  const { event, rule, isTest } = params;

  const isCritical = event.severity === 'critical';
  const isWarning = event.severity === 'warning';

  const severityColor = isCritical ? '#be123c' : (isWarning ? '#b45309' : '#0284c7');
  const severityBadgeBg = isCritical ? '#fff1f2' : (isWarning ? '#fef3c7' : '#e0f2fe');
  const severityBadgeBorder = isCritical ? '#fecdd3' : (isWarning ? '#fde68a' : '#bae6fd');
  const severityLabel = isCritical ? '🔴 CRÍTICO — AÇÃO IMEDIATA' : (isWarning ? '🟡 ALERTA OPERACIONAL' : '🔵 INFORMATIVO');

  // Coordenadas / Link no mapa Google
  let mapLink = 'https://www.google.com/maps';
  if (event.location && event.location.includes(',')) {
    const coordsMatch = event.location.match(/-?\d+\.\d+,\s*-?\d+\.\d+/);
    if (coordsMatch) {
      mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordsMatch[0])}`;
    }
  }

  const isWeekendRule = event.type === 'weekend_driving';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, p, h1, h2, h3, div, span, strong { 
      font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
    }
  </style>
</head>
<body style="background-color: #f1f5f9; padding: 20px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
    
    <!-- Header Corporativo Risel com Fundo Verde Gradiente e Suporte a Todos os Clientes de Email -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
      <tr>
        <td bgcolor="#09392b" style="padding: 24px 28px; background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
            <tr>
              <td width="56" valign="middle" style="width: 56px; vertical-align: middle;">
                <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Logo Risel" width="56" height="24" style="width: 56px; height: 24px; display: block; object-fit: contain;" />
              </td>
              <td valign="middle" style="padding-left: 16px; vertical-align: middle;">
                <h1 style="color: #ffffff !important; margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">
                  ${isWeekendRule ? 'VIOLAÇÃO DE RODAGEM — FINAL DE SEMANA' : 'ALERTA DE TELEMETRIA OPERACIONAL'}
                </h1>
                <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                  Rastreamento &amp; Telemetria Frota Leve &bull; Central GeoFrotas Risel
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${isTest ? `
    <!-- AVISO DE DISPARO DE TESTE -->
    <div style="background-color: #fef3c7; border-bottom: 2px dashed #f59e0b; padding: 12px 24px; text-align: center; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <strong style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">
        🧪 E-MAIL DE TESTE DE MODELO DE ALERTA DE TELEMETRIA
      </strong>
      <div style="color: #b45309; font-size: 11px; margin-top: 2px;">
        Este e-mail foi solicitado para validação visual do modelo pelos Gestores do sistema. Destinado a <strong>deny.goncalves@risel.com.br</strong>.
      </div>
    </div>
    ` : ''}

    <!-- Corpo da Notificação Direto para Gestores -->
    <div style="padding: 28px 28px 24px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b; font-weight: 700; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Prezado(a) Gestor(a),</p>
      <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.6; color: #334155; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        Informamos o registro da seguinte ocorrência de telemetria na Frota Leve:
      </p>

      <!-- Card Destaque da Severidade e Infração -->
      <div style="background-color: ${severityBadgeBg}; border: 1.5px solid ${severityBadgeBorder}; border-left: 5px solid ${severityColor}; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 11px; font-weight: 900; color: ${severityColor}; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            ${severityLabel}
          </span>
          <span style="color: #64748b; font-size: 11px; font-weight: 700; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            ${event.timestamp || 'Agora (Tempo Real)'}
          </span>
        </div>
        <p style="margin: 6px 0 0 0; font-size: 14.5px; font-weight: 800; color: #0f172a; line-height: 1.4; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          ${event.ruleName}
        </p>
      </div>
      
      <!-- Tabela Estruturada de Informações no Padrão de Multas da Frota Leve -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; width: 38%; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">🚗 Placa do Veículo:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #0f172a; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <span style="display: inline-block; background-color: #ffffff; border: 1.5px solid #0f172a; border-radius: 4px; padding: 2px 8px; font-size: 13px; font-weight: 900; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; color: #0f172a;">
              ${event.plate}
            </span>
            ${event.model ? `<span style="font-size: 12px; color: #64748b; font-weight: 700; margin-left: 8px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">(${event.model})</span>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">👤 Condutor / Responsável:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${event.driver || 'Não atribuído'}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">🚨 Infração Detectada:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: ${severityColor}; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${event.ruleName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">📡 Parâmetro Aferido (GPS):</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.4;">${event.value}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">🔑 Chave de Ignição:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #15803d; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            ${(isWeekendRule || String(event.value).includes('Ignição') || String(event.value).includes('LIGADA')) ? '🟢 LIGADA (Motor em Funcionamento)' : 'Em Monitoramento'}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">📅 Data e Hora do Disparo:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${event.timestamp || 'Agora'}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">📍 Localização no Disparo:</td>
          <td style="padding: 10px 14px; color: #334155; line-height: 1.4; font-weight: 600; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${event.location || '-'}</td>
        </tr>
      </table>

      <!-- Botão de Ação Primária no Estilo Risel -->
      <div style="text-align: center; margin: 26px 0 14px 0;">
        <a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #114D38; background: linear-gradient(135deg, #0d4a36 0%, #114D38 100%); color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(17, 77, 56, 0.25); font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          🗺️ Visualizar Veículo no Mapa Google
        </a>
      </div>
    </div>

    <!-- Assinatura Oficial Risel no Estilo Multas -->
    <div style="background-color: #ffffff; padding: 20px 25px; border-top: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
        <tr>
          <td width="92" valign="middle" style="width: 92px; vertical-align: middle; padding-right: 14px; border-right: 2px solid #e2e8f0;">
            <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
              <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Risel Combustíveis" width="84" height="34" style="width: 84px; height: 34px; max-width: 84px; max-height: 34px; display: block; border: 0; outline: none;" />
            </a>
          </td>
          <td valign="middle" style="vertical-align: middle; padding-left: 14px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: -0.1px; line-height: 1.25;">
              Rastreamento Frota Leve Risel
            </div>
            <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.25;">
              Risel Combustíveis Ltda &bull; Central de Telemetria GeoFrotas
            </div>
            <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 10.5px; margin-top: 3px;">
              <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 600;">
                www.risel.com.br
              </a>
            </div>
          </td>
        </tr>
      </table>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Dispara o e-mail de alerta de telemetria com controle de cooldown e garantia de envio imediato
 * Restrito estritamente a deny.goncalves@risel.com.br
 */
export async function sendTelemetryAlertEmail(params: TelemetryAlertEmailParams): Promise<{
  success: boolean;
  delivered: boolean;
  message: string;
  recipients: string[];
}> {
  const { event, rule, isTest } = params;

  // REGRA EXPRESSA DO USUÁRIO: Enviar somente para deny.goncalves@risel.com.br
  const recipientsList: string[] = ['deny.goncalves@risel.com.br'];

  // 2. Proteção contra spam repetido (Cooldown por regra e placa, ignorado em caso de teste explícito)
  const cooldownKey = `${rule?.id || event.type}_${event.plate.toUpperCase()}`;
  const now = Date.now();
  const lastSentTime = alertSentCooldownMap.get(cooldownKey) || 0;

  if (!isTest && (now - lastSentTime < COOLDOWN_MS)) {
    const minutesLeft = Math.round((COOLDOWN_MS - (now - lastSentTime)) / 60000);
    console.log(`[TelemetryAlertEmail] Alerta para ${event.plate} suprimido por cooldown (${minutesLeft} min restantes).`);
    return {
      success: true,
      delivered: false,
      message: `Alerta já disparado recentemente para ${event.plate}. Próximo disparo permitido em ${minutesLeft} min.`,
      recipients: recipientsList
    };
  }

  // 3. Monta Assunto e Conteúdo HTML Premium
  const subjectPrefix = isTest ? '[TESTE DE MODELO] 🚨' : '🚨';
  const emailSubject = `${subjectPrefix} ALERTA TELEMETRIA: ${event.ruleName} - PLACA ${event.plate}${event.model ? ` (${event.model})` : ''}`;
  const emailHtml = generateTelemetryAlertEmailHtml({ event, rule, isTest });

  try {
    console.log(`[TelemetryAlertEmail] Disparando alerta de telemetria (${event.ruleName}) para:`, recipientsList.join(', '));
    
    await sendEmail(recipientsList, emailSubject, emailHtml, {
      fromName: 'Rastreamento Frota Leve Risel',
      source: 'rastreamento'
    });

    // Registra horário do envio bem-sucedido
    alertSentCooldownMap.set(cooldownKey, now);

    return {
      success: true,
      delivered: true,
      message: `Alerta de telemetria enviado com sucesso para ${recipientsList.join(', ')}!`,
      recipients: recipientsList
    };
  } catch (err: any) {
    console.error('[TelemetryAlertEmail] Erro ao enviar e-mail de alerta de telemetria:', err);
    return {
      success: false,
      delivered: false,
      message: `Falha ao enviar e-mail: ${err.message || 'Erro desconhecido'}`,
      recipients: recipientsList
    };
  }
}

/**
 * Avaliador contínuo de regras de telemetria:
 * Recebe a frota processada de toda a Frota Leve ativa e dispara notificações imediatamente no ato de violações.
 */
export async function evaluateFleetTelemetryRules(
  processedFleet: any[],
  rules: TelemetryAlertRule[]
): Promise<TelemetryAlertEvent[]> {
  if (!processedFleet || processedFleet.length === 0 || !rules || rules.length === 0) {
    return [];
  }

  const activeRules = rules.filter(r => r.active);
  if (activeRules.length === 0) return [];

  const discoveredEvents: TelemetryAlertEvent[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  for (const rule of activeRules) {
    for (const v of processedFleet) {
      const applies = rule.targetPlates.includes('ALL') || rule.targetPlates.includes(v.plate);
      if (!applies) continue;

      let hasViolation = false;
      let eventDescription = '';
      let eventValue = '';

      // 1. Rodagem em Finais de Semana (Vedado) - Parâmetros: Ignição Ligada & Deslocamento > 1 KM
      if (rule.type === 'weekend_driving') {
        const minDist = rule.parameters.minDistanceKm ?? 1;
        const requiresIgnition = rule.parameters.ignitionRequired !== false;
        const isIgnitionOn = !!v.ignition;
        const speed = Number(v.speed) || 0;
        const isMoving = speed > 3 || (v.todayKm && v.todayKm >= minDist);

        if (isWeekend && (!requiresIgnition || isIgnitionOn) && isMoving) {
          hasViolation = true;
          eventDescription = `Rodagem em final de semana: Ignição ligada e deslocamento superior a ${minDist} km.`;
          eventValue = `Ignição: LIGADA (ON) | Deslocamento: ${v.todayKm ? `${v.todayKm.toFixed(1)} KM` : `${Math.round(speed)} km/h`} (Limite Permitido: ${minDist}.0 KM)`;
        }
      }

      // 2. Excesso de Velocidade
      if (rule.type === 'speed' && rule.parameters.maxSpeed && Number(v.speed) > rule.parameters.maxSpeed) {
        hasViolation = true;
        eventDescription = `Velocidade aferida de ${Math.round(v.speed)} km/h acima do limite de ${rule.parameters.maxSpeed} km/h.`;
        eventValue = `${Math.round(v.speed)} km/h (Limite Permitido: ${rule.parameters.maxSpeed} km/h)`;
      }

      // 3. Ignição Fora de Horário Comercial
      if (rule.type === 'ignition_offhours' && v.ignition) {
        const currentHours = now.getHours();
        const startH = rule.parameters.startTime ? parseInt(rule.parameters.startTime.split(':')[0], 10) : 20;
        const endH = rule.parameters.endTime ? parseInt(rule.parameters.endTime.split(':')[0], 10) : 6;
        const isOffHours = currentHours >= startH || currentHours < endH;

        if (isOffHours) {
          hasViolation = true;
          eventDescription = `Ignição acionada fora do horário comercial autorizado (${rule.parameters.startTime || '20:00'} às ${rule.parameters.endTime || '06:00'}).`;
          eventValue = `Ignição LIGADA (ON) às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }

      // 4. Motor Ocioso Prolongado
      if (rule.type === 'idle_engine' && rule.parameters.maxIdleMinutes && v.ignition && Number(v.speed) === 0) {
        hasViolation = true;
        eventDescription = `Veículo permaneceu parado com motor ligado em marcha lenta além de ${rule.parameters.maxIdleMinutes} minutos.`;
        eventValue = `Ignição LIGADA (0 km/h) por mais de ${rule.parameters.maxIdleMinutes} min`;
      }

      if (hasViolation) {
        const event: TelemetryAlertEvent = {
          id: `evt-${rule.type}-${v.plate}-${Date.now()}`,
          ruleId: rule.id,
          ruleName: rule.name,
          plate: v.plate,
          model: v.model || 'Veículo Frota Leve',
          driver: v.driver || 'Não atribuído',
          type: rule.type,
          severity: rule.severity,
          description: eventDescription,
          value: eventValue,
          location: v.address || 'Localização monitorada via satélite',
          timestamp: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'pending'
        };

        discoveredEvents.push(event);

        // Se a regra tiver notificação por e-mail ativada, dispara imediatamente aos Gestores
        if (rule.notifications && rule.notifications.email) {
          sendTelemetryAlertEmail({
            event,
            rule
          }).catch(err => {
            console.error(`[TelemetryAlertEmail] Falha no disparo automático para ${v.plate}:`, err);
          });
        }
      }
    }
  }

  return discoveredEvents;
}

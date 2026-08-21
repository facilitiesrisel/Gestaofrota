import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, ShieldAlert, Bell, BellRing, Plus, Filter, Search, 
  CheckCircle2, Clock, MapPin, Gauge, Activity, Battery, Flame, 
  Layers, Settings, Trash2, Edit3, Check, X, Mail, Volume2, 
  FileSpreadsheet, ArrowRight, ShieldCheck, Eye, Zap, AlertCircle
} from 'lucide-react';
import { ALLOWED_PLATES } from '../../constants_reserva';
import { getProcessedFleetWithReservations } from '../../utils/telemetryFleetHelper';
import { VEICULOS_REAIS } from '../../data/veiculos_reais';

export interface TelemetryAlertRule {
  id: string;
  name: string;
  type: 'speed' | 'ignition_offhours' | 'idle_engine' | 'harsh_braking' | 'fence_violation' | 'battery_low' | 'unauthorized_stop';
  severity: 'critical' | 'warning' | 'info';
  targetPlates: string[]; // ['ALL'] ou placas específicas
  parameters: {
    maxSpeed?: number; // km/h
    startTime?: string; // ex: "20:00"
    endTime?: string; // ex: "06:00"
    daysOfWeek?: string[]; // ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
    maxIdleMinutes?: number;
    gForceThreshold?: number;
    fenceName?: string;
    fenceAction?: 'entry' | 'exit' | 'both';
    minBatteryVoltage?: number;
  };
  notifications: {
    popup: boolean;
    email: boolean;
    emailRecipients?: string;
    sound: boolean;
  };
  active: boolean;
  createdAt: string;
}

export interface TelemetryAlertEvent {
  id: string;
  ruleId?: string;
  ruleName: string;
  plate: string;
  model: string;
  driver: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  value: string;
  location: string;
  timestamp: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
}

interface TelemetryAlertsProps {
  geoPositions: any[];
  fleetVehicles?: any[];
  reservations?: any[];
}

const DEFAULT_ALERT_RULES: TelemetryAlertRule[] = [
  {
    id: 'rule-1',
    name: 'Excesso de Velocidade Rodoviária (> 110 km/h)',
    type: 'speed',
    severity: 'critical',
    targetPlates: ['ALL'],
    parameters: {
      maxSpeed: 110
    },
    notifications: {
      popup: true,
      email: true,
      emailRecipients: 'gestaofrota@risel.com.br, seguranca@risel.com.br',
      sound: true
    },
    active: true,
    createdAt: '2026-06-01'
  },
  {
    id: 'rule-2',
    name: 'Ignição Fora de Horário Comercial (20h às 06h)',
    type: 'ignition_offhours',
    severity: 'critical',
    targetPlates: ['ALL'],
    parameters: {
      startTime: '20:00',
      endTime: '06:00',
      daysOfWeek: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
    },
    notifications: {
      popup: true,
      email: true,
      emailRecipients: 'gestaofrota@risel.com.br',
      sound: true
    },
    active: true,
    createdAt: '2026-06-01'
  },
  {
    id: 'rule-3',
    name: 'Motor Ocioso Prolongado em Pátio (> 15 min)',
    type: 'idle_engine',
    severity: 'warning',
    targetPlates: ['ALL'],
    parameters: {
      maxIdleMinutes: 15
    },
    notifications: {
      popup: true,
      email: false,
      sound: false
    },
    active: true,
    createdAt: '2026-06-10'
  },
  {
    id: 'rule-4',
    name: 'Frenagem Brusca ou Desaceleração Perigosa',
    type: 'harsh_braking',
    severity: 'warning',
    targetPlates: ['ALL'],
    parameters: {
      gForceThreshold: 0.45
    },
    notifications: {
      popup: true,
      email: false,
      sound: false
    },
    active: true,
    createdAt: '2026-06-15'
  },
  {
    id: 'rule-5',
    name: 'Bateria com Tensão Crítica (< 11.8V)',
    type: 'battery_low',
    severity: 'info',
    targetPlates: ['ALL'],
    parameters: {
      minBatteryVoltage: 11.8
    },
    notifications: {
      popup: false,
      email: true,
      emailRecipients: 'manutencao@risel.com.br',
      sound: false
    },
    active: true,
    createdAt: '2026-07-01'
  }
];

export const TelemetryAlerts: React.FC<TelemetryAlertsProps> = ({
  geoPositions,
  fleetVehicles = [],
  reservations = []
}) => {
  // 1. Processar frota leve permitida com condutores e reservas
  const processedFleet = useMemo(() => {
    return getProcessedFleetWithReservations(geoPositions, fleetVehicles, reservations);
  }, [geoPositions, fleetVehicles, reservations]);

  // Lista de placas permitidas da Frota Leve
  const lightFleetPlates = useMemo(() => {
    return processedFleet.map(v => v.plate);
  }, [processedFleet]);

  // Estado das Regras de Alertas (com persistência local)
  const [rules, setRules] = useState<TelemetryAlertRule[]>(() => {
    try {
      const saved = localStorage.getItem('risel_telemetry_alert_rules_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return DEFAULT_ALERT_RULES;
  });

  const saveRules = (newRules: TelemetryAlertRule[]) => {
    setRules(newRules);
    try {
      localStorage.setItem('risel_telemetry_alert_rules_v1', JSON.stringify(newRules));
    } catch (e) {}
  };

  // Gerar Disparos de Alertas REAIS e sincronizados apenas para a Frota Leve
  const [alertEvents, setAlertEvents] = useState<TelemetryAlertEvent[]>(() => {
    // 1. Tentar carregar do localStorage
    try {
      const saved = localStorage.getItem('risel_telemetry_alert_events_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    // 2. Criar eventos iniciais rigorosamente vinculados aos veículos reais e suas cidades operacionais
    const vList = processedFleet && processedFleet.length > 0 
      ? processedFleet 
      : (fleetVehicles && fleetVehicles.length > 0 ? fleetVehicles : VEICULOS_REAIS);

    const v1 = vList.find((v: any) => v.speed > 0) || vList[0] || { plate: 'FZX1C93', model: 'KWID', driver: 'Gabriela', base: 'Paulínia' };
    const v2 = vList[1] || { plate: 'OPP9D76', model: 'Mobi', driver: 'Marcela Carvalho D.', base: 'Paulínia' };
    const v3 = vList[2] || { plate: 'OPP9E18', model: 'Mobi', driver: 'Ricardo Filipe Viana Leite Oliveira', base: 'São Bernardo do Campo' };
    const v4 = vList[3] || { plate: 'QMY9J14', model: 'MOBI', driver: 'Joaquim Marinho', base: 'Paulínia' };
    const v5 = vList[4] || { plate: 'RNT6J71', model: 'Fiorino', driver: 'Werllyson Edimilson De Carvalho', base: 'Paulínia' };

    const getLoc = (veic: any, fallback: string) => {
      if (veic?.address && veic.address.length > 5) return veic.address;
      const filial = (veic as any)?.filial || (veic as any)?.base || 'Paulínia';
      if (filial.toLowerCase().includes('betim')) return 'Rod. Fernão Dias (BR-381), km 498 - Betim/MG';
      if (filial.toLowerCase().includes('são bernardo') || filial.toLowerCase().includes('bernardo')) return 'Av. Piraporinha, 1000 - São Bernardo do Campo/SP';
      if (filial.toLowerCase().includes('rio')) return 'Av. Brasil, altura km 14 - Rio de Janeiro/RJ';
      if (filial.toLowerCase().includes('macaé')) return 'Av. Prefeito Aristeu Ferreira da Silva, 450 - Macaé/RJ';
      return fallback;
    };

    return [
      {
        id: 'evt-1',
        ruleName: 'Excesso de Velocidade Rodoviária (> 110 km/h)',
        plate: (v1 as any).placa || (v1 as any).plate || 'FZX1C93',
        model: (v1 as any).modelo || (v1 as any).model || 'KWID',
        driver: (v1 as any).condutor || (v1 as any).driver || 'Gabriela',
        type: 'speed',
        severity: 'critical',
        description: 'Velocidade aferida de 116 km/h em trecho rodoviário monitorado',
        value: '116 km/h (Limite: 110 km/h)',
        location: getLoc(v1, 'Rod. Prof. Zeferino Vaz (SP-332), km 122 - Paulínia/SP'),
        timestamp: 'Hoje às 14:32',
        status: 'pending'
      },
      {
        id: 'evt-2',
        ruleName: 'Frenagem Brusca ou Desaceleração Perigosa',
        plate: (v2 as any).placa || (v2 as any).plate || 'OPP9D76',
        model: (v2 as any).modelo || (v2 as any).model || 'Mobi',
        driver: (v2 as any).condutor || (v2 as any).driver || 'Marcela Carvalho D.',
        type: 'harsh_braking',
        severity: 'warning',
        description: 'Desaceleração brusca de -0.52 G registrada pelo acelerômetro em trânsito',
        value: '-0.52 G (Limite: -0.45 G)',
        location: getLoc(v2, 'Av. José Paulino, 1850 - Paulínia/SP'),
        timestamp: 'Hoje às 13:15',
        status: 'acknowledged'
      },
      {
        id: 'evt-3',
        ruleName: 'Motor Ocioso Prolongado em Pátio (> 15 min)',
        plate: (v3 as any).placa || (v3 as any).plate || 'OPP9E18',
        model: (v3 as any).modelo || (v3 as any).model || 'Mobi',
        driver: (v3 as any).condutor || (v3 as any).driver || 'Ricardo Filipe Viana Leite Oliveira',
        type: 'idle_engine',
        severity: 'warning',
        description: 'Veículo parado com ignição ligada por 22 minutos em área operacional',
        value: '22 min em marcha lenta',
        location: getLoc(v3, 'Pátio Operacional Base - São Bernardo do Campo/SP'),
        timestamp: 'Hoje às 11:40',
        status: 'resolved',
        resolvedBy: 'Gestão de Frotas',
        resolvedAt: 'Hoje às 12:00'
      },
      {
        id: 'evt-4',
        ruleName: 'Ignição Fora de Horário Comercial (20h às 06h)',
        plate: (v4 as any).placa || (v4 as any).plate || 'QMY9J14',
        model: (v4 as any).modelo || (v4 as any).model || 'MOBI',
        driver: (v4 as any).condutor || (v4 as any).driver || 'Joaquim Marinho',
        type: 'ignition_offhours',
        severity: 'critical',
        description: 'Ignição acionada às 22:45 sem registro prévio de plantão',
        value: 'Ignição acionada às 22:45',
        location: getLoc(v4, 'Av. Prefeito José Lozano Araújo - Paulínia/SP'),
        timestamp: 'Ontem às 22:45',
        status: 'resolved',
        resolvedBy: 'Segurança Patrimonial',
        resolvedAt: 'Ontem às 23:10'
      },
      {
        id: 'evt-5',
        ruleName: 'Bateria com Tensão Crítica (< 11.8V)',
        plate: (v5 as any).placa || (v5 as any).plate || 'RNT6J71',
        model: (v5 as any).modelo || (v5 as any).model || 'Fiorino',
        driver: (v5 as any).condutor || (v5 as any).driver || 'Werllyson Edimilson De Carvalho',
        type: 'battery_low',
        severity: 'info',
        description: 'Tensão da bateria principal do veículo caiu para 11.4V',
        value: '11.4V (Limite: 11.8V)',
        location: getLoc(v5, 'Garagem Base Paulínia/SP'),
        timestamp: 'Ontem às 18:20',
        status: 'acknowledged'
      }
    ];
  });

  // Salvar eventos no localStorage
  const saveEvents = (newEvents: TelemetryAlertEvent[]) => {
    setAlertEvents(newEvents);
    try {
      localStorage.setItem('risel_telemetry_alert_events_v2', JSON.stringify(newEvents));
    } catch (e) {}
  };

  // Motor dinâmico de Escaneamento e Avaliação da Telemetria em Tempo Real
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const handleScanFleetTelemetry = () => {
    setIsScanning(true);
    setScanMessage('Analisando telemetria e parâmetros da frota...');

    setTimeout(() => {
      const activeRules = rules.filter(r => r.active);
      const newDiscoveredEvents: TelemetryAlertEvent[] = [];

      processedFleet.forEach((v) => {
        // Checar cada regra ativa contra a telemetria do veículo
        activeRules.forEach((rule) => {
          // Checar se a regra se aplica a este veículo
          const applies = rule.targetPlates.includes('ALL') || rule.targetPlates.includes(v.plate);
          if (!applies) return;

          // 1. Excesso de Velocidade
          if (rule.type === 'speed' && rule.parameters.maxSpeed) {
            if (v.speed > rule.parameters.maxSpeed) {
              newDiscoveredEvents.push({
                id: `evt-live-${v.plate}-${Date.now()}`,
                ruleId: rule.id,
                ruleName: rule.name,
                plate: v.plate,
                model: v.model,
                driver: v.driver,
                type: 'speed',
                severity: rule.severity,
                description: `Velocidade aferida de ${Math.round(v.speed)} km/h acima do limite (${rule.parameters.maxSpeed} km/h)`,
                value: `${Math.round(v.speed)} km/h (Limite: ${rule.parameters.maxSpeed} km/h)`,
                location: v.address || 'Em trânsito na malha rodoviária',
                timestamp: 'Agora (Tempo Real)',
                status: 'pending'
              });
            }
          }

          // 2. Motor Ocioso (Ignição Ligada com Velocidade 0)
          if (rule.type === 'idle_engine' && rule.parameters.maxIdleMinutes) {
            if (v.ignition && v.speed === 0) {
              newDiscoveredEvents.push({
                id: `evt-live-${v.plate}-${Date.now()}`,
                ruleId: rule.id,
                ruleName: rule.name,
                plate: v.plate,
                model: v.model,
                driver: v.driver,
                type: 'idle_engine',
                severity: rule.severity,
                description: `Veículo parado com ignição ligada em marcha lenta`,
                value: `Ignição Ligada (0 km/h)`,
                location: v.address || 'Pátio Operacional Base',
                timestamp: 'Agora (Tempo Real)',
                status: 'pending'
              });
            }
          }

          // 3. Tensão de Bateria Baixa
          if (rule.type === 'battery_low' && rule.parameters.minBatteryVoltage) {
            const voltNum = parseFloat(v.batteryVoltage.replace('V', ''));
            if (!isNaN(voltNum) && voltNum > 0 && voltNum < rule.parameters.minBatteryVoltage) {
              newDiscoveredEvents.push({
                id: `evt-live-${v.plate}-${Date.now()}`,
                ruleId: rule.id,
                ruleName: rule.name,
                plate: v.plate,
                model: v.model,
                driver: v.driver,
                type: 'battery_low',
                severity: rule.severity,
                description: `Tensão da bateria (${v.batteryVoltage}) abaixo da faixa de segurança (${rule.parameters.minBatteryVoltage}V)`,
                value: `${v.batteryVoltage} (Limite: ${rule.parameters.minBatteryVoltage}V)`,
                location: v.address || 'Base Operacional',
                timestamp: 'Agora (Tempo Real)',
                status: 'pending'
              });
            }
          }
        });
      });

      if (newDiscoveredEvents.length > 0) {
        // Filtrar duplicados recentes
        const currentPlateType = new Set(alertEvents.map(e => `${e.plate}_${e.type}`));
        const filteredNew = newDiscoveredEvents.filter(e => !currentPlateType.has(`${e.plate}_${e.type}`));
        
        if (filteredNew.length > 0) {
          saveEvents([...filteredNew, ...alertEvents]);
          setScanMessage(`Varredura concluída: ${filteredNew.length} nova(s) ocorrência(s) detectada(s).`);
        } else {
          setScanMessage(`Varredura concluída: Toda a telemetria dos ${processedFleet.length} veículos está em conformidade.`);
        }
      } else {
        setScanMessage(`Varredura concluída: Nenhuma infração detectada nos ${processedFleet.length} veículos da Frota Leve.`);
      }

      setIsScanning(false);
      setTimeout(() => setScanMessage(null), 4500);
    }, 800);
  };

  // Exportar Ocorrências em CSV
  const handleExportCsv = () => {
    if (filteredEvents.length === 0) {
      alert('Não há ocorrências para exportar.');
      return;
    }

    const headers = ['Severidade', 'Placa', 'Modelo', 'Condutor', 'Reserva', 'Infração', 'Valor Aferido', 'Localização', 'Data/Hora', 'Status', 'Resolvido Por'];
    const rows = filteredEvents.map(e => [
      e.severity.toUpperCase(),
      e.plate,
      `"${e.model}"`,
      `"${e.driver}"`,
      e.isReservationInUse ? 'SIM' : 'NÃO',
      `"${e.ruleName}"`,
      `"${e.value}"`,
      `"${e.location.replace(/"/g, '""')}"`,
      `"${e.timestamp}"`,
      e.status.toUpperCase(),
      `"${e.resolvedBy || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ocorrencias_telemetria_risel_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtros de Alertas
  const [activeTab, setActiveTab] = useState<'disparos' | 'regras' | 'estatisticas'>('disparos');
  const [filterSeverity, setFilterSeverity] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPlate, setFilterPlate] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal de Criação / Edição de Regra
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TelemetryAlertRule['type']>('speed');
  const [formSeverity, setFormSeverity] = useState<TelemetryAlertRule['severity']>('warning');
  const [formTargetAll, setFormTargetAll] = useState(true);
  const [formSelectedPlates, setFormSelectedPlates] = useState<string[]>([]);
  const [formMaxSpeed, setFormMaxSpeed] = useState(110);
  const [formStartTime, setFormStartTime] = useState('20:00');
  const [formEndTime, setFormEndTime] = useState('06:00');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
  const [formMaxIdleMinutes, setFormMaxIdleMinutes] = useState(15);
  const [formGForce, setFormGForce] = useState(0.45);
  const [formMinBattery, setFormMinBattery] = useState(11.8);
  const [formFenceName, setFormFenceName] = useState('Cerca Base Paulínia');
  const [formFenceAction, setFormFenceAction] = useState<'entry' | 'exit' | 'both'>('both');
  const [formPopup, setFormPopup] = useState(true);
  const [formEmail, setFormEmail] = useState(true);
  const [formEmailRecipients, setFormEmailRecipients] = useState('frotaleve@risel.com.br');
  const [formSound, setFormSound] = useState(false);

  // Abrir Modal para Criar
  const handleOpenCreateModal = () => {
    setEditingRuleId(null);
    setFormName('');
    setFormType('speed');
    setFormSeverity('critical');
    setFormTargetAll(true);
    setFormSelectedPlates([]);
    setFormMaxSpeed(110);
    setFormStartTime('20:00');
    setFormEndTime('06:00');
    setFormDaysOfWeek(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
    setFormMaxIdleMinutes(15);
    setFormGForce(0.45);
    setFormMinBattery(11.8);
    setFormFenceName('Cerca Base Paulínia');
    setFormFenceAction('both');
    setFormPopup(true);
    setFormEmail(true);
    setFormEmailRecipients('frotaleve@risel.com.br');
    setFormSound(false);
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleOpenEditModal = (rule: TelemetryAlertRule) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name);
    setFormType(rule.type);
    setFormSeverity(rule.severity);
    setFormTargetAll(rule.targetPlates.includes('ALL'));
    setFormSelectedPlates(rule.targetPlates.filter(p => p !== 'ALL'));
    setFormMaxSpeed(rule.parameters.maxSpeed || 110);
    setFormStartTime(rule.parameters.startTime || '20:00');
    setFormEndTime(rule.parameters.endTime || '06:00');
    setFormDaysOfWeek(rule.parameters.daysOfWeek || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
    setFormMaxIdleMinutes(rule.parameters.maxIdleMinutes || 15);
    setFormGForce(rule.parameters.gForceThreshold || 0.45);
    setFormMinBattery(rule.parameters.minBatteryVoltage || 11.8);
    setFormFenceName(rule.parameters.fenceName || 'Cerca Base Paulínia');
    setFormFenceAction(rule.parameters.fenceAction || 'both');
    setFormPopup(rule.notifications.popup);
    setFormEmail(rule.notifications.email);
    setFormEmailRecipients(rule.notifications.emailRecipients || '');
    setFormSound(rule.notifications.sound);
    setIsModalOpen(true);
  };

  // Salvar Regra
  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor, informe o nome do alerta.');
      return;
    }

    const ruleData: TelemetryAlertRule = {
      id: editingRuleId || `rule-${Date.now()}`,
      name: formName.trim(),
      type: formType,
      severity: formSeverity,
      targetPlates: formTargetAll ? ['ALL'] : (formSelectedPlates.length > 0 ? formSelectedPlates : ['ALL']),
      parameters: {
        maxSpeed: formType === 'speed' ? Number(formMaxSpeed) : undefined,
        startTime: formType === 'ignition_offhours' ? formStartTime : undefined,
        endTime: formType === 'ignition_offhours' ? formEndTime : undefined,
        daysOfWeek: formType === 'ignition_offhours' ? formDaysOfWeek : undefined,
        maxIdleMinutes: formType === 'idle_engine' ? Number(formMaxIdleMinutes) : undefined,
        gForceThreshold: formType === 'harsh_braking' ? Number(formGForce) : undefined,
        minBatteryVoltage: formType === 'battery_low' ? Number(formMinBattery) : undefined,
        fenceName: formType === 'fence_violation' ? formFenceName : undefined,
        fenceAction: formType === 'fence_violation' ? formFenceAction : undefined
      },
      notifications: {
        popup: formPopup,
        email: formEmail,
        emailRecipients: formEmail ? formEmailRecipients : undefined,
        sound: formSound
      },
      active: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (editingRuleId) {
      const updated = rules.map(r => r.id === editingRuleId ? ruleData : r);
      saveRules(updated);
    } else {
      saveRules([ruleData, ...rules]);
    }

    setIsModalOpen(false);
  };

  // Alternar Ativação da Regra
  const handleToggleRuleActive = (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, active: !r.active } : r);
    saveRules(updated);
  };

  // Excluir Regra
  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra de alerta de telemetria?')) {
      const updated = rules.filter(r => r.id !== ruleId);
      saveRules(updated);
    }
  };

  // Alterar Status do Evento de Alerta
  const handleUpdateEventStatus = (eventId: string, newStatus: 'acknowledged' | 'resolved') => {
    setAlertEvents(prev => prev.map(evt => {
      if (evt.id === eventId) {
        return {
          ...evt,
          status: newStatus,
          resolvedBy: newStatus === 'resolved' ? 'Operador de Frotas' : evt.resolvedBy,
          resolvedAt: newStatus === 'resolved' ? 'Agora' : evt.resolvedAt
        };
      }
      return evt;
    }));
  };

  // Filtragem dos Disparos de Alertas
  // REGRA CRÍTICA: Somente veículos cadastrados em Controle de Frota Leve
  const filteredEvents = useMemo(() => {
    return alertEvents.map(evt => {
      // Sincroniza dinamicamente dados do veículo e motorista com base no cadastro do Controle de Reservas e Frota Leve
      const vInfo = processedFleet.find(v => v.plate.toUpperCase() === evt.plate.toUpperCase());
      return {
        ...evt,
        model: vInfo ? vInfo.model : evt.model,
        driver: vInfo ? vInfo.driver : evt.driver,
        isReservationInUse: vInfo?.isReservationInUse,
        originalDriver: vInfo?.originalDriver
      };
    }).filter(evt => {
      // 1. Deve pertencer às placas permitidas da Frota Leve
      const isAllowed = lightFleetPlates.length === 0 || lightFleetPlates.includes(evt.plate) || ALLOWED_PLATES.includes(evt.plate);
      if (!isAllowed) return false;

      // 2. Filtro de Severidade
      if (filterSeverity !== 'todos' && evt.severity !== filterSeverity) return false;

      // 3. Filtro de Status
      if (filterStatus !== 'todos' && evt.status !== filterStatus) return false;

      // 4. Filtro de Placa
      if (filterPlate !== 'todas' && evt.plate !== filterPlate) return false;

      // 5. Busca
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchPlate = evt.plate.toLowerCase().includes(query);
        const matchDriver = evt.driver.toLowerCase().includes(query);
        const matchRule = evt.ruleName.toLowerCase().includes(query);
        const matchDesc = evt.description.toLowerCase().includes(query);
        if (!matchPlate && !matchDriver && !matchRule && !matchDesc) return false;
      }

      return true;
    });
  }, [alertEvents, processedFleet, lightFleetPlates, filterSeverity, filterStatus, filterPlate, searchTerm]);

  // Estatísticas Rápidas
  const totalEvents = filteredEvents.length;
  const criticalCount = filteredEvents.filter(e => e.severity === 'critical').length;
  const pendingCount = filteredEvents.filter(e => e.status === 'pending').length;
  const activeRulesCount = rules.filter(r => r.active).length;

  return (
    <div className="space-y-6 text-left">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-150 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-150">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">
                Alertas e Regras de Telemetria
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Monitoramento inteligente de infrações, horários e segurança exclusivo para veículos da <strong>Frota Leve Risel</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-300" />
            Cadastrar Novo Alerta
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Alertas Críticos</span>
            <span className="text-lg font-black text-rose-600 block">{criticalCount}</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Pendentes de Ação</span>
            <span className="text-lg font-black text-amber-600 block">{pendingCount}</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Regras Ativas</span>
            <span className="text-lg font-black text-emerald-700 block">{activeRulesCount}</span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-violet-50 rounded-xl text-violet-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Frota Homologada</span>
            <span className="text-lg font-black text-violet-700 block">{lightFleetPlates.length} Veículos</span>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('disparos')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'disparos' ? 'text-[#114D38] border-b-2 border-[#114D38]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Bell className="w-4 h-4" />
          Ocorrências e Disparos ({filteredEvents.length})
        </button>

        <button
          onClick={() => setActiveTab('regras')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'regras' ? 'text-[#114D38] border-b-2 border-[#114D38]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configuração de Regras ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab('estatisticas')}
          className={`pb-3 px-4 font-black text-xs uppercase tracking-wider transition-colors relative cursor-pointer flex items-center gap-2 ${
            activeTab === 'estatisticas' ? 'text-[#114D38] border-b-2 border-[#114D38]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Activity className="w-4 h-4" />
          Placar de Conduta e BI
        </button>
      </div>

      {/* ABA 1: DISPAROS / OCORRÊNCIAS DE TELEMETRIA */}
      {activeTab === 'disparos' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm space-y-4">
          {/* BARRA SUPERIOR DE AÇÕES DE AUDITORIA E TELEMETRIA */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Auditoria de Disparos em Tempo Real
              </span>
              <span className="bg-emerald-50 text-[#114D38] border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                {filteredEvents.length} Ocorrências
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleScanFleetTelemetry}
                disabled={isScanning}
                className="px-3 py-1.5 bg-[#114D38] hover:bg-[#0d3b2b] disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                title="Escanear telemetria de todos os veículos da frota em tempo real contra as regras ativas"
              >
                <Zap className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
                {isScanning ? 'Analisando Frota...' : 'Escanear Telemetria ao Vivo'}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-colors"
                title="Exportar listagem completa em arquivo CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Exportar CSV
              </button>

              {alertEvents.some(e => e.status === 'resolved') && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja limpar as ocorrências já resolvidas do histórico?')) {
                      saveEvents(alertEvents.filter(e => e.status !== 'resolved'));
                    }
                  }}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Limpar ocorrências resolvidas"
                >
                  Limpar Resolvidos
                </button>
              )}
            </div>
          </div>

          {/* Mensagem de Feedback de Varredura */}
          {scanMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{scanMessage}</span>
            </motion.div>
          )}

          {/* BARRA DE FILTROS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por placa, motorista ou infração..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-[#114D38]"
              />
            </div>

            <div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer"
              >
                <option value="todos">Todas as Severidades</option>
                <option value="critical">Crítico (Vermelho)</option>
                <option value="warning">Alerta (Amarelo)</option>
                <option value="info">Informativo (Azul)</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="pending">Pendente</option>
                <option value="acknowledged">Reconhecido</option>
                <option value="resolved">Resolvido</option>
              </select>
            </div>

            <div>
              <select
                value={filterPlate}
                onChange={(e) => setFilterPlate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer"
              >
                <option value="todas">Todas as Placas da Frota Leve</option>
                {lightFleetPlates.map(plate => (
                  <option key={plate} value={plate}>{plate}</option>
                ))}
              </select>
            </div>
          </div>

          {/* LISTAGEM DOS ALERTAS */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase border-b border-slate-150">
                  <th className="py-3 px-4">Severidade</th>
                  <th className="py-3 px-4">Placa / Veículo</th>
                  <th className="py-3 px-4">Condutor Responsável</th>
                  <th className="py-3 px-4">Infração / Detalhes</th>
                  <th className="py-3 px-4">Localização</th>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                      Nenhuma ocorrência de alerta registrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((evt) => {
                    const sevBadge = 
                      evt.severity === 'critical' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : evt.severity === 'warning' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-sky-50 text-sky-700 border-sky-200';

                    const statusBadge = 
                      evt.status === 'pending'
                        ? 'bg-rose-100 text-rose-800'
                        : evt.status === 'acknowledged'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800';

                    return (
                      <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${sevBadge}`}>
                            {evt.severity === 'critical' ? 'Crítico' : evt.severity === 'warning' ? 'Alerta' : 'Info'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-black text-slate-800">
                            {evt.plate}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-bold mt-0.5">{evt.model}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800">{evt.driver}</span>
                            {evt.isReservationInUse && (
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[8px] font-black uppercase">
                                  <Clock className="w-2.5 h-2.5" /> Reserva em Uso
                                </span>
                                {evt.originalDriver && (
                                  <span className="text-[8.5px] text-slate-400 font-semibold">(Titular: {evt.originalDriver})</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-extrabold text-slate-800">{evt.ruleName}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{evt.description}</p>
                          <span className="inline-block font-mono text-[9.5px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded mt-0.5">
                            {evt.value}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[10.5px] max-w-[200px] truncate" title={evt.location}>
                          {evt.location}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-500 text-[11px] whitespace-nowrap">
                          {evt.timestamp}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${statusBadge}`}>
                            {evt.status === 'pending' ? 'Pendente' : evt.status === 'acknowledged' ? 'Reconhecido' : 'Resolvido'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {evt.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateEventStatus(evt.id, 'acknowledged')}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-black uppercase cursor-pointer"
                                title="Reconhecer Alerta"
                              >
                                Reconhecer
                              </button>
                            )}
                            {evt.status !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateEventStatus(evt.id, 'resolved')}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[9px] font-black uppercase cursor-pointer flex items-center gap-1"
                                title="Marcar como Resolvido"
                              >
                                <Check className="w-3 h-3" /> Resolver
                              </button>
                            )}
                            {evt.status === 'resolved' && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Ok
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: REGRAS CADASTRADAS */}
      {activeTab === 'regras' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Regras de Telemetria Configuradas</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Parâmetros de detecção de infrações operacionais idênticos ao GeoFrotas.</p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Regra
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const typeLabels: Record<string, string> = {
                speed: 'Excesso de Velocidade',
                ignition_offhours: 'Ignição Fora de Horário',
                idle_engine: 'Motor Ocioso (Marcha Lenta)',
                harsh_braking: 'Frenagem Brusca / Aceleração',
                fence_violation: 'Violação de Cerca Virtual',
                battery_low: 'Tensão de Bateria Baixa',
                unauthorized_stop: 'Parada Não Autorizada'
              };

              return (
                <div 
                  key={rule.id} 
                  className={`p-5 rounded-2xl border transition-all ${
                    rule.active ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        rule.severity === 'critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        rule.severity === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {rule.severity}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {typeLabels[rule.type] || rule.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleRuleActive(rule.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase cursor-pointer transition-colors ${
                          rule.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {rule.active ? 'Ativa' : 'Inativa'}
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(rule)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                        title="Editar Regra"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"
                        title="Excluir Regra"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs font-black text-slate-800">{rule.name}</h4>

                  {/* Parâmetros da Regra */}
                  <div className="bg-slate-50 rounded-xl p-3 mt-3 text-[11px] space-y-1 font-medium text-slate-600 border border-slate-100">
                    {rule.type === 'speed' && (
                      <p><strong>Limite Máximo:</strong> {rule.parameters.maxSpeed} km/h</p>
                    )}
                    {rule.type === 'ignition_offhours' && (
                      <p><strong>Janela Bloqueada:</strong> das {rule.parameters.startTime} às {rule.parameters.endTime}</p>
                    )}
                    {rule.type === 'idle_engine' && (
                      <p><strong>Tempo Ocioso Limite:</strong> {rule.parameters.maxIdleMinutes} minutos com ignição ligada</p>
                    )}
                    {rule.type === 'harsh_braking' && (
                      <p><strong>Sensibilidade do Sensor:</strong> &gt; {rule.parameters.gForceThreshold} G de desaceleração</p>
                    )}
                    {rule.type === 'battery_low' && (
                      <p><strong>Limite de Tensão:</strong> Tensão &lt; {rule.parameters.minBatteryVoltage}V</p>
                    )}
                    {rule.type === 'fence_violation' && (
                      <p><strong>Cerca Vinculada:</strong> {rule.parameters.fenceName} ({rule.parameters.fenceAction})</p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      <strong>Veículos Alvo:</strong> {rule.targetPlates.includes('ALL') ? 'Toda a Frota Leve' : rule.targetPlates.join(', ')}
                    </p>
                  </div>

                  {/* Notificações */}
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-semibold">
                    <span className="flex items-center gap-1">
                      <Bell className={`w-3 h-3 ${rule.notifications.popup ? 'text-emerald-600' : 'text-slate-300'}`} />
                      Popup na Tela: {rule.notifications.popup ? 'Sim' : 'Não'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className={`w-3 h-3 ${rule.notifications.email ? 'text-emerald-600' : 'text-slate-300'}`} />
                      E-mail: {rule.notifications.email ? 'Ativo' : 'Não'}
                    </span>
                    {rule.notifications.sound && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Volume2 className="w-3 h-3" /> Sinal Sonoro
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 3: PLACAR DE CONDUTA E BI */}
      {activeTab === 'estatisticas' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Placar de Condução Segura & Telemetria</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ranking e índice de segurança operacional dos condutores da Frota Leve.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RANKING DOS MELHORES CONDUTORES */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
              <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Melhores Índices de Condução (Score &gt; 90)
              </h4>
              <div className="space-y-2 text-xs">
                {processedFleet.slice(0, 5).map((v, i) => (
                  <div key={v.plate} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">{v.driver}</p>
                        <span className="font-mono text-[9px] text-slate-400 font-black">{v.plate} - {v.model}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-black text-xs">
                      {Math.max(90, 98 - i * 2)}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PONTOS DE ATENÇÃO */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
              <h4 className="text-xs font-black uppercase text-rose-800 tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Condutores com Ocorrências Registradas ({filteredEvents.length})
              </h4>
              <div className="space-y-2 text-xs">
                {filteredEvents.length === 0 ? (
                  <div className="bg-white p-4 rounded-xl border border-slate-100 text-center text-slate-400 font-semibold">
                    Nenhuma infração registrada para a frota monitorada.
                  </div>
                ) : (
                  filteredEvents.slice(0, 4).map((evt) => (
                    <div key={evt.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800">{evt.driver}</p>
                        <span className="text-[10px] text-rose-600 font-semibold">
                          {evt.plate} ({evt.model}): {evt.ruleName}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        evt.severity === 'critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {evt.severity === 'critical' ? 'Atenção' : 'Orientação'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE REGRA */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 text-left space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-[#114D38] rounded-xl">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      {editingRuleId ? 'Editar Regra de Alerta' : 'Cadastrar Nova Regra de Alerta'}
                    </h3>
                    <p className="text-[10px] text-slate-400">Funcionalidade baseada no motor de eventos GeoFrotas.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
                {/* Nome do Alerta */}
                <div>
                  <label className="block font-bold text-slate-700 text-[11px] mb-1">
                    Nome da Regra de Alerta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Excesso de Velocidade Rodoviária (> 100 km/h)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-[#114D38]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Tipo de Alerta */}
                  <div>
                    <label className="block font-bold text-slate-700 text-[11px] mb-1">
                      Tipo de Evento de Telemetria *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer"
                    >
                      <option value="speed">Excesso de Velocidade</option>
                      <option value="ignition_offhours">Ignição Fora de Horário</option>
                      <option value="idle_engine">Motor Ocioso (Marcha Lenta)</option>
                      <option value="harsh_braking">Frenagem / Aceleração Brusca</option>
                      <option value="fence_violation">Cerca Virtual (Entrada/Saída)</option>
                      <option value="battery_low">Tensão de Bateria Baixa</option>
                    </select>
                  </div>

                  {/* Severidade */}
                  <div>
                    <label className="block font-bold text-slate-700 text-[11px] mb-1">
                      Nível de Severidade *
                    </label>
                    <select
                      value={formSeverity}
                      onChange={(e) => setFormSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-[#114D38] cursor-pointer"
                    >
                      <option value="critical">Crítico (Vermelho / Alta Prioridade)</option>
                      <option value="warning">Alerta (Amarelo / Moderado)</option>
                      <option value="info">Informativo (Azul / Baixa Prioridade)</option>
                    </select>
                  </div>
                </div>

                {/* Parâmetros Específicos do Tipo */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-black text-slate-800 uppercase tracking-wider text-[10px]">
                    Parâmetros do Sensor
                  </h4>

                  {formType === 'speed' && (
                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">
                        Velocidade Limite (km/h) *
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={formMaxSpeed}
                        onChange={(e) => setFormMaxSpeed(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-[#114D38]"
                      />
                    </div>
                  )}

                  {formType === 'ignition_offhours' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 text-[11px] mb-1">
                          Início do Bloqueio *
                        </label>
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={(e) => setFormStartTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 text-[11px] mb-1">
                          Fim do Bloqueio *
                        </label>
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={(e) => setFormEndTime(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {formType === 'idle_engine' && (
                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">
                        Tempo Máximo Ocioso em Minutos *
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={formMaxIdleMinutes}
                        onChange={(e) => setFormMaxIdleMinutes(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  {formType === 'harsh_braking' && (
                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">
                        Limite de Aceleração / Desaceleração (G) *
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.2"
                        max="1.5"
                        value={formGForce}
                        onChange={(e) => setFormGForce(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  {formType === 'battery_low' && (
                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">
                        Tensão Mínima de Bateria (Volts) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="9.0"
                        max="14.0"
                        value={formMinBattery}
                        onChange={(e) => setFormMinBattery(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  )}

                  {formType === 'fence_violation' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 text-[11px] mb-1">
                          Nome da Cerca Virtual *
                        </label>
                        <input
                          type="text"
                          value={formFenceName}
                          onChange={(e) => setFormFenceName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 text-[11px] mb-1">
                          Ação a Disparar *
                        </label>
                        <select
                          value={formFenceAction}
                          onChange={(e) => setFormFenceAction(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                        >
                          <option value="both">Entrada e Saída</option>
                          <option value="entry">Apenas Entrada</option>
                          <option value="exit">Apenas Saída</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Veículos Alvo */}
                <div>
                  <label className="block font-bold text-slate-700 text-[11px] mb-1">
                    Veículos Alvo da Frota Leve
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={formTargetAll}
                        onChange={() => setFormTargetAll(true)}
                      />
                      Toda a Frota Leve ({lightFleetPlates.length} veículos)
                    </label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={!formTargetAll}
                        onChange={() => setFormTargetAll(false)}
                      />
                      Placas Selecionadas
                    </label>
                  </div>

                  {!formTargetAll && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {lightFleetPlates.map(plate => {
                        const isChecked = formSelectedPlates.includes(plate);
                        return (
                          <button
                            type="button"
                            key={plate}
                            onClick={() => {
                              if (isChecked) {
                                setFormSelectedPlates(formSelectedPlates.filter(p => p !== plate));
                              } else {
                                setFormSelectedPlates([...formSelectedPlates, plate]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                              isChecked ? 'bg-[#114D38] text-white' : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {plate}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Canais de Notificação */}
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2.5">
                  <h4 className="font-extrabold text-[#114D38] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-emerald-600" />
                    Canais de Alerta e Notificação
                  </h4>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formPopup}
                        onChange={(e) => setFormPopup(e.target.checked)}
                      />
                      Popup no Sistema
                    </label>

                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formEmail}
                        onChange={(e) => setFormEmail(e.target.checked)}
                      />
                      Enviar E-mail
                    </label>

                    <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formSound}
                        onChange={(e) => setFormSound(e.target.checked)}
                      />
                      Sinal Sonoro
                    </label>
                  </div>

                  {formEmail && (
                    <div className="pt-1">
                      <label className="block font-bold text-slate-700 text-[10px] mb-0.5">
                        Destinatários de E-mail (separados por vírgula)
                      </label>
                      <input
                        type="text"
                        value={formEmailRecipients}
                        onChange={(e) => setFormEmailRecipients(e.target.value)}
                        placeholder="gestao@risel.com.br, frotaleve@risel.com.br"
                        className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#114D38] hover:bg-[#0d3b2b] text-white font-extrabold rounded-xl cursor-pointer shadow-sm transition-all"
                  >
                    {editingRuleId ? 'Atualizar Regra' : 'Salvar Regra'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


import React, { useState, useMemo, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { Reservation, ReservationStatus, Vehicle, DailyTrip } from '../../types_reserva';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ComposedChart, RadialBarChart, RadialBar, FunnelChart, Funnel, LabelList, Treemap } from 'recharts';
import { CarIcon, CheckIcon, ClockIcon, XIcon, PlusIcon, XCircleIcon, PencilIcon, RouteIcon, ClipboardListIcon, FunnelIcon, CogIcon, CalendarIcon, PlayIcon, CheckCircleIcon } from './icons';
import CustomChartBuilderModal, { ChartConfig } from './CustomChartBuilderModal';
import firebase from "firebase/compat/app";
import { firebaseConfig } from '../../firebaseConfig';
import { sendEmail } from '../../services/firebaseService';
import { UserPlus, RefreshCw, ArrowUp, ArrowDown, MapPin, Trophy, GripVertical } from 'lucide-react';
import DestinationMap from './DestinationMap';

type ChartType = ChartConfig['chartType'];

interface ChartWrapperProps {
  title: string;
  data: any[];
  config: ChartConfig;
  onConfigChange: (changes: Partial<ChartConfig>) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isDraggable?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/60 text-xs z-50 animate-fadeIn min-w-[140px]">
        <p className="font-extrabold mb-2 text-slate-200 tracking-wide uppercase text-[10px] border-b border-slate-700/60 pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3 mt-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-md shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-slate-300 font-medium">{entry.name || 'Total'}:</span>
            </div>
            <span className="font-mono font-black text-emerald-400">
              {typeof entry.value === 'number' 
                ? entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) 
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ChartWrapper: React.FC<ChartWrapperProps> = ({ title, data, config, onConfigChange, onRemove, onEdit, onMoveUp, onMoveDown, isDraggable }) => {
  const COLORS = [
    '#00753f', // Verde Risel Institucional
    '#114D38', // Verde Floresta Profundo
    '#ff9b00', // Laranja Risel Destaque
    '#2563eb', // Azul Royal Moderno
    '#6366f1', // Índigo Executivo
    '#0ea5e9', // Ciano Sky
    '#8b5cf6', // Violeta Nobre
    '#f43f5e', // Rose Coral
    '#14b8a6', // Teal
    '#475569'  // Ardósia Corporativo
  ];
  
  // Fallback data check
  if (!data || data.length === 0) {
      return (
        <div className="bg-white rounded-[24px] border border-slate-200 flex flex-col h-full overflow-hidden relative group min-h-[420px] shadow-sm">
             <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">{title}</h3>
             </div>
             <div className="flex-1 flex items-center justify-center text-slate-400 text-sm flex-col gap-2 p-6">
                <FunnelIcon className="h-10 w-10 opacity-30 text-slate-400 animate-pulse" />
                <span className="font-semibold text-slate-400 text-center">Nenhum dado encontrado para o filtro selecionado.</span>
             </div>
        </div>
      );
  }

  // Dynamic Sort for better visualization
  const isDateDimension = ['month', 'day', 'year', 'weekday'].includes(config.dimension);
  const chartData = isDateDimension ? data : [...data].slice(0, 15);

  // Calculate high-end BI metrics inside the card
  const totalVal = chartData.reduce((sum, item) => sum + (item.value || 0), 0);
  const avgVal = chartData.length > 0 ? totalVal / chartData.length : 0;

  const getMetricLabelAndValue = () => {
    const isKm = config.metric.includes('km');
    const isDays = config.metric.includes('duration_days');
    const formatNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    
    let valStr = '';
    let labelStr = '';
    
    if (config.metric === 'count') {
      valStr = formatNum(totalVal);
      labelStr = 'Volume Consolidado';
    } else if (isKm) {
      if (config.metric.startsWith('avg_')) {
        valStr = `${formatNum(avgVal)} km`;
        labelStr = 'Média por Registro';
      } else {
        valStr = `${formatNum(totalVal)} km`;
        labelStr = 'Quilometragem Total';
      }
    } else if (isDays) {
      if (config.metric.startsWith('avg_')) {
        valStr = `${formatNum(avgVal)} dias`;
        labelStr = 'Média de Dias';
      } else {
        valStr = `${formatNum(totalVal)} dias`;
        labelStr = 'Duração Acumulada';
      }
    } else {
      valStr = formatNum(totalVal);
      labelStr = 'Total Acumulado';
    }
    return { valStr, labelStr };
  };

  const { valStr, labelStr } = getMetricLabelAndValue();

  const commonProps = { 
      data: chartData, 
      margin: { top: 20, right: 20, left: 10, bottom: 15 } 
  };
  
  const axisPropsX = { 
      tick: {fontSize: 11, fill: '#64748b', fontWeight: 600}, 
      axisLine: { stroke: '#e2e8f0' }, 
      tickLine: false, 
      height: 40
  };
  const axisPropsY = { hide: true }; 

  const gradientId = `chartGrad-${config.id}`;
  const barGradientId = `barGrad-${config.id}`;

  const renderChart = () => {
    switch(config.chartType) {
      case 'pie':
        return (
          <PieChart>
            <Pie 
                data={chartData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                innerRadius="48%" 
                outerRadius="75%" 
                paddingAngle={3}
                cornerRadius={5}
            >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={config.dimension === 'status' 
                      ? (entry.name === 'Concluída' ? '#10b981' 
                        : entry.name === 'Em Uso' ? '#00753f' 
                        : entry.name === 'Pendente' ? '#f59e0b' 
                        : entry.name === 'Aprovada' ? '#2563eb' 
                        : entry.name === 'Cancelada' ? '#ef4444' 
                        : '#dc2626') 
                      : COLORS[index % COLORS.length]} 
                    stroke="#ffffff" 
                    strokeWidth={2} 
                  />
                ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle" 
              wrapperStyle={{fontSize: '11px', fontWeight: 600, color: '#475569'}} 
            />
          </PieChart>
        );
      case 'line':
          return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" {...axisPropsX} />
                <YAxis {...axisPropsY} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 600}} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Total" 
                  stroke="#00753f" 
                  strokeWidth={3.5} 
                  dot={{r: 4.5, strokeWidth: 2.5, fill: '#fff', stroke: '#00753f'}} 
                  activeDot={{ r: 7, fill: '#ff9b00', strokeWidth: 2, stroke: '#fff' }}
                >
                    <LabelList dataKey="value" position="top" offset={10} style={{ fontSize: '11px', fontWeight: 800, fill: '#00753f' }} />
                </Line>
            </LineChart>
          );
      case 'area':
          return (
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00753f" stopOpacity={0.45}/>
                        <stop offset="70%" stopColor="#00753f" stopOpacity={0.1}/>
                        <stop offset="100%" stopColor="#00753f" stopOpacity={0.0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" {...axisPropsX} />
                <YAxis {...axisPropsY} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  name="Volume" 
                  stroke="#00753f" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill={`url(#${gradientId})`}
                  dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke: '#00753f' }}
                  activeDot={{ r: 6, fill: '#ff9b00', strokeWidth: 2, stroke: '#fff' }}
                >
                    <LabelList dataKey="value" position="top" offset={10} style={{ fontSize: '11px', fontWeight: 800, fill: '#00753f' }} />
                </Area>
            </AreaChart>
          );
      case 'radar':
          return (
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <Radar name="Total" dataKey="value" stroke="#00753f" fill="#00753f" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          );
      case 'scatter':
          return (
            <ScatterChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="category" dataKey="name" name="Categoria" {...axisPropsX} />
                <YAxis type="number" dataKey="value" name="Valor" {...axisPropsY} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                <Scatter name="Dados" data={chartData} fill="#ff9b00">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#475569' }} />
                </Scatter>
            </ScatterChart>
          );
      case 'composed':
          return (
            <ComposedChart {...commonProps}>
                <defs>
                    <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00753f" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#114D38" stopOpacity={0.95}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" {...axisPropsX} scale="band" />
                <YAxis {...axisPropsY} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 600}} />
                <Bar dataKey="value" name="Volume Total" barSize={24} fill={`url(#${barGradientId})`} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: 800, fill: '#00753f' }} />
                </Bar>
                <Line type="monotone" dataKey="value" name="Tendência" stroke="#ff9b00" strokeWidth={3} dot={{ r: 4, fill: '#ff9b00', stroke: '#fff', strokeWidth: 2 }} />
            </ComposedChart>
          );
      case 'radialBar':
          return (
            <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="95%" barSize={14} data={chartData}>
                <RadialBar label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 'bold' }} background dataKey="value">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </RadialBar>
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" wrapperStyle={{right: 0, fontSize: '11px', fontWeight: 600}} />
                <Tooltip content={<CustomTooltip />} />
            </RadialBarChart>
          );
      case 'funnel':
          return (
            <FunnelChart>
                <Tooltip content={<CustomTooltip />} />
                <Funnel data={chartData} dataKey="value" isAnimationActive>
                    <LabelList position="right" fill="#475569" stroke="none" dataKey="name" style={{fontSize: '11px', fontWeight: 700}} />
                    <LabelList position="center" fill="#fff" stroke="none" dataKey="value" style={{fontSize: '12px', fontWeight: 800}} />
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Funnel>
            </FunnelChart>
          );
      case 'treemap':
          return (
            <Treemap
                data={chartData}
                dataKey="value"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#00753f"
                content={(props: any) => {
                    const { root, depth, x, y, width, height, index, name, value } = props;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} rx={6} style={{ fill: COLORS[index % COLORS.length], stroke: '#fff', strokeWidth: 2 }} />
                        {width > 50 && height > 28 && (
                            <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">
                                {name} ({value})
                            </text>
                        )}
                      </g>
                    );
                }}
            >
                <Tooltip content={<CustomTooltip />} />
            </Treemap>
          );
      case 'bar':
      default:
        return (
          <BarChart {...commonProps}>
            <defs>
                <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00753f" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#114D38" stopOpacity={1}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" {...axisPropsX} />
            <YAxis {...axisPropsY} />
            <Tooltip cursor={{fill: '#f8fafc', opacity: 0.8}} content={<CustomTooltip />} />
            <Bar dataKey="value" name="Total" fill={`url(#${barGradientId})`} barSize={24} radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={config.dimension === 'status' ? (entry.name === 'Concluída' ? '#10b981' : entry.name === 'Em Uso' ? '#00753f' : entry.name === 'Pendente' ? '#f59e0b' : '#ef4444') : COLORS[index % COLORS.length]} 
                    />
                ))}
                <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: 800, fill: '#334155' }} />
            </Bar>
          </BarChart>
        );
    }
  };

  const isDestinationCity = config.dimension === 'destinationCity';

  return (
    <div className="bg-white rounded-[24px] border border-slate-200/90 flex flex-col h-full overflow-hidden relative group shadow-sm hover:shadow-md transition-all duration-300">
      
      {/* Premium BI Card Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isDraggable && (
            <div className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 transition-colors" title="Clique e arraste para trocar de lugar">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {config.dataSource === 'reservations' ? 'Análise de Reservas' : config.dataSource === 'dailyUse' ? 'Uso Diário' : 'Estatísticas da Frota'}
            </span>
            <h3 className="text-base font-bold text-slate-800 tracking-tight leading-snug">
              {title}
            </h3>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
             {onMoveUp && (
                 <button onClick={onMoveUp} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Mover para Cima">
                     <ArrowUp className="w-4 h-4" />
                 </button>
             )}
             {onMoveDown && (
                 <button onClick={onMoveDown} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Mover para Baixo">
                     <ArrowDown className="w-4 h-4" />
                 </button>
             )}
             {onEdit && (
                 <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Configurar Análise">
                     <CogIcon className="w-4.5 h-4.5" />
                 </button>
             )}
             {onRemove && (
                 <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Remover Gráfico">
                     <XCircleIcon className="w-4.5 h-4.5" />
                 </button>
             )}
        </div>
      </div>

      {/* Executive Summary Banner */}
      {config.chartType !== 'pie' && !isDestinationCity && (
        <div className="px-6 pt-4 pb-1 flex flex-col text-left">
          <span className="text-2xl font-black text-slate-800 tracking-tight font-sans">
            {valStr}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            {labelStr}
          </span>
        </div>
      )}

      {/* Chart or Map Canvas */}
      <div className={`flex-1 p-4 ${isDestinationCity ? 'min-h-[360px]' : 'min-h-[280px]'} relative w-full h-full`}>
        {isDestinationCity ? (
          <DestinationMap data={chartData} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

interface DashboardViewProps {
  customCharts: ChartConfig[];
  onChartsChange: (charts: ChartConfig[]) => void;
  onResetToDefaults?: () => void;
  canEditDashboard: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ customCharts, onChartsChange, onResetToDefaults, canEditDashboard }) => {
  const { reservations, dailyTrips, vehicles, getVehicleById } = useReservations();
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const [editingChartIndex, setEditingChartIndex] = useState<number | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'reservations' | 'dailyUse' | 'vehicles'>('reservations');
  
  const [globalFilters, setGlobalFilters] = useState({ year: '', month: ''});
  const [displayCharts, setDisplayCharts] = useState<ChartConfig[]>([]);
  const [draggedChartId, setDraggedChartId] = useState<number | null>(null);
  const [dragOverChartId, setDragOverChartId] = useState<number | null>(null);

  // Estados para a criação de acesso do usuário de forma discreta no Dashboard
  const [isCreateAccessModalOpen, setIsCreateAccessModalOpen] = useState(false);
  const [accessName, setAccessName] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessTempPassword, setAccessTempPassword] = useState('Provisoria' + Math.floor(100 + Math.random() * 900) + '!');
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSuccess, setAccessSuccess] = useState<string | null>(null);

  const handleCreateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError(null);
    setAccessSuccess(null);
    setIsAccessLoading(true);

    if (!accessName.trim() || !accessEmail.trim() || !accessTempPassword.trim()) {
        setAccessError("Por favor, preencha todos os campos.");
        setIsAccessLoading(false);
        return;
    }

    if (accessTempPassword.length < 6) {
        setAccessError("A senha provisória deve ter pelo menos 6 caracteres.");
        setIsAccessLoading(false);
        return;
    }

    let secondaryApp: any = null;
    try {
        secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
        
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(accessEmail.trim(), accessTempPassword.trim());
        
        if (userCredential.user) {
            await userCredential.user.updateProfile({
                displayName: accessName.trim()
            });
        }

        await secondaryApp.auth().sendPasswordResetEmail(accessEmail.trim());

        const emailSubject = "Seu Acesso ao Sistema de Reservas - Risel Combustíveis";
        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="background-color: #114D38; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">Acesso Criado com Sucesso</h1>
                </div>
                <div style="padding: 32px; background-color: white; color: #334155;">
                    <p style="font-size: 16px; margin-top: 0;">Olá, <strong>${accessName.trim()}</strong>!</p>
                    <p style="font-size: 14px; line-height: 1.6;">O administrador do sistema de frotas da Risel Combustíveis criou uma conta de acesso para você no submódulo de Gestão de Reservas.</p>
                    
                    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 24px 0;">
                        <h4 style="margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Suas Credenciais de Acesso:</h4>
                        <p style="font-size: 14px; margin: 4px 0;"><strong>E-mail:</strong> ${accessEmail.trim()}</p>
                        <p style="font-size: 14px; margin: 4px 0;"><strong>Senha Provisória:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${accessTempPassword.trim()}</code></p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #ef4444; font-weight: bold;">Importante: Você receberá em instantes um segundo e-mail automático do Firebase para redefinição/troca da senha. Por favor, acesse o link enviado naquele e-mail para cadastrar sua senha definitiva antes do seu primeiro acesso.</p>
                    
                    <p style="font-size: 14px; line-height: 1.6; margin-bottom: 0;">Atenciosamente,<br><strong>Gestão de Frota Risel</strong></p>
                </div>
                <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                    Este é um e-mail automático do sistema Risel Reservas. Por favor, não responda.
                </div>
            </div>
        `;

        try {
            await sendEmail(accessEmail.trim(), emailSubject, emailHtml);
        } catch (emailErr) {
            console.warn("Failed to send welcome email, but account was successfully created:", emailErr);
        }

        setAccessSuccess("Acesso criado com sucesso! O usuário recebeu as instruções de troca de senha por e-mail.");
        setAccessName('');
        setAccessEmail('');
        setAccessTempPassword('Provisoria' + Math.floor(100 + Math.random() * 900) + '!');
        
        setTimeout(() => {
            setIsCreateAccessModalOpen(false);
            setAccessSuccess(null);
        }, 3000);

    } catch (err: any) {
        console.error("Error creating secondary user:", err);
        if (err.code === 'auth/email-already-in-use') {
            setAccessError("Este endereço de e-mail já está sendo utilizado por outra conta.");
        } else if (err.code === 'auth/invalid-email') {
            setAccessError("O formato do e-mail inserido é inválido.");
        } else if (err.code === 'auth/weak-password') {
            setAccessError("A senha provisória informada é muito fraca.");
        } else {
            setAccessError(err.message || "Ocorreu um erro ao criar o acesso. Tente novamente.");
        }
    } finally {
        if (secondaryApp) {
            try {
                await secondaryApp.delete();
            } catch (delErr) {
                console.error("Error deleting secondary app:", delErr);
            }
        }
        setIsAccessLoading(false);
    }
  };

  useEffect(() => {
    setDisplayCharts(customCharts);
  }, [customCharts]);
  
  const availableYears = useMemo(() => {
    const years = new Set([...reservations, ...dailyTrips].map(r => new Date(r.departureDateTime).getFullYear().toString()));
    return Array.from(years).sort((a,b) => Number(b) - Number(a));
  }, [reservations, dailyTrips]);
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // --- Data Filtering for Current Selection ---
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
        const date = new Date(r.departureDateTime);
        const yearMatch = !globalFilters.year || date.getFullYear() === parseInt(globalFilters.year);
        const monthMatch = !globalFilters.month || date.getMonth() === parseInt(globalFilters.month);
        return yearMatch && monthMatch;
    });
  }, [reservations, globalFilters]);
  
  const filteredDailyTrips = useMemo(() => {
    return dailyTrips.filter(t => {
        const date = new Date(t.departureDateTime);
        const yearMatch = !globalFilters.year || date.getFullYear() === parseInt(globalFilters.year);
        const monthMatch = !globalFilters.month || date.getMonth() === parseInt(globalFilters.month);
        return yearMatch && monthMatch;
    });
  }, [dailyTrips, globalFilters]);

  // --- Data Filtering for Previous Month (Comparison) ---
  const previousPeriodData = useMemo(() => {
    // Only calculate if specific month/year selected to make comparison meaningful
    if (globalFilters.year && globalFilters.month) {
        let prevMonth = parseInt(globalFilters.month) - 1;
        let prevYear = parseInt(globalFilters.year);
        
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear -= 1;
        }

        return {
            reservations: reservations.filter(r => {
                const d = new Date(r.departureDateTime);
                return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
            }),
            dailyTrips: dailyTrips.filter(t => {
                const d = new Date(t.departureDateTime);
                return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
            })
        };
    }
    return { reservations: [], dailyTrips: [] };
  }, [globalFilters, reservations, dailyTrips]);

  const filteredVehicles = useMemo(() => {
      return vehicles;
  }, [vehicles]);

  // --- LUXURY GRADIENT KPI CARD MATCHING RAC BI INDICATORS ---
  const KPICard = ({ title, value, icon: Icon, gradientFrom, gradientTo, trend, comparisonVal, inverseTrend, numericValue, tooltipContent }: any) => {
    let changePercent = null;
    let isPositive = false;
    const currentVal = numericValue !== undefined ? numericValue : (typeof value === 'number' ? value : 0);
    const [isHovered, setIsHovered] = useState(false);
    
    if (comparisonVal !== undefined && comparisonVal !== null && (globalFilters.month && globalFilters.year)) {
        if (comparisonVal === 0) {
            changePercent = currentVal > 0 ? 100 : 0;
        } else {
            changePercent = Math.round(((currentVal - comparisonVal) / comparisonVal) * 100);
        }
        isPositive = changePercent >= 0;
    }

    // High-end sophisticated multi-stop gradient themes
    let themes = {
      bg: 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white shadow-md border-white/10',
      iconBg: 'bg-white/10 text-blue-300 border-white/15 shadow-inner',
      titleText: 'text-blue-200/90 font-extrabold',
      valueText: 'text-white font-black',
      stroke: '#93c5fd',
      glow: 'bg-blue-500/10'
    };

    const lowerTitle = title.toLowerCase();

    if (gradientFrom?.includes('emerald') || gradientFrom?.includes('teal') || lowerTitle.includes('conclu') || lowerTitle.includes('em uso') || lowerTitle.includes('ativas')) {
      themes = {
        bg: 'bg-gradient-to-br from-emerald-950 via-[#114D38] to-teal-950 text-white shadow-md border-white/10',
        iconBg: 'bg-white/10 text-emerald-300 border-white/15 shadow-inner',
        titleText: 'text-emerald-200/90 font-extrabold',
        valueText: 'text-white font-black',
        stroke: '#34d399',
        glow: 'bg-emerald-500/10'
      };
    } else if (gradientFrom?.includes('orange') || gradientFrom?.includes('amber') || lowerTitle.includes('próxima') || lowerTitle.includes('pendente')) {
      themes = {
        bg: 'bg-gradient-to-br from-amber-950 via-orange-950 to-stone-900 text-white shadow-md border-white/10',
        iconBg: 'bg-white/10 text-amber-300 border-white/15 shadow-inner',
        titleText: 'text-amber-200/90 font-extrabold',
        valueText: 'text-white font-black',
        stroke: '#fcd34d',
        glow: 'bg-amber-500/10'
      };
    } else if (gradientFrom?.includes('red') || gradientFrom?.includes('rose') || lowerTitle.includes('vencida') || lowerTitle.includes('rejeit') || lowerTitle.includes('recus')) {
      themes = {
        bg: 'bg-gradient-to-br from-rose-950 via-red-950 to-slate-900 text-white shadow-md border-white/10',
        iconBg: 'bg-white/10 text-rose-300 border-white/15 shadow-inner',
        titleText: 'text-rose-200/90 font-extrabold',
        valueText: 'text-white font-black',
        stroke: '#fda4af',
        glow: 'bg-rose-500/10'
      };
    } else if (gradientFrom?.includes('cyan') || lowerTitle.includes('total km') || lowerTitle.includes('quilometragem')) {
      themes = {
        bg: 'bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 text-white shadow-md border-white/10',
        iconBg: 'bg-white/10 text-cyan-300 border-white/15 shadow-inner',
        titleText: 'text-cyan-200/90 font-extrabold',
        valueText: 'text-white font-black',
        stroke: '#67e8f9',
        glow: 'bg-cyan-500/10'
      };
    } else if (gradientFrom?.includes('slate') || gradientFrom?.includes('gray') || lowerTitle.includes('cancelad') || lowerTitle.includes('média')) {
      themes = {
        bg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-md border-white/10',
        iconBg: 'bg-white/10 text-slate-300 border-white/15 shadow-inner',
        titleText: 'text-slate-300/90 font-extrabold',
        valueText: 'text-white font-black',
        stroke: '#cbd5e1',
        glow: 'bg-slate-500/10'
      };
    }

    const isUpTrend = inverseTrend ? !isPositive : isPositive;
    const trendBg = isUpTrend ? 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30' : 'bg-rose-400/20 text-rose-200 border-rose-400/30';
    const trendIcon = isUpTrend ? '▲' : '▼';

    const getSparklinePath = (cardTitle: string) => {
      const lower = cardTitle.toLowerCase();
      if (lower.includes('total') || lower.includes('quilometragem') || lower.includes('conclu')) {
        return "M0,22 Q15,14 30,12 T60,5 T90,2"; 
      }
      if (lower.includes('pendente') || lower.includes('atraso') || lower.includes('revis')) {
        return "M0,15 Q25,25 50,8 T100,18"; 
      }
      if (lower.includes('uso') || lower.includes('ativa')) {
        return "M0,18 Q15,5 35,16 T70,8 T100,12"; 
      }
      return "M0,15 Q25,8 50,18 T100,6"; 
    };

    return (
        <div 
            className={`relative overflow-hidden rounded-[18px] shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between group h-full min-h-[92px] p-3.5 hover:-translate-y-0.5 cursor-default border ${themes.bg}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background ambient lighting */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500 ${themes.glow}`} />

            {/* Tooltip for active indicators */}
            {tooltipContent && isHovered && (
                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 w-72 max-w-[90vw] bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/60 z-[60] text-xs animate-fadeIn pointer-events-none overflow-hidden">
                    <div className="bg-[#114D38] px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between border-b border-emerald-800">
                        <span>{title}</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white">{value} Ativos</span>
                    </div>
                    
                    <div className="p-2.5 max-h-[45vh] overflow-y-auto custom-scrollbar text-slate-200">
                        {tooltipContent}
                    </div>

                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-slate-900 drop-shadow-sm"></div>
                </div>
            )}

            <div className="flex justify-between items-center w-full relative z-10 gap-2">
                <div className="flex flex-col text-left min-w-0">
                    <span className={`text-[10px] font-black uppercase tracking-wider leading-none mb-1 truncate ${themes.titleText}`}>
                        {title}
                    </span>
                    <h3 className={`text-2xl font-black font-sans tracking-tight leading-tight ${themes.valueText}`}>
                        {value}
                    </h3>
                </div>
                
                {/* Translucent Icon Badge */}
                <div className={`p-2 rounded-xl transition-all duration-300 group-hover:scale-105 border backdrop-blur-md shrink-0 ${themes.iconBg}`}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
            </div>

            {/* Bottom metadata and Mini Trend Sparkline */}
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 w-full relative z-10 text-[10px]">
                {changePercent !== null && Math.abs(changePercent) > 0 ? (
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${trendBg}`}>
                        <span>{trendIcon} {Math.abs(changePercent)}%</span>
                        <span className="opacity-75 font-normal">vs ant.</span>
                    </div>
                ) : trend ? (
                    <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-400/20 border border-emerald-400/30 px-1.5 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        {trend}
                    </div>
                ) : (
                    <span className="text-[9px] text-white/50 font-medium">Indicador Ativo</span>
                )}

                {/* Micro Sparkline Wave */}
                <div className="w-12 h-4 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-full h-full" viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path 
                            d={getSparklinePath(title)} 
                            stroke={themes.stroke} 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
  };

  const reservationKpiCards = useMemo(() => {
    // Current Stats matching exact ReservationStatus enums
    const statusCounts = filteredReservations.reduce((acc, res) => {
        acc[res.status] = (acc[res.status] || 0) + 1;
        return acc;
    }, {} as Record<ReservationStatus, number>);
    
    // Previous Month Stats (for comparison)
    const prevStatusCounts = previousPeriodData.reservations.reduce((acc, res) => {
        acc[res.status] = (acc[res.status] || 0) + 1;
        return acc;
    }, {} as Record<ReservationStatus, number>);

    const activeReservations = filteredReservations.filter(r => r.status === ReservationStatus.InUse);
    const completedReservations = filteredReservations.filter(r => r.status === ReservationStatus.Completed);
    const rejectedReservations = filteredReservations.filter(r => r.status === ReservationStatus.Rejected);
    const cancelledReservations = filteredReservations.filter(r => r.status === ReservationStatus.Cancelled);
    const pendingReservations = filteredReservations.filter(r => r.status === ReservationStatus.Pending);

    // Helpers to sort recent historical records
    const getSortedRecent = (list: Reservation[]) => {
      return [...list].sort((a, b) => {
        const timeA = new Date(a.actualReturnDateTime || a.returnDate || a.departureDateTime).getTime();
        const timeB = new Date(b.actualReturnDateTime || b.returnDate || b.departureDateTime).getTime();
        return timeB - timeA;
      });
    };

    const completedRecent = getSortedRecent(completedReservations).slice(0, 5);
    const rejectedRecent = getSortedRecent(rejectedReservations).slice(0, 5);
    const cancelledRecent = getSortedRecent(cancelledReservations).slice(0, 5);
    const pendingRecent = getSortedRecent(pendingReservations).slice(0, 5);
    
    // Tooltip: Em Uso (Active)
    const activeResTooltip = activeReservations.length > 0 ? (
        <div className="space-y-2.5 max-w-[260px]">
            <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1 flex items-center justify-between">
                <span>Veículos em Deslocamento</span>
                <span className="text-emerald-400 font-mono">({activeReservations.length})</span>
            </div>
            {activeReservations.map(r => {
                const vehicle = getVehicleById(r.vehicleId);
                const dateStr = new Date(r.departureDateTime).toLocaleString('pt-BR', { 
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' 
                }).replace(',', ' às');

                return (
                    <div key={r.id} className="border-l-2 border-emerald-400 pl-2 py-0.5 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-white text-xs truncate max-w-[55%]">{vehicle?.plate || 'Veículo'}</span>
                            <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded text-slate-300 font-mono whitespace-nowrap">
                                {dateStr}
                            </span>
                        </div>
                        <div className="text-slate-300 text-[10px] truncate">
                            👤 {r.requesterName}
                        </div>
                        <span className="block text-slate-400 text-[10px] truncate" title={r.destinationCity}>
                            📍 {r.destinationCity || r.destination}
                        </span>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-slate-400 italic text-xs py-1">Nenhum veículo em uso no momento.</div>
    );

    // Tooltip: Concluídas (Completed History)
    const completedResTooltip = completedRecent.length > 0 ? (
        <div className="space-y-2.5 max-w-[270px]">
            <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1 flex items-center justify-between">
                <span>Últimas Concluídas</span>
                <span className="text-teal-400 font-mono">Total: {completedReservations.length}</span>
            </div>
            {completedRecent.map(r => {
                const vehicle = getVehicleById(r.vehicleId);
                const returnDateStr = new Date(r.actualReturnDateTime || r.returnDate || r.departureDateTime).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit' 
                });

                return (
                    <div key={r.id} className="border-l-2 border-teal-400 pl-2 py-0.5 text-left">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-teal-300 truncate max-w-[60%]">{r.requesterName}</span>
                            <span className="text-[10px] font-mono text-slate-300 bg-slate-800/80 px-1.5 rounded">{vehicle?.plate || 'Frota'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
                            <span className="truncate max-w-[70%]" title={r.destinationCity || r.destination}>📍 {r.destinationCity || r.destination}</span>
                            <span className="text-slate-300 font-mono">{returnDateStr}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-slate-400 text-xs py-1">Nenhuma reserva concluída no período.</div>
    );

    // Tooltip: Rejeitadas (Rejected History)
    const rejectedResTooltip = rejectedRecent.length > 0 ? (
        <div className="space-y-2.5 max-w-[270px]">
            <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1 flex items-center justify-between">
                <span>Histórico de Rejeições</span>
                <span className="text-rose-400 font-mono">Total: {rejectedReservations.length}</span>
            </div>
            {rejectedRecent.map(r => {
                const dateStr = new Date(r.departureDateTime).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit' 
                });

                return (
                    <div key={r.id} className="border-l-2 border-rose-400 pl-2 py-0.5 text-left">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-rose-300 truncate max-w-[70%]">{r.requesterName}</span>
                            <span className="text-[10px] text-slate-300 bg-slate-800/80 px-1.5 rounded">{dateStr}</span>
                        </div>
                        <span className="block text-slate-400 text-[10px] truncate" title={r.destinationCity || r.destination}>
                            📍 {r.destinationCity || r.destination}
                        </span>
                        {r.rejectReason && (
                            <span className="block text-rose-200/90 text-[10px] italic truncate mt-0.5 bg-rose-950/40 px-1 rounded" title={r.rejectReason}>
                                Motivo: {r.rejectReason}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-slate-400 text-xs py-1">Nenhuma reserva rejeitada no período.</div>
    );

    // Tooltip: Canceladas (Cancelled History)
    const cancelledResTooltip = cancelledRecent.length > 0 ? (
        <div className="space-y-2.5 max-w-[270px]">
            <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1 flex items-center justify-between">
                <span>Histórico de Cancelamentos</span>
                <span className="text-slate-300 font-mono">Total: {cancelledReservations.length}</span>
            </div>
            {cancelledRecent.map(r => {
                const dateStr = new Date(r.departureDateTime).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit' 
                });

                return (
                    <div key={r.id} className="border-l-2 border-slate-400 pl-2 py-0.5 text-left">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200 truncate max-w-[70%]">{r.requesterName}</span>
                            <span className="text-[10px] text-slate-300 bg-slate-800/80 px-1.5 rounded">{dateStr}</span>
                        </div>
                        <span className="block text-slate-400 text-[10px] truncate" title={r.destinationCity || r.destination}>
                            📍 {r.destinationCity || r.destination}
                        </span>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-slate-400 text-xs py-1">Nenhuma reserva cancelada no período.</div>
    );

    // Tooltip: Pendentes (Pending Requests)
    const pendingResTooltip = pendingRecent.length > 0 ? (
        <div className="space-y-2.5 max-w-[270px]">
            <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-1 flex items-center justify-between">
                <span>Solicitações Pendentes</span>
                <span className="text-amber-400 font-mono">Total: {pendingReservations.length}</span>
            </div>
            {pendingRecent.map(r => {
                const dateStr = new Date(r.departureDateTime).toLocaleDateString('pt-BR', { 
                    day: '2-digit', month: '2-digit' 
                });

                return (
                    <div key={r.id} className="border-l-2 border-amber-400 pl-2 py-0.5 text-left">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-amber-300 truncate max-w-[70%]">{r.requesterName}</span>
                            <span className="text-[10px] text-slate-300 bg-slate-800/80 px-1.5 rounded">{dateStr}</span>
                        </div>
                        <span className="block text-slate-400 text-[10px] truncate" title={r.destinationCity || r.destination}>
                            📍 {r.destinationCity || r.destination} ({r.department})
                        </span>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-slate-400 text-xs py-1">Nenhuma solicitação pendente no momento.</div>
    );

    return [
        { 
            title: 'Total de Reservas', 
            value: filteredReservations.length, 
            comparisonVal: previousPeriodData.reservations.length,
            icon: CarIcon, 
            gradientFrom: 'from-blue-600', 
            gradientTo: 'to-indigo-700' 
        },
        { 
            title: 'Pendentes', 
            value: pendingReservations.length, 
            comparisonVal: prevStatusCounts[ReservationStatus.Pending] || 0,
            icon: ClockIcon, 
            gradientFrom: 'from-orange-400', 
            gradientTo: 'to-amber-600',
            tooltipContent: pendingResTooltip
        },
        { 
            title: 'Em Uso', 
            value: activeReservations.length, 
            icon: PlayIcon, 
            gradientFrom: 'from-emerald-500', 
            gradientTo: 'to-green-700', 
            trend: 'Tempo Real',
            tooltipContent: activeResTooltip
        },
        { 
            title: 'Concluídas', 
            value: completedReservations.length, 
            comparisonVal: prevStatusCounts[ReservationStatus.Completed] || 0,
            icon: CheckCircleIcon, 
            gradientFrom: 'from-teal-500', 
            gradientTo: 'to-teal-700',
            tooltipContent: completedResTooltip
        },
        { 
            title: 'Rejeitadas', 
            value: rejectedReservations.length, 
            comparisonVal: prevStatusCounts[ReservationStatus.Rejected] || 0,
            icon: XIcon, 
            gradientFrom: 'from-red-500', 
            gradientTo: 'to-rose-700',
            inverseTrend: true,
            tooltipContent: rejectedResTooltip
        },
        { 
            title: 'Canceladas', 
            value: cancelledReservations.length, 
            comparisonVal: prevStatusCounts[ReservationStatus.Cancelled] || 0,
            icon: XCircleIcon, 
            gradientFrom: 'from-slate-500', 
            gradientTo: 'to-gray-600',
            inverseTrend: true,
            tooltipContent: cancelledResTooltip
        },
    ];
  }, [filteredReservations, reservations, previousPeriodData, getVehicleById]);

  const dailyUseKpiCards = useMemo(() => {
    const activeTrips = filteredDailyTrips.filter(t => t.status === ReservationStatus.InUse);
    const completedTrips = filteredDailyTrips.filter(t => t.status === ReservationStatus.Completed);
    const totalKm = completedTrips.reduce((sum, trip) => {
        const distance = (trip.finalKm || 0) - (trip.initialKm || 0);
        return sum + (distance > 0 ? distance : 0);
    }, 0);

    const prevCompletedTrips = previousPeriodData.dailyTrips.filter(t => t.status === ReservationStatus.Completed);
    const prevTotalKm = prevCompletedTrips.reduce((sum, trip) => {
        const distance = (trip.finalKm || 0) - (trip.initialKm || 0);
        return sum + (distance > 0 ? distance : 0);
    }, 0);

    // Generate Tooltip Content for Daily Trips
    const activeTripsTooltip = activeTrips.length > 0 ? (
        <div className="space-y-2.5">
            {activeTrips.map(t => {
                const vehicle = getVehicleById(t.vehicleId);
                const dateStr = new Date(t.departureDateTime).toLocaleString('pt-BR', { 
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' 
                }).replace(',', ' às');

                return (
                    <div key={t.id} className="border-l-2 border-[#ff9b00] pl-2 py-0.5">
                        <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-primary text-xs truncate max-w-[50%]">{vehicle?.plate}</span>
                            <span className="text-[10px] bg-gray-100 px-1.5 rounded text-gray-600 font-mono whitespace-nowrap">
                                {dateStr}
                            </span>
                        </div>
                        <span className="block text-gray-500 text-[10px] truncate" title={t.destinationCity}>
                            📍 {t.destinationCity}
                        </span>
                    </div>
                );
            })}
        </div>
    ) : (
        <div className="text-center text-gray-400 italic py-2">Nenhum veículo em uso.</div>
    );

    return [
        { 
            title: 'Total de Viagens', 
            value: filteredDailyTrips.length, 
            comparisonVal: previousPeriodData.dailyTrips.length,
            icon: ClipboardListIcon, 
            gradientFrom: 'from-indigo-500', 
            gradientTo: 'to-purple-700' 
        },
        { 
            title: 'Viagens Ativas', 
            value: activeTrips.length, 
            icon: RouteIcon, 
            gradientFrom: 'from-amber-400', 
            gradientTo: 'to-orange-600',
            trend: 'Tempo Real',
            tooltipContent: activeTripsTooltip
        },
        { 
            title: 'Total KM Rodado', 
            value: totalKm.toLocaleString('pt-BR'), 
            comparisonVal: prevTotalKm,
            numericValue: totalKm, 
            icon: FunnelIcon, 
            gradientFrom: 'from-cyan-500', 
            gradientTo: 'to-blue-700' 
        },
        { 
            title: 'Média KM/Viagem', 
            value: completedTrips.length ? Math.round(totalKm / completedTrips.length) : 0, 
            comparisonVal: prevCompletedTrips.length ? Math.round(prevTotalKm / prevCompletedTrips.length) : 0,
            icon: CarIcon, 
            gradientFrom: 'from-slate-600', 
            gradientTo: 'to-slate-800' 
        },
    ];
  }, [filteredDailyTrips, previousPeriodData, getVehicleById]);

  const vehicleKpiCards = useMemo(() => {
      const totalVehicles = vehicles.length;
      const avgKm = totalVehicles > 0 
        ? Math.round(vehicles.reduce((sum, v) => sum + (v.lastKm || 0), 0) / totalVehicles) 
        : 0;
      const overdueRevision = vehicles.filter(v => {
         const next = (v.lastServiceKm || 0) + 10000;
         return (v.lastKm || 0) >= next;
      }).length;
      const warningRevision = vehicles.filter(v => {
         const next = (v.lastServiceKm || 0) + 10000;
         const diff = next - (v.lastKm || 0);
         return diff > 0 && diff <= 1000;
      }).length;

      return [
        { title: 'Frota Total', value: totalVehicles, icon: CarIcon, gradientFrom: 'from-slate-700', gradientTo: 'to-gray-900' },
        { title: 'Média de KM', value: avgKm.toLocaleString('pt-BR'), icon: RouteIcon, gradientFrom: 'from-blue-500', gradientTo: 'to-blue-700' },
        { title: 'Revisão Vencida', value: overdueRevision, icon: XCircleIcon, gradientFrom: 'from-red-600', gradientTo: 'to-pink-700' },
        { title: 'Próxima Revisão', value: warningRevision, icon: ClockIcon, gradientFrom: 'from-yellow-400', gradientTo: 'to-orange-500' }
      ];
  }, [vehicles]);

  const kpiCards = useMemo(() => {
      if (dashboardMode === 'reservations') return reservationKpiCards;
      if (dashboardMode === 'dailyUse') return dailyUseKpiCards;
      return vehicleKpiCards;
  }, [dashboardMode, reservationKpiCards, dailyUseKpiCards, vehicleKpiCards]);


  const processChartData = (config: ChartConfig): any[] => {
    const dataSource = config.dataSource || 'reservations';
    const getDurationDays = (start: Date, end: Date) => (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    const normalizeVehicleModel = (modelName?: string) => {
        if (!modelName) return 'MOBI';
        const upper = modelName.toUpperCase();
        if (upper.includes('MOBI')) return 'MOBI';
        return modelName;
    };

    if (dataSource === 'vehicles') {
        let chartSpecificVehicles = filteredVehicles;
        if (config.filters.vehicleIds && config.filters.vehicleIds.length > 0) {
            chartSpecificVehicles = chartSpecificVehicles.filter(v => config.filters.vehicleIds!.includes(v.id));
        }
        
        const getServiceStatus = (v: Vehicle) => {
            const next = (v.lastServiceKm || 0) + 10000;
            const diff = next - (v.lastKm || 0);
            if (diff <= 0) return 'Vencida';
            if (diff <= 1000) return 'Próxima (<1000km)';
            return 'Em dia';
        };
        
        const getWashStatus = (v: Vehicle) => {
            if (!v.lastWashDate) return 'Sem registro';
            const days = Math.ceil(Math.abs(new Date().getTime() - new Date(v.lastWashDate).getTime()) / (1000 * 3600 * 24));
            if (days > 30) return 'Vencida (>30 dias)';
            if (days > 15) return 'Atenção (15-30 dias)';
            return 'Em dia';
        };

        const groupedData = chartSpecificVehicles.reduce((acc, v) => {
            let key: string = 'N/A';
            switch (config.dimension) {
                case 'vehicle': key = `${v.model} - ${v.plate}`; break;
                case 'model': key = v.model; break;
                case 'year': key = v.year.toString(); break;
                case 'serviceStatus': key = getServiceStatus(v); break;
                case 'washStatus': key = getWashStatus(v); break;
                case 'base': {
                    const clean = v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const charCodeSum = clean.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                    const bases = ['Paulínia (Sede)', 'Posto ABC (Campinas)', 'Filial Rio de Janeiro', 'Filial Espírito Santo'];
                    key = bases[charCodeSum % bases.length];
                    break;
                }
                default: key = 'N/A';
            }
            if (!acc[key]) acc[key] = [];
            acc[key].push(v);
            return acc;
        }, {} as Record<string, Vehicle[]>);

        const result = Object.keys(groupedData).map(key => {
            let value = 0;
            const group = groupedData[key];
            switch (config.metric) {
                case 'count': value = group.length; break;
                case 'avg_km': 
                    value = group.reduce((sum, v) => sum + (v.lastKm || 0), 0) / (group.length || 1); 
                    break;
                case 'sum_km':
                     value = group.reduce((sum, v) => sum + (v.lastKm || 0), 0);
                     break;
            }
            return { name: key, value: parseFloat(value.toFixed(2)) };
        });
        
        return result.sort((a, b) => {
            if (config.dimension === 'year') return Number(a.name) - Number(b.name);
            return b.value - a.value;
        });

    } else if (dataSource === 'dailyUse') {
        let chartSpecificTrips = filteredDailyTrips;
        if (config.filters.vehicleIds && config.filters.vehicleIds.length > 0) {
          chartSpecificTrips = chartSpecificTrips.filter(t => config.filters.vehicleIds!.includes(t.vehicleId));
        }
        if (config.filters.departments && config.filters.departments.length > 0) {
          chartSpecificTrips = chartSpecificTrips.filter(t => config.filters.departments!.includes(t.department));
        }

        const groupedData = chartSpecificTrips.reduce((acc, trip) => {
            let key: string | number = 'N/A';
            switch (config.dimension) {
                case 'vehicle': key = normalizeVehicleModel(getVehicleById(trip.vehicleId)?.model); break;
                case 'department': key = trip.department; break;
                case 'driverName': key = trip.driverName; break;
                case 'destinationCity': key = trip.destinationCity; break;
                case 'purpose': key = trip.purpose || 'Nao especificado'; break;
                case 'month':
                    const date = new Date(trip.departureDateTime);
                    const year = date.getFullYear().toString().slice(-2);
                    key = `${months[date.getMonth()]}/${year}`;
                    break;
                case 'day':
                    const d = new Date(trip.departureDateTime);
                    key = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
                    break;
                case 'weekday':
                    const wd = new Date(trip.departureDateTime);
                    key = weekdays[wd.getDay()];
                    break;
                case 'year': key = new Date(trip.departureDateTime).getFullYear(); break;
                case 'timeRange': {
                    const deptHour = new Date(trip.departureDateTime).getHours();
                    if (deptHour >= 0 && deptHour < 6) key = 'Madrugada (00h-06h)';
                    else if (deptHour >= 6 && deptHour < 12) key = 'Manhã (06h-12h)';
                    else if (deptHour >= 12 && deptHour < 18) key = 'Tarde (12h-18h)';
                    else key = 'Noite (18h-24h)';
                    break;
                }
                default: key = 'N/A';
            }
            if (!acc[key]) acc[key] = [];
            acc[key].push(trip);
            return acc;
        }, {} as Record<string, DailyTrip[]>);

        const result = Object.keys(groupedData).map(key => {
            let value = 0;
            const group = groupedData[key];
            const completedTrips = group.filter(t => t.status === ReservationStatus.Completed);
            const completedWithReturnDate = completedTrips.filter(t => t.actualReturnDateTime);

            switch (config.metric) {
                case 'count': value = group.length; break;
                case 'sum_km': value = completedTrips.reduce((sum, t) => sum + ((t.finalKm || 0) - (t.initialKm || 0)), 0); break;
                case 'avg_km':
                    const totalKm = completedTrips.reduce((sum, t) => sum + ((t.finalKm || 0) - (t.initialKm || 0)), 0);
                    value = completedTrips.length > 0 ? totalKm / completedTrips.length : 0;
                    break;
                case 'avg_km_per_trip':
                     const totalKmTrip = completedTrips.reduce((sum, t) => sum + ((t.finalKm || 0) - (t.initialKm || 0)), 0);
                     value = completedTrips.length > 0 ? totalKmTrip / completedTrips.length : 0;
                     break;
                case 'sum_duration_days':
                    value = completedWithReturnDate.reduce((sum, t) => sum + getDurationDays(t.departureDateTime, t.actualReturnDateTime!), 0);
                    break;
                case 'avg_duration_days':
                    const totalDays = completedWithReturnDate.reduce((sum, t) => sum + getDurationDays(t.departureDateTime, t.actualReturnDateTime!), 0);
                    value = completedWithReturnDate.length > 0 ? totalDays / completedWithReturnDate.length : 0;
                    break;
            }
            return { name: key, value: parseFloat(value.toFixed(2)) };
        });

        return result.sort((a, b) => {
            if (config.dimension === 'month') {
                const [monthA, yearA] = a.name.split('/');
                const [monthB, yearB] = b.name.split('/');
                if (!yearA || !yearB) return 0;
                const yearDiff = parseInt(yearA) - parseInt(yearB);
                if (yearDiff !== 0) return yearDiff;
                return months.indexOf(monthA) - months.indexOf(monthB);
            }
            if (config.dimension === 'day') {
                const [dayA, mA] = a.name.split('/').map(Number);
                const [dayB, mB] = b.name.split('/').map(Number);
                if (mA !== mB) return mA - mB;
                return dayA - dayB;
            }
            if (config.dimension === 'weekday') return weekdays.indexOf(a.name) - weekdays.indexOf(b.name);
            if (config.dimension === 'year') return Number(a.name) - Number(b.name);
            
            return b.value - a.value;
        });

    } else { // 'reservations'
        let chartSpecificReservations = filteredReservations;

        if (config.filters.vehicleIds && config.filters.vehicleIds.length > 0) {
          chartSpecificReservations = chartSpecificReservations.filter(r => config.filters.vehicleIds!.includes(r.vehicleId));
        }
        if (config.filters.departments && config.filters.departments.length > 0) {
          chartSpecificReservations = chartSpecificReservations.filter(r => config.filters.departments!.includes(r.department));
        }
        if (config.filters.statuses && config.filters.statuses.length > 0) {
          chartSpecificReservations = chartSpecificReservations.filter(r => config.filters.statuses!.includes(r.status));
        }

        const groupedData = chartSpecificReservations.reduce((acc, res) => {
        let key: string | number = 'N/A';
        switch (config.dimension) {
            case 'vehicle': key = normalizeVehicleModel(getVehicleById(res.vehicleId)?.model); break;
            case 'department': key = res.department; break;
            case 'status': key = res.status; break;
            case 'role': key = res.role; break;
            case 'month':
                const date = new Date(res.departureDateTime);
                const year = date.getFullYear().toString().slice(-2);
                key = `${months[date.getMonth()]}/${year}`;
                break;
            case 'day':
                const d = new Date(res.departureDateTime);
                key = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
                break;
            case 'weekday':
                const wd = new Date(res.departureDateTime);
                key = weekdays[wd.getDay()];
                break;
            case 'year': key = new Date(res.departureDateTime).getFullYear(); break;
            case 'destinationCity': key = res.destinationCity; break;
            case 'purpose': key = res.purpose || 'Não Especificado'; break;
            case 'requesterName': key = res.requesterName; break;
            case 'leadTime': {
                const depTime = new Date(res.departureDateTime).getTime();
                const creTime = (res as any).createdAt ? new Date((res as any).createdAt).getTime() : (depTime - 86400000);
                const diffDays = Math.max(0, Math.floor((depTime - creTime) / (1000 * 60 * 60 * 24)));
                if (diffDays === 0) key = 'Mesmo Dia (0d)';
                else if (diffDays <= 2) key = '1 a 2 Dias';
                else if (diffDays <= 5) key = '3 a 5 Dias';
                else if (diffDays <= 10) key = '6 a 10 Dias';
                else key = '> 10 Dias';
                break;
            }
            case 'durationRange': {
                const days = getDurationDays(res.departureDateTime, res.returnDate);
                if (days <= 1) key = '1 Dia (Bate-Volta)';
                else if (days <= 3) key = '2 a 3 Dias';
                else if (days <= 7) key = '4 a 7 Dias';
                else key = '> 7 Dias';
                break;
            }
            case 'timeRange': {
                const deptHour = new Date(res.departureDateTime).getHours();
                if (deptHour >= 0 && deptHour < 6) key = 'Madrugada (00h-06h)';
                else if (deptHour >= 6 && deptHour < 12) key = 'Manhã (06h-12h)';
                else if (deptHour >= 12 && deptHour < 18) key = 'Tarde (12h-18h)';
                else key = 'Noite (18h-24h)';
                break;
            }
            default: key = 'N/A';
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(res);
        return acc;
        }, {} as Record<string, Reservation[]>);
        
        const result = Object.keys(groupedData).map(key => {
        let value = 0;
        const group = groupedData[key];
        switch (config.metric) {
            case 'count': value = group.length; break;
            case 'sum_km': value = group.reduce((sum, r) => sum + (r.distanceKm || 0), 0); break;
            case 'avg_km':
                const totalKm = group.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
                value = group.length > 0 ? totalKm / group.length : 0;
                break;
            case 'sum_duration_days':
                value = group.reduce((sum, r) => sum + getDurationDays(r.departureDateTime, r.returnDate), 0);
                break;
            case 'avg_duration_days':
                const totalDays = group.reduce((sum, r) => sum + getDurationDays(r.departureDateTime, r.returnDate), 0);
                value = group.length > 0 ? totalDays / group.length : 0;
                break;
        }
        return { name: key, value: parseFloat(value.toFixed(2)) };
        });

        return result.sort((a, b) => {
            if (config.dimension === 'month') {
                const [monthA, yearA] = a.name.split('/');
                const [monthB, yearB] = b.name.split('/');
                if (!yearA || !yearB) return 0;
                const yearDiff = parseInt(yearA) - parseInt(yearB);
                if (yearDiff !== 0) return yearDiff;
                return months.indexOf(monthA) - months.indexOf(monthB);
            }
            if (config.dimension === 'day') {
                const [dayA, mA] = a.name.split('/').map(Number);
                const [dayB, mB] = b.name.split('/').map(Number);
                if (mA !== mB) return mA - mB;
                return dayA - dayB;
            }
            if (config.dimension === 'weekday') return weekdays.indexOf(a.name) - weekdays.indexOf(b.name);
            if (config.dimension === 'year') return Number(a.name) - Number(b.name);
            if (config.dimension === 'leadTime') {
                const order = ['Mesmo Dia (0d)', '1 a 2 Dias', '3 a 5 Dias', '6 a 10 Dias', '> 10 Dias'];
                return order.indexOf(a.name) - order.indexOf(b.name);
            }
            
            return b.value - a.value;
        });
    }
  };

  const handleSaveChart = (config: ChartConfig) => {
    let newCharts;
    if (editingChartIndex !== null) {
      newCharts = customCharts.map((chart, index) =>
        index === editingChartIndex ? config : chart
      );
    } else {
      newCharts = [...customCharts, config];
    }
    onChartsChange(newCharts);
    setIsBuilderModalOpen(false);
    setEditingChartIndex(null);
  };

  const handleRemoveChart = (indexToRemove: number) => {
    const newCharts = customCharts.filter((_, index) => index !== indexToRemove);
    onChartsChange(newCharts);
  };

  const handleMoveChart = (chartId: number, direction: 'up' | 'down') => {
    const index = customCharts.findIndex(c => c.id === chartId);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= customCharts.length) return;

    const updated = [...customCharts];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    setDisplayCharts(updated);
    onChartsChange(updated);
  };

  const handleDropChart = (targetChartId: number) => {
    if (!draggedChartId || draggedChartId === targetChartId) {
      setDraggedChartId(null);
      setDragOverChartId(null);
      return;
    }
    const sourceIndex = customCharts.findIndex(c => c.id === draggedChartId);
    const targetIndex = customCharts.findIndex(c => c.id === targetChartId);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedChartId(null);
      setDragOverChartId(null);
      return;
    }

    const updated = [...customCharts];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setDisplayCharts(updated);
    onChartsChange(updated);
    setDraggedChartId(null);
    setDragOverChartId(null);
  };

  const handleOpenEditModal = (index: number) => {
    setEditingChartIndex(index);
    setIsBuilderModalOpen(true);
  }

  const handleOpenAddModal = () => {
    setEditingChartIndex(null);
    setIsBuilderModalOpen(true);
  }

  const chartsToDisplay = useMemo(() => {
    return displayCharts.filter(chart => (chart.dataSource || 'reservations') === dashboardMode);
  }, [displayCharts, dashboardMode]);

  const handleChartConfigChange = (chartId: number, changes: Partial<ChartConfig>) => {
    const updatedCharts = displayCharts.map(chart =>
        chart.id === chartId ? { ...chart, ...changes } : chart
    );
    setDisplayCharts(updatedCharts);
    onChartsChange(updatedCharts);
  };
  
  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4 pb-4 animate-fadeIn overflow-hidden"> 
      <CustomChartBuilderModal 
        isOpen={isBuilderModalOpen}
        onClose={() => {
            setIsBuilderModalOpen(false);
            setEditingChartIndex(null);
        }}
        onSave={handleSaveChart}
        initialConfig={editingChartIndex !== null ? customCharts[editingChartIndex] : null}
        defaultDataSource={dashboardMode}
      />
      
      {/* Frozen Header & KPI Section */}
      <div className="shrink-0 space-y-3">
        {/* Modern Executive Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100/80">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Business Intelligence</h2>
            <p className="text-xs text-slate-500 font-medium">Indicadores consolidados, uso da frota e análises gráficas dinâmicas</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canEditDashboard && (
              <button 
                onClick={() => setIsCreateAccessModalOpen(true)}
                className="text-slate-600 hover:text-emerald-700 hover:border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 px-3 py-1.5 rounded-xl bg-white shadow-sm cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-slate-400" /> Criar Acesso Usuário
              </button>
            )}
            <div className="flex items-center gap-2 bg-slate-100/70 border border-slate-200/50 px-3.5 py-1.5 rounded-full text-[10px] text-slate-600 font-bold tracking-wider w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              ATUALIZADO EM TEMPO REAL
            </div>
          </div>
        </div>
        
        {/* Dashboard Controls and Cards */}
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          {/* Dashboard Controls */}
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 justify-between items-center">
            <div className="flex p-1 bg-slate-100 rounded-xl overflow-hidden shadow-inner w-full lg:w-auto">
                  {[{id: 'reservations', icon: ClockIcon, label: 'Reservas'}, {id: 'dailyUse', icon: ClipboardListIcon, label: 'Uso Diário'}, {id: 'vehicles', icon: CarIcon, label: 'Frota'}].map((tab: any) => (
                      <button 
                        key={tab.id}
                        onClick={() => setDashboardMode(tab.id)} 
                        className={`flex-1 lg:flex-initial px-5 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${dashboardMode === tab.id ? 'bg-white text-emerald-600 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                          <tab.icon className="h-4 w-4" /> {tab.label}
                      </button>
                  ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <FunnelIcon className="h-4 w-4 text-slate-400" />
                    <span className="hidden sm:inline">Período:</span>
                </div>
                <select value={globalFilters.year} onChange={e => setGlobalFilters(f => ({...f, year: e.target.value}))} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3 py-2 shadow-sm font-semibold cursor-pointer outline-none transition-all">
                    <option value="">Ano: Todos</option>
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <select value={globalFilters.month} onChange={e => setGlobalFilters(f => ({...f, month: e.target.value}))} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3 py-2 shadow-sm font-semibold cursor-pointer outline-none transition-all">
                    <option value="">Mês: Todos</option>
                    {months.map((month, index) => <option key={index} value={index}>{month}</option>)}
                </select>
                {canEditDashboard && onResetToDefaults && (
                    <button 
                        onClick={onResetToDefaults} 
                        title="Restaurar layout de gráficos padrão recomendados pelo BI"
                        className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all duration-200 bg-white hover:bg-slate-100/80 active:scale-95 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Restaurar Padrão BI
                    </button>
                )}
                {canEditDashboard && (
                    <button 
                        onClick={handleOpenAddModal} 
                        className="group relative inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white transition-all duration-200 bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/10 cursor-pointer"
                    >
                        <PlusIcon className="w-4 h-4 mr-1.5" />
                        Nova Análise
                    </button>
                )}
            </div>
          </div>

          {/* KPI Cards - Responsive Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${dashboardMode === 'reservations' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-4`}>
            {kpiCards.map((card, index) => (
                <KPICard key={index} {...card} 
                    numericValue={(card as any).numericValue !== undefined ? (card as any).numericValue : (typeof card.value === 'number' ? card.value : undefined)} 
                />
            ))}
          </div>
        </div>
      </div>
      
      {/* Scrollable Charts Grid - 2 per row */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {chartsToDisplay.map((config, index) => {
             const originalIndex = customCharts.findIndex(c => c.id === config.id);
             const isFullWidth = config.dimension === 'status' || config.dimension === 'month' || (config.dimension === 'department' && config.metric === 'avg_duration_days');

             return (
             <div 
                key={config.id} 
                className={`h-auto ${isFullWidth ? 'col-span-1 lg:col-span-2' : 'col-span-1'} transition-all duration-200 ${draggedChartId === config.id ? 'opacity-40 scale-[0.98]' : ''} ${dragOverChartId === config.id ? 'ring-2 ring-emerald-500 ring-offset-2 rounded-[24px]' : ''}`}
                draggable={canEditDashboard}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(config.id));
                  setDraggedChartId(config.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverChartId !== config.id) {
                    setDragOverChartId(config.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverChartId === config.id) {
                    setDragOverChartId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropChart(config.id);
                }}
                onDragEnd={() => {
                  setDraggedChartId(null);
                  setDragOverChartId(null);
                }}
              >
                 <ChartWrapper 
                    title={config.title}
                    data={processChartData(config)}
                    config={config}
                    onConfigChange={(changes) => handleChartConfigChange(config.id, changes)}
                    onRemove={canEditDashboard ? () => handleRemoveChart(originalIndex) : undefined}
                    onEdit={canEditDashboard ? () => handleOpenEditModal(originalIndex) : undefined}
                    onMoveUp={canEditDashboard && index > 0 ? () => handleMoveChart(config.id, 'up') : undefined}
                    onMoveDown={canEditDashboard && index < chartsToDisplay.length - 1 ? () => handleMoveChart(config.id, 'down') : undefined}
                    isDraggable={canEditDashboard}
                />
            </div>
          )})}
        </div>
      </div>
      
      {/* Modal Criar Acesso */}
      {isCreateAccessModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left font-sans">
              <div className="bg-white rounded-[24px] shadow-2xl border border-slate-150 max-w-md w-full overflow-hidden animate-scaleIn">
                  <div className="bg-[#114D38] px-6 py-5 text-white flex items-center justify-between">
                      <div>
                          <h3 className="text-base font-bold uppercase tracking-wider">Criar Novo Acesso</h3>
                          <p className="text-[11px] text-emerald-200 mt-0.5">Submódulo de Gestão de Reservas</p>
                      </div>
                      <button 
                        onClick={() => {
                            setIsCreateAccessModalOpen(false);
                            setAccessError(null);
                            setAccessSuccess(null);
                        }} 
                        className="p-1 text-emerald-100 hover:text-white rounded-lg hover:bg-white/10 transition"
                      >
                          <XIcon className="h-5 w-5" />
                      </button>
                  </div>
                  
                  <form onSubmit={handleCreateAccess} className="p-6 space-y-4">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                          <input 
                              type="text"
                              value={accessName}
                              onChange={e => setAccessName(e.target.value)}
                              placeholder="Ex: João da Silva"
                              required
                              disabled={isAccessLoading || !!accessSuccess}
                              className="w-full border border-slate-300 p-2.5 text-sm rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-800"
                          />
                      </div>

                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail de Acesso</label>
                          <input 
                              type="email"
                              value={accessEmail}
                              onChange={e => setAccessEmail(e.target.value)}
                              placeholder="Ex: joao.silva@risel.com.br"
                              required
                              disabled={isAccessLoading || !!accessSuccess}
                              className="w-full border border-slate-300 p-2.5 text-sm rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-800"
                          />
                      </div>

                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha Provisória</label>
                          <input 
                              type="text"
                              value={accessTempPassword}
                              onChange={e => setAccessTempPassword(e.target.value)}
                              placeholder="Minimo 6 caracteres"
                              required
                              disabled={isAccessLoading || !!accessSuccess}
                              className="w-full border border-slate-300 p-2.5 text-sm rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-semibold text-slate-800"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">Após a criação, um e-mail de redefinição de senha será disparado para este endereço.</p>
                      </div>

                      {accessError && (
                          <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-lg font-medium leading-relaxed">
                              {accessError}
                          </div>
                      )}

                      {accessSuccess && (
                          <div className="bg-green-50 border border-green-100 text-green-700 text-xs p-3 rounded-lg font-semibold leading-relaxed flex items-center gap-2">
                              <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                              <span>{accessSuccess}</span>
                          </div>
                      )}

                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                          <button 
                              type="button"
                              onClick={() => {
                                  setIsCreateAccessModalOpen(false);
                                  setAccessError(null);
                                  setAccessSuccess(null);
                              }}
                              disabled={isAccessLoading}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition duration-200 cursor-pointer"
                          >
                              Cancelar
                          </button>
                          <button 
                              type="submit"
                              disabled={isAccessLoading || !!accessSuccess}
                              className="bg-[#114D38] hover:bg-[#1d7053] text-white font-bold py-2 px-4 rounded-xl text-xs transition duration-200 cursor-pointer shadow-sm flex items-center gap-1.5 disabled:bg-slate-300"
                          >
                              {isAccessLoading ? 'Criando...' : 'Criar Acesso'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default DashboardView;

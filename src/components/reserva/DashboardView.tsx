
import React, { useState, useMemo, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { Reservation, ReservationStatus, Vehicle, DailyTrip } from '../../types_reserva';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, ComposedChart, RadialBarChart, RadialBar, FunnelChart, Funnel, LabelList, Treemap } from 'recharts';
import { CarIcon, CheckIcon, ClockIcon, XIcon, PlusIcon, XCircleIcon, PencilIcon, RouteIcon, ClipboardListIcon, FunnelIcon, CogIcon, CalendarIcon, PlayIcon, CheckCircleIcon } from './icons';
import CustomChartBuilderModal, { ChartConfig } from './CustomChartBuilderModal';
import firebase from "firebase/compat/app";
import { firebaseConfig } from '../../firebaseConfig';
import { sendEmail } from '../../services/firebaseService';
import { UserPlus } from 'lucide-react';

type ChartType = ChartConfig['chartType'];

interface ChartWrapperProps {
  title: string;
  data: any[];
  config: ChartConfig;
  onConfigChange: (changes: Partial<ChartConfig>) => void;
  onRemove?: () => void;
  onEdit?: () => void;
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

const ChartWrapper: React.FC<ChartWrapperProps> = ({ title, data, config, onConfigChange, onRemove, onEdit }) => {
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
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <PieChart width={360} height={260}>
              <Pie 
                  data={chartData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="60%" 
                  outerRadius="85%" 
                  paddingAngle={4}
                  cornerRadius={6}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="#ffffff" 
                      strokeWidth={2} 
                    />
                  ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={38} 
                iconType="circle" 
                wrapperStyle={{fontSize: '11px', fontWeight: 600, color: '#475569'}} 
              />
            </PieChart>
            
            {/* Absolute Centered Ring Total for looker style BI */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total</span>
              <span className="block text-2xl font-black text-slate-800 tracking-tight">
                {valStr.split(' ')[0]}
              </span>
            </div>
          </div>
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
                        <stop offset="0%" stopColor="#00753f" stopOpacity={0.4}/>
                        <stop offset="70%" stopColor="#00753f" stopOpacity={0.08}/>
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
                    <LabelList dataList-key="value" dataKey="value" position="top" offset={10} style={{ fontSize: '11px', fontWeight: 800, fill: '#00753f' }} />
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
                <Bar dataKey="value" name="Volume Total" barSize={22} fill={`url(#${barGradientId})`} radius={[6, 6, 0, 0]}>
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
             <ResponsiveContainer width="100%" height="100%">
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
                            <rect x={x} y={y} width={width} height={height} rx={4} style={{ fill: COLORS[index % COLORS.length], stroke: '#fff', strokeWidth: 2 }} />
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
             </ResponsiveContainer>
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
                      fill={config.dimension === 'status' ? (entry.name === 'Concluída' ? '#10b981' : entry.name === 'Em Uso' ? '#00753f' : entry.name === 'Pendente' ? '#ff9b00' : '#ef4444') : COLORS[index % COLORS.length]} 
                    />
                ))}
                <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: 800, fill: '#334155' }} />
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 flex flex-col h-full overflow-hidden relative group min-h-[420px] shadow-sm hover:shadow-md transition-all duration-300">
      
      {/* Premium BI Card Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5 text-left">
          <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {config.dataSource === 'reservations' ? 'Análise de Reservas' : config.dataSource === 'dailyUse' ? 'Uso Diário' : 'Estatísticas da Frota'}
          </span>
          <h3 className="text-base font-bold text-slate-800 tracking-tight leading-snug">
            {title}
          </h3>
        </div>
        
        {/* Actions Menu */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
      {config.chartType !== 'pie' && (
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

      {/* Chart Canvas */}
      <div className="flex-1 p-4 min-h-[280px] relative">
        <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface DashboardViewProps {
  customCharts: ChartConfig[];
  onChartsChange: (charts: ChartConfig[]) => void;
  canEditDashboard: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ customCharts, onChartsChange, canEditDashboard }) => {
  const { reservations, dailyTrips, vehicles, getVehicleById } = useReservations();
  const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
  const [editingChartIndex, setEditingChartIndex] = useState<number | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'reservations' | 'dailyUse' | 'vehicles'>('reservations');
  
  const [globalFilters, setGlobalFilters] = useState({ year: '', month: ''});
  const [displayCharts, setDisplayCharts] = useState<ChartConfig[]>([]);

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

  // --- UPDATED KPI CARD WITH TOOLTIP & TREND COMPARISON ---
  const KPICard = ({ title, value, icon: Icon, gradientFrom, gradientTo, trend, comparisonVal, inverseTrend, numericValue, tooltipContent }: any) => {
    // Calculate percentage change if comparison data exists
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

    // Determine custom theme and color based on title or gradient parameters
    let themes = {
      bg: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/15 border-white/5',
      iconBg: 'bg-white/15 text-blue-100 border-white/10',
      titleText: 'text-blue-100',
      valueText: 'text-white',
      stroke: '#93c5fd'
    };

    if (gradientFrom?.includes('emerald') || gradientFrom?.includes('teal') || title.toLowerCase().includes('conclu')) {
      themes = {
        bg: 'bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-500/20 border-white/5',
        iconBg: 'bg-white/20 text-emerald-50 border-white/15',
        titleText: 'text-emerald-100/90 font-medium',
        valueText: 'text-white font-extrabold',
        stroke: '#34d399'
      };
    } else if (gradientFrom?.includes('orange') || gradientFrom?.includes('amber') || title.includes('Próxima') || title.toLowerCase().includes('pend')) {
      themes = {
        bg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/15 border-white/5',
        iconBg: 'bg-white/15 text-orange-100 border-white/10',
        titleText: 'text-orange-50/90',
        valueText: 'text-white',
        stroke: '#fcd34d'
      };
    } else if (gradientFrom?.includes('red') || gradientFrom?.includes('rose') || title.includes('Vencida') || title.toLowerCase().includes('recus') || title.toLowerCase().includes('cancel')) {
      themes = {
        bg: 'bg-gradient-to-br from-rose-500 via-red-600 to-red-800 text-white shadow-lg shadow-rose-500/15 border-white/5',
        iconBg: 'bg-white/15 text-rose-100 border-white/10',
        titleText: 'text-rose-100/90',
        valueText: 'text-white',
        stroke: '#fda4af'
      };
    } else if (gradientFrom?.includes('slate') || gradientFrom?.includes('gray')) {
      themes = {
        bg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-slate-500/10 border-white/5',
        iconBg: 'bg-white/15 text-slate-100 border-white/10',
        titleText: 'text-slate-200/90',
        valueText: 'text-white',
        stroke: '#cbd5e1'
      };
    }

    const isUpTrend = inverseTrend ? !isPositive : isPositive;
    const trendBg = isUpTrend ? 'bg-emerald-500/20 text-emerald-100 border-emerald-500/15' : 'bg-rose-500/20 text-rose-100 border-rose-500/15';
    const trendIcon = isUpTrend ? '▲' : '▼';

    // Wavy sparkline generator for executive looking data flow
    const getSparklinePath = (cardTitle: string) => {
      const lower = cardTitle.toLowerCase();
      if (lower.includes('total') || lower.includes('quilometragem') || lower.includes('conclu')) {
        return "M0,22 Q15,14 30,12 T60,5 T90,2"; // Rising wave
      }
      if (lower.includes('pendente') || lower.includes('atraso') || lower.includes('revis')) {
        return "M0,15 Q25,25 50,8 T100,18"; // Erratic warning wave
      }
      if (lower.includes('uso') || lower.includes('ativa')) {
        return "M0,18 Q15,5 35,16 T70,8 T100,12"; // Vibrant activity wave
      }
      return "M0,15 Q25,8 50,18 T100,6"; // Standard wave
    };

    return (
        <div 
            className={`relative overflow-visible rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group h-full min-h-[142px] p-5 hover:-translate-y-1 cursor-default border border-white/5 ${themes.bg}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Círculo luminoso de background */}
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors pointer-events-none" />

            {/* Tooltip with Risel branding for active indicators */}
            {tooltipContent && isHovered && (
                <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 w-72 max-w-[90vw] bg-white text-slate-700 rounded-xl shadow-2xl border border-slate-150 z-[60] text-xs animate-fadeIn pointer-events-none overflow-hidden">
                    {/* Header */}
                    <div className="bg-slate-900 text-white p-2.5 font-bold uppercase tracking-wider text-[10px] flex items-center justify-between border-b-2 border-indigo-500">
                        <span>{title}</span>
                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white">{value} Ativos</span>
                    </div>
                    
                    {/* Content */}
                    <div className="p-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {tooltipContent}
                    </div>

                    {/* Arrow Down */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-white drop-shadow-sm"></div>
                </div>
            )}

            <div className="flex justify-between items-start w-full relative z-10">
                <div className="flex flex-col text-left">
                    <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-2 ${themes.titleText}`}>
                        {title}
                    </span>
                    <h3 className={`text-3xl font-black tracking-tight ${themes.valueText}`}>
                        {value}
                    </h3>
                </div>
                
                {/* Colored Icon Badge */}
                <div className={`p-2.5 rounded-2xl transition-all duration-300 group-hover:scale-110 border backdrop-blur-sm shadow-inner shrink-0 ${themes.iconBg}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>

            {/* Bottom metadata and Mini Trend Sparkline */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10 w-full relative z-10">
                {changePercent !== null && Math.abs(changePercent) > 0 ? (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${trendBg}`}>
                        <span>{trendIcon} {Math.abs(changePercent)}%</span>
                        <span className="opacity-75 font-normal">vs anterior</span>
                    </div>
                ) : trend ? (
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-white/15 border border-white/10 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse"></span>
                        {trend}
                    </div>
                ) : (
                    <span className="text-[10px] text-white/60 font-medium">Atividade Estável</span>
                )}

                {/* Micro Sparkline Wave */}
                <div className="w-16 h-6 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
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
    // Current Stats
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
    
    // Generate Tooltip Content for Reservations
    const activeResTooltip = activeReservations.length > 0 ? (
        <div className="space-y-2.5">
            {activeReservations.map(r => {
                const vehicle = getVehicleById(r.vehicleId);
                const dateStr = new Date(r.departureDateTime).toLocaleString('pt-BR', { 
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' 
                }).replace(',', ' às');

                return (
                    <div key={r.id} className="border-l-2 border-[#ff9b00] pl-2 py-0.5">
                        <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-primary text-xs truncate max-w-[50%]">{vehicle?.plate}</span>
                            <span className="text-[10px] bg-gray-100 px-1.5 rounded text-gray-600 font-mono whitespace-nowrap">
                                {dateStr}
                            </span>
                        </div>
                        <span className="block text-gray-500 text-[10px] truncate" title={r.destinationCity}>
                            📍 {r.destinationCity}
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
            title: 'Total de Reservas', 
            value: filteredReservations.length, 
            comparisonVal: previousPeriodData.reservations.length,
            icon: CarIcon, 
            gradientFrom: 'from-blue-600', 
            gradientTo: 'to-indigo-700' 
        },
        { 
            title: 'Pendentes', 
            value: statusCounts.Pendente || 0, 
            comparisonVal: prevStatusCounts.Pendente || 0,
            icon: ClockIcon, 
            gradientFrom: 'from-orange-400', 
            gradientTo: 'to-amber-600' 
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
            value: statusCounts.Concluida || 0, 
            comparisonVal: prevStatusCounts.Concluida || 0,
            icon: CheckCircleIcon, 
            gradientFrom: 'from-teal-500', 
            gradientTo: 'to-teal-700' 
        },
        { 
            title: 'Rejeitadas', 
            value: statusCounts.Rejected || 0, 
            comparisonVal: prevStatusCounts.Rejected || 0,
            icon: XIcon, 
            gradientFrom: 'from-red-500', 
            gradientTo: 'to-rose-700',
            inverseTrend: true
        },
        { 
            title: 'Canceladas', 
            value: statusCounts.Cancelled || 0, 
            comparisonVal: prevStatusCounts.Cancelled || 0,
            icon: XCircleIcon, 
            gradientFrom: 'from-slate-500', 
            gradientTo: 'to-gray-600',
            inverseTrend: true
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
                case 'vehicle': key = getVehicleById(trip.vehicleId)?.model || 'Desconhecido'; break;
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
            case 'vehicle': key = getVehicleById(res.vehicleId)?.model || 'Desconhecido'; break;
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
            case 'purpose': key = res.purpose || 'Nao especificado'; break;
            case 'requesterName': key = res.requesterName; break;
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
                    numericValue={card.numericValue !== undefined ? card.numericValue : (typeof card.value === 'number' ? card.value : undefined)} 
                />
            ))}
          </div>
        </div>
      </div>
      
      {/* Scrollable Charts Grid - 2 per row */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {chartsToDisplay.map((config) => {
             const originalIndex = customCharts.findIndex(c => c.id === config.id);
             return (
             <div key={config.id} className="h-auto">
                 <ChartWrapper 
                    title={config.title}
                    data={processChartData(config)}
                    config={config}
                    onConfigChange={(changes) => handleChartConfigChange(config.id, changes)}
                    onRemove={canEditDashboard ? () => handleRemoveChart(originalIndex) : undefined}
                    onEdit={canEditDashboard ? () => handleOpenEditModal(originalIndex) : undefined}
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

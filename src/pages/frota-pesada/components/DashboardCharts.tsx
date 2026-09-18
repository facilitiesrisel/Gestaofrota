
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  RadialBarChart, RadialBar, ComposedChart, ScatterChart, Scatter, ZAxis, LabelList
} from 'recharts';
import { Multa } from '../types';
import { GripVertical, X, Settings2, RefreshCw, ChevronDown, Cloud, Palette, Trophy, Crown, AlertTriangle, Truck, User, Medal, Sun, Moon, Calendar, Clock, BarChart3, Building2, SignpostBig, Map } from 'lucide-react';
import { fetchDashboardConfig, saveDashboardConfigApi } from '../services/storage';

interface DashboardChartsProps {
  multas: Multa[];
}

// Definição das configurações de cada widget de gráfico
interface ChartWidgetConfig {
  id: string;
  title: string;
  type: string; // 1-26
  colorTheme?: string; // New: Color preference
  visible: boolean;
}

// 16 Color Themes Map - Expanded Palette
const COLOR_THEMES: Record<string, string[]> = {
    'default': ['#00d664', '#ff9b00', '#0ea5e9', '#ef4444', '#a855f7', '#eab308', '#ec4899', '#64748b'], // Padrão Risel
    'neon': ['#00ff9d', '#ff00ff', '#00ffff', '#ffff00', '#ff3366', '#3366ff', '#ffffff', '#b3ff00'], // Neon Cyber
    'ocean': ['#0ea5e9', '#0284c7', '#0369a1', '#38bdf8', '#7dd3fc', '#1e40af', '#172554', '#bae6fd'], // Oceano
    'forest': ['#00d664', '#059669', '#10b981', '#34d399', '#6ee7b7', '#064e3b', '#022c22', '#a7f3d0'], // Floresta
    'sunset': ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#fbbf24', '#f87171'], // Pôr do Sol
    'fire': ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#ff9b00', '#ea580c', '#c2410c', '#fca5a5'], // Fogo
    'purple': ['#a855f7', '#9333ea', '#7e22ce', '#c084fc', '#d8b4fe', '#581c87', '#3b0764', '#e9d5ff'], // Roxo
    'berry': ['#db2777', '#be185d', '#9d174d', '#f472b6', '#ec4899', '#831843', '#500724', '#fbcfe8'], // Berry
    'teal': ['#14b8a6', '#0d9488', '#0f766e', '#2dd4bf', '#5eead4', '#115e59', '#134e4a', '#99f6e4'], // Teal
    'gold': ['#eab308', '#ca8a04', '#a16207', '#facc15', '#fde047', '#854d0e', '#713f12', '#fef08a'], // Ouro
    'midnight': ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554', '#60a5fa', '#93c5fd', '#bfdbfe'], // Meia-noite
    'pastel': ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#d8b4fe', '#f0abfc'], // Pastel
    'retro': ['#d97706', '#b45309', '#78350f', '#0d9488', '#0f766e', '#f59e0b', '#fef3c7', '#fffbeb'], // Retro 70s
    'earth': ['#a16207', '#854d0e', '#65a30d', '#4d7c0f', '#3f6212', '#365314', '#1a2e05', '#bef264'], // Terra
    'cold': ['#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#67e8f9', '#a5f3fc'], // Frio
    'grayscale': ['#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#e2e8f0', '#f1f5f9'], // Cinza
};

const CHART_TYPES = [
  { id: '26', label: 'Visual Rodovia vs Urbano (Ilustrativo)', group: 'Especiais' },
  { id: '24', label: 'Visual Dia vs Noite', group: 'Especiais' },
  { id: '25', label: 'Calendário Semanal Visual', group: 'Especiais' },
  { id: '22', label: 'Podium Ranking (Top 5)', group: 'Especiais' },
  { id: '23', label: 'Barras + Tooltip Detalhado', group: 'Especiais' },
  { id: '1', label: 'Barras Verticais (Padrão)', group: 'Barras' },
  { id: '2', label: 'Barras Horizontais', group: 'Barras' },
  { id: '3', label: 'Barras Empilhadas', group: 'Barras' },
  { id: '4', label: 'Barras Coloridas (Heatmap)', group: 'Barras' },
  { id: '5', label: 'Linha Suave (Curve)', group: 'Linhas' },
  { id: '6', label: 'Linha Reta (Linear)', group: 'Linhas' },
  { id: '7', label: 'Linha Step (Degraus)', group: 'Linhas' },
  { id: '8', label: 'Linha Tracejada', group: 'Linhas' },
  { id: '9', label: 'Área Gradiente', group: 'Área' },
  { id: '10', label: 'Área Simples', group: 'Área' },
  { id: '11', label: 'Área Empilhada', group: 'Área' },
  { id: '12', label: 'Pizza (Pie)', group: 'Circular' },
  { id: '13', label: 'Donut (Total no Centro)', group: 'Circular' },
  { id: '14', label: 'Pizza Separada (Exploded)', group: 'Circular' },
  { id: '15', label: 'Radial Bar', group: 'Circular' },
  { id: '16', label: 'Radar (Teia)', group: 'Radar' },
  { id: '17', label: 'Radar Preenchido', group: 'Radar' },
  { id: '18', label: 'Composto (Barra + Linha)', group: 'Misto' },
  { id: '19', label: 'Composto (Área + Linha)', group: 'Misto' },
  { id: '20', label: 'Dispersão (Scatter)', group: 'Outros' },
  { id: '21', label: 'Bolhas (Bubble Like)', group: 'Outros' },
];

// Configuração Padrão Inicial
const DEFAULT_CONFIG: ChartWidgetConfig[] = [
  { id: 'evolucao_mensal', title: 'Evolução Temporal das Infrações', type: '9', colorTheme: 'midnight', visible: true },
  { id: 'periodo_dia_noite', title: 'Infrações: Dia vs Noite', type: '24', visible: true, colorTheme: 'default' },
  { id: 'dia_semana_visual', title: 'Ocorrências por Dia da Semana', type: '25', visible: true, colorTheme: 'ocean' },
  { id: 'top_motoristas', title: 'Top 5 Motoristas (Ranking)', type: '22', visible: true, colorTheme: 'fire' },
  { id: 'top_veiculos', title: 'Top 5 Veículos (Ranking)', type: '22', visible: true, colorTheme: 'fire' },
  { id: 'enquadramento_detalhado', title: 'Infrações por Enquadramento', type: '23', visible: true, colorTheme: 'ocean' },
  { id: 'trecho', title: 'Rodovia vs Urbano', type: '26', colorTheme: 'default', visible: true },
  { id: 'frota', title: 'Multas por Frota', type: '1', colorTheme: 'default', visible: true },
  { id: 'base', title: 'Multas por Base', type: '12', colorTheme: 'ocean', visible: true },
];

const CustomEnquadramentoTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden min-w-[280px] font-sans z-50">
        <div className="bg-[#022c22] p-3 border-b border-risel-green flex justify-between items-center">
            <span className="text-white font-bold text-xs uppercase tracking-wide flex items-center">
                <AlertTriangle size={14} className="mr-2 text-risel-green"/>
                {label}
            </span>
            <span className="text-risel-green font-black text-lg">{data.value}</span>
        </div>
        <div className="p-4 bg-gradient-to-b from-white to-slate-50">
            <p className="text-xs text-slate-500 font-bold uppercase mb-1">Descrição</p>
            <p className="text-sm text-slate-800 font-medium leading-relaxed mb-4">
                {data.description || 'Sem descrição disponível.'}
            </p>
            {data.valorTotal > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-400 font-bold uppercase">Valor Acumulado</span>
                    <span className="text-sm font-black text-red-600 bg-red-50 px-2 py-1 rounded">
                        {data.valorTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </span>
                </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};

// --- COMPONENTE VISUAL: RODOVIA VS URBANO (V2 IMPROVED) ---
const RoadUrbanChart = ({ data }: { data: any[] }) => {
    const findVal = (key: string) => data.find(d => d.name && d.name.toUpperCase().includes(key))?.value || 0;
    
    const rodovia = findVal('RODOVIA');
    const urbano = findVal('URBANO');
    const total = rodovia + urbano || 1;
    
    const rodoviaPct = Math.round((rodovia / total) * 100);
    const urbanoPct = Math.round((urbano / total) * 100);

    return (
        <div className="w-full h-full flex flex-col p-1 gap-3 select-none">
            <div className="flex-1 flex gap-4 relative">
                
                {/* VS Badge Floating Center */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-2 shadow-2xl border-4 border-slate-50 ring-4 ring-black/5 transform hover:scale-110 transition-transform">
                    <span className="text-[12px] font-black text-slate-400 block leading-none">VS</span>
                </div>

                {/* URBAN CARD */}
                <div className="flex-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#0f172a] shadow-lg border border-slate-700/50 group">
                    {/* Sky Effect */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent"></div>
                    
                    {/* Buildings Silhouette (CSS Art) */}
                    <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-center px-4 opacity-20 group-hover:opacity-30 transition-opacity duration-500">
                        <div className="w-8 h-20 bg-slate-300 mx-0.5 rounded-t-sm"></div>
                        <div className="w-12 h-32 bg-slate-400 mx-0.5 rounded-t-md"></div>
                        <div className="w-10 h-16 bg-slate-300 mx-0.5 rounded-t-sm"></div>
                        <div className="w-14 h-24 bg-slate-400 mx-0.5 rounded-t-lg"></div>
                        <div className="w-8 h-12 bg-slate-300 mx-0.5 rounded-t-sm"></div>
                    </div>

                    {/* Window Lights Animation (Subtle) */}
                    <div className="absolute bottom-4 left-1/4 w-1 h-1 bg-yellow-100 rounded-full animate-pulse opacity-40"></div>
                    <div className="absolute bottom-10 right-1/3 w-1 h-1 bg-yellow-100 rounded-full animate-pulse delay-700 opacity-40"></div>

                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
                        <div className="bg-slate-700/50 p-3 rounded-2xl mb-3 backdrop-blur-md border border-slate-600/50 shadow-inner group-hover:-translate-y-2 transition-transform duration-300">
                            <Building2 size={32} className="text-blue-300 drop-shadow-md" />
                        </div>
                        <h3 className="text-4xl font-black text-white drop-shadow-xl tracking-tight">{urbano}</h3>
                        <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Urbano</span>
                        <div className="mt-3 text-[10px] font-bold bg-slate-800/80 px-3 py-1 rounded-full border border-slate-600 text-blue-200 shadow-lg backdrop-blur-sm">
                            {urbanoPct}% do Total
                        </div>
                    </div>
                </div>

                {/* HIGHWAY CARD */}
                <div className="flex-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#022c22] shadow-lg border border-emerald-800/50 group">
                    {/* Sky/Sun Effect */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-400/10 to-transparent"></div>

                    {/* Road Perspective (CSS Art) */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-3/4 flex justify-center opacity-30 group-hover:opacity-40 transition-opacity duration-500 perspective-500">
                         <div className="w-1/2 h-full bg-[#0f172a] [clip-path:polygon(30%_0%,70%_0%,100%_100%,0%_100%)] relative">
                             {/* Road Markings */}
                             <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 border-r-2 border-dashed border-yellow-500/40"></div>
                             <div className="absolute top-0 bottom-0 left-[5%] w-0.5 bg-white/20"></div>
                             <div className="absolute top-0 bottom-0 right-[5%] w-0.5 bg-white/20"></div>
                         </div>
                    </div>

                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
                        <div className="bg-emerald-800/50 p-3 rounded-2xl mb-3 backdrop-blur-md border border-emerald-700/50 shadow-inner group-hover:-translate-y-2 transition-transform duration-300">
                            <SignpostBig size={32} className="text-emerald-200 drop-shadow-md" />
                        </div>
                        <h3 className="text-4xl font-black text-white drop-shadow-xl tracking-tight">{rodovia}</h3>
                        <span className="text-[10px] font-bold text-emerald-200/70 tracking-[0.2em] uppercase mt-1">Rodovia</span>
                        <div className="mt-3 text-[10px] font-bold bg-emerald-900/80 px-3 py-1 rounded-full border border-emerald-700 text-emerald-200 shadow-lg backdrop-blur-sm">
                            {rodoviaPct}% do Total
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Visual Bar Footer - Enhanced Contrast and Visibility */}
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200 mt-2 relative">
                <div 
                    style={{ width: `${urbanoPct}%` }} 
                    className="bg-gradient-to-r from-slate-700 to-slate-900 h-full transition-all duration-1000 flex items-center justify-center border-r border-white/20"
                    title={`Urbano: ${urbanoPct}%`}
                >
                     {urbanoPct > 10 && <span className="text-[9px] font-black text-white drop-shadow-md">{urbanoPct}%</span>}
                </div>
                <div 
                    style={{ width: `${rodoviaPct}%` }} 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-700 h-full transition-all duration-1000 flex items-center justify-center"
                    title={`Rodovia: ${rodoviaPct}%`}
                >
                     {rodoviaPct > 10 && <span className="text-[9px] font-black text-white drop-shadow-md">{rodoviaPct}%</span>}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE VISUAL: DIA VS NOITE ---
const DayNightChart = ({ data }: { data: any[] }) => {
    // data expected: [{name: 'Dia', value: X}, {name: 'Noite', value: Y}]
    const dia = data.find(d => d.name.includes('Dia'))?.value || 0;
    const noite = data.find(d => d.name.includes('Noite'))?.value || 0;
    const total = dia + noite || 1;
    const diaPercent = Math.round((dia / total) * 100);
    const noitePercent = Math.round((noite / total) * 100);

    return (
        <div className="w-full h-full flex flex-col justify-center items-center px-4 py-2">
            <div className="w-full h-32 flex rounded-2xl overflow-hidden shadow-lg border border-slate-200 relative">
                {/* Lado Dia */}
                <div 
                    className="h-full bg-gradient-to-br from-sky-400 to-blue-500 relative transition-all duration-1000 flex items-center justify-center group"
                    style={{ width: `${diaPercent}%` }}
                >
                    <div className="absolute top-2 left-2 text-white/80 font-bold text-xs uppercase tracking-widest flex items-center">
                        <Sun size={14} className="mr-1"/> Dia
                    </div>
                    <div className="text-center z-10">
                        <span className="text-3xl font-black text-white drop-shadow-md">{dia}</span>
                        <p className="text-[10px] text-white/90 font-bold">{diaPercent}%</p>
                    </div>
                    <div className="absolute -right-10 -top-10 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                </div>

                {/* Lado Noite */}
                <div 
                    className="h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 relative transition-all duration-1000 flex items-center justify-center group"
                    style={{ width: `${noitePercent}%` }}
                >
                    <div className="absolute top-2 right-2 text-white/80 font-bold text-xs uppercase tracking-widest flex items-center">
                        Noite <Moon size={14} className="ml-1"/>
                    </div>
                    <div className="text-center z-10">
                        <span className="text-3xl font-black text-white drop-shadow-md">{noite}</span>
                        <p className="text-[10px] text-white/90 font-bold">{noitePercent}%</p>
                    </div>
                    <div className="absolute -left-5 bottom-0 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
                    
                    {/* Estrelas decorativas */}
                    <div className="absolute top-4 right-10 w-1 h-1 bg-white rounded-full opacity-70 animate-pulse"></div>
                    <div className="absolute bottom-8 left-8 w-0.5 h-0.5 bg-white rounded-full opacity-50"></div>
                </div>

                {/* Divisor Central */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20 z-20"></div>
            </div>
            
            <div className="w-full flex justify-between mt-4 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                    <span className="text-xs font-medium text-slate-600">06:00 - 17:59</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">18:00 - 05:59</span>
                    <div className="w-3 h-3 rounded-full bg-indigo-900"></div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE VISUAL: CALENDÁRIO SEMANAL ---
const CalendarWeekChart = ({ data, colorTheme }: { data: any[], colorTheme: string }) => {
    // data: [{name: 'Dom', value: X}, ..., {name: 'Sáb', value: Y}]
    const daysOrder = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const sortedData = daysOrder.map(day => data.find(d => d.name === day) || { name: day, value: 0 });
    const maxVal = Math.max(...sortedData.map(d => d.value)) || 1;
    
    // Obter cores do tema
    const activeColors = COLOR_THEMES[colorTheme] || COLOR_THEMES['ocean'];
    const mainColor = activeColors[0]; // e.g. blue-500 equivalent in hex

    return (
        <div className="w-full h-full flex flex-col justify-center px-2">
            <div className="grid grid-cols-7 gap-2 h-32">
                {sortedData.map((item, idx) => {
                    const intensity = item.value / maxVal;
                    const opacity = 0.2 + (intensity * 0.8); // Min 0.2 opacity
                    
                    return (
                        <div key={idx} className="flex flex-col h-full group">
                            {/* Card do Dia */}
                            <div className="flex-1 rounded-xl relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col justify-end border border-slate-100 bg-slate-50">
                                {/* Barra de Cor (Heatmap style) */}
                                <div 
                                    className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
                                    style={{ 
                                        height: `${Math.max(15, intensity * 100)}%`, 
                                        backgroundColor: mainColor,
                                        opacity: opacity
                                    }}
                                ></div>
                                
                                {/* Valor */}
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <span className={`text-lg font-black ${intensity > 0.5 ? 'text-white drop-shadow-md' : 'text-slate-700'}`}>
                                        {item.value}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Label do Dia */}
                            <div className="text-center mt-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.name === 'Dom' || item.name === 'Sáb' ? 'text-red-400' : 'text-slate-500'}`}>
                                    {item.name}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- PODIUM CHART (Existing) ---
const PodiumChart = ({ data, entityType }: { data: any[], entityType: 'driver' | 'vehicle' }) => {
    if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-gray-400">Sem dados para ranking</div>;

    const top5 = [...data].slice(0, 5);
    while (top5.length < 5) top5.push({ name: '-', value: 0 });
    const podiumOrder = [3, 1, 0, 2, 4];
    const orderedData = podiumOrder.map(idx => top5[idx] || { name: '-', value: 0 });
    
    const stepConfig = [
        { height: '25%', color: 'from-amber-300 to-amber-500', shadow: 'shadow-amber-500/20', rank: 4 },
        { height: '40%', color: 'from-slate-300 to-slate-500', shadow: 'shadow-slate-500/40', rank: 2, medal: 'silver' },
        { height: '55%', color: 'from-red-500 to-red-700', shadow: 'shadow-red-600/50', rank: 1, medal: 'gold' },
        { height: '30%', color: 'from-amber-600 to-amber-800', shadow: 'shadow-amber-700/40', rank: 3, medal: 'bronze' },
        { height: '15%', color: 'from-yellow-100 to-yellow-300', shadow: 'shadow-yellow-400/20', rank: 5 }
    ];

    const EntityIcon = entityType === 'driver' ? User : Truck;

    const getMedal = (type?: string) => {
        if (type === 'gold') return <div className="w-8 h-8 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 flex items-center justify-center shadow-lg border-2 border-yellow-200 mb-2 animate-bounce"><Trophy size={16} className="text-white drop-shadow-sm"/></div>;
        if (type === 'silver') return <div className="w-6 h-6 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 flex items-center justify-center shadow-md border border-slate-100 mb-2"><Medal size={14} className="text-slate-600"/></div>;
        if (type === 'bronze') return <div className="w-6 h-6 rounded-full bg-gradient-to-b from-amber-600 to-amber-800 flex items-center justify-center shadow-md border border-amber-500 mb-2"><Medal size={14} className="text-amber-200"/></div>;
        return null;
    };

    return (
        <div className="w-full h-full flex items-end justify-center px-4 pb-0 pt-2 gap-2">
            {orderedData.map((item, idx) => {
                const config = stepConfig[idx];
                const isWinner = config.rank === 1;
                return (
                    <div key={idx} className="flex flex-col items-center justify-end w-1/5 h-full group">
                        <div className={`transition-all duration-500 transform mb-2 ${isWinner ? 'scale-110' : 'scale-90 opacity-70 group-hover:opacity-100 group-hover:-translate-y-1'}`}>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg shadow-sm backdrop-blur-md border border-white/20 ${isWinner ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
                                {item.value}
                            </span>
                        </div>
                        <div className="z-10 transition-transform duration-300 group-hover:-translate-y-1">
                            {config.medal ? getMedal(config.medal) : (
                                <div className="mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                    <EntityIcon size={16} className="text-slate-400"/>
                                </div>
                            )}
                        </div>
                        <div 
                            className={`w-full rounded-t-lg bg-gradient-to-b ${config.color} ${config.shadow} shadow-lg relative flex flex-col items-center justify-end pb-2 transition-all duration-700 ease-out hover:brightness-110`}
                            style={{ height: item.value > 0 ? config.height : '4px', opacity: item.value > 0 ? 1 : 0.3 }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-t-lg pointer-events-none"></div>
                            {item.value > 0 && (<span className={`text-4xl font-black text-white/20 select-none ${isWinner ? 'text-white/40 text-5xl' : ''}`}>{config.rank}</span>)}
                        </div>
                        <div className="mt-2 text-center w-full h-8 flex items-start justify-center">
                            <p className={`text-[10px] font-bold leading-tight truncate px-1 w-full ${isWinner ? 'text-red-600' : 'text-slate-500'}`} title={item.name}>{item.name}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const DashboardCharts: React.FC<DashboardChartsProps> = ({ multas }) => {
  const [configs, setConfigs] = useState<ChartWidgetConfig[]>(DEFAULT_CONFIG);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  
  // State for Evolution Chart Granularity
  const [evolutionGranularity, setEvolutionGranularity] = useState<'day' | 'week' | 'month' | 'quarter'>('month');

  const isFirstLoad = useRef(true);

  // Carregar configurações da Nuvem (e fallback local)
  useEffect(() => {
    const init = async () => {
        const savedLocal = localStorage.getItem('risel_dashboard_config_v6'); // v6 for updated visual Road/Urban chart
        if (savedLocal) {
             try { setConfigs(JSON.parse(savedLocal)); } catch(e) {}
        }
        const cloudConfig = await fetchDashboardConfig();
        if (cloudConfig && Array.isArray(cloudConfig)) {
             setConfigs(cloudConfig);
             localStorage.setItem('risel_dashboard_config_v6', JSON.stringify(cloudConfig));
        }
        isFirstLoad.current = false;
    };
    init();
  }, []);

  // Salvar configurações
  useEffect(() => {
    if (isFirstLoad.current) return;
    localStorage.setItem('risel_dashboard_config_v6', JSON.stringify(configs));
    setIsCloudSaving(true);
    const timer = setTimeout(async () => {
        try { await saveDashboardConfigApi(configs); } catch (e) {} finally { setIsCloudSaving(false); }
    }, 2000);
    return () => clearTimeout(timer);
  }, [configs]);

  const processData = (keyExtractor: (m: Multa) => string) => {
    const counts: Record<string, number> = {};
    multas.forEach(m => {
      const key = keyExtractor(m) || 'N/D';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); 
  };

  // Process Evolution Data based on Granularity
  const processEvolutionData = () => {
    const counts: Record<string, { count: number, sortKey: string, label: string }> = {};
    
    multas.forEach(m => {
        if (!m.dataHoraInfracao) return;
        const date = new Date(m.dataHoraInfracao);
        if (isNaN(date.getTime())) return;

        let key = '';
        let sortKey = '';
        let label = '';

        if (evolutionGranularity === 'day') {
            sortKey = date.toISOString().split('T')[0];
            label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            key = sortKey;
        } else if (evolutionGranularity === 'week') {
            // ISO Week
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
            sortKey = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2,'0')}`;
            label = `Sem ${weekNo}`;
            key = sortKey;
        } else if (evolutionGranularity === 'quarter') {
            const q = Math.floor((date.getMonth() + 3) / 3);
            sortKey = `${date.getFullYear()}-Q${q}`;
            label = `${date.getFullYear()} T${q}`;
            key = sortKey;
        } else {
            // Month (Default)
            sortKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
            label = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            key = sortKey;
        }

        if (!counts[key]) counts[key] = { count: 0, sortKey, label };
        counts[key].count++;
    });

    return Object.values(counts)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(item => ({ name: item.label, value: item.count }));
  };

  const processEnquadramentoData = () => {
    const counts: Record<string, { count: number, desc: string, total: number }> = {};
    multas.forEach(m => {
        const key = m.enquadramento || 'N/D';
        if (!counts[key]) counts[key] = { count: 0, desc: m.descricaoInfracao || '', total: 0 };
        counts[key].count++;
        counts[key].total += (m.valorComDesconto || m.valor || 0);
    });
    return Object.entries(counts)
        .map(([name, data]) => ({ name, value: data.count, description: data.desc, valorTotal: data.total }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
  };

  const dataMap = useMemo(() => ({
    top_motoristas: processData(m => m.responsavelNome?.split(' ')[0] || m.responsavelCodigo).slice(0, 5),
    top_veiculos: processData(m => m.placa).slice(0, 5),
    enquadramento_detalhado: processEnquadramentoData(),
    evolucao_mensal: processEvolutionData(),
    frota: processData(m => m.frota),
    motorista: processData(m => m.responsavelNome?.split(' ')[0] || m.responsavelCodigo), 
    base: processData(m => m.base),
    periodo: processData(m => {
      if (!m.dataHoraInfracao) return 'N/D';
      const hour = new Date(m.dataHoraInfracao).getHours();
      return (hour >= 6 && hour < 18) ? 'Dia (06-18h)' : 'Noite (18-06h)';
    }),
    periodo_dia_noite: processData(m => {
        if (!m.dataHoraInfracao) return 'N/D';
        const hour = new Date(m.dataHoraInfracao).getHours();
        return (hour >= 6 && hour < 18) ? 'Dia' : 'Noite';
    }),
    dia_semana_visual: processData(m => {
        if (!m.dataHoraInfracao) return 'N/D';
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days[new Date(m.dataHoraInfracao).getDay()];
    }),
    trecho: processData(m => m.rodoviaOuUrbano),
    orgao: processData(m => m.orgaoAutuador),
    status: processData(m => m.status),
    responsabilidade: processData(m => m.empresaOuCondutor)
  }), [multas, evolutionGranularity]); // Dependency updated

  const handleDragStart = (index: number) => { setDraggedItemIndex(index); };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newConfigs = [...configs];
    const draggedItem = newConfigs[draggedItemIndex];
    newConfigs.splice(draggedItemIndex, 1);
    newConfigs.splice(index, 0, draggedItem);
    setConfigs(newConfigs);
    setDraggedItemIndex(index);
  };
  const handleDragEnd = () => { setDraggedItemIndex(null); };
  const updateChartType = (id: string, newType: string) => { setConfigs(prev => prev.map(c => c.id === id ? { ...c, type: newType } : c)); };
  const updateChartColor = (id: string, newColor: string) => { setConfigs(prev => prev.map(c => c.id === id ? { ...c, colorTheme: newColor } : c)); };
  const toggleVisibility = (id: string) => { setConfigs(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c)); };
  const resetLayout = () => { if (confirm("Deseja restaurar o layout padrão dos gráficos?")) setConfigs(DEFAULT_CONFIG); };

  const renderChart = (type: string, data: any[], colorTheme: string = 'default', chartId: string = '') => {
    const activeColors = COLOR_THEMES[colorTheme] || COLOR_THEMES['default'];
    const primaryColor = activeColors[0];
    const secondaryColor = activeColors[1];

    const getCommonElements = () => ({
      grid: <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />,
      xAxis: <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} dy={10} />,
      yAxis: <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={35} tick={{fill: '#94a3b8'}} tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value} />,
      tooltip: <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} cursor={{fill: '#f8fafc'}} />,
      legend: <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#475569' }} />,
      labelList: <LabelList dataKey="value" position="top" fill="#475569" fontSize={9} fontWeight="bold" formatter={(v: any) => v > 0 ? v : ''} />
    });

    const wrap = (chart: React.ReactElement) => {
      if (!data || data.length === 0) {
        return <div className="h-full flex items-center justify-center text-xs text-gray-400">Sem dados para exibir</div>;
      }
      return (
        <ResponsiveContainer width="100%" height={250}>
          {chart}
        </ResponsiveContainer>
      );
    };

    const { grid, xAxis, yAxis, tooltip, legend, labelList } = getCommonElements();

    if (!data || data.length === 0) {
        if (['26', '24', '25', '22'].includes(type)) {
            return <div className="h-full flex items-center justify-center text-xs text-gray-400">Sem dados para exibir</div>;
        }
    }

    switch (type) {
      case '26': return <RoadUrbanChart data={data} />;
      case '24': return <DayNightChart data={data} />;
      case '25': return <CalendarWeekChart data={data} colorTheme={colorTheme} />;
      case '22': 
        const isVehicle = chartId.includes('veiculos');
        return <PodiumChart data={data} entityType={isVehicle ? 'vehicle' : 'driver'} />;
      case '23': return wrap(
        <BarChart data={data} margin={{ top: 35, right: 5, left: 0, bottom: 25 }}>
          {grid} 
          {xAxis} 
          {yAxis} 
          <Tooltip content={<CustomEnquadramentoTooltip />} cursor={{fill: '#f1f5f9'}} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Qtd" isAnimationActive={false}>
            <LabelList dataKey="value" position="top" fill="#475569" fontSize={9} fontWeight="bold" />
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : (index < 3 ? '#f97316' : '#3b82f6')} />
            ))}
          </Bar>
        </BarChart>
      );
      case '1': return wrap(<BarChart data={data} margin={{ top: 35, right: 5, left: 0, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Bar dataKey="value" fill={primaryColor} radius={[4, 4, 0, 0]} name="Qtd" isAnimationActive={false}>{labelList}</Bar></BarChart>);
      case '2': return wrap(<BarChart layout="vertical" data={data} margin={{ top: 0, right: 45, left: 0, bottom: 5 }}>{grid} <XAxis type="number" stroke="#94a3b8" fontSize={10} hide /><YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} tickLine={false} />{tooltip}<Bar dataKey="value" fill={secondaryColor} radius={[0, 4, 4, 0]} name="Qtd" isAnimationActive={false}><LabelList dataKey="value" position="right" fill="#475569" fontSize={9} fontWeight="bold" /></Bar></BarChart>);
      case '3': return wrap(<BarChart data={data} margin={{ top: 35, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Bar dataKey="value" fill={activeColors[2] || primaryColor} stackId="a" radius={[4, 4, 0, 0]} name="Qtd" isAnimationActive={false}>{labelList}</Bar></BarChart>);
      case '4': return wrap(<BarChart data={data} margin={{ top: 35, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Bar dataKey="value" name="Qtd" isAnimationActive={false}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />)}{labelList}</Bar></BarChart>);
      case '5': return wrap(<LineChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Line type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={3} dot={{r: 4, fill:'#fff', stroke:primaryColor}} activeDot={{ r: 6 }} name="Qtd" isAnimationActive={false}><LabelList dataKey="value" position="top" dy={-10} fill="#475569" fontSize={9} fontWeight="bold" /></Line></LineChart>);
      case '6': return wrap(<LineChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Line type="linear" dataKey="value" stroke={secondaryColor} strokeWidth={3} name="Qtd" isAnimationActive={false}><LabelList dataKey="value" position="top" dy={-10} fill="#475569" fontSize={9} fontWeight="bold" /></Line></LineChart>);
      case '7': return wrap(<LineChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Line type="step" dataKey="value" stroke={activeColors[2] || primaryColor} strokeWidth={3} name="Qtd" isAnimationActive={false} /></LineChart>);
      case '8': return wrap(<LineChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Line type="monotone" dataKey="value" stroke={activeColors[3] || secondaryColor} strokeDasharray="5 5" strokeWidth={3} name="Qtd" isAnimationActive={false} /></LineChart>);
      case '9': return wrap(<AreaChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}><defs><linearGradient id={`colorVal-${chartId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={primaryColor} stopOpacity={0.8}/><stop offset="95%" stopColor={primaryColor} stopOpacity={0}/></linearGradient></defs>{grid} {xAxis} {yAxis} {tooltip}<Area type="monotone" dataKey="value" stroke={primaryColor} fillOpacity={1} fill={`url(#colorVal-${chartId})`} name="Qtd" isAnimationActive={false}><LabelList dataKey="value" position="top" dy={-10} fill="#475569" fontSize={9} fontWeight="bold" /></Area></AreaChart>);
      case '10': return wrap(<AreaChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Area type="monotone" dataKey="value" stroke={secondaryColor} fill={secondaryColor} fillOpacity={0.3} name="Qtd" isAnimationActive={false} /></AreaChart>);
      case '11': return wrap(<AreaChart data={data} margin={{ top: 35, right: 10, left: 10, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Area type="monotone" dataKey="value" stackId="1" stroke={activeColors[4] || primaryColor} fill={activeColors[4] || primaryColor} name="Qtd" isAnimationActive={false} /></AreaChart>);
      case '12': return wrap(<PieChart margin={{ top: 10, bottom: 10 }}><Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" labelLine={false} nameKey="name" isAnimationActive={false}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />)}</Pie>{tooltip} {legend}</PieChart>);
      case '13': 
        const totalValue = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
        return wrap(<PieChart margin={{ top: 10, bottom: 10 }}><Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" nameKey="name" isAnimationActive={false}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />)}</Pie>{tooltip} {legend}<text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-700 text-2xl font-black drop-shadow-sm">{totalValue}</text></PieChart>);
      case '14': return wrap(<PieChart margin={{ top: 10, bottom: 10 }}><Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" paddingAngle={2} isAnimationActive={false}>{data.map((entry, index) => <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />)}</Pie>{tooltip} {legend}</PieChart>);
      case '15': return wrap(<RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" barSize={10} data={data} margin={{ top: 10, bottom: 10 }}><RadialBar label={{ position: 'insideStart', fill: '#475569' }} background dataKey="value" isAnimationActive={false} />{legend} {tooltip}</RadialBarChart>);
      case '16': return wrap(<RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} margin={{ top: 10, bottom: 10 }}><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} /><PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} /><Radar name="Qtd" dataKey="value" stroke={primaryColor} strokeWidth={2} fill={primaryColor} fillOpacity={0.1} isAnimationActive={false} />{tooltip}</RadarChart>);
      case '17': return wrap(<RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} margin={{ top: 10, bottom: 10 }}><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} /><PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} /><Radar name="Qtd" dataKey="value" stroke={secondaryColor} strokeWidth={1} fill={secondaryColor} fillOpacity={0.6} isAnimationActive={false} />{tooltip}</RadarChart>);
      case '18': return wrap(<ComposedChart data={data} margin={{ top: 35, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Bar dataKey="value" fill={activeColors[2] || primaryColor} barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>{labelList}</Bar><Line type="monotone" dataKey="value" stroke={secondaryColor} strokeWidth={2} dot={{r:3}} isAnimationActive={false} /></ComposedChart>);
      case '19': return wrap(<ComposedChart data={data} margin={{ top: 35, bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Area type="monotone" dataKey="value" fill={primaryColor} fillOpacity={0.2} stroke="none" isAnimationActive={false} /><Line type="monotone" dataKey="value" stroke="#64748b" strokeWidth={2} dot={false} isAnimationActive={false}><LabelList dataKey="value" position="top" dy={-10} fill="#475569" fontSize={9} fontWeight="bold" /></Line></ComposedChart>);
      case '20': return wrap(<ScatterChart margin={{ bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<Scatter name="Qtd" data={data} fill={activeColors[6] || secondaryColor} isAnimationActive={false} /></ScatterChart>);
      case '21': return wrap(<ScatterChart margin={{ bottom: 25 }}>{grid} {xAxis} {yAxis} {tooltip}<ZAxis dataKey="value" range={[60, 400]} name="Volume" /><Scatter name="Qtd" data={data} fill={activeColors[5] || primaryColor} isAnimationActive={false} /></ScatterChart>);
      default: return <p className="text-gray-500 text-xs p-4">Selecione um gráfico</p>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
         <h3 className="text-slate-800 font-bold text-lg flex items-center gap-2">
            <Settings2 size={18} className="text-risel-green"/> Gráficos Personalizáveis
            {isCloudSaving && (
                 <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
                     <Cloud size={12}/> Salvando...
                 </span>
            )}
         </h3>
         <button onClick={resetLayout} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors">
            <RefreshCw size={12}/> Restaurar Padrão
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {configs.filter(c => c.visible).map((config, index) => {
          const chartData = dataMap[config.id as keyof typeof dataMap];
          
          if (!chartData || chartData.length === 0) return null;

          return (
            <div
              key={config.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-white rounded-2xl p-5 relative group transition-all duration-300 border border-slate-200 shadow-sm ${config.id === 'evolucao_mensal' ? 'col-span-1 lg:col-span-2 shadow-md border-emerald-900/10 ring-1 ring-emerald-500/10' : ''} ${draggedItemIndex === index ? 'opacity-50 scale-95 border-risel-green border-dashed' : 'opacity-100 hover:shadow-md'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 cursor-move">
                    <GripVertical size={16} className="text-slate-400 hover:text-slate-600 transition-colors" />
                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
                      {config.title}
                      {config.id === 'evolucao_mensal' && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full lowercase first-letter:uppercase">
                          visão cronológica ampliada
                        </span>
                      )}
                    </h4>
                </div>
                
                {/* Evolution Chart Granularity Controls */}
                {config.id === 'evolucao_mensal' && (
                    <div className="flex bg-slate-100 rounded-lg p-0.5 ml-auto mr-2">
                        {(['day', 'week', 'month', 'quarter'] as const).map(g => (
                            <button 
                                key={g}
                                onClick={() => setEvolutionGranularity(g)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${evolutionGranularity === g ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {g === 'day' ? 'Dia' : (g === 'week' ? 'Semana' : (g === 'month' ? 'Mês' : 'Trimestre'))}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <div className="relative group/color">
                        <select 
                            value={config.colorTheme || 'default'}
                            onChange={(e) => updateChartColor(config.id, e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-xs text-slate-600 rounded px-2 py-1 pl-6 focus:outline-none focus:border-risel-green cursor-pointer w-28"
                        >
                            {Object.keys(COLOR_THEMES).map(theme => <option key={theme} value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>)}
                        </select>
                        <Palette size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>

                    <div className="relative group/select">
                        <select 
                            value={config.type} 
                            onChange={(e) => updateChartType(config.id, e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-xs text-slate-600 rounded px-2 py-1 pr-6 focus:outline-none focus:border-risel-green cursor-pointer w-32 truncate"
                        >
                            {['Especiais', 'Barras', 'Linhas', 'Área', 'Circular', 'Radar', 'Misto', 'Outros'].map(group => (
                                <optgroup key={group} label={group}>
                                    {CHART_TYPES.filter(t => t.group === group).map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>

                    <button onClick={() => toggleVisibility(config.id)} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Ocultar Gráfico"><X size={16} /></button>
                </div>
              </div>

              <div className={`${config.id === 'evolucao_mensal' ? 'h-[330px] min-h-[330px]' : 'h-[260px] min-h-[260px]'} w-full min-w-0 overflow-hidden`}>
                   {renderChart(config.type, chartData, config.colorTheme, config.id)}
              </div>
            </div>
          );
        })}

        {configs.some(c => !c.visible) && (
             <div className="col-span-1 lg:col-span-2 flex flex-wrap gap-2 justify-center py-4 border-t border-slate-100">
                 <span className="text-xs text-slate-400 w-full text-center mb-2">Gráficos Ocultos (Clique para adicionar):</span>
                 {configs.filter(c => !c.visible).map(c => (
                     <button 
                        key={c.id} 
                        onClick={() => toggleVisibility(c.id)}
                        className="bg-white hover:bg-green-50 hover:text-risel-green border border-slate-200 hover:border-green-200 text-slate-500 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                     >
                        <PlusIcon /> {c.title}
                     </button>
                 ))}
             </div>
        )}
      </div>
    </div>
  );
};

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);

export default DashboardCharts;

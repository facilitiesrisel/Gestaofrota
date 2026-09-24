import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import Sidebar from './frota-pesada/components/Sidebar';
import FrotasPage from './frota-pesada/pages/FrotasPage';
import MotoristasPage from './frota-pesada/pages/MotoristasPage';
import MultasPage from './frota-pesada/pages/MultasPage';
import AlertasPage from './frota-pesada/pages/AlertasPage';
import ConfigPage from './frota-pesada/pages/ConfigPage';
import Loading from './frota-pesada/components/Loading';
import DashboardCharts from './frota-pesada/components/DashboardCharts';
import { SinistrosDashboard } from './frota-pesada/components/SinistrosDashboard';
import { SinistrosPage } from './frota-pesada/pages/SinistrosPage';
import { fetchSinistros } from './frota-pesada/services/sinistrosService';
import { Page, Sinistro } from './frota-pesada/types';
import { 
  Truck, 
  Siren, 
  Calendar, 
  FileText, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  CheckCircle2, 
  ArrowLeft,
  ArrowRight,
  Users,
  LayoutGrid,
  ShieldAlert
} from 'lucide-react';
import { fetchAllData } from './frota-pesada/services/storage';
import { useAuth } from '../context/AuthContext';
import { UserProfileBadge } from '../components/UserProfileBadge';

// Temas visuais dos cards inspirados no padrão de excelência de Frota Leve
const CARD_THEMES = {
  rose: {
    bgBlur: "bg-rose-500",
    gradientBg: "from-white via-rose-50/25 to-rose-500/[0.04]",
    glowColor: "group-hover:shadow-rose-200/50 border-rose-100/80 hover:border-rose-300",
    iconContainer: "bg-gradient-to-br from-rose-50 to-rose-100/60 border-rose-200/60 text-rose-600 group-hover:from-rose-500 group-hover:to-red-500 group-hover:text-white",
    textAccent: "text-rose-600 group-hover:text-rose-700"
  },
  emerald: {
    bgBlur: "bg-emerald-500",
    gradientBg: "from-white via-emerald-50/25 to-emerald-500/[0.04]",
    glowColor: "group-hover:shadow-emerald-200/50 border-emerald-100/80 hover:border-emerald-300",
    iconContainer: "bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/60 text-emerald-600 group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white",
    textAccent: "text-emerald-600 group-hover:text-emerald-700"
  },
  blue: {
    bgBlur: "bg-blue-500",
    gradientBg: "from-white via-blue-50/25 to-blue-500/[0.04]",
    glowColor: "group-hover:shadow-blue-200/50 border-blue-100/80 hover:border-blue-300",
    iconContainer: "bg-gradient-to-br from-blue-50 to-blue-100/60 border-blue-200/60 text-blue-600 group-hover:from-blue-500 group-hover:to-indigo-500 group-hover:text-white",
    textAccent: "text-blue-600 group-hover:text-blue-700"
  }
};

interface SubModuleCardProps {
  title: string;
  badge?: string;
  description: string;
  icon: any;
  onClick: () => void;
  theme: 'rose' | 'emerald' | 'blue';
  delay: number;
}

function SubModuleCard({ title, badge, description, icon: Icon, onClick, theme, delay }: SubModuleCardProps) {
  const selectedTheme = CARD_THEMES[theme] || CARD_THEMES.emerald;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20, 
        delay: delay * 0.25 
      }}
      className="h-full"
    >
      <button 
        onClick={onClick} 
        className="w-full text-left block group h-full cursor-pointer focus:outline-none"
      >
        <div className={`rounded-2xl p-5 border shadow-sm transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between bg-white/90 backdrop-blur-md hover:bg-white bg-gradient-to-br ${selectedTheme.gradientBg} ${selectedTheme.glowColor}`}>
          <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-15 transition-all duration-500 group-hover:opacity-30 group-hover:scale-110 ${selectedTheme.bgBlur}`} />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border transition-all duration-300 group-hover:scale-105 relative z-10 ${selectedTheme.iconContainer}`}>
                <Icon className="w-6 h-6" />
              </div>
              {badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100/90 border border-slate-200/80 text-slate-700 relative z-10 shadow-2xs">
                  {badge}
                </span>
              )}
            </div>
            
            <h2 className="text-base font-display font-bold text-slate-800 mb-1.5 relative z-10">{title}</h2>
            <p className="text-slate-500 leading-relaxed mb-4 text-[11px] font-medium relative z-10 line-clamp-3">{description}</p>
          </div>
          
          <div className={`inline-flex items-center gap-1.5 font-black tracking-wide uppercase text-[10px] transition-colors mt-auto relative z-10 ${selectedTheme.textAccent}`}>
            <span>Acessar área operacional</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export default function FrotaPesada() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Submódulo ativo vindo de searchParams: ?sub=infracoes | ?sub=frotas | ?sub=motoristas | ?sub=sinistros | ?sub=config
  // Se não houver ?sub, o portal com os cards separados é apresentado!
  const currentSub = searchParams.get('sub');

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    if (currentSub === 'frotas') return 'FROTAS';
    if (currentSub === 'motoristas') return 'MOTORISTAS';
    if (currentSub === 'sinistros') return 'SINISTROS_DASHBOARD';
    if (currentSub === 'config') return 'CONFIG';
    return 'DASHBOARD';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [rawMultas, setRawMultas] = useState<any[]>([]);
  const [rawVeiculos, setRawVeiculos] = useState<any[]>([]);
  const [rawSinistros, setRawSinistros] = useState<Sinistro[]>([]);

  // Filter State: '' means "All Months"
  const [selectedMonth, setSelectedMonth] = useState('');

  // Sincroniza página quando query parameter 'sub' é alterado
  useEffect(() => {
    if (currentSub === 'frotas') {
      setCurrentPage('FROTAS');
    } else if (currentSub === 'motoristas') {
      setCurrentPage('MOTORISTAS');
    } else if (currentSub === 'sinistros') {
      if (currentPage !== 'SINISTROS' && currentPage !== 'SINISTROS_DASHBOARD') {
        setCurrentPage('SINISTROS_DASHBOARD');
      }
    } else if (currentSub === 'config') {
      setCurrentPage('CONFIG');
    } else if (currentSub === 'infracoes') {
      if (currentPage === 'FROTAS' || currentPage === 'MOTORISTAS' || currentPage === 'CONFIG' || currentPage === 'SINISTROS_DASHBOARD' || currentPage === 'SINISTROS') {
        setCurrentPage('DASHBOARD');
      }
    }
  }, [currentSub]);

  const handleSelectSubmodule = (sub: 'infracoes' | 'frotas' | 'motoristas' | 'sinistros', defaultPage: Page) => {
    setCurrentPage(defaultPage);
    setSearchParams({ sub });
  };

  const handleBackToPortal = () => {
    setSearchParams({});
  };

  const handleNavigatePage = (page: Page) => {
    setCurrentPage(page);
    if (page === 'DASHBOARD' || page === 'MULTAS' || page === 'ALERTAS') {
      setSearchParams({ sub: 'infracoes' });
    } else if (page === 'FROTAS') {
      setSearchParams({ sub: 'frotas' });
    } else if (page === 'MOTORISTAS') {
      setSearchParams({ sub: 'motoristas' });
    } else if (page === 'SINISTROS_DASHBOARD' || page === 'SINISTROS') {
      setSearchParams({ sub: 'sinistros' });
    } else if (page === 'CONFIG') {
      setSearchParams({ sub: 'config' });
    }
  };

  // Carrega dados iniciais e recarrega ao voltar para o Dashboard
  useEffect(() => {
    const loadData = async () => {
      // Carregar sinistros quando estiver na área de sinistros ou no portal
      if (!currentSub || currentSub === 'sinistros' || currentPage === 'SINISTROS_DASHBOARD' || currentPage === 'SINISTROS') {
        try {
          const sinData = await fetchSinistros();
          setRawSinistros(sinData || []);
        } catch (err) {
          console.warn("Aviso ao carregar sinistros:", err);
        }
      }

      if (currentPage === 'DASHBOARD') {
        setLoading(true);
        try {
          const data = await fetchAllData(false);
          setRawMultas(data.multas || []);
          setRawVeiculos(data.veiculos || []);
        } catch (error) {
          console.error("Erro ao carregar dados de Frota Pesada:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [currentPage, currentSub]);

  // --- EXTRACT AVAILABLE MONTHS ---
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawMultas.forEach(m => {
      if (m.dataHoraInfracao && m.dataHoraInfracao.length >= 7) {
        months.add(m.dataHoraInfracao.substring(0, 7)); // YYYY-MM
      }
    });
    // Sort descending (newest first)
    return Array.from(months).sort().reverse().map(m => {
      const [year, month] = m.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { value: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [rawMultas]);

  // --- FILTERED DATA FOR CHARTS ---
  const filteredMultasForCharts = useMemo(() => {
    if (selectedMonth === '') {
      return rawMultas;
    }
    const [year, month] = selectedMonth.split('-').map(Number);
    return rawMultas.filter(m => {
      if (!m.dataHoraInfracao) return false;
      const d = new Date(m.dataHoraInfracao);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  }, [rawMultas, selectedMonth]);

  // --- DASHBOARD CALCULATIONS ---
  const dashboardMetrics = useMemo(() => {
    const currentMultas = filteredMultasForCharts;
    const qtdMultas = currentMultas.length;
    const valorTotal = currentMultas.reduce((acc, m) => acc + (Number(m.valorComDesconto) || Number(m.valor) || 0), 0);

    const totalVeiculos = rawVeiculos.length;
    const activeVeiculos = rawVeiculos.filter(v => !v.status || v.status.toUpperCase() === 'ATIVO');
    const totalFrotasAtivas = activeVeiculos.length || 1;
    
    const mediaMultasPorFrota = qtdMultas / totalFrotasAtivas;

    const placasMultadas = new Set(currentMultas.map(m => m.placa));
    const activeFleetsWithFines = activeVeiculos.filter(v => placasMultadas.has(v.placa)).length;
    
    const qtdFrotasComMulta = activeFleetsWithFines;
    const percentFrotasComMulta = (qtdFrotasComMulta / totalFrotasAtivas) * 100;

    const qtdFrotasSemMulta = Math.max(0, totalFrotasAtivas - qtdFrotasComMulta);
    const percentFrotasSemMulta = (qtdFrotasSemMulta / totalFrotasAtivas) * 100;

    let percentChange = 0;
    let showTrend = false;
    if (selectedMonth !== '') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth() + 1;
      
      const prevMonthMultas = rawMultas.filter(m => {
        if (!m.dataHoraInfracao) return false;
        const d = new Date(m.dataHoraInfracao);
        return d.getFullYear() === prevYear && (d.getMonth() + 1) === prevMonth;
      });
      const qtdMultasPrev = prevMonthMultas.length;
      if (qtdMultasPrev > 0) {
        percentChange = ((qtdMultas - qtdMultasPrev) / qtdMultasPrev) * 100;
      } else if (qtdMultas > 0) {
        percentChange = 100; 
      }
      showTrend = true;
    }

    return {
      qtdMultas,
      valorTotal,
      percentChange,
      showTrend,
      totalVeiculos,
      totalFrotasAtivas,
      mediaMultasPorFrota,
      qtdFrotasComMulta,
      percentFrotasComMulta,
      qtdFrotasSemMulta,
      percentFrotasSemMulta
    };
  }, [rawMultas, rawVeiculos, selectedMonth, filteredMultasForCharts]);

  const renderContent = () => {
    switch (currentPage) {
      case 'DASHBOARD':
        return (
          <div className="animate-in fade-in space-y-6 relative h-full overflow-auto custom-scrollbar pb-10">
            {loading && <Loading />}
            
            {/* STICKY CONTAINER FOR HEADER AND CARDS - REFINED TYPOGRAPHY */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pb-4 pt-3 px-3 -mx-1 shadow-2xs transition-all rounded-b-2xl">
              {/* Header Dashboard with Filter */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 px-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[9.5px] font-black uppercase tracking-wider">
                      Módulo Frota Pesada
                    </span>
                    <span className="text-xs text-slate-300">&bull;</span>
                    <span className="text-[11px] font-semibold text-slate-500">Logística Risel Combustíveis</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">Dashboard Analítico</h2>
                  <p className="text-slate-500 font-medium text-[11px] leading-tight">Monitoramento de infrações, custos e performance da frota pesada</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-blue-600">
                    <Calendar size={15} />
                  </div>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-slate-700 font-bold text-xs outline-none border-none py-1 px-1 focus:ring-0 cursor-pointer w-44"
                  >
                    <option value="">Todos os meses</option>
                    {availableMonths.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DASHBOARD METRICS GRID - PADRONIZADO COM O CONTROLE DE FROTA LEVE */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 px-2">
                
                {/* CARD 1: Quantidade de Multas */}
                <div className="p-3 rounded-xl border border-blue-150/80 hover:border-blue-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-blue-50/20 to-blue-500/[0.04] min-h-[78px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
                      Qtd. de Multas
                    </span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-blue-200/50 bg-blue-50 text-blue-600">
                      <FileText className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base sm:text-lg font-display font-black bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent block tracking-tight leading-none">
                      {dashboardMetrics.qtdMultas}
                    </span>
                    {dashboardMetrics.showTrend ? (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full border ${dashboardMetrics.percentChange > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {dashboardMetrics.percentChange > 0 ? '+' : ''}{dashboardMetrics.percentChange.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400">Total</span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                    Média: {dashboardMetrics.mediaMultasPorFrota.toFixed(2)}/veículo
                  </span>
                </div>

                {/* CARD 2: Valor Total Estimado */}
                <div className="p-3 rounded-xl border border-amber-150/80 hover:border-amber-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-amber-50/20 to-amber-500/[0.04] min-h-[78px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
                      Valor Estimado
                    </span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-amber-200/50 bg-amber-50 text-amber-600">
                      <DollarSign className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-display font-black bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent block tracking-tight leading-none truncate">
                      {dashboardMetrics.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                      Total com desconto/nominal
                    </span>
                  </div>
                </div>

                {/* CARD 3: Total de Frotas */}
                <div className="p-3 rounded-xl border border-indigo-150/80 hover:border-indigo-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-indigo-50/20 to-indigo-500/[0.04] min-h-[78px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
                      Frota Pesada Total
                    </span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-indigo-200/50 bg-indigo-50 text-indigo-600">
                      <Truck className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base sm:text-lg font-display font-black bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent block tracking-tight leading-none">
                      {dashboardMetrics.totalVeiculos}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                      {dashboardMetrics.totalFrotasAtivas} ativos
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                    Caminhões e cavalos cadastrados
                  </span>
                </div>

                {/* CARD 4: Frotas COM Multas */}
                <div className="p-3 rounded-xl border border-rose-150/80 hover:border-rose-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-rose-50/20 to-rose-500/[0.04] min-h-[78px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
                      Frotas c/ Multas
                    </span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-rose-200/50 bg-rose-50 text-rose-600">
                      <Siren className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base sm:text-lg font-display font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent block tracking-tight leading-none">
                      {dashboardMetrics.qtdFrotasComMulta}
                    </span>
                    <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200/60">
                      {dashboardMetrics.percentFrotasComMulta.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{ width: `${Math.min(dashboardMetrics.percentFrotasComMulta, 100)}%` }}
                    />
                  </div>
                </div>

                {/* CARD 5: Frotas SEM Multas */}
                <div className="p-3 rounded-xl border border-emerald-150/80 hover:border-emerald-300 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-500/[0.04] min-h-[78px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block leading-tight">
                      Frotas s/ Multas
                    </span>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border border-emerald-200/50 bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base sm:text-lg font-display font-black bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent block tracking-tight leading-none">
                      {dashboardMetrics.qtdFrotasSemMulta}
                    </span>
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                      {dashboardMetrics.percentFrotasSemMulta.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(dashboardMetrics.percentFrotasSemMulta, 100)}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* DYNAMIC CHARTS SECTION */}
            <div className="mt-6 px-2">
              <DashboardCharts multas={filteredMultasForCharts} />
            </div>

            {/* Quick Actions Strip Padronizada */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 px-2">
              <button 
                onClick={() => handleNavigatePage('MULTAS')} 
                className="bg-white p-3.5 rounded-xl flex items-center gap-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all text-xs font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                  <Siren size={18}/>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800">Lançamento de Multas</p>
                  <p className="text-[10px] text-slate-400 font-medium">Submódulo Infrações</p>
                </div>
              </button>

              <button 
                onClick={() => handleNavigatePage('FROTAS')} 
                className="bg-white p-3.5 rounded-xl flex items-center gap-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all text-xs font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                  <Truck size={18}/>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800">Submódulo Frotas</p>
                  <p className="text-[10px] text-slate-400 font-medium">Custos de Multas por Placa</p>
                </div>
              </button>

              <button 
                onClick={() => handleNavigatePage('MOTORISTAS')} 
                className="bg-white p-3.5 rounded-xl flex items-center gap-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all text-xs font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  <Users size={18}/>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800">Submódulo Motoristas</p>
                  <p className="text-[10px] text-slate-400 font-medium">Base Geral de Condutores</p>
                </div>
              </button>
            </div>
          </div>
        );
      case 'MULTAS':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 h-full shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <MultasPage />
          </div>
        );
      case 'ALERTAS':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 h-full shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <AlertasPage />
          </div>
        );
      case 'FROTAS':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 h-full shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <FrotasPage />
          </div>
        );
      case 'MOTORISTAS':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 h-full shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <MotoristasPage />
          </div>
        );
      case 'SINISTROS_DASHBOARD':
        return (
          <div className="bg-transparent h-full flex flex-col overflow-hidden">
            <SinistrosDashboard
              sinistros={rawSinistros}
              onNavigateToSinistros={() => handleNavigatePage('SINISTROS')}
              onOpenNewSinistroModal={() => handleNavigatePage('SINISTROS')}
              onRefreshData={async () => {
                try {
                  const fresh = await fetchSinistros();
                  setRawSinistros(fresh || []);
                } catch (e) {}
              }}
            />
          </div>
        );
      case 'SINISTROS':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-6 h-full shadow-lg border border-slate-200 flex flex-col overflow-hidden">
            <SinistrosPage />
          </div>
        );
      case 'CONFIG':
        return (
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 h-full shadow-lg border border-slate-200 overflow-auto">
            <ConfigPage />
          </div>
        );
      default:
        return <div>Página não encontrada</div>;
    }
  };

  // --- SE NENHUM SUBMÓDULO ESTIVER SELECIONADO: EXIBE PORTAL EM 3 CARDS SEPARADOS ---
  if (!currentSub || currentSub === 'portal') {
    return (
      <div className="min-h-screen relative flex flex-col justify-between p-4 sm:p-6 lg:px-8 lg:pt-6 lg:pb-12 bg-slate-100/80 overflow-x-hidden text-slate-800 font-sans">
        {/* Imagem de Fundo com Transparência Elegante */}
        <div 
          className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat opacity-25"
          style={{
            backgroundImage: `url('https://i.ibb.co/vvh5kBgG/f-UNDO-SISTEMA.jpg')`,
          }}
        />
        {/* Camada de gradiente e desfoque suave */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-slate-50/70 via-slate-50/40 to-slate-100/80 backdrop-blur-[1px]" />

        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col justify-start">
          {/* Barra Superior com Retorno e Identificação */}
          <div className="flex justify-between items-center mb-6 sm:mb-8 px-1">
            <button 
              onClick={() => navigate("/")} 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 bg-white/90 backdrop-blur-md hover:bg-white border border-slate-200/80 transition-all duration-300 shadow-xs hover:shadow-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Início
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase hidden sm:inline bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                Risel ERP · Frota Pesada
              </span>
              <UserProfileBadge />
            </div>
          </div>

          {/* Hero Header Padronizado */}
          <div className="text-center mb-7 sm:mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 mx-auto mb-2.5"
            >
              <Truck className="w-6 h-6 sm:w-6.5 sm:h-6.5" />
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-slate-900 tracking-tight"
            >
              Módulo de <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent">Controle de Frota Pesada</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-2xl mx-auto font-medium leading-relaxed"
            >
              Selecione uma das áreas operacionais abaixo para gerenciar infrações, acompanhar a frota de caminhões com custos por placa, consultar a base de condutores ou gerenciar sinistros e avarias.
            </motion.p>
          </div>

          {/* Grid com os 4 Cards Separados Padronizados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch max-w-6xl mx-auto">
            <SubModuleCard
              title="Infrações de Trânsito"
              badge="Dashboard, Multas & Alertas"
              description="Acompanhamento analítico de multas pesadas, gestão de autos de infração (AIT), prazos de defesa prévia, recursos e alertas de vencimento."
              icon={Siren}
              onClick={() => handleSelectSubmodule('infracoes', 'DASHBOARD')}
              theme="rose"
              delay={0.1}
            />

            <SubModuleCard
              title="Frotas"
              badge="Gestão & Custo por Placa"
              description="Gestão de caminhões, carretas e cavalos mecânicos com padrão de placas Mercosul, filiais, bases operacionais, locadoras e custos consolidados."
              icon={Truck}
              onClick={() => handleSelectSubmodule('frotas', 'FROTAS')}
              theme="emerald"
              delay={0.2}
            />

            <SubModuleCard
              title="Motoristas"
              badge="Base de Condutores"
              description="Cadastro e consulta da equipe de motoristas da frota pesada, acompanhamento de pontuação na CNH, autuações e termos de desconto em folha."
              icon={Users}
              onClick={() => handleSelectSubmodule('motoristas', 'MOTORISTAS')}
              theme="blue"
              delay={0.3}
            />

            <SubModuleCard
              title="Sinistros"
              badge="Ocorrências & Seguros"
              description="Registro detalhado de acidentes e avarias, dinâmicas periciais, pastas automáticas no Google Drive e controle de franquias e seguradoras."
              icon={ShieldAlert}
              onClick={() => handleSelectSubmodule('sinistros', 'SINISTROS_DASHBOARD')}
              theme="rose"
              delay={0.4}
            />
          </div>

          {/* Retorno ao Menu Geral */}
          <div className="text-center mt-8">
            <button 
              onClick={() => navigate("/")} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200/80 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-emerald-700 hover:bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Retornar ao Menu Principal
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <footer className="relative z-10 max-w-6xl w-full mx-auto text-center pt-8 text-[11px] text-slate-400 font-medium">
          Risel Combustíveis Ltda. &bull; Controle de Frota Pesada
        </footer>
      </div>
    );
  }

  // --- SUBMÓDULO ATIVO ---
  // Menu lateral padronizado para todos os submódulos da Frota Pesada (estilo Frota Leve)
  const isSidebarVisible = Boolean(currentSub && currentSub !== 'portal');

  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-emerald-200 selection:text-emerald-900 text-slate-800 bg-slate-100">
      {/* Sidebar renderizado para os submódulos da Frota Pesada com visual idêntico ao Controle de Frota Leve */}
      {isSidebarVisible && (
        <Sidebar 
          currentSub={currentSub}
          currentPage={currentPage} 
          onNavigate={handleNavigatePage} 
          isOpen={isSidebarOpen} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          onLogout={() => navigate('/')} 
          onBackToPortal={handleBackToPortal}
        />
      )}
      
      <main className="flex-1 overflow-hidden transition-all duration-300 relative z-10 flex flex-col min-w-0">
        {/* CABEÇALHO SUPERIOR PADRONIZADO COM O MÓDULO DE FROTA LEVE */}
        <div className="shrink-0 bg-slate-50 px-3 sm:px-4 pt-2 pb-2.5 border-b border-slate-200/80 shadow-2xs space-y-2">
          {/* Top Header Card: Identidade à Esquerda e Usuário Logado no Topo Superior Direito */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs relative">
            {/* Lado Esquerdo: Identidade Visual e Breadcrumbs */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xs shadow-emerald-600/20 shrink-0">
                <Truck className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <button 
                    onClick={() => navigate("/")} 
                    className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-2.5 h-2.5" /> Início
                  </button>
                  <span className="text-[10px] text-slate-300">/</span>
                  <button 
                    onClick={handleBackToPortal} 
                    className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer bg-transparent border-none p-0 outline-none"
                  >
                    Portal Frota Pesada
                  </button>
                  <span className="text-[10px] text-slate-300">/</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    {currentSub === 'infracoes' ? 'Infrações' : currentSub === 'frotas' ? 'Frotas' : currentSub === 'motoristas' ? 'Motoristas' : currentSub === 'sinistros' ? 'Sinistros' : 'Config'}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-display font-black text-slate-800 tracking-tight leading-tight mt-0.5">
                  {currentSub === 'infracoes' && (
                    currentPage === 'DASHBOARD' ? 'Infrações de Trânsito · Dashboard Analítico' :
                    currentPage === 'MULTAS' ? 'Infrações de Trânsito · Gestão de Multas & AIT' :
                    currentPage === 'ALERTAS' ? 'Infrações de Trânsito · Prazos & Alertas' :
                    'Infrações de Trânsito'
                  )}
                  {currentSub === 'frotas' && 'Gestão de Frotas & Custo por Placa'}
                  {currentSub === 'motoristas' && 'Base de Condutores & Motoristas'}
                  {currentSub === 'sinistros' && (
                    currentPage === 'SINISTROS_DASHBOARD' ? 'Sinistros & Avarias · Dashboard Analítico' :
                    currentPage === 'SINISTROS' ? 'Sinistros & Avarias · Lista Geral de Ocorrências' :
                    'Sinistros & Avarias'
                  )}
                  {currentSub === 'config' && 'Configurações de Frota Pesada'}
                </h1>
              </div>
            </div>

            {/* Canto Superior Direito: Dados do Usuário Logado */}
            <div className="flex items-center justify-end shrink-0 gap-2">
              <UserProfileBadge />
            </div>
          </div>

          {/* Barra de Menus / Abas da Frota Logo Embaixo (Padrão idêntico ao Controle de Frota Leve) */}
          <div className="flex items-center overflow-x-auto gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0">
            {/* Menu da Frota (Retorno aos Cards Operacionais) */}
            <button
              onClick={handleBackToPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all cursor-pointer"
              title="Ver Cards dos Submódulos"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span className="whitespace-nowrap">Menu da Frota</span>
            </button>

            {/* Infrações de Trânsito */}
            <button
              onClick={() => handleSelectSubmodule('infracoes', 'DASHBOARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                currentSub === 'infracoes'
                  ? "bg-white text-rose-600 shadow-2xs border border-rose-200/80 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Siren className={`w-3.5 h-3.5 shrink-0 ${currentSub === 'infracoes' ? "text-rose-600" : "text-slate-400"}`} />
              <span className="whitespace-nowrap">Infrações de Trânsito</span>
            </button>

            {/* Frotas */}
            <button
              onClick={() => handleSelectSubmodule('frotas', 'FROTAS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                currentSub === 'frotas'
                  ? "bg-white text-emerald-600 shadow-2xs border border-emerald-200/80 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Truck className={`w-3.5 h-3.5 shrink-0 ${currentSub === 'frotas' ? "text-emerald-600" : "text-slate-400"}`} />
              <span className="whitespace-nowrap">Frotas</span>
            </button>

            {/* Motoristas */}
            <button
              onClick={() => handleSelectSubmodule('motoristas', 'MOTORISTAS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                currentSub === 'motoristas'
                  ? "bg-white text-blue-600 shadow-2xs border border-blue-200/80 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Users className={`w-3.5 h-3.5 shrink-0 ${currentSub === 'motoristas' ? "text-blue-600" : "text-slate-400"}`} />
              <span className="whitespace-nowrap">Motoristas</span>
            </button>

            {/* Sinistros */}
            <button
              onClick={() => handleSelectSubmodule('sinistros', 'SINISTROS_DASHBOARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                currentSub === 'sinistros'
                  ? "bg-white text-rose-600 shadow-2xs border border-rose-200/80 font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${currentSub === 'sinistros' ? "text-rose-600" : "text-slate-400"}`} />
              <span className="whitespace-nowrap">Sinistros</span>
            </button>

            {/* Sub-abas de acesso direto para Infrações */}
            {currentSub === 'infracoes' && (
              <div className="ml-auto hidden md:flex items-center gap-1 bg-white/70 px-1.5 py-0.5 rounded-lg border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Telas:</span>
                <button
                  onClick={() => handleNavigatePage('DASHBOARD')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentPage === 'DASHBOARD' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleNavigatePage('MULTAS')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentPage === 'MULTAS' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Multas
                </button>
                <button
                  onClick={() => handleNavigatePage('ALERTAS')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentPage === 'ALERTAS' ? 'bg-rose-500 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Alertas
                </button>
              </div>
            )}

            {/* Sub-abas de acesso direto para Sinistros */}
            {currentSub === 'sinistros' && (
              <div className="ml-auto hidden md:flex items-center gap-1 bg-white/70 px-1.5 py-0.5 rounded-lg border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Telas:</span>
                <button
                  onClick={() => handleNavigatePage('SINISTROS_DASHBOARD')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentPage === 'SINISTROS_DASHBOARD' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleNavigatePage('SINISTROS')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    currentPage === 'SINISTROS' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sinistros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo da Tela */}
        <div className="p-3 sm:p-4 md:p-5 w-full mx-auto flex-1 overflow-hidden min-h-0 flex flex-col">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

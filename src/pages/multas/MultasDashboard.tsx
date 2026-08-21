
import React, { useState, useEffect, useMemo } from 'react';
import MultasPage from './pages/MultasPage';
import AlertasPage from './pages/AlertasPage'; // Import AlertasPage
import ConfigPage from './pages/ConfigPage';
import Loading from './components/Loading';
import DashboardCharts from './components/DashboardCharts';
import { Page } from './types';
import { Truck, Siren, AlertOctagon, TrendingUp, Calendar, CheckCircle, XCircle, FileText, ArrowUpRight, ArrowDownRight, Car, DollarSign, CheckCircle2, BarChart3 } from 'lucide-react';
import { fetchAllData } from './services/storage';
import { parseLocalDate } from './services/dateUtils';

interface MultasDashboardProps {
  activePage: string;
}

const MultasDashboard: React.FC<MultasDashboardProps> = ({ activePage }) => {
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [rawMultas, setRawMultas] = useState<any[]>([]);
  const [rawVeiculos, setRawVeiculos] = useState<any[]>([]);

  // Filter State: '' means "All Months"
  const [selectedMonth, setSelectedMonth] = useState('');

  // Carrega dados iniciais e recarrega ao voltar para o Dashboard
  useEffect(() => {
    

    const loadData = async () => {
      // Se estiver no Dashboard, recarrega para garantir dados frescos (contagem de ativos/inativos)
      if (activePage.toUpperCase() === 'DASHBOARD' || activePage === 'infrações' || activePage === 'recursos') {
          setLoading(true);
          // fetchAllData(false) usa cache se disponível, mas se você editou algo em outra tela,
          // o cache foi invalidado lá, garantindo que aqui pegue o dado novo.
          const data = await fetchAllData(false); 
          setRawMultas(data.multas);
          setRawVeiculos(data.veiculos);
          setLoading(false);
      }
    };
    loadData();
  }, [activePage]);  // --- EXTRACT AVAILABLE MONTHS ---
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      rawMultas.forEach(m => {
          const d = parseLocalDate(m.dataHoraInfracao);
          if (d) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              months.add(`${year}-${month}`);
          }
      });
      // Sort chronologically (ascending, oldest first)
      return Array.from(months).sort().map(m => {
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
        const d = parseLocalDate(m.dataHoraInfracao);
        return d && d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  }, [rawMultas, selectedMonth]);

  // --- DASHBOARD CALCULATIONS ---
  const dashboardMetrics = useMemo(() => {
    // 1. Current Data (Filtered)
    const currentMultas = filteredMultasForCharts;
    const qtdMultas = currentMultas.length;
    const valorTotal = currentMultas.reduce((acc, m) => acc + (m.valorComDesconto || m.valor || 0), 0);

    // 2. Metrics Calculation
    const totalVeiculos = rawVeiculos.length;
    const activeVeiculos = rawVeiculos.filter(v => !v.status || v.status.toUpperCase() === 'ATIVO');
    const totalFrotasAtivas = activeVeiculos.length;
    
    const mediaMultasPorFrota = totalFrotasAtivas > 0 ? qtdMultas / totalFrotasAtivas : 0;

    // Frotas com Multas (Considerando apenas veículos ativos que tomaram multa)
    const placasMultadas = new Set(currentMultas.map(m => m.placa));
    const activeFleetsWithFines = activeVeiculos.filter(v => placasMultadas.has(v.placa)).length;
    
    const qtdFrotasComMulta = activeFleetsWithFines;
    const percentFrotasComMulta = totalFrotasAtivas > 0 ? (qtdFrotasComMulta / totalFrotasAtivas) * 100 : 0;

    // Frotas sem Multas (Veículos ativos sem multa)
    const qtdFrotasSemMulta = totalFrotasAtivas > 0 ? Math.max(0, totalFrotasAtivas - qtdFrotasComMulta) : 0;
    const percentFrotasSemMulta = totalFrotasAtivas > 0 ? (qtdFrotasSemMulta / totalFrotasAtivas) * 100 : 0;

    // 3. Comparison Logic (Only if a specific month is selected)
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
    switch (activePage.toUpperCase()) {
      case 'DASHBOARD':
        return (
          <div className="animate-in fade-in flex flex-col space-y-4 relative h-full overflow-hidden pb-2">
             {loading && <Loading />}
            
            {/* FROZEN HEADER AND CARDS CONTAINER */}
            <div className="shrink-0 bg-slate-50 border-b border-slate-200 pb-4 pt-3 px-3 -mx-1 shadow-sm transition-all rounded-2xl">
                {/* Header Dashboard with Filter */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 px-2">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Analítico</h2>
                        <p className="text-slate-500 font-medium text-sm">Monitoramento de infrações e performance da frota</p>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="px-3 text-risel-green">
                            <Calendar size={18} />
                        </div>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-slate-700 font-bold text-sm outline-none border-none p-2 focus:ring-0 cursor-pointer w-48"
                        >
                            <option value="">Todos os meses</option>
                            {availableMonths.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                
                {/* DASHBOARD METRICS GRID - GRADIENT CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-2">
                
                {/* CARD 1: Quantidade de Multas (Filtro Global) - BLUE GRADIENT */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-blue-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><FileText size={18}/></div>
                            {dashboardMetrics.showTrend && (
                                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border border-white/20 ${dashboardMetrics.percentChange > 0 ? 'bg-red-500/20 text-white' : 'bg-emerald-500/20 text-white'}`}>
                                        {dashboardMetrics.percentChange > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                                        {Math.abs(dashboardMetrics.percentChange).toFixed(1)}%
                                </div>
                            )}
                            {!dashboardMetrics.showTrend && (
                                <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white border border-white/20">
                                    GERAL
                                </div>
                            )}
                        </div>
                        <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdMultas}</h3>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wide">Total Selecionado</p>
                            <span className="text-[10px] font-medium text-blue-200">Média: {dashboardMetrics.mediaMultasPorFrota.toFixed(2)}/veíc</span>
                        </div>
                    </div>
                </div>

                {/* CARD 2: Valor Total Estimado - AMBER GRADIENT */}
                <div className="bg-gradient-to-br from-amber-600 to-amber-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-amber-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><DollarSign size={18}/></div>
                        </div>
                        <h3 className="text-xl font-black text-white">
                            {dashboardMetrics.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wide mt-1">Valor Estimado</p>
                    </div>
                </div>

                {/* CARD 3: Total de Frotas - INDIGO GRADIENT */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-indigo-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><Truck size={18}/></div>
                            <div className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white border border-white/20">
                                    {dashboardMetrics.totalFrotasAtivas} ATIVOS
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-white">{dashboardMetrics.totalVeiculos}</h3>
                        <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-wide mt-1">Frota Total</p>
                    </div>
                </div>

                {/* CARD 4: Frotas COM Multas - RED GRADIENT */}
                <div className="bg-gradient-to-br from-red-600 to-red-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-red-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><Siren size={18}/></div>
                            <span className="text-[10px] font-black text-white bg-red-800/30 px-2 py-0.5 rounded">{dashboardMetrics.percentFrotasComMulta.toFixed(1)}%</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdFrotasComMulta}</h3>
                            <p className="text-[10px] font-bold text-red-100 uppercase tracking-wide mt-1">Ativos c/ Multas</p>
                            
                            {/* Visual Indicator Bar */}
                            <div className="w-full bg-black/20 h-1 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="h-full bg-white/90 rounded-full"
                                    style={{ width: `${dashboardMetrics.percentFrotasComMulta}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD 5: Frotas SEM Multas - GREEN/EMERALD GRADIENT */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-400 rounded-2xl p-4 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-emerald-500/20 text-white">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white/20 rounded-lg text-white border border-white/20"><CheckCircle2 size={18}/></div>
                            <span className="text-[10px] font-black text-white bg-emerald-800/30 px-2 py-0.5 rounded">{dashboardMetrics.percentFrotasSemMulta.toFixed(1)}%</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white">{dashboardMetrics.qtdFrotasSemMulta}</h3>
                            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wide mt-1">Ativos s/ Multas</p>
                            {/* Visual Indicator Bar */}
                            <div className="w-full bg-black/20 h-1 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="h-full bg-white/90 rounded-full"
                                    style={{ width: `${dashboardMetrics.percentFrotasSemMulta}%` }}
                                ></div>
                                </div>
                        </div>
                    </div>
                </div>

                </div>
            </div>
            
            {/* SCROLLABLE CHARTS SECTION */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-8">
                <DashboardCharts multas={filteredMultasForCharts} />
            </div>

          </div>
        );
      case 'MULTAS':
        return <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 h-full shadow-lg border border-slate-100 flex flex-col overflow-hidden"><MultasPage defaultMonth={selectedMonth} onMonthChange={setSelectedMonth} /></div>;
      case 'ALERTAS':
        return <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 h-full shadow-lg border border-slate-100 flex flex-col overflow-hidden"><AlertasPage defaultMonth={selectedMonth} /></div>;
      case 'CONFIG':
        return <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 h-full shadow-lg border border-slate-100 overflow-auto"><ConfigPage /></div>;
      default:
        return <div>Página não encontrada</div>;
    }
  };



  return (
    <div className="h-full w-full">
      {renderContent()}
    </div>
  );
};

export default MultasDashboard;

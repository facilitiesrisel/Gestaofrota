
import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllData } from '../services/storage';
import { parseLocalDate } from '../services/dateUtils';
import { Multa, Veiculo, StatusMulta } from '../types';
import { AlertTriangle, Clock, CalendarClock, ShieldAlert, CheckCircle2, Siren, Truck, ArrowRight, Eye, CalendarOff } from 'lucide-react';
import Loading from '../components/Loading';

interface AlertasPageProps {
  defaultMonth?: string;
}

const AlertasPage: React.FC<AlertasPageProps> = ({ defaultMonth }) => {
  const [activeTab, setActiveTab] = useState<'MULTAS' | 'LICENCIAMENTO'>('MULTAS');
  const [multas, setMultas] = useState<Multa[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchAllData(false);
      setMultas(data.multas);
      setVeiculos(data.veiculos);
      setLoading(false);
    };
    loadData();
  }, []);

  const calculateDaysRemaining = (dateStr: string | undefined): number | null => {
    if (!dateStr) return null;
    let targetDate: Date;
    
    // Tratamento de formatos variados
    if (dateStr.includes('T')) {
        targetDate = new Date(dateStr);
    } else if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split(' ')[0].split('/');
        targetDate = new Date(Number(y), Number(m) - 1, Number(d));
    } else if (dateStr.includes('-')) {
        targetDate = new Date(dateStr);
    } else {
        return null;
    }

    if (isNaN(targetDate.getTime())) return null;

    const today = new Date();
    // Resetar horas para comparação justa de dias
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);

    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  // --- LOGICA DE FILTRO DE MULTAS ---
  // Status: AGUARDANDO RETORNO e Prazo Indicação <= 10 dias (e filtrado pelo mês do Dashboard se aplicável)
  const multasAlertas = useMemo(() => {
      return multas.filter(m => {
          if (m.status !== StatusMulta.AGUARDANDO_RETORNO) return false;

          // Filtra pelo mês se defaultMonth estiver configurado
          if (defaultMonth) {
              const [y, mSelected] = defaultMonth.split('-').map(Number);
              const d = parseLocalDate(m.dataHoraInfracao);
              if (!d || d.getFullYear() !== y || (d.getMonth() + 1) !== mSelected) {
                  return false;
              }
          }

          const days = calculateDaysRemaining(m.prazoIndicacao);
          return days !== null && days <= 10;
      }).sort((a, b) => {
          const daysA = calculateDaysRemaining(a.prazoIndicacao) || 999;
          const daysB = calculateDaysRemaining(b.prazoIndicacao) || 999;
          return daysA - daysB;
      });
  }, [multas, defaultMonth]);

  // --- LOGICA DE FILTRO DE LICENCIAMENTO ---
  // Veículos com Licenciamento <= 10 dias
  const veiculosAlertas = useMemo(() => {
      return veiculos.filter(v => {
          // Apenas veículos ativos
          if (v.status && v.status !== 'ATIVO') return false;
          
          const days = calculateDaysRemaining(v.validadeLicenciamento);
          return days !== null && days <= 10;
      }).sort((a, b) => {
          const daysA = calculateDaysRemaining(a.validadeLicenciamento) || 999;
          const daysB = calculateDaysRemaining(b.validadeLicenciamento) || 999;
          return daysA - daysB;
      });
  }, [veiculos]);

  // Helpers de Visualização
  const getUrgencyColor = (days: number) => {
      if (days < 0) return 'text-red-600 bg-red-100 border-red-200'; // Vencido
      if (days <= 3) return 'text-red-500 bg-red-50 border-red-100'; // Crítico
      return 'text-orange-600 bg-orange-50 border-orange-100'; // Alerta
  };

  const getUrgencyText = (days: number) => {
      if (days < 0) return `VENCIDO HÁ ${Math.abs(days)} DIAS`;
      if (days === 0) return 'VENCE HOJE';
      if (days === 1) return 'VENCE AMANHÃ';
      return `VENCE EM ${days} DIAS`;
  };

  const formatCurrency = (val?: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col pb-6">
        {loading && <Loading />}
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100 shrink-0">
            <div>
                <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-500 tracking-tight flex items-center">
                    <ShieldAlert className="mr-3 text-red-500" size={32} />
                    Central de Alertas
                </h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Monitoramento de prazos críticos e vencimentos iminentes.</p>
            </div>
            
            {/* Summary Chips */}
            <div className="flex gap-3">
                <div className="flex flex-col items-center bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                    <span className="text-2xl font-black text-red-600 leading-none">{multasAlertas.length}</span>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Multas Críticas</span>
                </div>
                <div className="flex flex-col items-center bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">
                    <span className="text-2xl font-black text-orange-600 leading-none">{veiculosAlertas.length}</span>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Licenc. Vencendo</span>
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200 shadow-inner">
            <button 
                onClick={() => setActiveTab('MULTAS')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'MULTAS' ? 'bg-white text-red-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Siren size={18} className={activeTab === 'MULTAS' ? 'animate-pulse' : ''}/>
                Multas Pendentes
                {multasAlertas.length > 0 && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{multasAlertas.length}</span>}
            </button>
            <button 
                onClick={() => setActiveTab('LICENCIAMENTO')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'LICENCIAMENTO' ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Truck size={18} className={activeTab === 'LICENCIAMENTO' ? 'animate-pulse' : ''}/>
                Licenciamento Veicular
                {veiculosAlertas.length > 0 && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{veiculosAlertas.length}</span>}
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col min-h-0 relative">
            
            {/* View: MULTAS */}
            {activeTab === 'MULTAS' && (
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {multasAlertas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <CheckCircle2 size={64} className="mb-4 text-emerald-100" />
                            <p className="text-lg font-bold text-slate-400">Nenhuma multa pendente crítica.</p>
                            <p className="text-sm">Parabéns! Todas as indicações estão em dia.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Urgência</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Frota / Placa</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">AIT</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Infração</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-right">Valor</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-center">Prazo Indicação</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {multasAlertas.map((m, idx) => {
                                    const days = calculateDaysRemaining(m.prazoIndicacao) || 0;
                                    const styles = getUrgencyColor(days);
                                    
                                    return (
                                        <tr key={m.id || idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 align-middle">
                                                <div className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-black uppercase whitespace-nowrap ${styles}`}>
                                                    <Clock size={12} className="mr-1.5" />
                                                    {getUrgencyText(days)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 text-sm">{m.frota}</span>
                                                    <span className="font-mono text-xs text-slate-500 font-bold">{m.placa}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle font-mono text-xs font-bold text-slate-600">{m.ait}</td>
                                            <td className="p-4 align-middle">
                                                <div className="max-w-xs">
                                                    <p className="text-xs font-bold text-slate-700 line-clamp-1">{m.descricaoInfracao}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center">
                                                        {m.municipio} - {m.uf} • {m.dataHoraInfracao ? new Date(m.dataHoraInfracao).toLocaleDateString() : '-'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right font-bold text-slate-700 text-sm">
                                                {formatCurrency(m.valorComDesconto)}
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-sm font-bold text-slate-800">{m.prazoIndicacao ? new Date(m.prazoIndicacao).toLocaleDateString() : '-'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1 rounded uppercase tracking-wide">
                                                    {m.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* View: VEÍCULOS */}
            {activeTab === 'LICENCIAMENTO' && (
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {veiculosAlertas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <CheckCircle2 size={64} className="mb-4 text-emerald-100" />
                            <p className="text-lg font-bold text-slate-400">Nenhum licenciamento próximo do vencimento.</p>
                            <p className="text-sm">Todos os veículos ativos estão regularizados.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Urgência</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Frota / Placa</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Filial</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Modelo / Marca</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-center">Vencimento</th>
                                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {veiculosAlertas.map((v, idx) => {
                                    const days = calculateDaysRemaining(v.validadeLicenciamento) || 0;
                                    const styles = getUrgencyColor(days);
                                    
                                    return (
                                        <tr key={v.id || idx} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 align-middle">
                                                <div className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-black uppercase whitespace-nowrap ${styles}`}>
                                                    <CalendarOff size={12} className="mr-1.5" />
                                                    {getUrgencyText(days)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 text-sm">{v.id}</span>
                                                    <span className="font-mono text-xs text-slate-500 font-bold">{v.placa}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{v.filial}</span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{v.modelo}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase">{v.marca} • {v.ano}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-sm font-bold text-slate-800">{v.validadeLicenciamento ? new Date(v.validadeLicenciamento).toLocaleDateString() : '-'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded uppercase tracking-wide">
                                                    {v.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default AlertasPage;

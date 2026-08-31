import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllData } from '../services/storage';
import { parseLocalDate } from '../services/dateUtils';
import { Multa, StatusMulta } from '../types';
import { Clock, ShieldAlert, CheckCircle2, Siren } from 'lucide-react';
import Loading from '../components/Loading';

interface AlertasPageProps {
  defaultMonth?: string;
}

const AlertasPage: React.FC<AlertasPageProps> = ({ defaultMonth }) => {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchAllData(false);
      setMultas(data.multas);
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
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);

    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

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
    <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col pb-4">
        {loading && <Loading />}
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-100 shrink-0">
            <div>
                <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-500 tracking-tight flex items-center">
                    <ShieldAlert className="mr-2.5 text-red-500" size={28} />
                    Central de Alertas - Prazos de Indicação
                </h2>
                <p className="text-slate-500 font-medium text-xs mt-0.5">Monitoramento de prazos críticos de indicação de condutor e recursos pendentes (≤ 10 dias).</p>
            </div>
            
            {/* Summary Chip */}
            <div className="flex gap-3">
                <div className="flex flex-col items-center bg-red-50 px-5 py-2 rounded-xl border border-red-100 shadow-sm">
                    <span className="text-2xl font-black text-red-600 leading-none">{multasAlertas.length}</span>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide mt-0.5">Prazos Críticos</span>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col min-h-0 relative">
            <div className="flex-1 overflow-auto custom-scrollbar">
                {multasAlertas.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-16">
                        <CheckCircle2 size={64} className="mb-4 text-emerald-300" />
                        <p className="text-base font-bold text-slate-500">Nenhuma multa pendente com prazo crítico.</p>
                        <p className="text-xs text-slate-400">Todas as indicações de condutores estão regularizadas.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                            <tr>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Urgência</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Frota / Placa</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">AIT</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Infração</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Condutor</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-right">Valor</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-center">Prazo Indicação</th>
                                <th className="p-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {multasAlertas.map((m, idx) => {
                                const days = calculateDaysRemaining(m.prazoIndicacao) || 0;
                                const styles = getUrgencyColor(days);
                                
                                return (
                                    <tr key={m.id || idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-3.5 align-middle">
                                            <div className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-black uppercase whitespace-nowrap ${styles}`}>
                                                <Clock size={12} className="mr-1.5" />
                                                {getUrgencyText(days)}
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-xs">{m.frota || m.placa}</span>
                                                <span className="font-mono text-[11px] text-slate-500 font-bold">{m.placa}</span>
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-middle font-mono text-xs font-bold text-slate-600">{m.ait}</td>
                                        <td className="p-3.5 align-middle">
                                            <div className="max-w-xs">
                                                <p className="text-xs font-bold text-slate-700 truncate">{m.descricaoInfracao || m.enquadramento}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center">
                                                    {m.municipio} - {m.uf} • {m.dataHoraInfracao ? new Date(m.dataHoraInfracao).toLocaleDateString('pt-BR') : '-'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="p-3.5 align-middle">
                                            <span className="text-xs font-medium text-slate-700">{m.responsavelNome || '-'}</span>
                                        </td>
                                        <td className="p-3.5 align-middle text-right font-bold text-slate-700 text-xs">
                                            {formatCurrency(m.valorComDesconto ?? m.valor)}
                                        </td>
                                        <td className="p-3.5 align-middle text-center">
                                            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                                                {m.prazoIndicacao ? new Date(m.prazoIndicacao).toLocaleDateString('pt-BR') : '-'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 align-middle">
                                            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded uppercase tracking-wide">
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
        </div>
    </div>
  );
};

export default AlertasPage;

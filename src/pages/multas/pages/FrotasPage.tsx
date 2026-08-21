
import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllData, saveVeiculo, deleteVeiculo, cleanString, formatInputText } from '../services/storage';
import { Veiculo, Multa } from '../types';
import { Plus, Search, Car, RefreshCw, Edit, Trash2, ArrowUpDown, X, Truck, Hash, Settings, FileText, DollarSign, Filter, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import Loading from '../components/Loading';

const FrotasPage: React.FC = () => {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [allMultas, setAllMultas] = useState<Multa[]>([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVeiculo, setCurrentVeiculo] = useState<Partial<Veiculo>>({ status: 'ATIVO' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Veiculo; direction: 'asc' | 'desc' } | null>(null);

  // --- FILTER STATES ---
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      year: '', // Default empty = ALL YEARS (Geral)
      month: '',
      base: ''
  });

  const loadData = async (force: boolean = false) => {
      setLoading(true);
      const data = await fetchAllData(force);
      setVeiculos(data.veiculos);
      setAllMultas(data.multas);
      setLoading(false);
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // --- OPTIONS FOR FILTERS ---
  const availableYears = useMemo(() => {
      const years = new Set<string>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear.toString());
      years.add((currentYear + 1).toString());
      
      allMultas.forEach(m => {
          if (m.dataHoraInfracao) {
              let y = '';
              if (m.dataHoraInfracao.includes('T')) y = m.dataHoraInfracao.split('T')[0].split('-')[0];
              else if (m.dataHoraInfracao.includes('-')) y = m.dataHoraInfracao.split('-')[0];
              else if (m.dataHoraInfracao.includes('/')) {
                  const parts = m.dataHoraInfracao.split(' ')[0].split('/');
                  if (parts.length === 3) y = parts[2];
              }
              if (y && y.length === 4) years.add(y);
          }
      });
      return Array.from(years).sort().reverse();
  }, [allMultas]);

  const availableBases = useMemo(() => {
      const bases = new Set(veiculos.map(v => v.filial).filter(Boolean));
      return Array.from(bases).sort();
  }, [veiculos]);

  const months = [
      { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
      { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
      { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
      { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  // --- CALCULATION & FILTERING ---
  const processedVeiculos = useMemo(() => {
      // 1. Filtragem Inicial (Busca Texto)
      let result = veiculos.filter(v => {
        const searchRaw = searchTerm.toLowerCase();
        const searchClean = searchRaw.replace(/[^a-z0-9]/g, ''); 
        if (!searchRaw) return true;
        return (
            (v.id && String(v.id).toLowerCase().includes(searchRaw)) ||
            (v.placa && cleanString(v.placa).toLowerCase().includes(searchClean)) ||
            (v.filial && String(v.filial).toLowerCase().includes(searchRaw)) ||
            (v.modelo && String(v.modelo).toLowerCase().includes(searchRaw)) ||
            (v.status && v.status.toLowerCase().includes(searchRaw)) ||
            (v.proprietario && v.proprietario.toLowerCase().includes(searchRaw))
        );
      });

      // 2. Filtragem por Base
      if (filters.base) {
          result = result.filter(v => v.filial === filters.base);
      }

      // 3. Recálculo Dinâmico de Multas
      return result.map(v => {
          const cleanPlaca = cleanString(v.placa);
          
          const veiculoMultas = allMultas.filter(m => cleanString(m.placa) === cleanPlaca);

          const filteredMultas = veiculoMultas.filter(m => {
              if (!m.dataHoraInfracao) return false;
              
              let date: Date;
              if (m.dataHoraInfracao.includes('T')) {
                  date = new Date(m.dataHoraInfracao);
              } else if (m.dataHoraInfracao.includes('/')) {
                  const [day, month, year] = m.dataHoraInfracao.split(' ')[0].split('/');
                  date = new Date(Number(year), Number(month) - 1, Number(day));
              } else if (m.dataHoraInfracao.includes('-')) {
                   date = new Date(m.dataHoraInfracao);
              } else {
                  return false;
              }

              if (isNaN(date.getTime())) return false;

              if (filters.year && date.getFullYear().toString() !== filters.year) return false;
              if (filters.month && (date.getMonth() + 1).toString() !== filters.month) return false;

              return true;
          });

          const totalMultas = filteredMultas.reduce((acc, m) => acc + (m.valorComDesconto || m.valor || 0), 0);
          
          return {
              ...v,
              custoMultas2026: totalMultas, 
              custoTotal2026: (v.custoLicenciamento2026 || 0) + (v.custoIpva2026 || 0) + totalMultas
          };
      });

  }, [veiculos, allMultas, searchTerm, filters]);

  const sortedVeiculos = useMemo(() => {
    if (!sortConfig) return processedVeiculos;
    return [...processedVeiculos].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      const aNum = parseFloat(String(aValue));
      const bNum = parseFloat(String(bValue));
      if (!isNaN(aNum) && !isNaN(bNum)) return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedVeiculos, sortConfig]);

  const handleSave = async () => {
    if (currentVeiculo.id && currentVeiculo.placa && currentVeiculo.filial) {
      const payload = {
          ...currentVeiculo,
          placa: cleanString(currentVeiculo.placa),
          status: currentVeiculo.status || 'ATIVO'
      } as Veiculo;

      // Atualização otimista imediata na interface
      setVeiculos(prev => {
          let list = [...prev];
          if (editingId && editingId !== payload.id) {
              list = list.filter(v => v.id !== editingId);
          }
          const idx = list.findIndex(v => v.id === payload.id);
          if (idx >= 0) {
              list[idx] = { ...list[idx], ...payload };
          } else {
              list.unshift(payload);
          }
          return list;
      });

      setIsModalOpen(false);
      const prevEditingId = editingId;
      setCurrentVeiculo({ status: 'ATIVO' });
      setEditingId(null);

      // Sincronização em segundo plano no Google Sheets
      try {
          await saveVeiculo(payload, prevEditingId || undefined);
      } catch (err) {
          console.error("Erro ao salvar veículo no servidor:", err);
      }
    } else {
        alert("Campos Obrigatórios: Frota, Placa e Filial.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este veículo?')) {
      setVeiculos(prev => prev.filter(v => v.id !== id));
      try {
        await deleteVeiculo(id);
      } catch (err) {
        console.error("Erro ao excluir veículo:", err);
      }
    }
  };

  const handleSort = (key: keyof Veiculo) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const formatCurrency = (val?: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
  }

  // --- DEFINIÇÃO DE COLUNAS COMPLETA ---
  const columns = [
      { key: 'status', label: 'Status', width: 'w-24' },
      { key: 'id', label: 'Frota', width: 'w-20' },
      { key: 'placa', label: 'Placa', width: 'w-24' },
      { key: 'marca', label: 'Marca', width: 'w-28' },
      { key: 'modelo', label: 'Modelo', width: 'w-32' },
      { key: 'ano', label: 'Ano', width: 'w-20' },
      { key: 'filial', label: 'Filial', width: 'w-32' },
      { key: 'regiao', label: 'Região', width: 'w-28' },
      { key: 'tipo', label: 'Tipo', width: 'w-28' },
      { key: 'capacidade', label: 'Capac.', width: 'w-24' },
      { key: 'proprietario', label: 'Proprietário', width: 'w-32' },
      { key: 'validadeLicenciamento', label: 'Licenciamento', width: 'w-28' },
      { key: 'custoLicenciamento2026', label: 'Custo Licenc.', width: 'w-28' },
      { key: 'custoIpva2026', label: 'Custo IPVA', width: 'w-28' },
      { key: 'custoMultas2026', label: `Multas (${filters.year || 'Geral'})`, width: 'w-32' },
      { key: 'custoTotal2026', label: 'Custo Total', width: 'w-32' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative flex flex-col h-full overflow-hidden">
      {loading && <Loading />}
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-risel-green to-risel-orange tracking-tight uppercase">Gestão de Frota</h2>
          <p className="text-slate-500 text-sm font-medium">Controle de veículos e Custos ({filters.year || 'Geral'})</p>
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-all active:scale-95 font-bold text-sm border ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
                <Filter size={16} className="mr-2"/> Filtros {showFilters ? <ChevronUp size={16} className="ml-1"/> : <ChevronDown size={16} className="ml-1"/>}
            </button>
            <button onClick={() => loadData(true)} className="bg-white hover:bg-gray-50 text-risel-green border border-risel-green/30 px-3 py-2 rounded-lg flex items-center shadow-sm transition-all active:scale-95 font-bold text-sm"><RefreshCw size={18} /></button>
            <button onClick={() => { setCurrentVeiculo({ status: 'ATIVO' }); setEditingId(null); setIsModalOpen(true); }} className="bg-risel-green hover:bg-risel-dark text-white px-5 py-2 rounded-lg flex items-center shadow-lg transition-all active:scale-95 font-bold text-sm uppercase"><Plus size={18} className="mr-2" /> Novo Veículo</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFilters ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Calendar size={12}/> Ano de Referência</label>
                  <select value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todos os Anos (Geral)</option>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mês (Opcional)</label>
                  <select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todos os Meses</option>
                      {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base / Filial</label>
                  <select value={filters.base} onChange={e => setFilters({...filters, base: e.target.value})} className="w-full border rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-risel-green outline-none bg-gray-50">
                      <option value="">Todas as Bases</option>
                      {availableBases.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
              </div>
              <div className="flex items-center pb-1">
                  <span className="text-xs text-gray-400 font-medium">* O cálculo de multas será atualizado automaticamente.</span>
              </div>
          </div>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center transition-all focus-within:ring-2 focus-within:ring-risel-green/20 shrink-0">
        <Search className="text-gray-400 mr-2" size={18}/>
        <input type="text" placeholder="BUSCAR EM TODAS AS COLUNAS..." className="flex-1 outline-none text-gray-700 bg-transparent text-sm font-semibold uppercase placeholder:normal-case" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Limpar filtros"><X size={16} /></button>}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 h-full min-h-0">
            <div className="overflow-auto flex-1 custom-scrollbar w-full relative">
                <table className="min-w-max border-collapse uppercase">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-gradient-to-r from-[#022c22] to-risel-green">
                            <th className="px-3 py-3 w-20 text-center text-[10px] font-bold text-white/90 uppercase tracking-wider border-r border-white/10 sticky left-0 z-20 bg-[#022c22]">Ações</th>
                            {columns.map((col) => (
                                <th key={col.key} className={`px-4 py-3 text-left text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10 select-none ${col.width}`} onClick={() => handleSort(col.key as keyof Veiculo)} title={`Clique para ordenar por ${col.label}`}>
                                    <div className="flex items-center justify-between gap-1">{col.label} <div className={`flex flex-col opacity-50 group-hover:opacity-100 ${sortConfig?.key === col.key ? 'opacity-100 text-white' : ''}`}><ArrowUpDown size={12} /></div></div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {sortedVeiculos.map((veiculo, idx) => {
                            const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                            const isActive = veiculo.status !== 'INATIVO';
                            return (
                                <tr key={veiculo.id + idx} className={`${rowClass} hover:bg-blue-50/50 transition-colors group`}>
                                    <td className="px-2 py-2 text-center border-r border-gray-100 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10">
                                        <div className="flex justify-center space-x-1">
                                            <button onClick={() => { setCurrentVeiculo(veiculo); setEditingId(veiculo.id); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Editar"><Edit size={14}/></button>
                                            <button onClick={() => handleDelete(veiculo.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Excluir"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 border-r border-gray-100"><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{veiculo.status || 'ATIVO'}</span></td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs font-black text-gray-700">{veiculo.id}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs font-bold text-gray-600">{veiculo.placa}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.marca}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.modelo}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.ano}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500 truncate max-w-[150px]">{veiculo.filial}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.regiao}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.tipo}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{veiculo.capacidade}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500 truncate max-w-[120px]">{veiculo.proprietario}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-gray-500">{formatDate(veiculo.validadeLicenciamento)}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-slate-600 font-bold">{formatCurrency(veiculo.custoLicenciamento2026)}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-slate-600 font-bold">{formatCurrency(veiculo.custoIpva2026)}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-red-500 font-bold bg-red-50/30">{formatCurrency(veiculo.custoMultas2026)}</td>
                                    <td className="px-4 py-2 border-r border-gray-100 text-xs text-emerald-600 font-black bg-emerald-50/30">{formatCurrency(veiculo.custoTotal2026)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar uppercase">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center"><Truck className="mr-2 text-risel-green"/> {currentVeiculo.id ? 'EDITAR VEÍCULO' : 'NOVO VEÍCULO'}</h3>
            <div className="space-y-6">
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><Hash size={12} className="mr-1"/> Identificação & Status</h4>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label><select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.status || 'ATIVO'} onChange={e => setCurrentVeiculo({...currentVeiculo, status: e.target.value})}><option value="ATIVO">ATIVO</option><option value="INATIVO">INATIVO</option><option value="MANUTENCAO">MANUTENÇÃO</option><option value="VENDIDO">VENDIDO</option></select></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Frota *</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm font-bold bg-white uppercase" placeholder="EX: 1001" value={currentVeiculo.id || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, id: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Placa *</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm font-bold uppercase bg-white" placeholder="ABC1234" value={currentVeiculo.placa || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, placa: cleanString(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Filial *</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.filial || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, filial: formatInputText(e.target.value)})}/></div>
                   </div>
               </div>
               <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><Settings size={12} className="mr-1"/> Detalhes do Veículo</h4>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Marca</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.marca || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, marca: formatInputText(e.target.value)})}/></div>
                        <div className="md:col-span-2"><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Modelo</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.modelo || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, modelo: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Ano</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.ano || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, ano: formatInputText(e.target.value)})}/></div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tipo</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.tipo || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, tipo: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Capacidade</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.capacidade || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, capacidade: formatInputText(e.target.value)})}/></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Região</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.regiao || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, regiao: formatInputText(e.target.value)})}/></div>
                   </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><FileText size={12} className="mr-1"/> Propriedade</h4>
                        <div className="grid grid-cols-1 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Proprietário</label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.proprietario || ''} onChange={e => setCurrentVeiculo({...currentVeiculo, proprietario: formatInputText(e.target.value)})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Licenciamento (Data)</label><input type="date" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white uppercase" value={currentVeiculo.validadeLicenciamento ? new Date(currentVeiculo.validadeLicenciamento).toISOString().split('T')[0] : ''} onChange={e => setCurrentVeiculo({...currentVeiculo, validadeLicenciamento: e.target.value})}/></div>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center"><DollarSign size={12} className="mr-1"/> Custos (Fixos Planilha)</h4>
                        <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Licenciamento (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white font-bold" value={currentVeiculo.custoLicenciamento2026 || 0} onChange={e => setCurrentVeiculo({...currentVeiculo, custoLicenciamento2026: Number(e.target.value)})}/></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">IPVA (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-risel-green outline-none text-sm bg-white font-bold" value={currentVeiculo.custoIpva2026 || 0} onChange={e => setCurrentVeiculo({...currentVeiculo, custoIpva2026: Number(e.target.value)})}/></div>
                                <div><label className="block text-[10px] font-bold text-red-500 mb-1 uppercase">Multas ({filters.year || 'Geral'})</label><input type="text" disabled className="w-full border rounded-lg p-2.5 bg-red-50 text-red-600 font-bold text-sm outline-none cursor-not-allowed" value={formatCurrency(currentVeiculo.custoMultas2026)}/></div>
                                <div><label className="block text-[10px] font-bold text-emerald-600 mb-1 uppercase">Total (Calc)</label><input type="text" disabled className="w-full border rounded-lg p-2.5 bg-emerald-50 text-emerald-700 font-black text-sm outline-none cursor-not-allowed" value={formatCurrency((currentVeiculo.custoLicenciamento2026 || 0) + (currentVeiculo.custoIpva2026 || 0) + (currentVeiculo.custoMultas2026 || 0))}/></div>
                        </div>
                    </div>
               </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium text-sm uppercase">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-risel-green text-white rounded-xl shadow-lg hover:bg-risel-dark font-bold text-sm transition-all transform active:scale-95 uppercase">Salvar Veículo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrotasPage;

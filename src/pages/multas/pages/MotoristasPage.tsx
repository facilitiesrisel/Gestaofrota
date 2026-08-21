
import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllData, saveMotorista, deleteMotorista, formatInputText, cleanString } from '../services/storage';
import { Motorista, Multa } from '../types';
import { Plus, Search, User, Trash2, Edit, MapPin, RefreshCw, X, Filter, ChevronUp, ChevronDown, Calendar, ArrowUpDown } from 'lucide-react';
import Loading from '../components/Loading';

// Extend Motorista type locally for display purposes
interface MotoristaDisplay extends Motorista {
  qtdMultas: number;
  valorMultas: number;
}

const MotoristasPage: React.FC = () => {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [allMultas, setAllMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMotorista, setCurrentMotorista] = useState<Partial<Motorista>>({ status: 'ATIVO' });
  const [editingLogin, setEditingLogin] = useState<string | null>(null); // Track original login for edits
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof MotoristaDisplay; direction: 'asc' | 'desc' } | null>(null);

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
      setMotoristas(data.motoristas);
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
      const bases = new Set(motoristas.map(m => m.base).filter(Boolean));
      return Array.from(bases).sort();
  }, [motoristas]);

  const months = [
      { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' }, { value: '3', label: 'Março' },
      { value: '4', label: 'Abril' }, { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
      { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Setembro' },
      { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
  ];

  const handleSave = async () => {
    if (currentMotorista.login && currentMotorista.nome) {
      const payload = {
        ...currentMotorista,
        status: currentMotorista.status || 'ATIVO',
        login: String(currentMotorista.login).trim(),
        nome: formatInputText(currentMotorista.nome),
        base: formatInputText(currentMotorista.base || '')
      } as Motorista;

      // Atualização otimista na lista local do React
      setMotoristas(prev => {
        let list = [...prev];
        if (editingLogin && editingLogin !== payload.login) {
          list = list.filter(m => m.login !== editingLogin);
        }
        const idx = list.findIndex(m => m.login === payload.login);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...payload };
        } else {
          list.unshift(payload);
        }
        return list;
      });

      setIsModalOpen(false);
      const prevEditingLogin = editingLogin;
      setCurrentMotorista({ status: 'ATIVO' });
      setEditingLogin(null);

      // Sincronização em segundo plano no servidor
      try {
        if (prevEditingLogin && prevEditingLogin !== payload.login) {
          await deleteMotorista(prevEditingLogin);
        }
        await saveMotorista(payload, prevEditingLogin || undefined);
      } catch (err) {
        console.error("Erro ao salvar motorista no servidor:", err);
      }
    } else {
        alert("Preencha Login e Nome.");
    }
  };

  const handleDelete = async (login: string) => {
    if (confirm('Tem certeza que deseja excluir este motorista?')) {
      setMotoristas(prev => prev.filter(m => m.login !== login));
      try {
        await deleteMotorista(login);
      } catch (err) {
        console.error("Erro ao excluir motorista:", err);
      }
    }
  };

  const handleSort = (key: keyof MotoristaDisplay) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedMotoristas = useMemo(() => {
      // 1. Base Filter (Search)
      let result = motoristas.filter(m => {
        const searchRaw = searchTerm.toLowerCase();
        if (!searchRaw) return true;
        return (
            (m.nome && m.nome.toLowerCase().includes(searchRaw)) ||
            (m.login && m.login.toLowerCase().includes(searchRaw)) ||
            (m.base && m.base.toLowerCase().includes(searchRaw))
        );
      });

      // 2. Filter by Base Dropdown
      if (filters.base) {
          result = result.filter(m => m.base === filters.base);
      }

      // 3. Calculate Fines & Augment Data
      const augmentedResult = result.map(m => {
          const driverLoginClean = cleanString(m.login);
          
          // Match logic: Login matches responsavelCodigo (cleaned)
          const driverMultas = allMultas.filter(multa => {
              return cleanString(multa.responsavelCodigo) === driverLoginClean;
          });

          const filteredDriverMultas = driverMultas.filter(multa => {
              if (!multa.dataHoraInfracao) return false;
              
              let date: Date;
              // Parse date logic similar to FrotasPage
              if (multa.dataHoraInfracao.includes('T')) {
                  date = new Date(multa.dataHoraInfracao);
              } else if (multa.dataHoraInfracao.includes('/')) {
                  const [day, month, year] = multa.dataHoraInfracao.split(' ')[0].split('/');
                  date = new Date(Number(year), Number(month) - 1, Number(day));
              } else if (multa.dataHoraInfracao.includes('-')) {
                   date = new Date(multa.dataHoraInfracao);
              } else {
                  return false;
              }

              if (isNaN(date.getTime())) return false;

              // Apply Filters only if selected
              if (filters.year && date.getFullYear().toString() !== filters.year) return false;
              if (filters.month && (date.getMonth() + 1).toString() !== filters.month) return false;

              return true;
          });

          const qtd = filteredDriverMultas.length;
          const valor = filteredDriverMultas.reduce((acc, curr) => acc + (curr.valorComDesconto || curr.valor || 0), 0);

          return {
              ...m,
              qtdMultas: qtd,
              valorMultas: valor
          } as MotoristaDisplay;
      });

      // 4. Sort
      if (sortConfig) {
          augmentedResult.sort((a, b) => {
              const aVal = a[sortConfig.key];
              const bVal = b[sortConfig.key];
              
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                  return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
              }
              const aStr = String(aVal || '').toLowerCase();
              const bStr = String(bVal || '').toLowerCase();
              if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
              if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }

      return augmentedResult;

  }, [motoristas, allMultas, searchTerm, filters, sortConfig]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative flex flex-col h-full overflow-hidden">
      {loading && <Loading />}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-risel-green to-risel-orange tracking-tight uppercase">Gestão de Motoristas</h2>
          <p className="text-slate-500 text-sm font-medium">Controle de Condutores e Pontuação {filters.year ? `(${filters.year})` : '(Geral)'}</p>
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center shadow-sm transition-all active:scale-95 font-bold text-sm border ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
                <Filter size={16} className="mr-2"/> Filtros {showFilters ? <ChevronUp size={16} className="ml-1"/> : <ChevronDown size={16} className="ml-1"/>}
            </button>
            <button onClick={() => loadData(true)} className="bg-white hover:bg-gray-50 text-risel-green border border-risel-green/30 px-3 py-2 rounded-lg flex items-center shadow-sm transition-all active:scale-95 font-bold text-sm"><RefreshCw size={18} /></button>
            <button onClick={() => { setCurrentMotorista({ status: 'ATIVO' }); setEditingLogin(null); setIsModalOpen(true); }} className="bg-risel-green hover:bg-risel-dark text-white px-5 py-2 rounded-lg flex items-center shadow-lg transition-all active:scale-95 font-bold text-sm uppercase"><Plus size={18} className="mr-2" /> Novo Motorista</button>
        </div>
      </div>

      {/* Filters */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFilters ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
          </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center transition-all focus-within:ring-2 focus-within:ring-risel-green/20 shrink-0">
        <Search className="text-gray-400 mr-2" size={18}/>
        <input type="text" placeholder="BUSCAR POR NOME, LOGIN OU BASE..." className="flex-1 outline-none text-gray-700 bg-transparent text-sm font-semibold uppercase placeholder:normal-case" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Limpar filtros"><X size={16} /></button>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 h-full min-h-0">
            <div className="overflow-auto flex-1 custom-scrollbar w-full relative">
                <table className="min-w-max border-collapse uppercase w-full">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-gradient-to-r from-[#022c22] to-risel-green">
                            <th className="px-3 py-3 w-20 text-center text-[10px] font-bold text-white/90 uppercase tracking-wider border-r border-white/10 sticky left-0 z-20 bg-[#022c22]">Ações</th>
                            <th onClick={() => handleSort('status')} className="px-6 py-3 text-left text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10">Status <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                            <th onClick={() => handleSort('login')} className="px-6 py-3 text-left text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10">Login <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                            <th onClick={() => handleSort('nome')} className="px-6 py-3 text-left text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10 w-1/3">Nome <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                            <th onClick={() => handleSort('base')} className="px-6 py-3 text-left text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10">Base <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                            <th onClick={() => handleSort('qtdMultas')} className="px-6 py-3 text-center text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10">Qtd. Multas <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                            <th onClick={() => handleSort('valorMultas')} className="px-6 py-3 text-right text-[10px] font-bold text-white/90 uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors group border-r border-white/10">Valor Multas <ArrowUpDown size={10} className="inline ml-1 opacity-50 group-hover:opacity-100"/></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {processedMotoristas.map((motorista, idx) => {
                            const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                            const isActive = motorista.status !== 'INATIVO';
                            return (
                                <tr key={motorista.login + idx} className={`${rowClass} hover:bg-blue-50/50 transition-colors group`}>
                                    <td className="px-2 py-2 text-center border-r border-gray-100 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10">
                                        <div className="flex justify-center space-x-1">
                                            <button onClick={() => { setCurrentMotorista(motorista); setEditingLogin(motorista.login); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Editar"><Edit size={14}/></button>
                                            <button onClick={() => handleDelete(motorista.login)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Excluir"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 border-r border-gray-100"><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{motorista.status || 'ATIVO'}</span></td>
                                    <td className="px-6 py-3 border-r border-gray-100 text-xs font-black text-gray-700">{motorista.login}</td>
                                    <td className="px-6 py-3 border-r border-gray-100 text-xs font-bold text-gray-600">{motorista.nome}</td>
                                    <td className="px-6 py-3 border-r border-gray-100 text-xs text-gray-500"><div className="flex items-center"><MapPin size={10} className="mr-1 text-gray-400"/>{motorista.base || '-'}</div></td>
                                    <td className="px-6 py-3 border-r border-gray-100 text-xs text-center font-bold text-gray-700">{motorista.qtdMultas > 0 ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{motorista.qtdMultas}</span> : <span className="text-gray-400">-</span>}</td>
                                    <td className="px-6 py-3 border-r border-gray-100 text-xs text-right font-black text-gray-700">{motorista.valorMultas > 0 ? <span className="text-red-600">{formatCurrency(motorista.valorMultas)}</span> : <span className="text-gray-400">-</span>}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg md:w-[600px] animate-in zoom-in-95 duration-200 uppercase">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center"><User className="mr-2 text-risel-green"/> {editingLogin ? 'EDITAR MOTORISTA' : 'NOVO MOTORISTA'}</h3>
            <div className="space-y-4">
              <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status</label>
                  <select
                     className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-risel-green focus:outline-none bg-gray-50 text-sm font-bold"
                     value={currentMotorista.status || 'ATIVO'}
                     onChange={e => setCurrentMotorista({...currentMotorista, status: e.target.value})}
                  >
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                  </select>
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Login (Código) *</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-risel-green focus:outline-none bg-white text-sm font-bold" 
                    value={currentMotorista.login || ''}
                    onChange={e => setCurrentMotorista({...currentMotorista, login: formatInputText(e.target.value)})}
                    placeholder="EX: MOT001"
                  />
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nome Completo *</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-risel-green focus:outline-none bg-white text-sm" 
                    value={currentMotorista.nome || ''}
                    onChange={e => setCurrentMotorista({...currentMotorista, nome: formatInputText(e.target.value)})}
                    placeholder="NOME DO MOTORISTA"
                  />
              </div>
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Base / Filial</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-risel-green focus:outline-none bg-white text-sm" 
                    placeholder="EX: SÃO PAULO"
                    value={currentMotorista.base || ''}
                    onChange={e => setCurrentMotorista({...currentMotorista, base: formatInputText(e.target.value)})}
                  />
              </div>
              
              {/* Campos Calculados (Read-only no modal) */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 mt-2">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Qtd. Multas (Geral)</label>
                      <div className="text-lg font-black text-gray-700">
                          {/* Note: This is just visualization, modal doesn't need strictly live filtered data, but nice to have if available */}
                          -
                      </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Valor Total (Geral)</label>
                      <div className="text-lg font-black text-red-600">
                          -
                      </div>
                  </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3 border-t border-gray-100 pt-4">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium text-sm uppercase">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-risel-green text-white rounded-xl shadow-lg hover:bg-risel-dark font-bold text-sm transition-all transform active:scale-95 uppercase">Salvar Motorista</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MotoristasPage;

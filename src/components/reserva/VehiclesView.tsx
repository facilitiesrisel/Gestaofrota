import React, { useState, useEffect, useMemo } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { useAuth } from '../../context/ReservationAuthContext';
import Modal from './Modal';
import { Vehicle } from '../../types_reserva';
import { 
    PencilIcon, 
    TrashIcon, 
    CarIcon, 
    GasPumpIcon, 
    CreditCardIcon, 
    CalendarIcon, 
    FunnelIcon, 
    RouteIcon, 
    MapPinIcon, 
    EyeIcon, 
    EyeSlashIcon,
    CheckIcon,
    XIcon,
    ClockIcon,
    ClipboardListIcon
} from './icons';
import { fetchAbastecimentosSupabase } from '../../services/supabaseService';
import { toTitleCase } from '../../lib/utils';

// Componente de Placa Mercosul Estilizada e de Alto Contraste
const MercosulPlateBadge: React.FC<{ plate: string; isInactive?: boolean }> = ({ plate, isInactive }) => {
    const formattedPlate = (plate || 'ABC1D23').toUpperCase().trim();
    
    return (
        <div className={`inline-flex flex-col items-center justify-center border rounded-lg overflow-hidden shadow-xs select-none transition-all duration-200 ${
            isInactive 
                ? 'border-slate-300 bg-slate-100 opacity-60' 
                : 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-sm'
        }`} style={{ width: '92px', minWidth: '92px' }}>
            {/* Faixa Azul Mercosul */}
            <div className={`w-full py-0.5 px-1.5 flex items-center justify-between ${isInactive ? 'bg-slate-500' : 'bg-[#003399]'}`}>
                {/* Estrelas / Logo Mercosul */}
                <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-90"></div>
                    <div className="w-1 h-1 rounded-full bg-yellow-200 opacity-70"></div>
                </div>
                {/* Texto BRASIL */}
                <span className="text-[7.5px] font-black text-white tracking-widest leading-none font-sans uppercase">
                    BRASIL
                </span>
                {/* Mini Bandeira do Brasil */}
                <div className="w-2.5 h-1.5 bg-emerald-500 rounded-[1px] relative flex items-center justify-center overflow-hidden">
                    <div className="w-1.5 h-1 bg-yellow-400 rotate-45 transform"></div>
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-700 absolute"></div>
                </div>
            </div>

            {/* Corpo da Placa com Código e Fonte Monospace */}
            <div className="w-full bg-white py-0.5 px-1 text-center flex items-center justify-center">
                <span className={`text-[12px] font-mono font-black tracking-wider leading-tight ${isInactive ? 'text-slate-500' : 'text-slate-900'}`}>
                    {formattedPlate}
                </span>
            </div>
        </div>
    );
};

// Interfaces locais para o estado da view
interface ExtendedVehicle extends Vehicle {
    veloeLiters?: number;
    veloeTotalKm?: number;
    veloeBalance?: number;
    veloeLastTransactionDate?: string;
    veloeKmL?: number;
}

interface AbastecimentoItem {
    id: string;
    placa: string;
    base?: string;
    condutor?: string;
    data?: string;
    litros?: number;
    kmPercorrido?: number;
    valorTotal?: number;
    saldo?: number;
    hodometro?: number;
    posto?: string;
}

const VehicleForm: React.FC<{ vehicle: Vehicle | null, onSave: (data: any) => void, onCancel: () => void, canEditType?: boolean }> = ({ vehicle, onSave, onCancel, canEditType }) => {
    const [formData, setFormData] = useState({
        model: '',
        plate: '',
        year: new Date().getFullYear(),
        lastKm: 0,
        lastServiceDate: '',
        lastServiceKm: 0,
        lastWashDate: '',
        isActive: true,
        type: 'Operações' as 'Operações' | 'Gestão',
    });

    useEffect(() => {
        if (vehicle) {
            setFormData({
                model: vehicle.model,
                plate: vehicle.plate,
                year: vehicle.year,
                lastKm: vehicle.lastKm || 0,
                lastServiceDate: vehicle.lastServiceDate ? new Date(vehicle.lastServiceDate).toISOString().split('T')[0] : '',
                lastServiceKm: vehicle.lastServiceKm || 0,
                lastWashDate: vehicle.lastWashDate ? new Date(vehicle.lastWashDate).toISOString().split('T')[0] : '',
                isActive: vehicle.isActive !== false,
                type: vehicle.type || 'Operações',
            });
        } else {
             setFormData({ model: '', plate: '', year: new Date().getFullYear(), lastKm: 0, lastServiceDate: '', lastServiceKm: 0, lastWashDate: '', isActive: true, type: 'Operações' });
        }
    }, [vehicle]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const upperCaseFields = ['model', 'plate'];

        if (name === 'isActive') {
            setFormData(prev => ({ ...prev, [name]: value === 'true' }));
        } else if (upperCaseFields.includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
        } else {
            setFormData(prev => ({ ...prev, [name]: (name === 'year' || name === 'lastServiceKm' || name === 'lastKm') ? parseInt(value) || 0 : value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seção 1: Identificação do Veículo */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#114D38]">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <CarIcon className="w-3.5 h-3.5" />
                    </div>
                    <span>Identificação do Veículo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                        <label htmlFor="model" className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
                        <input 
                            type="text" 
                            name="model" 
                            value={formData.model} 
                            onChange={handleChange} 
                            required 
                            placeholder="EX: FIAT MOBI LIKE"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none uppercase placeholder:text-slate-400 placeholder:normal-case shadow-xs" 
                        />
                    </div>
                    <div>
                        <label htmlFor="plate" className="block text-xs font-bold text-slate-700 mb-1">Placa</label>
                        <input 
                            type="text" 
                            name="plate" 
                            value={formData.plate} 
                            onChange={handleChange} 
                            required 
                            placeholder="ABC1D23"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-black tracking-wider text-slate-900 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none uppercase placeholder:text-slate-400 placeholder:normal-case shadow-xs" 
                        />
                    </div>
                    <div>
                        <label htmlFor="year" className="block text-xs font-bold text-slate-700 mb-1">Ano</label>
                        <input 
                            type="number" 
                            name="year" 
                            value={formData.year} 
                            onChange={handleChange} 
                            required 
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none shadow-xs" 
                        />
                    </div>
                    <div>
                        <label htmlFor="isActive" className="block text-xs font-bold text-slate-700 mb-1">Status Operacional</label>
                        <select 
                            name="isActive" 
                            value={formData.isActive.toString()} 
                            onChange={handleChange} 
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none cursor-pointer shadow-xs"
                        >
                            <option value="true">🟢 Ativo (Disponível para Reserva)</option>
                            <option value="false">🔴 Inativo (Bloqueado/Indisponível)</option>
                        </select>
                    </div>
                    {canEditType && (
                    <div className="col-span-1 md:col-span-2">
                        <label htmlFor="type" className="block text-xs font-bold text-slate-700 mb-1">Tipo de Uso</label>
                        <select 
                            name="type" 
                            value={formData.type} 
                            onChange={handleChange} 
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none cursor-pointer shadow-xs"
                        >
                            <option value="Operações">Operações / Campo</option>
                            <option value="Gestão">Gestão / Diretoria</option>
                        </select>
                    </div>
                    )}
                </div>
            </div>

            {/* Seção 2: Hodômetro e Manutenção */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#114D38]">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                        <RouteIcon className="w-3.5 h-3.5" />
                    </div>
                    <span>Hodômetro e Manutenções</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="col-span-1 md:col-span-2">
                        <label htmlFor="lastKm" className="block text-xs font-bold text-slate-800 mb-1">KM Atual</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                name="lastKm" 
                                value={formData.lastKm} 
                                onChange={handleChange} 
                                required 
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-black text-emerald-700 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none pr-10 shadow-xs" 
                            />
                            <span className="absolute right-3.5 top-2.5 text-xs font-black text-slate-400">km</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Sincronizado automaticamente por viagens finalizadas, mas editável para ajustes manuais.</p>
                    </div>

                    <div>
                        <label htmlFor="lastServiceDate" className="block text-xs font-bold text-slate-700 mb-1">Data da Última Revisão</label>
                        <input 
                            type="date" 
                            name="lastServiceDate" 
                            value={formData.lastServiceDate} 
                            onChange={handleChange} 
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none shadow-xs" 
                        />
                    </div>
                    <div>
                        <label htmlFor="lastServiceKm" className="block text-xs font-bold text-slate-700 mb-1">KM da Última Revisão</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                name="lastServiceKm" 
                                value={formData.lastServiceKm} 
                                onChange={handleChange} 
                                required 
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none pr-10 shadow-xs" 
                            />
                            <span className="absolute right-3.5 top-2.5 text-xs font-black text-slate-400">km</span>
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label htmlFor="lastWashDate" className="block text-xs font-bold text-slate-700 mb-1">Data da Última Lavagem</label>
                        <input 
                            type="date" 
                            name="lastWashDate" 
                            value={formData.lastWashDate} 
                            onChange={handleChange} 
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none shadow-xs" 
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Periodicidade recomendada: a cada 30 dias para preservação da frota.</p>
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end items-center gap-3 pt-2">
                <button 
                    type="button" 
                    onClick={onCancel} 
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                >
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    className="px-6 py-2.5 rounded-xl bg-[#114D38] hover:bg-[#0d3b2c] text-white font-black shadow-md hover:shadow-lg transition-all text-sm flex items-center gap-2 cursor-pointer"
                >
                    <CheckIcon className="w-4 h-4 stroke-[3]" />
                    <span>Salvar Veículo</span>
                </button>
            </div>
        </form>
    );
};

const VehiclesView: React.FC = () => {
  const { vehicles, reservations, dailyTrips, addVehicle, updateVehicle, deleteVehicle } = useReservations();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  // Filtros de busca e status
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Operações' | 'Gestão'>('all');
  const [maintenanceFilter, setMaintenanceFilter] = useState<'all' | 'revision_needed' | 'wash_needed'>('all');

  // --- CONTROLE DE ACESSO ---
  const canViewFuelData = user?.email === 'deny.goncalves@risel.com.br' || user?.email === 'deny.risel@gmail.com';

  // --- ABASTECIMENTO / FILTER STATES ---
  const [filterMode, setFilterMode] = useState<'month' | 'custom'>('month');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [fuelData, setFuelData] = useState<Record<string, AbastecimentoItem[]>>({});
  const [isLoadingFuel, setIsLoadingFuel] = useState(false);

  // Carregar dados de abastecimento do submódulo Controle de Frota Leve
  useEffect(() => {
      const loadFuelData = async () => {
          if (vehicles.length === 0) return;
          
          setIsLoadingFuel(true);
          let start: Date, end: Date;

          if (filterMode === 'month') {
              const year = parseInt(filterYear);
              const month = parseInt(filterMonth);
              start = new Date(year, month, 1);
              end = new Date(year, month + 1, 0, 23, 59, 59);
          } else {
              if (!filterStartDate || !filterEndDate) {
                  setIsLoadingFuel(false);
                  return; 
              }
              start = new Date(filterStartDate + "T00:00:00");
              end = new Date(filterEndDate + "T23:59:59");
          }

          try {
              const supabaseRecords = await fetchAbastecimentosSupabase();
              
              let localRecords: any[] = [];
              try {
                  const saved = localStorage.getItem("risel_abastecimentos");
                  if (saved) {
                      localRecords = JSON.parse(saved);
                  }
              } catch (e) {
                  console.warn("Erro ao ler risel_abastecimentos do localStorage:", e);
              }

              const allAbastecimentos: AbastecimentoItem[] = [...(supabaseRecords || []), ...localRecords];
              
              const grouped: Record<string, AbastecimentoItem[]> = {};
              
              allAbastecimentos.forEach(item => {
                  if (!item.placa) return;
                  const cleanPlate = item.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  
                  if (item.data) {
                      const itemDate = new Date(item.data.includes("T") ? item.data : item.data + "T12:00:00");
                      if (!isNaN(itemDate.getTime())) {
                          if (itemDate < start || itemDate > end) return;
                      }
                  }

                  if (!grouped[cleanPlate]) grouped[cleanPlate] = [];
                  grouped[cleanPlate].push(item);
              });

              const finalData: Record<string, AbastecimentoItem[]> = {};
              vehicles.forEach(v => {
                  const cleanPlate = v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  finalData[v.plate] = grouped[cleanPlate] || [];
              });

              setFuelData(finalData);

          } catch (error) {
              console.error("Erro ao carregar dados de abastecimento do Controle de Frota Leve:", error);
          } finally {
              setIsLoadingFuel(false);
          }
      };

      loadFuelData();
  }, [vehicles, filterMode, filterMonth, filterYear, filterStartDate, filterEndDate]);

  // Helper para métricas de revisão
  const getServiceStatus = (vehicle: Vehicle) => {
    const currentKm = vehicle.lastKm || 0;
    const lastServiceKm = vehicle.lastServiceKm || 0;
    const nextServiceKm = lastServiceKm + 10000;
    const remainingKm = nextServiceKm - currentKm;
    const kmSinceLastService = currentKm - lastServiceKm;
    const percentDone = Math.min(100, Math.max(0, Math.round((kmSinceLastService / 10000) * 100)));

    if (remainingKm <= 0) {
        return { 
            statusType: 'expired',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            barClass: 'bg-rose-500',
            text: `Vencida há ${Math.abs(remainingKm).toLocaleString('pt-BR')} km`, 
            subText: `Revisão aos ${nextServiceKm.toLocaleString('pt-BR')} km`,
            needsAttention: true, 
            nextKm: nextServiceKm,
            remainingKm,
            percentDone: 100
        };
    }
    if (remainingKm <= 500) {
        return { 
            statusType: 'critical',
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
            barClass: 'bg-amber-500',
            text: `Crítico: faltam ${remainingKm.toLocaleString('pt-BR')} km`, 
            subText: `Revisão aos ${nextServiceKm.toLocaleString('pt-BR')} km`,
            needsAttention: true, 
            nextKm: nextServiceKm,
            remainingKm,
            percentDone
        };
    }
    if (remainingKm <= 1000) {
        return { 
            statusType: 'warning',
            badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-300',
            barClass: 'bg-yellow-500',
            text: `Atenção: faltam ${remainingKm.toLocaleString('pt-BR')} km`, 
            subText: `Revisão aos ${nextServiceKm.toLocaleString('pt-BR')} km`,
            needsAttention: true, 
            nextKm: nextServiceKm,
            remainingKm,
            percentDone
        };
    }
    return { 
        statusType: 'ok',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        barClass: 'bg-emerald-500',
        text: `Em dia: faltam ${remainingKm.toLocaleString('pt-BR')} km`, 
        subText: `Revisão aos ${nextServiceKm.toLocaleString('pt-BR')} km`,
        needsAttention: false, 
        nextKm: nextServiceKm,
        remainingKm,
        percentDone
    };
  };

  // Helper para métricas de lavagem
  const getWashStatus = (vehicle: Vehicle) => {
    if (!vehicle.lastWashDate) {
        return { hasRecord: false, text: 'Sem Registro', urgent: false, days: null, dateStr: 'Não informada', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    
    const lastWash = new Date(vehicle.lastWashDate);
    const diffTime = Math.abs(new Date().getTime() - lastWash.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays > 30) {
        return { 
            hasRecord: true, 
            text: `${diffDays} dias atrás`, 
            urgent: true, 
            days: diffDays, 
            dateStr: lastWash.toLocaleDateString('pt-BR'),
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-black'
        };
    }
    if (diffDays > 15) {
        return { 
            hasRecord: true, 
            text: `${diffDays} dias atrás`, 
            urgent: false, 
            days: diffDays, 
            dateStr: lastWash.toLocaleDateString('pt-BR'),
            badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
        };
    }
    return { 
        hasRecord: true, 
        text: 'Em dia', 
        urgent: false, 
        days: diffDays, 
        dateStr: lastWash.toLocaleDateString('pt-BR'),
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
    };
  };

  // Helper para processar dados de abastecimento agregados
  const getExtendedVehicleData = (vehicle: Vehicle): ExtendedVehicle => {
      const items = fuelData[vehicle.plate] || [];
      
      let totalLiters = 0;
      let totalKm = 0;

      items.forEach(t => {
          const liters = Number(t.litros) || 0;
          const km = Number(t.kmPercorrido) || 0;
          totalLiters += liters;
          totalKm += km;
      });

      let lastBalance = 0;
      let lastDateStr = '';
      if (items.length > 0) {
          const sorted = [...items].sort((a, b) => {
              const dA = a.data ? new Date(a.data).getTime() : 0;
              const dB = b.data ? new Date(b.data).getTime() : 0;
              return dB - dA;
          });
          const latest = sorted[0];
          lastBalance = Number(latest.saldo) || 0;
          lastDateStr = latest.data || '';
      }

      const kmL = totalLiters > 0 && totalKm > 0 ? (totalKm / totalLiters) : 0;

      return {
          ...vehicle,
          veloeLiters: totalLiters,
          veloeTotalKm: totalKm,
          veloeBalance: lastBalance,
          veloeLastTransactionDate: lastDateStr,
          veloeKmL: kmL
      };
  };

  // Filtragem avançada e busca
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
        const isActive = v.isActive !== false;
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;

        const vType = v.type || 'Operações';
        if (typeFilter !== 'all' && vType !== typeFilter) return false;

        if (maintenanceFilter === 'revision_needed') {
            const service = getServiceStatus(v);
            if (!service.needsAttention) return false;
        } else if (maintenanceFilter === 'wash_needed') {
            const wash = getWashStatus(v);
            if (!wash.urgent) return false;
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            const modelMatch = (v.model || '').toLowerCase().includes(term);
            const plateMatch = (v.plate || '').toLowerCase().includes(term);
            const yearMatch = (v.year || '').toString().includes(term);
            const typeMatch = (v.type || '').toLowerCase().includes(term);
            return modelMatch || plateMatch || yearMatch || typeMatch;
        }

        return true;
    }).sort((a, b) => {
        const activeA = a.isActive !== false ? 1 : 0;
        const activeB = b.isActive !== false ? 1 : 0;
        if (activeA !== activeB) return activeB - activeA;
        return a.model.localeCompare(b.model);
    });
  }, [vehicles, statusFilter, typeFilter, maintenanceFilter, searchTerm]);

  // Contadores Globais para os Cards de BI
  const activeCount = useMemo(() => vehicles.filter(v => v.isActive !== false).length, [vehicles]);
  const inactiveCount = useMemo(() => vehicles.filter(v => v.isActive === false).length, [vehicles]);
  const opsCount = useMemo(() => vehicles.filter(v => (v.type || 'Operações') === 'Operações').length, [vehicles]);
  const gestaoCount = useMemo(() => vehicles.filter(v => v.type === 'Gestão').length, [vehicles]);

  const serviceAttentionCount = useMemo(() => {
      return vehicles.filter(v => getServiceStatus(v).needsAttention).length;
  }, [vehicles]);

  const washAttentionCount = useMemo(() => {
      return vehicles.filter(v => getWashStatus(v).urgent).length;
  }, [vehicles]);

  const totalOdometer = useMemo(() => {
      return vehicles.reduce((sum, v) => sum + (v.lastKm || 0), 0);
  }, [vehicles]);

  const handleOpenModal = (vehicle?: Vehicle) => {
    setSelectedVehicle(vehicle || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVehicle(null);
  };

  const parseLocalToDate = (dateString: string) => {
      if (!dateString) return null;
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
  };

  const handleSaveVehicle = async (data: any) => {
    try {
        const processedData = {
            model: data.model,
            plate: (data.plate || '').toUpperCase().trim(),
            year: Number(data.year) || new Date().getFullYear(),
            lastKm: Number(data.lastKm) || 0,
            lastServiceDate: data.lastServiceDate ? parseLocalToDate(data.lastServiceDate) : null as any,
            lastServiceKm: Number(data.lastServiceKm) || 0,
            lastWashDate: data.lastWashDate ? parseLocalToDate(data.lastWashDate) : null as any,
            isActive: data.isActive !== false,
            type: data.type || 'Operações',
            isManual: true,
        };

        if (selectedVehicle) {
          await updateVehicle({ ...selectedVehicle, ...processedData });
        } else {
          await addVehicle({ ...processedData });
        }
        handleCloseModal();
    } catch (err) {
        console.error("Failed to save vehicle", err);
        alert("Erro ao salvar o veículo.");
    }
  };

  const openDeleteConfirm = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsDeleteConfirmOpen(true);
  };
  
  const closeDeleteConfirm = () => {
    setSelectedVehicle(null);
    setIsDeleteConfirmOpen(false);
  };

  const handleDeleteVehicle = async () => {
    if (selectedVehicle) {
      await deleteVehicle(selectedVehicle.id);
    }
    closeDeleteConfirm();
  };

  const handleToggleActiveStatus = async (vehicle: Vehicle) => {
    try {
        const isActive = vehicle.isActive !== false;
        await updateVehicle({ ...vehicle, isActive: !isActive });
    } catch (err) {
        console.error("Failed to toggle vehicle status", err);
        alert("Erro ao alterar o status do veículo.");
    }
  };

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const years = Array.from({length: 5}, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6 flex flex-col space-y-5 custom-scrollbar bg-slate-50/60">
      
      {/* 1. Header Principal com Design Sofisticado */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#114D38] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Gestão de Frota e Ativos
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                    • Módulo Operacional
                </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Frota de Veículos</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200/80">
                    {vehicles.length} {vehicles.length === 1 ? 'veículo' : 'veículos'}
                </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
                Acompanhamento de status operacional, cronograma de revisões, lavagens e integração com abastecimento.
            </p>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto justify-start lg:justify-end flex-wrap">
          <button 
            onClick={() => handleOpenModal()} 
            className="bg-[#114D38] hover:bg-[#0d3b2c] text-white font-black py-2.5 px-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 text-xs md:text-sm shrink-0 cursor-pointer group"
          >
            <div className="w-5 h-5 rounded-lg bg-emerald-600/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CarIcon className="h-3.5 w-3.5 text-white"/>
            </div>
            <span>Cadastrar Novo Veículo</span>
          </button>
        </div>
      </div>

      {/* 2. Cards Analíticos de Frota (KPIs em Estilo Looker BI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total da Frota & Disponibilidade */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Frota Ativa</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#114D38]">
                      <CarIcon className="w-4 h-4" />
                  </div>
              </div>
              <div className="mt-2">
                  <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 font-sans tracking-tight">{activeCount}</span>
                      <span className="text-xs font-bold text-slate-400">de {vehicles.length} veículos</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${vehicles.length > 0 ? (activeCount / vehicles.length) * 100 : 0}%` }}
                          ></div>
                      </div>
                      <span className="text-[10px] font-black text-emerald-700">
                          {vehicles.length > 0 ? Math.round((activeCount / vehicles.length) * 100) : 0}%
                      </span>
                  </div>
              </div>
          </div>

          {/* Card 2: Segmentação por Tipo (Operações vs Gestão) */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tipo de Alocação</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                      <ClipboardListIcon className="w-4 h-4" />
                  </div>
              </div>
              <div className="mt-2">
                  <div className="flex items-center justify-between">
                      <div>
                          <span className="text-lg font-black text-slate-800">{opsCount}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Operações</span>
                      </div>
                      <div className="w-px h-7 bg-slate-200"></div>
                      <div>
                          <span className="text-lg font-black text-slate-800">{gestaoCount}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Gestão</span>
                      </div>
                      <div className="w-px h-7 bg-slate-200"></div>
                      <div>
                          <span className="text-lg font-black text-rose-600">{inactiveCount}</span>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Inativos</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* Card 3: Monitor de Revisões Preventivas */}
          <div className={`p-4.5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all ${
              serviceAttentionCount > 0 
                ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400' 
                : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}>
              <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Revisões Preventivas</span>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                      serviceAttentionCount > 0 
                        ? 'bg-amber-100 text-amber-800 border-amber-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                      <ClockIcon className="w-4 h-4" />
                  </div>
              </div>
              <div className="mt-2">
                  <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black font-sans tracking-tight ${serviceAttentionCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                          {serviceAttentionCount}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                          {serviceAttentionCount === 1 ? 'veículo requer atenção' : 'veículos requerem atenção'}
                      </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                      Intervalo de troca/revisão: a cada 10.000 km
                  </span>
              </div>
          </div>

          {/* Card 4: Monitor de Lavagem & Higienização */}
          <div className={`p-4.5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all ${
              washAttentionCount > 0 
                ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400' 
                : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}>
              <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Higienização / Lavagem</span>
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                      washAttentionCount > 0 
                        ? 'bg-rose-100 text-rose-800 border-rose-200' 
                        : 'bg-teal-50 text-teal-700 border-teal-100'
                  }`}>
                      <span className="text-sm">✨</span>
                  </div>
              </div>
              <div className="mt-2">
                  <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black font-sans tracking-tight ${washAttentionCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {washAttentionCount}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                          {washAttentionCount === 1 ? 'lavagem atrasada (>30d)' : 'lavagens atrasadas (>30d)'}
                      </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                      Frota limpa e preservada para uso corporativo
                  </span>
              </div>
          </div>

      </div>

      {/* 3. Barra de Filtros, Pesquisa Rápida e Abastecimento */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              
              {/* Barra de Pesquisa */}
              <div className="relative w-full md:w-80">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                  </div>
                  <input 
                      type="text"
                      placeholder="Buscar por placa, modelo ou ano..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                  />
                  {searchTerm && (
                      <button 
                          onClick={() => setSearchTerm('')} 
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                          <XIcon className="w-3.5 h-3.5" />
                      </button>
                  )}
              </div>

              {/* Pílulas de Filtro de Status */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                  
                  {/* Status: Ativos / Inativos / Todos */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-inner shrink-0">
                      <button
                          onClick={() => setStatusFilter('active')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              statusFilter === 'active'
                                  ? 'bg-white text-[#114D38] shadow-xs font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Ativos</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 font-black">{activeCount}</span>
                      </button>

                      <button
                          onClick={() => setStatusFilter('inactive')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              statusFilter === 'inactive'
                                  ? 'bg-white text-slate-800 shadow-xs font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>Inativos</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">{inactiveCount}</span>
                      </button>

                      <button
                          onClick={() => setStatusFilter('all')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              statusFilter === 'all'
                                  ? 'bg-white text-slate-800 shadow-xs font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                          <span>Todos</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">{vehicles.length}</span>
                      </button>
                  </div>

                  {/* Filtro de Tipo */}
                  <select 
                      value={typeFilter} 
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-emerald-600 cursor-pointer shrink-0"
                  >
                      <option value="all">Tipo: Todos</option>
                      <option value="Operações">Operações / Campo</option>
                      <option value="Gestão">Gestão / Diretoria</option>
                  </select>

                  {/* Filtro de Alerta de Manutenção */}
                  <select 
                      value={maintenanceFilter} 
                      onChange={(e) => setMaintenanceFilter(e.target.value as any)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none cursor-pointer shrink-0 ${
                          maintenanceFilter !== 'all' 
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-black' 
                            : 'bg-white border-slate-200 text-slate-700 focus:border-emerald-600'
                      }`}
                  >
                      <option value="all">Manutenção: Todas</option>
                      <option value="revision_needed">⚠️ Revisão Pendente/Vencida</option>
                      <option value="wash_needed">✨ Lavagem Pendente (&gt;30d)</option>
                  </select>

              </div>
          </div>

          {/* Barra de Filtros de Abastecimento (Controle de Frota Leve) */}
          {canViewFuelData && (
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 flex flex-col md:flex-row items-center gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[#114D38] font-black uppercase tracking-wider">
                      <GasPumpIcon className="h-4 w-4 text-emerald-600" />
                      <span>Filtro de Abastecimento:</span>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
                      <button 
                        onClick={() => setFilterMode('month')}
                        className={`px-3 py-1 rounded-lg font-black transition-colors ${filterMode === 'month' ? 'bg-[#114D38] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                          Mensal
                      </button>
                      <button 
                        onClick={() => setFilterMode('custom')}
                        className={`px-3 py-1 rounded-lg font-black transition-colors ${filterMode === 'custom' ? 'bg-[#114D38] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                          Personalizado
                      </button>
                  </div>

                  {filterMode === 'month' ? (
                      <div className="flex items-center gap-2">
                          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border border-slate-200 rounded-xl px-2.5 py-1 bg-white font-bold text-slate-700 focus:ring-1 focus:ring-emerald-500">
                              {months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                          </select>
                          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="border border-slate-200 rounded-xl px-2.5 py-1 bg-white font-bold text-slate-700 focus:ring-1 focus:ring-emerald-500">
                              {years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2">
                          <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border border-slate-200 rounded-xl px-2.5 py-1 bg-white font-medium text-slate-700" />
                          <span className="text-slate-400 font-bold">até</span>
                          <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border border-slate-200 rounded-xl px-2.5 py-1 bg-white font-medium text-slate-700" />
                      </div>
                  )}
                  
                  {isLoadingFuel && <span className="text-[11px] text-emerald-700 font-bold animate-pulse ml-auto">Sincronizando abastecimentos...</span>}
              </div>
          )}
      </div>

      {/* 4. Tabela de Veículos (Desktop de Alto Padrão Visual) */}
      <div className="hidden md:block overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#114D38] text-white text-[10px] font-black uppercase tracking-wider border-b border-[#0d3b2c]">
                <th scope="col" className="py-4 px-5 text-left">Placa / Veículo</th>
                <th scope="col" className="py-4 px-5 text-left">Hodômetro Atual</th>
                <th scope="col" className="py-4 px-5 text-left">Revisão Preventiva (10k)</th>
                <th scope="col" className="py-4 px-5 text-left">Higienização</th>
                
                {/* Coluna Tipo */}
                {(user?.email === 'deny.goncalves@risel.com.br' || user?.email === 'deny.risel@gmail.com' || user?.email === 'lorena.padilha@risel.com.br') && (
                  <th scope="col" className="py-4 px-5 text-left">Alocação</th>
                )}

                {/* Colunas de Abastecimento - Controle de Frota Leve */}
                {canViewFuelData && (
                    <>
                      <th scope="col" className="py-4 px-5 text-left border-l border-emerald-800/40">Abast. (L)</th>
                      <th scope="col" className="py-4 px-5 text-left">KM Rodado</th>
                      <th scope="col" className="py-4 px-5 text-left">Eficiência (KM/L)</th>
                      <th scope="col" className="py-4 px-5 text-left">Saldo Posto</th>
                    </>
                )}
                
                <th scope="col" className="py-4 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {filteredVehicles.length === 0 ? (
                  <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                              <CarIcon className="w-8 h-8 opacity-30 text-slate-400" />
                              <span className="font-bold text-sm">Nenhum veículo encontrado para os filtros selecionados.</span>
                              <button 
                                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setMaintenanceFilter('all'); }}
                                  className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                              >
                                  Limpar filtros
                              </button>
                          </div>
                      </td>
                  </tr>
              ) : (
                filteredVehicles.map(v => {
                  const vehicle = getExtendedVehicleData(v);
                  const serviceStatus = getServiceStatus(vehicle);
                  const washStatus = getWashStatus(vehicle);
                  
                  const kmL = vehicle.veloeKmL || 0;
                  let kmLClass = "text-slate-500 bg-slate-50 border-slate-200";
                  if (kmL > 0) {
                      kmLClass = kmL >= 10 
                          ? "text-emerald-800 bg-emerald-50 border-emerald-200" 
                          : "text-amber-800 bg-amber-50 border-amber-200";
                  }

                  const isActive = vehicle.isActive !== false;
                  
                  return (
                    <tr 
                      key={vehicle.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        !isActive ? 'bg-slate-50/60 opacity-60' : ''
                      }`}
                    >
                      {/* Placa Mercosul + Modelo e Identificação */}
                      <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3.5">
                              {/* Placa Mercosul Realista */}
                              <MercosulPlateBadge plate={vehicle.plate} isInactive={!isActive} />

                              {/* Modelo e Informações do Veículo */}
                              <div className="flex flex-col">
                                  <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                                      <span>{toTitleCase(vehicle.model)}</span>
                                      {!isActive && (
                                          <span className="text-[9px] bg-slate-200 text-slate-700 font-black px-1.5 py-0.5 rounded uppercase">
                                              Inativo
                                          </span>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[11px] font-bold text-slate-400">
                                          Ano {vehicle.year}
                                      </span>
                                      <span className="text-slate-300">•</span>
                                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                          vehicle.type === 'Gestão' 
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60' 
                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                      }`}>
                                          {vehicle.type || 'Operações'}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      </td>

                      {/* Hodômetro Atual */}
                      <td className="px-5 py-4 whitespace-nowrap">
                           <div className="flex items-center gap-1.5">
                               <RouteIcon className="w-3.5 h-3.5 text-slate-400" />
                               <span className="text-sm font-black font-mono text-slate-800">
                                   {vehicle.lastKm ? `${vehicle.lastKm.toLocaleString('pt-BR')} km` : '0 km'}
                                </span>
                           </div>
                           <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Último registro</span>
                      </td>

                      {/* Revisão Preventiva com Mini Barra de Progresso */}
                      <td className="px-5 py-4 whitespace-nowrap min-w-[180px]">
                           <div className={`px-2.5 py-1 rounded-xl border inline-flex items-center gap-1.5 ${serviceStatus.badgeClass}`}>
                               <span className={`w-2 h-2 rounded-full ${serviceStatus.barClass}`}></span>
                               <span className="text-[11px] font-black tracking-tight">{serviceStatus.text}</span>
                           </div>
                           <div className="mt-1.5 w-36 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                               <div 
                                   className={`h-full rounded-full ${serviceStatus.barClass}`} 
                                   style={{ width: `${serviceStatus.percentDone}%` }}
                               ></div>
                           </div>
                           <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{serviceStatus.subText}</span>
                      </td>

                      {/* Higienização / Lavagem */}
                      <td className="px-5 py-4 whitespace-nowrap">
                           <div className={`px-2.5 py-1 rounded-xl border inline-flex items-center gap-1.5 ${washStatus.badgeClass}`}>
                               <span className="text-xs">✨</span>
                               <span className="text-[11px] tracking-tight">{washStatus.text}</span>
                           </div>
                           <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                               <CalendarIcon className="w-3 h-3 text-slate-300" />
                               <span>{washStatus.dateStr}</span>
                           </div>
                      </td>
                      
                      {/* Coluna Tipo de Alocação */}
                      {(user?.email === 'deny.goncalves@risel.com.br' || user?.email === 'deny.risel@gmail.com' || user?.email === 'lorena.padilha@risel.com.br') && (
                          <td className="px-5 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${
                                  vehicle.type === 'Gestão' 
                                    ? 'bg-blue-50 text-blue-800 border-blue-200' 
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                  {vehicle.type || 'Operações'}
                              </span>
                          </td>
                      )}

                      {/* Dados de Abastecimento do Controle de Frota Leve */}
                      {canViewFuelData && (
                          <>
                              <td className="px-5 py-4 whitespace-nowrap bg-slate-50/40 border-l border-slate-100">
                                  <div className="flex items-center gap-1.5">
                                      <GasPumpIcon className="h-3.5 w-3.5 text-emerald-600" />
                                      <span className="text-xs font-black text-slate-800">
                                          {vehicle.veloeLiters ? vehicle.veloeLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'} L
                                      </span>
                                  </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap bg-slate-50/40">
                                  <div className="flex items-center gap-1.5">
                                      <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                                      <span className="text-xs font-black text-slate-800">
                                          {vehicle.veloeTotalKm ? vehicle.veloeTotalKm.toLocaleString('pt-BR') : '0'} km
                                      </span>
                                  </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap bg-slate-50/40">
                                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${kmLClass}`}>
                                      {kmL > 0 ? `${kmL.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/l` : '-'}
                                  </span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap bg-slate-50/40">
                                  <div className="flex items-center gap-1.5">
                                      <CreditCardIcon className="h-3.5 w-3.5 text-slate-400" />
                                      <span className={`text-xs font-black ${(vehicle.veloeBalance || 0) < 300 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                          R$ {vehicle.veloeBalance ? vehicle.veloeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                      </span>
                                  </div>
                              </td>
                          </>
                      )}

                      {/* Ações */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                              <button 
                                  onClick={() => handleToggleActiveStatus(vehicle)} 
                                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                      vehicle.isActive === false 
                                          ? 'text-slate-500 bg-slate-100 hover:bg-slate-200 border-slate-200' 
                                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                  }`} 
                                  title={vehicle.isActive === false ? 'Ativar Veículo na Frota' : 'Inativar / Bloquear Veículo'}
                              >
                                  {vehicle.isActive === false ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                              </button>
                              <button 
                                  onClick={() => handleOpenModal(vehicle)} 
                                  className="p-2 text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer" 
                                  title="Editar Cadastro do Veículo"
                              >
                                  <PencilIcon className="h-4 w-4" />
                              </button>
                              <button 
                                  onClick={() => openDeleteConfirm(vehicle)} 
                                  className="p-2 text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer" 
                                  title="Excluir Permanentemente"
                              >
                                  <TrashIcon className="h-4 w-4" />
                              </button>
                          </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Cards para Visualização Mobile */}
      <div className="md:hidden space-y-3.5 overflow-y-auto flex-grow">
        {filteredVehicles.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl text-center text-slate-400 font-bold text-sm">
                Nenhum veículo encontrado.
            </div>
        ) : (
          filteredVehicles.map(v => {
            const vehicle = getExtendedVehicleData(v);
            const serviceStatus = getServiceStatus(vehicle);
            const washStatus = getWashStatus(vehicle);
            
            const kmL = vehicle.veloeKmL || 0;
            const isActive = vehicle.isActive !== false;

            return (
              <div 
                key={vehicle.id} 
                className={`p-4.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3.5 ${
                  !isActive ? 'opacity-70 bg-slate-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3">
                       <MercosulPlateBadge plate={vehicle.plate} isInactive={!isActive} />
                       <div>
                           <p className="text-sm font-black text-slate-900">
                               {vehicle.model}
                           </p>
                           <p className="text-xs text-slate-500 font-bold">
                               Ano {vehicle.year} • {vehicle.type || 'Operações'}
                           </p>
                       </div>
                   </div>
                   <div className="flex items-center gap-1">
                     <button onClick={() => handleToggleActiveStatus(vehicle)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600">
                         {vehicle.isActive === false ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                     </button>
                     <button onClick={() => handleOpenModal(vehicle)} className="p-1.5 text-blue-600 border border-blue-200 rounded-lg">
                         <PencilIcon className="h-4 w-4" />
                     </button>
                     <button onClick={() => openDeleteConfirm(vehicle)} className="p-1.5 text-rose-600 border border-rose-200 rounded-lg">
                         <TrashIcon className="h-4 w-4" />
                     </button>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">KM Atual</span>
                        <span className="font-mono font-black text-slate-800">{vehicle.lastKm ? `${vehicle.lastKm.toLocaleString('pt-BR')} km` : '0 km'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Revisão</span>
                        <span className={`text-[11px] font-black ${serviceStatus.needsAttention ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {serviceStatus.text}
                        </span>
                    </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        title={
            <div className="flex items-center gap-2 text-[#114D38]">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <CarIcon className="h-4.5 w-4.5" />
                </div>
                <span className="font-black text-lg">{selectedVehicle ? 'Editar Cadastro do Veículo' : 'Cadastrar Novo Veículo'}</span>
            </div>
        }
      >
        <VehicleForm
            vehicle={selectedVehicle}
            onSave={handleSaveVehicle}
            onCancel={handleCloseModal}
            canEditType={user?.email === 'deny.goncalves@risel.com.br' || user?.email === 'deny.risel@gmail.com' || user?.email === 'lorena.padilha@risel.com.br'}
        />
      </Modal>

      {/* Modal de Exclusão */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={closeDeleteConfirm} title="Confirmar Exclusão de Veículo">
        <div className="space-y-4">
            <p className="text-slate-700 text-sm leading-relaxed">
                Tem certeza que deseja excluir permanentemente o veículo <strong className="text-slate-900 font-black">{selectedVehicle?.model} ({selectedVehicle?.plate})</strong>?
            </p>
            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span>Esta ação removerá o cadastro do veículo da frota do submódulo de reservas.</span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button 
                    onClick={closeDeleteConfirm} 
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleDeleteVehicle} 
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md hover:shadow-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                    <TrashIcon className="w-4 h-4" />
                    <span>Excluir Veículo</span>
                </button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default VehiclesView;

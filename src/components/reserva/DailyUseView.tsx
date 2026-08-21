
import React, { useState, useMemo } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { DailyTrip, ReservationStatus, FuelLevel, Vehicle } from '../../types_reserva';
import Modal from './Modal';
import { CarIcon, PencilIcon, TrashIcon, CameraIcon, ExclamationTriangleIcon, SteeringWheelIcon, ClockIcon, ClipboardListIcon, FunnelIcon } from './icons';
import { SP_CITIES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import DailyTripEditModal from './DailyTripEditModal';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import { fetchDistanceWithGemini } from '../../services/geminiService';

const FuelLevelInput: React.FC<{ name: string, value: FuelLevel | undefined, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, label?: string }> = ({ name, value, onChange, label = "Nível do Tanque" }) => {
  const levels = Object.values(FuelLevel);
  const widths: Record<FuelLevel, string> = {
    [FuelLevel.Empty]: '0%',
    [FuelLevel.Quarter]: '25%',
    [FuelLevel.Half]: '50%',
    [FuelLevel.ThreeQuarters]: '75%',
    [FuelLevel.Full]: '100%',
  };
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-2 flex items-center border border-gray-300 rounded-md p-1 space-x-1">
        {levels.map((level) => (
          <div key={level} className="flex-1">
            <input type="radio" id={`${name}-${level}`} name={name} value={level} checked={value === level} onChange={onChange} className="sr-only peer" />
            <label htmlFor={`${name}-${level}`} className={`cursor-pointer block text-center text-xs py-1.5 rounded-sm transition-colors duration-200 ease-in-out ${value === level ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {level}
            </label>
          </div>
        ))}
      </div>
      <div className="w-full h-2 bg-gray-200 rounded mt-2 border border-gray-300">
        <div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-l" style={{ width: value ? widths[value] : '0%' }}></div>
      </div>
    </div>
  );
};

const FuelLevelDisplay: React.FC<{ level: FuelLevel | undefined, compact?: boolean }> = ({ level, compact = false }) => {
    if (!level) return <span className="text-gray-400 text-xs">N/A</span>;
    
    const widths: Record<FuelLevel, string> = {
        [FuelLevel.Empty]: '10%',
        [FuelLevel.Quarter]: '25%',
        [FuelLevel.Half]: '50%',
        [FuelLevel.ThreeQuarters]: '75%',
        [FuelLevel.Full]: '100%',
    };
    const colors: Record<FuelLevel, string> = {
        [FuelLevel.Empty]: 'bg-red-500',
        [FuelLevel.Quarter]: 'bg-yellow-400',
        [FuelLevel.Half]: 'bg-yellow-400',
        [FuelLevel.ThreeQuarters]: 'bg-green-500',
        [FuelLevel.Full]: 'bg-green-500',
    };

    if (compact) {
        return (
            <div className="flex flex-col items-center" title={level}>
                 <div className="w-8 h-1.5 bg-gray-200 rounded-full border border-gray-300 overflow-hidden mb-0.5">
                    <div className={`h-full ${colors[level]}`} style={{ width: widths[level] }}></div>
                </div>
                <span className="text-[10px] text-gray-600 font-bold leading-none">{level}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 w-12">{level}</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full border border-gray-300 overflow-hidden">
                <div className={`h-full ${colors[level]}`} style={{ width: widths[level] }}></div>
            </div>
        </div>
    );
};

// Helper para formatar milhares
const formatNum = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    return val.toLocaleString('pt-BR');
};

// Helper para calcular duração
const formatDuration = (start: Date | string, end?: Date | string) => {
    if (!end) return '';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - startTime;
    
    if (diff < 0) return '';

    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
};

interface DailyUseViewProps {
  isAdmin?: boolean;
}

const DailyUseView: React.FC<DailyUseViewProps> = ({ isAdmin = true }) => {
    const { dailyTrips, reservations, vehicles, getVehicleById, addDailyTrip, endTrip, updateDailyTrip, deleteDailyTrip } = useReservations();
    
    // State for Tabs
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

    // State for Filters (Admin)
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterVehicleId, setFilterVehicleId] = useState('');
    const [filterSearch, setFilterSearch] = useState('');

    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedTrip, setSelectedTrip] = useState<DailyTrip | null>(null);
    const [returnFormData, setReturnFormData] = useState({ 
        finalKm: '', 
        finalFuelLevel: FuelLevel.Full,
        actualReturnDateTime: ''
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [minDateTime, setMinDateTime] = useState('');


    const initialAddFormData = {
        requesterName: '',
        department: '',
        driverName: '',
        vehicleId: '',
        departureDateTime: '',
        destination: '',
        destinationCity: '',
        purpose: '',
        initialKm: 0,
        initialFuelLevel: FuelLevel.Full,
    };
    const [addFormData, setAddFormData] = useState(initialAddFormData);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 5000);
    };

    // --- Filtering Logic ---
    const applyFilters = (trips: DailyTrip[]) => {
        return trips.filter(t => {
             // Date Range (Start Date)
             if (filterStartDate) {
                const tDate = new Date(t.departureDateTime);
                const fStart = new Date(filterStartDate);
                fStart.setHours(0,0,0,0);
                if (tDate < fStart) return false;
            }
            if (filterEndDate) {
                const tDate = new Date(t.departureDateTime);
                const fEnd = new Date(filterEndDate);
                fEnd.setHours(23,59,59,999);
                if (tDate > fEnd) return false;
            }
            // Vehicle
            if (filterVehicleId && t.vehicleId !== filterVehicleId) return false;
            // Search (Driver, Department, Destination)
            if (filterSearch) {
                const term = filterSearch.toLowerCase();
                const match = (t.driverName || '').toLowerCase().includes(term) ||
                              (t.department || '').toLowerCase().includes(term) ||
                              (t.destination || '').toLowerCase().includes(term) ||
                              (t.destinationCity || '').toLowerCase().includes(term);
                if (!match) return false;
            }
            return true;
        });
    };

    const rawActiveTrips = dailyTrips.filter(r => r.status === ReservationStatus.InUse)
        .sort((a, b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());
        
    const rawCompletedTrips = dailyTrips.filter(r => r.status === ReservationStatus.Completed)
        .sort((a, b) => (b.actualReturnDateTime ? new Date(b.actualReturnDateTime).getTime() : 0) - (a.actualReturnDateTime ? new Date(a.actualReturnDateTime).getTime() : 0));

    const filteredActiveTrips = useMemo(() => applyFilters(rawActiveTrips), [rawActiveTrips, filterStartDate, filterEndDate, filterVehicleId, filterSearch]);
    const filteredCompletedTrips = useMemo(() => applyFilters(rawCompletedTrips), [rawCompletedTrips, filterStartDate, filterEndDate, filterVehicleId, filterSearch]);


    const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const upperCaseFields = ['driverName', 'department', 'destination', 'destinationCity', 'purpose'];
        const finalValue = upperCaseFields.includes(name) ? value.toUpperCase() : value;

        if (name === 'vehicleId') {
            const vehicle = getVehicleById(value);
            if (vehicle) {
                const lastTripForVehicle = dailyTrips
                    .filter(t => t.vehicleId === value && t.status === ReservationStatus.Completed && t.finalKm != null)
                    .sort((a, b) => new Date(b.actualReturnDateTime!).getTime() - new Date(a.actualReturnDateTime!).getTime())[0];
                
                const lastKm = lastTripForVehicle?.finalKm || vehicle.lastKm || vehicle.initialKm || 0;

                const kmSinceService = lastKm - (vehicle.lastServiceKm || 0);
                if (kmSinceService >= 10000) {
                    alert(`ATENÇÃO: A revisão para o veículo ${vehicle.model} está PENDENTE!\nÚltima revisão: ${vehicle.lastServiceKm} km\nKM Atual: ${lastKm} km.\n\nPor favor, realize a manutenção antes de uma nova viagem.`);
                }
                setAddFormData(prev => ({ ...prev, vehicleId: value, initialKm: lastKm }));
            }
        } else {
            setAddFormData(prev => ({ ...prev, [name]: finalValue }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { initialKm, ...restOfData } = addFormData;
            const tripDate = new Date(addFormData.departureDateTime);
            
            // Calculate estimated distance
            let estimatedDistance = 0;
            if (addFormData.destinationCity) {
                try {
                  const { distance } = await fetchDistanceWithGemini('Paulínia/SP', addFormData.destinationCity);
                  if (distance) estimatedDistance = distance;
                } catch (geminiError) {
                  console.warn("Failed to calculate estimate distance for daily trip (admin)", geminiError);
                }
            }

            await addDailyTrip({
                ...restOfData,
                requesterName: 'Admin', // Admin is the requester from this view
                initialKm: Number(initialKm),
                initialFuelLevel: addFormData.initialFuelLevel,
                departureDateTime: tripDate,
                distanceKm: estimatedDistance > 0 ? estimatedDistance : undefined // Store estimated distance
            });

            // --- ENVIO DE EMAIL (ADMIN START) ---
            const vehicle = getVehicleById(addFormData.vehicleId);
            const emailHtml = generateEmailHtml(
                "Início de Uso Diário (Admin)",
                [
                    { label: "Motorista", value: addFormData.driverName },
                    { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                    { label: "Saída", value: tripDate.toLocaleString('pt-BR') },
                    { label: "Destino", value: `${addFormData.destinationCity} - ${addFormData.destination}` },
                    { label: "KM Inicial", value: `${initialKm} km` },
                    { label: "Nível Tanque", value: addFormData.initialFuelLevel },
                    { label: "Motivo", value: addFormData.purpose }
                ],
                "#00753f",
                undefined,
                "Viagem iniciada pelo painel administrativo."
            );
            // Envia para admins
            await sendEmail(ADMIN_EMAIL_RECIPIENTS, `Início de Uso Diário - ${addFormData.driverName}`, emailHtml);
            // --------------------------------------

            setIsAddModalOpen(false);
            setAddFormData(initialAddFormData);
            showToast("Utilização adicionada com sucesso!", "success");
        } catch (error: any) {
            showToast(error.message || "Erro ao adicionar utilização.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setAddFormData(initialAddFormData);
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for timezone
        setMinDateTime(isAdmin ? '' : now.toISOString().slice(0, 16));
        setIsAddModalOpen(true);
    };

    const handleOpenReturnModal = (trip: DailyTrip) => {
        setSelectedTrip(trip);
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setReturnFormData({
            finalKm: '',
            finalFuelLevel: trip.initialFuelLevel || FuelLevel.Full,
            actualReturnDateTime: now.toISOString().slice(0, 16)
        });
        setIsReturnModalOpen(true);
    };

    const handleReturnFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setReturnFormData({ ...returnFormData, [e.target.name]: e.target.value });
    };

    const handleReturnSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedTrip && returnFormData.actualReturnDateTime && returnFormData.finalKm) {
            try {
                const returnDate = new Date(returnFormData.actualReturnDateTime);
                const finalKm = Number(returnFormData.finalKm);

                // Permitir KM menor se for Admin (Correção de Hodômetro)
                if (finalKm < (selectedTrip.initialKm || 0)) {
                    if (!isAdmin) {
                        showToast(`O KM final deve ser maior ou igual ao KM inicial (${selectedTrip.initialKm})`, "error");
                        return;
                    }
                    // Se for Admin, permite, mas loga aviso ou mostra toast informativo (opcional)
                    console.warn(`Admin ajustando KM para valor menor: ${selectedTrip.initialKm} -> ${finalKm}`);
                }

                await endTrip(selectedTrip.id, returnDate, finalKm, returnFormData.finalFuelLevel as FuelLevel);

                 // --- ENVIO DE EMAIL (ADMIN END) ---
                const vehicle = getVehicleById(selectedTrip.vehicleId);
                const distance = finalKm - (selectedTrip.initialKm || 0);

                const emailHtml = generateEmailHtml(
                    "Fim de Uso Diário (Admin)",
                    [
                        { label: "Motorista", value: selectedTrip.driverName },
                        { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                        { label: "Saída", value: new Date(selectedTrip.departureDateTime).toLocaleString('pt-BR') },
                        { label: "Retorno", value: returnDate.toLocaleString('pt-BR') },
                        { label: "KM Final", value: `${finalKm} km` },
                        { label: "KM Percorrido", value: `${distance} km` },
                        { label: "Tanque (Chegada)", value: returnFormData.finalFuelLevel },
                    ],
                    "#00753f",
                    undefined,
                    "Viagem finalizada pelo painel administrativo."
                );
                await sendEmail(ADMIN_EMAIL_RECIPIENTS, `Fim de Uso Diário - ${selectedTrip.driverName}`, emailHtml);
                // --------------------------------------

                setIsReturnModalOpen(false);
                setSelectedTrip(null);
                showToast("Retorno registrado com sucesso! KM do veículo atualizado.", "success");
            } catch (error: any) {
                showToast(error.message || "Erro ao registrar retorno.", "error");
            }
        } else {
            showToast("Preencha todos os campos obrigatórios", "error");
        }
    };

    const handleOpenEditModal = (trip: DailyTrip) => { setSelectedTrip(trip); setIsEditModalOpen(true); }
    const handleSaveEdit = async (updatedData: Partial<DailyTrip>) => { 
        if(selectedTrip) { 
            try {
                await updateDailyTrip(selectedTrip.id, updatedData); 
                setIsEditModalOpen(false); 
                setSelectedTrip(null);
                showToast("Viagem atualizada com sucesso!", "success");
            } catch(error: any) {
                showToast(error.message || "Erro ao atualizar viagem.", "error");
            }
        } 
    }
    const handleOpenDeleteModal = (trip: DailyTrip) => { setSelectedTrip(trip); setIsDeleteModalOpen(true); }
    const handleDelete = async () => { 
        if(selectedTrip) { 
            try {
                await deleteDailyTrip(selectedTrip.id); 
                setIsDeleteModalOpen(false); 
                setSelectedTrip(null);
                showToast("Viagem excluída com sucesso.", "success");
            } catch (error: any) {
                showToast(error.message || "Erro ao excluir viagem.", "error");
            }
        } 
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 w-full text-left overflow-hidden">
            {toast && (
                <div className={`fixed top-20 right-6 text-white py-2 px-5 rounded-lg shadow-lg z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.message}
                </div>
            )}
             <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Adicionar Utilização (Admin)">
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="vehicleId" className="block text-sm font-medium text-gray-700">Veículo</label>
                           <select name="vehicleId" value={addFormData.vehicleId} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary">
                               <option value="" disabled>Selecione um veículo</option>
                               {vehicles.filter(v => {
                                 return v.isActive !== false || v.id === addFormData.vehicleId;
                               }).map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>)}
                           </select>
                       </div>
                       <div>
                            <label htmlFor="initialKm" className="block text-sm font-medium text-gray-700">KM Inicial</label>
                            <input type="number" name="initialKm" value={addFormData.initialKm} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="driverName" className="block text-sm font-medium text-gray-700">Motorista</label>
                            <input type="text" name="driverName" value={addFormData.driverName} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                        </div>
                        <div>
                            <label htmlFor="departureDateTime" className="block text-sm font-medium text-gray-700">Data e Hora de Saída</label>
                            <input type="datetime-local" name="departureDateTime" value={addFormData.departureDateTime} onChange={handleAddFormChange} required min={minDateTime} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <hr className="md:col-span-2 my-2"/>
                         <div>
                            <label htmlFor="department" className="block text-sm font-medium text-gray-700">Setor</label>
                            <input type="text" name="department" value={addFormData.department} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                        </div>
                        
                        <div>
                           <label htmlFor="destinationCity" className="block text-sm font-medium text-gray-700">Cidade de Destino</label>
                           <input type="text" name="destinationCity" value={addFormData.destinationCity} onChange={handleAddFormChange} list="cities" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                           <datalist id="cities">{SP_CITIES.map(city => <option key={city} value={city} />)}</datalist>
                        </div>
                         <div className="md:col-span-2">
                           <label htmlFor="destination" className="block text-sm font-medium text-gray-700">Local de Destino</label>
                           <input type="text" name="destination" value={addFormData.destination} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                        </div>
                        
                        <div className="md:col-span-2 bg-gray-50 p-3 rounded border border-gray-200">
                           <FuelLevelInput name="initialFuelLevel" value={addFormData.initialFuelLevel} onChange={handleAddFormChange} label="Nível do Tanque (Saída)" />
                        </div>

                         <div className="md:col-span-2">
                           <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">Motivo/Finalidade</label>
                           <input type="text" name="purpose" value={addFormData.purpose} onChange={handleAddFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800">
                            {isLoading ? 'Salvando...' : 'Adicionar Utilização'}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Registrar Retorno do Veículo">
                {selectedTrip && (
                    <form onSubmit={handleReturnSubmit} className="space-y-4">
                        <p>Registrando o retorno para <strong>{selectedTrip.driverName}</strong> com o veículo <strong>{getVehicleById(selectedTrip.vehicleId)?.model}</strong>.</p>
                        <div>
                            <label htmlFor="actualReturnDateTime" className="block text-sm font-medium text-gray-700">Data e Hora de Retorno</label>
                            <input 
                              type="datetime-local" 
                              name="actualReturnDateTime" 
                              value={returnFormData.actualReturnDateTime} 
                              onChange={handleReturnFormChange} 
                              required 
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" 
                            />
                        </div>

                         <div>
                            <label htmlFor="finalKm" className="block text-sm font-medium text-gray-700">KM Final</label>
                            <input 
                                type="number" 
                                name="finalKm" 
                                value={returnFormData.finalKm} 
                                onChange={handleReturnFormChange} 
                                required 
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" 
                                placeholder={`Min: ${selectedTrip.initialKm}`}
                            />
                            {isAdmin && (
                                <p className="text-xs text-orange-600 mt-1 font-semibold">
                                    * Modo Admin: Você pode inserir um KM menor para correção.
                                </p>
                            )}
                        </div>
                        
                        <FuelLevelInput name="finalFuelLevel" value={returnFormData.finalFuelLevel as FuelLevel} onChange={handleReturnFormChange} label="Nível do Tanque (Retorno)" />
                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={() => setIsReturnModalOpen(false)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300">Cancelar</button>
                            <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800">Confirmar Retorno</button>
                        </div>
                    </form>
                )}
            </Modal>
            {selectedTrip && isEditModalOpen && (<DailyTripEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} trip={selectedTrip} onSave={handleSaveEdit}/>)}
             <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão">
                <div>
                    <p>Tem certeza de que deseja excluir permanentemente esta viagem?</p>
                    <p className="text-sm text-gray-600 mt-2">
                        <strong>Motorista:</strong> {selectedTrip?.driverName}<br/>
                        <strong>Veículo:</strong> {getVehicleById(selectedTrip?.vehicleId || '')?.model}<br/>
                        <strong>Data:</strong> {selectedTrip ? new Date(selectedTrip.departureDateTime).toLocaleDateString('pt-BR') : ''}
                    </p>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300">Cancelar</button>
                        <button onClick={handleDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700">Excluir</button>
                    </div>
                </div>
            </Modal>
            
            {/* Seção Superior Congelada (Cabeçalho, Abas e Filtros) */}
            <div className="shrink-0 space-y-2.5">
                {/* Cabeçalho Premium integrado ao padrão de submenus */}
                <div className="bg-white p-4 rounded-2xl border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                    <div className="text-left">
                        <h2 className="text-sm font-extrabold text-slate-800">Uso Diário da Frota</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Lançamento de quilometragem inicial e final com medição de tanques e percursos.</p>
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={handleOpenAddModal} 
                            className="bg-[#114D38] hover:bg-[#1d7053] text-white font-extrabold uppercase tracking-wider py-2 px-4 rounded-xl transition duration-300 shadow-sm text-xs flex items-center gap-1.5 cursor-pointer w-full md:w-auto justify-center"
                        >
                            <span>+ Adicionar Utilização</span>
                        </button>
                    )}
                </div>

                {/* Barra de Ferramentas Premium com abas e botão de filtros */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-150 shadow-sm">
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                activeTab === 'active' 
                                ? 'bg-white text-slate-900 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <SteeringWheelIcon className="h-4 w-4 text-slate-500" />
                            Em Andamento 
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'active' ? 'bg-[#114D38]/10 text-[#114D38]' : 'bg-slate-200 text-slate-600'}`}>
                                {filteredActiveTrips.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                activeTab === 'history' 
                                ? 'bg-white text-slate-900 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <ClockIcon className="h-4 w-4 text-slate-500" />
                            Histórico
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'history' ? 'bg-[#114D38]/10 text-[#114D38]' : 'bg-slate-200 text-slate-600'}`}>
                                {filteredCompletedTrips.length}
                            </span>
                        </button>
                    </div>

                    {isAdmin && (
                        <div className="flex gap-2 items-center w-full md:w-auto justify-end">
                            <button 
                                onClick={() => setIsFiltersOpen(!isFiltersOpen)} 
                                className="border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 bg-white transition-colors cursor-pointer w-full md:w-auto justify-center"
                            >
                                <FunnelIcon className="h-4 w-4"/> Filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* Barra de Filtros Retrátil (Admin) */}
                {isAdmin && isFiltersOpen && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Data Início</label>
                            <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50 w-full"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Data Fim</label>
                            <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50 w-full"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Veículo</label>
                            <select value={filterVehicleId} onChange={(e) => setFilterVehicleId(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50 w-full">
                                <option value="">Todos</option>
                                {vehicles.filter(v => {
                                  return v.isActive !== false || v.id === filterVehicleId;
                                }).map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">Buscar (Motorista/Setor)</label>
                            <input type="text" placeholder="Nome, setor ou destino..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#114D38] bg-slate-50/50 w-full"/>
                        </div>
                        {(filterStartDate || filterEndDate || filterVehicleId || filterSearch) && (
                            <div className="lg:col-span-4 flex justify-end">
                                <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterVehicleId(''); setFilterSearch(''); }} className="text-xs text-red-600 hover:text-red-800 font-bold underline cursor-pointer">Limpar Filtros</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Conteúdo com rolagem independente */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8">

            {/* TAB 1: EM ANDAMENTO */}
            {activeTab === 'active' && (
                <>
                    <div className="hidden md:block bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden mb-8">
                        <div className="overflow-x-auto overflow-y-auto max-h-[650px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#114D38] text-white text-[10px] font-bold uppercase tracking-wider border-b border-[#114D38]">
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Veículo</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Motorista</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Saída</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">KM Inicial</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Destino</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Motivo</th>
                                        <th className="py-4 px-6 text-right sticky top-0 bg-[#114D38] z-10 shadow-xs">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                {filteredActiveTrips.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-bold">Nenhum veículo em uso no momento com os filtros atuais.</td></tr>
                                ) : (
                                    filteredActiveTrips.map(trip => (
                                        <tr key={trip.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{getVehicleById(trip.vehicleId)?.model}</div>
                                                <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded w-fit mt-0.5 text-gray-600 shadow-inner">{getVehicleById(trip.vehicleId)?.plate}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{trip.driverName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {new Date(trip.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">{formatNum(trip.initialKm)} km</td>
                                            <td className="px-6 py-4 max-w-xs truncate">
                                                <div className="text-sm text-gray-900 font-medium" title={trip.destination}>{trip.destination}</div>
                                                <div className="text-xs text-gray-500">{trip.destinationCity}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate">
                                                <div className="text-sm text-gray-500 italic" title={trip.purpose || ''}>"{trip.purpose || 'Não especificado'}"</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button onClick={() => handleOpenReturnModal(trip)} className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer" title="Registrar Retorno">
                                                        <CarIcon className="h-4 w-4" /> <span>Registrar Retorno</span>
                                                    </button>
                                                    {isAdmin && (
                                                        <button onClick={() => handleOpenDeleteModal(trip)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 border border-transparent hover:border-red-150 rounded-lg transition-colors" title="Excluir Viagem">
                                                            <TrashIcon className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>

                    <div className="md:hidden space-y-4 flex-grow overflow-y-auto">
                        {filteredActiveTrips.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500">Nenhum veículo em uso encontrado.</p>
                            </div>
                        ) : (
                            filteredActiveTrips.map(trip => (
                            <div key={trip.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{getVehicleById(trip.vehicleId)?.model}</p>
                                        <p className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1 font-mono">{getVehicleById(trip.vehicleId)?.plate}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleOpenReturnModal(trip)} className="flex items-center space-x-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 active:bg-orange-700 text-xs font-bold shadow-sm" title="Registrar Retorno">
                                            <CarIcon className="h-4 w-4" /> <span>Retorno</span>
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => handleOpenDeleteModal(trip)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Excluir"><TrashIcon className="h-5 w-5"/></button>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t pt-3 space-y-2 text-sm text-gray-700">
                                    <p><span className="font-semibold text-gray-500 text-xs uppercase w-20 inline-block">Motorista:</span> {trip.driverName}</p>
                                    <p><span className="font-semibold text-gray-500 text-xs uppercase w-20 inline-block">Saída:</span> {new Date(trip.departureDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                    <p><span className="font-semibold text-gray-500 text-xs uppercase w-20 inline-block">KM Inicial:</span> {formatNum(trip.initialKm)} km</p>
                                    <p><span className="font-semibold text-gray-500 text-xs uppercase w-20 inline-block">Destino:</span> {trip.destinationCity}</p>
                                </div>
                            </div>
                            ))
                        )}
                    </div>
                </>
            )}
            
            {/* TAB 2: HISTÓRICO */}
            {activeTab === 'history' && (
                <>
                    <div className="hidden md:block bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden mb-8">
                        <div className="overflow-x-auto overflow-y-auto max-h-[650px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#114D38] text-white text-[10px] font-bold uppercase tracking-wider border-b border-[#114D38]">
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Veículo</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Período</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Destino</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">KM Real vs Est.</th>
                                        <th className="py-4 px-6 text-left sticky top-0 bg-[#114D38] z-10 shadow-xs">Combustível (Saída → Volta)</th>
                                        {isAdmin && <th className="py-4 px-6 text-right sticky top-0 bg-[#114D38] z-10 shadow-xs">Ações</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                    {filteredCompletedTrips.length === 0 ? (
                                        <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-slate-400 font-bold">Nenhum histórico de viagens encontrado.</td></tr>
                                    ) : (
                                        filteredCompletedTrips.map(trip => {
                                            const realKm = (trip.finalKm && trip.initialKm) ? trip.finalKm - trip.initialKm : 0;
                                            const estKm = trip.distanceKm || 0;
                                            // Highlight if Real KM is more than 20% higher than estimated (and estimated is set)
                                            const isHighKm = estKm > 0 && realKm > (estKm * 1.2);
                                            const duration = formatDuration(trip.departureDateTime, trip.actualReturnDateTime);
                                            
                                            return (
                                                <tr key={trip.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900">{getVehicleById(trip.vehicleId)?.model}</div>
                                                        <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded w-fit mt-0.5 text-gray-600 shadow-inner">{getVehicleById(trip.vehicleId)?.plate}</div>
                                                        <div className="text-xs text-gray-400 mt-1 font-bold">Mot: {trip.driverName}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs text-gray-500 font-medium">Saída: {new Date(trip.departureDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span className="text-xs text-gray-500 font-medium">Volta: {trip.actualReturnDateTime ? new Date(trip.actualReturnDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                                            {duration && (
                                                                <span className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                                    <ClockIcon className="h-3 w-3 mr-1" /> {duration}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs truncate">
                                                        <div className="text-sm text-gray-900 font-medium" title={trip.destination}>{trip.destination}</div>
                                                        <div className="text-xs text-gray-500">{trip.destinationCity}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <div className={`font-bold ${isHighKm ? 'text-red-600' : 'text-gray-800'}`}>
                                                            Real: {formatNum(realKm)} km
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-medium">
                                                            Est: {estKm > 0 ? `${formatNum(estKm)} km` : 'N/A'}
                                                        </div>
                                                        {isHighKm && (
                                                            <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                                                                <ExclamationTriangleIcon className="h-3 w-3" /> Excede Previsto
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <FuelLevelDisplay level={trip.initialFuelLevel} compact />
                                                            <span className="text-gray-400 text-sm font-bold">→</span>
                                                            <FuelLevelDisplay level={trip.finalFuelLevel} compact />
                                                        </div>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <button onClick={() => handleOpenEditModal(trip)} className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 border border-transparent hover:border-blue-150 rounded-lg transition-colors" title="Editar Viagem">
                                                                    <PencilIcon className="h-5 w-5" />
                                                                </button>
                                                                <button onClick={() => handleOpenDeleteModal(trip)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 border border-transparent hover:border-red-150 rounded-lg transition-colors" title="Excluir Viagem">
                                                                    <TrashIcon className="h-5 w-5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="md:hidden space-y-4 flex-grow overflow-y-auto">
                    {filteredCompletedTrips.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-gray-500">Nenhum histórico disponível.</p>
                        </div>
                    ) : (
                        filteredCompletedTrips.map(trip => {
                            const realKm = (trip.finalKm && trip.initialKm) ? trip.finalKm - trip.initialKm : 0;
                            const estKm = trip.distanceKm || 0;
                            const isHighKm = estKm > 0 && realKm > (estKm * 1.2);
                            const duration = formatDuration(trip.departureDateTime, trip.actualReturnDateTime);

                            return (
                            <div key={trip.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{getVehicleById(trip.vehicleId)?.model}</p>
                                        <p className="text-xs text-gray-500">{getVehicleById(trip.vehicleId)?.plate}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${isHighKm ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {formatNum(realKm)} km
                                        </span>
                                        {duration && <span className="block text-[10px] text-blue-600 font-bold mt-1">{duration}</span>}
                                    </div>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p><strong>Motorista:</strong> {trip.driverName}</p>
                                    <p><strong>Data:</strong> {new Date(trip.departureDateTime).toLocaleDateString('pt-BR')}</p>
                                    <div className="flex items-center gap-2 text-xs mt-2 bg-gray-50 p-2 rounded">
                                         <span className="font-bold">Tanque:</span>
                                         {trip.initialFuelLevel || 'N/A'} <span className="text-gray-400">→</span> {trip.finalFuelLevel || 'N/A'}
                                    </div>
                                </div>
                                {isAdmin && (
                                <div className="mt-3 pt-2 border-t flex justify-end gap-2">
                                    <button onClick={() => handleOpenEditModal(trip)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><PencilIcon className="h-5 w-5"/></button>
                                    <button onClick={() => handleOpenDeleteModal(trip)} className="p-2 text-red-600 hover:bg-red-50 rounded"><TrashIcon className="h-5 w-5"/></button>
                                </div>
                                )}
                            </div>
                            )
                        })
                    )}
                    </div>
                </>
            )}
            </div>
        </div>
    );
};

export default DailyUseView;

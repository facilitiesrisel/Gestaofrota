
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { FuelLevel, ReservationStatus } from '../../types_reserva';
import { SP_CITIES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { ExclamationTriangleIcon, SteeringWheelIcon, CheckIcon, CarIcon } from './icons';
import { calculateDrivingDistance } from '../../services/distanceService';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import DailyUseGuideModal from './DailyUseGuideModal';
import Modal from './Modal';
import { normalizeCidade } from '../../utils/baseOperacional';
import { normalizeNomeSetor, SETORES_OFICIAIS } from '../../utils/setorOperacional';

const FuelLevelInput: React.FC<{ name: string, value: FuelLevel, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, label?: string }> = ({ name, value, onChange, label = "Nível do Tanque de Combustível" }) => {
  const levels = Object.values(FuelLevel);
  const widths: Record<FuelLevel, string> = {
    [FuelLevel.Empty]: '5%',
    [FuelLevel.Quarter]: '25%',
    [FuelLevel.Half]: '50%',
    [FuelLevel.ThreeQuarters]: '75%',
    [FuelLevel.Full]: '100%',
  };
  
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {levels.map((level) => (
          <label 
            key={level}
            className={`cursor-pointer flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-xs font-extrabold transition-all duration-200 shadow-sm text-center
            ${value === level 
                ? 'bg-[#114D38] text-white border-[#114D38] shadow-md ring-2 ring-emerald-500/30' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
          >
            <input type="radio" name={name} value={level} checked={value === level} onChange={onChange} className="sr-only" />
            <span className="text-[11px] sm:text-xs">{level}</span>
          </label>
        ))}
      </div>
      <div className="w-full h-2.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden border border-slate-300/50">
        <div 
          className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-[#114D38] transition-all duration-500 ease-out" 
          style={{ width: value ? widths[value] : '0%' }}
        />
      </div>
    </div>
  );
};

const initialStartFormData = {
    driverName: '', department: '', vehicleId: '', destination: '', destinationCity: '', purpose: '',
    initialKm: '', initialFuelLevel: FuelLevel.Full,
};

const formatNumber = (value: number | string | undefined) => {
    if (value === undefined || value === '' || value === null) return '';
    return Number(value).toLocaleString('pt-BR');
};

const UserDailyUseForm: React.FC = () => {
    const { vehicles, dailyTrips, reservations, addDailyTrip, endTrip, getVehicleById, isLoading: isContextLoading } = useReservations();
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    
    const [startFormData, setStartFormData] = useState(initialStartFormData);
    const [endFormData, setEndFormData] = useState({
        finalKm: '', finalFuelLevel: FuelLevel.Full,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [minDateTime, setMinDateTime] = useState('');
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        title: string;
        content: React.ReactNode;
    }>({
        isOpen: false,
        title: '',
        content: null,
    });

    useEffect(() => {
        const updateMinTime = () => {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setMinDateTime(now.toISOString().slice(0, 16));
        };
        updateMinTime();
        const interval = setInterval(updateMinTime, 60000);
        return () => clearInterval(interval);
    }, []);

    const activeTrip = useMemo(() => {
        if (!activeTripId) return null;
        return dailyTrips.find(trip => trip.id === activeTripId);
    }, [activeTripId, dailyTrips]);

    useEffect(() => {
        const storedId = localStorage.getItem('activeDailyTripId');
        if (!storedId) {
            setActiveTripId(null);
            return;
        }

        // Se já tiver um ID, setamos no estado
        setActiveTripId(storedId);

        // Se o contexto ainda estiver carregando, esperamos terminar para validar o ID do localStorage
        if (isContextLoading) {
            return;
        }

        const tripFromDb = dailyTrips.find(t => t.id === storedId);

        if (tripFromDb) {
            if (tripFromDb.status === ReservationStatus.InUse) {
                setEndFormData(prev => ({ ...prev, finalFuelLevel: tripFromDb.initialFuelLevel || FuelLevel.Full }));
            } else {
                // Viagem existe mas já foi finalizada
                localStorage.removeItem('activeDailyTripId');
                setActiveTripId(null);
            }
        } else {
            // Se o carregamento terminou e o ID salvo não existe na lista de viagens,
            // limpamos o localStorage e liberamos a tela para novas solicitações.
            localStorage.removeItem('activeDailyTripId');
            setActiveTripId(null);
        }
    }, [dailyTrips, isContextLoading]);

    const availableVehicles = useMemo(() => {
        // 1. Vehicles currently in "Daily Use"
        const activeDailyTripVehicleIds = new Set(dailyTrips
            .filter(trip => trip.status === ReservationStatus.InUse)
            .map(trip => trip.vehicleId));
        
        // 2. Vehicles currently reserved for "Today" (Overlap check)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const reservedTodayVehicleIds = new Set(reservations
            .filter(r => {
                if (r.status !== ReservationStatus.Approved && r.status !== ReservationStatus.InUse) return false;
                
                const rStart = new Date(r.departureDateTime); rStart.setHours(0, 0, 0, 0);
                const rEnd = new Date(r.returnDate); rEnd.setHours(23, 59, 59, 999);
                
                // Check if Today overlaps with the reservation period
                // Overlap: StartA <= EndB AND EndA >= StartB
                return todayStart <= rEnd && todayEnd >= rStart;
            })
            .map(r => r.vehicleId));

        return vehicles.filter(v => {
            return v.isActive !== false && 
                   !activeDailyTripVehicleIds.has(v.id) && 
                   !reservedTodayVehicleIds.has(v.id);
        });
    }, [vehicles, dailyTrips, reservations]);

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'vehicleId') {
            if (value) {
                const vehicle = getVehicleById(value);
                if (vehicle) {
                    const lastTripForVehicle = dailyTrips
                        .filter(t => t.vehicleId === value && t.status === ReservationStatus.Completed && t.finalKm != null)
                        .sort((a, b) => (b.actualReturnDateTime ? new Date(b.actualReturnDateTime).getTime() : 0) - (a.actualReturnDateTime ? new Date(a.actualReturnDateTime).getTime() : 0))[0];
                    
                    const lastKm = lastTripForVehicle?.finalKm || vehicle.lastKm || vehicle.initialKm || 0;
                    setStartFormData(prev => ({ ...prev, vehicleId: value, initialKm: lastKm.toString() }));
                }
            } else {
                setStartFormData(prev => ({ ...prev, vehicleId: '', initialKm: '' }));
            }
        } else {
            const upperCaseFields = ['driverName', 'department', 'destination', 'destinationCity', 'purpose'];
            const finalValue = upperCaseFields.includes(name) ? value.toUpperCase() : value;
            setStartFormData(prev => ({ ...prev, [name]: finalValue }));
        }
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEndFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleStartSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const tripDate = new Date(); // Use current time as source of truth for server-side
            
            const normCity = normalizeCidade(startFormData.destinationCity);
            let estimatedDistance = 0;
            if (normCity) {
                try {
                    const result = await calculateDrivingDistance('Paulínia/SP', normCity);
                    if (result && result.distance) estimatedDistance = result.distance;
                } catch (distError) {
                    console.debug("Silent distance estimation fallback (daily trip user)", distError);
                }
            }

            const newTripId = await addDailyTrip({
                ...startFormData,
                department: normalizeNomeSetor(startFormData.department),
                destinationCity: normCity,
                requesterName: startFormData.driverName,
                departureDateTime: tripDate,
                initialKm: Number(startFormData.initialKm),
                distanceKm: estimatedDistance > 0 ? estimatedDistance : undefined
            });

            const vehicle = getVehicleById(startFormData.vehicleId);
            const emailHtml = generateEmailHtml(
                "Início de Uso Diário",
                [
                    { label: "Motorista", value: startFormData.driverName },
                    { label: "Setor", value: normalizeNomeSetor(startFormData.department) },
                    { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                    { label: "Saída", value: tripDate.toLocaleString('pt-BR') },
                    { label: "Destino", value: `${startFormData.destinationCity} - ${startFormData.destination}` },
                    { label: "KM Inicial", value: `${startFormData.initialKm} km` },
                    { label: "Tanque", value: startFormData.initialFuelLevel },
                    { label: "Motivo", value: startFormData.purpose }
                ],
                "#00753f",
                undefined,
                "Nova viagem iniciada via formulário público."
            );
            await sendEmail(ADMIN_EMAIL_RECIPIENTS, `Início de Uso Diário - ${startFormData.driverName}`, emailHtml);

            localStorage.setItem('activeDailyTripId', newTripId);
            setActiveTripId(newTripId);
            setStartFormData(initialStartFormData);
            
            // Modal de Sucesso Rico
            setModalState({
                isOpen: true,
                title: 'Viagem Iniciada com Sucesso!',
                content: (
                    <div className="space-y-4 text-left font-sans">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#114D38] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                <CheckIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm uppercase tracking-wide text-emerald-950">
                                    Saída Registrada!
                                </h4>
                                <p className="text-xs text-emerald-800 mt-1">
                                    A viagem foi iniciada no sistema. Ao retornar, preencha o KM final para registrar a devolução.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 text-xs border border-slate-200">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 font-bold uppercase">Veículo:</span>
                                <span className="font-extrabold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                                    {vehicle?.model} • {vehicle?.plate}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 font-bold uppercase">KM Inicial:</span>
                                <span className="font-extrabold text-slate-800">{formatNumber(startFormData.initialKm)} km</span>
                            </div>
                            {estimatedDistance > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-bold uppercase">Estimativa Ida/Volta:</span>
                                    <span className="font-extrabold text-emerald-700">{estimatedDistance} km</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setModalState({ ...modalState, isOpen: false })}
                            className="w-full py-3.5 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            Prosseguir para o Diário de Bordo
                        </button>
                    </div>
                )
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Falha ao iniciar viagem. Tente novamente.");
            if (errorRef.current) {
                errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                window.scrollTo(0, 0);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEndSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!activeTripId || !activeTrip) {
            setError("Viagem ativa não encontrada.");
            return;
        }
        
        if (!endFormData.finalKm) {
            setError("Informe o KM Final.");
            return;
        }
        
        const currentFinalKm = Number(endFormData.finalKm);
        
        if (currentFinalKm < (activeTrip.initialKm || 0)) {
             setError(`O KM Final não pode ser menor que o KM Inicial (${formatNumber(activeTrip.initialKm)}).`);
             return;
        }

        setIsLoading(true);
        try {
            const endDate = new Date();
            await endTrip(activeTripId, endDate, currentFinalKm, endFormData.finalFuelLevel);
            
            const vehicle = getVehicleById(activeTrip.vehicleId);
            const distance = currentFinalKm - (activeTrip.initialKm || 0);

            const emailHtml = generateEmailHtml(
                "Fim de Uso Diário",
                [
                    { label: "Motorista", value: activeTrip.driverName },
                    { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                    { label: "Saída", value: new Date(activeTrip.departureDateTime).toLocaleString('pt-BR') },
                    { label: "Retorno", value: endDate.toLocaleString('pt-BR') },
                    { label: "KM Percorrido", value: `${distance} km` },
                    { label: "Tanque (Chegada)", value: endFormData.finalFuelLevel },
                ],
                "#00753f",
                undefined,
                "Viagem finalizada via formulário público."
            );
            await sendEmail(ADMIN_EMAIL_RECIPIENTS, `Fim de Uso Diário - ${activeTrip.driverName}`, emailHtml);

            localStorage.removeItem('activeDailyTripId');
            setActiveTripId(null);
            setEndFormData({ finalKm: '', finalFuelLevel: FuelLevel.Full });
            setStartFormData(initialStartFormData);
            
            setModalState({
                isOpen: true,
                title: 'Viagem Finalizada com Sucesso!',
                content: (
                    <div className="space-y-4 text-left font-sans">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#114D38] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                <CheckIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-extrabold text-sm uppercase tracking-wide text-emerald-950">
                                    Devolução Concluída!
                                </h4>
                                <p className="text-xs text-emerald-800 mt-1">
                                    O veículo foi liberado no sistema e está disponível para novas utilizações.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 text-xs border border-slate-200">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 font-bold uppercase">Distância Total Percorrida:</span>
                                <span className="font-extrabold text-emerald-700 text-sm">{distance} km</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 font-bold uppercase">KM de Devolução:</span>
                                <span className="font-extrabold text-slate-800">{formatNumber(currentFinalKm)} km</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-bold uppercase">Tanque na Entrega:</span>
                                <span className="font-extrabold text-slate-800">{endFormData.finalFuelLevel}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setModalState({ ...modalState, isOpen: false })}
                            className="w-full py-3.5 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            Concluir e Fechar
                        </button>
                    </div>
                )
            });

        } catch (err: any) {
            console.error("Erro ao finalizar viagem:", err);
            setError(err.message || "Falha de comunicação com o servidor. A viagem NÃO foi finalizada. Tente novamente.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isContextLoading) {
        return (
            <div className="flex justify-center items-center min-h-[350px] bg-white">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#114D38]"></div>
            </div>
        );
    }
    
    return (
        <div className="w-full bg-white md:rounded-[24px] shadow-sm border border-slate-200 overflow-hidden text-left font-sans">
            <DailyUseGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
            
            <Modal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ ...modalState, isOpen: false })}
                title={modalState.title}
            >
                {modalState.content}
            </Modal>

            {/* Header Institucional Risel */}
            <div className="bg-gradient-to-r from-[#114D38] via-[#0d3b2b] to-[#114D38] p-5 sm:p-6 text-white border-b border-emerald-900">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-200 uppercase tracking-wider mb-2">
                            Frota Leve Risel
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            Diário de Bordo • Uso Diário
                        </h2>
                    </div>

                    <button 
                        onClick={(e) => { e.preventDefault(); setIsGuideOpen(true); }} 
                        className="self-start sm:self-center text-xs font-bold text-emerald-100 bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all backdrop-blur-sm cursor-pointer"
                    >
                        <span>Como funciona?</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="p-5 sm:p-8 bg-slate-50/50 space-y-6">
                {error && (
                    <div ref={errorRef} className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-start gap-3 shadow-sm">
                        <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                        <div className="flex-1 text-xs">
                            <p className="font-extrabold text-red-900 uppercase">Atenção</p>
                            <p className="mt-0.5 font-medium">{error}</p>
                        </div>
                        <button onClick={() => setError('')} className="text-red-700 hover:text-red-900 font-black text-sm">✕</button>
                    </div>
                )}

                {/* CARD DE VIAGEM EM ANDAMENTO */}
                {activeTripId && (
                    <section className="bg-white border-2 border-emerald-600/60 rounded-2xl shadow-md overflow-hidden animate-fadeIn">
                        <div className="bg-gradient-to-r from-[#114D38] to-[#0d3b2b] px-5 py-3.5 text-white flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                <h3 className="text-sm font-black uppercase tracking-wider">
                                    Viagem em Andamento
                                </h3>
                             </div>
                             <span className="text-[11px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full">
                                Devolução Pendente
                             </span>
                        </div>
                        
                        <div className="p-5 sm:p-6 space-y-6">
                            {!activeTrip ? (
                                <div className="text-center py-6 text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#114D38] mx-auto mb-3"></div>
                                    <p className="text-xs font-bold">Carregando dados da viagem ativa...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Veículo</span>
                                            <span className="text-sm font-extrabold text-slate-800">{getVehicleById(activeTrip.vehicleId)?.model}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Placa</span>
                                            <span className="text-sm font-mono font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                                                {getVehicleById(activeTrip.vehicleId)?.plate}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Motorista</span> 
                                            <span className="text-sm font-bold text-slate-800 truncate block">{activeTrip.driverName}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">KM Inicial</span>
                                            <span className="text-sm font-extrabold text-emerald-800">{formatNumber(activeTrip.initialKm)} km</span>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleEndSubmit} className="space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="border-b border-slate-100 pb-3">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Registrar Encerramento e Devolução</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">Informe a quilometragem atual do hodômetro e o combustível</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="finalKm" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                    KM Final no Retorno *
                                                </label>
                                                <input 
                                                    type="number" 
                                                    name="finalKm" 
                                                    value={endFormData.finalKm} 
                                                    onChange={handleEndChange} 
                                                    required 
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all font-mono" 
                                                    placeholder={`Mínimo: ${activeTrip.initialKm}`}
                                                />
                                            </div>
                                            
                                            <div>
                                                <FuelLevelInput 
                                                    name="finalFuelLevel" 
                                                    value={endFormData.finalFuelLevel} 
                                                    onChange={handleEndChange} 
                                                    label="Nível do Tanque na Entrega *" 
                                                />
                                            </div>
                                        </div>
                                        
                                        <button 
                                            type="submit" 
                                            disabled={isLoading} 
                                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-[#114D38] hover:from-emerald-700 hover:to-[#0d3b2b] text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span>Finalizando Viagem...</span>
                                                </>
                                            ) : (
                                                <span>Finalizar Viagem e Devolver Veículo</span>
                                            )}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </section>
                )}

                {/* FORMULÁRIO DE NOVA VIAGEM */}
                <section className={`${activeTripId ? 'opacity-40 pointer-events-none grayscale filter blur-[0.5px]' : ''} transition-all duration-300`}>
                    {availableVehicles.length > 0 ? (
                        <form onSubmit={handleStartSubmit} className="space-y-6 sm:space-y-8">
                            
                            {/* SECTION 1: VEÍCULO & CONDUTOR */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                                        01
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                            Veículo e Condutor
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-medium">Selecione o veículo disponível e identifique o motorista</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    <div className="md:col-span-2">
                                        <label htmlFor="vehicleId" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Veículo Disponível para Saída Imediata *
                                        </label>
                                        <div className="relative">
                                            <select 
                                                name="vehicleId" 
                                                value={startFormData.vehicleId} 
                                                onChange={handleStartChange} 
                                                required 
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="" className="text-slate-400">Selecione o veículo na lista...</option>
                                                {availableVehicles.map(v => (
                                                    <option key={v.id} value={v.id} className="text-slate-900 font-semibold">
                                                        {v.model} • Placa: {v.plate} (KM Atual: {formatNumber(v.currentKm)})
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="driverName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Nome Completo do Motorista *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="driverName" 
                                            value={startFormData.driverName} 
                                            onChange={handleStartChange} 
                                            required 
                                            placeholder="Nome do condutor"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="department" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Setor / Departamento *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="department" 
                                            list="daily-setores-list"
                                            value={startFormData.department} 
                                            onChange={handleStartChange} 
                                            required 
                                            placeholder="Ex: Comercial, Operações"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all" 
                                        />
                                        <datalist id="daily-setores-list">
                                            {SETORES_OFICIAIS.map(s => (
                                                <option key={s} value={s} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: HODÔMETRO & COMBUSTÍVEL */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                                        02
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                            Hodômetro & Combustível na Saída
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-medium">Verificação de quilometragem e tanque</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    <div>
                                        <label htmlFor="initialKm" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            KM Inicial do Veículo *
                                        </label>
                                        <input 
                                            type="number" 
                                            name="initialKm" 
                                            value={startFormData.initialKm} 
                                            onChange={handleStartChange} 
                                            required 
                                            className="w-full px-3 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none font-mono cursor-not-allowed" 
                                            readOnly 
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">Carregado automaticamente pelo cadastro do veículo.</p>
                                    </div>

                                    <div>
                                        <FuelLevelInput 
                                            name="initialFuelLevel" 
                                            value={startFormData.initialFuelLevel} 
                                            onChange={handleStartChange} 
                                            label="Nível do Tanque na Saída *"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: DESTINO & MOTIVO */}
                            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#114D38] flex items-center justify-center font-black text-xs border border-emerald-200">
                                        03
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                                            Roteiro & Finalidade do Uso
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-medium">Destino e objetivo da saída</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    <div>
                                        <label htmlFor="destinationCity" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Cidade de Destino *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="destinationCity" 
                                            list="cities" 
                                            value={startFormData.destinationCity} 
                                            onChange={handleStartChange} 
                                            required 
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                                            placeholder="Digite ou selecione a cidade" 
                                        />
                                        <datalist id="cities">
                                            {SP_CITIES.map(city => <option key={city} value={city} />)}
                                        </datalist>
                                    </div>

                                    <div>
                                        <label htmlFor="destination" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Local Específico *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="destination" 
                                            value={startFormData.destination} 
                                            onChange={handleStartChange} 
                                            required 
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                                            placeholder="Ex: Usina, Escritório, Posto..." 
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="purpose" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Motivo / Finalidade *
                                        </label>
                                        <input 
                                            type="text" 
                                            name="purpose" 
                                            value={startFormData.purpose} 
                                            onChange={handleStartChange} 
                                            required 
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all uppercase" 
                                            placeholder="Descreva a finalidade da utilização" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button 
                                    type="submit" 
                                    disabled={isLoading || !!activeTripId} 
                                    className="w-full py-4 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-[#0d3b2b] hover:to-[#092b1f] text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Registrando Saída...</span>
                                        </>
                                    ) : (
                                        <span>Iniciar Viagem no Diário de Bordo</span>
                                    )}
                                </button>
                                
                                {activeTripId && (
                                    <p className="mt-2 text-center text-xs font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                        ⚠️ Finalize a viagem em andamento acima antes de iniciar uma nova saída.
                                    </p>
                                )}
                            </div>
                        </form>
                    ) : (
                        <div className="p-8 bg-white border border-slate-200 text-slate-600 rounded-2xl text-center space-y-2">
                            <CarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                            <p className="font-extrabold text-sm uppercase text-slate-800">Nenhum Veículo Disponível no Momento</p>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Todos os veículos da frota própria estão atualmente em uso ou possuem reserva agendada para hoje.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default UserDailyUseForm;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { FuelLevel, ReservationStatus } from '../../types_reserva';
import { SP_CITIES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { getSubmoduleRecipientsSync } from '../../services/emailRecipientsService';
import { ExclamationTriangleIcon, SteeringWheelIcon, CheckIcon, CarIcon } from './icons';
import { Clock, Check as LucideCheck, AlertTriangle, Car as LucideCar, Unlink, MapPin, Gauge, Fuel, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
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
    
    // Recupera imediatamente do localStorage para não haver perda de página no celular
    const [activeTripId, setActiveTripId] = useState<string | null>(() => {
        try {
            return localStorage.getItem('activeDailyTripId') || sessionStorage.getItem('activeDailyTripId') || null;
        } catch (e) {
            return null;
        }
    });

    // Backup dos dados da viagem ativa para navegação offline ou conexão instável em celulares
    const [localBackupTrip, setLocalBackupTrip] = useState<any>(() => {
        try {
            const raw = localStorage.getItem('activeDailyTripData') || sessionStorage.getItem('activeDailyTripData');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    });

    const errorRef = useRef<HTMLDivElement>(null);
    
    const [startFormData, setStartFormData] = useState(initialStartFormData);
    const [endFormData, setEndFormData] = useState<{ finalKm: string; finalFuelLevel: FuelLevel }>({
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

    // Viagem ativa: busca no banco primeiro; se o banco estiver lento ou desconectado, usa backup local do aparelho
    const activeTrip = useMemo(() => {
        if (!activeTripId) return null;
        const tripFromDb = dailyTrips.find(trip => trip.id === activeTripId);
        if (tripFromDb) return tripFromDb;
        if (localBackupTrip && localBackupTrip.id === activeTripId) {
            return localBackupTrip;
        }
        return null;
    }, [activeTripId, dailyTrips, localBackupTrip]);

    // Viagens atualmente em trânsito no sistema aguardando devolução
    const inUseTrips = useMemo(() => {
        return dailyTrips.filter(t => t.status === ReservationStatus.InUse);
    }, [dailyTrips]);

    // Validação resiliente: NUNCA apaga do storage se o banco ainda estiver sincronizando ou vazio
    useEffect(() => {
        const storedId = localStorage.getItem('activeDailyTripId') || sessionStorage.getItem('activeDailyTripId');
        if (!storedId) {
            setActiveTripId(null);
            return;
        }

        // Mantém ativo no estado
        setActiveTripId(storedId);

        // Se o contexto ainda estiver carregando OU se a lista de viagens estiver vazia, NÃO APAGA NADA!
        if (isContextLoading || dailyTrips.length === 0) {
            return;
        }

        const tripFromDb = dailyTrips.find(t => t.id === storedId);

        if (tripFromDb) {
            if (tripFromDb.status === ReservationStatus.InUse) {
                setEndFormData(prev => ({ 
                    ...prev, 
                    finalFuelLevel: prev.finalFuelLevel || tripFromDb.initialFuelLevel || FuelLevel.Full 
                }));
            } else if (tripFromDb.status === ReservationStatus.Completed || tripFromDb.status === ReservationStatus.Cancelled) {
                // Viagem confirmadamente finalizada/cancelada no banco de dados: limpa os dados locais
                localStorage.removeItem('activeDailyTripId');
                localStorage.removeItem('activeDailyTripData');
                try {
                    sessionStorage.removeItem('activeDailyTripId');
                    sessionStorage.removeItem('activeDailyTripData');
                } catch (e) {}
                setActiveTripId(null);
                setLocalBackupTrip(null);
                window.dispatchEvent(new Event('risel_daily_trip_updated'));
            }
        }
    }, [dailyTrips, isContextLoading]);

    // Permite desvincular viagem caso o condutor precise trocar ou selecionar outra
    const handleUnlinkTrip = () => {
        if (window.confirm("Deseja desvincular esta viagem deste aparelho? Isso liberará a tela para registrar outra saída ou selecionar outro veículo em trânsito.")) {
            localStorage.removeItem('activeDailyTripId');
            localStorage.removeItem('activeDailyTripData');
            try {
                sessionStorage.removeItem('activeDailyTripId');
                sessionStorage.removeItem('activeDailyTripData');
            } catch (e) {}
            setActiveTripId(null);
            setLocalBackupTrip(null);
            window.dispatchEvent(new Event('risel_daily_trip_updated'));
        }
    };

    // Permite selecionar uma viagem em andamento no sistema para finalizar pelo celular
    const handleSelectTripToEnd = (trip: any) => {
        const v = getVehicleById(trip.vehicleId);
        const backupData = {
            id: trip.id,
            vehicleId: trip.vehicleId,
            plate: v?.plate || trip.plate || '',
            model: v?.model || trip.model || '',
            driverName: trip.driverName,
            department: trip.department,
            destinationCity: trip.destinationCity,
            destination: trip.destination,
            initialKm: trip.initialKm,
            initialFuelLevel: trip.initialFuelLevel,
            departureDateTime: trip.departureDateTime
        };
        localStorage.setItem('activeDailyTripId', trip.id);
        localStorage.setItem('activeDailyTripData', JSON.stringify(backupData));
        try {
            sessionStorage.setItem('activeDailyTripId', trip.id);
            sessionStorage.setItem('activeDailyTripData', JSON.stringify(backupData));
        } catch (e) {}
        window.dispatchEvent(new Event('risel_daily_trip_updated'));
        setActiveTripId(trip.id);
        setLocalBackupTrip(backupData);
        setEndFormData({
            finalKm: '',
            finalFuelLevel: trip.initialFuelLevel || FuelLevel.Full
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
                    { label: "Status", value: "🚀 VEÍCULO EM TRÂNSITO" },
                    { label: "Condutor", value: startFormData.driverName },
                    { label: "Departamento", value: normalizeNomeSetor(startFormData.department) },
                    { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                    { label: "Data de Saída", value: tripDate.toLocaleString('pt-BR') },
                    { label: "Destino", value: `${startFormData.destinationCity} - ${startFormData.destination}` },
                    { label: "Odômetro Inicial", value: `${Number(startFormData.initialKm).toLocaleString('pt-BR')} km` },
                    { label: "Distância Estimada", value: estimatedDistance > 0 ? `${estimatedDistance.toLocaleString('pt-BR')} km` : 'N/A' },
                    { label: "Nível Tanque", value: startFormData.initialFuelLevel },
                    { label: "Motivo / Serviço", value: startFormData.purpose || "Atendimento Operacional" }
                ],
                "#114D38",
                window.location.origin,
                `O condutor ${startFormData.driverName} registrou a saída do veículo ${vehicle ? vehicle.plate : ''} para ${startFormData.destinationCity}.`,
                "Lembre-se de conduzir respeitando as leis de trânsito e preencher a KM Final no retorno."
            );
            const dailyRecipients = Array.from(new Set([
                'deny.goncalves@risel.com.br',
                'lorena.padilha@risel.com.br',
                ...getSubmoduleRecipientsSync('uso_diario')
            ]));
            await sendEmail(dailyRecipients, `Início de Uso Diário - ${startFormData.driverName}`, emailHtml, {
                fromName: "Gestão de Reservas Risel",
                source: "reservas"
            });

            const tripBackup = {
                id: newTripId,
                driverName: startFormData.driverName,
                department: normalizeNomeSetor(startFormData.department),
                vehicleId: startFormData.vehicleId,
                plate: vehicle?.plate || '',
                model: vehicle?.model || '',
                departureDateTime: tripDate.toISOString(),
                destinationCity: normCity,
                destination: startFormData.destination,
                initialKm: Number(startFormData.initialKm),
                initialFuelLevel: startFormData.initialFuelLevel,
                purpose: startFormData.purpose || "Atendimento Operacional"
            };

            localStorage.setItem('activeDailyTripId', newTripId);
            localStorage.setItem('activeDailyTripData', JSON.stringify(tripBackup));
            try {
                sessionStorage.setItem('activeDailyTripId', newTripId);
                sessionStorage.setItem('activeDailyTripData', JSON.stringify(tripBackup));
            } catch (e) {}
            window.dispatchEvent(new Event('risel_daily_trip_updated'));

            setActiveTripId(newTripId);
            setLocalBackupTrip(tripBackup);
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
                    { label: "Status", value: "🏁 CONCLUÍDA / RETORNO REALIZADO" },
                    { label: "Condutor", value: activeTrip.driverName },
                    { label: "Departamento", value: activeTrip.department || "Operacional" },
                    { label: "Veículo", value: vehicle ? `${vehicle.model} - ${vehicle.plate}` : "N/A" },
                    { label: "Data de Saída", value: new Date(activeTrip.departureDateTime).toLocaleString('pt-BR') },
                    { label: "Data de Retorno", value: endDate.toLocaleString('pt-BR') },
                    { label: "Destino Percorrido", value: `${activeTrip.destinationCity} - ${activeTrip.destination}` },
                    { label: "Odômetro Inicial", value: `${(activeTrip.initialKm || 0).toLocaleString('pt-BR')} km` },
                    { label: "Odômetro Final", value: `${currentFinalKm.toLocaleString('pt-BR')} km` },
                    { label: "Distância Percorrida", value: `${distance.toLocaleString('pt-BR')} km` },
                    { label: "Nível Tanque (Chegada)", value: endFormData.finalFuelLevel },
                    { label: "Motivo / Serviço", value: activeTrip.purpose || "Atendimento Operacional" }
                ],
                "#114D38",
                window.location.origin,
                `O condutor ${activeTrip.driverName} registrou a devolução do veículo ${vehicle ? vehicle.plate : ''}.`,
                "O diário de bordo e odômetro do veículo foram atualizados automaticamente."
            );
            const dailyEndRecipients = Array.from(new Set([
                'deny.goncalves@risel.com.br',
                'lorena.padilha@risel.com.br',
                ...getSubmoduleRecipientsSync('uso_diario')
            ]));
            await sendEmail(dailyEndRecipients, `Fim de Uso Diário - ${activeTrip.driverName}`, emailHtml, {
                fromName: "Gestão de Reservas Risel",
                source: "reservas"
            });

            localStorage.removeItem('activeDailyTripId');
            localStorage.removeItem('activeDailyTripData');
            try {
                sessionStorage.removeItem('activeDailyTripId');
                sessionStorage.removeItem('activeDailyTripData');
            } catch (e) {}
            window.dispatchEvent(new Event('risel_daily_trip_updated'));

            setActiveTripId(null);
            setLocalBackupTrip(null);
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
                    <section className="bg-white border-2 border-emerald-600/80 rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
                        <div className="bg-gradient-to-r from-[#114D38] via-[#0d3b2b] to-[#08241a] px-5 py-3.5 text-white flex items-center justify-between gap-3">
                             <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider truncate">
                                    Viagem em Andamento
                                </h3>
                                <span className="hidden sm:inline-block text-[11px] font-bold bg-[#F47920] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Devolução Pendente
                                </span>
                             </div>

                             <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleUnlinkTrip}
                                    title="Desvincular este veículo deste celular"
                                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-white/20 active:scale-95 cursor-pointer"
                                >
                                    <Unlink className="w-3.5 h-3.5 text-amber-300" />
                                    <span className="hidden sm:inline">Desvincular Viagem</span>
                                    <span className="sm:hidden">Trocar</span>
                                </button>
                             </div>
                        </div>
                        
                        <div className="p-5 sm:p-6 space-y-6">
                            {!activeTrip ? (
                                <div className="text-center py-6 text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#114D38] mx-auto mb-3"></div>
                                    <p className="text-xs font-bold">Carregando dados da viagem ativa...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Informações da Viagem em Destaque */}
                                    <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-900/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shadow-inner">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#114D38]/10 flex items-center justify-center text-[#114D38] shrink-0">
                                                <LucideCar className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Veículo</span>
                                                <span className="text-sm font-extrabold text-slate-900 truncate block">
                                                    {getVehicleById(activeTrip.vehicleId)?.model || activeTrip.model || 'Veículo'}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider mb-1">Placa</span>
                                            {/* Placa Mercosul Estilizada */}
                                            <div className="inline-flex flex-col border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-xs">
                                                <div className="bg-[#003399] px-2.5 py-0.5 flex items-center justify-between gap-2 text-[8px] font-black text-white uppercase tracking-widest leading-none">
                                                    <span>BRASIL</span>
                                                </div>
                                                <div className="px-2.5 py-0.5 text-center font-mono font-black text-xs sm:text-sm tracking-wider text-slate-900 leading-tight">
                                                    {getVehicleById(activeTrip.vehicleId)?.plate || activeTrip.plate || '---'}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Condutor</span> 
                                            <span className="text-sm font-extrabold text-slate-900 truncate block mt-1">
                                                {activeTrip.driverName}
                                            </span>
                                            {activeTrip.department && (
                                                <span className="text-[11px] font-semibold text-slate-500 block truncate">
                                                    {activeTrip.department}
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Odômetro Saída</span>
                                            <span className="text-base font-black text-emerald-800 font-mono block mt-1">
                                                {formatNumber(activeTrip.initialKm)} km
                                            </span>
                                            {activeTrip.destinationCity && (
                                                <span className="text-[11px] font-medium text-slate-600 block truncate mt-0.5">
                                                    Destino: {activeTrip.destinationCity}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Formulário de Encerramento */}
                                    <form onSubmit={handleEndSubmit} className="space-y-5 bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm">
                                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    Registrar Encerramento e Devolução
                                                </h4>
                                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                    Digite a quilometragem atual do hodômetro no retorno e o nível do tanque
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="finalKm" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                                    KM Final no Retorno *
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        name="finalKm" 
                                                        id="finalKm"
                                                        value={endFormData.finalKm} 
                                                        onChange={handleEndChange} 
                                                        required 
                                                        min={activeTrip.initialKm}
                                                        className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-[#114D38] focus:bg-white transition-all font-mono shadow-inner" 
                                                        placeholder={`Mínimo: ${activeTrip.initialKm}`}
                                                    />
                                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                                                        KM
                                                    </span>
                                                </div>

                                                {/* Aviso dinâmico de KM percorrido */}
                                                {endFormData.finalKm && Number(endFormData.finalKm) >= activeTrip.initialKm && (
                                                    <p className="text-xs text-emerald-700 font-bold mt-1.5 flex items-center gap-1">
                                                        <LucideCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                        Distância percorrida nesta viagem: {formatNumber(Number(endFormData.finalKm) - activeTrip.initialKm)} km
                                                    </p>
                                                )}

                                                {endFormData.finalKm && Number(endFormData.finalKm) < activeTrip.initialKm && (
                                                    <p className="text-xs text-red-600 font-bold mt-1.5 flex items-center gap-1">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                                        O KM Final não pode ser menor que o KM Inicial ({formatNumber(activeTrip.initialKm)} km)
                                                    </p>
                                                )}
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
                                            disabled={isLoading || (Boolean(endFormData.finalKm) && Number(endFormData.finalKm) < activeTrip.initialKm)} 
                                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-[#114D38] hover:from-emerald-700 hover:to-[#0d3b2b] text-white font-extrabold text-sm sm:text-base uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99]"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span>Finalizando e Liberando Veículo...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LucideCheck className="w-5 h-5 text-emerald-300" />
                                                    <span>Finalizar Viagem e Devolver Veículo</span>
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </section>
                )}

                {/* SEÇÃO DE RECUPERAÇÃO: VIAGENS EM ANDAMENTO NO SISTEMA AGUARDANDO DEVOLUÇÃO */}
                {inUseTrips.length > 0 && !activeTripId && (
                    <section className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-100/40 border-2 border-[#F47920]/60 rounded-2xl p-5 sm:p-6 shadow-sm animate-fadeIn">
                        <div className="flex items-center justify-between gap-3 mb-3 border-b border-amber-200/70 pb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="w-3 h-3 rounded-full bg-[#F47920] animate-ping" />
                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
                                    Viagens em Trânsito Aguardando Devolução ({inUseTrips.length})
                                </h3>
                            </div>
                            <span className="text-[11px] font-extrabold bg-[#F47920] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Retorno Pendente
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mb-4">
                            Você já iniciou uma viagem anteriormente e retornou? Toque em <strong>"Finalizar Devolução"</strong> no seu veículo abaixo para preencher o KM e o combustível:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {inUseTrips.map(trip => {
                                const v = getVehicleById(trip.vehicleId);
                                return (
                                    <div 
                                        key={trip.id}
                                        className="bg-white rounded-xl p-4 border border-amber-300/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {/* Placa Mercosul */}
                                                    <div className="inline-flex flex-col border border-slate-900 rounded-md overflow-hidden bg-white shadow-2xs">
                                                        <div className="bg-[#003399] px-2 py-0.2 text-[7px] font-black text-white uppercase tracking-widest leading-none">
                                                            BRASIL
                                                        </div>
                                                        <div className="px-2 py-0.2 font-mono font-black text-xs tracking-wider text-slate-900 leading-tight">
                                                            {v?.plate || (trip as any).plate || '---'}
                                                        </div>
                                                    </div>
                                                    <span className="font-extrabold text-sm text-slate-800 truncate">
                                                        {v?.model || (trip as any).model || 'Veículo'}
                                                    </span>
                                                </div>
                                                <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                                                    <p className="font-bold text-slate-900">
                                                        Condutor: <span className="font-semibold text-slate-700">{trip.driverName}</span>
                                                    </p>
                                                    <p className="text-[11px] text-slate-500">
                                                        Saída: {new Date(trip.departureDateTime).toLocaleString('pt-BR')} • {trip.destinationCity || 'Destino operacional'}
                                                    </p>
                                                    <p className="text-[11px] font-mono font-bold text-emerald-800">
                                                        KM Inicial: {formatNumber(trip.initialKm)} km
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleSelectTripToEnd(trip)}
                                            className="w-full py-2.5 px-3 bg-gradient-to-r from-[#114D38] to-[#0d3b2b] hover:from-emerald-700 hover:to-[#114D38] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <LucideCheck className="w-4 h-4 text-emerald-300" />
                                            <span>Finalizar Devolução deste Veículo</span>
                                        </button>
                                    </div>
                                );
                            })}
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
                                                        {v.model} • Placa: {v.plate} (KM Atual: {formatNumber(v.lastKm ?? v.initialKm ?? (v as any).currentKm ?? 0)})
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


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { FuelLevel, ReservationStatus } from '../../types_reserva';
import { SP_CITIES, ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { ExclamationTriangleIcon, SteeringWheelIcon } from './icons';
import { fetchDistanceWithGemini } from '../../services/geminiService';
import { sendEmail, generateEmailHtml } from '../../services/firebaseService';
import DailyUseGuideModal from './DailyUseGuideModal';

const FuelLevelInput: React.FC<{ name: string, value: FuelLevel, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ name, value, onChange }) => {
  const levels = Object.values(FuelLevel);
  const widths: Record<FuelLevel, string> = {
    [FuelLevel.Empty]: '0%',
    [FuelLevel.Quarter]: '25%',
    [FuelLevel.Half]: '50%',
    [FuelLevel.ThreeQuarters]: '75%',
    [FuelLevel.Full]: '100%',
  };
  
  return (
    <div className="mb-2">
      <label className="block text-sm font-bold text-green-800 md:text-gray-700 mb-2">Nível do Tanque</label>
      <div className="flex items-center justify-between gap-1 mb-3">
        {levels.map((level) => (
          <div key={level} className="flex-1">
            <input type="radio" id={`${name}-${level}`} name={name} value={level} checked={value === level} onChange={onChange} className="sr-only peer" />
            <label 
                htmlFor={`${name}-${level}`} 
                className={`cursor-pointer flex items-center justify-center h-10 md:h-8 rounded-md border text-xs font-bold transition-all duration-200 shadow-sm
                ${value === level 
                    ? 'bg-primary text-white border-primary ring-2 ring-primary ring-offset-1' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              {level}
            </label>
          </div>
        ))}
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full mt-1 border border-gray-300 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 transition-all duration-500 ease-out" style={{ width: value ? widths[value] : '0%' }}></div>
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
            
            let estimatedDistance = 0;
            if (startFormData.destinationCity) {
                try {
                    const { distance } = await fetchDistanceWithGemini('Paulínia/SP', startFormData.destinationCity);
                    if (distance) estimatedDistance = distance;
                } catch (geminiError) {
                    console.warn("Failed to calculate estimated distance for daily trip", geminiError);
                }
            }

            const newTripId = await addDailyTrip({
                ...startFormData,
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
            
            // Feedback de Confirmação com detalhe da distância
            if (estimatedDistance > 0) {
                alert(`Viagem iniciada com sucesso!\n\nEstimativa de distância (ida e volta): ${estimatedDistance} km.`);
            } else {
                alert("Viagem iniciada com sucesso!");
            }

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
            
            alert("Viagem finalizada com sucesso! Bom descanso.");

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
            <div className="flex justify-center items-center min-h-screen bg-white/90">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
            </div>
        );
    }
    
    return (
        <div className="relative min-h-screen md:h-full bg-slate-50">
            <DailyUseGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

            <div className="relative z-10 p-4 md:p-6 space-y-6 pb-20">
                {error && (
                    <div className="fixed top-16 left-0 right-0 z-50 p-4 mx-4 md:mx-auto md:max-w-2xl">
                        <div ref={errorRef} className="bg-red-100 border-l-4 border-red-600 text-red-800 p-4 rounded shadow-2xl flex items-start gap-3 animate-bounce-short">
                            <ExclamationTriangleIcon className="h-6 w-6 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-lg">Erro!</p>
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                            <button onClick={() => setError('')} className="ml-auto text-red-800 hover:text-red-600 font-bold">✕</button>
                        </div>
                    </div>
                )}

                {activeTripId && (
                    <section className="bg-blue-50 border-2 border-blue-200 rounded-xl shadow-md overflow-hidden relative z-10">
                        <div className="bg-blue-600 px-4 py-3">
                             <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                🚗 Viagem em Andamento
                             </h3>
                        </div>
                        <div className="p-5">
                            {!activeTrip ? (
                                <div className="text-center py-4 text-blue-800">
                                    <div className="animate-pulse font-bold mb-2">Carregando dados da viagem...</div>
                                    <p className="text-sm">Se isso demorar, verifique sua conexão.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-6 text-sm text-gray-700 bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 border-b border-gray-100 pb-4">
                                            <div>
                                                <span className="font-bold text-gray-500 block text-xs uppercase tracking-wider">Veículo</span>
                                                <span className="text-xl font-bold text-gray-900">{getVehicleById(activeTrip.vehicleId)?.model}</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-500 block text-xs uppercase tracking-wider">Placa</span>
                                                <span className="text-xl font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded inline-block border border-gray-300">
                                                    {getVehicleById(activeTrip.vehicleId)?.plate}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <p>
                                                <span className="font-bold text-gray-500 block text-xs uppercase">Motorista</span> 
                                                <span className="font-medium text-gray-900">{activeTrip.driverName}</span>
                                            </p>
                                            <p>
                                                <span className="font-bold text-gray-500 block text-xs uppercase">Saída</span> 
                                                <span className="text-gray-900">{new Date(activeTrip.departureDateTime).toLocaleString('pt-BR')}</span>
                                            </p>
                                            <p>
                                                <span className="font-bold text-gray-500 block text-xs uppercase">KM Inicial</span>
                                                <span className="font-bold text-lg text-blue-700">{formatNumber(activeTrip.initialKm)} km</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleEndSubmit} className="space-y-5 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                        <div>
                                            <label htmlFor="finalKm" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">KM Final</label>
                                            <input 
                                                type="number" 
                                                name="finalKm" 
                                                value={endFormData.finalKm} 
                                                onChange={handleEndChange} 
                                                required 
                                                className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm text-gray-900 bg-white font-mono text-lg" 
                                                placeholder={`Mínimo: ${activeTrip.initialKm}`}
                                            />
                                        </div>
                                        
                                        <FuelLevelInput name="finalFuelLevel" value={endFormData.finalFuelLevel} onChange={handleEndChange} />
                                        
                                        <button type="submit" disabled={isLoading} className="w-full bg-green-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 shadow-md text-lg transition-colors mt-4">
                                            {isLoading ? 'Finalizando...' : 'FINALIZAR VIAGEM'}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </section>
                )}

                <section className={`${activeTripId ? 'opacity-40 pointer-events-none grayscale filter blur-[1px]' : ''} transition-all duration-500 relative z-10`}>
                    <div className="bg-primary px-4 py-3 rounded-t-xl shadow-sm border-b border-green-700 flex justify-between items-center">
                        <h3 className="text-lg font-extrabold text-accent flex items-center gap-2 uppercase tracking-wide">
                            <SteeringWheelIcon className="h-6 w-6" />
                            Nova Viagem
                        </h3>
                        <button 
                            onClick={(e) => { e.preventDefault(); setIsGuideOpen(true); }} 
                            className="text-xs font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                        >
                            <span className="hidden xs:inline">Como funciona?</span>
                            <span className="xs:hidden">Ajuda</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="bg-white rounded-b-xl shadow-md p-5 border border-gray-200">
                        {availableVehicles.length > 0 ? (
                            <form onSubmit={handleStartSubmit} className="space-y-5">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="vehicleId" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Veículo Disponível</label>
                                        <div className="relative">
                                            <select name="vehicleId" value={startFormData.vehicleId} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm appearance-none bg-white text-gray-900 text-base font-medium">
                                                <option value="" className="text-gray-500">Selecione...</option>
                                                {availableVehicles.map(v => <option key={v.id} value={v.id} className="text-gray-900">{v.model} - {v.plate}</option>)}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="driverName" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Nome do Motorista</label>
                                        <input type="text" name="driverName" value={startFormData.driverName} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm uppercase text-gray-900 bg-white" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="department" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Setor</label>
                                            <input type="text" name="department" value={startFormData.department} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm uppercase text-gray-900 bg-white" />
                                        </div>
                                        <div>
                                            <label htmlFor="initialKm" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">KM Inicial</label>
                                            <input 
                                                type="number" 
                                                name="initialKm" 
                                                value={startFormData.initialKm} 
                                                onChange={handleStartChange} 
                                                required 
                                                className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-900 font-mono" 
                                                readOnly 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="destinationCity" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Cidade de Destino</label>
                                        <input type="text" name="destinationCity" list="cities" value={startFormData.destinationCity} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm uppercase text-gray-900 bg-white" placeholder="Digite a cidade" />
                                        <datalist id="cities">{SP_CITIES.map(city => <option key={city} value={city} />)}</datalist>
                                    </div>
                                    <div>
                                        <label htmlFor="destination" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Local Específico</label>
                                        <input type="text" name="destination" value={startFormData.destination} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm uppercase text-gray-900 bg-white" placeholder="Ex: Usina, Escritório..." />
                                    </div>
                                    <div>
                                        <label htmlFor="purpose" className="block text-sm font-bold text-green-800 md:text-gray-700 mb-1">Motivo</label>
                                        <input type="text" name="purpose" value={startFormData.purpose} onChange={handleStartChange} required className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary shadow-sm uppercase text-gray-900 bg-white" />
                                    </div>
                                    <div>
                                        <FuelLevelInput name="initialFuelLevel" value={startFormData.initialFuelLevel} onChange={handleStartChange} />
                                    </div>
                                </div>
                                
                                <button type="submit" disabled={isLoading || !!activeTripId} className="w-full bg-primary text-white font-bold py-4 px-6 rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md text-lg transition-all transform active:scale-95">
                                    {isLoading ? 'Iniciando...' : 'INICIAR VIAGEM'}
                                </button>
                                
                                {activeTripId && (
                                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg shadow-sm text-center">
                                        <p className="font-bold text-lg mb-1">⚠️ Ação Necessária</p>
                                        <p>Finalize a viagem acima para liberar o uso de outro veículo.</p>
                                    </div>
                                )}
                            </form>
                        ) : (
                            <div className="p-6 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-center">
                                <p className="font-bold text-lg">Nenhum Veículo Disponível</p>
                                <p className="text-sm mt-1">Todos os veículos estão em uso ou reservados para hoje.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default UserDailyUseForm;

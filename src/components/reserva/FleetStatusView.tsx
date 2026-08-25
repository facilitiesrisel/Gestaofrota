
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReservations } from '../../context/ReservationContext';
import { ReservationStatus, Vehicle, FuelLevel, GeoFrotasPosition } from '../../types_reserva';
import { CarIcon, MapPinIcon, ClockIcon, SteeringWheelIcon, CalendarIcon, ExclamationTriangleIcon, RouteIcon } from './icons';
import { Navigation } from 'lucide-react';
import Modal from './Modal';
import { fetchFleetPositions } from '../../services/geoFrotasService';
import { useAuth } from '../../context/ReservationAuthContext';
import { generateEmailHtml, sendEmail } from '../../services/firebaseService';
import { ADMIN_EMAIL_RECIPIENTS } from '../../constants_reserva';
import { firebaseConfig } from '../../firebaseConfig';

const OFFICE_COORDS = { lat: -22.75186, lng: -47.15010 };
const OFFICE_RADIUS_KM = 0.14; // 140 meters

// Atualiza a cada 1 minuto para menor delay
const UPDATE_INTERVAL_MS = 60000;

// Componente de Placa Mercosul Realista
const MercosulPlateBadge: React.FC<{ plate: string; isInactive?: boolean }> = ({ plate, isInactive }) => {
    const formattedPlate = (plate || 'ABC1D23').toUpperCase().trim();
    
    return (
        <div className={`inline-flex flex-col items-center justify-center border rounded-lg overflow-hidden shadow-2xs select-none transition-all duration-200 ${
            isInactive 
                ? 'border-slate-300 bg-slate-100 opacity-60' 
                : 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-xs'
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

const MiniFuelLevelDisplay: React.FC<{ level: FuelLevel | undefined }> = ({ level }) => {
    if (!level) {
        return (
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/80 text-slate-400" title="Nível de combustível não registrado">
                <div className="w-5 h-5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs shrink-0">
                    ⛽
                </div>
                <div className="w-12 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-slate-300 w-0"></div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 truncate">Não informado</span>
            </div>
        );
    }
    
    const config: Record<FuelLevel, { width: string; barColor: string; iconBg: string; textColor: string; label: string }> = {
        [FuelLevel.Full]: {
            width: '100%',
            barColor: 'bg-emerald-500',
            iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            textColor: 'text-emerald-700',
            label: 'Cheio'
        },
        [FuelLevel.ThreeQuarters]: {
            width: '75%',
            barColor: 'bg-emerald-400',
            iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
            textColor: 'text-emerald-700',
            label: '3/4'
        },
        [FuelLevel.Half]: {
            width: '50%',
            barColor: 'bg-amber-400',
            iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
            textColor: 'text-amber-800',
            label: '1/2'
        },
        [FuelLevel.Quarter]: {
            width: '25%',
            barColor: 'bg-orange-500',
            iconBg: 'bg-orange-50 text-orange-700 border-orange-200',
            textColor: 'text-orange-800',
            label: '1/4'
        },
        [FuelLevel.Empty]: {
            width: '12%',
            barColor: 'bg-rose-500 animate-pulse',
            iconBg: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
            textColor: 'text-rose-700',
            label: 'Reserva / Vazio'
        },
    };

    const current = config[level] || {
        width: '50%',
        barColor: 'bg-slate-400',
        iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
        textColor: 'text-slate-700',
        label: level
    };

    return (
        <div className="flex items-center gap-2 bg-slate-50/90 px-2.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs hover:bg-slate-100/90 transition-colors" title={`Nível de Combustível: ${current.label}`}>
            <div className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs shadow-2xs shrink-0 ${current.iconBg}`}>
                ⛽
            </div>
            <div className="w-14 h-2.5 bg-slate-200/90 rounded-full border border-slate-300/80 overflow-hidden shrink-0 shadow-inner p-[1px]">
                <div className={`h-full rounded-full transition-all duration-500 ${current.barColor}`} style={{ width: current.width }}></div>
            </div>
            <span className={`text-[11px] font-extrabold tracking-tight truncate ${current.textColor}`}>
                {current.label}
            </span>
        </div>
    );
};

interface FleetStatusViewProps {
    onRequestReservation?: (vehicleId: string) => void;
}

const FleetStatusView: React.FC<FleetStatusViewProps> = ({ onRequestReservation }) => {
    const { vehicles, reservations, dailyTrips, isLoading } = useReservations();
    const { user } = useAuth();
    const isAdmin = user && !user.isAnonymous;
    const [, setSearchParams] = useSearchParams();

    const handleOpenInTracking = (plate: string) => {
        setSearchParams({ tab: 'reservas', sub: 'monitoring', plate: plate.trim() });
    };

    const [isHb20ModalOpen, setIsHb20ModalOpen] = useState(false);
    const [trackerPositions, setTrackerPositions] = useState<GeoFrotasPosition[]>([]);
    const [lastTrackerUpdate, setLastTrackerUpdate] = useState<Date | null>(null);
    
    const sentAlertsRef = useRef<Record<string, number>>({});
    // Armazena o ponto de partida de uma viagem de fim de semana: { PLACA: { lat, lng, time } }
    const weekendTripStartsRef = useRef<Record<string, { lat: number; lng: number; time: number }>>({});

    const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; 
      const dLat = deg2rad(lat2-lat1);
      const dLon = deg2rad(lon2-lon1); 
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const d = R * c; 
      return d;
    }

    const deg2rad = (deg: number) => {
      return deg * (Math.PI/180)
    }

    const checkUnauthorizedExits = (positions: GeoFrotasPosition[]) => {
        if (!vehicles.length) return;

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        positions.forEach(pos => {
            if (!pos.geoLocation || !pos.plate) return;
            
            const cleanPlate = pos.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const vehicle = vehicles.find(v => v.isActive !== false && v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
            
            if (!vehicle) return;

            const [lat, lng] = pos.geoLocation.split(',').map(Number);
            if (isNaN(lat) || isNaN(lng)) return;

            const distanceKm = getDistanceFromLatLonInKm(OFFICE_COORDS.lat, OFFICE_COORDS.lng, lat, lng);

            // --- VERIFICAÇÃO DE AUTORIZAÇÃO (Comum para ambas as lógicas) ---
            const hasActiveTrip = dailyTrips.some(t => t.vehicleId === vehicle.id && t.status === ReservationStatus.InUse);
            const hasActiveReservation = reservations.some(r => {
                if (r.vehicleId !== vehicle.id) return false;
                if (r.status === ReservationStatus.InUse) return true;
                if (r.status === ReservationStatus.Approved) {
                    const start = new Date(r.departureDateTime);
                    const end = new Date(r.returnDate);
                    const startTolerance = new Date(start.getTime() - 30 * 60000); 
                    return now >= startTolerance && now <= end;
                }
                return false;
            });
            
            const isAuthorized = hasActiveTrip || hasActiveReservation;

            // --- LÓGICA DE FIM DE SEMANA (NOVO ALERTA) ---
            if (isWeekend) {
                const speed = Number(pos.speed) || 0;
                const isMoving = speed > 5 || !!pos.ignitionStatus; // Buffer de 5km/h para evitar drift

                // Se está em movimento e não autorizado
                if (isMoving && !isAuthorized) {
                    // 1. Definir ponto de partida se não existir para este 'ciclo'
                    if (!weekendTripStartsRef.current[cleanPlate]) {
                        weekendTripStartsRef.current[cleanPlate] = { lat, lng, time: now.getTime() };
                    }

                    const startPos = weekendTripStartsRef.current[cleanPlate];
                    const lastAlertTime = sentAlertsRef.current[cleanPlate] || 0;
                    const alertCooldown = 4 * 60 * 60 * 1000; // 4 horas de intervalo entre alertas para o mesmo veículo

                    if (now.getTime() - lastAlertTime > alertCooldown) {
                        sendWeekendMovementAlert(vehicle, pos, startPos, { lat, lng });
                        sentAlertsRef.current[cleanPlate] = now.getTime();
                    }
                } else if (!isMoving && isAuthorized) {
                    // Limpa o estado se o veículo parar e estiver autorizado (opcional)
                    // delete weekendTripStartsRef.current[cleanPlate];
                }
            } 
            
            /* 
            // --- LÓGICA ANTIGA (Alerta de Base) - DESATIVADA CONFORME SOLICITADO ---
            // else if (distanceKm > OFFICE_RADIUS_KM) { 
            //    if (!isAuthorized) {
            //        // ... lógica antiga de envio de alerta de saída de base
            //    }
            // }
            */
        });
    };

    const sendWeekendMovementAlert = async (
        vehicle: Vehicle, 
        pos: GeoFrotasPosition, 
        startPos: { lat: number, lng: number }, 
        currentPos: { lat: number, lng: number }
    ) => {
        const gpsDate = pos.gpsTime ? new Date(pos.gpsTime).toLocaleString('pt-BR') : 'Desconhecida';
        const locationLink = `https://www.google.com/maps/search/?api=1&query=${pos.geoLocation}`;
        
        // Gerar URL do Google Static Maps com Path e Marcadores
        // Start (S) = Verde, End (E) = Vermelho
        const apiKey = firebaseConfig.apiKey; // Usando a chave pública do Firebase config (geralmente habilitada para Maps em projetos Firebase)
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&maptype=roadmap` +
            `&markers=color:green%7Clabel:S%7C${startPos.lat},${startPos.lng}` +
            `&markers=color:red%7Clabel:E%7C${currentPos.lat},${currentPos.lng}` +
            `&path=color:0x0000ff%7Cweight:5%7C${startPos.lat},${startPos.lng}%7C${currentPos.lat},${currentPos.lng}` +
            `&key=${apiKey}`;

        const emailHtml = generateEmailHtml(
            "🚨 ALERTA DE FIM DE SEMANA",
            [
                { label: "Veículo", value: `${vehicle.model} - ${vehicle.plate}` },
                { label: "Ocorrência", value: "Movimentação detectada durante o fim de semana SEM reserva/viagem ativa no sistema." },
                { label: "Velocidade", value: `${Math.round(pos.speed || 0)} km/h` },
                { label: "Data/Hora GPS", value: gpsDate },
                { label: "Localização Atual", value: pos.address || "Endereço não identificado" }
            ],
            "#dc2626",
            locationLink,
            "Este veículo está se movendo fora do horário comercial padrão e não possui registro de saída.",
            "Verifique o mapa abaixo para visualizar o início e o fim do deslocamento detectado.",
            "#eeeeee",
            mapUrl // Passando a URL da imagem do mapa
        );

        await sendEmail(ADMIN_EMAIL_RECIPIENTS, `🚨 ALERTA FDS: Movimentação não autorizada - ${vehicle.plate}`, emailHtml);
        console.log(`Alerta de fim de semana enviado para ${vehicle.plate}`);
    };

    useEffect(() => {
        const loadTrackerData = async () => {
            try {
                const positions = await fetchFleetPositions();
                if (positions) {
                    const vehiclesWithHistory = vehicles.filter(v => v.isActive !== false);
                    const registeredPlates = new Set(vehiclesWithHistory.map(v => v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()));
                    const filteredPositions = positions.filter(pos => {
                        if (!pos.plate) return false;
                        const cleanPlate = pos.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        return registeredPlates.has(cleanPlate);
                    });
                    setTrackerPositions(filteredPositions);
                    setLastTrackerUpdate(new Date());
                    checkUnauthorizedExits(filteredPositions);
                }
            } catch (error) {
                console.error("Erro ao carregar dados do rastreador no status da frota:", error);
            }
        };

        if (isAdmin) {
            loadTrackerData();
            const interval = setInterval(loadTrackerData, UPDATE_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [isAdmin, vehicles, dailyTrips, reservations]);
    
    const getLastFuelLevel = (vehicleId: string): FuelLevel | undefined => {
        const tripsWithFuel = dailyTrips.filter(t => 
            t.vehicleId === vehicleId && 
            (t.finalFuelLevel || t.initialFuelLevel)
        );
        
        if (tripsWithFuel.length === 0) return undefined;

        tripsWithFuel.sort((a, b) => {
            const dateA = a.actualReturnDateTime ? new Date(a.actualReturnDateTime).getTime() : new Date(a.departureDateTime).getTime();
            const dateB = b.actualReturnDateTime ? new Date(b.actualReturnDateTime).getTime() : new Date(b.departureDateTime).getTime();
            return dateB - dateA;
        });

        const latest = tripsWithFuel[0];
        return latest.finalFuelLevel || latest.initialFuelLevel;
    };

    const getTrackerInfo = (plate: string) => {
        if (!isAdmin) return undefined;
        const normalizedPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return trackerPositions.find(p => 
            (p.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalizedPlate
        );
    };

    const getVehicleStatus = (vehicle: Vehicle) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const formatTime = (date: Date) => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const formatDateTime = (date: Date) => new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

        const activeDailyTrip = dailyTrips.find(
            trip => trip.vehicleId === vehicle.id && trip.status === ReservationStatus.InUse
        );

        if (activeDailyTrip) {
            return { 
                statusLabel: 'EM USO',
                subLabel: 'Uso Diário',
                type: 'in-use', 
                details: {
                    roleLabel: 'Motorista',
                    fullName: activeDailyTrip.driverName,
                    location: `${activeDailyTrip.destinationCity} - ${activeDailyTrip.destination}`,
                    departureTime: formatDateTime(activeDailyTrip.departureDateTime),
                    returnForecast: null 
                },
                badgeColor: 'bg-blue-600 text-white',
                borderColor: 'border-blue-500',
                iconColor: 'text-blue-600',
                sortWeight: 2
            };
        }

        const activeReservation = reservations.find(r => r.vehicleId === vehicle.id && r.status === ReservationStatus.InUse);

        if (activeReservation) {
             return { 
                statusLabel: 'EM USO', 
                subLabel: 'Reserva',
                type: 'in-use',
                details: {
                    roleLabel: 'Solicitante',
                    fullName: activeReservation.requesterName,
                    location: `${activeReservation.destinationCity} - ${activeReservation.destination}`,
                    departureTime: formatDateTime(activeReservation.departureDateTime),
                    returnForecast: formatDateTime(activeReservation.returnDate)
                },
                badgeColor: 'bg-indigo-600 text-white',
                borderColor: 'border-indigo-500',
                iconColor: 'text-indigo-600',
                sortWeight: 2
            };
        }

        const todayReservations = reservations.filter(r => {
            const departureDate = new Date(r.departureDateTime);
            departureDate.setHours(0, 0, 0, 0);
            return r.vehicleId === vehicle.id &&
                   r.status === ReservationStatus.Approved &&
                   departureDate.getTime() <= today.getTime() &&
                   new Date(r.returnDate).getTime() >= today.getTime();
        });

        if (todayReservations.length > 0) {
            const res = todayReservations[0];
            return { 
                statusLabel: 'RESERVADO', 
                subLabel: 'Hoje',
                type: 'reserved',
                details: {
                    roleLabel: 'Solicitante',
                    fullName: res.requesterName,
                    location: `${res.destinationCity} - ${res.destination}`,
                    departureTime: formatTime(res.departureDateTime),
                    returnForecast: formatDateTime(res.returnDate)
                },
                badgeColor: 'bg-accent text-white',
                borderColor: 'border-accent',
                iconColor: 'text-accent',
                sortWeight: 3
            };
        }

        return { 
            statusLabel: 'DISPONÍVEL', 
            subLabel: 'Livre',
            type: 'available',
            details: null,
            badgeColor: 'bg-green-600 text-white',
            borderColor: 'border-green-500',
            iconColor: 'text-green-600',
            sortWeight: 1
        };
    };

    const sortedVehicles = useMemo(() => {
        const vehiclesWithHistory = vehicles.filter(v => v.isActive !== false);

        const vehiclesWithStatus = vehiclesWithHistory.map(v => ({
            ...v,
            calculatedStatus: getVehicleStatus(v)
        }));

        return vehiclesWithStatus.sort((a, b) => {
            if (a.calculatedStatus.sortWeight !== b.calculatedStatus.sortWeight) {
                return a.calculatedStatus.sortWeight - b.calculatedStatus.sortWeight;
            }
            return a.model.localeCompare(b.model);
        });
    }, [vehicles, dailyTrips, reservations]);

    const handleReserveClick = (vehicle: Vehicle) => {
        if (vehicle.model.toUpperCase().includes('HB20')) {
            setIsHb20ModalOpen(true);
        } else {
            if (onRequestReservation) {
                onRequestReservation(vehicle.id);
            }
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-primary"></div>
            </div>
        );
    }

    if(vehicles.length === 0 && !isLoading) {
        return <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow font-lg">Nenhum veículo cadastrado na frota.</div>
    }

    return (
        <div className="h-full flex flex-col relative">
            <Modal
                isOpen={isHb20ModalOpen}
                onClose={() => setIsHb20ModalOpen(false)}
                title="Aviso sobre Reserva de HB20"
            >
                <div className="text-center p-2">
                    <ExclamationTriangleIcon className="h-12 w-12 text-accent mx-auto mb-3" />
                    <p className="text-gray-700 text-lg mb-4">
                        A reserva para veículos do modelo <strong>HB20</strong> não pode ser solicitada diretamente por aqui.
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                        Por favor, utilize a opção <strong>"Solicitar Reserva"</strong> no menu principal. A disponibilidade será verificada com base na sua função.
                    </p>
                    <button 
                        onClick={() => setIsHb20ModalOpen(false)} 
                        className="w-full bg-primary text-white font-bold py-2 px-4 rounded hover:bg-green-800 transition-colors"
                    >
                        Entendi
                    </button>
                </div>
            </Modal>

            {isAdmin && (
                <div className="flex justify-end mb-2 text-xs text-gray-500">
                    {lastTrackerUpdate && <span>GPS atualizado às: {lastTrackerUpdate.toLocaleTimeString()}</span>}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                {sortedVehicles.map(vehicle => {
                    const statusData = vehicle.calculatedStatus;
                    const fuelLevel = getLastFuelLevel(vehicle.id);
                    const trackerInfo = isAdmin ? getTrackerInfo(vehicle.plate) : undefined;
                    
                    let distanceInfo = null;
                    let isRecentSignal = false;
                    let isOffline = true;
                    let displayStatusText = 'Offline';

                    if (trackerInfo && trackerInfo.geoLocation) {
                         const [lat, lng] = trackerInfo.geoLocation.split(',').map(Number);
                         if (!isNaN(lat) && !isNaN(lng)) {
                             const distanceKm = getDistanceFromLatLonInKm(OFFICE_COORDS.lat, OFFICE_COORDS.lng, lat, lng);
                             if (distanceKm <= OFFICE_RADIUS_KM) {
                                 distanceInfo = {
                                     text: "🏢 Na Sede (Risel)",
                                     color: "text-green-700"
                                 };
                             } else {
                                 distanceInfo = {
                                     text: `📡 A ${distanceKm.toFixed(1).replace('.', ',')} km da Sede`,
                                     color: "text-orange-700"
                                 };
                             }
                         }
                         
                         if (trackerInfo.gpsTime) {
                             const gpsDate = new Date(trackerInfo.gpsTime);
                             const now = new Date();
                             const diffMinutes = (now.getTime() - gpsDate.getTime()) / 60000;
                             const speed = Number(trackerInfo.speed) || 0;
                             const isMoving = speed > 0;
                             
                             // Considera ONLINE se:
                             // 1. Sinal recente (menos de 20 min)
                             // 2. OU Velocidade > 0 (está andando, então está online, mesmo que o delay seja maior por fuso horário)
                             if (diffMinutes < 20 || (isMoving && diffMinutes < 1440)) {
                                 isRecentSignal = true;
                                 isOffline = false;
                                 displayStatusText = isMoving ? 'Online (Em Movimento)' : 'Online';
                             } else {
                                 displayStatusText = diffMinutes > 60 
                                    ? `Offline (${Math.floor(diffMinutes/60)}h)` 
                                    : `Offline (${Math.floor(diffMinutes)}m)`;
                             }
                         }
                    }

                    return (
                        <div key={vehicle.id} className="bg-white rounded-2xl shadow-xs border border-slate-200/90 flex flex-col overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200">
                            
                            <div className="flex flex-row min-h-[115px]">
                                <div className="w-20 bg-slate-50/80 flex flex-col items-center justify-center p-2.5 shrink-0 border-r border-slate-200/80 relative gap-1.5">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/70 shadow-2xs flex items-center justify-center">
                                        <CarIcon className={`h-6 w-6 ${statusData.iconColor}`} />
                                    </div>
                                    
                                    <div className="text-center z-10">
                                        <span className="block text-[9px] text-slate-400 font-extrabold uppercase leading-none mb-0.5 tracking-wider">ODÔMETRO</span>
                                        <span className="block text-xs font-black text-slate-800 font-sans leading-none tracking-tight">
                                            {vehicle.lastKm ? vehicle.lastKm.toLocaleString('pt-BR') : '0'}
                                        </span>
                                    </div>

                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusData.type === 'available' ? 'bg-emerald-500' : statusData.type === 'in-use' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                </div>

                                <div className="p-3.5 flex-1 flex flex-col justify-between min-w-0 gap-1.5 relative">
                                    {trackerInfo && (
                                        <div className="absolute top-2.5 right-2.5">
                                            {isAdmin ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenInTracking(vehicle.plate);
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-2xs cursor-pointer hover:shadow-xs active:scale-95 transition-all ${isOffline ? 'bg-slate-100/90 border-slate-300 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800 hover:bg-emerald-100'}`}
                                                    title={`Clique para abrir a posição de ${vehicle.plate} no Rastreamento`}
                                                >
                                                    <div className={`h-2 w-2 rounded-full ${!isOffline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                                        GPS <Navigation className="w-2.5 h-2.5 inline" />
                                                    </span>
                                                </button>
                                            ) : (
                                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-2xs ${isOffline ? 'bg-slate-100/90 border-slate-200 text-slate-500' : 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800'}`} title={`Status GPS: ${displayStatusText}`}>
                                                    <div className={`h-2 w-2 rounded-full ${!isOffline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider">GPS</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-start gap-1.5 pr-14"> 
                                        <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug truncate w-full">
                                            {vehicle.model}
                                        </h3>
                                        <MercosulPlateBadge plate={vehicle.plate} isInactive={vehicle.isActive === false} />
                                    </div>
                                    
                                    <div className="flex items-center justify-between gap-2">
                                        <MiniFuelLevelDisplay level={fuelLevel} />
                                    </div>

                                    {statusData.details ? (
                                        <div className="text-xs bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black text-slate-900 truncate text-sm" title={statusData.details.fullName}>
                                                    {statusData.details.fullName.split(' ')[0]}
                                                </span>
                                                <span className="text-slate-500 shrink-0 text-[10px] font-bold">({statusData.details.roleLabel})</span>
                                            </div>
                                            <div className="space-y-1 text-slate-600 text-xs">
                                                <div className="flex items-start gap-1.5">
                                                    <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                                                    <span className="leading-tight truncate block w-full font-semibold" title={statusData.details.location}>{statusData.details.location}</span>
                                                </div>
                                                <div className="flex items-start gap-1.5">
                                                    <ClockIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                                                    <span className="leading-tight truncate block w-full font-medium">
                                                        {statusData.type === 'reserved' ? 'Saída às ' : 'Desde: '}
                                                        <span className="font-bold text-slate-800">{statusData.details.departureTime}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2 pt-0.5">
                                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                <span className="font-black">Disponível no Pátio</span>
                                            </div>
                                            {onRequestReservation && (
                                                <button 
                                                    onClick={() => handleReserveClick(vehicle)}
                                                    className="bg-[#114D38] text-white hover:bg-[#0e3d2c] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                                >
                                                    <CalendarIcon className="h-3 w-3" />
                                                    Reservar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={`w-24 flex flex-col items-center justify-center border-l border-slate-200/80 shrink-0 ${statusData.badgeColor}`}>
                                    <span className="block text-xs font-black uppercase tracking-wider text-center w-full px-1">
                                        {statusData.statusLabel}
                                    </span>
                                    {statusData.subLabel && (
                                        <span className="text-[10px] font-bold opacity-90 mt-1">{statusData.subLabel}</span>
                                    )}
                                </div>
                            </div>

                            {trackerInfo && (
                                <div className={`border-t border-slate-200/80 p-3 text-xs text-slate-700 flex flex-col gap-1.5 ${isRecentSignal ? 'bg-emerald-50/40' : 'bg-slate-50/70'}`}>
                                    <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-1.5 text-[#114D38] font-black uppercase tracking-wider text-[10px]">
                                            <MapPinIcon className="h-3.5 w-3.5" />
                                            <span>Rastreador (GPS)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {distanceInfo && (
                                                <span className={`font-black text-xs ${distanceInfo.color}`}>
                                                    {distanceInfo.text}
                                                </span>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenInTracking(vehicle.plate);
                                                    }}
                                                    title={`Abrir localização de ${vehicle.plate} direto no Menu Rastreamento`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#114D38] hover:bg-[#0e3d2c] text-white font-bold text-[10px] shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer ml-1"
                                                >
                                                    <Navigation className="h-2.5 w-2.5" />
                                                    <span>Ver no Mapa</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                   
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="line-clamp-1 font-semibold text-slate-800 text-xs" title={trackerInfo.address}>
                                            {trackerInfo.address || "Endereço não disponível"}
                                        </div>
                                        {Number(trackerInfo.speed) > 0 && (
                                            <span className="bg-emerald-100/80 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md font-black text-xs shrink-0">
                                                {Math.round(Number(trackerInfo.speed))} km/h
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-500 text-[10px] flex items-center gap-1 justify-between w-full pt-0.5">
                                        <div className="flex items-center gap-1 font-medium">
                                            <ClockIcon className="h-3 w-3 text-slate-400" />
                                            {trackerInfo.gpsTime ? new Date(trackerInfo.gpsTime).toLocaleString('pt-BR') : 'Sem sinal'}
                                        </div>
                                        <span className={`font-black ${isOffline ? 'text-slate-400' : 'text-emerald-700'}`}>
                                            {displayStatusText}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FleetStatusView;

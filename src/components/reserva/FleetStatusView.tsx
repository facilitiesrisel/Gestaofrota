
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { ReservationStatus, Vehicle, FuelLevel, GeoFrotasPosition } from '../../types_reserva';
import { CarIcon, MapPinIcon, ClockIcon, SteeringWheelIcon, CalendarIcon, ExclamationTriangleIcon, RouteIcon } from './icons';
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

const MiniFuelLevelDisplay: React.FC<{ level: FuelLevel | undefined }> = ({ level }) => {
    if (!level) return <span className="text-xs text-gray-400 font-medium" title="Nível do tanque desconhecido">Tanque: N/A</span>;
    
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

    return (
        <div className="flex items-center gap-2" title={`Nível do tanque: ${level}`}>
            <div className="w-10 h-2 bg-gray-200 rounded-full border border-gray-300 overflow-hidden">
                <div className={`h-full ${colors[level]}`} style={{ width: widths[level] }}></div>
            </div>
            <span className="text-xs font-bold text-gray-600">{level}</span>
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
        const completedTrips = dailyTrips.filter(t => 
            t.vehicleId === vehicleId && 
            t.status === ReservationStatus.Completed && 
            t.finalFuelLevel
        );
        
        if (completedTrips.length === 0) return undefined;

        completedTrips.sort((a, b) => {
            const dateA = a.actualReturnDateTime ? new Date(a.actualReturnDateTime).getTime() : 0;
            const dateB = b.actualReturnDateTime ? new Date(b.actualReturnDateTime).getTime() : 0;
            return dateB - dateA;
        });

        return completedTrips[0].finalFuelLevel;
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
                        <div key={vehicle.id} className="bg-white rounded-lg shadow-sm border border-gray-300 flex flex-col overflow-hidden hover:shadow-md transition-all duration-200">
                            
                            <div className="flex flex-row min-h-[110px]">
                                <div className="w-20 bg-gray-50 flex flex-col items-center justify-center p-2 shrink-0 border-r border-gray-200 relative gap-1">
                                    <CarIcon className={`h-9 w-9 ${statusData.iconColor} opacity-90 z-10`} />
                                    
                                    <div className="text-center z-10 mt-1">
                                        <span className="block text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">KM</span>
                                        <span className="block text-xs font-bold text-gray-700 leading-none tracking-tight">
                                            {vehicle.lastKm ? vehicle.lastKm.toLocaleString('pt-BR') : '0'}
                                        </span>
                                    </div>

                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusData.type === 'available' ? 'bg-green-500' : statusData.type === 'in-use' ? 'bg-blue-500' : 'bg-accent'}`}></div>
                                </div>

                                <div className="p-3 flex-1 flex flex-col justify-center min-w-0 gap-1 relative">
                                    {trackerInfo && (
                                        <div className="absolute top-2 right-2">
                                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border shadow-sm ${isOffline ? 'bg-gray-100 border-gray-300' : 'bg-green-50 border-green-200'}`} title={`Status GPS: ${displayStatusText}`}>
                                                <div className={`h-2 w-2 rounded-full ${!isOffline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                                <span className="text-[9px] text-gray-500 font-bold">GPS</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col items-start gap-1.5 mb-2 pr-8"> 
                                        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight leading-none truncate w-full">
                                            {vehicle.model}
                                        </h3>
                                        <div className="bg-white border border-gray-300 rounded shadow-sm px-2 py-0.5 w-fit">
                                            <span className="text-sm font-bold text-gray-800 font-mono leading-none block">
                                                {vehicle.plate}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <MiniFuelLevelDisplay level={fuelLevel} />
                                    </div>

                                    {statusData.details ? (
                                        <div className="text-sm bg-gray-50 rounded p-2 border border-gray-200">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900 truncate text-base" title={statusData.details.fullName}>
                                                    {statusData.details.fullName.split(' ')[0]}
                                                </span>
                                                <span className="text-gray-500 shrink-0 text-xs">({statusData.details.roleLabel})</span>
                                            </div>
                                            <div className="space-y-0.5 text-gray-700 text-xs">
                                                <div className="flex items-start gap-1">
                                                    <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-500" />
                                                    <span className="leading-tight truncate block w-full font-medium" title={statusData.details.location}>{statusData.details.location}</span>
                                                </div>
                                                <div className="flex items-start gap-1">
                                                    <ClockIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-500" />
                                                    <span className="leading-tight truncate block w-full font-medium">
                                                        {statusData.type === 'reserved' ? 'Saída às ' : 'Desde: '}
                                                        {statusData.details.departureTime}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2 py-1">
                                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                                <SteeringWheelIcon className="h-5 w-5 text-green-600" />
                                                <span className="font-bold text-green-700 text-xs md:text-sm">Disponível</span>
                                            </div>
                                            {onRequestReservation && (
                                                <button 
                                                    onClick={() => handleReserveClick(vehicle)}
                                                    className="bg-white text-green-700 border border-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    <CalendarIcon className="h-3 w-3" />
                                                    Reservar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={`w-24 flex flex-col items-center justify-center border-l border-gray-200 shrink-0 ${statusData.badgeColor}`}>
                                    <span className="block text-sm font-extrabold uppercase tracking-wide text-center w-full drop-shadow-sm px-1">
                                        {statusData.statusLabel}
                                    </span>
                                    {statusData.subLabel && (
                                        <span className="text-[10px] font-medium opacity-90 mt-1">{statusData.subLabel}</span>
                                    )}
                                </div>
                            </div>

                            {trackerInfo && (
                                <div className={`border-t border-gray-200 p-2 text-xs text-gray-700 flex flex-col gap-1 ${isRecentSignal ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-1 text-green-700 font-bold uppercase tracking-wide text-[10px]">
                                            <MapPinIcon className="h-3 w-3" />
                                            Rastreador (GPS)
                                        </div>
                                        {distanceInfo && (
                                            <span className={`font-bold ${distanceInfo.color}`}>
                                                {distanceInfo.text}
                                            </span>
                                        )}
                                    </div>
                                   
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="line-clamp-1 font-medium" title={trackerInfo.address}>
                                            {trackerInfo.address || "Endereço não disponível"}
                                        </div>
                                        {Number(trackerInfo.speed) > 0 && (
                                            <span className="bg-green-100 text-green-800 px-1.5 rounded font-bold shrink-0">
                                                {Math.round(Number(trackerInfo.speed))} km/h
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-gray-500 text-[10px] flex items-center gap-1 justify-between w-full">
                                        <div className="flex items-center gap-1">
                                            <ClockIcon className="h-3 w-3" />
                                            {trackerInfo.gpsTime ? new Date(trackerInfo.gpsTime).toLocaleString('pt-BR') : 'Sem sinal'}
                                        </div>
                                        <span className={`font-bold ${isOffline ? 'text-gray-400' : 'text-green-600'}`}>
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

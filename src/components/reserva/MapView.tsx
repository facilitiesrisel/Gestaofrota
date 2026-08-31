
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useReservations } from '../../context/ReservationContext';
import { fetchVehicleHistory, fetchFleetPositions } from '../../services/geoFrotasService';
import { ReservationStatus, GeoFrotasPosition } from '../../types_reserva';
import { geocodeAddress } from '../../services/geminiService';
import { FunnelIcon, MapPinIcon, ClockIcon, ExclamationTriangleIcon, CarIcon, SteeringWheelIcon, RouteIcon } from './icons';
import { LayoutGrid, Map as LucideMap, Download, Activity, BookOpen, Check, X } from 'lucide-react';
import { mapQuotaService } from '../../services/mapQuotaService';
import { MapQuotaIndicator } from './MapQuotaIndicator';
import { VEICULOS_REAIS } from '../../data/veiculos_reais';

// Coordenadas da Sede da Risel
const OFFICE_COORDS: [number, number] = [-22.75186, -47.15010];
const OFFLINE_THRESHOLD_MINS = 20;
const OFFICE_RADIUS_METERS = 140;
// Atualização rápida para garantir sincronia com GeoFrotas (10 segundos)
const UPDATE_INTERVAL_MS = 10000;

// Helper para calcular distância (Haversine)
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2-lat1) * (Math.PI/180);
  const dLon = (lon2-lon1) * (Math.PI/180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

// --- Ícones Customizados do Leaflet ---

// Ícone da Sede (Estático) - Atualizado para Verde Risel
const OfficeIcon = L.divIcon({
    className: 'custom-office-icon',
    html: `
        <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="#00753f" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.4));">
                <path d="M3 21h18v-2H3v2zm16-4h-2v-2h-2v2H9v-2H7v2H5V3h14v14zM9 5H7v2h2V5zm4 0h-2v2h2V5zm4 0h-2v2h2V5zM9 9H7v2h2V9zm4 0h-2v2h2V9zm4 0h-2v2h2V9zm4 0h-2v2h2V9zm-4 4H7v2h2v-2zm4 0h-2v2h2v-2z" />
            </svg>
        </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24]
});

// Ícone Pin de Destino - Laranja
const DestinationIcon = L.divIcon({
    className: 'custom-dest-icon',
    html: `
        <div style="position: relative; transform: translateY(-100%); width: 32px; height: 32px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#ff9b00" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.3));">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5-2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

// Gerador de Ícone de Veículo Dinâmico
const createVehicleIcon = (color: string, isOnline: boolean, plate: string) => {
    return L.divIcon({
        className: 'custom-vehicle-icon',
        html: `
            <div style="position: relative; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center;">
                ${isOnline ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid ${color}; opacity: 0.7; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>` : ''}
                <div style="background-color: white; border-radius: 50%; padding: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; z-index: 2;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${color}">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                    </svg>
                </div>
                <div style="position: absolute; bottom: -12px; background: white; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: bold; color: #334155; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1); z-index: 3;">
                    ${plate}
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
};

// Componente para controlar o centro do mapa (FlyTo)
const MapUpdater: React.FC<{ center: [number, number] | null, zoom: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1.5 });
        }
    }, [center, zoom, map]);
    return null;
};

// Componente para forçar o recalculo do tamanho do mapa (Fix partial rendering)
const MapInvalidator: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

// Componente auxiliar para exibir métricas no popup
const MetricBox: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-gray-800' }) => (
    <div className="bg-gray-50 border border-gray-100 px-3 py-2 rounded text-center flex flex-col justify-center shadow-sm min-w-[70px]">
        <span className="block text-[9px] uppercase text-gray-400 font-bold mb-0.5 tracking-wide">{label}</span>
        <span className={`text-xs font-bold leading-none ${color}`}>{value}</span>
    </div>
);

const MapView: React.FC = () => {
    const { vehicles, reservations, dailyTrips, getVehicleById, syncVehiclesFromGeoFrotas } = useReservations();
    const [searchParams] = useSearchParams();
    const plateQueryParam = searchParams.get('plate') || '';
    
    // Todos os veículos ativos cadastrados na Frota de Veículos
    const vehiclesWithHistory = useMemo(() => {
        return vehicles.filter(v => v.isActive !== false);
    }, [vehicles]);
    
    const [viewMode, setViewMode] = useState<'destinations' | 'tracking' | 'history'>('tracking');
    const [displayMode, setDisplayMode] = useState<'map' | 'grid'>('map');
    const [positions, setPositions] = useState<GeoFrotasPosition[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [plateFilter, setPlateFilter] = useState(plateQueryParam);
    const [apiError, setApiError] = useState<string | null>(null);

    // Efeito para sincronizar quando a URL mudar para uma placa específica
    useEffect(() => {
        if (plateQueryParam) {
            setPlateFilter(plateQueryParam);
            setViewMode('tracking');
        }
    }, [plateQueryParam]);
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(OFFICE_COORDS);
    const [mapZoom, setMapZoom] = useState(15);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    
    // History State
    const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
    const [historyPath, setHistoryPath] = useState<[number, number][]>([]);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyFilters, setHistoryFilters] = useState({ vehicleId: '', startDate: '', endDate: '' });
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Estado reativo das camadas do mapa (Google Maps na cota free ou Mapbox no failover)
    const [mapLayers, setMapLayers] = useState(() => mapQuotaService.getLayers());

    useEffect(() => {
        const unsubscribe = mapQuotaService.subscribe(() => {
            setMapLayers(mapQuotaService.getLayers());
        });
        return () => unsubscribe();
    }, []);

    // Helper para download de CSV
    const downloadCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(';'),
            ...data.map(row => 
                headers.map(fieldName => {
                    const value = row[fieldName];
                    if (value instanceof Date) {
                        return `"${value.toLocaleString('pt-BR')}"`;
                    }
                    const valueStr = value !== undefined && value !== null ? String(value) : '';
                    return `"${valueStr.replace(/"/g, '""')}"`;
                }).join(';')
            )
        ].join('\r\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Exportar CSV Tempo Real
    const handleExportRealTimeCSV = () => {
        const csvData = processedVehicles.map((v: any) => ({
            'Placa': v.plate,
            'Modelo': v.model,
            'Condutor': v.driverName,
            'Status': v.isOffline ? 'Offline' : 'Online',
            'Velocidade (km/h)': Math.round(v.speed),
            'Ignição': v.ignition ? 'Ligada' : 'Desligada',
            'Última Atualização': v.gpsTime ? v.gpsTime.toLocaleString('pt-BR') : 'Sem dados',
            'Último Endereço': v.address
        }));
        downloadCSV(csvData, `Rastreamento_Frota_Risel_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '_')}.csv`);
    };

    // Exportar CSV Histórico
    const handleExportHistoryCSV = () => {
        if (!historyData || historyData.length === 0) return;
        const vehicle = getVehicleById(historyFilters.vehicleId);
        const csvData = historyData.map((h: any) => ({
            'Veículo': vehicle ? `${vehicle.model} (${vehicle.plate})` : '',
            'Data e Hora': h.gpsTime ? new Date(h.gpsTime).toLocaleString('pt-BR') : '',
            'Velocidade (km/h)': h.speed !== undefined ? Math.round(Number(h.speed)) : 0,
            'Ignição': h.ignitionStatus ? 'Ligada' : 'Desligada',
            'Coordenadas': h.geoLocation || '',
            'Endereço': h.address || ''
        }));
        downloadCSV(csvData, `Historico_Movimentacao_${vehicle?.plate || 'Veiculo'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '_')}.csv`);
    };

    // Destinations State
    const [destinationMarkers, setDestinationMarkers] = useState<any[]>([]);

    // Fetch Tracking Data
    const loadTrackingData = async () => {
        setIsRefreshing(true);
        setApiError(null);
        try {
            const data = await fetchFleetPositions();
            if (data) {
                // "só buscar veículos que estão cadastrados no menu de Frota de Veículos"
                const registeredPlates = new Set(vehiclesWithHistory.map(v => v.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()));
                const filteredData = data.filter(pos => {
                    if (!pos.plate) return false;
                    const cleanPlate = pos.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    return registeredPlates.has(cleanPlate);
                });
                setPositions(filteredData);
                setLastUpdate(new Date());
            }
        } catch (e) {
            console.warn("Erro ao atualizar tracking:", e);
            setApiError("Falha na conexão com GeoFrotas. Tentando novamente...");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSyncFromGeoFrotas = async () => {
        setIsSyncing(true);
        setSyncMessage(null);
        try {
            const count = await syncVehiclesFromGeoFrotas();
            setSyncMessage(`Sincronização concluída! ${count} novos veículos importados.`);
            setTimeout(() => setSyncMessage(null), 5000);
            loadTrackingData(); // Refresh tracking after sync
        } catch (e) {
            console.error(e);
            setSyncMessage("Erro ao sincronizar com o GeoFrotas.");
            setTimeout(() => setSyncMessage(null), 5000);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'tracking') {
            loadTrackingData(); // Initial load
            const interval = setInterval(loadTrackingData, UPDATE_INTERVAL_MS);
            return () => clearInterval(interval);
        }
    }, [viewMode, vehiclesWithHistory]);

    // Handle click "Tempo Real" to always force update
    const handleRealTimeClick = () => {
        if (viewMode === 'tracking') {
            loadTrackingData(); // Force refresh
        } else {
            setViewMode('tracking');
        }
    };

    // Handle Plate Filter Change (FlyTo)
    useEffect(() => {
        if (plateFilter && positions.length > 0) {
            const targetPos = positions.find(p => p.plate && p.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === plateFilter.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
            if (targetPos && targetPos.geoLocation) {
                const [lat, lng] = targetPos.geoLocation.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                    setMapCenter([lat, lng]);
                    setMapZoom(17);
                }
            }
        } else if (viewMode === 'tracking' && !plateFilter) {
            setMapCenter(OFFICE_COORDS);
            setMapZoom(14);
        }
    }, [plateFilter, positions, viewMode]);

    // Process Vehicles for Rendering
    const processedVehicles = useMemo(() => {
        if (viewMode !== 'tracking') return [];

        return vehiclesWithHistory.map(vehicle => {
            // Normalização rigorosa para comparação: remove tudo que não é letra/número
            const cleanPlate = vehicle.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            
            // Busca na lista de posições usando a mesma normalização
            const pos = positions.find(p => (p.plate || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
            
            let lat = OFFICE_COORDS[0];
            let lng = OFFICE_COORDS[1];
            let isOffline = true;
            let speed = 0;
            let ignition = false;
            let gpsTime: Date | null = null;
            let address = 'Endereço não disponível';

            if (pos && pos.geoLocation) {
                const [pLat, pLng] = pos.geoLocation.split(',').map(Number);
                if (!isNaN(pLat) && !isNaN(pLng)) {
                    lat = pLat;
                    lng = pLng;
                    speed = Number(pos.speed) || 0;
                    ignition = !!pos.ignitionStatus;
                    address = pos.address || address;
                    
                    // Use gpsTime as primary source of truth
                    if (pos.gpsTime) {
                        const parsedDate = new Date(pos.gpsTime);
                        if (!isNaN(parsedDate.getTime())) {
                            gpsTime = parsedDate;
                            const diffMins = (new Date().getTime() - gpsTime.getTime()) / 60000;
                            const isActive = speed > 0 || ignition;
                            
                            // Online se sinal recente OU ativo no último dia (compensação fuso)
                            if (diffMins <= OFFLINE_THRESHOLD_MINS || (isActive && diffMins < 1440)) {
                                isOffline = false;
                            }
                        }
                    }
                }
            }

            // 1. Buscar condutor cadastrado no Controle de Frota Leve como padrão
            let defaultDriver = (vehicle as any).condutor || '';
            if (!defaultDriver || defaultDriver.trim() === '') {
                const fleetItem = VEICULOS_REAIS.find(f => f.placa?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
                if (fleetItem && fleetItem.condutor) {
                    defaultDriver = fleetItem.condutor;
                }
            }
            if (!defaultDriver) {
                try {
                    const stored = localStorage.getItem('risel_frota_veiculos_v2');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        const found = parsed.find((p: any) => p.placa?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
                        if (found && found.condutor) defaultDriver = found.condutor;
                    }
                } catch (e) {}
            }

            // 2. Verificar uso diário ativo e reservas ativas
            const activeTrip = dailyTrips.find(t => {
                const matchId = t.vehicleId === vehicle.id;
                const matchPlate = (t as any).plate?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate || (t as any).placa?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate;
                const st = (t.status || '').toString().toLowerCase();
                return (matchId || matchPlate) && (st === 'inuse' || st === 'in_use' || st.includes('andamento') || st.includes('uso'));
            });

            const activeRes = !activeTrip ? reservations.find(r => {
                const matchId = r.vehicleId === vehicle.id;
                const matchPlate = (r as any).placa?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate || (r as any).plate?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate;
                const st = (r.status || '').toString().toLowerCase();
                if ((matchId || matchPlate) && (st.includes('andamento') || st.includes('uso') || st === 'inuse' || st === 'in_use')) {
                    return true;
                }
                if ((matchId || matchPlate) && (st.includes('confirmad') || st.includes('aprovad'))) {
                    const now = new Date();
                    const dDe = r.departureDateTime ? new Date(r.departureDateTime) : ((r as any).de ? new Date((r as any).de) : null);
                    const dAte = r.returnDate ? new Date(r.returnDate) : ((r as any).ate ? new Date((r as any).ate) : null);
                    if (dDe && dAte && !isNaN(dDe.getTime()) && !isNaN(dAte.getTime())) {
                        return now >= dDe && now <= dAte;
                    }
                }
                return false;
            }) : null;

            let driverName = defaultDriver || 'Disponível / Pátio';
            let driverStatusBadge = 'Controle de Frota';
            let usageType: 'USO_DIARIO' | 'RESERVA' | 'FROTA_LEVE' = 'FROTA_LEVE';

            if (activeTrip) {
                driverName = activeTrip.driverName;
                driverStatusBadge = 'Em Uso Diário';
                usageType = 'USO_DIARIO';
            } else if (activeRes) {
                driverName = activeRes.requesterName || (activeRes as any).condutor || (activeRes as any).driverName;
                driverStatusBadge = 'Reservado';
                usageType = 'RESERVA';
            }

            if (plateFilter && cleanPlate !== plateFilter.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()) {
                return null;
            }

            return {
                ...vehicle,
                lat, lng, isOffline, speed, ignition, gpsTime, driverName, driverStatusBadge, usageType, originalDriver: defaultDriver, address
            };
        }).filter(Boolean);
    }, [vehicles, positions, plateFilter, dailyTrips, reservations, viewMode]);

    // Handle History Search
    const handleSearchHistory = async () => {
        if (!historyFilters.vehicleId || !historyFilters.startDate || !historyFilters.endDate) return alert("Preencha todos os campos.");
        setIsLoadingHistory(true);
        setHistoryPath([]);
        setHistoryData([]);
        try {
            const vehicle = getVehicleById(historyFilters.vehicleId);
            const data = await fetchVehicleHistory(vehicle?.plate || '', new Date(historyFilters.startDate), new Date(historyFilters.endDate));
            setHistoryData(data);
            if (data.length) {
                const path: [number, number][] = data
                    .map(p => p.geoLocation ? p.geoLocation.split(',').map(Number) as [number, number] : null)
                    .filter((p): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));
                
                setHistoryPath(path);
                if (path.length > 0) {
                    setMapCenter(path[0]);
                    setMapZoom(13);
                }
            } else {
                alert("Nenhum histórico encontrado para este período.");
            }
        } catch (e: any) {
            console.error("Erro no histórico:", e);
            alert("Erro ao buscar histórico. Verifique a conexão.");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Handle Destinations View
    useEffect(() => {
        if (viewMode === 'destinations') {
            const loadDest = async () => {
                const counts: Record<string, number> = {};
                [...reservations, ...dailyTrips].forEach(r => {
                    if (r.destinationCity && r.destinationCity.length > 3) {
                        const city = r.destinationCity.toUpperCase();
                        counts[city] = (counts[city] || 0) + 1;
                    }
                });

                const markers = [];
                for (const city of Object.keys(counts)) {
                    try {
                        const coords = await geocodeAddress(`${city}, SP`);
                        if (coords) {
                            markers.push({ lat: coords.lat, lng: coords.lng, city, count: counts[city] });
                        }
                    } catch (e) {}
                }
                setDestinationMarkers(markers);
                setMapCenter(OFFICE_COORDS);
                setMapZoom(9);
            };
            loadDest();
        }
    }, [viewMode]);

    return (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md h-[calc(100vh-120px)] flex flex-col relative font-sans">
            {syncMessage && (
                <div className={`mb-4 p-3 rounded-xl border text-xs font-semibold transition-all z-20 ${syncMessage.includes('Erro') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                    {syncMessage}
                </div>
            )}
            
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 flex-shrink-0 gap-4 z-10 border-b border-slate-100 pb-4">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <MapPinIcon className="h-6 w-6 text-emerald-600"/> Rastreamento de Frota
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Visualização geográfica e telemetria da frota leve integrada ao GeoFrotas</p>
                </div>
                
                <div className="flex gap-2.5 items-center flex-wrap justify-end">
                    {/* Botão de Alternar Visualização Mapa / Grid */}
                    <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => setDisplayMode('map')} 
                            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${displayMode === 'map' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <LucideMap className="h-4 w-4" /> Mapa
                        </button>
                        <button 
                            onClick={() => setDisplayMode('grid')} 
                            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${displayMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <LayoutGrid className="h-4 w-4" /> Grid / Tabela
                        </button>
                    </div>

                    {/* Botão de Exportação CSV */}
                    {((viewMode === 'tracking' && processedVehicles.length > 0) || (viewMode === 'history' && historyPath.length > 0)) && (
                        <button 
                            onClick={viewMode === 'tracking' ? handleExportRealTimeCSV : handleExportHistoryCSV}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-200 font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 text-xs cursor-pointer shadow-sm"
                            title="Exportar dados atuais para arquivo CSV (Excel)"
                        >
                            <Download className="h-4 w-4" /> Exportar CSV
                        </button>
                    )}

                    {(viewMode === 'tracking' || viewMode === 'destinations') && (
                        <select value={plateFilter} onChange={e => setPlateFilter(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3 py-2 shadow-sm font-semibold cursor-pointer outline-none transition-all">
                            <option value="">Filtro: Todas as Placas</option>
                            {vehiclesWithHistory.map(v => <option key={v.id} value={v.plate}>{v.plate} - {v.model}</option>)}
                        </select>
                    )}
                    
                    <button 
                        onClick={() => setIsBenchmarkOpen(true)}
                        className="bg-orange-50 hover:bg-orange-100 text-[#c25100] hover:text-[#a04000] border border-orange-200 font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-2 text-xs cursor-pointer shadow-sm animate-pulse-slow"
                        title="Análise Comparativa de Sistemas de Rastreamento (Infleet, Contele, Cobli, GeoFrotas, etc.)"
                    >
                        <Activity className="h-4 w-4 text-orange-600"/> Benchmark de Sistemas
                    </button>

                    <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold border border-slate-200 shadow-inner">
                        <button onClick={() => setViewMode('destinations')} className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'destinations' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Destinos</button>
                        <button 
                            onClick={handleRealTimeClick} 
                            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'tracking' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Tempo Real
                            {isRefreshing && <span className="animate-spin w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full"></span>}
                        </button>
                        <button onClick={() => setViewMode('history')} className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Histórico</button>
                    </div>
                </div>
            </div>

            {/* Filters & Status Bar */}
            {viewMode === 'history' && (
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl z-10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-left">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Veículo</label>
                        <select className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3.5 py-2.5 shadow-sm font-semibold cursor-pointer outline-none transition-all" value={historyFilters.vehicleId} onChange={e => setHistoryFilters({...historyFilters, vehicleId: e.target.value})}>
                            <option value="">Selecione...</option>
                            {vehiclesWithHistory.map(v => <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data e Hora de Início</label>
                        <input type="datetime-local" className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3.5 py-2 shadow-sm font-semibold cursor-pointer outline-none transition-all" onChange={e => setHistoryFilters({...historyFilters, startDate: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data e Hora de Fim</label>
                        <input type="datetime-local" className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 block px-3.5 py-2 shadow-sm font-semibold cursor-pointer outline-none transition-all" onChange={e => setHistoryFilters({...historyFilters, endDate: e.target.value})} />
                    </div>
                    <button onClick={handleSearchHistory} disabled={isLoadingHistory} className="bg-[#114D38] hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:bg-gray-400">
                        {isLoadingHistory ? 'Buscando...' : <><FunnelIcon className="h-4 w-4" /> Filtrar Período</>}
                    </button>
                </div>
            )}

            {viewMode === 'tracking' && (
                <div className="flex justify-between items-center mb-2 text-xs px-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span> Online</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span> Offline</span>
                        {apiError && <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1"><ExclamationTriangleIcon className="h-3.5 w-3.5"/> {apiError}</span>}
                    </div>
                    <div className="flex items-center gap-3 font-bold text-slate-500 text-[11px]">
                        <MapQuotaIndicator compact />
                        {lastUpdate && <span>SINCRO: {lastUpdate.toLocaleTimeString()}</span>}
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA: MAP OR GRID */}
            <div className="flex-grow border border-slate-200 rounded-2xl overflow-hidden relative z-0 bg-slate-50 flex flex-col">
                {displayMode === 'map' ? (
                    <div className="w-full h-full relative flex-grow">
                        <MapContainer center={OFFICE_COORDS} zoom={15} style={{ height: '100%', width: '100%' }}>
                            <MapUpdater center={mapCenter} zoom={mapZoom} />
                            <MapInvalidator />
                            
                            <LayersControl position="topright">
                                <LayersControl.BaseLayer checked name={mapLayers.streets.label}>
                                    <TileLayer
                                        key={mapLayers.streets.id}
                                        attribution={mapLayers.streets.attribution}
                                        url={mapLayers.streets.url}
                                        maxZoom={mapLayers.streets.maxZoom || 20}
                                    />
                                </LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name={mapLayers.satellite.label}>
                                    <TileLayer
                                        key={mapLayers.satellite.id}
                                        attribution={mapLayers.satellite.attribution}
                                        url={mapLayers.satellite.url}
                                        maxZoom={mapLayers.satellite.maxZoom || 20}
                                    />
                                </LayersControl.BaseLayer>
                                {mapLayers.terrain && (
                                    <LayersControl.BaseLayer name={mapLayers.terrain.label}>
                                        <TileLayer
                                            key={mapLayers.terrain.id}
                                            attribution={mapLayers.terrain.attribution}
                                            url={mapLayers.terrain.url}
                                            maxZoom={mapLayers.terrain.maxZoom || 20}
                                        />
                                    </LayersControl.BaseLayer>
                                )}
                                <LayersControl.BaseLayer name="OpenStreetMap (Padrão)">
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                </LayersControl.BaseLayer>
                            </LayersControl>

                            {/* Office Radius & Marker */}
                            <Circle 
                                center={OFFICE_COORDS} 
                                radius={OFFICE_RADIUS_METERS} 
                                pathOptions={{ color: '#00753f', fillColor: '#00753f', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' }} 
                            />
                            <Marker position={OFFICE_COORDS} icon={OfficeIcon}>
                                <Popup><strong>Sede Risel Combustíveis</strong><br/>Base Operacional</Popup>
                            </Marker>

                            {/* Tracking Markers */}
                            {viewMode === 'tracking' && processedVehicles.map((v: any) => (
                                <Marker 
                                    key={v.id} 
                                    position={[v.lat, v.lng]} 
                                    icon={createVehicleIcon(v.isOffline ? '#64748b' : '#00753f', !v.isOffline, v.plate)}
                                    zIndexOffset={v.isOffline ? 0 : 1000}
                                >
                                    <Popup className="custom-popup-risel" maxWidth={600} minWidth={380}>
                                        <div className="overflow-hidden rounded-lg font-sans flex flex-col shadow-lg border border-gray-200">
                                            {/* Header com Cores da Marca: Fundo Verde e Borda Laranja */}
                                            <div className="bg-[#114D38] text-white p-3 flex justify-between items-start relative overflow-hidden pr-10 border-b-4 border-orange-500">
                                                 
                                                 {/* Esquerda: Veículo e Placa */}
                                                 <div className="flex flex-col items-start z-10 max-w-[55%]">
                                                    <div className="flex items-center gap-2">
                                                        {v.isOffline && <span className="text-[9px] font-bold bg-red-500 px-1.5 py-0.5 rounded text-white">OFFLINE</span>}
                                                        <h3 className="text-lg font-black uppercase tracking-tight leading-none truncate w-full" title={v.model}>{v.model}</h3>
                                                    </div>
                                                    <span className="font-mono font-bold text-xs bg-white text-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-gray-300 mt-1">
                                                        {v.plate}
                                                    </span>
                                                 </div>

                                                 {/* Direita: Data e Hora */}
                                                 <div className="flex flex-col items-end z-10 text-right">
                                                    <span className="text-[9px] uppercase font-bold text-emerald-200 tracking-wider">Última Posição</span>
                                                    <div className="flex items-center justify-end gap-1.5 text-orange-400">
                                                        <ClockIcon className="h-3.5 w-3.5" />
                                                        <span className="font-bold text-sm tracking-wide whitespace-nowrap">
                                                            {v.gpsTime ? v.gpsTime.toLocaleString('pt-BR') : '--/--/---- --:--'}
                                                        </span>
                                                    </div>
                                                 </div>
                                                 
                                                 {/* Fundo decorativo sutil */}
                                                 <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 pointer-events-none">
                                                    <CarIcon className="h-24 w-24 text-white" />
                                                 </div>
                                            </div>

                                            {/* Body: Informações */}
                                            <div className="bg-white p-3 text-gray-700 text-sm flex flex-col gap-3">
                                                {/* Linha 1: Status e Métricas */}
                                                <div className="flex gap-2 items-stretch">
                                                     <MetricBox label="Status" value={v.isOffline ? 'Offline' : 'Online'} color={v.isOffline ? 'text-gray-500' : 'text-green-600'} />
                                                     <MetricBox label="Velocidade" value={`${Math.round(v.speed)} km/h`} />
                                                     <MetricBox label="Ignição" value={v.ignition ? 'Ligada' : 'Desl.'} color={v.ignition ? 'text-green-600' : 'text-gray-400'} />
                                                     
                                                     {/* Driver Info */}
                                                     <div className="flex-1 bg-green-50 border border-green-100 rounded p-2 flex flex-col justify-center min-w-[120px]">
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className="text-[9px] uppercase text-[#114D38] font-bold">Condutor Atual</span>
                                                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                                                v.usageType === 'USO_DIARIO' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                                v.usageType === 'RESERVA' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                                                'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            }`}>
                                                                {v.driverStatusBadge || 'Frota Leve'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 truncate">
                                                            <SteeringWheelIcon className="h-3 w-3 text-[#114D38] shrink-0" />
                                                            <span className="text-xs font-bold text-[#114D38] truncate" title={v.driverName}>{v.driverName}</span>
                                                        </div>
                                                     </div>
                                                </div>

                                                {/* Linha 2: Endereço */}
                                                <div className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-100">
                                                    <MapPinIcon className="h-4 w-4 text-[#114D38] shrink-0 mt-0.5" />
                                                    <span className="text-xs leading-snug text-gray-600 font-medium break-words w-full">
                                                        {v.address}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* History Path */}
                            {viewMode === 'history' && historyPath.length > 0 && (
                                <>
                                    <Polyline positions={historyPath} pathOptions={{ color: '#114D38', weight: 4, opacity: 0.8 }} />
                                    <Marker position={historyPath[0]} icon={createVehicleIcon('#10b981', false, 'INÍCIO')} />
                                    <Marker position={historyPath[historyPath.length-1]} icon={createVehicleIcon('#ef4444', false, 'FIM')} />
                                </>
                            )}

                            {/* Destination Markers */}
                            {viewMode === 'destinations' && destinationMarkers.map((m, idx) => (
                                <Marker key={idx} position={[m.lat, m.lng]} icon={DestinationIcon}>
                                    <Popup>
                                        <div className="text-center font-sans">
                                            <strong className="text-orange-500 block mb-1 uppercase tracking-wider text-xs font-bold">{m.city}</strong>
                                            <span className="text-xs text-gray-600 font-semibold">{m.count} Viagens Registradas</span>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}

                        </MapContainer>
                    </div>
                ) : (
                    /* GRID TABLE MODE */
                    <div className="w-full h-full overflow-auto bg-white">
                        <div className="min-w-full inline-block align-middle">
                            <div className="overflow-hidden border border-slate-150 rounded-2xl shadow-sm m-2">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-[#114D38] text-white">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Veículo</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Placa</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Condutor Atual</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Velocidade</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Ignição</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Última Posição</th>
                                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Endereço</th>
                                            <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100 text-slate-700 text-sm">
                                        {processedVehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                                                    Nenhum veículo ativo rastreado para os filtros selecionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            processedVehicles.map((v: any) => (
                                                <tr key={v.id} className="hover:bg-slate-50/80 transition duration-150">
                                                    <td className="px-6 py-4 font-bold text-slate-950 whitespace-nowrap">{v.model}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200 text-xs shadow-sm">
                                                            {v.plate}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-slate-900 font-bold text-xs">{v.driverName}</span>
                                                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${
                                                                    v.usageType === 'USO_DIARIO' ? 'bg-blue-500' :
                                                                    v.usageType === 'RESERVA' ? 'bg-amber-500' :
                                                                    'bg-emerald-600'
                                                                }`}></span>
                                                                {v.driverStatusBadge || 'Controle de Frota'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${v.isOffline ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${v.isOffline ? 'bg-slate-400' : 'bg-green-500'}`}></span>
                                                            {v.isOffline ? 'Offline' : 'Online'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-900">
                                                        {Math.round(v.speed)} km/h
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.ignition ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {v.ignition ? 'Ligada' : 'Desligada'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-xs text-slate-500">
                                                        {v.gpsTime ? v.gpsTime.toLocaleString('pt-BR') : '--'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={v.address}>
                                                        {v.address}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button 
                                                            onClick={() => {
                                                                setPlateFilter(v.plate);
                                                                setDisplayMode('map');
                                                            }}
                                                            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-150 transition-all cursor-pointer"
                                                        >
                                                            Focar no Mapa
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* CSS for Animations and Custom Popup Cleanup */}
                <style>{`
                    .custom-popup-risel .leaflet-popup-content-wrapper { 
                        border-radius: 8px; 
                        padding: 0; 
                        overflow: hidden;
                        background: transparent;
                        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                        border: none;
                    }
                    .custom-popup-risel .leaflet-popup-content { 
                        margin: 0 !important;
                        width: 100% !important;
                        white-space: normal; 
                    }
                    .custom-popup-risel .leaflet-popup-tip {
                        background: #114D38; 
                    }
                    .leaflet-container a.leaflet-popup-close-button {
                        color: #fff;
                        font-size: 18px;
                        top: 8px;
                        right: 8px;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                        z-index: 20;
                    }
                    .leaflet-container a.leaflet-popup-close-button:hover {
                        color: #ff9b00;
                    }
                    @keyframes ping {
                        75%, 100% { transform: scale(2); opacity: 0; }
                    }
                `}</style>
            </div>

            {/* MODAL BENCHMARK COMPARATIVO DE RASTREAMENTO */}
            {isBenchmarkOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-fade-in">
                        {/* Header da Modal */}
                        <div className="bg-[#114D38] text-white px-6 py-5 flex justify-between items-center border-b-4 border-orange-500">
                            <div className="flex items-center gap-3">
                                <Activity className="h-6 w-6 text-orange-400" />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Benchmark de Plataformas de Rastreamento</h3>
                                    <p className="text-xs text-emerald-200">Análise comparativa das principais tecnologias de mercado de telemetria</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsBenchmarkOpen(false)}
                                className="bg-emerald-900 hover:bg-emerald-800 text-white rounded-full p-2 transition-all cursor-pointer"
                                title="Fechar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Corpo da Modal com Scroll */}
                        <div className="p-6 overflow-y-auto flex-grow text-left space-y-6">
                            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex gap-4 items-start">
                                <BookOpen className="h-5 w-5 text-[#114D38] shrink-0 mt-0.5" />
                                <div className="text-xs text-slate-600 leading-relaxed">
                                    <strong className="text-slate-800 block text-sm mb-1">Análise de Sistemas de Telemetria e Frotas</strong>
                                    Desenvolvemos um estudo técnico aprofundado para apoiar a <strong>Risel Combustíveis</strong> na seleção das melhores abordagens tecnológicas do mercado. Atualmente, integramos de forma nativa a API da <strong>GeoFrotas (SatServiços)</strong>, o que confere estabilidade absoluta, segurança, ausência de custos extras com licenças de software de terceiros no nosso painel de controle de reservas, e altíssima fidelidade dos dados de posicionamento.
                                </div>
                            </div>

                            {/* Tabela Comparativa de Benchmark */}
                            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                                <table className="min-w-full divide-y divide-slate-200 text-xs">
                                    <thead className="bg-slate-50 text-slate-700 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Plataforma</th>
                                            <th className="px-4 py-3 text-left">Foco Operacional</th>
                                            <th className="px-4 py-3 text-left">Diferencial Tecnológico</th>
                                            <th className="px-4 py-3 text-center">IA & Rotas</th>
                                            <th className="px-4 py-3 text-center">Manutenção</th>
                                            <th className="px-4 py-3 text-center">Adequação Risel</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-600">
                                        <tr className="bg-green-50/50 hover:bg-green-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-[#114D38]">GeoFrotas</td>
                                            <td className="px-4 py-3">Frotas industriais e logística pesada / leve de alta fidelidade</td>
                                            <td className="px-4 py-3">API aberta robusta, telemetria direta do rastreador, zero delay</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">Alta</td>
                                            <td className="px-4 py-3 text-center">Intermediário</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">INTEGRAÇÃO ATIVA</span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-slate-800">Cobli</td>
                                            <td className="px-4 py-3">Roteirização urbana dinâmica e controle de combustível</td>
                                            <td className="px-4 py-3">IA embarcada para analisar hábitos de direção (frenagens, curvas)</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">Excelente</td>
                                            <td className="px-4 py-3 text-center">Avançado</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px]">Recomendado</span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-slate-800">Contele</td>
                                            <td className="px-4 py-3">Equipes e técnicos em campo com veículos leves</td>
                                            <td className="px-4 py-3">Controle rígido de ociosidade e roteiros otimizados de visitas</td>
                                            <td className="px-4 py-3 text-center text-slate-400">Médio</td>
                                            <td className="px-4 py-3 text-center">Básico</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">Gestão de Visitas</span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-slate-800">Infleet</td>
                                            <td className="px-4 py-3">Controle total de despesas e check-lists operacionais</td>
                                            <td className="px-4 py-3">Gestão integrada de abastecimentos, manutenção e pneus</td>
                                            <td className="px-4 py-3 text-center text-slate-400">Intermediário</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">Avançado</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">Foco Custo</span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-slate-800">Golfleet</td>
                                            <td className="px-4 py-3">Gestão de frotas corporativas leves e conformidade</td>
                                            <td className="px-4 py-3">Foco em segurança viária, sinistralidade e política de frotas</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">Alta</td>
                                            <td className="px-4 py-3 text-center">Intermediário</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">Foco Compliance</span>
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 font-bold text-slate-800">PowerFleet</td>
                                            <td className="px-4 py-3">Empresas globais e gestão de ativos de alto valor</td>
                                            <td className="px-4 py-3">Sensores IoT ultra precisos e segurança de carga física</td>
                                            <td className="px-4 py-3 text-center text-slate-400">Intermediário</td>
                                            <td className="px-4 py-3 text-center">Intermediário</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">Enterprise</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Recomendações e Conclusão de BI */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                    <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1.5 text-[#114D38]">
                                        <Check className="h-4 w-4 text-emerald-600" /> Vantagens da Nossa Solução Ativa
                                    </h4>
                                    <ul className="text-slate-600 text-xs space-y-2 list-disc pl-4 leading-relaxed">
                                        <li><strong>Custo de Licenciamento Zero:</strong> O sistema atual consome a API do GeoFrotas sem cobrar mensalidade por usuário na nossa plataforma interna.</li>
                                        <li><strong>Interface Unificada:</strong> O operador não precisa alternar de aba ou usar dois sistemas; o mapa, as reservas e o diário de bordo estão na mesma tela.</li>
                                        <li><strong>Controle de Condutores:</strong> O sistema vincula automaticamente quem pegou a chave no diário de bordo com o carro rastreado em tempo real.</li>
                                    </ul>
                                </div>
                                <div className="border border-slate-150 p-4 rounded-2xl bg-slate-50/50">
                                    <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1.5 text-orange-700">
                                        <Activity className="h-4 w-4 text-orange-500" /> Próximos Passos Recomendados de BI
                                    </h4>
                                    <ul className="text-slate-600 text-xs space-y-2 list-disc pl-4 leading-relaxed">
                                        <li><strong>Adoção de Checklists:</strong> Inspirar-se no modelo da Infleet para lançar check-lists eletrônicos obrigatórios no início da viagem no Diário de Bordo.</li>
                                        <li><strong>Análise de Comportamento:</strong> Avaliar no futuro a inclusão de sensores de aceleração/frenagem brusca (estilo Cobli) para ranking de motoristas conscientes.</li>
                                        <li><strong>Dashboard de Custos:</strong> Integrar notas fiscais de abastecimento do cartão de combustível para gerar o KM/Litro automático por veículo.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Footer da Modal */}
                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end">
                            <button 
                                onClick={() => setIsBenchmarkOpen(false)}
                                className="bg-[#114D38] hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-xl text-xs transition duration-200 cursor-pointer shadow-sm"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;

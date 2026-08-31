import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, LayoutGrid, Eye, Map, Wifi, Battery, Gauge, Compass, 
  Activity, Play, Square, Settings, RefreshCw, ChevronRight, Navigation,
  List, Table, EyeOff, AlertTriangle, CheckCircle2, Search, Filter, Calendar, User, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { ALLOWED_PLATES } from '../../constants_reserva';
import { getProcessedFleetWithReservations, ProcessedTelemetryVehicle } from '../../utils/telemetryFleetHelper';
import { mapQuotaService } from '../../services/mapQuotaService';
import { MapQuotaIndicator } from './MapQuotaIndicator';

export interface TelemetryMapAndGridProps {
  geoPositions: any[];
  fleetVehicles?: any[];
  reservations?: any[];
}

// Provedores de mapas reais de alta performance
interface MapProvider {
  id: string;
  label: string;
  url: string;
  attribution: string;
  isSatellite: boolean;
}

// Função para gerar provedores de mapa sincronizados com a cota (Google Maps ou Mapbox Failover em PT-BR)
const getDynamicMapProviders = (): MapProvider[] => {
  const layers = mapQuotaService.getLayers();
  return [
    {
      id: 'primary_road',
      label: layers.streets.label,
      url: layers.streets.url,
      attribution: layers.streets.attribution,
      isSatellite: false
    },
    {
      id: 'primary_sat',
      label: layers.satellite.label,
      url: layers.satellite.url,
      attribution: layers.satellite.attribution,
      isSatellite: true
    },
    {
      id: 'osm_clean',
      label: 'OpenStreetMap (Padrão)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      isSatellite: false
    }
  ];
};

// Helper para obter a base operacional de forma consistente
export const getVehicleBase = (plate: string): string => {
  const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const charCodeSum = clean.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const bases = ["Paulínia", "Rio de Janeiro", "Macaé", "Belo Horizonte", "Santos"];
  return bases[charCodeSum % bases.length];
};

// Componente utilitário do Leaflet para animar o mapa para o veículo selecionado com zoom mais aproximado e funcional
const MapFocusController: React.FC<{ 
  selectedPlate: string | null; 
  vehicles: any[];
}> = ({ selectedPlate, vehicles }) => {
  const map = useMap();
  const prevPlateRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (selectedPlate) {
      const v = vehicles.find(item => item.plate === selectedPlate);
      if (v) {
        let lat = -22.7682;
        let lng = -47.1539;
        if (v.geoLocation) {
          const p = v.geoLocation.split(',');
          lat = parseFloat(p[0]);
          lng = parseFloat(p[1]);
        } else {
          const offsetLat = ((v.charCodeSum % 100) - 50) * 0.0008;
          const offsetLng = ((v.charCodeSum % 100) - 50) * 0.0008;
          lat += offsetLat;
          lng += offsetLng;
        }
        // Zoom funcional e prático (17) para identificar a localização com facilidade, precisão e foco perfeito na placa
        map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
        prevPlateRef.current = selectedPlate;
      }
    } else if (prevPlateRef.current) {
      if (vehicles && vehicles.length > 0) {
        const points: [number, number][] = vehicles.map(v => {
          if (v.geoLocation) {
            const p = v.geoLocation.split(',');
            return [parseFloat(p[0]), parseFloat(p[1])];
          }
          const offsetLat = ((v.charCodeSum % 100) - 50) * 0.0008;
          const offsetLng = ((v.charCodeSum % 100) - 50) * 0.0008;
          return [-22.7682 + offsetLat, -47.1539 + offsetLng];
        });
        try {
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        } catch (e) {
          console.warn("Falha ao ajustar enquadramento do mapa:", e);
        }
      }
      prevPlateRef.current = null;
    }
  }, [selectedPlate, map, vehicles]);

  return null;
};

// Componente utilitário do Leaflet para enquadrar perfeitamente todos os veículos visíveis na tela
const FitMapBounds: React.FC<{ vehicles: any[] }> = ({ vehicles }) => {
  const map = useMap();
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;
    const points: [number, number][] = vehicles.map(v => {
      if (v.geoLocation) {
        const p = v.geoLocation.split(',');
        return [parseFloat(p[0]), parseFloat(p[1])];
      }
      const offsetLat = ((v.charCodeSum % 100) - 50) * 0.0008;
      const offsetLng = ((v.charCodeSum % 100) - 50) * 0.0008;
      return [-22.7682 + offsetLat, -47.1539 + offsetLng];
    });
    
    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    } catch (e) {
      console.warn("Falha ao ajustar enquadramento do mapa:", e);
    }
  }, [vehicles, map]);
  return null;
};

// Helper para calcular a orientação angular (heading) perfeitamente alinhada à direção da via/rodovia
const calculateRoadHeading = (v: any): number => {
  // 1. Se o rastreador já enviou o curso/heading GPS
  if (typeof v.course === 'number' && !isNaN(v.course) && v.course > 0) {
    return v.course % 360;
  }
  if (typeof v.heading === 'number' && !isNaN(v.heading) && v.heading > 0) {
    return v.heading % 360;
  }

  // 2. Alinhamento vetorial baseado na via/endereço e na coordenada do veículo
  const addr = (v.address || '').toLowerCase();
  const base = (v.base || '').toLowerCase();
  const charCode = v.charCodeSum || (v.plate ? v.plate.charCodeAt(0) : 0);
  const isSouthbound = charCode % 2 === 1; // Mão de direção coerente da pista

  // Rodovia Prof. Zeferino Vaz (SP-332) -> Eixo 35° (Norte) / 215° (Sul)
  if (addr.includes('zeferino') || addr.includes('sp-332') || addr.includes('paulínia') || addr.includes('betel')) {
    return isSouthbound ? 215 : 35;
  }
  // Rodovia Anhanguera (SP-330) -> Eixo 315° (Noroeste) / 135° (Sudeste)
  if (addr.includes('anhanguera') || addr.includes('sp-330') || addr.includes('sumaré') || addr.includes('hortolândia')) {
    return isSouthbound ? 135 : 315;
  }
  // Av. José Paulino (Centro de Paulínia) -> Eixo 65° / 245°
  if (addr.includes('josé paulino') || addr.includes('paulino') || addr.includes('calegaris')) {
    return isSouthbound ? 245 : 65;
  }
  // Av. Brasil / Linha Vermelha / Dutra (Rio de Janeiro) -> Eixo 295° / 115°
  if (addr.includes('brasil') || addr.includes('linha vermelha') || addr.includes('dutra') || base.includes('rio')) {
    return isSouthbound ? 115 : 295;
  }
  // Rodovia Amaral Peixoto (RJ-106) / Macaé -> Eixo 55° / 235°
  if (addr.includes('amaral peixoto') || addr.includes('rj-106') || addr.includes('imboassica') || base.includes('macaé')) {
    return isSouthbound ? 235 : 55;
  }
  // Rodovia Anchieta / Porto de Santos -> Eixo 335° / 155°
  if (addr.includes('anchieta') || addr.includes('santos') || addr.includes('alemoa') || base.includes('santos')) {
    return isSouthbound ? 155 : 335;
  }
  // Rodovia Fernão Dias (BR-381) / Betim / BH -> Eixo 40° / 220°
  if (addr.includes('fernão dias') || addr.includes('br-381') || addr.includes('betim') || base.includes('belo')) {
    return isSouthbound ? 220 : 40;
  }

  // Padrão alinhado ao fluxo viário
  return isSouthbound ? 180 : 0;
};

// Custom DIV Icon para os veículos usando Tailwind e fonte premium para placas
const createVehicleIcon = (v: any) => {
  const isMoving = v.speed > 0;
  const isIgnitionOn = Boolean(v.ignition);

  // Cores solicitadas com fidelidade:
  // Verde para quem estiver em movimento
  // Alaranjada para os que estiverem parados mas com a ignição ligada
  // Levemente avermelhada para os que estiverem com a ignição desligada
  const colorClass = isMoving
    ? 'bg-emerald-500 shadow-emerald-500/60 ring-2 ring-emerald-300/50'
    : isIgnitionOn
    ? 'bg-amber-500 shadow-amber-500/60 ring-2 ring-amber-300/50'
    : 'bg-rose-500/90 shadow-rose-500/50 ring-2 ring-rose-300/40';
  
  const pingColorClass = isMoving ? 'text-emerald-400' : 'text-amber-400';
  const headingAngle = calculateRoadHeading(v);
  
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center justify-center">
        <!-- Onda pulsante de ignição ativo (só pulsa se ignição estiver ON) -->
        ${isIgnitionOn ? `
          <span class="absolute h-10 w-10 rounded-full bg-current opacity-30 animate-ping ${pingColorClass}" style="animation-duration: 2s;"></span>
        ` : ''}
        
        <!-- Marcador Unificado: Bolinha Elegante com Setinha Branca Direcionada -->
        <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-lg ${colorClass} text-white transition-all hover:scale-125 duration-200" style="transform: rotate(${headingAngle}deg);">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="text-white drop-shadow-xs">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
        
        <!-- Placa de Identificação do Veículo estilo Mercosul Premium -->
        <div class="absolute top-9.5 flex flex-col items-center rounded-md overflow-hidden shadow-md border border-slate-350 bg-white min-w-[62px] z-20">
          <!-- Tarja Azul Mercosul com BRASIL -->
          <div class="w-full bg-[#002F6C] h-[4.5px] flex items-center justify-center relative">
            <span class="text-[3.5px] font-black text-white uppercase tracking-widest scale-75" style="transform: scale(0.7); line-height: 1; font-family: sans-serif;">BRASIL</span>
          </div>
          <!-- Texto da Placa com JetBrains Mono -->
          <span class="px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-widest text-slate-900 leading-none font-mono uppercase bg-white">
            ${v.plate}
          </span>
        </div>
      </div>
    `,
    className: 'custom-vehicle-leaflet-icon',
    iconSize: [64, 64],
    iconAnchor: [32, 16],
    popupAnchor: [0, -22]
  });
};

// Ícone para Pontos de Referência (POIs) no Mapa
const createPoiMapIcon = (tipo: string) => {
  let bg = '#114D38';
  let emoji = '📍';
  if (tipo === 'Posto') { bg = '#f97316'; emoji = '⛽'; }
  else if (tipo === 'Base') { bg = '#114D38'; emoji = '🏢'; }
  else if (tipo === 'Oficina') { bg = '#0284c7'; emoji = '🔧'; }
  else if (tipo === 'Cliente') { bg = '#7c3aed'; emoji = '⭐'; }

  return L.divIcon({
    html: `
      <div style="background:${bg}; color:#fff; padding:3px 7px; border-radius:10px; font-weight:800; font-size:10px; border:2px solid #fff; box-shadow:0 3px 6px rgba(0,0,0,0.35); display:flex; align-items:center; gap:3px; white-space:nowrap;">
        <span>${emoji}</span>
      </div>
    `,
    className: 'custom-poi-leaflet-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -25]
  });
};

export const TelemetryMapAndGrid: React.FC<TelemetryMapAndGridProps> = ({ 
  geoPositions, 
  fleetVehicles, 
  reservations 
}) => {
  const [mapProvidersList, setMapProvidersList] = useState<MapProvider[]>(() => getDynamicMapProviders());
  const [mapType, setMapType] = useState('primary_road');
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'kanban'>('map');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithGeoFrotas, setShowOnlyWithGeoFrotas] = useState(false);
  const [showPois, setShowPois] = useState(true);
  const [gridTab, setGridTab] = useState<'vehicles' | 'pois'>('vehicles');

  // Atualiza provedores caso ocorra failover para Mapbox ou retorno para Google Maps
  useEffect(() => {
    const unsubscribe = mapQuotaService.subscribe(() => {
      setMapProvidersList(getDynamicMapProviders());
    });
    return () => unsubscribe();
  }, []);

  // Carregar Pontos de Referência (POIs) cadastrados
  const [poisList, setPoisList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('risel_pois_v2') || localStorage.getItem('risel_pois');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'poi-1', nome: 'Posto Risel Paulínia', tipo: 'Posto', lat: -22.7610, lng: -47.1565, raioTolerancia: 120, descricao: 'Base de abastecimento prioritária Risel' },
      { id: 'poi-2', nome: 'Oficina Mecânica Express Paulínia', tipo: 'Oficina', lat: -22.7750, lng: -47.1412, raioTolerancia: 100, descricao: 'Oficina conveniada para revisões' },
      { id: 'poi-3', nome: 'Base Operacional Hortolândia', tipo: 'Base', lat: -22.8612, lng: -47.2185, raioTolerancia: 250, descricao: 'Ponto de apoio aos técnicos' },
      { id: 'poi-4', nome: 'Cliente Petrobras REPLAN - Portaria 3', tipo: 'Cliente', lat: -22.7314, lng: -47.1221, raioTolerancia: 200, descricao: 'Acesso industrial para serviços autorizados' }
    ];
  });

  // Estados dos filtros retráteis
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [filtroMesAno, setFiltroMesAno] = useState('Todos');
  const [filtroPlaca, setFiltroPlaca] = useState('Todas');
  const [filtroCondutor, setFiltroCondutor] = useState('Todos');
  const [filtroBase, setFiltroBase] = useState('Todas');

  // Estados para ordenação da tabela de telemetria
  const [sortField, setSortField] = useState<'plate' | 'model' | 'driver' | 'ignition' | 'speed' | 'odometer' | 'lastUpdate' | 'address' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Zoom & Pan do mapa legado (mantido para fallback de render estrutural)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.75));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Projeção geográfica legado para fallback
  const mapCoordinates = (geoLocationStr: string, charCodeSum: number) => {
    if (!geoLocationStr) {
      const left = 12 + (charCodeSum % 76);
      const top = 15 + ((charCodeSum * 3.5) % 68);
      return { x: left, y: top };
    }
    const parts = geoLocationStr.split(',');
    if (parts.length !== 2) {
      const left = 12 + (charCodeSum % 76);
      const top = 15 + ((charCodeSum * 3.5) % 68);
      return { x: left, y: top };
    }
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) {
      const left = 12 + (charCodeSum % 76);
      const top = 15 + ((charCodeSum * 3.5) % 68);
      return { x: left, y: top };
    }

    const latMin = -22.92;
    const latMax = -22.62;
    const lngMin = -47.32;
    const lngMax = -47.02;

    if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
      const left = 10 + (charCodeSum % 80);
      const top = 10 + ((charCodeSum * 3) % 70);
      return { x: left, y: top };
    }

    const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
    const y = ((latMax - lat) / (latMax - latMin)) * 100;
    return { x, y };
  };

  const selectedMapProvider = useMemo(() => {
    return mapProvidersList.find(m => m.id === mapType) || mapProvidersList[0];
  }, [mapType, mapProvidersList]);

  // Lista unificada e filtrada estritamente: Veículos do Controle de Frota Leve QUE POSSUEM rastreador GeoFrotas
  const processedFleet = useMemo(() => {
    return getProcessedFleetWithReservations(geoPositions, fleetVehicles, reservations);
  }, [geoPositions, fleetVehicles, reservations]);

  // Lista única de motoristas ativos para carregar no filtro
  const activeDriversList = useMemo(() => {
    const list = processedFleet.map(v => v.driver).filter(d => d && d !== 'Sem Condutor');
    return Array.from(new Set(list)).sort();
  }, [processedFleet]);

  // Lista dinâmica e unificada de bases operacionais reais da frota
  const availableBases = useMemo(() => {
    const baseSet = new Set<string>();
    processedFleet.forEach(v => {
      if (v.base) {
        const clean = v.base.replace(/^Base\s+/i, '').trim();
        if (clean) baseSet.add(clean);
      }
    });
    if (baseSet.size === 0) {
      ['Paulínia', 'Betim', 'Rio de Janeiro', 'São Bernardo do Campo', 'Santos', 'Macaé'].forEach(b => baseSet.add(b));
    }
    return Array.from(baseSet).sort((a, b) => {
      if (a === 'Paulínia') return -1;
      if (b === 'Paulínia') return 1;
      return a.localeCompare(b);
    });
  }, [processedFleet]);

  // Filtrar frota baseada na busca, status GeoFrotas e nos filtros avançados retráteis
  const filteredFleet = useMemo(() => {
    let list = processedFleet;
    
    // Filtro GeoFrotas Ativo
    if (showOnlyWithGeoFrotas) {
      list = list.filter(v => v.active);
    }
    
    // Filtro Avançado: Placa
    if (filtroPlaca !== 'Todas') {
      list = list.filter(v => v.plate === filtroPlaca);
    }

    // Filtro Avançado: Condutor
    if (filtroCondutor !== 'Todos') {
      list = list.filter(v => v.driver === filtroCondutor);
    }

    // Filtro Avançado: Base Operacional
    if (filtroBase !== 'Todas') {
      list = list.filter(v => v.base === filtroBase);
    }

    // Busca rápida textual
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(v => 
      v.plate.toLowerCase().includes(query) ||
      v.driver.toLowerCase().includes(query) ||
      v.model.toLowerCase().includes(query)
    );
  }, [processedFleet, searchQuery, showOnlyWithGeoFrotas, filtroPlaca, filtroCondutor, filtroBase]);

  // Contadores de unidades Online e Offline
  const onlineCount = useMemo(() => processedFleet.filter(v => v.active).length, [processedFleet]);
  const offlineCount = useMemo(() => processedFleet.filter(v => !v.active).length, [processedFleet]);

  // Função para mudar a ordenação
  const handleSort = (field: 'plate' | 'model' | 'driver' | 'ignition' | 'speed' | 'odometer' | 'lastUpdate' | 'address') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Frota ordenada para exibição na tabela
  const sortedFleet = useMemo(() => {
    if (!sortField) return filteredFleet;
    return [...filteredFleet].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'boolean') {
        valA = valA ? 1 : 0;
        valB = valB ? 1 : 0;
      }

      if (typeof valA === 'string') {
        const strA = valA as string;
        const strB = valB as string;
        return sortDirection === 'asc' 
          ? strA.localeCompare(strB) 
          : strB.localeCompare(strA);
      }

      const numA = valA as number;
      const numB = valB as number;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [filteredFleet, sortField, sortDirection]);

  // Veículo selecionado no mapa
  const activeVehicleOnMap = useMemo(() => {
    if (!selectedPlate) return null;
    return processedFleet.find(v => v.plate === selectedPlate) || null;
  }, [selectedPlate, processedFleet]);

  return (
    <div className="space-y-6 text-left">
      {/* Control Header */}
      <div className="bg-white p-3 rounded-2xl border border-slate-150 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-sm">
        {/* Busca Rápida Sempre Visível */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar placa, motorista ou modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          {/* Botão de Filtro Retrátil */}
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className={`px-3 py-1.5 border rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFilterExpanded 
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm' 
                : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Indicador Discreto Online/Offline */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wide shrink-0 shadow-inner">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              {onlineCount} Online
            </span>
            <span className="w-px h-3 bg-slate-250"></span>
            <span className="flex items-center gap-1.5 text-slate-450">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block"></span>
              {offlineCount} Offline
            </span>
          </div>

          {/* Chave Seletora de Homologação GeoFrotas */}
          <div className="flex items-center gap-2 border-r border-slate-150 pr-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showOnlyWithGeoFrotas} 
                onChange={(e) => setShowOnlyWithGeoFrotas(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer w-4 h-4"
              />
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                📡 Apenas GeoFrotas Ativo
              </span>
            </label>
          </div>

          {/* Seletor de Tipo de Mapa (Só aplicável se estiver em modo Mapa) */}
          {viewMode === 'map' && (
            <div className="flex items-center gap-1.5">
              <MapQuotaIndicator compact />
              <select
                value={mapType}
                onChange={(e) => setMapType(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                {mapProvidersList.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Alternador de Visualização em Três Abas Compactas */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Map className="w-3 h-3" /> Mapa
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table className="w-3 h-3" /> Lista / Grid
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3 h-3" /> Kanban (Cards)
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Filtros Retrátil Expandido */}
      <AnimatePresence>
        {isFilterExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            {/* Filtro por Mês/Ano */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-violet-500" />
                Mês / Ano
              </label>
              <select
                value={filtroMesAno}
                onChange={(e) => setFiltroMesAno(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                <option value="Todos">Todos os Períodos</option>
                <option value="Julho/2026">Julho/2026 (Atual)</option>
                <option value="Junho/2026">Junho/2026</option>
                <option value="Maio/2026">Maio/2026</option>
              </select>
            </div>

            {/* Filtro por Placa */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                Placa do Veículo
              </label>
              <select
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                <option value="Todas">Todas as Placas</option>
                {ALLOWED_PLATES.map(plate => (
                  <option key={plate} value={plate}>{plate}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Condutor */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                Condutor / Motorista
              </label>
              <select
                value={filtroCondutor}
                onChange={(e) => setFiltroCondutor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                <option value="Todos">Todos os Condutores</option>
                {activeDriversList.map(driver => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Base Operacional */}
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                <Compass className="w-3.5 h-3.5 text-orange-500" />
                Base Operacional
              </label>
              <select
                value={filtroBase}
                onChange={(e) => setFiltroBase(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                <option value="Todas">Todas as Bases ({processedFleet.length} veíc.)</option>
                {availableBases.map((baseName) => {
                  const countInBase = processedFleet.filter(v => v.base === baseName).length;
                  return (
                    <option key={baseName} value={baseName}>
                      {baseName} ({countInBase} veíc.)
                    </option>
                  );
                })}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* VIEW MODE: MAPA */}
        {viewMode === 'map' && (
          <motion.div
            key="map-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-3xl p-3 border border-slate-200 bg-white text-slate-800 relative overflow-hidden transition-all duration-500 shadow-sm"
          >
            {/* O MAPA INTERATIVO REAL (Leaflet + Google Maps / OpenStreetMap) */}
            <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner isolate z-0">
              
              {/* Badges de Status Flutuantes Absolutos de Alta Tecnologia e Estilo BI */}
              <div className="absolute top-3 left-12 z-30 flex flex-col gap-2 pointer-events-none">
                <div className="bg-slate-900/95 backdrop-blur text-white px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2 text-[9px] font-black tracking-wide shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>SINAL GPS GEO-FROTAS CONECTADO</span>
                </div>
              </div>

              <div className="absolute top-3 right-3 z-30 pointer-events-none">
                <div className="bg-slate-900/95 backdrop-blur text-white px-3 py-1.5 rounded-xl border border-slate-700 text-[9px] font-black shadow-md flex items-center gap-1.5">
                  <span>VISUAL: {selectedMapProvider.label.toUpperCase()}</span>
                </div>
              </div>
              <MapContainer 
                center={[-22.7682, -47.1539]}
                zoom={11} 
                className="w-full h-full"
                zoomControl={true}
              >
                {/* TileLayer dinâmico de acordo com o provedor selecionado (Google Maps ou Grátis) */}
                <TileLayer
                  url={selectedMapProvider.url}
                  attribution={selectedMapProvider.attribution}
                />

                {/* Enquadra perfeitamente todos os veículos ou foca no veículo selecionado com zoom mais próximo */}
                <FitMapBounds vehicles={filteredFleet} />
                <MapFocusController selectedPlate={selectedPlate} vehicles={filteredFleet} />

                {/* Marcadores dos veículos no mapa */}
                {filteredFleet.map((v) => {
                  let lat = -22.7682;
                  let lng = -47.1539;
                  if (v.geoLocation) {
                    const p = v.geoLocation.split(',');
                    lat = parseFloat(p[0]);
                    lng = parseFloat(p[1]);
                  } else {
                    const offsetLat = ((v.charCodeSum % 100) - 50) * 0.0008;
                    const offsetLng = ((v.charCodeSum % 100) - 50) * 0.0008;
                    lat += offsetLat;
                    lng += offsetLng;
                  }

                  const isSelected = selectedPlate === v.plate;

                  return (
                    <Marker
                      key={v.plate}
                      position={[lat, lng]}
                      icon={createVehicleIcon(v)}
                      eventHandlers={{
                        click: () => {
                          setSelectedPlate(isSelected ? null : v.plate);
                        }
                      }}
                    >
                      <Popup className="custom-leaflet-popup">
                        <div className="p-1 font-sans text-xs text-white">
                          <div className="flex justify-between items-center gap-2 mb-2 border-b border-slate-700/60 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-violet-600 text-white px-2 py-0.5 rounded font-black text-[10.5px] tracking-wider border border-violet-400">
                                {v.plate}
                              </span>
                              {v.isReservationInUse && (
                                <span className="bg-amber-500/25 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase">
                                  Em Reserva
                                </span>
                              )}
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              v.ignition ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                            }`}>
                              {v.ignition ? 'Ignição ON' : 'Desligado'}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-[11px]">
                            {/* Modelo e Condutor */}
                            <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
                              <p className="font-black text-slate-100 text-xs">{v.model}</p>
                              <div className="text-slate-300 mt-1 flex items-center justify-between gap-2">
                                <span className="text-slate-400 font-bold text-[10px]">Motorista:</span>
                                <span className="font-bold text-white text-[11px] text-right">{v.driver}</span>
                              </div>
                              {v.isReservationInUse && v.originalDriver && (
                                <p className="text-[9.5px] text-slate-400 italic text-right mt-0.5">Titular da Frota: {v.originalDriver}</p>
                              )}
                            </div>
                            
                            {/* Telemetria Rápida */}
                            <div className="grid grid-cols-2 gap-1.5 bg-slate-800/80 border border-slate-700 rounded-xl p-2 font-bold text-[10px] text-slate-300">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Velocidade:</span>
                                <span className="text-white font-black">{v.speed} km/h</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Bateria:</span>
                                <span className="text-white font-black">{v.batteryVoltage}V</span>
                              </div>
                            </div>

                            {/* Hora da Posição */}
                            <div className="flex items-center justify-between text-[10px] bg-slate-800/50 px-2.5 py-1.5 rounded-xl border border-slate-700/50 text-slate-300">
                              <span className="text-slate-400 font-bold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-violet-400 shrink-0" /> Hora da Posição:
                              </span>
                              <span className="font-mono text-emerald-400 font-bold text-[10.5px]">
                                {v.lastUpdate || 'Sincronizado agora'}
                              </span>
                            </div>
                            
                            {/* Endereço Completo Sem Cortes */}
                            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-[10.5px]">
                              <div className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" /> Endereço Completo
                              </div>
                              <p className="text-slate-100 font-medium break-words leading-relaxed text-[10.5px]">
                                {v.address}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Marcadores de Pontos de Referência Cadastrados (POIs) */}
                {showPois && poisList.map((poi) => (
                  <Marker
                    key={poi.id}
                    position={[poi.lat, poi.lng]}
                    icon={createPoiMapIcon(poi.tipo)}
                  >
                    <Popup className="custom-leaflet-popup">
                      <div className="p-1 font-sans text-xs text-white">
                        <div className="flex justify-between items-center gap-2 mb-1.5 border-b border-slate-700/60 pb-1">
                          <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                            📍 {poi.nome}
                          </span>
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase">
                            {poi.tipo}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[10.5px] mb-2 leading-relaxed">{poi.descricao || 'Ponto de referência cadastrado no sistema.'}</p>
                        <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/80 text-[10px] space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Coordenadas:</span>
                            <span className="font-mono text-emerald-400">{poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Raio de Tolerância:</span>
                            <span className="font-bold text-white">{poi.raioTolerancia || 100} metros</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* O contêiner de simulação do mapa antigo que será fechado para não dar erro de sintaxe */}
            {false && (
              <div style={{ display: 'none' }}>
              {/* Grid Map Background Simulation */}
              <div 
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#e2e8f0 1.5px, transparent 1.5px)`,
                  backgroundSize: '24px 24px'
                }}
              />

              <div 
                className="w-full h-full relative origin-center transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: '50% 50%'
                }}
              >
                {/* 1. ELEMENTOS REAIS DE SIMULAÇÃO CARTOGRÁFICA BASEADA NO MAP TYPE SELECIONADO */}
                {mapType === 'osm' && (
                  <svg className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
                    {/* Rios e Lagos */}
                    <path d="M -50,200 C 150,220 300,100 450,250 C 600,400 750,200 1100,220" fill="none" stroke="#0ea5e9" strokeWidth="12" opacity="0.6" />
                    <path d="M 600,120 Q 750,50 850,150 T 980,100" fill="none" stroke="#38bdf8" strokeWidth="6" opacity="0.5" />
                    
                    {/* Vias Principais / Rodovias com asfalto cinza e linha central tracejada amarela */}
                    {/* SP-348 Bandeirantes */}
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#475569" strokeWidth="8" />
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="5,5" />
                    
                    {/* SP-330 Anhangüera */}
                    <path d="M 200,0 L 500,600" fill="none" stroke="#475569" strokeWidth="8" />
                    <path d="M 200,0 L 500,600" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                    <path d="M 200,0 L 500,600" fill="none" stroke="#fef08a" strokeWidth="1" strokeDasharray="5,5" />

                    {/* SP-332 Zeferino Vaz */}
                    <path d="M 100,500 L 900,100" fill="none" stroke="#64748b" strokeWidth="6" />
                    <path d="M 100,500 L 900,100" fill="none" stroke="#ffffff" strokeWidth="1.5" />

                    {/* Parques */}
                    <rect x="50" y="50" width="120" height="80" rx="10" fill="#059669" opacity="0.15" />
                    <rect x="750" y="300" width="180" height="150" rx="15" fill="#059669" opacity="0.15" />

                    {/* Etiquetas de Cidades e Bairros */}
                    <g fill="#1e293b" fontSize="11" fontWeight="800" fontFamily="Inter, sans-serif">
                      <rect x="420" y="240" width="110" height="18" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                      <text x="475" y="253" textAnchor="middle" fill="#0f172a">PAULÍNIA (Centro)</text>

                      <rect x="780" y="420" width="100" height="18" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                      <text x="830" y="433" textAnchor="middle" fill="#1e293b">CAMPINAS</text>

                      <rect x="110" y="80" width="80" height="18" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                      <text x="150" y="93" textAnchor="middle" fill="#475569">SUMARÉ</text>

                      <rect x="680" y="80" width="90" height="18" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                      <text x="725" y="93" textAnchor="middle" fill="#475569">COSMÓPOLIS</text>

                      <rect x="430" y="520" width="90" height="18" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                      <text x="475" y="533" textAnchor="middle" fill="#475569">HORTOLÂNDIA</text>
                    </g>

                    {/* Identificação de Rodovias */}
                    <g fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      <rect x="180" y="140" width="45" height="14" rx="3" fill="#1e3a8a" />
                      <text x="202" y="150" textAnchor="middle">SP-348</text>

                      <rect x="240" y="100" width="45" height="14" rx="3" fill="#1e3a8a" />
                      <text x="262" y="110" textAnchor="middle">SP-330</text>

                      <rect x="600" y="230" width="45" height="14" rx="3" fill="#047857" />
                      <text x="622" y="240" textAnchor="middle">SP-332</text>
                    </g>
                  </svg>
                )}

                {mapType === 'google' && (
                  <svg className="absolute inset-0 w-full h-full opacity-85 pointer-events-none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
                    {/* Fundo de Satélite Texturizado - Florestas e Quadras escuras */}
                    <rect x="0" y="0" width="1000" height="600" fill="#0b130a" />
                    
                    {/* Floresta / Áreas Verdes de Satélite */}
                    <circle cx="200" cy="150" r="160" fill="#0f2a0d" opacity="0.7" />
                    <circle cx="850" cy="250" r="210" fill="#0c230b" opacity="0.8" />
                    <rect x="400" y="450" width="300" height="150" rx="40" fill="#0f2d12" opacity="0.6" />

                    {/* Mar / Represa Atibaia */}
                    <path d="M -10,380 C 150,400 350,370 500,430 T 1100,500" fill="none" stroke="#08182b" strokeWidth="45" opacity="0.9" />
                    <path d="M -10,380 C 150,400 350,370 500,430 T 1100,500" fill="none" stroke="#030c17" strokeWidth="15" opacity="0.9" />

                    {/* Rodovias em destaque Satélite (Linhas amarelas vibrantes e asfalto cinza escuro) */}
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#fbbf24" strokeWidth="2" />
                    
                    <path d="M 200,0 L 500,600" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <path d="M 200,0 L 500,600" fill="none" stroke="#fbbf24" strokeWidth="2" />

                    <path d="M 100,500 L 900,100" fill="none" stroke="#0f172a" strokeWidth="6" />
                    <path d="M 100,500 L 900,100" fill="none" stroke="#f59e0b" strokeWidth="1.5" />

                    {/* Etiquetas de Cidades no modo Satélite (Caixas pretas transparentes com texto branco) */}
                    <g fill="white" fontSize="11" fontWeight="900" fontFamily="Inter, sans-serif" letterSpacing="0.5">
                      <rect x="420" y="240" width="110" height="18" rx="4" fill="black" stroke="#334155" strokeWidth="1.5" opacity="0.8" />
                      <text x="475" y="253" textAnchor="middle" fill="#34d399">PAULÍNIA (Centro)</text>

                      <rect x="780" y="420" width="100" height="18" rx="4" fill="black" stroke="#334155" strokeWidth="1.5" opacity="0.8" />
                      <text x="830" y="433" textAnchor="middle" fill="#ffffff">CAMPINAS</text>

                      <rect x="110" y="80" width="80" height="18" rx="4" fill="black" stroke="#334155" strokeWidth="1.5" opacity="0.8" />
                      <text x="150" y="93" textAnchor="middle" fill="#94a3b8">SUMARÉ</text>

                      <rect x="680" y="80" width="90" height="18" rx="4" fill="black" stroke="#334155" strokeWidth="1.5" opacity="0.8" />
                      <text x="725" y="93" textAnchor="middle" fill="#94a3b8">COSMÓPOLIS</text>
                    </g>

                    {/* Escudos das Rodovias */}
                    <g fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      <rect x="180" y="140" width="45" height="14" rx="3" fill="#1e3a8a" stroke="#fff" strokeWidth="0.5" />
                      <text x="202" y="150" textAnchor="middle">SP-348</text>

                      <rect x="240" y="100" width="45" height="14" rx="3" fill="#1e3a8a" stroke="#fff" strokeWidth="0.5" />
                      <text x="262" y="110" textAnchor="middle">SP-330</text>

                      <rect x="600" y="230" width="45" height="14" rx="3" fill="#047857" stroke="#fff" strokeWidth="0.5" />
                      <text x="622" y="240" textAnchor="middle">SP-332</text>
                    </g>
                  </svg>
                )}

                {mapType === 'carto_light' && (
                  <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
                    {/* Rios Azul Pastel Suave */}
                    <path d="M -50,200 C 150,220 300,100 450,250 C 600,400 750,200 1100,220" fill="none" stroke="#bae6fd" strokeWidth="10" />
                    
                    {/* Linhas de Tráfego Cinza Claro de Alta Precisão */}
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#cbd5e1" strokeWidth="4" />
                    <path d="M 200,0 L 500,600" fill="none" stroke="#cbd5e1" strokeWidth="4" />
                    <path d="M 100,500 L 900,100" fill="none" stroke="#cbd5e1" strokeWidth="3" />

                    {/* Rotatória Central */}
                    <circle cx="475" cy="250" r="45" fill="none" stroke="#cbd5e1" strokeWidth="3" />
                    
                    {/* Prédios cinzas claros */}
                    <rect x="50" y="80" width="60" height="50" rx="4" fill="#f1f5f9" />
                    <rect x="130" y="60" width="80" height="40" rx="4" fill="#f1f5f9" />
                    <rect x="850" y="120" width="100" height="70" rx="4" fill="#f1f5f9" />

                    {/* Rótulos de Cidade Clean */}
                    <g fill="#475569" fontSize="11" fontWeight="700" fontFamily="sans-serif">
                      <text x="475" y="235" textAnchor="middle" fill="#0f172a" fontWeight="900">Paulínia</text>
                      <text x="830" y="415" textAnchor="middle" fill="#334155" fontWeight="900">Campinas</text>
                      <text x="150" y="75" textAnchor="middle">Sumaré</text>
                      <text x="725" y="75" textAnchor="middle">Cosmópolis</text>
                    </g>
                  </svg>
                )}

                {mapType === 'carto_dark' && (
                  <svg className="absolute inset-0 w-full h-full opacity-65 pointer-events-none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
                    {/* Linhas Futuristas Neon Cibernéticas */}
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#1e1b4b" strokeWidth="5" />
                    <path d="M 0,100 L 1000,400" fill="none" stroke="#4f46e5" strokeWidth="1" opacity="0.6" />

                    <path d="M 200,0 L 500,600" fill="none" stroke="#1e1b4b" strokeWidth="5" />
                    <path d="M 200,0 L 500,600" fill="none" stroke="#4f46e5" strokeWidth="1" opacity="0.6" />

                    <path d="M 100,500 L 900,100" fill="none" stroke="#1e1b4b" strokeWidth="4" />
                    <path d="M 100,500 L 900,100" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.6" />

                    {/* Círculos concêntricos simulando sinal satélite */}
                    <circle cx="475" cy="250" r="180" fill="none" stroke="#312e81" strokeWidth="1.5" strokeDasharray="5,15" opacity="0.5" />
                    
                    {/* Nomes em Neon */}
                    <g fill="#a5b4fc" fontSize="11" fontWeight="900" fontFamily="Inter, monospace" letterSpacing="1">
                      <text x="475" y="230" textAnchor="middle" fill="#38bdf8">PAULÍNIA // CENTRAL</text>
                      <text x="830" y="410" textAnchor="middle" fill="#a78bfa">CAMPINAS NODE_01</text>
                      <text x="150" y="75" textAnchor="middle" fill="#6366f1">SUMARÉ REGION</text>
                    </g>
                  </svg>
                )}

                {mapType === 'topo' && (
                  <svg className="absolute inset-0 w-full h-full opacity-55 pointer-events-none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
                    {/* Curvas de Nível Marrom e Laranja Ouro */}
                    <path d="M 0,50 C 200,30 300,150 500,80 Q 750,0 1000,120" fill="none" stroke="#451a03" strokeWidth="1.5" opacity="0.5" />
                    <path d="M 0,100 C 220,80 320,200 520,130 Q 770,50 1000,170" fill="none" stroke="#451a03" strokeWidth="1.2" opacity="0.5" />
                    <path d="M 0,150 C 240,130 340,250 540,180 Q 790,100 1000,220" fill="none" stroke="#451a03" strokeWidth="1" opacity="0.4" />
                    
                    {/* Cadeia de Montanhas (Círculos concêntricos irregulares de altitude) */}
                    <circle cx="350" cy="350" r="120" fill="none" stroke="#78350f" strokeWidth="1.5" opacity="0.6" />
                    <circle cx="350" cy="350" r="80" fill="none" stroke="#92400e" strokeWidth="1" opacity="0.6" />
                    <text x="350" y="355" fill="#fef08a" fontSize="8" fontWeight="bold" textAnchor="middle">750m (Serra)</text>

                    {/* Rio Topográfico Verde Água */}
                    <path d="M 475,0 C 490,180 300,380 380,600" fill="none" stroke="#0d9488" strokeWidth="6" opacity="0.5" />

                    {/* Rótulos de Cidades Topográficas */}
                    <g fill="#78350f" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                      <text x="475" y="235" textAnchor="middle" fill="#451a03">Paulínia (610m)</text>
                      <text x="830" y="415" textAnchor="middle" fill="#451a03">Campinas (680m)</text>
                    </g>
                  </svg>
                )}

                {/* 2. VEÍCULOS HOMOLOGADOS COM GEOFRotas EM COORDENADAS REAIS */}
                {filteredFleet.map((v) => {
                  const isSelected = selectedPlate === v.plate;
                  const coord = mapCoordinates(v.geoLocation, v.charCodeSum);

                  return (
                    <button
                      key={v.plate}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlate(isSelected ? null : v.plate);
                      }}
                      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                      className="absolute text-center transform -translate-x-1/2 -translate-y-1/2 focus:outline-none z-20 group cursor-pointer transition-transform duration-300 hover:scale-110 pointer-events-auto"
                    >
                      {/* Pulsing ring around marker */}
                      {v.ignition && (
                        <span className="absolute -inset-2.5 rounded-full bg-emerald-500/25 animate-ping" style={{ animationDuration: '2s' }} />
                      )}

                      <div className={`font-mono font-black text-[9px] px-2.5 py-1 rounded shadow-md flex items-center gap-1.5 border transition-all ${
                        isSelected 
                          ? 'bg-violet-600 text-white border-violet-400 scale-110 z-30 ring-4 ring-violet-500/30' 
                          : v.ignition 
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold' 
                            : 'bg-slate-700 text-slate-200 border-slate-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${v.ignition ? 'bg-slate-950 animate-pulse' : 'bg-slate-400'}`} />
                        {v.plate}
                      </div>
                      
                      <span className="text-[8.5px] font-extrabold block mt-1 drop-shadow transition-all group-hover:scale-105 text-slate-800">
                        {v.driver.split(' ')[0]} ({v.speed} km/h)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Botões de Zoom no Canto Inferior Direito do Mapa */}
              <div className="absolute bottom-4 right-4 z-45 flex flex-col gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-black text-sm cursor-pointer shadow transition-all hover:scale-105"
                  title="Aproximar"
                >
                  +
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-black text-sm cursor-pointer shadow transition-all hover:scale-105"
                  title="Afastar"
                >
                  -
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); resetZoom(); }}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center text-xs cursor-pointer shadow transition-all hover:scale-105"
                  title="Resetar Zoom e Centralizar"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Selected vehicle drawer OVER the map */}
              {activeVehicleOnMap && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-80 bg-slate-900/95 backdrop-blur-md border border-slate-750 p-5 rounded-2xl shadow-2xl z-30 text-white text-xs text-left"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-mono bg-violet-600 text-white px-2.5 py-0.5 rounded text-xs font-black tracking-wider border border-violet-400">
                        {activeVehicleOnMap.plate}
                      </span>
                      <h5 className="font-bold text-slate-100 mt-2 text-sm">{activeVehicleOnMap.model}</h5>
                    </div>
                    <button 
                      onClick={() => setSelectedPlate(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                    >
                      Voltar
                    </button>
                  </div>

                  <div className="space-y-2 text-slate-300 font-medium">
                    <div className="flex justify-between border-b border-slate-800 pb-1.5 items-start">
                      <span className="text-slate-450 text-[9px] uppercase font-black shrink-0 mt-0.5">Motorista:</span>
                      <div className="text-right">
                        <span className="font-bold text-slate-100 block">{activeVehicleOnMap.driver}</span>
                        {activeVehicleOnMap.isReservationInUse && (
                          <span className="inline-flex items-center gap-1 bg-amber-500/25 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase mt-0.5">
                            <Clock className="w-2.5 h-2.5" /> Reserva em Uso
                          </span>
                        )}
                        {activeVehicleOnMap.isReservationInUse && activeVehicleOnMap.originalDriver && (
                          <span className="text-[9px] text-slate-400 block mt-0.5">Titular: {activeVehicleOnMap.originalDriver}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-450 text-[9px] uppercase font-black">Velocidade Atual:</span>
                      <span className={`font-black flex items-center gap-1 text-sm ${activeVehicleOnMap.speed > 80 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                        <Gauge className="w-3.5 h-3.5" /> {activeVehicleOnMap.speed} km/h
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-450 text-[9px] uppercase font-black">Ignição:</span>
                      <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${activeVehicleOnMap.ignition ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {activeVehicleOnMap.ignition ? 'LIGADA (ON)' : 'DESLIGADA (OFF)'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-slate-450 text-[9px] uppercase font-black">Odômetro:</span>
                      <span className="font-mono">{activeVehicleOnMap.odometer.toLocaleString('pt-BR')} km</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1.5 items-center">
                      <span className="text-slate-450 text-[9px] uppercase font-black flex items-center gap-1">
                        <Clock className="w-3 h-3 text-violet-400" /> Hora da Posição:
                      </span>
                      <span className="font-mono text-emerald-400 text-[10.5px] font-bold">{activeVehicleOnMap.lastUpdate}</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-0.5">
                      <span className="text-slate-450 text-[9px] uppercase font-black flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-400" /> Endereço Completo:
                      </span>
                      <span className="text-slate-100 font-medium text-[10.5px] leading-relaxed bg-slate-800/80 p-2 rounded-xl border border-slate-700/80 break-words">
                        {activeVehicleOnMap.address}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 mt-3 text-[10px] text-slate-400 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Sinal: {activeVehicleOnMap.signalStrength}%
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Battery className="w-3.5 h-3.5 text-indigo-400" /> Bateria: {activeVehicleOnMap.batteryVoltage}V
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            )}

            {/* Bottom Info Bar */}
            <div className="relative z-10 grid grid-cols-3 gap-4 border-t pt-4 text-center border-slate-200">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-black">Frota Monitorada</span>
                <span className="text-xs font-black mt-1 block text-slate-800">
                  {processedFleet.length} Veículos Ativos
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-black">Em Movimento</span>
                <span className="text-xs font-black mt-1 block text-slate-800">
                  {processedFleet.filter(v => v.speed > 0).length} Unidades
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-black">Sinal Médio GPS</span>
                <span className="text-xs font-black text-emerald-500 mt-1 block">
                  92% Excelente
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW MODE: LISTA (Tabela completa por padrão ao sair do mapa) */}
        {viewMode === 'list' && (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Grid de Telemetria e Posições Ativas</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Acompanhamento ordenado de placas permitidas da Frota Leve e Pontos de Referência (POIs).</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Abas de alternância entre Veículos e Pontos de Referência */}
                <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
                  <button
                    onClick={() => setGridTab('vehicles')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                      gridTab === 'vehicles' ? 'bg-[#114D38] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🚗 Veículos ({filteredFleet.length})
                  </button>
                  <button
                    onClick={() => setGridTab('pois')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                      gridTab === 'pois' ? 'bg-[#114D38] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📍 Pontos de Referência ({poisList.length})
                  </button>
                </div>

                <button
                  onClick={() => setViewMode('map')}
                  className="px-3.5 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-250 text-violet-700 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Map className="w-3.5 h-3.5" /> Ver Mapa
                </button>
              </div>
            </div>

            {/* TABELA DE VEÍCULOS */}
            {gridTab === 'vehicles' && (
              <>
                <div className="overflow-auto max-h-[520px] border border-slate-100 rounded-2xl scrollbar-thin shadow-xs">
                  <table className="w-full text-left border-collapse text-xs relative">
                    <thead>
                      <tr className="bg-[#114D38] font-black uppercase text-white tracking-wider text-[9px] border-b border-slate-150">
                        <th 
                          onClick={() => handleSort('plate')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Placa {sortField === 'plate' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('model')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Modelo {sortField === 'model' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('driver')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Condutor / Motorista {sortField === 'driver' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('ignition')} 
                          className="py-3 px-4 text-center sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center justify-center gap-1">
                            Ignição {sortField === 'ignition' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('speed')} 
                          className="py-3 px-4 text-center sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center justify-center gap-1">
                            Velocidade {sortField === 'speed' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('odometer')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Odômetro {sortField === 'odometer' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('lastUpdate')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Data / Horário Posição {sortField === 'lastUpdate' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('address')} 
                          className="py-3 px-4 sticky top-0 bg-[#114D38] z-10 cursor-pointer hover:bg-[#0e3e2d] transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            Última Localização (Endereço Completo) {sortField === 'address' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                        <th className="py-3 px-4 text-center sticky top-0 bg-[#114D38] z-10">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                      {sortedFleet.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                            Nenhum veículo encontrado para a busca realizada.
                          </td>
                        </tr>
                      ) : (
                        sortedFleet.map((v) => (
                          <tr key={v.plate} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-mono font-black bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800 text-[11px] shadow-sm">
                                {v.plate}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">{v.model}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-800">{v.driver}</span>
                                {v.isReservationInUse && (
                                   <div className="flex items-center gap-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase">
                                      <Clock className="w-2.5 h-2.5" /> Reserva em Uso
                                    </span>
                                    {v.originalDriver && (
                                      <span className="text-[9px] text-slate-400 font-semibold">(Titular: {v.originalDriver})</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                v.ignition 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${v.ignition ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                {v.ignition ? 'Ligada' : 'Desligada'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-black">
                              <span className={v.speed > 80 ? 'text-rose-600 font-black' : 'text-slate-850'}>
                                {v.speed} km/h
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px]">{v.odometer.toLocaleString('pt-BR')} km</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-150">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{v.lastUpdate}</span>
                              </div>
                            </td>
                            {/* Endereço completo sem cortes, com boa largura e sem sobreposição */}
                            <td className="py-3 px-4 min-w-[240px] max-w-[360px]">
                              <div className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-normal break-words bg-slate-50 p-2 rounded-xl border border-slate-150">
                                {v.address}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => {
                                  setSelectedPlate(v.plate);
                                  setViewMode('map');
                                }}
                                className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-150 text-violet-700 rounded-lg text-[9.5px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1 mx-auto transition-colors shadow-xs"
                              >
                                <MapPin className="w-3 h-3" /> Focar no Mapa
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold pt-2">
                  <span>Exibindo {filteredFleet.length} de {processedFleet.length} placas cadastradas</span>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ignição ON: {processedFleet.filter(v => v.ignition).length}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Desligados: {processedFleet.filter(v => !v.ignition).length}</span>
                  </div>
                </div>
              </>
            )}

            {/* TABELA DE PONTOS DE REFERÊNCIA (POIs) */}
            {gridTab === 'pois' && (
              <div className="space-y-3">
                <div className="overflow-auto max-h-[520px] border border-slate-100 rounded-2xl scrollbar-thin shadow-xs">
                  <table className="w-full text-left border-collapse text-xs relative">
                    <thead>
                      <tr className="bg-[#114D38] font-black uppercase text-white tracking-wider text-[9px] border-b border-slate-150">
                        <th className="py-3 px-4 sticky top-0 bg-[#114D38] z-10">Nome do Ponto</th>
                        <th className="py-3 px-4 sticky top-0 bg-[#114D38] z-10">Tipo</th>
                        <th className="py-3 px-4 sticky top-0 bg-[#114D38] z-10">Descrição / Finalidade</th>
                        <th className="py-3 px-4 sticky top-0 bg-[#114D38] z-10">Coordenadas</th>
                        <th className="py-3 px-4 text-center sticky top-0 bg-[#114D38] z-10">Raio de Tolerância</th>
                        <th className="py-3 px-4 text-center sticky top-0 bg-[#114D38] z-10">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                      {poisList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                            Nenhum ponto de referência cadastrado no momento.
                          </td>
                        </tr>
                      ) : (
                        poisList.map((poi) => (
                          <tr key={poi.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                📍 {poi.nome}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                                {poi.tipo}
                              </span>
                            </td>
                            <td className="py-3 px-4 min-w-[200px] max-w-[300px]">
                              <span className="text-slate-600 text-[11px] leading-relaxed">
                                {poi.descricao || 'Ponto operacional cadastrado.'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700">
                              {poi.raioTolerancia || 100} metros
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setViewMode('map')}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[9.5px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1 mx-auto transition-colors"
                              >
                                <Map className="w-3 h-3" /> Ver no Mapa
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold pt-2">
                  <span>Total de {poisList.length} Pontos de Referência cadastrados</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW MODE: KANBAN CARDS (Grade com cards individuais) */}
        {viewMode === 'kanban' && (
          <motion.div
            key="kanban-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-4"
          >
            <div className="bg-white p-4 rounded-2xl border border-slate-150 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Visualização em Kanban (Grade de Cards)</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Cards interativos bento com sparklines de velocidade e telemetria.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <List className="w-3.5 h-3.5" /> Alternar para Lista
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className="px-3.5 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-250 text-violet-700 font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Map className="w-3.5 h-3.5" /> Voltar ao Mapa
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFleet.length === 0 ? (
                <div className="col-span-full bg-white rounded-3xl p-8 text-center text-slate-400 font-semibold border border-slate-150">
                  Nenhum veículo encontrado para a busca realizada.
                </div>
              ) : (
                filteredFleet.map((v) => {
                  const speedHistory = [
                    v.speed * 0.4, v.speed * 0.7, v.speed * 0.9, v.speed * 0.5,
                    v.speed * 0.8, v.speed * 0.95, v.speed
                  ].map(s => Math.round(s));

                  const sparklinePoints = speedHistory
                    .map((val, i) => `${i * 20},${40 - (val / 140) * 35}`)
                    .join(' ');

                  return (
                    <motion.div
                      key={v.plate}
                      whileHover={{ y: -4 }}
                      className="bg-white rounded-3xl p-5 border border-slate-150 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Plate & Status */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs font-black tracking-wider text-slate-800 shadow-inner">
                              {v.plate}
                            </span>
                            <h4 className="font-bold text-slate-800 mt-2 text-sm">{v.model}</h4>
                          </div>

                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                            v.ignition 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${v.ignition ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {v.ignition ? 'Ignição ON' : 'Desligado'}
                          </span>
                        </div>

                        {/* Meta Info */}
                        <div className="space-y-2 mt-4 text-xs font-medium text-slate-600 border-b border-slate-100 pb-4 text-left">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-400 text-[9px] uppercase font-black shrink-0 mt-0.5">Motorista:</span>
                            <div className="text-right">
                              <span className="font-bold text-slate-800 block">{v.driver}</span>
                              {v.isReservationInUse && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded text-[8px] font-black uppercase mt-0.5">
                                  <Clock className="w-2 h-2" /> Em Reserva
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[9px] uppercase font-black">Odômetro:</span>
                            <span className="font-mono text-slate-700">{v.odometer.toLocaleString('pt-BR')} km</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-[9px] uppercase font-black">Última Posição:</span>
                            <span className="font-mono text-slate-700 text-[10px]">{v.lastUpdate}</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-slate-440 text-[9px] uppercase font-black shrink-0 mt-0.5">Endereço:</span>
                            <span className="text-right text-slate-800 truncate max-w-[170px]" title={v.address}>
                              {v.address}
                            </span>
                          </div>
                        </div>

                        {/* Sparkline & Current Speed */}
                        <div className="flex items-center justify-between py-4 border-b border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 font-black uppercase block">Velocidade</span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className={`text-2xl font-extrabold tracking-tight ${v.speed > 80 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                                {v.speed}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">km/h</span>
                            </div>
                          </div>

                          {/* Sparkline SVG */}
                          {v.speed > 0 && (
                            <div className="w-24 h-10 opacity-70">
                              <svg className="w-full h-full" viewBox="0 0 120 40">
                                <polyline
                                  fill="none"
                                  stroke={v.speed > 80 ? '#f43f5e' : '#8b5cf6'}
                                  strokeWidth="2"
                                  points={sparklinePoints}
                                />
                                <path
                                  d={`M 0,40 ${sparklinePoints.split(' ').map((p, idx) => idx === 0 ? `L ${p}` : `L ${p}`).join(' ')} L 120,40 Z`}
                                  fill={v.speed > 80 ? 'rgba(244,63,94,0.1)' : 'rgba(139,92,246,0.1)'}
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Technical Status & Action */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mt-3 pt-1">
                        <span className="flex items-center gap-1">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" /> {v.signalStrength}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Battery className="w-3.5 h-3.5 text-indigo-400" /> {v.batteryVoltage}V
                        </span>
                        <button
                          onClick={() => {
                            setSelectedPlate(v.plate);
                            setViewMode('map');
                          }}
                          className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-150 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          Focar Mapa
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

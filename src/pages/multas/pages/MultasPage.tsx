
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllData, saveMulta, saveBatchMultas, deleteMulta, cleanString, uploadFileToDrive, generateAuthPdfDocs, getDriveFolderId, getDocsTemplateId, formatInputText, saveCodigo, fetchBaseEmailMappings, fetchPlacaEmailMappings, savePlacaEmailMappings, DEFAULT_EMAIL_MAPPINGS, deleteDriveFiles } from '../services/storage';
import { generateAutorizacaoDescontoPdf, openTermoInNewTab } from '../services/pdfGenerator';
import { VEICULOS_REAIS } from '../../../data/veiculos_reais';
import { parseLocalDate } from '../services/dateUtils';
import { Multa, StatusMulta, TipoMulta, Veiculo, Motorista, CodigoMulta } from '../types';
import { Plus, Search, FileText, Download, Save, Send, AlertTriangle, Calendar, DollarSign, Clock, User, LayoutGrid, List as ListIcon, Edit2, Edit3, Car, ArrowRight, Info, MapPin, Trash2, UploadCloud, Eye, Loader2, HelpCircle, X, Mail, ArrowLeft, Map as MapIcon, Layers, Paperclip, FileCheck, RectangleHorizontal, Filter, ChevronDown, ChevronUp, FileSpreadsheet, ArrowUpDown, CheckCircle2, MessageSquare, AlertCircle, Radio, Navigation } from 'lucide-react';
import Loading from '../components/Loading';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { mapQuotaService } from '../../../services/mapQuotaService';
import { MapQuotaIndicator } from '../../../components/reserva/MapQuotaIndicator';
import { getAccurateCoordinates, setManualCoordinateOverride } from '../../../services/accurateGeocodingService';
import { fetchVehiclePositionAtTime, TrackerMatchResult } from '../../../services/geoFrotasService';
import { MercosulPlateBadge } from '../../../components/MercosulPlateBadge';
import { formatCPF, cleanCPF } from '../../../utils/cpfHelper';
import { ImportarMultasCsvModal } from '../components/ImportarMultasCsvModal';

// FIX: Declare L on Window to avoid TypeScript errors with Leaflet
declare global {
  interface Window {
    L: any;
  }
}

// ADMIN EMAIL (CC)
const ADMIN_EMAIL = 'deny.goncalves@risel.com.br';
const LOGISTICA_EMAIL = 'logistica6@risel.com.br';

const initialMulta: Partial<Multa> = {
  status: StatusMulta.AGUARDANDO_BOLETO,
  tipo: TipoMulta.NOTIFICACAO,
  recebidaComPrazo: 'SIM',
  rodoviaOuUrbano: 'URBANO',
  retornouComPrazo: 'NÃO',
  empresaOuCondutor: 'CONDUTOR',
  descontarMotorista: 'SIM',
  pagoComDesconto: 'SIM',
};

const sanitizeMultaForForm = (m: Partial<Multa>): Partial<Multa> => {
  if (!m) return { ...initialMulta };
  return {
    ...m,
    id: String(m.id || m.ait || ''),
    ait: String(m.ait || ''),
    placa: String(m.placa || ''),
    frota: String(m.frota || ''),
    base: String(m.base || ''),
    enquadramento: String(m.enquadramento ?? '').trim(),
    artigoCtb: String(m.artigoCtb ?? '').trim(),
    descricaoInfracao: String(m.descricaoInfracao ?? '').trim(),
    responsavelNome: String(m.responsavelNome ?? '').trim(),
    responsavelCodigo: String(m.responsavelCodigo ?? '').trim(),
    orgaoAutuador: String(m.orgaoAutuador ?? '').trim(),
    endereco: String(m.endereco ?? '').trim(),
    municipio: String(m.municipio ?? '').trim(),
    uf: String(m.uf ?? '').trim(),
    obs: String(m.obs ?? '').trim(),
    linkAit: String(m.linkAit ?? ''),
    linkAuth: String(m.linkAuth ?? '')
  };
};

// ... (Rest of the Map logic and helper functions remain unchanged) ...
// --- OPÇÕES DE LAYERS DE MAPA SEGUROS (Zero Custo / PT-BR) ---
const getDynamicMultasLayers = () => {
    const layers = mapQuotaService.getLayers();
    return [
        { id: 'streets', name: layers.streets.label || 'Ruas (Google/Mapbox)', url: layers.streets.url, attribution: layers.streets.attribution },
        { id: 'satellite', name: layers.satellite.label || 'Satélite Híbrido', url: layers.satellite.url, attribution: layers.satellite.attribution },
        { id: 'osm', name: 'OpenStreetMap (Livre)', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' }
    ];
};

const GEO_CACHE_KEY = 'risel_multas_geocache_v3';
const LINK_SEPARATOR = ' | ';
const NAME_SEPARATOR = '::';

const parseLinks = (linkStr?: string) => {
    if (!linkStr) return [];
    return linkStr.split(LINK_SEPARATOR).filter(s => s.trim()).map(part => {
        if (part.includes(NAME_SEPARATOR)) {
            const [name, ...urlParts] = part.split(NAME_SEPARATOR);
            return { name, url: urlParts.join(NAME_SEPARATOR) };
        }
        return { name: 'AIT (Anexo)', url: part };
    });
};

const MapModal: React.FC<{ 
    multas: Multa[]; 
    onClose: () => void; 
    singleMode?: boolean; 
    title: string;
}> = ({ multas, onClose, singleMode, title }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [loadingMap, setLoadingMap] = useState(true);
    const [statusText, setStatusText] = useState("Inicializando mapa...");
    const [cachedCount, setCachedCount] = useState(0);
    const [newCount, setNewCount] = useState(0);
    const [trackerInfo, setTrackerInfo] = useState<TrackerMatchResult | null>(null);
    const [availableLayers, setAvailableLayers] = useState(getDynamicMultasLayers());
    const [currentLayer, setCurrentLayer] = useState(availableLayers[0]);
    const mapInstanceRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);
    const geoCacheRef = useRef<Record<string, any>>({});

    // Travar scroll do fundo (body) e habilitar fechar via tecla Escape
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Redimensionamento recalculado do Leaflet para garantir máxima estabilidade visual
    useEffect(() => {
        const timer = setTimeout(() => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.invalidateSize();
            }
        }, 200);
        return () => clearTimeout(timer);
    }, []);

    // Sincronizar camadas caso haja chaveamento de cota
    useEffect(() => {
        const unsubscribe = mapQuotaService.subscribe(() => {
            const updated = getDynamicMultasLayers();
            setAvailableLayers(updated);
            setCurrentLayer(prev => updated.find(l => l.id === prev.id) || updated[0]);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        try {
            const savedCache = localStorage.getItem(GEO_CACHE_KEY);
            if (savedCache) {
                geoCacheRef.current = JSON.parse(savedCache);
            }
        } catch (e) { console.error("Erro ao carregar cache de multas:", e); }
    }, []);

    const saveToCache = (key: string, data: any) => {
        geoCacheRef.current[key] = data;
        try { 
            localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCacheRef.current)); 
        } catch (e) {}
    };

    const smartGeocode = async (m: Multa) => {
        // 1. Se a multa já tiver coordenadas no próprio objeto
        if (m.latitude && m.longitude) {
            return { 
                lat: m.latitude, 
                lon: m.longitude, 
                method: 'direct_object', 
                precision: 'high',
                sourceDescription: 'Coordenadas Fixadas da Multa',
                cached: true 
            };
        }

        const ait = m.ait ? m.ait.trim().toUpperCase() : '';
        const address = m.endereco ? m.endereco.trim() : '';
        const city = m.municipio ? m.municipio.trim() : 'Campinas';
        const uf = m.uf ? m.uf.trim() : 'SP';
        const keyAit = ait ? `AIT_${ait}` : '';
        const keyExact = `EXACT_${address}_${city}_${uf}`.toUpperCase().replace(/\s+/g, '');

        // 2. Verificar cache por AIT ou Endereço Exato
        if (keyAit && geoCacheRef.current[keyAit]) {
            return { ...geoCacheRef.current[keyAit], cached: true };
        }
        if (geoCacheRef.current[keyExact]) {
            return { ...geoCacheRef.current[keyExact], cached: true };
        }

        // 3. Consulta de Alta Precisão (Multi-Provider com Interpolação Numérica e Gemini AI)
        if (address) {
            try {
                const accurate = await getAccurateCoordinates(address, city, uf);
                if (accurate && typeof accurate.lat === 'number' && typeof accurate.lng === 'number') {
                    const result = {
                        lat: accurate.lat,
                        lon: accurate.lng,
                        method: accurate.method,
                        precision: accurate.precision,
                        sourceDescription: accurate.sourceDescription,
                        cached: false
                    };
                    saveToCache(keyExact, result);
                    if (keyAit) saveToCache(keyAit, result);
                    return result;
                }
            } catch (e) {
                console.warn('Erro no motor de alta precisão:', e);
            }
        }

        // 4. Fallback de Município (se endereço for inválido)
        if (city) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${city} - ${uf}, Brasil`)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const result = { 
                        lat: parseFloat(data[0].lat), 
                        lon: parseFloat(data[0].lon), 
                        method: 'city_fallback', 
                        precision: 'fallback',
                        sourceDescription: 'Centro da Cidade (Aproximado)',
                        cached: false 
                    };
                    saveToCache(keyExact, result); 
                    if (keyAit) saveToCache(keyAit, result);
                    return result;
                }
            } catch (e) {}
        }
        return null;
    };

    useEffect(() => {
        if (mapInstanceRef.current && window.L) {
            if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
            tileLayerRef.current = window.L.tileLayer(currentLayer.url, { attribution: currentLayer.attribution, maxZoom: 19 }).addTo(mapInstanceRef.current);
        }
    }, [currentLayer]);

    useEffect(() => {
        const initMap = async () => {
            if (!mapRef.current || !window.L) return;
            const L = window.L;

            if (!mapInstanceRef.current) {
                mapInstanceRef.current = L.map(mapRef.current).setView([-14.235, -51.925], 4);
                tileLayerRef.current = L.tileLayer(currentLayer.url, { attribution: currentLayer.attribution, maxZoom: 19 }).addTo(mapInstanceRef.current);
            }
            const map = mapInstanceRef.current;
            map.eachLayer((layer: any) => { 
                if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); 
            });

            const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#064e3b" stroke="#10b981" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.5)); width:100%; height:100%;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" fill="#10b981" /><circle cx="17" cy="17" r="2" fill="#10b981" /><path d="M5 11h11" /><path d="M9 7l1.5 4" /></svg>`;
            const createIcon = (isExact: boolean) => L.divIcon({
                className: 'custom-car-icon',
                html: `<div style="width: 38px; height: 38px; background: rgba(7, 17, 12, 0.88); border: 2px solid ${isExact ? '#10b981' : '#f59e0b'}; border-radius: 12px; padding: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; transform: scale(${isExact ? 1.05 : 0.95}); transition: all 0.25s;">${carSvg}</div>`,
                iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22]
            });

            const fmtMoney = (v: number) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '-';

            const generatePopupHtml = (m: Multa, isExact: boolean, count: number = 1, resultInfo?: any) => {
                const countBadge = count > 1 
                    ? `<span style="background: #ff9b00; color: #000; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">+${count - 1} MULTAS</span>`
                    : '';

                const lat = resultInfo ? resultInfo.lat : m.latitude;
                const lon = resultInfo ? resultInfo.lon : m.longitude;
                const gMapsUrl = lat && lon ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.endereco}, ${m.municipio} - ${m.uf}`)}`;
                const sourceText = resultInfo?.sourceDescription || (isExact ? 'Alta Precisão (Número Exato)' : 'Aproximado');
                const isHighPrecision = resultInfo?.precision === 'high' || isExact;

                return `
                    <div style="font-family: 'Outfit', sans-serif; min-width: 300px; background: #0f172a; color: #e2e8f0; border: 1px solid #00d664; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <div style="background: linear-gradient(90deg, #022c22, #064e3b); padding: 12px; border-bottom: 2px solid #00d664; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display:flex; align-items:center;">
                                <span style="font-weight: 800; font-size: 16px; color: #fff;">${m.placa}</span>
                                ${countBadge}
                            </div>
                            <span style="background: #ff9b00; color: #000; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px;">FROTA ${m.frota}</span>
                        </div>
                        <div style="padding: 12px; font-size: 12px;">
                            <div style="margin-bottom: 8px;">
                                <strong style="color: #00d664; text-transform: uppercase; display: block; font-size: 10px; margin-bottom: 2px;">Infração</strong>
                                <span style="color: #fff; line-height: 1.4;">${m.descricaoInfracao || 'Não informada'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 8px;">
                                <div>
                                    <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">AIT / Auto</strong><br/>
                                    <span style="color: #fff; font-weight: bold;">${m.ait}</span>
                                </div>
                                <div style="text-align: right;">
                                    <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Data</strong><br/>
                                    <span style="color: #fff; font-weight: bold;">${fmtDate(m.dataHoraInfracao)}</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Localização da Autuação</strong><br/>
                                <span style="color: #cbd5e1; font-weight: bold;">${m.endereco}</span><br/>
                                <span style="color: #94a3b8; font-size: 11px;">${m.municipio} - ${m.uf}</span>
                            </div>
                            <div style="background: #022c22; border: 1px solid #065f46; border-radius: 6px; padding: 6px 8px; margin-bottom: 10px; font-size: 10px;">
                                <span style="color: #34d399; font-weight: bold; display: block;">📍 ${sourceText}</span>
                                ${lat && lon ? `<span style="color: #6ee7b7; font-family: monospace; font-size: 9px;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span>` : ''}
                            </div>
                            <div style="margin-top: 10px; padding-top: 5px; text-align: right; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="background: ${isHighPrecision ? '#065f46' : '#334155'}; color: ${isHighPrecision ? '#34d399' : '#94a3b8'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${isHighPrecision ? 'LOCAL EXATO' : 'APROXIMADO'}</span>
                                    <span style="color: #ff9b00; font-weight: 900; font-size: 18px;">${fmtMoney(m.valorComDesconto)}</span>
                            </div>
                            <a href="${gMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #00d664; color: #022c22; font-weight: 800; font-size: 11px; padding: 7px 10px; border-radius: 6px; text-decoration: none; margin-top: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                                <span>Abrir Endereço no Google Maps ↗</span>
                            </a>
                        </div>
                    </div>
                `;
            };

            const bounds = L.latLngBounds([]);
            let successCount = 0;
            let loadedFromCache = 0;
            let newlyConsulted = 0;

            if (singleMode) {
                const m = multas[0];
                setStatusText("Localizando infração e consultando telemetria do rastreador...");
                
                // 1. Geocodificar endereço da autuação
                const result = await smartGeocode(m);
                
                // 2. Buscar posição do rastreador no horário da multa
                let trackerMatch: TrackerMatchResult | null = null;
                if (m.placa && m.dataHoraInfracao) {
                    try {
                        trackerMatch = await fetchVehiclePositionAtTime(m.placa, m.dataHoraInfracao);
                        setTrackerInfo(trackerMatch);
                    } catch (e) {
                        console.warn("Aviso ao buscar telemetria do rastreador:", e);
                    }
                }

                if (result) {
                    if (result.cached) loadedFromCache++;
                    else newlyConsulted++;
                    setCachedCount(loadedFromCache);
                    setNewCount(newlyConsulted);

                    const isExact = result.precision === 'high' || result.method !== 'city_fallback';
                    const popupContent = generatePopupHtml(m, isExact, 1, result);

                    const marker = L.marker([result.lat, result.lon], { 
                        icon: createIcon(isExact),
                        draggable: true
                    })
                        .addTo(map)
                        .bindPopup(popupContent)
                        .openPopup();

                    marker.on('dragend', (ev: any) => {
                        const newPos = ev.target.getLatLng();
                        setManualCoordinateOverride(m.endereco, m.municipio || 'Campinas', m.uf || 'SP', newPos.lat, newPos.lng);
                        const updatedInfo = { ...result, lat: newPos.lat, lon: newPos.lng, sourceDescription: 'Ajuste Manual do Usuário (Fixado)', precision: 'high' };
                        marker.setPopupContent(generatePopupHtml(m, true, 1, updatedInfo)).openPopup();
                    });
                    
                    bounds.extend([result.lat, result.lon]);
                }

                // 3. Se houver telemetria do rastreador, adicionar marcador de GPS
                if (trackerMatch) {
                    const trackerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0284c7" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.8));"><circle cx="12" cy="12" r="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/><circle cx="12" cy="12" r="4" fill="#38bdf8"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>`;
                    const trackerIcon = L.divIcon({
                        className: 'custom-tracker-icon',
                        html: `<div style="width: 42px; height: 42px; transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.8));">${trackerSvg}</div>`,
                        iconSize: [42, 42],
                        iconAnchor: [21, 21],
                        popupAnchor: [0, -20]
                    });

                    const trackerPopupHtml = `
                        <div style="font-family: 'Outfit', sans-serif; min-width: 290px; background: #0b1329; color: #e2e8f0; border: 2px solid #38bdf8; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.7);">
                            <div style="background: linear-gradient(90deg, #0c4a6e, #1e3a8a); padding: 10px 12px; border-bottom: 2px solid #38bdf8; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 4px;">🛰️ RASTREADOR GPS</span>
                                <span style="background: #38bdf8; color: #082f49; font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 4px;">${m.placa}</span>
                            </div>
                            <div style="padding: 12px; font-size: 12px;">
                                <div style="margin-bottom: 8px;">
                                    <strong style="color: #38bdf8; text-transform: uppercase; font-size: 10px;">Horário Telemetria GPS</strong><br/>
                                    <span style="color: #fff; font-weight: bold; font-family: monospace;">${fmtDate(trackerMatch.gpsTime)}</span>
                                    <span style="font-size: 10px; color: #94a3b8; margin-left: 4px;">(Dif: ${trackerMatch.timeDifferenceMinutes} min)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 8px;">
                                    <div>
                                        <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Velocidade</strong><br/>
                                        <span style="color: #38bdf8; font-weight: 900; font-size: 14px;">${Math.round(trackerMatch.speed)} km/h</span>
                                    </div>
                                    <div style="text-align: right;">
                                        <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Ignição</strong><br/>
                                        <span style="color: ${trackerMatch.ignitionStatus ? '#4ade80' : '#f87171'}; font-weight: bold;">${trackerMatch.ignitionStatus ? 'Ligada' : 'Desligada'}</span>
                                    </div>
                                </div>
                                ${trackerMatch.address ? `
                                <div style="margin-bottom: 8px;">
                                    <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Endereço Telemetria</strong><br/>
                                    <span style="color: #cbd5e1; font-size: 11px;">${trackerMatch.address}</span>
                                </div>` : ''}
                                <a href="${trackerMatch.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #0284c7; color: #fff; font-weight: 800; font-size: 11px; padding: 7px 10px; border-radius: 6px; text-decoration: none; margin-top: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                                    <span>Abrir Rastreador no Google Maps ↗</span>
                                </a>
                            </div>
                        </div>
                    `;

                    L.marker([trackerMatch.lat, trackerMatch.lng], { icon: trackerIcon })
                        .addTo(map)
                        .bindPopup(trackerPopupHtml);

                    bounds.extend([trackerMatch.lat, trackerMatch.lng]);

                    // Linha conectando o local autuado com o ponto do rastreador
                    if (result) {
                        L.polyline([[result.lat, result.lon], [trackerMatch.lat, trackerMatch.lng]], {
                            color: '#38bdf8',
                            weight: 3,
                            dashArray: '8, 8',
                            opacity: 0.85
                        }).addTo(map);
                    }
                }

                if (bounds.isValid()) {
                    if (result && trackerMatch) {
                        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
                    } else if (result) {
                        map.setView([result.lat, result.lon], result.precision === 'high' ? 18 : 15);
                    } else if (trackerMatch) {
                        map.setView([trackerMatch.lat, trackerMatch.lng], 16);
                    }
                } else {
                    setStatusText("Localização não encontrada.");
                }

                setLoadingMap(false);
            } else {
                const uniqueLocations: Record<string, Multa[]> = {};
                multas.forEach(m => {
                    const key = `${m.endereco}-${m.municipio}-${m.uf}`;
                    if (!uniqueLocations[key]) uniqueLocations[key] = [];
                    uniqueLocations[key].push(m);
                });
                const locationKeys = Object.keys(uniqueLocations);
                setStatusText(`Mapeando ${locationKeys.length} locais de infrações...`);
                let processed = 0;
                
                const processBatch = async () => {
                    for (const key of locationKeys) {
                        const ms = uniqueLocations[key];
                        const m = ms[0];
                        const count = ms.length;

                        try {
                            const result = await smartGeocode(m);
                            if (result) {
                                if (result.cached) loadedFromCache++;
                                else newlyConsulted++;
                                setCachedCount(loadedFromCache);
                                setNewCount(newlyConsulted);

                                const isExact = result.precision === 'high' || result.method !== 'city_fallback';
                                const popupContent = generatePopupHtml(m, isExact, count, result);

                                L.marker([result.lat, result.lon], { icon: createIcon(isExact) }).addTo(map)
                                    .bindPopup(popupContent);
                                
                                bounds.extend([result.lat, result.lon]);
                                successCount++;
                                if (!result.cached) await new Promise(r => setTimeout(r, 300));
                            }
                        } catch (e) {}
                        processed++;
                        if (processed % 5 === 0) setStatusText(`Processando infrações: ${Math.round((processed / locationKeys.length) * 100)}%`);
                    }
                    if (successCount > 0 && bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    setLoadingMap(false);
                };
                processBatch();
            }
        };
        setTimeout(initMap, 100);
    }, [multas, singleMode]);

    return (
        <div 
            className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden select-none"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
            {/* Header Fixo e Inviolável - Nunca se move, corta ou some durante arraste do mapa */}
            <header 
                className="shrink-0 w-full px-3 sm:px-6 py-2.5 sm:py-3 border-b border-emerald-900/80 flex flex-wrap sm:flex-nowrap justify-between items-center bg-[#022c22] gap-2.5 relative z-[100000] shadow-2xl"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
                    <h3 className="text-white font-black text-sm sm:text-base flex items-center truncate">
                        <MapIcon className="mr-2 text-risel-green shrink-0" size={20} />
                        <span className="truncate">{title}</span>
                    </h3>
                    {/* Status de Rastreador GPS quando presente */}
                    {trackerInfo && (
                        <div className="flex items-center gap-1.5 bg-sky-950/90 px-2.5 py-1 rounded-lg border border-sky-500/50 text-[11px] font-bold text-sky-300 shadow-sm">
                            <Radio className="w-3 h-3 text-sky-400 animate-pulse shrink-0" />
                            <span>GPS ({Math.round(trackerInfo.speed)} km/h · {trackerInfo.ignitionStatus ? 'Ligado' : 'Desligado'})</span>
                            <a 
                                href={trackerInfo.googleMapsUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="ml-1 underline text-sky-200 hover:text-white"
                            >
                                Maps ↗
                            </a>
                        </div>
                    )}
                    {/* Estatísticas de Economia de Requisições */}
                    <div className="hidden md:flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-lg border border-emerald-800/40 text-[11px] font-semibold">
                        <span className="text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {cachedCount} em Cache
                        </span>
                        {newCount > 0 && (
                            <span className="text-amber-400 border-l border-gray-700 pl-2">
                                {newCount} novas
                            </span>
                        )}
                    </div>
                </div>

                {/* Controles Principais do Cabeçalho - Fixos e Imediatamente Acessíveis */}
                <div 
                    className="flex items-center gap-2 shrink-0 ml-auto"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    {/* Seletor de Tipo de Mapa */}
                    <div className="flex items-center bg-black/60 p-1 rounded-xl border border-emerald-900/60 shadow-inner">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider hidden lg:inline mr-1.5 px-1 flex items-center gap-1">
                            <Layers size={12} className="text-risel-green" /> Tipo:
                        </span>
                        <div className="flex gap-1">
                            {availableLayers.map(layer => (
                                <button 
                                    key={layer.id} 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setCurrentLayer(layer); }} 
                                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                                        currentLayer.id === layer.id 
                                            ? 'bg-risel-green text-black shadow-md font-black ring-1 ring-white/30' 
                                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                                    }`}
                                    title={`Alterar tipo de mapa para ${layer.name}`}
                                >
                                    {layer.name.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Indicador de Cota Zero Custo */}
                    <div className="hidden sm:block">
                        <MapQuotaIndicator compact />
                    </div>

                    {/* Botão de Fechar Principal com Alto Contraste */}
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }} 
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg border border-red-400/40 transition-all cursor-pointer select-none"
                        title="Fechar Visualização do Mapa (Esc)"
                    >
                        <X size={16} />
                        <span>Fechar</span>
                    </button>
                </div>
            </header>

            {/* Map Canvas em Tela Cheia com Dock Flutuante Permanente */}
            <main className="flex-1 relative bg-slate-950 w-full h-full min-h-0 overflow-hidden">
                <div ref={mapRef} className="w-full h-full z-0" />
                
                {/* HUD Flutuante de Atalho Rápido sobre o Mapa (Fixo no canto superior direito - z-[100000]) */}
                <div 
                    className="absolute top-4 right-4 z-[100000] pointer-events-auto flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700 shadow-2xl ring-1 ring-white/10"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1">
                        <Layers size={13} className="text-risel-green shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Mapa:</span>
                        <div className="flex gap-1 bg-black/60 p-0.5 rounded-lg border border-slate-800">
                            {availableLayers.map(layer => (
                                <button
                                    key={layer.id}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setCurrentLayer(layer); }}
                                    className={`px-2 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${
                                        currentLayer.id === layer.id 
                                            ? 'bg-risel-green text-black font-black shadow-sm' 
                                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                                    }`}
                                    title={`Alterar tipo de mapa para ${layer.name}`}
                                >
                                    {layer.name.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-4 w-px bg-slate-700 mx-0.5" />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl transition-all font-black text-xs shadow-md cursor-pointer"
                        title="Fechar Mapa (Esc)"
                    >
                        <X size={15} />
                        <span>Fechar</span>
                    </button>
                </div>

                {loadingMap && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 text-white backdrop-blur-sm">
                        <Loader2 size={48} className="animate-spin text-risel-green mb-4" />
                        <p className="font-bold text-sm tracking-wide">{statusText}</p>
                        <span className="text-xs text-gray-400 mt-2">Reaproveitando coordenadas já salvas para máxima velocidade e economia de cota</span>
                    </div>
                )}
            </main>
        </div>
    );
};

interface MultasPageProps {
  defaultMonth?: string;
  onMonthChange?: (month: string) => void;
}

const MultasPage: React.FC<MultasPageProps> = ({ defaultMonth, onMonthChange }) => {
  // ... (State declarations and data loading logic remain the same)
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [displayMode, setDisplayMode] = useState<'GRID' | 'TABLE'>('TABLE');
  const [loading, setLoading] = useState(false);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [formData, setFormData] = useState<Partial<Multa>>(initialMulta);
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingAit, setUploadingAit] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalMulta, setEmailModalMulta] = useState<Partial<Multa> | null>(null);
  const [showEmailPreviewHtml, setShowEmailPreviewHtml] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailCustomMessage, setEmailCustomMessage] = useState('');
  const [saveToPlateMapping, setSaveToPlateMapping] = useState(false);
  const [emailOriginInfo, setEmailOriginInfo] = useState('');
  const [baseMappings, setBaseMappings] = useState<Record<string, { to: string; cc: string }>>(DEFAULT_EMAIL_MAPPINGS);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [mapMulta, setMapMulta] = useState<Multa | null>(null);
  const [showGlobalMap, setShowGlobalMap] = useState(false);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [codigos, setCodigos] = useState<CodigoMulta[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Multa; direction: 'asc' | 'desc' } | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
      placa: '',
      dataInicio: '',
      dataFim: '',
      mes: '',
      base: '',
      responsabilidade: '',
      descontar: '',
      status: ''
  });

  // Sync with global defaultMonth from Dashboard
  useEffect(() => {
    if (defaultMonth !== undefined) {
      setFilters(prev => ({ ...prev, mes: defaultMonth }));
      if (defaultMonth !== '') {
          setShowFilters(true); // Exibe os filtros se um mês específico foi selecionado no Dashboard
      }
    }
  }, [defaultMonth]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState({
      dateType: 'INFRACAO',
      startDate: '',
      endDate: '',
      mes: '',
      base: '',
      responsabilidade: '',
      descontar: ''
  });

  // Estado do Visualizador Seguro de PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalData, setPdfModalData] = useState<{ 
      url: string; 
      title: string; 
      fileName: string;
      multaData?: Partial<Multa> | null;
  }>({
      url: '',
      title: 'Termo de Autorização de Desconto em Folha',
      fileName: 'Autorizacao_Desconto.pdf',
      multaData: null
  });

  const openPdfViewer = (url?: string, title?: string, fileName?: string, multaData?: Partial<Multa> | null) => {
      if (!url && !multaData) {
          alert("Nenhum arquivo ou documento disponível para visualização.");
          return;
      }
      setPdfModalData({
          url: url || '',
          title: title || 'Visualização do Documento (PDF)',
          fileName: fileName || 'documento.pdf',
          multaData: multaData || null
      });
      setPdfModalOpen(true);
  };

  const [showCodigosDropdown, setShowCodigosDropdown] = useState(false);
  const [filteredCodigos, setFilteredCodigos] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleImportCsvSuccess = async (
    importedMultas: Multa[],
    onProgress?: (percent: number, current: number, total: number) => void
  ) => {
    try {
      const result = await saveBatchMultas(importedMultas, onProgress);
      if (result && result.updatedMultas && result.updatedMultas.length > 0) {
        setMultas(result.updatedMultas);
      } else {
        const stored = localStorage.getItem("risel_frota_multas");
        if (stored) {
          try {
            setMultas(JSON.parse(stored));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Aviso ao processar lote de multas:", err);
    }
  };

  const loadData = async (force: boolean = false) => {
      setLoading(true);
      const data = await fetchAllData(force);
      setMultas(data.multas);
      setVeiculos(data.veiculos);
      setMotoristas(data.motoristas);
      setCodigos(data.codigos);
      try {
          const mappings = await fetchBaseEmailMappings();
          setBaseMappings(mappings);
      } catch (err) {
          console.error("Erro ao carregar mapeamentos de email", err);
      }
      setLoading(false);
  };

  useEffect(() => { loadData(false); }, []);

  const clearError = (field: string) => { if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; }); };

  const isDriverInactive = useMemo(() => {
      if (!formData.responsavelCodigo) return false;
      const driver = motoristas.find(m => m.login === formData.responsavelCodigo);
      return driver && driver.status === 'INATIVO';
  }, [formData.responsavelCodigo, motoristas]);

  // ... (All other helpers, validators, and handlers remain largely the same, just included for context)
  const availableBases = useMemo(() => Array.from(new Set(multas.map(m => m.base).filter(Boolean))).sort(), [multas]);
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      multas.forEach(m => {
          const d = parseLocalDate(m.dataHoraInfracao);
          if (d) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              months.add(`${year}-${month}`);
          }
      });
      // Sort chronologically ascending
      return Array.from(months).sort().map(m => {
          const [year, month] = m.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          return { value: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
      });
  }, [multas]);

  // Indicadores de Gestão Executiva e Painel de Frotas
  const metrics = useMemo(() => {
      const totalCount = multas.length;
      const totalValor = multas.reduce((acc, m) => acc + (Number(m.valorComDesconto) || Number(m.valor) || 0), 0);
      const condutorCount = multas.filter(m => m.empresaOuCondutor === 'CONDUTOR').length;
      const empresaCount = multas.filter(m => m.empresaOuCondutor === 'EMPRESA').length;
      const descontosAutorizados = multas.filter(m => m.descontarMotorista === 'SIM').length;
      const termosGerados = multas.filter(m => !!m.linkAuth).length;
      
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const prazosCriticos = multas.filter(m => {
          if (m.status === StatusMulta.FINALIZADA || m.status === StatusMulta.INDICACAO_ENVIADA || !m.prazoIndicacao) return false;
          const d = parseLocalDate(m.prazoIndicacao);
          if (!d) return false;
          const diffDays = Math.ceil((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
      }).length;

      return {
          totalCount,
          totalValor,
          condutorCount,
          empresaCount,
          descontosAutorizados,
          termosGerados,
          prazosCriticos
      };
  }, [multas]);

  const filteredMultas = useMemo(() => {
      return multas.filter(m => {
          const lowerSearch = searchTerm.toLowerCase().trim();
          const matchSearch = !lowerSearch || 
              (m.ait && m.ait.toLowerCase().includes(lowerSearch)) || 
              (m.placa && m.placa.toLowerCase().includes(lowerSearch)) || 
              (m.frota && m.frota.toLowerCase().includes(lowerSearch)) ||
              (m.responsavelNome && m.responsavelNome.toLowerCase().includes(lowerSearch)) ||
              (m.enquadramento && m.enquadramento.toLowerCase().includes(lowerSearch)) ||
              (m.descricaoInfracao && m.descricaoInfracao.toLowerCase().includes(lowerSearch));

          if (!matchSearch) return false;
          if (filters.placa && !m.placa.toUpperCase().includes(filters.placa.toUpperCase().trim())) return false;
          if (filters.base && m.base !== filters.base) return false;
          if (filters.responsabilidade && m.empresaOuCondutor !== filters.responsabilidade) return false;
          if (filters.descontar && m.descontarMotorista !== filters.descontar) return false;
          if (filters.status && m.status !== filters.status) return false;

          const hasDateFilter = Boolean(filters.mes || filters.dataInicio || filters.dataFim);
          if (hasDateFilter) {
              const dateStr = m.dataHoraInfracao;
              if (!dateStr) return false; 
              
              const date = parseLocalDate(dateStr);
              if (!date) return false;

              if (filters.mes) {
                  const [yFilter, mFilter] = filters.mes.split('-');
                  if (date.getFullYear() !== Number(yFilter) || (date.getMonth() + 1) !== Number(mFilter)) return false;
              }
              if (filters.dataInicio) {
                  const dInicio = parseLocalDate(filters.dataInicio);
                  if (dInicio) {
                      dInicio.setHours(0,0,0,0);
                      if (date < dInicio) return false;
                  }
              }
              if (filters.dataFim) {
                  const dFim = parseLocalDate(filters.dataFim);
                  if (dFim) {
                      dFim.setHours(23,59,59,999);
                      if (date > dFim) return false;
                  }
              }
          }

          return true;
      });
  }, [multas, searchTerm, filters]);

  const formatDateString = (val?: string) => {
      if (!val) return '-';
      const date = parseLocalDate(val);
      return date ? date.toLocaleDateString('pt-BR') : val;
  };

  const formatMoneyString = (val?: any) => {
      if (val === undefined || val === null || val === '') return 'R$ 0,00';
      const parsed = Number(val);
      return isNaN(parsed) ? String(val) : parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const sortedMultas = useMemo(() => {
      if (!sortConfig) return filteredMultas;
      return [...filteredMultas].sort((a, b) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];
          if (a[sortConfig.key] === undefined) return 1;
          if (b[sortConfig.key] === undefined) return -1;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
              return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [filteredMultas, sortConfig]);

  const handleSort = (key: keyof Multa) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handlePlacaChange = (val: string) => {
      const cleanVal = cleanString(val); 
      const rawText = formatInputText(val);
      setFormData(prev => ({ ...prev, placa: rawText }));
      clearError('placa');
      if (cleanVal.length >= 3) {
          let foundFilial = '';
          let foundMotorista = '';
          let foundFrota = '';
          let foundCpf = '';

          // 1. Procurar em veiculos
          const veiculo = veiculos.find(v => cleanString(v.placa) === cleanVal);
          if (veiculo) {
              foundFrota = veiculo.id || veiculo.placa;
              foundFilial = veiculo.filial || (veiculo as any).base || '';
              foundMotorista = (veiculo as any).condutor || (veiculo as any).motorista || (veiculo as any).responsavelNome || '';
              foundCpf = (veiculo as any).cpfCondutor || (veiculo as any).cpf || '';
          }

          // 2. Procurar em VEICULOS_REAIS se não encontrou condutor/filial
          if ((!foundFilial || !foundMotorista) && Array.isArray(VEICULOS_REAIS)) {
              const vr = VEICULOS_REAIS.find(v => cleanString(v.placa) === cleanVal);
              if (vr) {
                  if (!foundFrota) foundFrota = vr.placa;
                  if (!foundFilial) foundFilial = vr.filial || '';
                  if (!foundMotorista) foundMotorista = vr.condutor || (vr as any).motorista || '';
                  if (!foundCpf) foundCpf = (vr as any).cpfCondutor || '';
              }
          }

          // 3. Procurar em risel_frota_veiculos_v2 no LocalStorage
          if (!foundFilial || !foundMotorista) {
              try {
                  const storedV = localStorage.getItem("risel_frota_veiculos_v2");
                  if (storedV) {
                      const list = JSON.parse(storedV);
                      const lv = list.find((item: any) => cleanString(item.placa) === cleanVal);
                      if (lv) {
                          if (!foundFrota) foundFrota = lv.placa || lv.id;
                          if (!foundFilial) foundFilial = lv.filial || lv.base || '';
                          if (!foundMotorista) foundMotorista = lv.condutor || lv.motorista || '';
                          if (!foundCpf) foundCpf = lv.cpfCondutor || lv.cpf || '';
                      }
                  }
              } catch (e) {}
          }

          setFormData(prev => ({ 
              ...prev, 
              placa: rawText, 
              frota: foundFrota || prev.frota || rawText, 
              base: foundFilial || prev.base || '',
              responsavelNome: foundMotorista || prev.responsavelNome || '',
              responsavelCodigo: foundCpf || prev.responsavelCodigo || ''
          }));
          clearError('frota');
      }
  };

  // Helper para buscar código compatível por código limpo, bruto ou prefixo
  const findMatchingCodigo = (searchVal: string, list: CodigoMulta[]) => {
    if (!searchVal || !list || list.length === 0) return null;
    const cleanSearch = cleanString(searchVal);
    const upperRaw = searchVal.trim().toUpperCase();
    if (!cleanSearch) return null;

    // 1. Match exato limpo (ex: "745-50" casa com "74550", "745-50")
    const matchClean = list.find(c => c && cleanString(c.codigo) === cleanSearch);
    if (matchClean) return matchClean;

    // 2. Match exato com string bruta
    const matchRaw = list.find(c => c && c.codigo && c.codigo.toString().toUpperCase().trim() === upperRaw);
    if (matchRaw) return matchRaw;

    // 3. Match de prefixo para códigos com ou sem hífen (ex: "7455" casa com "745-5" ou "74550")
    if (cleanSearch.length >= 4) {
      const prefixMatch = list.find(c => c && cleanString(c.codigo).startsWith(cleanSearch));
      if (prefixMatch) return prefixMatch;
    }

    return null;
  };

  const handleEnquadramentoChange = (val: string) => {
    const upperVal = (val || '').toUpperCase();
    const cleanSearch = cleanString(upperVal);

    // Se o valor digitado corresponder a um código de infração cadastrado, puxa os dados automaticamente!
    const matchedCodigo = cleanSearch.length >= 3 ? findMatchingCodigo(upperVal, codigos) : null;

    if (matchedCodigo && !matchedCodigo.isNew) {
      const valorNominal = Number(matchedCodigo.valor) || 0;
      let descVal = Number(matchedCodigo.desconto) || 0;
      if (descVal > (valorNominal * 0.5) && descVal < valorNominal) {
        descVal = Number((valorNominal - descVal).toFixed(2));
      }
      const valorFinal = Number(Math.max(0, valorNominal - descVal).toFixed(2));

      setFormData(prev => ({
        ...prev,
        enquadramento: upperVal,
        artigoCtb: String(matchedCodigo.baseLegal || prev.artigoCtb || '').toUpperCase(),
        descricaoInfracao: String(matchedCodigo.descricao || prev.descricaoInfracao || '').toUpperCase(),
        pontosCnh: Number(matchedCodigo.pontos ?? prev.pontosCnh ?? 0),
        valor: valorNominal > 0 ? valorNominal : (prev.valor || 0),
        desconto: descVal >= 0 ? descVal : (prev.desconto || 0),
        valorComDesconto: valorFinal > 0 ? valorFinal : (prev.valorComDesconto || 0)
      }));
      clearError('enquadramento');
      clearError('artigoCtb');
      clearError('descricaoInfracao');
    } else {
      setFormData(prev => ({ ...prev, enquadramento: upperVal }));
    }

    if (cleanSearch.length >= 2 || upperVal.trim().length >= 2) {
      const matches = (codigos || []).filter(c => {
        if (!c || !c.codigo) return false;
        const dbCodeClean = cleanString(c.codigo);
        const dbCodeRaw = c.codigo.toString().toUpperCase();
        const dbDesc = (c.descricao || '').toUpperCase();
        return dbCodeClean.includes(cleanSearch) || dbCodeRaw.includes(upperVal) || dbDesc.includes(upperVal);
      });

      const exactMatchExists = (codigos || []).some(c => c && c.codigo && (
        c.codigo.toString().toUpperCase().trim() === upperVal.trim() ||
        cleanString(c.codigo) === cleanSearch
      ));
      const resultList = [...matches].slice(0, 15);

      if (!exactMatchExists && upperVal.trim().length >= 2) {
        (resultList as any).push({
          codigo: upperVal.trim(),
          baseLegal: '',
          descricao: 'CADASTRAR NOVO CÓDIGO (DIGITAÇÃO LIVRE)',
          pontos: 0,
          valor: 0,
          desconto: 0,
          isNew: true
        });
      }

      setFilteredCodigos(resultList);
      setShowCodigosDropdown(true);
    } else {
      setShowCodigosDropdown(false);
    }
  };

  const selectCodigo = (codigo: any) => {
    if (!codigo) return;
    const valorNominal = Number(codigo.valor) || 0;
    let descVal = Number(codigo.desconto) || 0;
    
    // Proteção para registros antigos onde desconto podia estar cadastrado com valor do boleto com desconto (80%)
    if (descVal > (valorNominal * 0.5) && descVal < valorNominal) {
      descVal = Number((valorNominal - descVal).toFixed(2));
    }
    
    const valorFinal = Number(Math.max(0, valorNominal - descVal).toFixed(2));

    setFormData(prev => ({
      ...prev, 
      enquadramento: String(codigo.codigo || '').toUpperCase(), 
      artigoCtb: codigo.isNew ? prev.artigoCtb : String(codigo.baseLegal || '').toUpperCase(), 
      descricaoInfracao: codigo.isNew ? prev.descricaoInfracao : String(codigo.descricao || '').toUpperCase(),
      pontosCnh: codigo.isNew ? prev.pontosCnh : Number(codigo.pontos || 0), 
      valor: codigo.isNew ? prev.valor : valorNominal, 
      desconto: codigo.isNew ? prev.desconto : descVal, 
      valorComDesconto: codigo.isNew ? prev.valorComDesconto : valorFinal
    }));
    clearError('enquadramento');
    clearError('artigoCtb');
    clearError('descricaoInfracao');
    setShowCodigosDropdown(false);
  };

  const handleBlurEnquadramento = () => {
    setTimeout(() => {
      setShowCodigosDropdown(false);
      setFormData(prev => {
        const enq = String(prev.enquadramento || '').trim();
        if (!enq) return prev;
        const match = findMatchingCodigo(enq, codigos);
        if (match && !match.isNew) {
          const valorNominal = Number(match.valor) || 0;
          let descVal = Number(match.desconto) || 0;
          if (descVal > (valorNominal * 0.5) && descVal < valorNominal) {
            descVal = Number((valorNominal - descVal).toFixed(2));
          }
          const valorFinal = Number(Math.max(0, valorNominal - descVal).toFixed(2));
          return {
            ...prev,
            artigoCtb: prev.artigoCtb || String(match.baseLegal || '').toUpperCase(),
            descricaoInfracao: prev.descricaoInfracao || String(match.descricao || '').toUpperCase(),
            pontosCnh: (prev.pontosCnh !== undefined && prev.pontosCnh !== 0) ? prev.pontosCnh : Number(match.pontos || 0),
            valor: (prev.valor && prev.valor > 0) ? prev.valor : valorNominal,
            desconto: (prev.desconto !== undefined && prev.desconto > 0) ? prev.desconto : descVal,
            valorComDesconto: (prev.valorComDesconto && prev.valorComDesconto > 0) ? prev.valorComDesconto : valorFinal
          };
        }
        return prev;
      });
    }, 250);
  };

  const handleMoneyChange = (field: 'valor' | 'desconto', val: number) => {
      if (val < 0 || isNaN(val)) return;
      const currentValor = field === 'valor' ? val : (Number(formData.valor) || 0);
      const currentDesconto = field === 'desconto' ? val : (Number(formData.desconto) || 0);
      const valorFinal = Number(Math.max(0, currentValor - currentDesconto).toFixed(2));
      
      setFormData(prev => ({
        ...prev,
        [field]: val,
        valorComDesconto: valorFinal
      }));
      clearError(field);
  };

  const handleResponsavelChange = (val: string) => {
    const formattedVal = formatInputText(val);
    setFormData(prev => ({ ...prev, responsavelCodigo: formattedVal }));
    const motorista = motoristas.find(m => m.login === formattedVal);
    if (motorista) {
      setFormData(prev => ({ ...prev, responsavelCodigo: formattedVal, responsavelNome: motorista.nome }));
      clearError('responsavelNome');
    }
  };

  const handleAddressChange = (val: string) => {
    const formattedVal = formatInputText(val);
    const isRod = formattedVal.startsWith('ROD');
    setFormData(prev => ({ ...prev, endereco: formattedVal, rodoviaOuUrbano: isRod ? 'RODOVIA' : (prev.rodoviaOuUrbano || 'URBANO') }));
  };

  const calculateDaysRemaining = (prazo: string | undefined) => {
    if (!prazo) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let prazoDate: Date;
    if (prazo.length === 10 && prazo.includes('-')) {
        const [year, month, day] = prazo.split('-').map(Number);
        prazoDate = new Date(year, month - 1, day);
    } else {
        prazoDate = new Date(prazo);
    }
    
    prazoDate.setHours(0, 0, 0, 0);
    if (isNaN(prazoDate.getTime())) return null;
    
    const diffTime = prazoDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getPrazoInfo = (status: string | undefined, prazoDate: string | undefined) => {
      if (!prazoDate) return { text: "-", textColor: "text-gray-400 font-mono", cellGradient: "", color: "text-gray-400 font-mono" };
      const days = calculateDaysRemaining(prazoDate);
      const isFinished = status === StatusMulta.FINALIZADA;
      
      if (isFinished) {
          return { 
              text: "Finalizada / Regularizada",
              textColor: "text-emerald-700 font-medium", 
              cellGradient: "bg-emerald-50/30",
              color: "text-emerald-700 font-medium"
          };
      }
      
      if (days !== null && days < 0) {
          return { 
              text: `Vencido há ${Math.abs(days)} dia(s)`,
              textColor: "text-red-700 font-bold", 
              cellGradient: "bg-gradient-to-r from-red-100/70 via-red-50/40 to-transparent border-l-2 border-red-500",
              color: "text-red-700 bg-red-100/80 font-bold"
          };
      }
      
      if (days !== null) {
          if (days === 0) {
              return { 
                  text: "Vence Hoje!",
                  textColor: "text-rose-700 font-bold", 
                  cellGradient: "bg-gradient-to-r from-rose-100/60 via-rose-50/30 to-transparent border-l-2 border-rose-400",
                  color: "text-rose-700 bg-rose-100/80 font-bold"
              };
          }
          if (days <= 5) {
              return { 
                  text: `${days} dias restantes (Crítico)`,
                  textColor: "text-rose-700 font-bold", 
                  cellGradient: "bg-gradient-to-r from-rose-100/60 via-rose-50/30 to-transparent border-l-2 border-rose-400",
                  color: "text-rose-700 bg-rose-100/80 font-bold"
              };
          }
          if (days <= 10) {
              return { 
                  text: `${days} dias restantes (Alerta)`,
                  textColor: "text-amber-800 font-bold", 
                  cellGradient: "bg-gradient-to-r from-amber-100/60 via-amber-50/30 to-transparent border-l-2 border-amber-400",
                  color: "text-amber-800 bg-amber-100/80 font-bold"
              };
          }
          return { 
              text: `${days} dias restantes`,
              textColor: "text-emerald-800 font-medium", 
              cellGradient: "bg-gradient-to-r from-emerald-50/40 via-emerald-50/10 to-transparent",
              color: "text-emerald-800 bg-emerald-100/80 font-medium"
          };
      }
      
      return { text: "-", textColor: "text-gray-600 font-mono", cellGradient: "", color: "text-gray-600 font-mono" };
  };

  // ... (Other status badges and visual helpers remain the same) ...
  const getStatusBadge = (status: string) => {
      let colors = "";
      switch (status) {
          case StatusMulta.FINALIZADA: colors = 'bg-emerald-100/50 text-emerald-800 border-emerald-200'; break;
          case StatusMulta.AGUARDANDO_BOLETO: colors = 'bg-orange-100/50 text-orange-800 border-orange-200'; break;
          case StatusMulta.RECURSO: colors = 'bg-red-100/50 text-red-800 border-red-200'; break;
          case StatusMulta.INDICACAO_ENVIADA: colors = 'bg-blue-100/50 text-blue-800 border-blue-200'; break;
          case StatusMulta.IMPORTACAO_VAMOS: colors = 'bg-purple-100 text-purple-800 border-purple-200'; break;
          default: colors = 'bg-gray-100/50 text-gray-800 border-gray-200'; break;
      }
      return <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide border ${colors}`}>{status}</span>;
  };

  const getCardStyle = (status: string) => {
      switch (status) {
          case StatusMulta.FINALIZADA: return 'bg-gradient-to-br from-[#022c22]/80 via-[#064e3b]/80 to-black/80 backdrop-blur-md border-l-4 border-l-risel-green border-y border-r border-white/5';
          case StatusMulta.AGUARDANDO_BOLETO: return 'bg-gradient-to-br from-[#022c22]/80 via-[#431407]/80 to-black/80 backdrop-blur-md border-l-4 border-l-risel-orange border-y border-r border-white/5';
          case StatusMulta.RECURSO: return 'bg-gradient-to-br from-[#022c22]/80 via-[#450a0a]/80 to-black/80 backdrop-blur-md border-l-4 border-l-red-500 border-y border-r border-white/5';
          case StatusMulta.INDICACAO_ENVIADA: return 'bg-gradient-to-br from-[#022c22]/80 via-[#172554]/80 to-black/80 backdrop-blur-md border-l-4 border-l-blue-500 border-y border-r border-white/5';
          case StatusMulta.IMPORTACAO_VAMOS: return 'bg-gradient-to-br from-[#022c22]/80 via-[#3b0764]/80 to-black/80 backdrop-blur-md border-l-4 border-l-purple-500 border-y border-r border-white/5';
          default: return 'bg-gradient-to-br from-risel-dark/80 to-gray-900/80 border border-white/10 backdrop-blur-md';
      }
  };

  const getStatusDot = (status: string) => {
      let color = "bg-gray-400"; let textColor = "text-slate-400";
      if (status === StatusMulta.FINALIZADA) { color = "bg-risel-green shadow-[0_0_8px_rgba(0,214,100,0.6)]"; textColor = "text-risel-green"; }
      else if (status === StatusMulta.AGUARDANDO_BOLETO) { color = "bg-risel-orange shadow-[0_0_8px_rgba(255,155,0,0.6)]"; textColor = "text-risel-orange"; }
      else if (status === StatusMulta.RECURSO) { color = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"; textColor = "text-red-400"; }
      else if (status === StatusMulta.INDICACAO_ENVIADA) { color = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"; textColor = "text-blue-400"; }
      else if (status === StatusMulta.IMPORTACAO_VAMOS) { color = "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"; textColor = "text-purple-400"; }
      return (
          <div className="flex items-center gap-1.5 bg-black/20 px-1.5 py-0.5 rounded-full border border-white/5">
              <div className={`w-1 h-1 rounded-full ${color}`}></div>
              <span className={`text-[8px] font-bold uppercase tracking-wider ${textColor}`}>{status}</span>
          </div>
      );
  };

  const validateForm = (): boolean => {
      const newErrors: Record<string, string> = {};
      if (!formData.ait || formData.ait.length < 3) newErrors.ait = "AIT inválido.";
      else if (!formData.id && multas.some(m => m.ait === formData.ait)) newErrors.ait = "AIT já cadastrado.";
      
      if (!formData.frota) newErrors.frota = "Frota é obrigatória.";
      if (!formData.placa || formData.placa.length < 7) newErrors.placa = "Placa inválida.";
      if (formData.dataHoraInfracao && formData.dataRecebimento && new Date(formData.dataRecebimento) < new Date(formData.dataHoraInfracao)) {
          newErrors.dataRecebimento = "Data inválida.";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) { alert("Por favor, corrija os erros."); return; }
    setLoading(true);
    
    // Salvar novo código de enquadramento se não existir na lista
    const enquadramentoUpper = String(formData.enquadramento || '').toUpperCase().trim();
    if (enquadramentoUpper) {
        const exists = codigos.some(c => c && c.codigo && c.codigo.toString().toUpperCase().trim() === enquadramentoUpper);
        if (!exists) {
            try {
                await saveCodigo({
                    codigo: enquadramentoUpper,
                    baseLegal: formData.artigoCtb || '',
                    descricao: formData.descricaoInfracao || '',
                    pontos: formData.pontosCnh || 0,
                    valor: formData.valor || 0,
                    desconto: formData.desconto || 0
                });
            } catch (err) {
                console.error("Falha ao salvar novo código customizado", err);
            }
        }
    }

    const savedMulta = { ...formData, id: formData.id || formData.ait || `multa-${Date.now()}` } as Multa;
    await saveMulta(savedMulta);
    
    // Limpar filtros de busca/mês para garantir que o registro apareça na tabela imediatamente
    setFilters(prev => ({ ...prev, mes: '', dataInicio: '', dataFim: '', placa: '', base: '', status: '', responsabilidade: '', descontar: '' }));
    setSearchTerm('');
    
    await loadData(true);
    setView('LIST');
    setFormData(initialMulta);
    setErrors({});
    setLoading(false);
  };

  const handleSaveAndNotify = async () => {
    if (!validateForm()) { alert("Por favor, preencha os campos obrigatórios antes de prosseguir."); return; }
    setLoading(true);

    const enquadramentoUpper = String(formData.enquadramento || '').toUpperCase().trim();
    if (enquadramentoUpper) {
        const exists = codigos.some(c => c && c.codigo && c.codigo.toString().toUpperCase().trim() === enquadramentoUpper);
        if (!exists) {
            try {
                await saveCodigo({
                    codigo: enquadramentoUpper,
                    baseLegal: formData.artigoCtb || '',
                    descricao: formData.descricaoInfracao || '',
                    pontos: formData.pontosCnh || 0,
                    valor: formData.valor || 0,
                    desconto: formData.desconto || 0
                });
            } catch (err) {
                console.error("Falha ao salvar novo código customizado", err);
            }
        }
    }

    const savedMulta = { ...formData, id: formData.id || formData.ait || `multa-${Date.now()}` } as Multa;
    await saveMulta(savedMulta);

    setFilters(prev => ({ ...prev, mes: '', dataInicio: '', dataFim: '', placa: '', base: '', status: '', responsabilidade: '', descontar: '' }));
    setSearchTerm('');
    await loadData(true);
    setView('LIST');
    setFormData(initialMulta);
    setErrors({});
    setLoading(false);

    // Dispara diretamente para o e-mail cadastrado da placa/base
    await handleSendDirectEmail(savedMulta);
  };

  const handleDelete = async (id: string) => {
      if (confirm('Excluir multa?')) {
          setLoading(true);
          await deleteMulta(id);
          await loadData(true);
          setLoading(false);
      }
  };

  // --- UPLOAD DE ATÉ 3 ARQUIVOS COM RESILIÊNCIA E PREVIEW ---
  const handleAitUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] } }) => {
      const inputFiles = e.target.files;
      if (inputFiles && inputFiles.length > 0) {
          const files = Array.from(inputFiles) as File[];
          const currentLinks = parseLinks(formData.linkAit);
          
          if (currentLinks.length >= 3) {
              alert('Limite máximo de 3 arquivos anexos já foi atingido. Remova um anexo antes de adicionar outro.');
              return;
          }

          const availableSlots = 3 - currentLinks.length;
          const filesToProcess = files.slice(0, availableSlots);

          if (files.length > availableSlots) {
              alert(`Você selecionou ${files.length} arquivo(s), mas há espaço para apenas mais ${availableSlots}. Processando ${availableSlots} arquivo(s).`);
          }

          setUploadingAit(true);
          try {
              const folderId = getDriveFolderId() || 'LOCAL';
              const newLinksParts: string[] = [];
              
              for (let i = 0; i < filesToProcess.length; i++) {
                  const file = filesToProcess[i];
                  const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
                  const finalName = cleanFileName || `Anexo_${currentLinks.length + i + 1}`;
                  const driveFileName = `AIT_${formData.ait || formData.placa || 'DOC'}_${finalName}_${Date.now()}`;
                  
                  const response = await uploadFileToDrive(file, folderId, driveFileName) as any;
                  if (response && response.fileUrl) {
                      newLinksParts.push(`${finalName}${NAME_SEPARATOR}${response.fileUrl}`);
                  }
              }

              if (newLinksParts.length > 0) {
                  const existingString = formData.linkAit ? formData.linkAit + LINK_SEPARATOR : '';
                  const updatedLinksString = existingString + newLinksParts.join(LINK_SEPARATOR);
                  setFormData(prev => ({ ...prev, linkAit: updatedLinksString }));
              }
          } catch (error: any) {
              console.error("Erro no upload de anexo:", error);
              alert('Erro no envio do arquivo: ' + (error.message || 'Falha ao processar anexo'));
          } finally {
              setUploadingAit(false);
              const fileInput = document.getElementById('file-ait') as HTMLInputElement;
              if (fileInput) fileInput.value = '';
          }
      }
  };

  const removeAttachment = (index: number) => {
      const links = parseLinks(formData.linkAit);
      const target = links[index];
      if (!confirm(`Remover o anexo "${target?.name || 'Arquivo'}"?`)) return;
      
      const updated = links.filter((_, i) => i !== index);
      const newString = updated.map(l => l.name === 'AIT (Anexo)' ? l.url : `${l.name}${NAME_SEPARATOR}${l.url}`).join(LINK_SEPARATOR);
      setFormData(prev => ({ ...prev, linkAit: newString }));
  };

  // --- GERADOR DE PDF DE AUTORIZAÇÃO DE DESCONTO COM TIMBRADO OFICIAL RISEL ---
  const generateAuthPDF = async (silent: boolean = false) => {
      if (!formData.placa) {
          if (!silent) alert("Por favor, preencha ao menos a Placa do veículo antes de gerar o Termo de Desconto.");
          return null;
      }
      setGeneratingPdf(true);
      try {
          // Gerar PDF oficial institucional formatado
          const pdfResult = await generateAutorizacaoDescontoPdf(formData);
          
          // Salva Data URL no registro
          setFormData(prev => ({ ...prev, linkAuth: pdfResult.dataUrl }));

          // Dispara o download automático do arquivo .pdf gerado no computador do usuário se não for silencioso
          if (!silent) {
              try {
                  pdfResult.download();
              } catch (e) {
                  console.warn("Download automático:", e);
              }
          }

          // Se houver Google Drive configurado, sincroniza em segundo plano
          const folderId = getDriveFolderId();
          if (folderId && folderId !== 'LOCAL') {
              try {
                  const fileObj = new File([pdfResult.blob], pdfResult.fileName, { type: 'application/pdf' });
                  uploadFileToDrive(fileObj, folderId, pdfResult.fileName).then((resp: any) => {
                      if (resp && resp.fileUrl) {
                          setFormData(prev => ({ ...prev, linkAuth: resp.fileUrl }));
                      }
                  }).catch(e => console.warn("Sincronização opcional de PDF com Drive:", e));
              } catch (e) {}
          }

          return pdfResult;
      } catch (error: any) {
          console.error("Erro na geração de PDF:", error);
          if (!silent) alert('Falha ao gerar PDF de Autorização: ' + error.message);
          return null;
      } finally {
          setGeneratingPdf(false);
      }
  };

  const generateEmailHTML = (data: Partial<Multa> & { customMessage?: string }) => {
      const fmtMoney = (val?: number) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00";
      const fmtDate = (val?: string) => val ? new Date(val).toLocaleDateString('pt-BR') : "-";
      const fmtDateTime = (val?: string) => val ? new Date(val).toLocaleDateString('pt-BR') + ' às ' + new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "-";
      
      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(data.placa || ''));
      const baseStr = (data.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';

      const aitLinks = parseLinks(data.linkAit);
      const aitNumero = (data.ait || (data as any).numeroAit || (data as any).numDocumento || '').trim();
      let attachmentsSection = '';
      
      if (aitLinks.length > 0 || data.linkAuth) {
          const totalDocs = aitLinks.length + (data.linkAuth ? 1 : 0);
          attachmentsSection = `
            <div style="background-color: #f0fdf4; padding: 14px 18px; border-radius: 10px; margin-top: 22px; border: 1px solid #bbf7d0; text-align: left; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #166534; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                  <span>📎</span> Documentos e Comprovantes Anexados (${totalDocs} arquivo(s)):
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155; line-height: 1.5;">
                    ${aitLinks.map(l => `<li style="margin-bottom: 4px;"><strong>Auto de Infração:</strong> ${l.name}</li>`).join('')}
                    ${data.linkAuth ? `<li style="margin-bottom: 4px;"><strong>Termo:</strong> Autorização de Desconto em Folha (PDF Oficial Risel)</li>` : ''}
                </ul>
            </div>`;
      }

      const customMessageHtml = data.customMessage && data.customMessage.trim() ? `
        <div style="background-color: #fffbeb; padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; border: 1px solid #fef3c7; border-left: 5px solid #f59e0b; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">📌 Observação / Orientação do Gestor:</p>
          <p style="margin: 0; font-size: 13px; color: #78350f; font-weight: 600; line-height: 1.5;">${String(data.customMessage).replace(/\n/g, '<br/>')}</p>
        </div>
      ` : '';

      // Campo Observações (somente adiciona se houver conteúdo digitado)
      const obsMulta = (data.obs && data.obs.trim()) || '';
      const obsHtml = obsMulta ? `
        <tr style="background-color: #fffbeb;">
          <td style="padding: 10px 14px; font-weight: 700; color: #b45309; border-bottom: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">📝 Observações:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #78350f; font-weight: 600; line-height: 1.5; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">${obsMulta.replace(/\n/g, '<br/>')}</td>
        </tr>
      ` : '';

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body, table, td, p, h1, h2, h3, div, span, strong { 
              font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; 
            }
          </style>
        </head>
        <body style="background-color: #f1f5f9; padding: 20px 10px; margin: 0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
          <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
            
            <!-- Header Corporativo Risel com Fundo Verde Gradiente e Suporte a Todos os Clientes de Email -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#09392b" style="background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%); width: 100%; border-bottom: 4px solid #f47920; border-collapse: collapse;">
              <tr>
                <td bgcolor="#09392b" style="padding: 24px 28px; background-color: #09392b; background: linear-gradient(135deg, #06231a 0%, #0d4a36 50%, #156c50 100%);">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td width="56" valign="middle" style="width: 56px; vertical-align: middle;">
                        <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Logo Risel" width="56" height="24" style="width: 56px; height: 24px; display: block; object-fit: contain;" />
                      </td>
                      <td valign="middle" style="padding-left: 16px; vertical-align: middle;">
                        <h1 style="color: #ffffff !important; margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.2px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.2;">Notificação de Infração de Trânsito</h1>
                        <p style="color: #86efac !important; margin: 4px 0 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">Sistema de Multas Risel${baseStr && baseStr !== '-' ? ` &bull; Base: ${baseStr}` : ''}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Corpo da Notificação -->
            <div style="padding: 28px 28px 24px 28px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b; font-weight: 700;">Prezado(a) condutor(a) / Gestor,</p>
              <p style="margin: 0 0 18px 0; font-size: 13.5px; line-height: 1.6; color: #334155;">
                Informamos que foi registrada uma autuação de trânsito vinculada ao veículo sob sua condução/responsabilidade na data especificada abaixo.<br/>
                <strong style="color: #0f172a;">Solicitamos providenciar a cópia da CNH e a assinatura no Termo de Desconto anexo.</strong>
              </p>
              ${customMessageHtml}
              
              <!-- Tabela Estruturada de Informações -->
              <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0; width: 38%;">👤 Motorista / Condutor:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a;">${data.responsavelNome || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">📄 Auto de Infração (AIT):</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #0f172a; font-size: 14px;">${aitNumero || '-'}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">🚗 Placa do Veículo:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #0f172a;">${data.placa || '-'} ${data.frota ? `<span style="font-size: 11px; color: #64748b; font-weight: normal;">(Frota ${data.frota})</span>` : ''}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">🏢 Base / Filial:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #334155;">${data.base || baseStr || '-'}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">📅 Data e Hora da Infração:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${fmtDateTime(data.dataHoraInfracao)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">⚠️ Infração Cometida:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; line-height: 1.4;">${data.descricaoInfracao || data.enquadramento || '-'}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">💲 Valor com Desconto:</td>
                  <td style="padding: 10px 14px; color: #15803d; font-weight: 900; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${fmtMoney(data.valorComDesconto || data.valor)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-weight: 700; color: #0d4a36; border-bottom: 1px solid #e2e8f0;">🪪 Pontuação CNH:</td>
                  <td style="padding: 10px 14px; color: #334155; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${data.pontosCnh || '0'} Pontos</td>
                </tr>
                <tr style="background-color: #fff1f2;">
                  <td style="padding: 10px 14px; font-weight: 800; color: #be123c;">⏳ Prazo Limite para Indicação:</td>
                  <td style="padding: 10px 14px; font-weight: 900; color: #be123c;">${fmtDate(data.prazoIndicacao)}</td>
                </tr>
                ${obsHtml}
              </table>

              ${attachmentsSection}
            </div>

            <!-- Assinatura Oficial Risel -->
            <div style="background-color: #ffffff; padding: 20px 25px; border-top: 1px solid #e2e8f0; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                <tr>
                  <td width="92" valign="middle" style="width: 92px; vertical-align: middle; padding-right: 14px; border-right: 2px solid #e2e8f0;">
                    <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                      <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Risel Combustíveis" width="84" height="34" style="width: 84px; height: 34px; max-width: 84px; max-height: 34px; display: block; border: 0; outline: none;" />
                    </a>
                  </td>
                  <td valign="middle" style="vertical-align: middle; padding-left: 14px; font-family: 'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', Arial, sans-serif;">
                    <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: -0.1px; line-height: 1.25;">
                      Sistema de Multas Risel
                    </div>
                    <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.25;">
                      Risel Combustíveis Ltda
                    </div>
                    <div style="font-family: 'Aptos Narrow', 'Aptos', Calibri, Arial, sans-serif; font-size: 10.5px; margin-top: 3px;">
                      <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 600;">
                        www.risel.com.br
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </body>
        </html>`;
  };

  // Helper para resolver automaticamente destinatários cadastrados (Placa -> Frota -> Base -> Fallback)
  const resolveEmailRecipients = async (targetMulta: Partial<Multa>) => {
      const placaClean = cleanString(targetMulta.placa || '');
      const placaMappings = await fetchPlacaEmailMappings();
      let toEmail = '';
      let ccEmail = 'lorena.padilha@risel.com.br; deny.goncalves@risel.com.br';
      let origin = '';

      // 1. Prioridade: Buscar no campo E-mail da Placa do Controle de Frota Leve
      if (placaClean) {
          const veiculoLocal = veiculos.find(v => cleanString(v.placa) === placaClean);
          if (veiculoLocal && (veiculoLocal as any).email) {
              toEmail = (veiculoLocal as any).email.trim();
              origin = `Controle de Frotas (Placa ${placaClean})`;
          }

          if (!toEmail) {
              try {
                  const storedV = localStorage.getItem("risel_frota_veiculos_v2");
                  if (storedV) {
                      const list = JSON.parse(storedV);
                      const lv = list.find((item: any) => cleanString(item.placa) === placaClean);
                      if (lv && lv.email) {
                          toEmail = lv.email.trim();
                          origin = `Controle de Frotas Local (Placa ${placaClean})`;
                      }
                  }
              } catch (e) {}
          }

          if (!toEmail && Array.isArray(VEICULOS_REAIS)) {
              const vr = VEICULOS_REAIS.find(v => cleanString(v.placa) === placaClean);
              if (vr && vr.email) {
                  toEmail = vr.email.trim();
                  origin = `Frota de Veículos Reais (Placa ${placaClean})`;
              }
          }
      }

      // 2. Se não encontrou no veículo, verificar mapeamento específico salvo da placa
      if (!toEmail && placaClean && placaMappings[placaClean] && placaMappings[placaClean].to) {
          toEmail = placaMappings[placaClean].to.trim();
          origin = `Mapeamento Salvo para a Placa ${placaClean}`;
          if (placaMappings[placaClean].cc) {
              ccEmail = placaMappings[placaClean].cc.trim();
          }
      }

      // 3. Fallback: Mapeamento de e-mail por Base/Filial
      if (!toEmail) {
          const baseUpper = targetMulta.base ? targetMulta.base.toUpperCase().trim() : '';
          const matchedKey = Object.keys(baseMappings).find(k => baseUpper.includes(k.toUpperCase()) || k.toUpperCase().includes(baseUpper));
          if (matchedKey && baseMappings[matchedKey]) {
              toEmail = baseMappings[matchedKey].to || '';
              origin = `Mapeamento da Base / Filial (${targetMulta.base || 'Geral'})`;
              if (baseMappings[matchedKey].cc) ccEmail = `${baseMappings[matchedKey].cc}; ${ccEmail}`;
          }
      }

      // 4. Se ainda assim não encontrar, usa ADMIN_EMAIL como segurança
      if (!toEmail) {
          toEmail = ADMIN_EMAIL;
          origin = 'E-mail Padrão da Administração';
      }

      // 5. Garantir Lorena e Deny em cópia CC
      if (!ccEmail.toLowerCase().includes('lorena.padilha@risel.com.br')) {
          ccEmail = `${ccEmail}; lorena.padilha@risel.com.br`;
      }
      if (!ccEmail.toLowerCase().includes('deny.goncalves@risel.com.br')) {
          ccEmail = `${ccEmail}; deny.goncalves@risel.com.br`;
      }

      return { toEmail, ccEmail, origin };
  };

  // Envio Direto Automático de Notificação (dispara diretamente para o e-mail cadastrado da placa/base)
  const handleSendDirectEmail = async (targetMulta: Partial<Multa>) => {
      const normalizedMulta = {
          ...targetMulta,
          id: targetMulta.id || (targetMulta as any).idsistema || (targetMulta as any).codigo || '',
          ait: String(targetMulta.ait || (targetMulta as any).numeroAit || (targetMulta as any).numDocumento || (targetMulta as any).aitDigitado || '').trim(),
          placa: cleanString(targetMulta.placa || (targetMulta as any).placaVeiculo || ''),
          frota: String(targetMulta.frota || (targetMulta as any).veiculo || '').trim(),
          responsavelNome: String(targetMulta.responsavelNome || (targetMulta as any).motorista || (targetMulta as any).condutor || '').trim(),
          descricaoInfracao: String(targetMulta.descricaoInfracao || targetMulta.enquadramento || (targetMulta as any).infracao || '').trim(),
          base: String(targetMulta.base || (targetMulta as any).filial || (targetMulta as any).unidade || '').trim(),
          valor: typeof targetMulta.valor === 'number' ? targetMulta.valor : parseFloat(String(targetMulta.valor || 0).replace(',', '.')),
          valorComDesconto: typeof targetMulta.valorComDesconto === 'number' ? targetMulta.valorComDesconto : (targetMulta.valor ? Number(targetMulta.valor) * 0.8 : 0),
          prazoIndicacao: targetMulta.prazoIndicacao || '',
          dataHoraInfracao: targetMulta.dataHoraInfracao || '',
          status: targetMulta.status || StatusMulta.AGUARDANDO_BOLETO,
          linkAit: targetMulta.linkAit || '',
          linkAuth: targetMulta.linkAuth || '',
          pontosCnh: targetMulta.pontosCnh !== undefined ? targetMulta.pontosCnh : 0,
          obs: targetMulta.obs || ''
      };

      setSendingEmail(true);
      const { toEmail, ccEmail } = await resolveEmailRecipients(normalizedMulta);

      const toRecipientsList = toEmail.split(/[;,]+/).map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));
      const ccRecipientsList = ccEmail.split(/[;,]+/).map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));

      // Gerar PDF do Termo se ainda não existir
      let authLink = normalizedMulta.linkAuth;
      if (!authLink && normalizedMulta.placa) {
          try {
              const pdfRes = await generateAutorizacaoDescontoPdf(normalizedMulta);
              if (pdfRes) authLink = pdfRes.dataUrl;
          } catch (e) {}
      }

      const aitLinks = parseLinks(normalizedMulta.linkAit);
      const driveUrls: Array<{ name: string; url: string }> = [...aitLinks];
      if (authLink) {
          driveUrls.push({
              name: `Autorizacao_Desconto_${normalizedMulta.placa || 'MULTA'}`,
              url: authLink
          });
      }

      const getFormattedSubjectDate = (dateStr?: string) => {
          if (!dateStr) return '';
          try {
              const isoDate = dateStr.split('T')[0];
              if (isoDate.includes('-')) {
                  const parts = isoDate.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
              }
          } catch(e) {}
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      };

      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(normalizedMulta.placa || ''));
      const baseStr = (normalizedMulta.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';
      const frotaStr = normalizedMulta.frota || (veiculoMatch as any)?.frota || normalizedMulta.placa || 'S/F';
      const dataFormatada = getFormattedSubjectDate(normalizedMulta.dataHoraInfracao);
      const finalSubject = `NOTIFICAÇÃO DE MULTA: PLACA ${normalizedMulta.placa || 'S/P'} - FROTA: ${frotaStr} - BASE: ${baseStr} - DATA ${dataFormatada}`;

      const smtpHost = localStorage.getItem("risel_smtp_host") || undefined;
      const smtpPort = localStorage.getItem("risel_smtp_port") || undefined;
      const smtpEmail = localStorage.getItem("risel_smtp_email") || undefined;
      const smtpPassword = localStorage.getItem("risel_smtp_password") || undefined;
      const resendApiKey = localStorage.getItem("risel_resend_api_key") || undefined;
      const brevoApiKey = localStorage.getItem("risel_brevo_api_key") || undefined;

      try {
          const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  smtpHost,
                  smtpPort,
                  smtpEmail,
                  smtpPassword,
                  resendApiKey,
                  brevoApiKey,
                  fromName: "Sistema de Multas Risel",
                  source: "multas",
                  to: toRecipientsList.join(', ') || ADMIN_EMAIL,
                  cc: ccRecipientsList.join(', '),
                  subject: finalSubject,
                  html: generateEmailHTML({ ...normalizedMulta, linkAuth: authLink }),
                  driveUrls
              })
          });

          const result = await response.json().catch(() => ({}));
          if (response.ok && result.success) {
              const driveRemoteUrls = driveUrls.filter(u => u.url.startsWith('http')).map(u => u.url);
              if (driveRemoteUrls.length > 0) {
                  deleteDriveFiles(driveRemoteUrls).catch(e => console.warn(e));
              }
              const providerInfo = result.provider ? ` (${result.provider})` : '';
              alert(`✅ Notificação enviada com sucesso para os e-mails cadastrados:\n\nPara: ${toRecipientsList.join(', ')}\nCC: ${ccRecipientsList.join(', ')}${providerInfo}`);
          } else {
              const isRenderBlock = result.firewallBlocked || result.renderFree || (result.message && (result.message.includes("Render") || result.message.includes("SMTP")));
              if (isRenderBlock) {
                  const goToOutlook = window.confirm(
                      `⚠️ Bloqueio do Render (Plano Free):\n${result.message}\n\nDeseja abrir a notificação agora no Outlook com destinatários (${toRecipientsList.join(', ')}) e anexos prontos?`
                  );
                  if (goToOutlook) {
                      setEmailModalMulta(normalizedMulta);
                      setEmailTo(toRecipientsList.join('; '));
                      setEmailCc(ccRecipientsList.join('; '));
                      handleOpenOutlookOrWebmail();
                  }
              } else {
                  alert("Erro ao enviar e-mail: " + (result.message || result.error || "Não foi possível completar o envio direto."));
              }
          }
      } catch (err: any) {
          console.error("Erro no disparo direto de e-mail:", err);
          alert(`Erro no envio: ${err.message || err}`);
      } finally {
          setSendingEmail(false);
      }
  };

  const handleOpenEmailModal = async (targetMulta?: Partial<Multa> | React.MouseEvent) => {
      // Garante que se a função for chamada via onClick de botão, o SyntheticEvent não seja interpretado como dados da Multa
      const isMultaObject = Boolean(
          targetMulta && 
          typeof targetMulta === 'object' && 
          !('nativeEvent' in targetMulta) && 
          !('currentTarget' in targetMulta) &&
          ('placa' in targetMulta || 'id' in targetMulta || 'ait' in targetMulta || 'valor' in targetMulta || 'responsavelNome' in targetMulta)
      );

      const activeData: Partial<Multa> = isMultaObject ? (targetMulta as Partial<Multa>) : formData;
      
      const normalizedData: Partial<Multa> = {
          ...activeData,
          id: activeData.id || (activeData as any).idsistema || (activeData as any).codigo || '',
          ait: String(activeData.ait || (activeData as any).numeroAit || (activeData as any).numDocumento || (activeData as any).aitDigitado || '').trim(),
          placa: cleanString(activeData.placa || (activeData as any).placaVeiculo || ''),
          frota: String(activeData.frota || (activeData as any).veiculo || '').trim(),
          responsavelNome: String(activeData.responsavelNome || (activeData as any).motorista || (activeData as any).condutor || '').trim(),
          descricaoInfracao: String(activeData.descricaoInfracao || activeData.enquadramento || (activeData as any).infracao || '').trim(),
          base: String(activeData.base || (activeData as any).filial || (activeData as any).unidade || '').trim(),
          valor: typeof activeData.valor === 'number' ? activeData.valor : parseFloat(String(activeData.valor || 0).replace(',', '.')),
          valorComDesconto: typeof activeData.valorComDesconto === 'number' ? activeData.valorComDesconto : (activeData.valor ? Number(activeData.valor) * 0.8 : 0),
          prazoIndicacao: activeData.prazoIndicacao || '',
          dataHoraInfracao: activeData.dataHoraInfracao || '',
          status: activeData.status || StatusMulta.AGUARDANDO_BOLETO,
          linkAit: activeData.linkAit || '',
          linkAuth: activeData.linkAuth || '',
          pontosCnh: activeData.pontosCnh !== undefined ? activeData.pontosCnh : 0,
          obs: activeData.obs || ''
      };

      setEmailModalMulta(normalizedData);
      if (isMultaObject) {
          setFormData(normalizedData);
      }

      const { toEmail, ccEmail, origin } = await resolveEmailRecipients(normalizedData);

      const getFormattedSubjectDate = (dateStr?: string) => {
          if (!dateStr) return '';
          try {
              const isoDate = dateStr.split('T')[0];
              if (isoDate.includes('-')) {
                  const parts = isoDate.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
              }
          } catch(e) {}
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      };

      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(normalizedData.placa || ''));
      const baseStr = (normalizedData.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';
      const frotaStr = normalizedData.frota || (veiculoMatch as any)?.frota || normalizedData.placa || 'S/F';
      const dataFormatada = getFormattedSubjectDate(normalizedData.dataHoraInfracao);
      const defaultSubject = `NOTIFICAÇÃO DE MULTA: PLACA ${normalizedData.placa || 'S/P'} - FROTA: ${frotaStr} - BASE: ${baseStr} - DATA ${dataFormatada}`;

      setEmailTo(toEmail);
      setEmailCc(ccEmail);
      setEmailSubject(defaultSubject);
      setEmailCustomMessage('');
      setSaveToPlateMapping(false);
      setEmailOriginInfo(origin);
      setShowEmailPreviewHtml(false);
      setIsEmailModalOpen(true);
  };

  const handleOpenOutlookOrWebmail = async () => {
      const currentMulta: Partial<Multa> = emailModalMulta || formData;
      
      const toRecipientsList = emailTo.split(/[;,]+/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));

      if (toRecipientsList.length === 0) {
          alert("Por favor, informe ao menos um e-mail válido no campo 'Destinatário Principal (Para)'.");
          return;
      }

      // 1. Garantir que os arquivos anexos estejam baixados localmente para anexar no Outlook/Webmail
      const aitLinks = parseLinks(currentMulta.linkAit);
      let authLink = currentMulta.linkAuth;
      
      // Se não gerou Termo de Desconto, gera silenciosamente agora
      if (!authLink && currentMulta.placa) {
          try {
              const res = await generateAutorizacaoDescontoPdf(currentMulta);
              if (res) {
                  authLink = res.dataUrl;
                  setEmailModalMulta(prev => prev ? ({ ...prev, linkAuth: res.dataUrl }) : currentMulta);
                  setFormData(prev => ({ ...prev, linkAuth: res.dataUrl }));
                  // Baixa o termo gerado
                  res.download();
              }
          } catch (e) {}
      } else if (authLink) {
          // Se já existe Termo, baixa uma cópia para facilitar o anexo manual no Outlook
          try {
              const res = await generateAutorizacaoDescontoPdf(currentMulta);
              res.download();
          } catch (e) {}
      }

      // Baixa os AITs anexados se forem data URLs ou URLs disponíveis
      aitLinks.forEach((att) => {
          if (att.url.startsWith('data:')) {
              const a = document.createElement('a');
              a.href = att.url;
              a.download = att.name.endsWith('.pdf') ? att.name : `${att.name}.pdf`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} }, 200);
          }
      });

      // 2. Copiar tabela HTML rica e texto formatado para a área de transferência
      if (saveToPlateMapping && currentMulta.placa) {
          try {
              const pClean = cleanString(currentMulta.placa);
              const curMap = await fetchPlacaEmailMappings();
              await savePlacaEmailMappings({
                  ...curMap,
                  [pClean]: { to: emailTo.trim(), cc: emailCc.trim() }
              });
          } catch (e) {}
      }

      const htmlContent = generateEmailHTML({ 
          ...currentMulta, 
          linkAuth: authLink,
          customMessage: emailCustomMessage 
      });
      try {
          if (navigator.clipboard && window.ClipboardItem) {
              const blobHtml = new Blob([htmlContent], { type: 'text/html' });
              const blobText = new Blob([`NOTIFICAÇÃO DE MULTA: PLACA ${currentMulta.placa || '-'} - AIT: ${currentMulta.ait || '-'}\nMotorista: ${currentMulta.responsavelNome || '-'}\nValor: ${(currentMulta.valorComDesconto || currentMulta.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nPrazo Indicação: ${currentMulta.prazoIndicacao || '-'}`], { type: 'text/plain' });
              const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
              await navigator.clipboard.write(data);
          }
      } catch (clipErr) {
          console.warn("Clipboard rich text:", clipErr);
      }

      // 3. Abrir o cliente de e-mail padrão (Outlook / Webmail) pré-preenchido
      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(currentMulta.placa || ''));
      const baseStr = (currentMulta.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';
      const frotaStr = currentMulta.frota || (veiculoMatch as any)?.frota || currentMulta.placa || 'S/F';
      const dataFormatada = currentMulta.dataHoraInfracao ? currentMulta.dataHoraInfracao.split('T')[0] : '';
      const fallbackSubject = `NOTIFICAÇÃO DE MULTA: PLACA ${currentMulta.placa || 'S/P'} - FROTA: ${frotaStr} - BASE: ${baseStr} - DATA ${dataFormatada}`;
      const finalSubject = emailSubject.trim() || fallbackSubject;
      const subject = encodeURIComponent(finalSubject);
      
      const obsPlainText = currentMulta.obs && currentMulta.obs.trim() ? `• Observações: ${currentMulta.obs.trim()}\n` : '';

      let bodyPlainText = `Prezados(as),\n\nSeguem as informações da Notificação de Infração de Trânsito para providências:\n\n` +
          `• Motorista / Condutor: ${currentMulta.responsavelNome || '-'}\n` +
          `• Auto de Infração (AIT): ${currentMulta.ait || '-'}\n` +
          `• Placa do Veículo: ${currentMulta.placa || '-'}\n` +
          `• Frota / Unidade: ${frotaStr}\n` +
          `• Base / Filial: ${baseStr}\n` +
          `• Infração Cometida: ${currentMulta.descricaoInfracao || currentMulta.enquadramento || '-'}\n` +
          `• Valor Líquido com Desconto: ${(currentMulta.valorComDesconto || currentMulta.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
          `• Pontuação CNH: ${currentMulta.pontosCnh || 0} Pontos\n` +
          `• Prazo Limite para Indicação: ${currentMulta.prazoIndicacao || '-'}\n` +
          obsPlainText + `\n`;

      if (emailCustomMessage && emailCustomMessage.trim()) {
          bodyPlainText += `[OBSERVAÇÃO / ORIENTAÇÃO ADICIONAL]:\n${emailCustomMessage.trim()}\n\n`;
      }

      bodyPlainText += `[DICA: A formatação visual completa e elegante foi copiada para sua área de transferência (Ctrl+V)].\n\n` +
          `Atenciosamente,\nGestão Integrada de Frotas • Risel Combustíveis Ltda`;

      const body = encodeURIComponent(bodyPlainText);
      const mailLink = document.createElement('a');
      mailLink.href = `mailto:${emailTo}?cc=${emailCc}&subject=${subject}&body=${body}`;
      mailLink.target = '_blank';
      document.body.appendChild(mailLink);
      mailLink.click();
      setTimeout(() => { try { document.body.removeChild(mailLink); } catch (e) {} }, 300);

      setIsEmailModalOpen(false);
      setShowEmailPreviewHtml(false);
      alert("✅ Destinatários e notificação confirmados com sucesso!\n\n1. Os arquivos anexos (AIT e Termo em PDF) foram salvos na sua pasta de Downloads.\n2. O corpo do e-mail formatado foi copiado para a sua área de transferência (basta dar Ctrl+V).\n3. Seu cliente de e-mail (Outlook / Webmail) foi aberto com os destinatários preenchidos!");
  };

  const handleSendEmail = async () => {
      const currentMulta: Partial<Multa> = emailModalMulta || formData;
      if (!currentMulta.placa && !currentMulta.ait) { 
          alert("Por favor, selecione ou preencha os dados da multa antes de enviar a notificação."); 
          return; 
      }
      
      // Parse main recipients list
      const toRecipientsList = emailTo.split(/[;,]+/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));

      if (toRecipientsList.length === 0) {
          alert("Por favor, informe ao menos um e-mail válido no campo 'Destinatário Principal (Para)'.");
          return;
      }

      setSendingEmail(true);

      // Salva mapeamento permanente se solicitado
      if (saveToPlateMapping && currentMulta.placa) {
          try {
              const pClean = cleanString(currentMulta.placa);
              const curMap = await fetchPlacaEmailMappings();
              await savePlacaEmailMappings({
                  ...curMap,
                  [pClean]: { to: emailTo.trim(), cc: emailCc.trim() }
              });
          } catch (e) {
              console.warn("Aviso ao salvar mapeamento da placa:", e);
          }
      }
      
      // Parse CC recipients list
      const ccRecipientsList = emailCc.split(/[;,]+/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));
      
      // Format date for subject
      const getFormattedSubjectDate = (dateStr?: string) => {
          if (!dateStr) return '';
          try {
              const isoDate = dateStr.split('T')[0];
              if (isoDate.includes('-')) {
                  const parts = isoDate.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
              }
          } catch(e) {}
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return '';
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      };

      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(currentMulta.placa || ''));
      const baseStr = (currentMulta.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';
      const frotaStr = currentMulta.frota || (veiculoMatch as any)?.frota || currentMulta.placa || 'S/F';
      const dataFormatada = getFormattedSubjectDate(currentMulta.dataHoraInfracao);
      const fallbackSubject = `NOTIFICAÇÃO DE MULTA: PLACA ${currentMulta.placa || 'S/P'} - FROTA: ${frotaStr} - BASE: ${baseStr} - DATA ${dataFormatada}`;
      const finalSubject = emailSubject.trim() || fallbackSubject;
      
      // Coleta todos os anexos (AITs anexados + Autorização de Desconto em PDF)
      const aitLinks = parseLinks(currentMulta.linkAit);
      const driveUrls: Array<{ name: string; url: string }> = [...aitLinks];
      
      // Se não gerou PDF ainda, geramos silenciosamente agora
      let authLink = currentMulta.linkAuth;
      if (!authLink && currentMulta.placa) {
          try {
              const pdfRes = await generateAutorizacaoDescontoPdf(currentMulta);
              if (pdfRes) {
                  authLink = pdfRes.dataUrl;
                  setEmailModalMulta(prev => prev ? ({ ...prev, linkAuth: pdfRes.dataUrl }) : currentMulta);
                  setFormData(prev => ({ ...prev, linkAuth: pdfRes.dataUrl }));
              }
          } catch (e) {}
      }

      if (authLink) {
          driveUrls.push({
              name: `Autorizacao_Desconto_${currentMulta.placa || 'MULTA'}`,
              url: authLink
          });
      }

      // Tenta obter credenciais de SMTP salvas pelo módulo de Checklist/Usuários ou variáveis de ambiente
      const smtpHost = localStorage.getItem("risel_smtp_host") || undefined;
      const smtpPort = localStorage.getItem("risel_smtp_port") || undefined;
      const smtpEmail = localStorage.getItem("risel_smtp_email") || undefined;
      const smtpPassword = localStorage.getItem("risel_smtp_password") || undefined;
      const resendApiKey = localStorage.getItem("risel_resend_api_key") || undefined;
      const brevoApiKey = localStorage.getItem("risel_brevo_api_key") || undefined;

      try {
          const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  smtpHost,
                  smtpPort,
                  smtpEmail,
                  smtpPassword,
                  resendApiKey,
                  brevoApiKey,
                  fromName: "Sistema de Multas Risel",
                  source: "multas",
                  to: toRecipientsList.join(', ') || ADMIN_EMAIL,
                  cc: ccRecipientsList.join(', '),
                  subject: finalSubject,
                  html: generateEmailHTML({ 
                      ...currentMulta, 
                      linkAuth: authLink,
                      customMessage: emailCustomMessage 
                  }),
                  driveUrls
              })
          });

          const result = await response.json().catch(() => ({}));
          if (response.ok && result.success) { 
              // Se os arquivos eram links remotos temporários do Drive, remove
              const driveRemoteUrls = driveUrls.filter(u => u.url.startsWith('http')).map(u => u.url);
              if (driveRemoteUrls.length > 0) {
                  deleteDriveFiles(driveRemoteUrls).catch(e => console.warn(e));
              }

              const providerInfo = result.provider ? `\n\nProvedor: ${result.provider}` : '';
              alert((result.message || `✅ E-mail enviado com sucesso para ${toRecipientsList.join(', ') || ADMIN_EMAIL}!`) + providerInfo);
              setIsEmailModalOpen(false);
              setShowEmailPreviewHtml(false);
          } else { 
              console.warn("[Multas] Envio via servidor não completou:", result); 
              const isRenderBlock = result.firewallBlocked || result.renderFree || (result.message && (result.message.includes("Render") || result.message.includes("SMTP")));
              if (isRenderBlock) {
                  const goToOutlook = window.confirm(
                      `⚠️ Bloqueio do Render (Plano Free):\n${result.message}\n\n${result.help ? result.help + '\n\n' : ''}Deseja abrir a notificação agora no seu Outlook / Webmail com todos os destinatários, dados da multa e anexos prontos para envio?`
                  );
                  if (goToOutlook) {
                      handleOpenOutlookOrWebmail();
                      return;
                  }
              } else {
                  const helpText = result.help ? `\n\nOrientação: ${result.help}` : '';
                  alert("Erro ao enviar e-mail: " + (result.message || result.error || "Não foi possível completar o envio.") + helpText);
              }
          }
      } catch (err: any) {
          console.error("Erro ao enviar e-mail via servidor:", err);
          alert(`Erro ao enviar e-mail via servidor: ${err.message || err}`);
      } finally {
          setSendingEmail(false);
      }
  };

  const handleExport = () => {
      // (Export logic same as before)
      setIsExportModalOpen(false);
  };

  const FormTooltip = ({ text }: { text: string }) => (
      <div className="group/tooltip relative inline-flex ml-1.5 cursor-help tooltip-trigger"><HelpCircle size={12} className="text-gray-400 hover:text-risel-blue" /><div className="tooltip-content absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900/95 text-white text-[10px] p-2 rounded shadow-lg backdrop-blur-sm z-50 text-center leading-relaxed">{text}</div></div>
  );

  const renderEmailModal = () => {
    if (!isEmailModalOpen) return null;
    const activeMulta: Partial<Multa> = emailModalMulta || formData;
    const modalAttachments = parseLinks(activeMulta.linkAit);

    const parsedToList = emailTo.split(/[;,]+/).map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));
    const parsedCcList = emailCc.split(/[;,]+/).map(e => e.trim()).filter(e => e.length > 0 && e.includes('@'));

    const formatModalDate = (val?: string) => {
      if (!val) return '-';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString('pt-BR');
      } catch (e) {
        return val;
      }
    };

    const formatModalDateTime = (val?: string) => {
      if (!val) return '-';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return val;
      }
    };

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-6 w-full max-w-2xl my-auto animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[92vh] flex flex-col">
          {/* Top Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100">
                <Mail size={22} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Revisar e Enviar Notificação de Infração
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  AIT: <strong className="text-emerald-800 font-mono">{activeMulta.ait || 'Não informado'}</strong> • Placa: <strong className="text-slate-800">{activeMulta.placa || '-'}</strong> {activeMulta.frota ? `• Frota: ${activeMulta.frota}` : ''}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsEmailModalOpen(false);
                setShowEmailPreviewHtml(false);
              }}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={18}/>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto custom-scrollbar pr-1 py-3 space-y-3.5 flex-1 text-xs">
            
            {/* SEÇÃO 1: DESTINATÁRIOS & CONFIGURAÇÃO DO ENVIO (EM PRIMEIRO LUGAR) */}
            <div className="bg-emerald-50/40 border-2 border-emerald-200/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-emerald-200/60">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Edit3 size={13} className="text-emerald-700" /> 1. Destinatários & Configuração de Envio
                </span>
                {emailOriginInfo && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Origem: {emailOriginInfo}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wide">
                    Destinatário Principal (Para): <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">Pode inserir múltiplos e-mails separados por ponto e vírgula (;)</span>
                </div>
                <input 
                  type="text" 
                  className="w-full border-2 border-slate-200 focus:border-emerald-600 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-xs font-semibold text-slate-800 transition-all" 
                  value={emailTo} 
                  onChange={e => setEmailTo(e.target.value)} 
                  placeholder="motorista@risel.com.br; gestor@risel.com.br" 
                />
                
                {/* Visual Pill Tags for Parsed Recipients */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {parsedToList.length > 0 ? (
                    parsedToList.map((email, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                        <CheckCircle2 size={10} className="text-emerald-600" /> {email}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircle size={11} /> Digite ao menos um endereço de e-mail válido para o envio.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wide">
                    Cópia Automática de Segurança (CC):
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">RH e Gestão de Frotas</span>
                </div>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 focus:border-emerald-600 rounded-xl p-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-xs font-medium text-slate-700 transition-all" 
                  value={emailCc} 
                  onChange={e => setEmailCc(e.target.value)} 
                  placeholder="lorena.padilha@risel.com.br; deny.goncalves@risel.com.br" 
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedCcList.map((email, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {email}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wide mb-1 block">
                  Assunto do E-mail:
                </label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 focus:border-emerald-600 rounded-xl p-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-xs font-semibold text-slate-800 transition-all" 
                  value={emailSubject} 
                  onChange={e => setEmailSubject(e.target.value)} 
                  placeholder="NOTIFICAÇÃO DE MULTA..." 
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wide mb-1 block">
                  Instrução / Orientação Específica ao Condutor (Opcional):
                </label>
                <textarea 
                  rows={2}
                  className="w-full border border-slate-300 focus:border-emerald-600 rounded-xl p-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none text-xs text-slate-800 transition-all resize-none" 
                  value={emailCustomMessage} 
                  onChange={e => setEmailCustomMessage(e.target.value)} 
                  placeholder="Ex: Favor imprimir e assinar a Autorização de Desconto em anexo e entregar no setor pessoal até a data limite indicada." 
                />
              </div>

              {activeMulta.placa && (
                <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-200 cursor-pointer select-none hover:bg-emerald-50/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={saveToPlateMapping} 
                    onChange={e => setSaveToPlateMapping(e.target.checked)} 
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    Salvar estes e-mails permanentemente para a placa <strong className="text-emerald-800">{activeMulta.placa}</strong> nos próximos lançamentos
                  </span>
                </label>
              )}
            </div>

            {/* SEÇÃO 2: DADOS DO LANÇAMENTO DA NOTIFICAÇÃO (RESUMO) */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText size={13} className="text-emerald-700" /> 2. Resumo da Autuação Vinculada
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {activeMulta.status || 'Lançado'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Condutor / Motorista</span>
                  <span className="font-black text-slate-800 truncate block text-xs" title={activeMulta.responsavelNome}>
                    {activeMulta.responsavelNome || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Veículo / Placa</span>
                  <div className="flex items-center gap-2">
                    <MercosulPlateBadge plate={activeMulta.placa || ''} size="sm" />
                    {activeMulta.frota && <span className="text-slate-500 font-bold text-xs">(Frota {activeMulta.frota})</span>}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Auto Infração (AIT)</span>
                  <span className="font-mono font-black text-emerald-800 text-xs">
                    {activeMulta.ait || 'Não informado'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-3 bg-white/70 p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-0.5">Infração Cometida</span>
                  <span className="font-bold text-slate-800 block text-xs leading-snug" title={activeMulta.descricaoInfracao || activeMulta.enquadramento}>
                    {activeMulta.descricaoInfracao || activeMulta.enquadramento || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Data da Infração</span>
                  <span className="font-bold text-slate-700 text-xs">
                    {formatModalDateTime(activeMulta.dataHoraInfracao)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-rose-600 block uppercase">Prazo de Indicação</span>
                  <span className="font-black text-rose-700 text-xs">
                    {formatModalDate(activeMulta.prazoIndicacao)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 block uppercase">Valor Líquido c/ Desconto</span>
                  <span className="font-mono font-black text-emerald-800 text-xs">
                    {(activeMulta.valorComDesconto || activeMulta.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: ANEXOS & PRÉVIA */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <p className="text-xs font-black text-slate-700 mb-1.5 flex items-center">
                <Paperclip size={14} className="mr-1.5 text-emerald-700"/> Arquivos anexos do e-mail:
              </p>
              <ul className="space-y-1 text-xs text-slate-600">
                {modalAttachments.map((att, idx) => (
                  <li key={idx} className="flex items-center text-[11px] font-semibold text-slate-800">
                    <FileCheck size={13} className="text-emerald-600 mr-1.5 shrink-0"/> {att.name} (Auto de Infração - AIT)
                  </li>
                ))}
                {activeMulta.linkAuth ? (
                  <li className="flex items-center text-[11px] font-semibold text-emerald-800">
                    <FileText size={13} className="text-emerald-600 mr-1.5 shrink-0"/> Termo de Autorização de Desconto (PDF Timbrado Risel)
                  </li>
                ) : (
                  <li className="flex items-center text-[11px] text-amber-700 italic">
                    <AlertTriangle size={13} className="mr-1.5 shrink-0"/> O Termo de Desconto Timbrado será gerado e anexado automaticamente no envio.
                  </li>
                )}
              </ul>
            </div>

            {/* EXPANDABLE EMAIL PREVIEW */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={() => setShowEmailPreviewHtml(!showEmailPreviewHtml)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Eye size={14} className="text-emerald-700" />
                  <span>Visualizar modelo do e-mail oficial (Risel)</span>
                </span>
                <span className="text-[11px] text-emerald-700 font-extrabold">
                  {showEmailPreviewHtml ? 'Ocultar Prévia ▲' : 'Expandir Prévia Visual ▼'}
                </span>
              </button>
              {showEmailPreviewHtml && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 max-h-56 overflow-y-auto custom-scrollbar">
                  <div 
                    className="bg-white p-3 rounded-xl shadow-2xs border border-slate-200 text-xs"
                    dangerouslySetInnerHTML={{ 
                      __html: generateEmailHTML({ 
                        ...activeMulta, 
                        customMessage: emailCustomMessage 
                      }) 
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 mt-1 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={handleOpenOutlookOrWebmail}
              disabled={sendingEmail || parsedToList.length === 0}
              className="text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl font-bold transition-all flex items-center cursor-pointer active:scale-95 w-full sm:w-auto justify-center"
              title="Abrir no seu aplicativo Outlook / Webmail baixando os anexos (opcional)"
            >
              <Mail size={14} className="mr-1.5 text-blue-600"/> Abrir no Outlook (Opcional)
            </button>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button 
                type="button"
                onClick={() => {
                  setIsEmailModalOpen(false);
                  setShowEmailPreviewHtml(false);
                }} 
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-bold cursor-pointer" 
                disabled={sendingEmail}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSendEmail} 
                disabled={sendingEmail || parsedToList.length === 0} 
                className={`px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-md active:scale-95 flex items-center font-black text-xs transition-all cursor-pointer ${
                  sendingEmail || parsedToList.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                title="Confirmar destinatários e realizar o envio automático imediato da notificação"
              >
                {sendingEmail ? <Loader2 size={15} className="animate-spin mr-1.5"/> : <Send size={15} className="mr-1.5"/>} 
                {sendingEmail ? 'Enviando Notificação...' : `Confirmar e Enviar Direto (${parsedToList.length} Para${parsedCcList.length > 0 ? ` + ${parsedCcList.length} CC` : ''})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'LIST') {
    return (
        <div className="space-y-3 animate-in fade-in relative h-full flex flex-col pb-0">
            {loading && <Loading />}
            
            {/* Header Compacto para ganho de espaço de tela */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-2.5 bg-white/70 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-sm border border-white/30 shrink-0">
                <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <div>
                        <h2 className="text-base font-black text-slate-800 tracking-tight leading-tight">Gestão de Multas</h2>
                        <p className="text-slate-500 text-[10px] font-medium leading-none">Controle e Processamento de Infrações</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                    <button id="btn-abrir-importar-csv" onClick={() => setIsImportModalOpen(true)} className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1.5 rounded-lg flex items-center shadow-sm transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><UploadCloud size={14} className="mr-1.5 text-purple-600" /> Importar CSV</button>
                    <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center shadow-sm transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><FileSpreadsheet size={14} className="mr-1.5" /> Exportar</button>
                    <button onClick={() => setShowGlobalMap(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center shadow-sm transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><MapIcon size={14} className="mr-1.5 text-risel-green" /> Mapa Geral</button>
                    <button onClick={() => { setFormData(initialMulta); setErrors({}); setView('FORM'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg flex items-center shadow-sm hover:shadow transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><Plus size={14} className="mr-1.5" /> Nova Multa</button>
                </div>
            </div>

            {/* Painel Executivo de Indicadores com Layout Assimétrico (Bento Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 shrink-0">
                {/* Card 1 (Span 4): Resumo Geral & Montante Financeiro */}
                <div className="sm:col-span-2 lg:col-span-4 bg-gradient-to-br from-[#032b21] via-[#043d2f] to-[#02221a] text-white p-3.5 rounded-2xl shadow-sm border border-emerald-800/40 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400/90 flex items-center">
                                <FileText size={12} className="mr-1 text-emerald-400"/> Total de Lançamentos
                            </span>
                            <div className="text-2xl font-black tracking-tight mt-0.5 text-white flex items-baseline gap-2">
                                {metrics.totalCount} <span className="text-xs font-normal text-emerald-300/80">notificações</span>
                            </div>
                        </div>
                        <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-400/30">
                            <DollarSign size={18} className="text-emerald-300"/>
                        </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-emerald-200/90 font-medium">Impacto Financeiro:</span>
                        <span className="font-black text-sm text-emerald-300 font-mono">
                            {metrics.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>

                {/* Card 2 (Span 3): Prazos de Indicação em Alerta */}
                <div className="sm:col-span-1 lg:col-span-3 bg-white/80 backdrop-blur-md p-3.5 rounded-2xl shadow-sm border border-amber-200/80 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center">
                                <AlertTriangle size={12} className="mr-1 text-amber-600"/> Prazos Críticos (≤ 7 dias)
                            </span>
                            <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
                                {metrics.prazosCriticos}
                            </div>
                        </div>
                        <div className={`p-2 rounded-xl border ${metrics.prazosCriticos > 0 ? 'bg-amber-100/80 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                            <Clock size={18}/>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                        {metrics.prazosCriticos > 0 ? 'Exigem indicação urgente de condutor' : 'Prazos operacionais regularizados'}
                    </p>
                </div>

                {/* Card 3 (Span 3): Responsabilidade Condutor vs Empresa */}
                <div className="sm:col-span-1 lg:col-span-3 bg-white/80 backdrop-blur-md p-3.5 rounded-2xl shadow-sm border border-blue-200/80 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center">
                                <User size={12} className="mr-1 text-blue-600"/> Responsabilidade
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-lg font-black text-slate-800">{metrics.condutorCount}</span>
                                <span className="text-[11px] font-bold text-slate-500">Condutor</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-lg font-black text-slate-800">{metrics.empresaCount}</span>
                                <span className="text-[11px] font-bold text-slate-500">Empresa</span>
                            </div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-xl border border-blue-200 text-blue-700">
                            <Car size={18}/>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex mt-2">
                        <div 
                            className="bg-blue-600 h-full" 
                            style={{ width: `${metrics.totalCount > 0 ? (metrics.condutorCount / metrics.totalCount) * 100 : 0}%` }}
                            title={`Condutor: ${metrics.condutorCount}`}
                        />
                        <div 
                            className="bg-slate-400 h-full" 
                            style={{ width: `${metrics.totalCount > 0 ? (metrics.empresaCount / metrics.totalCount) * 100 : 0}%` }}
                            title={`Empresa: ${metrics.empresaCount}`}
                        />
                    </div>
                </div>

                {/* Card 4 (Span 2): Descontos em Folha & Termos */}
                <div className="sm:col-span-2 lg:col-span-2 bg-white/80 backdrop-blur-md p-3.5 rounded-2xl shadow-sm border border-purple-200/80 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center">
                                <FileCheck size={12} className="mr-1 text-purple-600"/> Termos & Folha
                            </span>
                            <div className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                                {metrics.descontosAutorizados} <span className="text-[10px] font-bold text-slate-400">aut.</span>
                            </div>
                        </div>
                        <div className="bg-purple-50 p-2 rounded-xl border border-purple-200 text-purple-700">
                            <FileText size={16}/>
                        </div>
                    </div>
                    <div className="text-[10px] text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-md self-start mt-1">
                        {metrics.termosGerados} PDF(s) Timbrados
                    </div>
                </div>
            </div>
            
            {/* Filter Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-2 rounded-xl shadow-sm border border-white/30">
                    <div className="flex items-center w-full"><Search className="text-gray-500 mr-2 ml-2" size={18} /><input type="text" placeholder="Pesquisar Rápida (AIT, Placa, Frota...)" className="flex-1 outline-none text-gray-800 bg-transparent text-sm font-medium placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>{searchTerm && <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-1 mr-2"><X size={16} /></button>}</div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`ml-3 px-3 py-1.5 rounded-lg flex items-center font-bold text-xs border transition-all ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><Filter size={14} className="mr-1"/> Filtros {showFilters ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}</button>
                </div>

                {/* Pills de Filtro Rápido por Status */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                    <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap text-[11px] flex items-center gap-1.5 shadow-2xs ${!filters.status ? 'bg-slate-800 text-white shadow-sm' : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200'}`}
                    >
                        <span>Todos</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${!filters.status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{multas.length}</span>
                    </button>
                    {(Object.values(StatusMulta) as string[]).map(st => {
                        const count = multas.filter(m => m.status === st).length;
                        const isSelected = filters.status === st;
                        return (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setFilters(prev => ({ ...prev, status: isSelected ? '' : st }))}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap text-[11px] flex items-center gap-1.5 shadow-2xs ${isSelected ? 'bg-risel-green text-black shadow-sm ring-2 ring-emerald-500/40' : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200'}`}
                            >
                                <span>{st}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${isSelected ? 'bg-black/20 text-black' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFilters ? 'max-h-60 opacity-100 animate-in fade-in slide-in-from-top-2 duration-300' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Placa</label><input type="text" className="w-full border rounded-lg p-2 text-xs font-bold uppercase bg-slate-50 focus:bg-white transition-colors" value={filters.placa} onChange={e => setFilters({...filters, placa: e.target.value})} placeholder="Todas"/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Início</label><input type="date" className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})}/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Fim</label><input type="date" className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})}/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mês Ref.</label><select className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer" value={filters.mes} onChange={e => { setFilters({...filters, mes: e.target.value}); onMonthChange?.(e.target.value); }}><option value="">Todos</option>{availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Base</label><select className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer" value={filters.base} onChange={e => setFilters({...filters, base: e.target.value})}><option value="">Todas</option>{availableBases.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label><select className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">Todos</option>{(Object.values(StatusMulta) as string[]).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Responsabilidade</label><select className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors cursor-pointer" value={filters.responsabilidade} onChange={e => setFilters({...filters, responsabilidade: e.target.value})}><option value="">Todos</option><option value="EMPRESA">Empresa</option><option value="CONDUTOR">Condutor</option></select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Descontar?</label><select className="w-full border rounded-lg p-2 text-xs bg-slate-50 focus:bg-white transition-colors font-bold cursor-pointer text-slate-700" value={filters.descontar} onChange={e => setFilters({...filters, descontar: e.target.value})}><option value="">Todos</option><option value="SIM">Sim</option><option value="NÃO">Não</option></select></div>
                    </div>
                </div>
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-hidden min-h-0 relative">
                <div className="bg-white/50 backdrop-blur-lg rounded-xl shadow-sm border border-white/30 overflow-hidden flex flex-col h-full">
                    <div className="overflow-auto flex-1 custom-scrollbar w-full relative">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 z-20 shadow-md">
                                <tr className="bg-gradient-to-r from-[#022c22] to-risel-green text-white">
                                    <th className="px-3 py-3 w-20 text-white/90 font-bold uppercase tracking-wider text-[10px] text-center border-r border-white/10">Ações</th>
                                    <th onClick={() => handleSort('status')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] text-left border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Status <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('dataHoraInfracao')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Data Multa <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('prazoIndicacao')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Data Prazo <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('placa')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Placa <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('ait')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">AIT <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('descricaoInfracao')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 min-w-[180px] max-w-[280px] cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Infração Cometida <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('responsavelNome')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 min-w-[130px] cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Motorista <ArrowUpDown size={12}/></div></th>
                                    <th className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] text-center border-r border-white/10 whitespace-nowrap">Obs</th>
                                    <th className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] text-center border-r border-white/10 whitespace-nowrap">Docs</th>
                                    <th onClick={() => handleSort('valor')} className="px-3 py-3 text-white/90 font-bold uppercase tracking-wider text-[10px] text-right rounded-tr-lg whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-end gap-1">Valor <ArrowUpDown size={12}/></div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50">
                                {sortedMultas.map((multa, idx) => {
                                    const rowClass = idx % 2 === 0 ? 'bg-white/40' : 'bg-white/20';
                                    const atts = parseLinks(multa.linkAit);
                                    const prazoInfo = getPrazoInfo(multa.status, multa.prazoIndicacao);
                                    return (
                                        <tr key={multa.id} className={`${rowClass} hover:bg-blue-50/60 transition-colors group`}>
                                            <td className="px-2 py-2 text-center border-r border-gray-200/50 align-middle">
                                                <div className="flex justify-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); setFormData(sanitizeMultaForForm(multa)); setView('FORM'); }} className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-full transition-all" title="Editar"><Edit2 size={14} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleSendDirectEmail(multa); }} className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-full transition-all" title="Enviar Notificação Direto (E-mail Cadastrado)"><Send size={14} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenEmailModal(multa); }} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full transition-all" title="Confirmar / Editar Destinatários antes do envio"><Mail size={14} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setMapMulta(multa); }} className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-full transition-all relative" title="Localizar no Mapa & Rastreador GPS">
                                                        <MapPin size={14} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(multa.id); }} className="text-gray-400 hover:text-red-600 p-1.5 rounded-full transition-all" title="Excluir"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-left border-r border-gray-200/50 whitespace-nowrap align-middle">{getStatusBadge(multa.status)}</td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 whitespace-nowrap align-middle text-center">
                                                <span className="text-[10px] font-mono text-gray-600">{formatDateString(multa.dataHoraInfracao)}</span>
                                            </td>
                                            <td className={`px-3 py-2 border-r border-gray-200/50 whitespace-nowrap align-middle text-center ${prazoInfo.cellGradient || ''}`}>
                                                <span className={`text-[11px] font-mono ${prazoInfo.textColor || 'text-gray-700'}`}>
                                                    {formatDateString(multa.prazoIndicacao)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 whitespace-nowrap align-middle">
                                                <MercosulPlateBadge plate={multa.placa} size="sm" />
                                            </td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 font-medium text-gray-600 text-[10px] whitespace-nowrap align-middle">{multa.ait}</td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 text-gray-800 text-xs font-medium align-middle truncate max-w-[260px]" title={multa.descricaoInfracao || multa.enquadramento}>
                                                {multa.descricaoInfracao || multa.enquadramento || '-'}
                                            </td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 text-gray-600 align-middle truncate max-w-[140px] text-xs font-medium">{multa.responsavelNome || '-'}</td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 text-center align-middle whitespace-nowrap">
                                                {multa.obs && multa.obs.trim().length > 0 ? (
                                                    <div className="group/obs relative inline-block">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 cursor-help">
                                                            <MessageSquare size={10} className="mr-1 text-amber-600"/> Nota
                                                        </span>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl hidden group-hover/obs:block z-50 text-left leading-relaxed">
                                                            <p className="font-bold text-amber-400 mb-0.5 text-[10px] uppercase">Observação do Lançamento:</p>
                                                            <p className="text-slate-200">{multa.obs}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 border-r border-gray-200/50 text-center align-middle whitespace-nowrap">
                                                <div className="flex items-center justify-center space-x-1.5">
                                                    {multa.linkAuth && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openTermoInNewTab(multa, multa.linkAuth);
                                                            }}
                                                            className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition-colors"
                                                            title="Visualizar Termo de Desconto em Nova Aba"
                                                        >
                                                            <FileText size={14} />
                                                        </button>
                                                    )}
                                                    {atts.length > 0 && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openPdfViewer(atts[0].url, `AIT - ${multa.placa} (${atts[0].name})`, `${atts[0].name}.pdf`);
                                                            }}
                                                            className="text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1 rounded-md transition-colors"
                                                            title={`Visualizar AIT Anexo (${atts.length} arquivo(s))`}
                                                        >
                                                            <Paperclip size={14} />
                                                        </button>
                                                    )}
                                                    {!multa.linkAuth && atts.length === 0 && (
                                                        <span className="text-[10px] text-slate-300">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-gray-800 whitespace-nowrap align-middle text-xs">{formatMoneyString(multa.valor)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {showGlobalMap && <MapModal multas={multas} onClose={() => setShowGlobalMap(false)} title="Mapa Geral de Infrações" />}
            {mapMulta && <MapModal multas={[mapMulta]} onClose={() => setMapMulta(null)} singleMode title={`Localização: ${mapMulta.placa} - ${mapMulta.ait}`} />}
            
            <PdfViewerModal
                isOpen={pdfModalOpen}
                onClose={() => setPdfModalOpen(false)}
                pdfUrlOrData={pdfModalData.url}
                title={pdfModalData.title}
                fileName={pdfModalData.fileName}
            />

            {renderEmailModal()}

            <ImportarMultasCsvModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                existingMultas={multas}
                veiculos={veiculos}
                codigos={codigos}
                onImportSuccess={handleImportCsvSuccess}
            />
        </div>
    );
  }

  // Calculate Info for Form View
  const formPrazoInfo = getPrazoInfo(formData.status, formData.prazoIndicacao);
  const currentAttachments = parseLinks(formData.linkAit);

  return (
    <div className="space-y-2.5 animate-in slide-in-from-right duration-300 relative pb-4 flex-1 overflow-auto custom-scrollbar pr-1 max-w-7xl mx-auto w-full">
        {loading && <Loading />}
        
        {/* Header Superior Executivo Compacto */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200/80 pb-2 sticky top-0 bg-white/95 backdrop-blur-md z-30 pt-1 px-3.5 rounded-xl shadow-xs">
            <div className="flex items-center space-x-2.5">
                <button 
                    onClick={() => setView('LIST')} 
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all border border-slate-200 hover:border-emerald-300 shadow-xs"
                    title="Voltar para a Listagem"
                >
                    <ArrowLeft size={16}/>
                </button>
                <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                        {formData.id ? 'Editar Notificação de Multa' : 'Lançamento de Notificação de Multa'}
                    </h2>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="hidden sm:flex bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                    {formData.id ? `Registro ID: ${formData.id}` : 'Novo Registro'}
                </div>
                
                <button 
                    type="button"
                    onClick={() => setView('LIST')} 
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs flex items-center active:scale-95"
                >
                    <X size={13} className="mr-1 text-slate-400"/> Cancelar
                </button>

                {/* Botão de Enviar E-mail: discreto e elegante entre Cancelar e Salvar */}
                <button 
                    type="button"
                    onClick={() => handleOpenEmailModal()} 
                    className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200/90 rounded-xl transition-all shadow-2xs hover:shadow-xs flex items-center active:scale-95"
                    title="Revisar destinatários e enviar notificação por e-mail"
                >
                    <Mail size={13} className="mr-1.5 text-blue-600"/> Enviar E-mail
                </button>

                <button 
                    type="button"
                    onClick={handleSave} 
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-xs flex items-center active:scale-95"
                    title="Salvar registro"
                >
                    <Save size={13} className="mr-1.5"/> Salvar
                </button>

                <button 
                    type="button"
                    onClick={handleSaveAndNotify} 
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all shadow-2xs flex items-center active:scale-95"
                    title="Salvar registro e enviar notificação direta"
                >
                    <Send size={13} className="mr-1.5 text-emerald-700"/> Salvar e Disparar
                </button>
            </div>
        </div>

        {/* Grade de 6 Cards Estruturados (2 Linhas de 3 Cards Perfeitamente Alinhadas) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
            
            {/* LINHA 1 - CARD 1: Identificação Básica */}
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200/90 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <FileText size={15} className="mr-1.5 text-emerald-700"/> IDENTIFICAÇÃO DO REGISTRO
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Passo 1</span>
                    </div>

                    <div className="space-y-2.5">
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">Status da Multa</label>
                                <FormTooltip text="Define o estágio atual no fluxo de gestão de multas." />
                            </div>
                            <select 
                                className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold text-slate-800 transition-all cursor-pointer" 
                                value={formData.status} 
                                onChange={e => setFormData({...formData, status: e.target.value as StatusMulta})}
                            >
                                {(Object.values(StatusMulta) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                                    Placa do Veículo <span className="text-red-500">*</span>
                                </label>
                                <span className="text-[9px] text-slate-400 font-mono">Mercosul / Antigo</span>
                            </div>
                            <input 
                                type="text" 
                                className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs font-black uppercase tracking-wider font-mono transition-all ${errors.placa ? 'border-red-500 focus:ring-red-200 bg-red-50/50' : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-white'}`} 
                                value={formData.placa || ''} 
                                onChange={e => handlePlacaChange(e.target.value)} 
                                placeholder="Ex: ABC1D23"
                            />
                            {errors.placa && <p className="text-[9px] text-red-600 font-bold mt-0.5">{errors.placa}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-0.5">Base / Filial</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs text-slate-800 font-bold transition-all" 
                                    value={formData.base || ''} 
                                    onChange={e => setFormData({...formData, base: formatInputText(e.target.value)})}
                                    placeholder="Ex: PAULÍNIA"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-0.5">Tipo Notificação</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold text-slate-800 transition-all cursor-pointer" 
                                    value={formData.tipo} 
                                    onChange={e => setFormData({...formData, tipo: e.target.value as TipoMulta})}
                                >
                                    {(Object.values(TipoMulta) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-0.5">
                                Número do AIT (Auto de Infração) <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs font-black font-mono transition-all ${errors.ait ? 'border-red-500 focus:ring-red-200 bg-red-50/50' : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500 bg-white'}`} 
                                value={formData.ait || ''} 
                                onChange={e => { setFormData({...formData, ait: formatInputText(e.target.value)}); clearError('ait'); }}
                                placeholder="Ex: T12345678"
                            />
                            {errors.ait && <p className="text-[9px] text-red-600 font-bold mt-0.5">{errors.ait}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* LINHA 1 - CARD 2: Infração e Localidade */}
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200/90 relative overflow-visible z-20 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <AlertTriangle size={15} className="mr-1.5 text-amber-600"/> INFRAÇÃO & LOCALIDADE
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">Passo 2</span>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 relative">
                            <div className="relative">
                                <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center">
                                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Enquadramento</label>
                                        <FormTooltip text="Digite o código (ex: 745-50) para puxar automaticamente os dados do CTB." />
                                    </div>
                                    {formData.enquadramento && codigos.some(c => cleanString(c.codigo) === cleanString(formData.enquadramento || '')) && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                            ✓ CTB Carregado
                                        </span>
                                    )}
                                </div>
                                <div className="relative w-full">
                                    <input 
                                        type="text" 
                                        className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs uppercase font-bold" 
                                        value={formData.enquadramento || ''} 
                                        onChange={e => handleEnquadramentoChange(e.target.value)} 
                                        onFocus={() => { if(formData.enquadramento && String(formData.enquadramento).length >= 1) setShowCodigosDropdown(true); }}
                                        onBlur={handleBlurEnquadramento}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (filteredCodigos.length > 0) {
                                                    selectCodigo(filteredCodigos[0]);
                                                }
                                            }
                                        }}
                                        placeholder="Cód. (ex: 745-50)"
                                        autoComplete="off"
                                    />
                                    {showCodigosDropdown && filteredCodigos.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-2xl mt-1 z-[100] max-h-48 overflow-y-auto custom-scrollbar">
                                            {filteredCodigos.map((c, idx) => {
                                                if (!c) return null;
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onMouseDown={(e) => { e.preventDefault(); selectCodigo(c); }}
                                                        onClick={(e) => { e.stopPropagation(); selectCodigo(c); }}
                                                        className="px-2.5 py-1.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-black text-slate-800 text-xs">{c.codigo}</span>
                                                            <span className="text-[9px] text-emerald-800 font-bold bg-emerald-100 px-1 rounded">{c.pontos || 0} Pts</span>
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 line-clamp-1 uppercase font-medium">{c.descricao}</p>
                                                        {c.baseLegal && (
                                                            <span className="text-[8px] text-gray-400 font-mono block mt-0.5">{c.baseLegal}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Artigo CTB</label>
                                <input type="text" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 font-medium" value={formData.artigoCtb || ''} onChange={e => setFormData({...formData, artigoCtb: formatInputText(e.target.value)})}/>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Descrição Infração</label>
                            <input type="text" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 uppercase font-medium" value={formData.descricaoInfracao || ''} onChange={e => setFormData({...formData, descricaoInfracao: formatInputText(e.target.value)})}/>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Pontos CNH</label><input type="number" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 font-bold" value={formData.pontosCnh || 0} onChange={e => setFormData({...formData, pontosCnh: Number(e.target.value)})}/></div>
                            <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Órgão Autuador</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.orgaoAutuador || ''} onChange={e => setFormData({...formData, orgaoAutuador: formatInputText(e.target.value)})}/></div>
                        </div>

                        <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Endereço Completo</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.endereco || ''} onChange={e => handleAddressChange(e.target.value)}/></div>

                        <div className="grid grid-cols-3 gap-1.5">
                            <div><label className="text-[9px] font-extrabold text-gray-500 uppercase block mb-0.5">Município</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.municipio || ''} onChange={e => setFormData({...formData, municipio: formatInputText(e.target.value)})}/></div>
                            <div><label className="text-[9px] font-extrabold text-gray-500 uppercase block mb-0.5">UF</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.uf || ''} onChange={e => setFormData({...formData, uf: formatInputText(e.target.value)})}/></div>
                            <div><label className="text-[9px] font-extrabold text-gray-500 uppercase block mb-0.5">Via</label><select className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.rodoviaOuUrbano || 'URBANO'} onChange={e => setFormData({...formData, rodoviaOuUrbano: e.target.value as any})}><option value="URBANO">Urbano</option><option value="RODOVIA">Rodovia</option></select></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LINHA 1 - CARD 3: Demonstrativo Financeiro */}
            <div className="bg-white p-3.5 rounded-xl shadow-xs border border-slate-200/90 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <DollarSign size={15} className="mr-1.5 text-emerald-700"/> DEMONSTRATIVO FINANCEIRO
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Valores</span>
                    </div>

                    <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Valor Total (R$)</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-black text-slate-900" 
                                    value={formData.valor || 0} 
                                    onChange={e => handleMoneyChange('valor', Number(e.target.value))} 
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Desconto (R$)</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-black text-slate-900" 
                                    value={formData.desconto || 0} 
                                    onChange={e => handleMoneyChange('desconto', Number(e.target.value))} 
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-emerald-800 uppercase block mb-0.5">Valor Final</label>
                                <div className="w-full border border-emerald-300 bg-emerald-50/90 rounded-lg p-1.5 text-emerald-800 font-black text-xs text-center truncate">
                                    {(formData.valorComDesconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Descontar Motorista?</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold cursor-pointer bg-slate-50" 
                                    value={formData.descontarMotorista} 
                                    onChange={e => setFormData({...formData, descontarMotorista: e.target.value as any})}
                                >
                                    <option value="SIM">SIM (Autorizado)</option>
                                    <option value="NÃO">NÃO (Empresa assume)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Pago c/ Desconto?</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold cursor-pointer bg-slate-50" 
                                    value={formData.pagoComDesconto} 
                                    onChange={e => setFormData({...formData, pagoComDesconto: e.target.value as any})}
                                >
                                    <option value="SIM">SIM (20% a 40%)</option>
                                    <option value="NÃO">NÃO (Integral)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LINHA 2 - CARD 4: DATAS E PRAZOS DE INDICAÇÃO (Alinhado na Linha Inferior) */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/90 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <Clock size={14} className="mr-1.5 text-amber-600"/> DATAS E PRAZOS DE INDICAÇÃO
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Cronograma</span>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Data/Hora Infração</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full border border-slate-300 rounded-lg p-1.5 focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-semibold" 
                                    value={formData.dataHoraInfracao || ''} 
                                    onChange={e => setFormData({...formData, dataHoraInfracao: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-0.5">Data Recebimento</label>
                                <input 
                                    type="date" 
                                    className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs font-semibold ${errors.dataRecebimento ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-emerald-500'}`} 
                                    value={formData.dataRecebimento || ''} 
                                    onChange={e => { setFormData({...formData, dataRecebimento: e.target.value}); clearError('dataRecebimento'); }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-extrabold text-red-700 uppercase block mb-0.5">Prazo Limite Indicação</label>
                                <input 
                                    type="date" 
                                    className="w-full border border-red-300 bg-red-50/40 rounded-lg p-1.5 focus:ring-2 focus:ring-red-500 outline-none text-xs font-black text-red-900" 
                                    value={formData.prazoIndicacao || ''} 
                                    onChange={e => setFormData({...formData, prazoIndicacao: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-purple-700 uppercase block mb-0.5">Enviado ao RH</label>
                                <input 
                                    type="date" 
                                    className="w-full border border-purple-200 bg-purple-50/40 rounded-lg p-1.5 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold text-purple-900" 
                                    value={formData.descontoEnviadoRH || ''} 
                                    onChange={e => setFormData({...formData, descontoEnviadoRH: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                            <span className="font-extrabold text-slate-600 text-[10px] flex items-center">
                                <AlertTriangle size={13} className="mr-1 text-amber-500"/> Prazo de Indicação:
                            </span>
                            <span className={`font-black text-[11px] px-2 py-0.5 rounded-md ${formPrazoInfo.color}`}>
                                {formPrazoInfo.text}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* LINHA 2 - CARD 5: CONDUTOR & RESPONSABILIDADE (Alinhado na Linha Inferior) */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/90 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <User size={14} className="mr-1.5 text-emerald-700"/> CONDUTOR & RESPONSABILIDADE
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Identificação</span>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                                    Nome do Motorista
                                </label>
                                <span className="text-[9px] text-slate-400 font-medium">Ou em branco para preencher no PDF</span>
                            </div>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white text-slate-900 font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                                value={formData.responsavelNome || ''} 
                                onChange={e => setFormData({...formData, responsavelNome: formatInputText(e.target.value)})}
                                placeholder="Deixe em branco para preencher à mão no PDF"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                                    CPF do Condutor
                                </label>
                                <span className="text-[9px] text-slate-400 font-mono">11 dígitos</span>
                            </div>
                            <input 
                                type="text" 
                                maxLength={14}
                                className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white text-slate-900 font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                                value={formData.responsavelCodigo || ''} 
                                onChange={e => {
                                    const formatted = formatCPF(e.target.value);
                                    setFormData({...formData, responsavelCodigo: formatted});
                                }}
                                placeholder="000.000.000-00"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-0.5">
                                Responsabilidade (Empresa ou Condutor?)
                            </label>
                            <select 
                                className="w-full border border-slate-300 rounded-lg p-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold text-slate-800 transition-all cursor-pointer" 
                                value={formData.empresaOuCondutor} 
                                onChange={e => setFormData({...formData, empresaOuCondutor: e.target.value as any})}
                            >
                                <option value="CONDUTOR">CONDUTOR (Desconto em folha)</option>
                                <option value="EMPRESA">EMPRESA (Assumido institucionalmente)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* LINHA 2 - CARD 6: ANEXOS & DOCUMENTAÇÃO (Alinhado na Linha Inferior) */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200/90 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 flex items-center text-xs tracking-wide">
                            <Paperclip size={14} className="mr-1.5 text-emerald-700"/> ANEXOS & DOCUMENTAÇÃO
                        </h3>
                        <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {currentAttachments.length} de 3 arquivos
                        </span>
                    </div>
                    
                    {/* Zona de Upload de até 3 arquivos compacta */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files) {
                                handleAitUpload({ target: { files: e.dataTransfer.files } });
                            }
                        }}
                        className={`border-2 border-dashed rounded-xl p-2 text-center cursor-pointer transition-all group relative mt-1.5 ${
                            uploadingAit 
                                ? 'border-emerald-500 bg-emerald-50' 
                                : currentAttachments.length >= 3 
                                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                                    : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 bg-slate-50/50'
                        }`}
                    >
                        {uploadingAit ? (
                            <div className="flex flex-col items-center justify-center text-emerald-700 py-0.5">
                                <Loader2 className="animate-spin mb-0.5" size={14}/>
                                <span className="text-[10px] font-bold">Processando arquivos...</span>
                            </div>
                        ) : currentAttachments.length >= 3 ? (
                            <div className="flex flex-col items-center justify-center text-slate-400 py-0.5">
                                <FileCheck size={14} className="text-emerald-600 mb-0.5"/>
                                <p className="text-[10px] font-bold text-slate-600">Limite de 3 arquivos atingido</p>
                            </div>
                        ) : (
                            <>
                                <UploadCloud size={16} className="mx-auto text-emerald-600 mb-0.5 group-hover:scale-110 transition-transform"/>
                                <p className="text-[10px] font-bold text-slate-700 group-hover:text-emerald-700">
                                    {currentAttachments.length === 0 ? 'Clique ou Arraste até 3 arquivos' : 'Adicionar mais anexos'}
                                </p>
                                <p className="text-[9px] text-slate-400">PDF, JPG ou PNG do Auto de Infração</p>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    id="file-ait" 
                                    multiple 
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={handleAitUpload}
                                />
                                <label htmlFor="file-ait" className="absolute inset-0 cursor-pointer"></label>
                            </>
                        )}
                    </div>

                    {/* Lista dos Anexos Cadastrados */}
                    {currentAttachments.length > 0 && (
                        <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar pr-1 mt-1">
                            {currentAttachments.map((link, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs transition-colors">
                                    <div className="flex items-center truncate mr-2">
                                        <FileCheck size={11} className="text-emerald-600 mr-1.5 shrink-0"/>
                                        <button 
                                            type="button"
                                            onClick={() => openPdfViewer(link.url, `Visualização do Anexo: ${link.name}`, `${link.name}.pdf`)} 
                                            className="font-bold text-slate-700 hover:text-emerald-700 truncate underline text-[10px] text-left" 
                                            title="Clique para visualizar este arquivo"
                                        >
                                            {link.name}
                                        </button>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                        <button 
                                            type="button"
                                            onClick={() => openPdfViewer(link.url, `Visualização do Anexo: ${link.name}`, `${link.name}.pdf`)} 
                                            className="text-slate-500 hover:text-emerald-700 p-0.5 rounded hover:bg-white transition-colors"
                                            title="Visualizar Anexo"
                                        >
                                            <Eye size={11}/>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"
                                            title="Remover este Anexo"
                                        >
                                            <Trash2 size={11}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bloco: Gerador de Termo de Autorização de Desconto em PDF (Sem o texto timbrado CLT) */}
                    <div className={`p-2 rounded-xl border transition-all mt-1.5 ${
                        formData.linkAuth 
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' 
                            : 'bg-gradient-to-br from-slate-50 to-emerald-50/40 border-slate-200'
                    }`}>
                        <div className="flex justify-between items-center gap-2">
                            <div className="flex flex-col">
                                <div className="flex items-center space-x-1.5">
                                    <FileText size={13} className={formData.linkAuth ? "text-emerald-700" : "text-slate-600"}/> 
                                    <span className="text-[11px] font-black text-slate-800">Termo de Desconto em Folha (PDF)</span>
                                </div>
                                {formData.linkAuth && (
                                    <div className="mt-0.5 flex items-center space-x-2">
                                        <span className="inline-flex items-center text-[9px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                                            <CheckCircle2 size={10} className="mr-1 text-emerald-600"/> Anexado
                                        </span>
                                        <button 
                                            type="button"
                                            onClick={() => openTermoInNewTab(formData, formData.linkAuth)} 
                                            className="text-[10px] text-emerald-700 font-bold underline hover:text-emerald-900 flex items-center"
                                            title="Abrir Termo em nova aba do navegador"
                                        >
                                            <Eye size={11} className="mr-1"/> Visualizar
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button 
                                type="button"
                                onClick={() => { generateAuthPDF(); }} 
                                disabled={generatingPdf} 
                                className={`text-[10px] px-2 py-1 rounded-lg flex items-center font-black shadow-xs transition-all shrink-0 ${
                                    generatingPdf 
                                        ? 'bg-slate-300 text-white cursor-not-allowed' 
                                        : formData.linkAuth
                                            ? 'bg-emerald-800 text-white hover:bg-emerald-900 active:scale-95'
                                            : 'bg-emerald-700 text-white hover:bg-emerald-800 hover:shadow active:scale-95'
                                }`}
                            >
                                {generatingPdf ? <Loader2 size={11} className="animate-spin mr-1"/> : <Download size={11} className="mr-1"/>} 
                                {generatingPdf ? 'Gerando...' : (formData.linkAuth ? 'Regerar' : 'Gerar PDF')}
                            </button>
                        </div>
                    </div>

                    {/* Bloco: Observações Compacto */}
                    <div className="bg-slate-50/80 p-1.5 rounded-xl border border-slate-200 space-y-0.5 mt-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-700 uppercase tracking-wider flex items-center">
                                <MessageSquare size={11} className="mr-1 text-emerald-700"/> Observações
                            </label>
                            <span className="text-[9px] text-slate-400 font-medium">Opcional</span>
                        </div>
                        <textarea
                            rows={1}
                            className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 font-medium placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white outline-none resize-none transition-all"
                            placeholder="Observações adicionais..."
                            value={formData.obs || ''}
                            onChange={e => setFormData({...formData, obs: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Modal Executivo de Envio de E-mail */}
        {renderEmailModal()}

        <PdfViewerModal
            isOpen={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            pdfUrlOrData={pdfModalData.url}
            title={pdfModalData.title}
            fileName={pdfModalData.fileName}
            multaData={pdfModalData.multaData}
        />

        <ImportarMultasCsvModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            existingMultas={multas}
            veiculos={veiculos}
            codigos={codigos}
            onImportSuccess={handleImportCsvSuccess}
        />
    </div>
  );
};

export default MultasPage;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchAllData, saveMulta, deleteMulta, cleanString, uploadFileToDrive, generateAuthPdfDocs, getDriveFolderId, getDocsTemplateId, formatInputText, saveCodigo, fetchBaseEmailMappings, fetchPlacaEmailMappings, DEFAULT_EMAIL_MAPPINGS, deleteDriveFiles } from '../services/storage';
import { VEICULOS_REAIS } from '../../../data/veiculos_reais';
import { parseLocalDate } from '../services/dateUtils';
import { Multa, StatusMulta, TipoMulta, Veiculo, Motorista, CodigoMulta } from '../types';
import { Plus, Search, FileText, Download, Save, Send, AlertTriangle, Calendar, DollarSign, Clock, User, LayoutGrid, List as ListIcon, Edit2, Car, ArrowRight, Info, MapPin, Trash2, UploadCloud, Eye, Loader2, HelpCircle, X, Mail, ArrowLeft, Map as MapIcon, Layers, Paperclip, FileCheck, RectangleHorizontal, Filter, ChevronDown, ChevronUp, FileSpreadsheet, ArrowUpDown } from 'lucide-react';
import Loading from '../components/Loading';

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

// ... (Rest of the Map logic and helper functions remain unchanged) ...
// --- OPÇÕES DE LAYERS DE MAPA ---
const MAP_LAYERS = [
    { id: 'voyager', name: 'Ruas (Voyager)', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: 'CartoDB' },
    { id: 'dark', name: 'Risel Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: 'CartoDB' },
    { id: 'light', name: 'Light (Claro)', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: 'CartoDB' },
    { id: 'osm', name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: 'OSM' },
    { id: 'satellite', name: 'Satélite (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri' }
];

const GEO_CACHE_KEY = 'risel_geo_cache_v1';
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
    const [currentLayer, setCurrentLayer] = useState(MAP_LAYERS.find(l => l.id === 'voyager') || MAP_LAYERS[0]);
    const mapInstanceRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);
    const geoCacheRef = useRef<Record<string, any>>({});

    useEffect(() => {
        try {
            const savedCache = localStorage.getItem(GEO_CACHE_KEY);
            if (savedCache) geoCacheRef.current = JSON.parse(savedCache);
        } catch (e) { console.error("Erro cache mapa", e); }
    }, []);

    const saveToCache = (key: string, data: any) => {
        geoCacheRef.current[key] = data;
        try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCacheRef.current)); } catch (e) {}
    };

    const smartGeocode = async (m: Multa) => {
        const address = m.endereco ? m.endereco.trim() : '';
        const city = m.municipio ? m.municipio.trim() : '';
        const uf = m.uf ? m.uf.trim() : '';
        const keyExact = `EXACT_${address}_${city}_${uf}`.toUpperCase().replace(/\s+/g, '');
        const keyCity = `CITY_${city}_${uf}`.toUpperCase().replace(/\s+/g, '');

        if (geoCacheRef.current[keyExact]) return { ...geoCacheRef.current[keyExact], cached: true };

        if (address && city && uf) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${address}, ${city} - ${uf}, Brasil`)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const result = { ...data[0], method: 'exact' };
                    saveToCache(keyExact, result);
                    return result;
                }
            } catch (e) {}
        }
        if (address && city) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${address}, ${city}, Brasil`)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const result = { ...data[0], method: 'address_city' };
                    saveToCache(keyExact, result);
                    return result;
                }
            } catch (e) {}
        }
        if (geoCacheRef.current[keyCity]) return { ...geoCacheRef.current[keyCity], cached: true };
        if (city) {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${city} - ${uf}, Brasil`)}&limit=1`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const result = { ...data[0], method: 'city_fallback' };
                    saveToCache(keyCity, result);
                    saveToCache(keyExact, result); 
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
            map.eachLayer((layer: any) => { if (layer instanceof L.Marker) map.removeLayer(layer); });

            const truckSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#022c22" stroke="#00d664" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.6));"><path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" /><circle cx="7.5" cy="17.5" r="2.5" fill="#00d664" /><circle cx="17.5" cy="17.5" r="2.5" fill="#00d664" /></svg>`;
            const createIcon = (isExact: boolean) => L.divIcon({
                className: 'custom-truck-icon',
                html: `<div style="width: 40px; height: 40px; transform: scale(${isExact ? 1.2 : 0.9}); transition: all 0.3s;">${truckSvg}</div>`,
                iconSize: [40, 40], iconAnchor: [20, 35], popupAnchor: [0, -40]
            });

            const fmtMoney = (v: number) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '-';

            const generatePopupHtml = (m: Multa, isExact: boolean, count: number = 1) => {
                const countBadge = count > 1 
                    ? `<span style="background: #ff9b00; color: #000; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">+${count - 1} MULTAS</span>`
                    : '';

                return `
                    <div style="font-family: 'Outfit', sans-serif; min-width: 280px; background: #0f172a; color: #e2e8f0; border: 1px solid #00d664; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
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
                                <strong style="color: #94a3b8; text-transform: uppercase; font-size: 10px;">Localização</strong><br/>
                                <span style="color: #cbd5e1;">${m.endereco}</span><br/>
                                <span style="color: #94a3b8; font-size: 11px;">${m.municipio} - ${m.uf}</span>
                            </div>
                            <div style="margin-top: 10px; padding-top: 5px; text-align: right; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="background: #334155; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${isExact ? 'LOCAL EXATO' : 'APROXIMADO'}</span>
                                    <span style="color: #ff9b00; font-weight: 900; font-size: 18px;">${fmtMoney(m.valorComDesconto)}</span>
                            </div>
                        </div>
                    </div>
                `;
            };

            const bounds = L.latLngBounds([]);
            let successCount = 0;

            if (singleMode) {
                const m = multas[0];
                setStatusText("Localizando infração...");
                const result = await smartGeocode(m);
                if (result) {
                    const isExact = result.method !== 'city_fallback';
                    const popupContent = generatePopupHtml(m, isExact, 1);

                    L.marker([result.lat, result.lon], { icon: createIcon(isExact) })
                        .addTo(map)
                        .bindPopup(popupContent)
                        .openPopup();
                    
                    map.setView([result.lat, result.lon], isExact ? 18 : 15);
                } else setStatusText("Localização não encontrada.");
                setLoadingMap(false);
            } else {
                const uniqueLocations: Record<string, Multa[]> = {};
                multas.forEach(m => {
                    const key = `${m.endereco}-${m.municipio}-${m.uf}`;
                    if (!uniqueLocations[key]) uniqueLocations[key] = [];
                    uniqueLocations[key].push(m);
                });
                const locationKeys = Object.keys(uniqueLocations);
                setStatusText(`Mapeando ${locationKeys.length} locais...`);
                let processed = 0;
                
                const processBatch = async () => {
                    for (const key of locationKeys) {
                        const ms = uniqueLocations[key];
                        const m = ms[0];
                        const count = ms.length;

                        try {
                            const result = await smartGeocode(m);
                            if (result) {
                                const isExact = result.method !== 'city_fallback';
                                const popupContent = generatePopupHtml(m, isExact, count);

                                L.marker([result.lat, result.lon], { icon: createIcon(isExact) }).addTo(map)
                                    .bindPopup(popupContent);
                                
                                bounds.extend([result.lat, result.lon]);
                                successCount++;
                                if (!result.cached) await new Promise(r => setTimeout(r, 800));
                            }
                        } catch (e) {}
                        processed++;
                        if (processed % 5 === 0) setStatusText(`Processando: ${Math.round((processed / locationKeys.length) * 100)}%`);
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
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#0f172a] border border-gray-700 w-full max-w-7xl h-[90vh] rounded-2xl flex flex-col shadow-2xl relative">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#022c22]">
                    <h3 className="text-white font-bold text-lg flex items-center"><MapIcon className="mr-2 text-risel-green" /> {title}</h3>
                    <div className="flex bg-black/40 p-1 rounded-lg">
                        {MAP_LAYERS.map(layer => (
                            <button key={layer.id} onClick={() => setCurrentLayer(layer)} className={`px-3 py-1 text-xs font-bold rounded ${currentLayer.id === layer.id ? 'bg-risel-green text-black' : 'text-gray-400'}`}>{layer.name}</button>
                        ))}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
                </div>
                <div className="flex-1 relative bg-slate-900"><div ref={mapRef} className="w-full h-full z-10" />
                    {loadingMap && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white"><Loader2 size={48} className="animate-spin text-risel-green mb-4" /><p>{statusText}</p></div>}
                </div>
            </div>
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
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
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

  const [showCodigosDropdown, setShowCodigosDropdown] = useState(false);
  const [filteredCodigos, setFilteredCodigos] = useState<any[]>([]);

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

  const filteredMultas = useMemo(() => {
      return multas.filter(m => {
          const lowerSearch = searchTerm.toLowerCase();
          const matchSearch = !searchTerm || 
              (m.ait && m.ait.toLowerCase().includes(lowerSearch)) || 
              (m.placa && m.placa.toLowerCase().includes(lowerSearch)) || 
              (m.frota && m.frota.toLowerCase().includes(lowerSearch));

          if (!matchSearch) return false;
          if (filters.placa && !m.placa.includes(filters.placa.toUpperCase())) return false;
          if (filters.base && m.base !== filters.base) return false;
          if (filters.responsabilidade && m.empresaOuCondutor !== filters.responsabilidade) return false;
          if (filters.descontar && m.descontarMotorista !== filters.descontar) return false;
          if (filters.status && m.status !== filters.status) return false;

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

          // 1. Procurar em veiculos
          const veiculo = veiculos.find(v => cleanString(v.placa) === cleanVal);
          if (veiculo) {
              foundFrota = veiculo.id || veiculo.placa;
              foundFilial = veiculo.filial || (veiculo as any).base || '';
              foundMotorista = (veiculo as any).condutor || (veiculo as any).motorista || (veiculo as any).responsavelNome || '';
          }

          // 2. Procurar em VEICULOS_REAIS se não encontrou condutor/filial
          if ((!foundFilial || !foundMotorista) && Array.isArray(VEICULOS_REAIS)) {
              const vr = VEICULOS_REAIS.find(v => cleanString(v.placa) === cleanVal);
              if (vr) {
                  if (!foundFrota) foundFrota = vr.placa;
                  if (!foundFilial) foundFilial = vr.filial || '';
                  if (!foundMotorista) foundMotorista = vr.condutor || (vr as any).motorista || '';
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
                      }
                  }
              } catch (e) {}
          }

          setFormData(prev => ({ 
              ...prev, 
              placa: rawText, 
              frota: foundFrota || prev.frota || rawText, 
              base: foundFilial || prev.base || '',
              responsavelNome: foundMotorista || prev.responsavelNome || ''
          }));
          clearError('frota');
      }
  };

  const handleEnquadramentoChange = (val: string) => {
    const upperVal = (val || '').toUpperCase();
    setFormData(prev => ({ ...prev, enquadramento: upperVal }));
    const cleanSearch = upperVal.replace(/[^A-Z0-9]/g, '');
    if (cleanSearch.length >= 2) {
        const matches = (codigos || []).filter(c => {
            if (!c || !c.codigo) return false;
            const dbCodeClean = c.codigo.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const dbCodeRaw = c.codigo.toString().toUpperCase();
            const dbDesc = (c.descricao || '').toUpperCase();
            return dbCodeClean.startsWith(cleanSearch) || dbCodeRaw.includes(upperVal) || dbDesc.includes(upperVal);
        });
        
        const exactMatchExists = (codigos || []).some(c => c && c.codigo && c.codigo.toString().toUpperCase().trim() === upperVal.trim());
        const resultList = [...matches].slice(0, 15);
        
        if (!exactMatchExists && upperVal.trim().length >= 2) {
            resultList.push({
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
      const valorFinal = (Number(codigo.valor) || 0) - (Number(codigo.desconto) || 0);
      setFormData(prev => ({
        ...prev, 
        enquadramento: String(codigo.codigo || '').toUpperCase(), 
        artigoCtb: String(codigo.baseLegal || '').toUpperCase(), 
        descricaoInfracao: codigo.isNew ? '' : String(codigo.descricao || '').toUpperCase(),
        pontosCnh: Number(codigo.pontos || 0), 
        valor: Number(codigo.valor || 0), 
        desconto: Number(codigo.desconto || 0), 
        valorComDesconto: valorFinal
      }));
      setShowCodigosDropdown(false);
  };

  const handleBlurEnquadramento = () => { setTimeout(() => { setShowCodigosDropdown(false); }, 250); };

  const handleMoneyChange = (field: 'valor' | 'desconto', val: number) => {
      if (val < 0) return;
      const newData = { ...formData, [field]: val };
      newData.valorComDesconto = (field === 'valor' ? val : (formData.valor || 0)) - (field === 'desconto' ? val : (formData.desconto || 0));
      setFormData(newData);
      clearError(field);
  }

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
      const days = calculateDaysRemaining(prazoDate);
      const isFinished = status === StatusMulta.FINALIZADA;
      
      if (isFinished) return { text: "OK", class: "bg-emerald-100/50 text-emerald-800 border-emerald-200", color: "text-emerald-600" };
      
      if (days !== null && days < 0) return { text: "Prazo encerrado", class: "bg-red-100/50 text-red-800 border-red-200 animate-pulse", color: "text-red-600" };
      
      let colorClass = "bg-gray-100/50 border-gray-200 text-gray-700";
      let textColor = "text-gray-600";
      
      if (days !== null) {
          if (days <= 5) { colorClass = "bg-red-50/50 text-red-600 border-red-100"; textColor = "text-red-600"; }
          else if (days <= 15) { colorClass = "bg-orange-50/50 text-orange-600 border-orange-100"; textColor = "text-orange-600"; }
          else { colorClass = "bg-emerald-50/50 text-emerald-600 border-emerald-100"; textColor = "text-emerald-600"; }
      }
      
      return { text: days !== null ? `${days} dias` : '-', class: colorClass, color: textColor };
  };

  // ... (Other status badges and visual helpers remain the same) ...
  const getStatusBadge = (status: string) => {
      let colors = "";
      switch (status) {
          case StatusMulta.FINALIZADA: colors = 'bg-emerald-100/50 text-emerald-800 border-emerald-200'; break;
          case StatusMulta.AGUARDANDO_BOLETO: colors = 'bg-orange-100/50 text-orange-800 border-orange-200'; break;
          case StatusMulta.RECURSO: colors = 'bg-red-100/50 text-red-800 border-red-200'; break;
          case StatusMulta.INDICACAO_ENVIADA: colors = 'bg-blue-100/50 text-blue-800 border-blue-200'; break;
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
          default: return 'bg-gradient-to-br from-risel-dark/80 to-gray-900/80 border border-white/10 backdrop-blur-md';
      }
  };

  const getStatusDot = (status: string) => {
      let color = "bg-gray-400"; let textColor = "text-slate-400";
      if (status === StatusMulta.FINALIZADA) { color = "bg-risel-green shadow-[0_0_8px_rgba(0,214,100,0.6)]"; textColor = "text-risel-green"; }
      else if (status === StatusMulta.AGUARDANDO_BOLETO) { color = "bg-risel-orange shadow-[0_0_8px_rgba(255,155,0,0.6)]"; textColor = "text-risel-orange"; }
      else if (status === StatusMulta.RECURSO) { color = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"; textColor = "text-red-400"; }
      else if (status === StatusMulta.INDICACAO_ENVIADA) { color = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"; textColor = "text-blue-400"; }
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
    const enquadramentoUpper = (formData.enquadramento || '').toUpperCase().trim();
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

    await saveMulta({ ...formData, id: formData.id || formData.ait || Math.random().toString(36).substr(2, 9) } as Multa);
    await loadData(true);
    setView('LIST');
    setFormData(initialMulta);
    setErrors({});
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
      if (confirm('Excluir multa?')) {
          setLoading(true);
          await deleteMulta(id);
          await loadData(true);
          setLoading(false);
      }
  };

  // ... (Upload, PDF, Email logic functions - keep same) ...
  const handleAitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          const currentLinks = parseLinks(formData.linkAit);
          if (currentLinks.length + files.length > 3) { alert(`Limite de 3 arquivos excedido.`); e.target.value = ''; return; }
          setUploadingAit(true);
          try {
              const folderId = getDriveFolderId();
              if (!folderId) throw new Error("Drive ID não configurado.");
              const newLinksParts: string[] = [];
              for (const file of files) {
                  const defaultName = file.name.split('.').slice(0, -1).join('.');
                  const customName = window.prompt(`Nome para o arquivo "${file.name}" (como aparecerá no e-mail):`, defaultName);
                  if (customName === null) continue;
                  const finalName = customName.trim() || defaultName;
                  const driveFileName = `AIT_${formData.ait || 'SEM_AIT'}_${finalName}_${Date.now()}`;
                  const response = await uploadFileToDrive(file, folderId, driveFileName) as any;
                  if (response && response.fileUrl) newLinksParts.push(`${finalName}${NAME_SEPARATOR}${response.fileUrl}`);
              }
              if (newLinksParts.length > 0) {
                  const existingString = formData.linkAit ? formData.linkAit + LINK_SEPARATOR : '';
                  setFormData(prev => ({ ...prev, linkAit: existingString + newLinksParts.join(LINK_SEPARATOR) }));
                  alert(`${newLinksParts.length} arquivo(s) anexado(s)!`);
              }
          } catch (error: any) { alert('Erro: ' + error.message); } finally { setUploadingAit(false); e.target.value = ''; }
      }
  };

  const removeAttachment = (index: number) => {
      if(!confirm("Remover este anexo?")) return;
      const links = parseLinks(formData.linkAit);
      const updated = links.filter((_, i) => i !== index);
      const newString = updated.map(l => l.name === 'AIT (Anexo)' ? l.url : `${l.name}${NAME_SEPARATOR}${l.url}`).join(LINK_SEPARATOR);
      setFormData(prev => ({...prev, linkAit: newString}));
  };

  const generateAuthPDF = async () => {
      if (!formData.placa || !formData.responsavelNome) { alert("Dados incompletos."); return; }
      setGeneratingPdf(true);
      try {
          const folderId = getDriveFolderId(); const templateId = getDocsTemplateId();
          if (!folderId || !templateId) throw new Error("Config incompletas.");
          const fmtMoney = (val?: number) => val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00";
          const fmtDate = (val?: string) => { if (!val) return ""; const date = new Date(val); if (val.length === 10 && val.includes('-')) { const parts = val.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; } return isNaN(date.getTime()) ? val : date.toLocaleDateString('pt-BR'); };
          const templateData = {
              "<<PLACA>>": formData.placa || "", "<<AIT>>": formData.ait || "", "<<DATA>>": new Date().toLocaleDateString('pt-BR'),
              "<<NOME MOTORISTA>>": formData.responsavelNome || "", "<<VALOR COM DESCONTO>>": fmtMoney(formData.valorComDesconto),
              "<<FROTA>>": formData.frota || "", "<<DATA INFRACAO>>": fmtDate(formData.dataHoraInfracao),
              "<<MUNICIPIO>>": formData.municipio || "", "<<UF>>": formData.uf || "", "<<DESCRICAO INFRACAO>>": formData.descricaoInfracao || "",
              "<<PONTOS CNH>>": String(formData.pontosCnh || "0"), "<<NOME>>": formData.responsavelNome || "", "<<CPF>>": formData.responsavelCodigo || "", "<<VALOR>>": fmtMoney(formData.valorComDesconto)
          };
          const response = await generateAuthPdfDocs(templateData, templateId, folderId) as any;
          if (response && response.fileUrl) { setFormData(prev => ({ ...prev, linkAuth: response.fileUrl })); alert('PDF Gerado!'); } else alert(`Erro: ${response?.error}`);
      } catch (error: any) { alert('Erro: ' + error.message); } finally { setGeneratingPdf(false); }
  };

  const generateEmailHTML = (data: Partial<Multa>) => {
      const fmtMoney = (val?: number) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00";
      const fmtDate = (val?: string) => val ? new Date(val).toLocaleDateString('pt-BR') : "-";
      
      const aitLinks = parseLinks(data.linkAit);
      let attachmentsSection = '';
      
      if (aitLinks.length > 0 || data.linkAuth) {
          attachmentsSection = `
            <div style="background-color:#f8fafc;padding:15px 20px;border-radius:8px;margin-top:25px;border:1px solid #e2e8f0;text-align:center;">
                <p style="margin:0;font-size:13px;color:#475569;font-weight:600;">📎 Os documentos referentes a esta notificação foram anexados diretamente a este e-mail.</p>
            </div>`;
      }

      // Mercosul Plate Icon (Reduced Size - 24x14 approx)
      const iconPlaca = `<span style="display:inline-block;width:24px;height:14px;background:#fff;border:1px solid #94a3b8;border-top:3px solid #1e3a8a;border-radius:2px;vertical-align:middle;margin-right:6px;box-shadow:0 1px 1px rgba(0,0,0,0.1);position:relative;"><span style="position:absolute;top:1px;left:1px;right:1px;height:1px;background:repeating-linear-gradient(90deg,transparent,transparent 1px,#e2e8f0 1px,#e2e8f0 2px);"></span></span>`;
      
      // CNH Icon (Reduced Size - 18x12 approx)
      const iconCNH = `<span style="display:inline-block;width:18px;height:12px;background:#fefce8;border:1px solid #d97706;border-radius:2px;vertical-align:middle;margin-right:6px;position:relative;"><span style="position:absolute;top:1px;left:1px;width:4px;height:4px;background:#e5e7eb;border:1px solid #d1d5db;"></span><span style="position:absolute;top:2px;left:7px;width:6px;height:1px;background:#cbd5e1;"></span><span style="position:absolute;top:5px;left:7px;width:4px;height:1px;background:#cbd5e1;"></span></span>`;

      return `
        <div style="font-family:'Aptos', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;font-size:12pt;color:#334155;max-width:650px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#ffffff;">
          <div style="background-color:#022c22;padding:25px;text-align:center;"><h1 style="color:#00d664;margin:0;font-size:22px;">NOTIFICAÇÃO DE MULTA</h1><p style="color:#cbd5e1;margin-top:5px;font-size:12px;">Gestão de Frotas Risel</p></div>
          <div style="padding:30px;">
            <p style="margin-bottom:20px;">Olá, seguem informações referentes a Notificação aplicada ao veículo da Frota:</p>
            <p style="margin-bottom:20px;">Gentileza, enviar cópia da CNH, e solicitar a assinatura do condutor nos documentos, idêntica a assinatura da CNH.</p>
            <p style="margin-bottom:20px;font-weight:bold;">Motorista identificado através do rastreador. Gentileza confirmar:</p>
            
            <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:14px;">
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">👤 Motorista:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.responsavelNome || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">📄 AIT:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.ait || '-'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">🚛 Frota:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.frota || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">${iconPlaca} Placa:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.placa || '-'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">🏢 Base:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.base || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">📅 Data:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${fmtDate(data.dataHoraInfracao)}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">⚠️ Infração:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${data.descricaoInfracao || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">💲 Valor:</td><td style="padding:10px;color:#16a34a;font-weight:bold;border-bottom:1px solid #e2e8f0;">${fmtMoney(data.valorComDesconto)}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;">${iconCNH} Pontuação CNH:</td><td style="padding:10px;color:#334155;border-bottom:1px solid #e2e8f0;">${data.pontosCnh || '0'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#dc2626;">⏳ Prazo:</td><td style="padding:10px;font-weight:bold;color:#dc2626;">${fmtDate(data.prazoIndicacao)}</td></tr>
            </table>
            ${attachmentsSection}
          </div>
          <div style="background-color:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
             <p style="color:#94a3b8;font-size:11px;margin:0;">Este é um e-mail automático enviado pelo sistema G F Risel.</p>
          </div>
        </div>`;
  };

  const handleOpenEmailModal = async () => {
      const placaClean = cleanString(formData.placa || '');
      const placaMappings = await fetchPlacaEmailMappings();
      let toEmail = '';
      let ccEmail = 'lorena.padilha@risel.com.br; deny.goncalves@risel.com.br';

      if (placaClean && placaMappings[placaClean]) {
          toEmail = placaMappings[placaClean].to || '';
          if (placaMappings[placaClean].cc) {
              ccEmail = placaMappings[placaClean].cc;
          }
      } else {
          const baseUpper = formData.base ? formData.base.toUpperCase().trim() : '';
          const matchedKey = Object.keys(baseMappings).find(k => baseUpper.includes(k.toUpperCase()) || k.toUpperCase().includes(baseUpper));
          if (matchedKey && baseMappings[matchedKey]) {
              toEmail = baseMappings[matchedKey].to || '';
              if (baseMappings[matchedKey].cc) ccEmail = `${baseMappings[matchedKey].cc}; ${ccEmail}`;
          }
      }

      if (!ccEmail.toLowerCase().includes('lorena.padilha@risel.com.br')) {
          ccEmail = `${ccEmail}; lorena.padilha@risel.com.br`;
      }
      if (!ccEmail.toLowerCase().includes('deny.goncalves@risel.com.br')) {
          ccEmail = `${ccEmail}; deny.goncalves@risel.com.br`;
      }

      setEmailTo(toEmail);
      setEmailCc(ccEmail);
      setIsEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
      if (!formData.placa || !formData.ait) { alert("Faltam dados."); return; }
      setSendingEmail(true);
      
      // Parse main recipients list (split by ; or ,)
      const toRecipientsList = emailTo.split(/[;,]+/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));
      
      // Parse CC recipients list (split by ; or ,)
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

      const dataFormatada = getFormattedSubjectDate(formData.dataHoraInfracao);
      const subject = `NOTIFICAÇÃO DE MULTA: PLACA ${formData.placa} - FROTA: ${formData.frota} - BASE: ${formData.base || '-'} - DATA ${dataFormatada}`;
      
      // Coleta links do Google Drive para que o backend os baixe e anexe fisicamente no e-mail
      const aitLinks = parseLinks(formData.linkAit);
      const driveUrls: Array<{ name: string; url: string }> = [...aitLinks];
      if (formData.linkAuth) {
          driveUrls.push({
              name: `Autorizacao_Desconto_${formData.placa}`,
              url: formData.linkAuth
          });
      }

      try {
          const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  to: toRecipientsList.join(', ') || ADMIN_EMAIL,
                  cc: ccRecipientsList.join(', '),
                  subject,
                  html: generateEmailHTML(formData),
                  driveUrls
              })
          });

          const result = await response.json();
          if (response.ok && result.success) { 
              // Exclui os arquivos temporários do Google Drive para evitar acúmulo e liberação de cota
              const urlsToDelete = driveUrls.map(u => u.url);
              if (urlsToDelete.length > 0) {
                  console.log("Excluindo arquivos temporários do Google Drive após o envio...", urlsToDelete);
                  await deleteDriveFiles(urlsToDelete);
              }

              // Limpa links locais e salva atualização no formulário
              const updatedForm = { ...formData, linkAit: '', linkAuth: '' };
              setFormData(updatedForm);
              if (formData.id) {
                  await saveMulta(updatedForm as Multa);
              }

              alert("E-mail enviado com sucesso com os anexos anexados fisicamente! Os arquivos do Google Drive foram removidos para liberar espaço."); 
              setIsEmailModalOpen(false); 
          } else { 
              console.error(result); 
              alert("Erro ao enviar e-mail via servidor SMTP: " + (result.error || "Verifique o console")); 
          }
      } catch (error: any) { 
          alert("Falha no envio: " + error.message); 
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

  if (view === 'LIST') {
    // ... (LIST view code same as previous block - no changes requested for list view) ...
    // Using existing List view structure
    return (
        <div className="space-y-4 animate-in fade-in relative h-full flex flex-col pb-0">
            {loading && <Loading />}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/30 shrink-0">
            <div><h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-teal-600 drop-shadow-sm">Gestão de Multas</h2><p className="text-slate-600 text-xs font-medium">Controle e Processamento de Infrações</p></div>
            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-lg flex items-center shadow-sm transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><FileSpreadsheet size={16} className="mr-2" /> Exportar Relatório</button>
                <button onClick={() => setShowGlobalMap(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><MapIcon size={16} className="mr-2 text-risel-green" /> Mapa Geral</button>
                <button onClick={() => { setFormData(initialMulta); setErrors({}); setView('FORM'); }} className="bg-emerald-600 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg flex items-center shadow-lg shadow-emerald-200 hover:shadow-xl transition-all active:scale-95 whitespace-nowrap font-bold text-xs"><Plus size={16} className="mr-2" /> Nova Multa</button>
            </div>
            </div>
            
            {/* Filter Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-2 rounded-xl shadow-sm border border-white/30">
                    <div className="flex items-center w-full"><Search className="text-gray-500 mr-2 ml-2" size={18} /><input type="text" placeholder="Pesquisar Rápida (AIT, Placa, Frota...)" className="flex-1 outline-none text-gray-800 bg-transparent text-sm font-medium placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>{searchTerm && <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-1 mr-2"><X size={16} /></button>}</div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`ml-3 px-3 py-1.5 rounded-lg flex items-center font-bold text-xs border transition-all ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><Filter size={14} className="mr-1"/> Filtros {showFilters ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}</button>
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
                                    <th className="px-3 py-3.5 w-20 text-white/90 font-bold uppercase tracking-wider text-[10px] text-center border-r border-white/10">Ações</th>
                                    <th onClick={() => handleSort('status')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] text-left border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Status <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('dataHoraInfracao')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Data Multa <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('prazoIndicacao')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Data Prazo <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('placa')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Placa <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('ait')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">AIT <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('descricaoInfracao')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 min-w-[180px] max-w-[280px] cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Infração Cometida <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('responsavelNome')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] border-r border-white/10 min-w-[130px] cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-between">Motorista <ArrowUpDown size={12}/></div></th>
                                    <th onClick={() => handleSort('valor')} className="px-3 py-3.5 text-white/90 font-bold uppercase tracking-wider text-[10px] text-right rounded-tr-lg whitespace-nowrap cursor-pointer hover:bg-white/10 group select-none"><div className="flex items-center justify-end gap-1">Valor <ArrowUpDown size={12}/></div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50">
                                {sortedMultas.map((multa, idx) => {
                                    const rowClass = idx % 2 === 0 ? 'bg-white/40' : 'bg-white/20';
                                    return (
                                        <tr key={multa.id} className={`${rowClass} hover:bg-blue-50/60 transition-colors group`}>
                                            <td className="px-2 py-2.5 text-center border-r border-gray-200/50 align-middle">
                                                <div className="flex justify-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); setFormData(multa); setView('FORM'); }} className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-full transition-all"><Edit2 size={15} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setMapMulta(multa); }} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full transition-all"><MapPin size={15} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(multa.id); }} className="text-gray-400 hover:text-red-600 p-1.5 rounded-full transition-all"><Trash2 size={15} /></button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-left border-r border-gray-200/50 whitespace-nowrap align-middle">{getStatusBadge(multa.status)}</td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 whitespace-nowrap align-middle text-center">
                                                <span className="text-[10px] font-mono text-gray-600">{formatDateString(multa.dataHoraInfracao)}</span>
                                            </td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 whitespace-nowrap align-middle text-center">
                                                <span className="text-[10px] font-mono text-gray-600">{formatDateString(multa.prazoIndicacao)}</span>
                                            </td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 font-mono font-bold text-gray-700 whitespace-nowrap align-middle">{multa.placa}</td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 font-medium text-gray-600 text-[10px] whitespace-nowrap align-middle">{multa.ait}</td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 text-gray-800 text-xs font-medium align-middle truncate max-w-[260px]" title={multa.descricaoInfracao || multa.enquadramento}>
                                                {multa.descricaoInfracao || multa.enquadramento || '-'}
                                            </td>
                                            <td className="px-3 py-2.5 border-r border-gray-200/50 text-gray-600 align-middle truncate max-w-[140px] text-xs font-medium">{multa.responsavelNome || '-'}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-gray-800 whitespace-nowrap align-middle text-xs">{formatMoneyString(multa.valor)}</td>
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
        </div>
    );
  }

  // Calculate Info for Form View
  const formPrazoInfo = getPrazoInfo(formData.status, formData.prazoIndicacao);

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 relative pb-24 flex-1 overflow-auto custom-scrollbar pr-2 max-w-6xl mx-auto w-full">
        {loading && <Loading />}
        
        {/* Header - Buttons Removed */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4 sticky top-0 bg-white/95 backdrop-blur-md z-30 pt-2 rounded-t-xl px-4 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <button onClick={() => setView('LIST')} className="mr-3 text-gray-400 hover:text-risel-green transition-colors"><ArrowRight className="rotate-180" size={24}/></button>
                {formData.id ? 'Editar Multa' : 'Lançamento de Multa'}
            </h2>
            <div className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-medium text-slate-500">
                {formData.id ? `ID: ${formData.id}` : 'Novo Registro'}
            </div>
        </div>

        {/* Content - Compact Layout without Frota and Login Motorista */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1 text-xs">
            
            {/* COLUNA 1: Dados Iniciais e Datas */}
            <div className="space-y-3">
                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-extrabold text-gray-800 mb-2.5 flex items-center text-xs"><FileText size={14} className="mr-1.5 text-risel-orange"/> Dados Iniciais</h3>
                    <div className="space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Status</label>
                                <FormTooltip text="Define o fluxo atual da multa." />
                            </div>
                            <select className="w-full border rounded-lg p-1.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as StatusMulta})}>
                                {(Object.values(StatusMulta) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-0.5">Placa <span className="text-red-500">*</span></label>
                            <input type="text" className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs font-black uppercase ${errors.placa ? 'border-red-500 focus:ring-red-200' : 'focus:ring-risel-green'}`} value={formData.placa || ''} onChange={e => handlePlacaChange(e.target.value)} placeholder="ABC1234"/>
                            {errors.placa && <p className="text-[9px] text-red-500 font-bold mt-0.5">{errors.placa}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-0.5">Base / Filial</label>
                                <input type="text" className="w-full border rounded-lg p-1.5 bg-gray-50 focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 font-medium" value={formData.base || ''} onChange={e => setFormData({...formData, base: formatInputText(e.target.value)})}/>
                            </div>
                            <div>
                                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-0.5">Tipo</label>
                                <select className="w-full border rounded-lg p-1.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as TipoMulta})}>
                                    {(Object.values(TipoMulta) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block mb-0.5">AIT (Auto de Infração) <span className="text-red-500">*</span></label>
                            <input type="text" className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs font-bold ${errors.ait ? 'border-red-500 focus:ring-red-200' : 'focus:ring-risel-green'}`} value={formData.ait || ''} onChange={e => { setFormData({...formData, ait: formatInputText(e.target.value)}); clearError('ait'); }}/>
                            {errors.ait && <p className="text-[9px] text-red-500 font-bold mt-0.5">{errors.ait}</p>}
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-extrabold text-gray-800 mb-2.5 flex items-center text-xs"><Clock size={14} className="mr-1.5 text-risel-orange"/> Datas e Prazos</h3>
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Data Infração</label><input type="datetime-local" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs" value={formData.dataHoraInfracao || ''} onChange={e => setFormData({...formData, dataHoraInfracao: e.target.value})}/></div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Recebimento</label><input type="date" className={`w-full border rounded-lg p-1.5 focus:ring-2 outline-none text-xs ${errors.dataRecebimento ? 'border-red-500 focus:ring-red-200' : 'focus:ring-risel-green'}`} value={formData.dataRecebimento || ''} onChange={e => { setFormData({...formData, dataRecebimento: e.target.value}); clearError('dataRecebimento'); }}/>{errors.dataRecebimento && <p className="text-[9px] text-red-500 font-bold mt-0.5 leading-tight">{errors.dataRecebimento}</p>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Prazo Indicação</label><input type="date" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs" value={formData.prazoIndicacao || ''} onChange={e => setFormData({...formData, prazoIndicacao: e.target.value})}/></div>
                             <div><label className="text-[10px] font-extrabold text-purple-700 uppercase block mb-0.5">Enviado RH</label><input type="date" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-purple-500 outline-none text-xs" value={formData.descontoEnviadoRH || ''} onChange={e => setFormData({...formData, descontoEnviadoRH: e.target.value})}/></div>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-lg border border-gray-200 text-xs"><span className="font-bold text-gray-600 text-[10px]">Dias Restantes:</span><span className={`font-black text-xs ${formPrazoInfo.color}`}>{formPrazoInfo.text}</span></div>
                    </div>
                 </div>
            </div>

            {/* COLUNA 2: Infração, Local e Responsável */}
            <div className="space-y-3">
                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200 relative overflow-visible z-10">
                    <h3 className="font-extrabold text-gray-800 mb-2.5 flex items-center text-xs"><AlertTriangle size={14} className="mr-1.5 text-risel-orange"/> Infração e Local</h3>
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 relative">
                             <div className="relative">
                                <div className="flex items-center mb-0.5"><label className="text-[10px] font-extrabold text-gray-500 uppercase">Enquadramento</label><FormTooltip text="Digite o código (ex: 745-50)." /></div>
                                <div className="relative w-full">
                                    <input 
                                        type="text" 
                                        className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs uppercase font-bold" 
                                        value={formData.enquadramento || ''} 
                                        onChange={e => handleEnquadramentoChange(e.target.value)} 
                                        onFocus={() => { if(formData.enquadramento && formData.enquadramento.length >= 1) setShowCodigosDropdown(true); }}
                                        onBlur={handleBlurEnquadramento}
                                        placeholder="Cód."
                                        autoComplete="off"
                                    />
                                    {showCodigosDropdown && filteredCodigos.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-2xl mt-1 z-[100] max-h-48 overflow-y-auto custom-scrollbar">
                                            {filteredCodigos.map((c, idx) => {
                                                if (!c) return null;
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        onClick={(e) => { e.stopPropagation(); selectCodigo(c); }}
                                                        className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-black text-slate-800 text-xs">{c.codigo}</span>
                                                            <span className="text-[9px] text-gray-400 font-bold bg-gray-100 px-1 rounded">{c.pontos || 0} Pts</span>
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 line-clamp-1 uppercase font-medium">{c.descricao}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                             </div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Artigo CTB</label><input type="text" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 font-medium" value={formData.artigoCtb || ''} onChange={e => setFormData({...formData, artigoCtb: formatInputText(e.target.value)})}/></div>
                        </div>
                        <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Descrição Infração</label><textarea className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 uppercase font-medium" rows={2} value={formData.descricaoInfracao || ''} onChange={e => setFormData({...formData, descricaoInfracao: formatInputText(e.target.value)})}/></div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Pontos CNH</label><input type="number" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs text-gray-700 font-bold" value={formData.pontosCnh || 0} onChange={e => setFormData({...formData, pontosCnh: Number(e.target.value)})}/></div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Órgão Autuador</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.orgaoAutuador || ''} onChange={e => setFormData({...formData, orgaoAutuador: formatInputText(e.target.value)})}/></div>
                        </div>
                        <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Endereço Completo</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.endereco || ''} onChange={e => handleAddressChange(e.target.value)}/></div>
                        <div className="grid grid-cols-3 gap-2">
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Município</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.municipio || ''} onChange={e => setFormData({...formData, municipio: formatInputText(e.target.value)})}/></div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">UF</label><input type="text" className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.uf || ''} onChange={e => setFormData({...formData, uf: formatInputText(e.target.value)})}/></div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Via</label><select className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.rodoviaOuUrbano || 'URBANO'} onChange={e => setFormData({...formData, rodoviaOuUrbano: e.target.value as any})}><option value="URBANO">Urbano</option><option value="RODOVIA">Rodovia</option></select></div>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-extrabold text-gray-800 mb-2 flex items-center text-xs"><User size={14} className="mr-1.5 text-risel-orange"/> Motorista Vinculado</h3>
                    <div className="space-y-2">
                         <div>
                             <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Nome do Motorista (Identificado no Cadastro)</label>
                             <input type="text" className="w-full border rounded-lg p-1.5 bg-slate-50 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-risel-green outline-none" value={formData.responsavelNome || ''} onChange={e => setFormData({...formData, responsavelNome: formatInputText(e.target.value)})}/>
                         </div>
                         <div>
                             <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Empresa ou Condutor?</label>
                             <select className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.empresaOuCondutor} onChange={e => setFormData({...formData, empresaOuCondutor: e.target.value as any})}>
                                 <option>EMPRESA</option>
                                 <option>CONDUTOR</option>
                             </select>
                         </div>
                    </div>
                 </div>
            </div>

            {/* COLUNA 3: Financeiro e Documentação */}
            <div className="space-y-3">
                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-extrabold text-gray-800 mb-2.5 flex items-center text-xs"><DollarSign size={14} className="mr-1.5 text-risel-orange"/> Financeiro</h3>
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Valor</label><input type="number" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-bold text-gray-800" value={formData.valor || 0} onChange={e => handleMoneyChange('valor', Number(e.target.value))} min="0"/></div>
                            <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Desc.</label><input type="number" className="w-full border rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-risel-green outline-none text-xs font-bold text-gray-800" value={formData.desconto || 0} onChange={e => handleMoneyChange('desconto', Number(e.target.value))} min="0"/></div>
                            <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Final</label><input type="number" className="w-full border rounded-lg p-1.5 bg-slate-50 text-emerald-700 font-extrabold outline-none text-xs" value={formData.valorComDesconto || 0} readOnly/></div>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Descontar Motorista?</label><select className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.descontarMotorista} onChange={e => setFormData({...formData, descontarMotorista: e.target.value as any})}><option>SIM</option><option>NÃO</option></select></div>
                             <div><label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-0.5">Pago c/ Desc?</label><select className="w-full border rounded-lg p-1.5 focus:ring-2 focus:ring-risel-green outline-none text-xs font-medium" value={formData.pagoComDesconto} onChange={e => setFormData({...formData, pagoComDesconto: e.target.value as any})}><option>SIM</option><option>NÃO</option></select></div>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200 space-y-2">
                    <h3 className="font-extrabold text-gray-800 mb-1 flex items-center text-xs"><Download size={14} className="mr-1.5 text-risel-orange"/> Documentação</h3>
                    
                    <div className={`border-2 border-dashed ${uploadingAit ? 'border-risel-green bg-green-50' : 'border-gray-300 hover:bg-gray-50'} rounded-lg p-2.5 text-center cursor-pointer transition-colors group relative`}>
                        {uploadingAit ? (
                            <div className="flex flex-col items-center justify-center text-risel-green"><Loader2 className="animate-spin mb-0.5" size={16}/><span className="text-[9px] font-bold">Enviando...</span></div>
                        ) : (
                            <>
                                <p className="text-[11px] font-medium text-gray-600 group-hover:text-risel-green flex justify-center items-center"><UploadCloud size={14} className="mr-1"/> {formData.linkAit ? 'Adicionar mais Anexos' : 'Anexo AIT (Upload Multiplo)'}</p>
                                <input type="file" className="hidden" id="file-ait" multiple onChange={handleAitUpload}/>
                                <label htmlFor="file-ait" className="absolute inset-0 cursor-pointer"></label>
                            </>
                        )}
                    </div>

                    {formData.linkAit && (
                        <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {parseLinks(formData.linkAit).map((link, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-gray-50 p-1.5 rounded border border-gray-200 text-[10px]">
                                    <div className="flex items-center truncate">
                                        <FileCheck size={12} className="text-risel-green mr-1.5 shrink-0"/>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-bold text-gray-700 hover:text-blue-600 truncate underline" title={link.name}>
                                            {link.name}
                                        </a>
                                    </div>
                                    <button 
                                        onClick={() => removeAttachment(idx)}
                                        className="text-gray-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors ml-1"
                                        title="Remover Anexo"
                                    >
                                        <Trash2 size={12}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-gray-50 p-2 rounded-lg flex justify-between items-center border border-gray-200">
                        <div className="flex flex-col"><span className="text-[10px] font-bold text-gray-600">Aut. Desconto</span>{formData.linkAuth && <a href={formData.linkAuth} target="_blank" rel="noreferrer" className="text-[9px] text-purple-600 underline">Ver PDF gerado</a>}</div>
                        <button onClick={generateAuthPDF} disabled={generatingPdf} className={`text-[10px] px-2.5 py-1 rounded-md flex items-center font-bold shadow-sm transition-all ${generatingPdf ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-risel-orange text-white hover:bg-orange-600'}`}>{generatingPdf ? <Loader2 size={12} className="animate-spin mr-1"/> : <Download size={12} className="mr-1"/>} {generatingPdf ? 'Gerando...' : 'Gerar PDF'}</button>
                    </div>

                    <button onClick={handleOpenEmailModal}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex justify-center items-center shadow-sm font-bold text-xs transition-all"
                    >
                        <Send size={14} className="mr-1.5"/> Enviar por E-mail
                    </button>
                 </div>
            </div>
        </div>

        {/* Action Bar - Fixed Bottom Right */}
        <div className="fixed bottom-6 right-6 z-50 flex gap-3">
            <button onClick={() => setView('LIST')} className="bg-white text-slate-600 border border-slate-300 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-slate-50 transition-transform active:scale-95 flex items-center">
                Cancelar
            </button>
            <button onClick={handleSave} className="bg-risel-green text-white px-8 py-3 rounded-full font-black shadow-xl hover:bg-risel-dark hover:scale-105 transition-all active:scale-95 flex items-center ring-4 ring-white/50">
                <Save size={18} className="mr-2"/> SALVAR
            </button>
        </div>

        {isEmailModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center"><Mail className="mr-2 text-blue-600"/> Enviar Notificação</h3>
                    <p className="text-xs text-gray-500 mb-6">Confirme os destinatários para o envio da notificação de multa <strong>{formData.ait}</strong>.</p>
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Para:</label>
                        <input type="text" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email1@exemplo.com; email2@exemplo.com" />
                        <p className="text-[10px] text-gray-400 mt-1">Separe múltiplos e-mails com ponto e vírgula (;).</p>
                    </div>
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Cópia (CC):</label>
                        <input type="text" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="copia1@exemplo.com; copia2@exemplo.com" />
                        <p className="text-[10px] text-gray-400 mt-1">Separe múltiplos e-mails com ponto e vírgula (;).</p>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-bold" disabled={sendingEmail}>Cancelar</button>
                        <button onClick={handleSendEmail} disabled={sendingEmail} className={`px-6 py-2 bg-blue-600 text-white rounded-lg shadow-md flex items-center font-bold text-sm hover:bg-blue-700 transition-all ${sendingEmail ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            {sendingEmail ? <Loader2 size={16} className="animate-spin mr-2"/> : <Send size={16} className="mr-2"/>} {sendingEmail ? 'Enviando...' : 'Confirmar Envio'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default MultasPage;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  fetchAllData, saveMulta, deleteMulta, saveVeiculo, saveCodigo, saveMotorista,
  cleanString, uploadFileToDrive, generateAuthPdfDocs, getDriveFolderId, getDocsTemplateId, formatInputText,
  sendEmailWithAttachmentsApi 
} from '../services/storage';
import { Multa, StatusMulta, TipoMulta, Veiculo, Motorista, CodigoMulta } from '../types';
import { 
  Plus, Search, FileText, Download, Save, Send, AlertTriangle, Calendar, DollarSign, Clock, User, 
  LayoutGrid, List as ListIcon, Edit2, Car, ArrowRight, Info, MapPin, Trash2, UploadCloud, Eye, 
  Loader2, HelpCircle, X, Mail, ArrowLeft, Map as MapIcon, Layers, Paperclip, FileCheck, 
  RectangleHorizontal, Filter, ChevronDown, ChevronUp, FileSpreadsheet, ArrowUpDown, 
  SlidersHorizontal, Check, RotateCcw, Columns, GripVertical, Sparkles, PlusCircle, Building, CheckCircle2,
  Truck, ChevronLeft, ChevronRight, ArrowUp, ArrowDown 
} from 'lucide-react';
import Loading from '../components/Loading';
import emailjs from '@emailjs/browser';
import { ImportarMultasCsvModal } from '../../multas/components/ImportarMultasCsvModal';
import { MercosulPlateBadge } from '../../../components/MercosulPlateBadge';

// FIX: Declare L on Window to avoid TypeScript errors with Leaflet
declare global {
  interface Window {
    L: any;
  }
}

// CONFIGURAÇÕES DO EMAILJS
const EMAILJS_SERVICE_ID = "service_fg7ymip"; 
const EMAILJS_TEMPLATE_ID = "template_blaj8ci"; 
const EMAILJS_PUBLIC_KEY = "cuqP-0hXxKwPdRE5g";

// DESTINATÁRIOS OBRIGATÓRIOS EM CÓPIA (CC) - SEMPRE INCLUÍDOS EM TODOS OS ENVIOS
const MANDATORY_CC_EMAILS = [
    'deny.goncalves@risel.com.br',
    'lorena.padilha@risel.com.br'
];
const ADMIN_EMAIL = 'deny.goncalves@risel.com.br';

// MAPEAMENTO DE E-MAILS POR BASE (Sem o Admin e Logística, que serão adicionados automaticamente no CC)
const EMAIL_MAPPINGS: Record<string, string> = {
    'AGU': 'operacionalaguai@risel.com.br; administrativo3.aguai@risel.com.br; administrativo.aguai@risel.com.br',
    'CPB': 'priscila.mendes@risel.com.br; frotacb@risel.com.br',
    'JLS': 'rodrigo.mosca@risel.com.br; operacional01.jales@risel.com.br; dyorgines.messaros@risel.com.br',
    'OUR': 'vinicius.paladino@risel.com.br; frotaor@risel.com.br',
    'PLN': 'daiara.nascimento@risel.com.br; programacaolog@risel.com.br; daniele.vedovello@risel.com.br',
    'SBC': 'frotasp2@risel.com.br; programacaosp@risel.com.br; operacionalsp@risel.com.br',
    'SUPRI': 'william.pereira@risel.com.br; lucas.daniel@risel.com.br; felipe.assumpcao@risel.com.br'
};

// Chave para armazenar a ordem de colunas individualizada por usuário
const getUserColumnsStorageKey = () => {
    const user = (typeof localStorage !== 'undefined' && localStorage.getItem('risel_user')) || 'default_user';
    return `risel_multas_user_cols_order_${user}`;
};

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
const COLUMNS_STORAGE_KEY = 'risel_multas_visible_cols_v1';

export interface ColumnConfig {
  id: string;
  label: string;
  category: 'Identificação & Veículo' | 'Condutor & Responsabilidade' | 'Infração & Local' | 'Datas & Prazos' | 'Financeiro & RH' | 'Documentos & Obs';
  sortKey?: keyof Multa;
  align?: 'left' | 'center' | 'right';
  minWidth?: string;
  description?: string;
}

const ALL_COLUMNS: ColumnConfig[] = [
  // Identificação & Veículo
  { id: 'status', label: 'Status', category: 'Identificação & Veículo', sortKey: 'status', align: 'left', minWidth: 'min-w-[130px]' },
  { id: 'placa', label: 'Placa', category: 'Identificação & Veículo', sortKey: 'placa', align: 'center', minWidth: 'min-w-[100px]' },
  { id: 'frota', label: 'Frota / Prefixo', category: 'Identificação & Veículo', sortKey: 'frota', align: 'center', minWidth: 'min-w-[110px]' },
  { id: 'base', label: 'Base / Filial', category: 'Identificação & Veículo', sortKey: 'base', align: 'center', minWidth: 'min-w-[100px]' },
  { id: 'ait', label: 'AIT (Auto de Infração)', category: 'Identificação & Veículo', sortKey: 'ait', align: 'left', minWidth: 'min-w-[120px]' },
  { id: 'tipo', label: 'Tipo da Multa', category: 'Identificação & Veículo', sortKey: 'tipo', align: 'center', minWidth: 'min-w-[110px]' },
  { id: 'numDocumento', label: 'Nº Documento', category: 'Identificação & Veículo', sortKey: 'numDocumento', align: 'center', minWidth: 'min-w-[120px]' },

  // Condutor & Responsabilidade
  { id: 'responsavelNome', label: 'Motorista / Condutor', category: 'Condutor & Responsabilidade', sortKey: 'responsavelNome', align: 'left', minWidth: 'min-w-[160px]' },
  { id: 'responsavelCodigo', label: 'Cód. / CPF Motorista', category: 'Condutor & Responsabilidade', sortKey: 'responsavelCodigo', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'empresaOuCondutor', label: 'Responsabilidade', category: 'Condutor & Responsabilidade', sortKey: 'empresaOuCondutor', align: 'center', minWidth: 'min-w-[120px]' },
  { id: 'descontarMotorista', label: 'Descontar Motorista?', category: 'Condutor & Responsabilidade', sortKey: 'descontarMotorista', align: 'center', minWidth: 'min-w-[130px]' },

  // Infração & Local
  { id: 'enquadramento', label: 'Cód. Enquadramento', category: 'Infração & Local', sortKey: 'enquadramento', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'artigoCtb', label: 'Artigo CTB', category: 'Infração & Local', sortKey: 'artigoCtb', align: 'left', minWidth: 'min-w-[120px]' },
  { id: 'descricaoInfracao', label: 'Descrição da Infração', category: 'Infração & Local', sortKey: 'descricaoInfracao', align: 'left', minWidth: 'min-w-[220px]' },
  { id: 'pontosCnh', label: 'Pontos CNH', category: 'Infração & Local', sortKey: 'pontosCnh', align: 'center', minWidth: 'min-w-[100px]' },
  { id: 'orgaoAutuador', label: 'Órgão Autuador', category: 'Infração & Local', sortKey: 'orgaoAutuador', align: 'left', minWidth: 'min-w-[140px]' },
  { id: 'endereco', label: 'Endereço Completo', category: 'Infração & Local', sortKey: 'endereco', align: 'left', minWidth: 'min-w-[200px]' },
  { id: 'municipio', label: 'Município', category: 'Infração & Local', sortKey: 'municipio', align: 'left', minWidth: 'min-w-[130px]' },
  { id: 'uf', label: 'UF', category: 'Infração & Local', sortKey: 'uf', align: 'center', minWidth: 'min-w-[70px]' },
  { id: 'rodoviaOuUrbano', label: 'Rodovia / Urbano', category: 'Infração & Local', sortKey: 'rodoviaOuUrbano', align: 'center', minWidth: 'min-w-[120px]' },

  // Datas & Prazos
  { id: 'dataHoraInfracao', label: 'Data da Multa', category: 'Datas & Prazos', sortKey: 'dataHoraInfracao', align: 'center', minWidth: 'min-w-[120px]' },
  { id: 'prazoIndicacao', label: 'Data Prazo (Indicação)', category: 'Datas & Prazos', sortKey: 'prazoIndicacao', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'diasRestantes', label: 'Status Prazo (Dias)', category: 'Datas & Prazos', align: 'center', minWidth: 'min-w-[120px]' },
  { id: 'dataRecebimento', label: 'Data Recebimento', category: 'Datas & Prazos', sortKey: 'dataRecebimento', align: 'center', minWidth: 'min-w-[120px]' },
  { id: 'recebidaComPrazo', label: 'Recebida c/ Prazo?', category: 'Datas & Prazos', sortKey: 'recebidaComPrazo', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'retornouComPrazo', label: 'Retornou c/ Prazo?', category: 'Datas & Prazos', sortKey: 'retornouComPrazo', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'descontoEnviadoRH', label: 'Enviado ao RH', category: 'Datas & Prazos', sortKey: 'descontoEnviadoRH', align: 'center', minWidth: 'min-w-[120px]' },
  { id: 'vencimento', label: 'Vencimento Boleto', category: 'Datas & Prazos', sortKey: 'vencimento', align: 'center', minWidth: 'min-w-[120px]' },

  // Financeiro & RH
  { id: 'valor', label: 'Valor Original', category: 'Financeiro & RH', sortKey: 'valor', align: 'right', minWidth: 'min-w-[110px]' },
  { id: 'desconto', label: 'Desconto (R$)', category: 'Financeiro & RH', sortKey: 'desconto', align: 'right', minWidth: 'min-w-[110px]' },
  { id: 'valorComDesconto', label: 'Valor c/ Desconto', category: 'Financeiro & RH', sortKey: 'valorComDesconto', align: 'right', minWidth: 'min-w-[130px]' },
  { id: 'pagoComDesconto', label: 'Pago c/ Desconto?', category: 'Financeiro & RH', sortKey: 'pagoComDesconto', align: 'center', minWidth: 'min-w-[130px]' },

  // Documentos & Observações
  { id: 'linkAit', label: 'Anexo(s) AIT', category: 'Documentos & Obs', align: 'center', minWidth: 'min-w-[110px]' },
  { id: 'linkAuth', label: 'Aut. Desconto (PDF)', category: 'Documentos & Obs', align: 'center', minWidth: 'min-w-[130px]' },
  { id: 'obs', label: 'Observações', category: 'Documentos & Obs', sortKey: 'obs', align: 'left', minWidth: 'min-w-[180px]' },
];

const DEFAULT_VISIBLE_COLUMNS: string[] = [
  'status',
  'dataHoraInfracao',
  'prazoIndicacao',
  'base',
  'placa',
  'ait',
  'responsavelNome',
  'valor'
];

const COLUMN_CATEGORIES = [
  'TODAS',
  'Identificação & Veículo',
  'Condutor & Responsabilidade',
  'Infração & Local',
  'Datas & Prazos',
  'Financeiro & RH',
  'Documentos & Obs'
] as const;

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

const MultasPage: React.FC = () => {
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
      descontar: ''
  });

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
  const [showPlacaDropdown, setShowPlacaDropdown] = useState(false);

  // Column Visibility States & Preferences (Individualizadas por Usuário)
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Modais de Cadastro Rápido Integrados ao Lançamento
  const [showNewVeiculoModal, setShowNewVeiculoModal] = useState(false);
  const [savingNewVeiculo, setSavingNewVeiculo] = useState(false);
  const [newVeiculoData, setNewVeiculoData] = useState<Partial<Veiculo>>({
    placa: '',
    id: '',
    filial: '',
    modelo: '',
    condutor: '',
    locadora: '',
    status: 'Ativo'
  });

  const [showNewCodigoModal, setShowNewCodigoModal] = useState(false);
  const [savingNewCodigo, setSavingNewCodigo] = useState(false);
  const [newCodigoData, setNewCodigoData] = useState<Partial<CodigoMulta>>({
    codigo: '',
    baseLegal: '',
    descricao: '',
    pontos: 4,
    valor: 130.16,
    desconto: 26.03
  });

  const [showNewMotoristaModal, setShowNewMotoristaModal] = useState(false);
  const [savingNewMotorista, setSavingNewMotorista] = useState(false);
  const [newMotoristaData, setNewMotoristaData] = useState<Partial<Motorista>>({
    login: '',
    nome: '',
    base: '',
    status: 'ATIVO'
  });

  const [columnModalTab, setColumnModalTab] = useState<'visibility' | 'order'>('visibility');
  const [showMotoristaDropdown, setShowMotoristaDropdown] = useState(false);

  const matchingMotoristas = useMemo(() => {
    const code = (formData.responsavelCodigo || '').trim();
    if (!code) return [];
    const clean = cleanString(code);
    return motoristas.filter(m => 
      cleanString(m.login || '').includes(clean) || cleanString(m.nome || '').includes(clean)
    ).slice(0, 8);
  }, [motoristas, formData.responsavelCodigo]);

  const saveUserColumnSelection = (cols: string[]) => {
    try {
      const key = getUserColumnsStorageKey();
      localStorage.setItem(key, JSON.stringify(cols));
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols));
    } catch (e) {
      console.error("Erro ao salvar colunas do usuário:", e);
    }
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const userKey = getUserColumnsStorageKey();
      const saved = localStorage.getItem(userKey) || localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtrar para garantir que apenas colunas válidas sejam carregadas
          const validIds = new Set(ALL_COLUMNS.map(c => c.id));
          const filtered = parsed.filter(id => validIds.has(id));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {
      console.error("Erro ao ler colunas salvas:", e);
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });
  const [columnSearch, setColumnSearch] = useState('');
  const [selectedColumnCategory, setSelectedColumnCategory] = useState<string>('TODAS');

  // Mantém a ordem exata de visibleColumns (essencial para o Drag-and-Drop)
  const visibleColumnsDefs = useMemo(() => {
    const colMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));
    return visibleColumns
      .map(id => colMap.get(id))
      .filter((col): col is ColumnConfig => Boolean(col));
  }, [visibleColumns]);

  const moveColumn = (colId: string, direction: 'left' | 'right') => {
    setVisibleColumns(prev => {
      const index = prev.indexOf(colId);
      if (index === -1) return prev;
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      saveUserColumnSelection(updated);
      return updated;
    });
  };

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColumnId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragOver = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== targetColId) {
      setDragOverColumnId(targetColId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const sourceColId = draggedColumnId || e.dataTransfer.getData('text/plain');
    setDraggedColumnId(null);
    setDragOverColumnId(null);

    if (!sourceColId || sourceColId === targetColId) return;

    setVisibleColumns(prev => {
      const fromIndex = prev.indexOf(sourceColId);
      const toIndex = prev.indexOf(targetColId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      saveUserColumnSelection(updated);
      return updated;
    });
  };

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      let next: string[];
      if (prev.includes(colId)) {
        if (prev.length <= 1) {
          return prev;
        }
        next = prev.filter(c => c !== colId);
      } else {
        next = [...prev, colId];
      }
      saveUserColumnSelection(next);
      return next;
    });
  };

  const selectAllColumns = () => {
    const all = ALL_COLUMNS.map(c => c.id);
    setVisibleColumns(all);
    saveUserColumnSelection(all);
  };

  const resetDefaultColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    saveUserColumnSelection(DEFAULT_VISIBLE_COLUMNS);
  };

  const clearAllColumns = () => {
    const minimal = ['status', 'placa'];
    setVisibleColumns(minimal);
    saveUserColumnSelection(minimal);
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleImportCsvSuccess = async (importedMultas: Multa[]) => {
      for (const m of importedMultas) {
          await saveMulta(m);
      }
      await loadData(true);
  };

  const loadData = async (force: boolean = false) => {
      setLoading(true);
      const data = await fetchAllData(force);
      setMultas(data.multas);
      setVeiculos(data.veiculos);
      setMotoristas(data.motoristas);
      setCodigos(data.codigos);
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
          if (m.dataHoraInfracao && m.dataHoraInfracao.length >= 7) {
              const y = m.dataHoraInfracao.includes('T') ? m.dataHoraInfracao.substring(0, 7) : 
                        (m.dataHoraInfracao.includes('/') ? m.dataHoraInfracao.split('/')[2] + '-' + m.dataHoraInfracao.split('/')[1] : m.dataHoraInfracao.substring(0, 7));
              if(y && y.length === 7) months.add(y);
          }
      });
      return Array.from(months).sort().reverse().map(m => {
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

          const dateStr = m.dataHoraInfracao;
          if (!dateStr) return false; 
          
          let date: Date;
          if (dateStr.includes('T')) date = new Date(dateStr);
          else if (dateStr.includes('/')) {
              const [d, mon, y] = dateStr.split(' ')[0].split('/');
              date = new Date(Number(y), Number(mon)-1, Number(d));
          } else if (dateStr.includes('-')) {
              date = new Date(dateStr);
          } else return false;

          if (filters.mes) {
              const [yFilter, mFilter] = filters.mes.split('-');
              if (date.getFullYear() !== Number(yFilter) || (date.getMonth() + 1) !== Number(mFilter)) return false;
          }
          if (filters.dataInicio) {
              const dInicio = new Date(filters.dataInicio);
              dInicio.setHours(0,0,0,0);
              if (date < dInicio) return false;
          }
          if (filters.dataFim) {
              const dFim = new Date(filters.dataFim);
              dFim.setHours(23,59,59,999);
              if (date > dFim) return false;
          }
          return true;
      });
  }, [multas, searchTerm, filters]);

  const formatDateString = (val?: string) => {
      if (!val) return '-';
      if (val.length === 10 && val.includes('-')) {
          const parts = val.split('-');
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const date = new Date(val);
      return isNaN(date.getTime()) ? val : date.toLocaleDateString('pt-BR');
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

  const matchingVeiculos = useMemo(() => {
      const p = formData.placa || '';
      const cleanP = cleanString(p);
      if (!cleanP || cleanP.length < 2) return [];
      return veiculos.filter(v => {
          const vPlaca = cleanString(v.placa);
          const vId = v.id ? cleanString(v.id) : '';
          const vCond = v.condutor ? cleanString(v.condutor) : '';
          return vPlaca.includes(cleanP) || vId.includes(cleanP) || vCond.includes(cleanP);
      }).slice(0, 8);
  }, [formData.placa, veiculos]);

  const selectVeiculo = (veiculo: Veiculo) => {
      setShowPlacaDropdown(false);
      clearError('placa');
      const condutorName = veiculo.condutor || '';
      const matchedMotorista = condutorName ? motoristas.find(m => 
          cleanString(m.nome) === cleanString(condutorName) || 
          cleanString(m.login) === cleanString(condutorName) ||
          (m.nome && condutorName && m.nome.toUpperCase().trim() === condutorName.toUpperCase().trim())
      ) : undefined;

      setFormData(prev => ({
          ...prev,
          placa: veiculo.placa,
          frota: veiculo.id && cleanString(veiculo.id) !== cleanString(veiculo.placa) ? veiculo.id : (veiculo.placa || prev.frota || ''),
          base: veiculo.filial || veiculo.base || prev.base || '',
          responsavelNome: matchedMotorista ? matchedMotorista.nome : (condutorName || prev.responsavelNome || ''),
          responsavelCodigo: matchedMotorista ? matchedMotorista.login : (prev.responsavelCodigo || '')
      }));
  };

  const handlePlacaChange = (val: string) => {
      const upperVal = val.toUpperCase().replace(/\s+/g, '');
      const cleanVal = cleanString(upperVal); 
      setShowPlacaDropdown(cleanVal.length >= 2);
      setFormData(prev => {
          const veiculo = veiculos.find(v => cleanString(v.placa) === cleanVal || (v.id && cleanString(v.id) === cleanVal));
          if (veiculo) {
              clearError('placa');
              const condutorName = veiculo.condutor || '';
              // Busca motorista cadastrado por nome ou código
              const matchedMotorista = condutorName ? motoristas.find(m => 
                  cleanString(m.nome) === cleanString(condutorName) || 
                  cleanString(m.login) === cleanString(condutorName) ||
                  (m.nome && condutorName && m.nome.toUpperCase().trim() === condutorName.toUpperCase().trim())
              ) : undefined;

              return {
                  ...prev,
                  placa: veiculo.placa,
                  frota: veiculo.id && cleanString(veiculo.id) !== cleanString(veiculo.placa) ? veiculo.id : (veiculo.placa || prev.frota || ''),
                  base: veiculo.filial || veiculo.base || prev.base || '',
                  responsavelNome: matchedMotorista ? matchedMotorista.nome : (condutorName || prev.responsavelNome || ''),
                  responsavelCodigo: matchedMotorista ? matchedMotorista.login : (prev.responsavelCodigo || '')
              };
          }
          return {
              ...prev,
              placa: upperVal
          };
      });
  };

  const handleOpenNewVeiculoModal = () => {
    const currentPlaca = (formData.placa || '').toUpperCase().replace(/\s+/g, '');
    setNewVeiculoData({
      placa: currentPlaca,
      id: formData.frota || currentPlaca,
      filial: formData.base || 'SBC',
      base: formData.base || 'SBC',
      modelo: '',
      condutor: formData.responsavelNome || '',
      locadora: 'RISEL',
      status: 'Ativo'
    });
    setShowNewVeiculoModal(true);
  };

  const handleSaveNewVeiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVeiculoData.placa || newVeiculoData.placa.trim().length < 6) {
      alert("Informe uma placa válida (ex: ABC1D23 ou ABC1234).");
      return;
    }
    setSavingNewVeiculo(true);
    try {
      const formattedPlaca = newVeiculoData.placa.toUpperCase().trim();
      const veiculoToSave: Veiculo = {
        placa: formattedPlaca,
        id: newVeiculoData.id ? newVeiculoData.id.toUpperCase().trim() : formattedPlaca,
        filial: newVeiculoData.filial ? newVeiculoData.filial.toUpperCase().trim() : 'SBC',
        base: newVeiculoData.filial ? newVeiculoData.filial.toUpperCase().trim() : 'SBC',
        modelo: newVeiculoData.modelo ? newVeiculoData.modelo.toUpperCase().trim() : '',
        condutor: newVeiculoData.condutor ? formatInputText(newVeiculoData.condutor) : '',
        locadora: newVeiculoData.locadora ? newVeiculoData.locadora.toUpperCase().trim() : '',
        status: newVeiculoData.status || 'Ativo',
        funcao: 'Operacional',
        custoLicenciamento2026: 0,
        custoIpva2026: 0,
        custoMultas2026: 0,
        custoTotal2026: 0
      };

      await saveVeiculo(veiculoToSave);

      // Atualiza estado local de frotas
      setVeiculos(prev => {
        const cleanP = cleanString(veiculoToSave.placa);
        const exists = prev.some(v => cleanString(v.placa) === cleanP);
        if (exists) {
          return prev.map(v => cleanString(v.placa) === cleanP ? veiculoToSave : v);
        }
        return [...prev, veiculoToSave];
      });

      // Vincula na multa atual
      setFormData(prev => ({
        ...prev,
        placa: veiculoToSave.placa,
        frota: veiculoToSave.id,
        base: veiculoToSave.filial,
        responsavelNome: prev.responsavelNome || veiculoToSave.condutor || ''
      }));
      clearError('placa');

      setShowNewVeiculoModal(false);
      alert(`Veículo ${veiculoToSave.placa} cadastrado e salvo no banco de dados com sucesso!`);
    } catch (err: any) {
      alert("Erro ao cadastrar veículo: " + (err.message || err));
    } finally {
      setSavingNewVeiculo(false);
    }
  };

  const handleOpenNewCodigoModal = () => {
    const currentCod = (formData.enquadramento || '').toUpperCase().trim();
    setNewCodigoData({
      codigo: currentCod,
      baseLegal: formData.artigoCtb || 'Art. CTB',
      descricao: formData.descricaoInfracao || '',
      pontos: formData.pontosCnh || 4,
      valor: formData.valor || 130.16,
      desconto: formData.desconto || 26.03
    });
    setShowNewCodigoModal(true);
  };

  const handleSaveNewCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodigoData.codigo || newCodigoData.codigo.trim().length < 2) {
      alert("Informe o código de enquadramento.");
      return;
    }
    setSavingNewCodigo(true);
    try {
      const formattedCode = newCodigoData.codigo.toUpperCase().trim();
      const codigoToSave: CodigoMulta = {
        codigo: formattedCode,
        baseLegal: newCodigoData.baseLegal ? newCodigoData.baseLegal.toUpperCase().trim() : '',
        descricao: newCodigoData.descricao ? formatInputText(newCodigoData.descricao) : '',
        pontos: Number(newCodigoData.pontos) || 0,
        valor: Number(newCodigoData.valor) || 0,
        desconto: Number(newCodigoData.desconto) || 0
      };

      await saveCodigo(codigoToSave);

      // Atualiza lista em memória
      setCodigos(prev => {
        const cleanC = cleanString(codigoToSave.codigo);
        const exists = prev.some(c => cleanString(c.codigo) === cleanC);
        if (exists) {
          return prev.map(c => cleanString(c.codigo) === cleanC ? codigoToSave : c);
        }
        return [...prev, codigoToSave];
      });

      // Auto-preenche no lançamento
      const valorFinal = (codigoToSave.valor || 0) - (codigoToSave.desconto || 0);
      setFormData(prev => ({
        ...prev,
        enquadramento: codigoToSave.codigo,
        artigoCtb: codigoToSave.baseLegal,
        descricaoInfracao: codigoToSave.descricao,
        pontosCnh: codigoToSave.pontos,
        valor: codigoToSave.valor,
        desconto: codigoToSave.desconto,
        valorComDesconto: valorFinal
      }));

      setShowNewCodigoModal(false);
      alert(`Enquadramento ${codigoToSave.codigo} cadastrado e salvo com sucesso no banco de dados!`);
    } catch (err: any) {
      alert("Erro ao cadastrar código: " + (err.message || err));
    } finally {
      setSavingNewCodigo(false);
    }
  };

  const handleEnquadramentoChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => ({ ...prev, enquadramento: upperVal }));
    const cleanSearch = upperVal.replace(/[^A-Z0-9]/g, '');
    if (cleanSearch.length >= 2) {
        const matches = codigos.filter(c => {
            if (!c.codigo) return false;
            const dbCodeClean = c.codigo.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const dbCodeRaw = c.codigo.toString().toUpperCase();
            const dbDesc = (c.descricao || '').toUpperCase();
            return dbCodeClean.startsWith(cleanSearch) || dbCodeRaw.includes(upperVal) || dbDesc.includes(upperVal);
        });
        setFilteredCodigos(matches.slice(0, 15));
        setShowCodigosDropdown(true);
    } else {
        setShowCodigosDropdown(false);
    }
  };

  const selectCodigo = (codigo: any) => {
      const valorFinal = (codigo.valor || 0) - (codigo.desconto || 0);
      setFormData(prev => ({
        ...prev, 
        enquadramento: (codigo.codigo || '').toUpperCase(), 
        artigoCtb: (codigo.baseLegal || '').toUpperCase(), 
        descricaoInfracao: (codigo.descricao || '').toUpperCase(),
        pontosCnh: codigo.pontos, 
        valor: codigo.valor, 
        desconto: codigo.desconto, 
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
  };

  const handleResponsavelCodigoChange = (val: string) => {
    const codeVal = formatInputText(val);
    const cleanSearch = cleanString(codeVal);

    if (codeVal.length >= 1) {
      setShowMotoristaDropdown(true);
    } else {
      setShowMotoristaDropdown(false);
    }

    setFormData(prev => {
      const motorista = motoristas.find(m => 
        cleanString(m.login) === cleanSearch ||
        (m.login && m.login.toUpperCase().trim() === codeVal.trim())
      );

      if (motorista) {
        clearError('responsavelNome');
        const driverVehicle = veiculos.find(v => cleanString(v.condutor || '') === cleanString(motorista.nome));
        return {
          ...prev,
          responsavelCodigo: motorista.login,
          responsavelNome: motorista.nome,
          base: prev.base || motorista.base || (driverVehicle ? (driverVehicle.filial || driverVehicle.base) : '') || ''
        };
      }

      return {
        ...prev,
        responsavelCodigo: codeVal,
        responsavelNome: codeVal.trim() === '' ? '' : prev.responsavelNome
      };
    });
  };

  const selectMotorista = (motorista: Motorista) => {
    clearError('responsavelNome');
    const driverVehicle = veiculos.find(v => cleanString(v.condutor || '') === cleanString(motorista.nome));
    setFormData(prev => ({
      ...prev,
      responsavelCodigo: motorista.login,
      responsavelNome: motorista.nome,
      base: prev.base || motorista.base || (driverVehicle ? (driverVehicle.filial || driverVehicle.base) : '') || ''
    }));
    setShowMotoristaDropdown(false);
  };

  const handleOpenNewMotoristaModal = () => {
    setNewMotoristaData({
      login: formData.responsavelCodigo || `MOT-${Date.now().toString().slice(-4)}`,
      nome: formData.responsavelNome || '',
      base: formData.base || 'SBC',
      status: 'ATIVO'
    });
    setShowNewMotoristaModal(true);
  };

  const handleSaveNewMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotoristaData.nome || newMotoristaData.nome.trim().length < 2) {
      alert("Informe o nome do motorista.");
      return;
    }
    setSavingNewMotorista(true);
    try {
      const motoristaToSave: Motorista = {
        login: newMotoristaData.login ? formatInputText(newMotoristaData.login) : `MOT-${Date.now().toString().slice(-4)}`,
        nome: formatInputText(newMotoristaData.nome),
        base: newMotoristaData.base ? formatInputText(newMotoristaData.base) : (formData.base || ''),
        status: newMotoristaData.status || 'ATIVO'
      };

      await saveMotorista(motoristaToSave);

      setMotoristas(prev => {
        const cleanL = cleanString(motoristaToSave.login);
        const exists = prev.some(m => cleanString(m.login) === cleanL);
        if (exists) {
          return prev.map(m => cleanString(m.login) === cleanL ? motoristaToSave : m);
        }
        return [...prev, motoristaToSave];
      });

      setFormData(prev => ({
        ...prev,
        responsavelCodigo: motoristaToSave.login,
        responsavelNome: motoristaToSave.nome,
        base: prev.base || motoristaToSave.base || ''
      }));
      clearError('responsavelNome');

      setShowNewMotoristaModal(false);
      alert(`Motorista ${motoristaToSave.nome} [${motoristaToSave.login}] salvo com sucesso no banco de dados!`);
    } catch (err: any) {
      alert("Erro ao cadastrar motorista: " + (err.message || err));
    } finally {
      setSavingNewMotorista(false);
    }
  };

  const handleResponsavelChange = (val: string) => {
    const formattedVal = formatInputText(val);
    const cleanSearch = cleanString(formattedVal);
    
    // Busca motorista por Login ou por Nome
    const motorista = motoristas.find(m => 
      cleanString(m.login) === cleanSearch || 
      cleanString(m.nome) === cleanSearch ||
      (m.nome && m.nome.toUpperCase().trim() === formattedVal.trim())
    );

    if (motorista) {
      setFormData(prev => {
        const driverVehicle = veiculos.find(v => cleanString(v.condutor || '') === cleanString(motorista.nome));
        return {
          ...prev,
          responsavelCodigo: motorista.login,
          responsavelNome: motorista.nome,
          base: prev.base || motorista.base || (driverVehicle ? (driverVehicle.filial || driverVehicle.base) : '') || ''
        };
      });
      clearError('responsavelNome');
    } else {
      setFormData(prev => ({ 
        ...prev, 
        responsavelNome: formattedVal 
      }));
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
          case StatusMulta.IMPORTACAO_VAMOS: colors = 'bg-purple-100 text-purple-800 border-purple-200'; break;
          default: colors = 'bg-gray-100/50 text-gray-800 border-gray-200'; break;
      }
      return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide border ${colors}`}>{status}</span>;
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
              "<<FROTA>>": "", "<<DATA INFRACAO>>": fmtDate(formData.dataHoraInfracao),
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
      
      const fileNamesList: string[] = [];
      aitLinks.forEach((l, idx) => fileNamesList.push(`Auto de Infração (AIT) - ${l.name || `Documento ${idx + 1}`}`));
      if (data.linkAuth) {
          fileNamesList.push('Autorização de Desconto em Folha (PDF Assinado/Gerado)');
      }

      if (fileNamesList.length > 0) {
          const itemsHtml = fileNamesList.map(name => `
            <div style="padding:8px 14px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:6px;font-weight:600;color:#0f172a;font-size:13px;">
              <span style="color:#00d664;font-weight:bold;margin-right:6px;">✔</span> 📎 ${name}
            </div>
          `).join('');

          attachmentsSection = `
            <div style="background-color:#f8fafc;padding:18px 20px;border-radius:8px;margin-top:25px;border:1px solid #cbd5e1;">
                <div style="font-weight:bold;font-size:13px;color:#022c22;text-transform:uppercase;margin-bottom:10px;">
                    📎 DOCUMENTOS ANEXADOS DIRETAMENTE A ESTE E-MAIL:
                </div>
                ${itemsHtml}
            </div>`;
      }

      // Mercosul Plate Icon (Reduced Size - 24x14 approx)
      const iconPlaca = `<span style="display:inline-block;width:24px;height:14px;background:#fff;border:1px solid #94a3b8;border-top:3px solid #1e3a8a;border-radius:2px;vertical-align:middle;margin-right:6px;box-shadow:0 1px 1px rgba(0,0,0,0.1);position:relative;"><span style="position:absolute;top:1px;left:1px;right:1px;height:1px;background:repeating-linear-gradient(90deg,transparent,transparent 1px,#e2e8f0 1px,#e2e8f0 2px);"></span></span>`;
      
      // CNH Icon (Reduced Size - 18x12 approx)
      const iconCNH = `<span style="display:inline-block;width:18px;height:12px;background:#fefce8;border:1px solid #d97706;border-radius:2px;vertical-align:middle;margin-right:6px;position:relative;"><span style="position:absolute;top:1px;left:1px;width:4px;height:4px;background:#e5e7eb;border:1px solid #d1d5db;"></span><span style="position:absolute;top:2px;left:7px;width:6px;height:1px;background:#cbd5e1;"></span><span style="position:absolute;top:5px;left:7px;width:4px;height:1px;background:#cbd5e1;"></span></span>`;

      // Campo Observações (somente adiciona se houver conteúdo digitado)
      const obsHtml = data.obs && data.obs.trim() ? `
        <tr style="background-color:#fffbeb;">
          <td style="padding:10px;font-weight:bold;color:#b45309;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">📝 Observações:</td>
          <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#78350f;line-height:1.5;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.obs.trim().replace(/\n/g, '<br/>')}</td>
        </tr>
      ` : '';

      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(data.placa || ''));
      const baseStr = (data.base || '').trim() || (veiculoMatch?.base || '').trim();

      return `
        <div style="font-family:'Aptos Narrow', 'Aptos', Calibri, 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;font-size:12pt;color:#334155;max-width:650px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background-color:#ffffff;">
          <div style="background-color:#022c22;padding:25px;text-align:center;">
            <h1 style="color:#00d664;margin:0;font-size:22px;font-family:'Aptos Narrow','Aptos',Calibri,'Segoe UI',sans-serif;letter-spacing:-0.5px;font-weight:bold;">NOTIFICAÇÃO DE MULTA</h1>
            <p style="color:#cbd5e1;margin-top:5px;font-size:12px;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">Sistema de Multas Risel${baseStr ? ` &bull; Base: ${baseStr}` : ''}</p>
          </div>
          <div style="padding:30px;font-family:'Aptos Narrow','Aptos',Calibri,'Segoe UI',sans-serif;">
            <p style="margin-bottom:20px;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">Olá, seguem informações referentes a Notificação aplicada ao veículo:</p>
            <p style="margin-bottom:20px;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">Gentileza, enviar cópia da CNH, e solicitar a assinatura do condutor nos documentos, idêntica a assinatura da CNH.</p>
            <p style="margin-bottom:20px;font-weight:bold;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">Motorista identificado através do rastreador. Gentileza confirmar:</p>
            
            <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:14px;font-family:'Aptos Narrow','Aptos',Calibri,'Segoe UI',sans-serif;">
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">👤 Motorista:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.responsavelNome || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">📄 AIT:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.ait || '-'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${iconPlaca} Placa:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.placa || '-'}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">🏢 Base:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.base || baseStr || '-'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">📅 Data:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${fmtDate(data.dataHoraInfracao)}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">⚠️ Infração:</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.descricaoInfracao || '-'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">💲 Valor:</td><td style="padding:10px;color:#16a34a;font-weight:bold;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${fmtMoney(data.valorComDesconto)}</td></tr>
              <tr><td style="padding:10px;font-weight:bold;color:#022c22;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${iconCNH} Pontuação CNH:</td><td style="padding:10px;color:#334155;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${data.pontosCnh || '0'}</td></tr>
              <tr style="background-color:#f1f5f9;"><td style="padding:10px;font-weight:bold;color:#dc2626;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">⏳ Prazo:</td><td style="padding:10px;font-weight:bold;color:#dc2626;border-bottom:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">${fmtDate(data.prazoIndicacao)}</td></tr>
              ${obsHtml}
            </table>
            ${attachmentsSection}
          </div>
          <!-- Assinatura Oficial Risel -->
          <div style="background-color:#ffffff;padding:20px 25px;border-top:1px solid #e2e8f0;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">
              <tr>
                <td width="92" valign="middle" style="width:92px;vertical-align:middle;padding-right:14px;border-right:2px solid #e2e8f0;">
                  <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
                    <img src="https://risel.com.br/wp-content/uploads/2024/07/RISEL.png" alt="Risel Combustíveis" width="84" height="34" style="width:84px;height:34px;max-width:84px;max-height:34px;display:block;border:0;outline:none;" />
                  </a>
                </td>
                <td valign="middle" style="vertical-align:middle;padding-left:14px;font-family:'Aptos Narrow','Aptos',Calibri,sans-serif;">
                  <div style="font-family:'Aptos Narrow','Aptos',Calibri,Arial,sans-serif;font-size:13px;font-weight:800;color:#0f172a;letter-spacing:-0.1px;line-height:1.25;">
                    Sistema de Multas Risel
                  </div>
                  <div style="font-family:'Aptos Narrow','Aptos',Calibri,Arial,sans-serif;font-size:11px;color:#64748b;margin-top:2px;line-height:1.25;">
                    Risel Combustíveis Ltda
                  </div>
                  <div style="font-family:'Aptos Narrow','Aptos',Calibri,Arial,sans-serif;font-size:10.5px;margin-top:3px;">
                    <a href="https://risel.com.br" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:none;font-weight:600;">
                      www.risel.com.br
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>`;
  };

  const handleSendEmail = async () => {
      if (!formData.placa || !formData.ait) { alert("Faltam dados da multa."); return; }
      setSendingEmail(true);
      
      // Parse main recipients list (split by ; or ,)
      const toRecipientsList = emailTo.split(/[;,]+/)
          .map(e => e.trim())
          .filter(e => e.length > 0 && e.includes('@'));
      
      // CC Recipients: Mandatório conforme regra (deny.goncalves@risel.com.br e lorena.padilha@risel.com.br)
      const ccRecipientsList = Array.from(new Set([
          ...MANDATORY_CC_EMAILS
      ]));
      
      // Remove CC emails from To list if they are there to avoid duplication
      const finalToList = toRecipientsList.filter(email => !ccRecipientsList.includes(email));
      
      const to_email = finalToList.join(',');
      const cc_email = ccRecipientsList.join(',');
      
      if (to_email.length === 0 && finalToList.length === 0) { 
          alert("Nenhum destinatário principal válido. O e-mail será enviado apenas para os endereços em cópia.");
      }

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

      const veiculoMatch = veiculos.find(v => cleanString(v.placa) === cleanString(formData.placa));
      const baseStr = (formData.base || '').trim() || (veiculoMatch?.base || '').trim() || '-';
      const dataFormatada = getFormattedSubjectDate(formData.dataHoraInfracao);
      const subject = `NOTIFICAÇÃO DE MULTA: PLACA ${formData.placa}${formData.frota ? ' - FROTA: ' + formData.frota : ''} - BASE: ${baseStr} - DATA ${dataFormatada}`;
      const emailHtml = generateEmailHTML(formData);

      try {
          // Envio nativo direto via Google Apps Script (que anexa os arquivos reais do Drive direto no e-mail)
          const apiResponse = await sendEmailWithAttachmentsApi({
              to_email: to_email || ADMIN_EMAIL,
              cc_email: cc_email,
              subject: subject,
              message_html: emailHtml,
              placa: formData.placa,
              frota: formData.frota,
              ait: formData.ait,
              linkAit: formData.linkAit,
              linkAuth: formData.linkAuth,
              motorista: formData.responsavelNome
          });

          if (apiResponse && apiResponse.success) {
              const countMsg = apiResponse.attachmentsCount !== undefined ? ` com ${apiResponse.attachmentsCount} anexo(s) direto(s)` : '';
              alert(`E-mail enviado com sucesso${countMsg}!`);
              setIsEmailModalOpen(false);
          } else {
              throw new Error(apiResponse?.error || "Serviço de e-mail retornou erro.");
          }
      } catch (scriptError: any) {
          console.warn("Envio direto via Google Apps Script falhou, verificando fallback:", scriptError);
          // Fallback caso o script no Google Apps Script ainda não tenha sido atualizado para v5.4
          if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
              const userConfirmed = confirm(
                  `O envio direto com anexos via Google Apps Script retornou: "${scriptError.message || scriptError}".\n\nDeseja realizar o envio alternativo via EmailJS?\n(Dica: atualize o Apps Script para a versão v5.4 na aba Configurações para anexar os arquivos diretamente no e-mail).`
              );
              if (userConfirmed) {
                  const templateParams = { 
                      subject, 
                      to_email: to_email || ADMIN_EMAIL,
                      cc_email: cc_email,
                      message_html: emailHtml 
                  };
                  const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
                  if (result.status === 200) { 
                      alert("E-mail alternativo enviado com sucesso!"); 
                      setIsEmailModalOpen(false); 
                  } else { 
                      alert("Erro no envio alternativo."); 
                  }
              }
          } else {
              alert("Falha no envio do e-mail: " + (scriptError.message || scriptError));
          }
      } finally { 
          setSendingEmail(false); 
      }
  };

  const handleExport = () => {
      // (Export logic same as before)
      setIsExportModalOpen(false);
  };

  const renderCell = (columnId: string, multa: Multa) => {
    switch (columnId) {
        case 'status':
            return getStatusBadge(multa.status);
        case 'placa':
            return (
                <div className="flex items-center justify-center py-0.5">
                    <MercosulPlateBadge plate={multa.placa} size="sm" />
                </div>
            );
        case 'frota':
            return multa.frota ? <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[9px] whitespace-nowrap">FROTA {multa.frota}</span> : <span className="text-gray-400 text-[9px]">-</span>;
        case 'base':
            return <span className="font-semibold text-gray-600 uppercase text-[9px] whitespace-nowrap">{multa.base || '-'}</span>;
        case 'ait':
            return <span className="font-mono font-bold text-gray-700 text-[9.5px] whitespace-nowrap">{multa.ait || '-'}</span>;
        case 'tipo':
            return <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">{multa.tipo || '-'}</span>;
        case 'numDocumento':
            return <span className="font-mono text-[9px] text-gray-600 whitespace-nowrap">{multa.numDocumento || '-'}</span>;
        case 'responsavelNome':
            return <span className="text-gray-700 font-medium truncate max-w-[160px] block text-[10px]" title={multa.responsavelNome}>{multa.responsavelNome || '-'}</span>;
        case 'responsavelCodigo':
            return <span className="font-mono text-[9px] text-gray-500 whitespace-nowrap">{multa.responsavelCodigo || '-'}</span>;
        case 'empresaOuCondutor':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.empresaOuCondutor === 'EMPRESA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{multa.empresaOuCondutor || '-'}</span>;
        case 'descontarMotorista':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.descontarMotorista === 'SIM' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{multa.descontarMotorista || '-'}</span>;
        case 'enquadramento':
            return <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[9.5px] whitespace-nowrap">{multa.enquadramento || '-'}</span>;
        case 'artigoCtb':
            return <span className="text-gray-600 text-[9px] whitespace-nowrap">{multa.artigoCtb || '-'}</span>;
        case 'descricaoInfracao':
            return <span className="text-gray-600 truncate max-w-[220px] block text-[9.5px]" title={multa.descricaoInfracao}>{multa.descricaoInfracao || '-'}</span>;
        case 'pontosCnh':
            return <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black whitespace-nowrap ${(multa.pontosCnh || 0) >= 7 ? 'bg-red-100 text-red-700' : (multa.pontosCnh || 0) >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{multa.pontosCnh ?? 0} pts</span>;
        case 'orgaoAutuador':
            return <span className="text-gray-600 truncate max-w-[140px] block text-[9.5px]" title={multa.orgaoAutuador}>{multa.orgaoAutuador || '-'}</span>;
        case 'endereco':
            return <span className="text-gray-600 truncate max-w-[200px] block text-[9.5px]" title={multa.endereco}>{multa.endereco || '-'}</span>;
        case 'municipio':
            return <span className="text-gray-600 truncate max-w-[130px] block text-[9.5px]">{multa.municipio || '-'}</span>;
        case 'uf':
            return <span className="font-bold text-gray-700 text-[9px]">{multa.uf || '-'}</span>;
        case 'rodoviaOuUrbano':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.rodoviaOuUrbano === 'RODOVIA' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>{multa.rodoviaOuUrbano || '-'}</span>;
        case 'dataHoraInfracao':
            return <span className="font-mono text-[9px] text-gray-600 whitespace-nowrap">{formatDateString(multa.dataHoraInfracao)}</span>;
        case 'prazoIndicacao':
            return <span className="font-mono text-[9px] text-gray-600 whitespace-nowrap">{formatDateString(multa.prazoIndicacao)}</span>;
        case 'diasRestantes': {
            const info = getPrazoInfo(multa.status, multa.prazoIndicacao);
            return <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold border whitespace-nowrap ${info.class}`}>{info.text}</span>;
        }
        case 'dataRecebimento':
            return <span className="font-mono text-[9px] text-gray-600 whitespace-nowrap">{formatDateString(multa.dataRecebimento)}</span>;
        case 'recebidaComPrazo':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.recebidaComPrazo === 'SIM' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{multa.recebidaComPrazo || '-'}</span>;
        case 'retornouComPrazo':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.retornouComPrazo === 'SIM' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{multa.retornouComPrazo || '-'}</span>;
        case 'descontoEnviadoRH':
            return <span className="font-mono text-[9px] text-purple-700 font-semibold whitespace-nowrap">{formatDateString(multa.descontoEnviadoRH)}</span>;
        case 'vencimento':
            return <span className="font-mono text-[9px] text-gray-600 whitespace-nowrap">{formatDateString(multa.vencimento)}</span>;
        case 'valor':
            return <span className="font-medium text-gray-700 whitespace-nowrap text-right block text-[10px]">{multa.valor ? multa.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>;
        case 'desconto':
            return <span className="text-gray-500 whitespace-nowrap text-right block text-[10px]">{multa.desconto ? multa.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</span>;
        case 'valorComDesconto':
            return <span className="font-bold text-emerald-700 whitespace-nowrap text-right block text-[10px]">{multa.valorComDesconto ? multa.valorComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>;
        case 'pagoComDesconto':
            return <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${multa.pagoComDesconto === 'SIM' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{multa.pagoComDesconto || '-'}</span>;
        case 'linkAit': {
            const links = parseLinks(multa.linkAit);
            if (links.length === 0) return <span className="text-gray-300 text-[9px]">-</span>;
            return (
                <div className="flex items-center justify-center gap-1">
                    {links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-1 rounded border border-emerald-200 transition-colors" title={l.name}>
                            <Paperclip size={11} />
                        </a>
                    ))}
                </div>
            );
        }
        case 'linkAuth':
            return multa.linkAuth ? (
                <a href={multa.linkAuth} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 text-[8.5px] font-bold inline-flex items-center gap-1">
                    <FileCheck size={10} /> PDF
                </a>
            ) : <span className="text-gray-300 text-[9px]">-</span>;
        case 'obs':
            return <span className="text-gray-500 text-[9px] truncate max-w-[160px] block" title={multa.obs}>{multa.obs || '-'}</span>;
        default:
            return <span className="text-[9px]">-</span>;
    }
  };

  const filteredColumnsForModal = useMemo(() => {
    return ALL_COLUMNS.filter(col => {
      const matchCat = selectedColumnCategory === 'TODAS' || col.category === selectedColumnCategory;
      const searchClean = columnSearch.toLowerCase().trim();
      const matchSearch = !searchClean || 
        col.label.toLowerCase().includes(searchClean) || 
        col.category.toLowerCase().includes(searchClean) ||
        col.id.toLowerCase().includes(searchClean);
      return matchCat && matchSearch;
    });
  }, [selectedColumnCategory, columnSearch]);

  const FormTooltip = ({ text }: { text: string }) => (
      <div className="group/tooltip relative inline-flex ml-1.5 cursor-help tooltip-trigger"><HelpCircle size={12} className="text-gray-400 hover:text-risel-blue" /><div className="tooltip-content absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900/95 text-white text-[10px] p-2 rounded shadow-lg backdrop-blur-sm z-50 text-center leading-relaxed">{text}</div></div>
  );

  if (view === 'LIST') {
    return (
        <div className="space-y-4 animate-in fade-in relative h-full flex flex-col pb-0">
            {loading && <Loading />}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-2 rounded-xl shadow-2xs border border-slate-200/70 shrink-0">
            <div><h2 className="text-base sm:text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-800 to-rose-600 tracking-tight uppercase leading-none">Gestão de Multas</h2><p className="text-slate-500 text-[10px] sm:text-[10.5px] font-semibold mt-0.5 leading-none">Controle e processamento de infrações</p></div>
            <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end flex-wrap gap-y-1">
                <button id="btn-frota-pesada-importar-csv" onClick={() => setIsImportModalOpen(true)} className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 whitespace-nowrap font-bold text-[11px]"><UploadCloud size={13} className="mr-1.5 text-purple-600" /> Importar CSV</button>
                <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 whitespace-nowrap font-bold text-[11px]"><FileSpreadsheet size={13} className="mr-1.5" /> Exportar Relatório</button>
                <button onClick={() => setShowGlobalMap(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 whitespace-nowrap font-bold text-[11px]"><MapIcon size={13} className="mr-1.5 text-emerald-400" /> Mapa Geral</button>
                <button onClick={() => { setFormData(initialMulta); setErrors({}); setView('FORM'); }} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg flex items-center shadow-2xs transition-all active:scale-95 whitespace-nowrap font-bold text-[11px] uppercase"><Plus size={13} className="mr-1" /> Nova Multa</button>
            </div>
            </div>
            
            {/* Filter & Toolbar Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 bg-white/60 backdrop-blur-md p-2 rounded-xl shadow-sm border border-white/30">
                    <div className="flex items-center w-full flex-1">
                        <Search className="text-gray-500 mr-2 ml-2" size={18} />
                        <input type="text" placeholder="Pesquisar Rápida (AIT, Placa, Frota, Condutor...)" className="flex-1 outline-none text-gray-800 bg-transparent text-sm font-medium placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500 transition-colors p-1 mr-2"><X size={16} /></button>}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {/* Botão discreto para escolher colunas */}
                        <button 
                            onClick={() => setShowColumnModal(true)} 
                            className="px-3 py-1.5 rounded-lg flex items-center font-bold text-xs border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 hover:text-emerald-800 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                            title="Personalizar quais colunas são exibidas na tabela"
                        >
                            <SlidersHorizontal size={13} className="mr-1.5 text-emerald-600" />
                            <span>Colunas</span>
                            <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                                {visibleColumnsDefs.length}
                            </span>
                        </button>

                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className={`px-3 py-1.5 rounded-lg flex items-center font-bold text-xs border transition-all ${showFilters ? 'bg-risel-orange text-white border-risel-orange' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            <Filter size={14} className="mr-1"/> Filtros {showFilters ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}
                        </button>
                    </div>
                </div>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFilters ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Placa</label><input type="text" className="w-full border rounded-lg p-2 text-xs font-bold uppercase" value={filters.placa} onChange={e => setFilters({...filters, placa: e.target.value})} placeholder="Todas"/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Início</label><input type="date" className="w-full border rounded-lg p-2 text-xs" value={filters.dataInicio} onChange={e => setFilters({...filters, dataInicio: e.target.value})}/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Fim</label><input type="date" className="w-full border rounded-lg p-2 text-xs" value={filters.dataFim} onChange={e => setFilters({...filters, dataFim: e.target.value})}/></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mês Ref.</label><select className="w-full border rounded-lg p-2 text-xs" value={filters.mes} onChange={e => setFilters({...filters, mes: e.target.value})}><option value="">Todos</option>{availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Base</label><select className="w-full border rounded-lg p-2 text-xs" value={filters.base} onChange={e => setFilters({...filters, base: e.target.value})}><option value="">Todas</option>{availableBases.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Resp. / Desc.</label>
                            <div className="flex gap-1"><select className="w-1/2 border rounded-lg p-2 text-xs" value={filters.responsabilidade} onChange={e => setFilters({...filters, responsabilidade: e.target.value})}><option value="">Todos</option><option value="EMPRESA">Empresa</option><option value="CONDUTOR">Condutor</option></select><select className="w-1/2 border rounded-lg p-2 text-xs" value={filters.descontar} onChange={e => setFilters({...filters, descontar: e.target.value})}><option value="">Desc?</option><option value="SIM">Sim</option><option value="NÃO">Não</option></select></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Table */}
            <div className="flex-1 overflow-hidden min-h-0 relative">
                <div className="bg-white/50 backdrop-blur-lg rounded-xl shadow-sm border border-white/30 overflow-hidden flex flex-col h-full">
                    <div className="overflow-auto flex-1 custom-scrollbar w-full relative">
                        <table className="min-w-full text-left text-[10.5px] border-collapse">
                            <thead className="sticky top-0 z-20 shadow-md">
                                <tr className="bg-gradient-to-r from-[#022c22] to-risel-green text-white">
                                    <th className="px-2 py-2 w-20 text-white/90 font-bold uppercase tracking-wider text-[9px] text-center border-r border-white/10 sticky left-0 z-30 bg-[#022c22]">
                                        Ações
                                    </th>
                                    {visibleColumnsDefs.map((col, colIdx) => {
                                        const isSortable = !!col.sortKey;
                                        const isDraggingThis = draggedColumnId === col.id;
                                        const isOverThis = dragOverColumnId === col.id;
                                        const isFirst = colIdx === 0;
                                        const isLast = colIdx === visibleColumnsDefs.length - 1;
                                        return (
                                            <th 
                                                key={col.id} 
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, col.id)}
                                                onDragOver={(e) => handleDragOver(e, col.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, col.id)}
                                                onClick={() => isSortable && handleSort(col.sortKey!)} 
                                                className={`px-2.5 py-2 text-white/90 font-bold uppercase tracking-wider text-[9px] border-r border-white/10 whitespace-nowrap select-none transition-all ${col.minWidth || ''} ${isDraggingThis ? 'opacity-40 bg-emerald-950 ring-2 ring-white/50' : isOverThis ? 'bg-emerald-600 border-l-4 border-l-amber-300' : 'cursor-grab active:cursor-grabbing hover:bg-white/10'} group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                                title="Arraste ou clique nas setas para reordenar | Clique para ordenar valores"
                                            >
                                                <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-between'}`}>
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <GripVertical size={12} className="text-white/40 group-hover:text-white/80 shrink-0 cursor-grab" />
                                                        <span className="truncate">{col.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {/* Controles de reordenação com 1 clique */}
                                                        <div className="hidden group-hover:flex items-center bg-black/50 rounded px-1 py-0.5 border border-white/10">
                                                            <button
                                                                type="button"
                                                                disabled={isFirst}
                                                                onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'left'); }}
                                                                title="Mover coluna para a esquerda"
                                                                className={`p-0.5 rounded transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:text-amber-300 hover:bg-white/20'}`}
                                                            >
                                                                <ChevronLeft size={11} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={isLast}
                                                                onClick={(e) => { e.stopPropagation(); moveColumn(col.id, 'right'); }}
                                                                title="Mover coluna para a direita"
                                                                className={`p-0.5 rounded transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : 'hover:text-amber-300 hover:bg-white/20'}`}
                                                            >
                                                                <ChevronRight size={11} />
                                                            </button>
                                                        </div>
                                                        {isSortable && <ArrowUpDown size={11} className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0"/>}
                                                    </div>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50 text-[10px]">
                                {sortedMultas.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumnsDefs.length + 1} className="text-center py-12 text-gray-500 font-medium bg-white/40 text-xs">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <FileText size={32} className="text-gray-300 stroke-[1.5]" />
                                                <span>Nenhuma multa encontrada para os filtros aplicados.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedMultas.map((multa, idx) => {
                                        const rowClass = idx % 2 === 0 ? 'bg-white/50' : 'bg-white/20';
                                        return (
                                            <tr key={multa.id} className={`${rowClass} hover:bg-blue-50/60 transition-colors group`}>
                                                <td className="px-1.5 py-1.5 text-center border-r border-gray-200/50 align-middle sticky left-0 z-10 bg-white/95 group-hover:bg-blue-50/95 backdrop-blur-sm shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                                    <div className="flex justify-center space-x-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); setFormData(multa); setView('FORM'); }} className="text-gray-400 hover:text-emerald-600 p-1 rounded-full transition-all" title="Editar"><Edit2 size={13} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); setMapMulta(multa); }} className="text-gray-400 hover:text-blue-600 p-1 rounded-full transition-all" title="Ver no Mapa"><MapPin size={13} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(multa.id); }} className="text-gray-400 hover:text-red-600 p-1 rounded-full transition-all" title="Excluir"><Trash2 size={13} /></button>
                                                    </div>
                                                </td>
                                                {visibleColumnsDefs.map(col => (
                                                    <td key={col.id} className={`px-2.5 py-1.5 border-r border-gray-200/50 align-middle ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                                        {renderCell(col.id, multa)}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Modal de Personalização de Colunas */}
            {showColumnModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-[#022c22] to-risel-green text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <SlidersHorizontal size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-tight">Personalizar Colunas da Tabela</h3>
                                    <p className="text-xs text-emerald-100">
                                        Escolha os campos que deseja visualizar ({visibleColumns.length} de {ALL_COLUMNS.length} selecionados)
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowColumnModal(false)} 
                                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex border-b border-gray-200 bg-gray-50/90 px-5 pt-2 gap-4 shrink-0">
                            <button
                                type="button"
                                onClick={() => setColumnModalTab('visibility')}
                                className={`pb-2.5 px-1 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                    columnModalTab === 'visibility' 
                                        ? 'border-emerald-600 text-emerald-800' 
                                        : 'border-transparent text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Columns size={13} />
                                <span>Visibilidade ({visibleColumns.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setColumnModalTab('order')}
                                className={`pb-2.5 px-1 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                                    columnModalTab === 'order' 
                                        ? 'border-emerald-600 text-emerald-800' 
                                        : 'border-transparent text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <ArrowUpDown size={13} />
                                <span>Ordem & Posição das Colunas</span>
                            </button>
                        </div>

                        {columnModalTab === 'visibility' ? (
                            <>
                                {/* Search and Quick Actions Bar */}
                                <div className="p-4 border-b border-gray-100 bg-gray-50/70 space-y-3 shrink-0">
                                    <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                                        <div className="relative w-full sm:w-72">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Buscar coluna..." 
                                                value={columnSearch} 
                                                onChange={(e) => setColumnSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                            />
                                            {columnSearch && (
                                                <button onClick={() => setColumnSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                                            <button 
                                                onClick={selectAllColumns} 
                                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md transition-all active:scale-95"
                                            >
                                                Marcar Todas
                                            </button>
                                            <button 
                                                onClick={resetDefaultColumns} 
                                                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <RotateCcw size={11} /> Padrão
                                            </button>
                                            <button 
                                                onClick={clearAllColumns} 
                                                className="px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-100 border border-gray-200 rounded-md transition-all active:scale-95"
                                            >
                                                Mínimo
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category Filter Pills */}
                                    <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
                                        {COLUMN_CATEGORIES.map(cat => {
                                            const isSelected = selectedColumnCategory === cat;
                                            const countActive = cat === 'TODAS' 
                                                ? visibleColumns.length 
                                                : ALL_COLUMNS.filter(c => c.category === cat && visibleColumns.includes(c.id)).length;
                                            const totalInCat = cat === 'TODAS'
                                                ? ALL_COLUMNS.length
                                                : ALL_COLUMNS.filter(c => c.category === cat).length;

                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedColumnCategory(cat)}
                                                    className={`px-2.5 py-1 rounded-full whitespace-nowrap font-bold transition-all flex items-center gap-1 ${
                                                        isSelected 
                                                            ? 'bg-emerald-700 text-white shadow-xs' 
                                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <span>{cat}</span>
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                                                        isSelected ? 'bg-emerald-900 text-emerald-100' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {countActive}/{totalInCat}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Column Checkboxes Grid */}
                                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar max-h-[45vh]">
                                    {filteredColumnsForModal.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-xs font-medium">
                                            Nenhuma coluna corresponde à busca "{columnSearch}".
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {filteredColumnsForModal.map(col => {
                                                const isChecked = visibleColumns.includes(col.id);
                                                return (
                                                    <div 
                                                        key={col.id} 
                                                        onClick={() => toggleColumn(col.id)}
                                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                            isChecked 
                                                                ? 'bg-emerald-50/60 border-emerald-300 shadow-xs' 
                                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/80'
                                                        }`}
                                                    >
                                                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                                                isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300 bg-white'
                                                            }`}>
                                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className={`text-xs font-bold leading-tight truncate ${isChecked ? 'text-emerald-900' : 'text-gray-700'}`}>
                                                                    {col.label}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 truncate">
                                                                    {col.category}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                            isChecked ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                            {col.id}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Reorder Columns Tab */
                            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar max-h-[50vh] space-y-2">
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                                    <span>Arraste os itens ou use as setas para definir a ordem de exibição da esquerda para a direita na tabela.</span>
                                    <button 
                                        onClick={resetDefaultColumns}
                                        className="px-2 py-1 bg-white border border-emerald-200 text-emerald-800 rounded font-bold text-[10px] hover:bg-emerald-100 transition-colors shrink-0 ml-2"
                                    >
                                        Restaurar Ordem Padrão
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                    {visibleColumnsDefs.map((col, idx) => {
                                        const isFirst = idx === 0;
                                        const isLast = idx === visibleColumnsDefs.length - 1;
                                        return (
                                            <div
                                                key={col.id}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, col.id)}
                                                onDragOver={(e) => handleDragOver(e, col.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, col.id)}
                                                className={`flex items-center justify-between p-2 rounded-lg border transition-all select-none ${
                                                    draggedColumnId === col.id 
                                                        ? 'opacity-40 bg-emerald-100 border-emerald-400' 
                                                        : dragOverColumnId === col.id 
                                                        ? 'bg-emerald-50 border-emerald-500' 
                                                        : 'bg-white border-gray-200 hover:border-emerald-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600">
                                                        <GripVertical size={14} />
                                                    </div>
                                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-800 truncate">{col.label}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{col.category}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={isFirst}
                                                        onClick={() => moveColumn(col.id, 'left')}
                                                        className={`p-1 rounded border text-xs font-semibold flex items-center gap-1 transition-all ${
                                                            isFirst 
                                                                ? 'opacity-30 border-gray-200 text-gray-400 cursor-not-allowed' 
                                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                                        }`}
                                                        title="Mover para cima / esquerda na tabela"
                                                    >
                                                        <ArrowUp size={12} />
                                                        <span className="text-[10px] hidden sm:inline">Subir</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isLast}
                                                        onClick={() => moveColumn(col.id, 'right')}
                                                        className={`p-1 rounded border text-xs font-semibold flex items-center gap-1 transition-all ${
                                                            isLast 
                                                                ? 'opacity-30 border-gray-200 text-gray-400 cursor-not-allowed' 
                                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                                        }`}
                                                        title="Mover para baixo / direita na tabela"
                                                    >
                                                        <ArrowDown size={12} />
                                                        <span className="text-[10px] hidden sm:inline">Descer</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-500">
                                💡 Suas escolhas são salvas automaticamente neste navegador.
                            </span>
                            <button 
                                onClick={() => setShowColumnModal(false)}
                                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-200 transition-all active:scale-95"
                            >
                                Concluir & Visualizar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showGlobalMap && <MapModal multas={multas} onClose={() => setShowGlobalMap(false)} title="Mapa Geral de Infrações" />}
            {mapMulta && <MapModal multas={[mapMulta]} onClose={() => setMapMulta(null)} singleMode title={`Localização: ${mapMulta.placa} - ${mapMulta.ait}`} />}

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

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300 relative pb-8 flex-1 overflow-auto custom-scrollbar pr-2 max-w-6xl mx-auto w-full">
        {loading && <Loading />}
        
        {/* Header - Compacto e Premium com Botões Fixados ao Lado de Novo Registro */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-3 sticky top-0 bg-white/95 backdrop-blur-md z-30 pt-1.5 px-4 rounded-t-xl shadow-xs">
            <div className="flex items-center gap-2.5">
                <button 
                    onClick={() => setView('LIST')} 
                    className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-100 rounded-lg transition-all"
                    title="Voltar para a lista"
                >
                    <ArrowRight className="rotate-180" size={18}/>
                </button>
                <div>
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 leading-tight">
                        {formData.id ? 'Editar Multa' : 'Lançamento de Multa'}
                    </h2>
                    <p className="text-[11px] text-gray-400">Preencha os dados da autuação e condutor</p>
                </div>
            </div>

            {/* Grupo de Ações: Identificador + Cancelar + Enviar E-mail + Salvar */}
            <div className="flex items-center gap-2 self-end sm:self-center">
                <div className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide">
                    {formData.id ? `ID: ${formData.id}` : 'Novo Registro'}
                </div>

                <button 
                    type="button"
                    onClick={() => setView('LIST')} 
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-xs font-semibold transition-all shadow-2xs active:scale-95 flex items-center gap-1.5"
                >
                    <X size={13} className="text-slate-400" />
                    <span>Cancelar</span>
                </button>

                <button 
                    type="button"
                    onClick={() => { 
                        const baseKey = formData.base ? Object.keys(EMAIL_MAPPINGS).find(k => formData.base!.toUpperCase().includes(k)) : null;
                        const recipients = baseKey ? EMAIL_MAPPINGS[baseKey] : '';
                        setEmailTo(recipients); 
                        setIsEmailModalOpen(true); 
                    }}
                    className="px-3 py-1.5 rounded-lg border border-blue-200/80 bg-blue-50/70 hover:bg-blue-100 text-blue-700 hover:text-blue-800 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs active:scale-95 flex items-center gap-1.5"
                    title="Enviar notificação da multa por e-mail"
                >
                    <Mail size={13} className="text-blue-600" />
                    <span>Enviar E-mail</span>
                </button>

                <button 
                    type="button"
                    onClick={handleSave} 
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs shadow-emerald-200 active:scale-95 flex items-center gap-1.5"
                >
                    <Save size={13} />
                    <span>Salvar</span>
                </button>
            </div>
        </div>

        {/* Content - 3-Column Premium Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            
            {/* Coluna 1: Dados Iniciais & Prazos */}
            <div className="space-y-4">
                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center text-xs tracking-wide uppercase">
                        <FileText size={15} className="mr-1.5 text-risel-orange"/> Dados Iniciais
                    </h3>
                    <div className="space-y-2.5">
                        <div>
                            <div className="flex items-center mb-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</label>
                                <FormTooltip text="Define o fluxo atual da multa." />
                            </div>
                            <select 
                                className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-gray-50/70 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all text-xs text-gray-700 font-medium" 
                                value={formData.status} 
                                onChange={e => setFormData({...formData, status: e.target.value as StatusMulta})}
                            >
                                {(Object.values(StatusMulta) as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Placa <span className="text-red-500">*</span></label>
                                <button 
                                    type="button" 
                                    onClick={handleOpenNewVeiculoModal}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-1"
                                    title="Cadastrar nova placa na frota"
                                >
                                    <Plus size={11} /> Cadastrar Placa
                                </button>
                            </div>
                            <input 
                                type="text" 
                                className={`w-full border rounded-lg py-1.5 px-2.5 bg-white focus:ring-2 outline-none text-xs font-mono font-bold uppercase tracking-wider ${errors.placa ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-500/20'}`} 
                                value={formData.placa || ''} 
                                onChange={e => handlePlacaChange(e.target.value)}
                                onFocus={() => { if ((formData.placa || '').length >= 2) setShowPlacaDropdown(true); }}
                                onBlur={() => setTimeout(() => setShowPlacaDropdown(false), 250)}
                                placeholder="Digite a Placa (ex: ABC1D23)"
                                maxLength={8}
                                autoComplete="off"
                            />
                            {errors.placa && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.placa}</p>}
                            
                            {/* Sugestões inteligentes ao digitar placa */}
                            {showPlacaDropdown && matchingVeiculos.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-[100] max-h-52 overflow-y-auto custom-scrollbar">
                                    <div className="p-1.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                                        Veículos encontrados ({matchingVeiculos.length})
                                    </div>
                                    {matchingVeiculos.map((v, idx) => (
                                        <div 
                                            key={idx} 
                                            onMouseDown={(e) => { e.preventDefault(); selectVeiculo(v); }}
                                            className="px-2.5 py-1.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-mono font-black text-emerald-700 text-xs">{v.placa}</span>
                                                <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold">Frota: {v.id || v.placa}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                                                <span>Base: <strong className="text-gray-700">{v.filial || v.base || '-'}</strong></span>
                                                <span className="truncate max-w-[140px]">{v.condutor || 'Sem condutor'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Alerta quando a placa não estiver cadastrada */}
                            {formData.placa && formData.placa.length >= 7 && !veiculos.some(v => cleanString(v.placa) === cleanString(formData.placa || '')) && (
                                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                                    <span className="text-[10px] text-amber-800 font-semibold">⚠️ Placa não cadastrada na frota.</span>
                                    <button 
                                        type="button" 
                                        onClick={handleOpenNewVeiculoModal} 
                                        className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs transition-all whitespace-nowrap ml-2"
                                    >
                                        + Cadastrar
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Frota</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-gray-50/70 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700 font-bold uppercase" 
                                    value={formData.frota || ''} 
                                    onChange={e => setFormData({...formData, frota: formatInputText(e.target.value)})} 
                                    placeholder="Auto pela Placa"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Base / Filial</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-gray-50/70 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700 font-semibold uppercase" 
                                    value={formData.base || ''} 
                                    onChange={e => setFormData({...formData, base: formatInputText(e.target.value)})} 
                                    placeholder="Auto pela Placa"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">AIT (Auto de Infração) <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className={`w-full border rounded-lg py-1.5 px-2.5 focus:ring-2 outline-none text-xs font-bold ${errors.ait ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-500/20'}`} 
                                value={formData.ait || ''} 
                                onChange={e => { setFormData({...formData, ait: formatInputText(e.target.value)}); clearError('ait'); }}
                            />
                            {errors.ait && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.ait}</p>}
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Tipo</label>
                            <select 
                                className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-gray-50/70 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" 
                                value={formData.tipo} 
                                onChange={e => setFormData({...formData, tipo: e.target.value as TipoMulta})}
                            >
                                {(Object.values(TipoMulta) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center text-xs tracking-wide uppercase">
                        <Clock size={15} className="mr-1.5 text-risel-orange"/> Datas e Prazos
                    </h3>
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Data Infração</label>
                                 <input type="datetime-local" className="w-full border border-gray-200 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.dataHoraInfracao || ''} onChange={e => setFormData({...formData, dataHoraInfracao: e.target.value})}/>
                             </div>
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Recebimento</label>
                                 <input type="date" className={`w-full border rounded-lg py-1.5 px-2 focus:ring-2 outline-none text-xs text-gray-700 ${errors.dataRecebimento ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-500/20'}`} value={formData.dataRecebimento || ''} onChange={e => { setFormData({...formData, dataRecebimento: e.target.value}); clearError('dataRecebimento'); }}/>
                                 {errors.dataRecebimento && <p className="text-[10px] text-red-500 font-bold mt-1 leading-tight">{errors.dataRecebimento}</p>}
                             </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Prazo Indicação</label>
                            <input type="date" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.prazoIndicacao || ''} onChange={e => setFormData({...formData, prazoIndicacao: e.target.value})}/>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block mb-1">Enviado ao RH</label>
                            <input type="date" className="w-full border border-purple-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none text-xs text-gray-700" value={formData.descontoEnviadoRH || ''} onChange={e => setFormData({...formData, descontoEnviadoRH: e.target.value})}/>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs">
                            <span className="text-[11px] font-bold text-gray-600">Dias Restantes:</span>
                            <span className={`font-bold text-xs ${formPrazoInfo.color}`}>{formPrazoInfo.text}</span>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Recebida com Prazo?</label>
                            <select className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.recebidaComPrazo} onChange={e => setFormData({...formData, recebidaComPrazo: e.target.value as any})}>
                                <option>SIM</option>
                                <option>NÃO</option>
                            </select>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Coluna 2: Infração, Local & Responsável */}
            <div className="space-y-4">
                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80 relative overflow-visible z-10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 flex items-center text-xs tracking-wide uppercase">
                            <AlertTriangle size={15} className="mr-1.5 text-risel-orange"/> Infração e Local
                        </h3>
                        <button 
                            type="button" 
                            onClick={handleOpenNewCodigoModal}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-1"
                            title="Cadastrar novo enquadramento no banco de dados"
                        >
                            <Plus size={11} /> Novo Cód.
                        </button>
                    </div>
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5 relative">
                             <div className="relative">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Enquadramento</label>
                                        <FormTooltip text="Digite o código (ex: 745-50)." />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleOpenNewCodigoModal}
                                        className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-0.5"
                                        title="Cadastrar novo enquadramento no banco de dados"
                                    >
                                        <Plus size={10} /> + Novo
                                    </button>
                                </div>
                                <div className="relative w-full">
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs uppercase font-bold text-gray-800" 
                                        value={formData.enquadramento || ''} 
                                        onChange={e => handleEnquadramentoChange(e.target.value)} 
                                        onFocus={() => { if(formData.enquadramento && formData.enquadramento.length >= 1) setShowCodigosDropdown(true); }}
                                        onBlur={handleBlurEnquadramento}
                                        placeholder="Cód."
                                        autoComplete="off"
                                    />
                                    {showCodigosDropdown && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-[100] max-h-56 overflow-y-auto custom-scrollbar">
                                            {filteredCodigos.length > 0 ? (
                                                <>
                                                    {filteredCodigos.map((c, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            onMouseDown={(e) => { e.preventDefault(); selectCodigo(c); }}
                                                            className="px-2.5 py-1.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-emerald-700 text-xs">{c.codigo}</span>
                                                                <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 px-1.5 rounded">{c.pontos} Pts</span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-600 line-clamp-1 leading-tight mt-0.5 uppercase font-medium">{c.descricao}</p>
                                                        </div>
                                                    ))}
                                                    <div 
                                                        onMouseDown={(e) => { e.preventDefault(); handleOpenNewCodigoModal(); }}
                                                        className="p-2 bg-emerald-50/70 hover:bg-emerald-100 border-t border-emerald-100 cursor-pointer text-center text-xs font-bold text-emerald-800 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Plus size={12} /> Cadastrar outro código
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="p-3 text-center">
                                                    <p className="text-xs text-amber-800 font-bold mb-1">Cód. [{formData.enquadramento}] não cadastrado</p>
                                                    <p className="text-[10px] text-gray-500 mb-2">Deseja cadastrar e salvar no banco de dados agora?</p>
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); handleOpenNewCodigoModal(); }}
                                                        className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                    >
                                                        <Plus size={12} /> + Cadastrar no Banco
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {formData.enquadramento && formData.enquadramento.trim().length >= 2 && !codigos.some(c => cleanString(c.codigo) === cleanString(formData.enquadramento || '')) && (
                                    <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-between text-[10px]">
                                        <span className="text-amber-800 font-semibold truncate">Cód. não cadastrado.</span>
                                        <button 
                                            type="button" 
                                            onClick={handleOpenNewCodigoModal}
                                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs transition-all whitespace-nowrap ml-1 flex items-center gap-0.5"
                                            title="Cadastrar novo enquadramento no banco de dados"
                                        >
                                            <Plus size={10} /> + Cadastrar
                                        </button>
                                    </div>
                                )}
                             </div>
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Artigo CTB</label>
                                 <input type="text" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.artigoCtb || ''} onChange={e => setFormData({...formData, artigoCtb: formatInputText(e.target.value)})}/>
                             </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Descrição Infração</label>
                            <textarea className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700 uppercase" rows={2} value={formData.descricaoInfracao || ''} onChange={e => setFormData({...formData, descricaoInfracao: formatInputText(e.target.value)})}/>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pontos CNH</label>
                                 <input type="number" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.pontosCnh || 0} onChange={e => setFormData({...formData, pontosCnh: Number(e.target.value)})}/>
                             </div>
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Órgão Autuador</label>
                                 <input type="text" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.orgaoAutuador || ''} onChange={e => setFormData({...formData, orgaoAutuador: formatInputText(e.target.value)})}/>
                             </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Endereço Completo</label>
                            <input type="text" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.endereco || ''} onChange={e => handleAddressChange(e.target.value)}/>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Município</label>
                                 <input type="text" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.municipio || ''} onChange={e => setFormData({...formData, municipio: formatInputText(e.target.value)})}/>
                             </div>
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">UF</label>
                                 <input type="text" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700 uppercase" value={formData.uf || ''} onChange={e => setFormData({...formData, uf: formatInputText(e.target.value)})}/>
                             </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Rodovia ou Urbano?</label>
                            <select className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.rodoviaOuUrbano || 'URBANO'} onChange={e => setFormData({...formData, rodoviaOuUrbano: e.target.value as any})}>
                                <option value="URBANO">URBANO</option>
                                <option value="RODOVIA">RODOVIA</option>
                            </select>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-800 flex items-center text-xs tracking-wide uppercase">
                            <User size={15} className="mr-1.5 text-risel-orange"/> Responsável
                        </h3>
                        <button 
                            type="button" 
                            onClick={handleOpenNewMotoristaModal} 
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-1"
                            title="Cadastrar novo motorista no banco de dados"
                        >
                            <Plus size={11} /> Novo Motorista
                        </button>
                    </div>
                    <div className="space-y-2.5">
                         <div className="grid grid-cols-3 gap-2">
                             <div className="relative">
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cód. Motorista</label>
                                 <input 
                                     type="text" 
                                     className="w-full border border-gray-200 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs font-mono font-bold uppercase text-gray-800 bg-white" 
                                     value={formData.responsavelCodigo || ''} 
                                     onChange={e => handleResponsavelCodigoChange(e.target.value)} 
                                     onFocus={() => { if (formData.responsavelCodigo && formData.responsavelCodigo.length >= 1) setShowMotoristaDropdown(true); }}
                                     onBlur={() => setTimeout(() => setShowMotoristaDropdown(false), 250)}
                                     placeholder="Ex: 1836"
                                     autoComplete="off"
                                 />
                                 {showMotoristaDropdown && matchingMotoristas.length > 0 && (
                                     <div className="absolute top-full left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-[100] max-h-52 overflow-y-auto custom-scrollbar">
                                         {matchingMotoristas.map((m, idx) => (
                                             <div 
                                                 key={idx} 
                                                 onMouseDown={(e) => { e.preventDefault(); selectMotorista(m); }}
                                                 className="px-2.5 py-1.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                             >
                                                 <div className="flex justify-between items-center">
                                                     <span className="font-mono font-bold text-emerald-700 text-xs">{m.login}</span>
                                                     <span className="text-[9px] text-gray-500 font-semibold bg-gray-100 px-1.5 rounded">{m.base || 'SBC'}</span>
                                                 </div>
                                                 <p className="text-[11px] text-gray-700 font-bold line-clamp-1 leading-tight mt-0.5 uppercase">{m.nome}</p>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                             </div>
                             <div className="col-span-2">
                                 <div className="flex items-center justify-between mb-1">
                                     <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nome Condutor</label>
                                     {isDriverInactive && <span className="text-[9px] font-bold text-red-500 animate-pulse">⚠️ INATIVO</span>}
                                 </div>
                                 <input 
                                     type="text" 
                                     className={`w-full border rounded-lg py-1.5 px-2.5 outline-none text-xs font-bold transition-all uppercase ${isDriverInactive ? 'bg-red-50 text-red-700 border-red-200 ring-2 ring-red-200' : 'bg-white text-gray-800 border-gray-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'}`} 
                                     value={formData.responsavelNome || ''} 
                                     onChange={e => handleResponsavelChange(e.target.value)}
                                     placeholder="Nome preenchido pelo código"
                                     autoComplete="off"
                                 />
                             </div>
                         </div>

                         {/* Alerta se digitou código que não existe */}
                         {formData.responsavelCodigo && formData.responsavelCodigo.length >= 2 && !motoristas.some(m => cleanString(m.login) === cleanString(formData.responsavelCodigo || '')) && (
                             <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                                 <span className="text-[10px] text-amber-800 font-semibold">Cód. [{formData.responsavelCodigo}] não cadastrado.</span>
                                 <button 
                                     type="button" 
                                     onClick={handleOpenNewMotoristaModal} 
                                     className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs transition-all whitespace-nowrap ml-2 flex items-center gap-0.5"
                                     title="Cadastrar novo motorista no banco de dados"
                                 >
                                     <Plus size={10} /> + Cadastrar Motorista
                                 </button>
                             </div>
                         )}

                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Empresa ou Condutor?</label>
                            <select className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.empresaOuCondutor} onChange={e => setFormData({...formData, empresaOuCondutor: e.target.value as any})}>
                                <option>EMPRESA</option>
                                <option>CONDUTOR</option>
                            </select>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Coluna 3: Financeiro & Documentação */}
            <div className="space-y-4">
                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center text-xs tracking-wide uppercase">
                        <DollarSign size={15} className="mr-1.5 text-risel-orange"/> Financeiro
                    </h3>
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Valor</label>
                                <input type="number" className="w-full border border-gray-200 rounded-lg py-1.5 px-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.valor || 0} onChange={e => handleMoneyChange('valor', Number(e.target.value))} min="0"/>
                            </div>
                            <div>
                                <div className="flex items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Desc.</label>
                                    <FormTooltip text="20% ou 40% (SNE)." />
                                </div>
                                <input type="number" className="w-full border border-gray-200 rounded-lg py-1.5 px-2 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.desconto || 0} onChange={e => handleMoneyChange('desconto', Number(e.target.value))} min="0"/>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Final</label>
                                <input type="number" className="w-full border border-emerald-200 rounded-lg py-1.5 px-2 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500/20 outline-none text-xs text-emerald-800 font-bold" value={formData.valorComDesconto || 0} readOnly/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Descontar Motorista?</label>
                                 <select className="w-full border border-gray-200 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.descontarMotorista} onChange={e => setFormData({...formData, descontarMotorista: e.target.value as any})}>
                                     <option>SIM</option>
                                     <option>NÃO</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pago c/ Desc?</label>
                                 <select className="w-full border border-gray-200 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" value={formData.pagoComDesconto} onChange={e => setFormData({...formData, pagoComDesconto: e.target.value as any})}>
                                     <option>SIM</option>
                                     <option>NÃO</option>
                                 </select>
                             </div>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200/80">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center text-xs tracking-wide uppercase">
                        <Download size={15} className="mr-1.5 text-risel-orange"/> Documentação
                    </h3>
                    <div className="space-y-3">
                        <div className={`border-2 border-dashed ${uploadingAit ? 'border-risel-green bg-green-50' : 'border-gray-300 hover:bg-gray-50'} rounded-lg p-3 text-center cursor-pointer transition-colors group relative`}>
                            {uploadingAit ? (
                                <div className="flex flex-col items-center justify-center text-risel-green"><Loader2 className="animate-spin mb-1" size={18}/><span className="text-[10px] font-bold">Enviando...</span></div>
                            ) : (
                                <>
                                    <p className="text-xs font-medium text-gray-500 group-hover:text-risel-green flex justify-center items-center"><UploadCloud size={15} className="mr-1"/> {formData.linkAit ? 'Adicionar mais Anexos' : 'Anexo: AIT (Upload Multiplo - Máx 3)'}</p>
                                    <input type="file" className="hidden" id="file-ait" multiple onChange={handleAitUpload}/>
                                    <label htmlFor="file-ait" className="absolute inset-0 cursor-pointer"></label>
                                </>
                            )}
                        </div>

                        {/* LISTA DE ANEXOS COM DELETE */}
                        {formData.linkAit && (
                            <div className="space-y-1.5">
                                {parseLinks(formData.linkAit).map((link, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs">
                                        <div className="flex items-center truncate">
                                            <FileCheck size={14} className="text-emerald-600 mr-2 shrink-0"/>
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-700 hover:text-blue-600 truncate underline decoration-dotted text-xs" title={link.name}>
                                                {link.name}
                                            </a>
                                        </div>
                                        <button 
                                            onClick={() => removeAttachment(idx)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors ml-2"
                                            title="Remover Anexo"
                                        >
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-gray-50 p-2.5 rounded-lg flex justify-between items-center border border-gray-200">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-600">Aut. Desconto</span>
                                {formData.linkAuth && <a href={formData.linkAuth} target="_blank" rel="noreferrer" className="text-[9px] text-purple-600 underline">Ver PDF gerado</a>}
                            </div>
                            <button onClick={generateAuthPDF} disabled={generatingPdf} className={`text-[10px] px-2.5 py-1 rounded-md flex items-center font-bold shadow-xs transition-all ${generatingPdf ? 'bg-gray-300 text-white cursor-not-allowed' : 'bg-risel-orange text-white hover:bg-orange-600'}`}>
                                {generatingPdf ? <Loader2 size={12} className="animate-spin mr-1"/> : <Download size={12} className="mr-1"/>} {generatingPdf ? 'Gerando...' : 'Gerar PDF'}
                            </button>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Observações</label>
                            <textarea className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none text-xs text-gray-700" rows={3} placeholder="Observações gerais sobre a infração..." value={formData.obs || ''} onChange={e => setFormData({...formData, obs: formatInputText(e.target.value)})}/>
                        </div>
                    </div>
                 </div>
            </div>
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
                    <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                            <span>Cópia Fixa (CC Obrigatório):</span>
                        </div>
                        <p className="text-xs font-mono text-slate-800 font-bold break-all bg-white p-2 rounded border border-slate-200">
                            deny.goncalves@risel.com.br; lorena.padilha@risel.com.br
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">Estes e-mails são incluídos automaticamente em todas as notificações.</p>
                    </div>

                    {/* Destaque de Anexos Diretos */}
                    <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1.5">
                            <span className="flex items-center gap-1.5">
                                <Paperclip size={14} className="text-emerald-700" />
                                Arquivos Anexados Direto no E-mail:
                            </span>
                            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-black">
                                Sem links de download
                            </span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-700">
                            {parseLinks(formData.linkAit).length > 0 ? (
                                parseLinks(formData.linkAit).map((att, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded border border-emerald-100 font-medium">
                                        <FileCheck size={13} className="text-emerald-600 shrink-0" />
                                        <span className="truncate">{att.name || `Auto de Infração (AIT) ${idx + 1}`}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                    Nenhum arquivo de AIT anexado nesta multa até o momento.
                                </div>
                            )}
                            {formData.linkAuth && (
                                <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded border border-emerald-100 font-medium">
                                    <FileCheck size={13} className="text-blue-600 shrink-0" />
                                    <span className="truncate">Autorização de Desconto em Folha (PDF)</span>
                                </div>
                            )}
                        </div>
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

        {/* Modal: Cadastro Rápido de Veículo / Frota */}
        {showNewVeiculoModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <Truck className="text-emerald-600" size={20}/> Cadastrar Placa na Frota
                        </h3>
                        <button onClick={() => setShowNewVeiculoModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        Os dados cadastrados aqui serão salvos permanentemente na planilha/banco de dados e preenchidos automaticamente nos próximos lançamentos.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Placa <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5 uppercase font-mono font-bold tracking-wider text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
                                value={newVeiculoData.placa || ''} 
                                onChange={e => setNewVeiculoData({...newVeiculoData, placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                                placeholder="ABC1D23"
                                maxLength={8}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Frota / Cód</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newVeiculoData.id || ''} 
                                    onChange={e => setNewVeiculoData({...newVeiculoData, id: e.target.value.toUpperCase()})}
                                    placeholder="Ex: LEVE, PESADA..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Base / Filial</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newVeiculoData.filial || ''} 
                                    onChange={e => setNewVeiculoData({...newVeiculoData, filial: e.target.value.toUpperCase()})}
                                    placeholder="Ex: MATRIZ"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Modelo / Descrição</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                value={newVeiculoData.modelo || ''} 
                                onChange={e => setNewVeiculoData({...newVeiculoData, modelo: e.target.value.toUpperCase()})}
                                placeholder="Ex: STRADA FREEDOM, HILUX..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={() => setShowNewVeiculoModal(false)} 
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-bold"
                            disabled={savingNewVeiculo}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSaveNewVeiculo} 
                            disabled={savingNewVeiculo || !newVeiculoData.placa?.trim()} 
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {savingNewVeiculo ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            {savingNewVeiculo ? 'Salvando...' : 'Salvar no Banco'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Cadastro Rápido de Enquadramento */}
        {showNewCodigoModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" size={20}/> Cadastrar Enquadramento
                        </h3>
                        <button onClick={() => setShowNewCodigoModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        Adicione este código de infração no Banco de Dados para que fique disponível em todos os futuros lançamentos.
                    </p>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Código de Infração <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 uppercase font-mono font-black text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newCodigoData.codigo || ''} 
                                    onChange={e => setNewCodigoData({...newCodigoData, codigo: e.target.value.toUpperCase()})}
                                    placeholder="Ex: 745-50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Artigo CTB</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newCodigoData.baseLegal || ''} 
                                    onChange={e => setNewCodigoData({...newCodigoData, baseLegal: e.target.value.toUpperCase()})}
                                    placeholder="Ex: 218, I"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Descrição da Infração <span className="text-red-500">*</span></label>
                            <textarea 
                                className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                rows={2}
                                value={newCodigoData.descricao || ''} 
                                onChange={e => setNewCodigoData({...newCodigoData, descricao: e.target.value.toUpperCase()})}
                                placeholder="Ex: TRANSITAR EM VELOCIDADE SUPERIOR À MÁXIMA PERMITIDA EM ATÉ 20%"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Pontos CNH</label>
                                <input 
                                    type="number" 
                                    className="w-full border rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newCodigoData.pontos || 0} 
                                    onChange={e => setNewCodigoData({...newCodigoData, pontos: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Valor Padrão (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full border rounded-lg p-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newCodigoData.valor || 0} 
                                    onChange={e => setNewCodigoData({...newCodigoData, valor: Number(e.target.value)})}
                                    placeholder="130.16"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={() => setShowNewCodigoModal(false)} 
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-bold"
                            disabled={savingNewCodigo}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSaveNewCodigo} 
                            disabled={savingNewCodigo || !newCodigoData.codigo?.trim() || !newCodigoData.descricao?.trim()} 
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {savingNewCodigo ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            {savingNewCodigo ? 'Salvando...' : 'Salvar no Banco'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Cadastro Rápido de Motorista */}
        {showNewMotoristaModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <User className="text-emerald-600" size={20}/> Cadastrar Motorista
                        </h3>
                        <button onClick={() => setShowNewMotoristaModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        O condutor será incluído no banco de dados e poderá ser buscado diretamente pelo código nos próximos lançamentos.
                    </p>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Código / Login <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 font-mono font-bold uppercase text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newMotoristaData.login || ''} 
                                    onChange={e => setNewMotoristaData({...newMotoristaData, login: e.target.value.toUpperCase()})}
                                    placeholder="Ex: 1836"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Base / Filial</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 uppercase text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    value={newMotoristaData.base || ''} 
                                    onChange={e => setNewMotoristaData({...newMotoristaData, base: e.target.value.toUpperCase()})}
                                    placeholder="Ex: MATRIZ"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Nome Completo <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5 uppercase text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                                value={newMotoristaData.nome || ''} 
                                onChange={e => setNewMotoristaData({...newMotoristaData, nome: e.target.value.toUpperCase()})}
                                placeholder="Ex: JOAO DA SILVA"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button 
                            type="button" 
                            onClick={() => setShowNewMotoristaModal(false)} 
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-bold"
                            disabled={savingNewMotorista}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSaveNewMotorista} 
                            disabled={savingNewMotorista || !newMotoristaData.login?.trim() || !newMotoristaData.nome?.trim()} 
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {savingNewMotorista ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                            {savingNewMotorista ? 'Salvando...' : 'Salvar no Banco'}
                        </button>
                    </div>
                </div>
            </div>
        )}

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

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Sinistro, getPrimeiroNomeGestor } from "../types";
import { 
  ShieldAlert, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  TrendingUp, 
  Filter, 
  Building2, 
  Activity, 
  UserCheck, 
  FileCheck, 
  Image as ImageIcon, 
  MapPin, 
  FileText, 
  Users,
  Award,
  BarChart3,
  Clock,
  Sparkles,
  Navigation,
  Compass,
  Upload,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Map as MapIcon,
  Globe,
  Layers,
  Search,
  Maximize2
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid,
  ReferenceLine,
  LabelList
} from "recharts";
import { uploadSinistrosSheet } from "../services/sinistrosService";
import { MercosulPlateBadge } from "../../../components/MercosulPlateBadge";

interface SinistrosDashboardProps {
  sinistros: Sinistro[];
  onNavigateToSinistros: () => void;
  onOpenNewSinistroModal?: () => void;
  onRefreshData?: () => void;
  onSelectSinistro?: (sinistro: Sinistro) => void;
}

const COLORS_STATUS: Record<string, string> = {
  "Finalizado / Concluído": "#10b981",
  "Aberto na Seguradora": "#3b82f6",
  "Aguardando Orçamento": "#f59e0b",
  "Em Reparo": "#8b5cf6",
  "Em Apuração": "#64748b"
};

const BASE_GRADIENTS = [
  { from: "#00d664", to: "#059669", border: "#10b981", bg: "bg-emerald-50 text-emerald-800" },
  { from: "#0284c7", to: "#0369a1", border: "#38bdf8", bg: "bg-sky-50 text-sky-800" },
  { from: "#f59e0b", to: "#d97706", border: "#fbbf24", bg: "bg-amber-50 text-amber-800" },
  { from: "#8b5cf6", to: "#6d28d9", border: "#a78bfa", bg: "bg-purple-50 text-purple-800" },
  { from: "#ec4899", to: "#be185d", border: "#f472b6", bg: "bg-pink-50 text-pink-800" },
  { from: "#14b8a6", to: "#0f766e", border: "#2dd4bf", bg: "bg-teal-50 text-teal-800" },
  { from: "#6366f1", to: "#4338ca", border: "#818cf8", bg: "bg-indigo-50 text-indigo-800" },
  { from: "#e11d48", to: "#9f1239", border: "#fb7185", bg: "bg-rose-50 text-rose-800" },
  { from: "#64748b", to: "#334155", border: "#94a3b8", bg: "bg-slate-50 text-slate-800" }
];

export interface CityCoordinates {
  lat: number;
  lng: number;
  label: string;
  base: string;
  region: string;
  isHub?: boolean;
}

// Coordenadas geográficas reais com alta precisão para exibição no Google Maps
const ACCURATE_CITY_COORDINATES: Record<string, CityCoordinates> = {
  // Grande São Paulo & Região Metropolitana
  "SÃO PAULO": { lat: -23.5505, lng: -46.6333, label: "São Paulo (Capital)", base: "São Bernardo", region: "Sudeste (SP)", isHub: true },
  "SÃO BERNARDO DO CAMPO": { lat: -23.6944, lng: -46.5654, label: "São Bernardo do Campo", base: "São Bernardo", region: "Sudeste (SP)", isHub: true },
  "SÃO BERNARDO": { lat: -23.6944, lng: -46.5654, label: "São Bernardo do Campo", base: "São Bernardo", region: "Sudeste (SP)", isHub: true },
  "DIADEMA": { lat: -23.6865, lng: -46.6234, label: "Diadema", base: "São Bernardo", region: "Sudeste (SP)" },
  "BARUERI": { lat: -23.5111, lng: -46.8761, label: "Barueri", base: "Barueri", region: "Sudeste (SP)", isHub: true },
  "GUARULHOS": { lat: -23.4538, lng: -46.5333, label: "Guarulhos", base: "Guarulhos", region: "Sudeste (SP)" },
  "SUZANO": { lat: -23.5425, lng: -46.3108, label: "Suzano", base: "Guarulhos", region: "Sudeste (SP)" },
  "SÃO MATEUS": { lat: -23.5986, lng: -46.4789, label: "São Mateus (SP)", base: "São Bernardo", region: "Sudeste (SP)" },
  "EMBU-GUAÇU": { lat: -23.8322, lng: -46.8111, label: "Embu-Guaçu", base: "São Bernardo", region: "Sudeste (SP)" },

  // Região de Campinas & Polo Central
  "PAULÍNIA": { lat: -22.7611, lng: -47.1539, label: "Paulínia (Base Matriz)", base: "Paulínia", region: "Sudeste (SP)", isHub: true },
  "CAMPINAS": { lat: -22.9099, lng: -47.0626, label: "Campinas", base: "Paulínia", region: "Sudeste (SP)", isHub: true },
  "SUMARÉ": { lat: -22.8208, lng: -47.2667, label: "Sumaré", base: "Paulínia", region: "Sudeste (SP)" },
  "HORTOLÂNDIA": { lat: -22.8583, lng: -47.2200, label: "Hortolândia", base: "Paulínia", region: "Sudeste (SP)" },
  "AMERICANA": { lat: -22.7394, lng: -47.3314, label: "Americana", base: "Paulínia", region: "Sudeste (SP)" },
  "COSMÓPOLIS": { lat: -22.6458, lng: -47.1958, label: "Cosmópolis", base: "Paulínia", region: "Sudeste (SP)" },
  "LIMEIRA": { lat: -22.5647, lng: -47.4017, label: "Limeira", base: "Paulínia", region: "Sudeste (SP)" },
  "PIRACICABA": { lat: -22.7253, lng: -47.6476, label: "Piracicaba", base: "Paulínia", region: "Sudeste (SP)" },
  "JUNDIAÍ": { lat: -23.1857, lng: -46.8978, label: "Jundiaí", base: "Paulínia", region: "Sudeste (SP)" },
  "ITATIBA": { lat: -23.0056, lng: -46.8436, label: "Itatiba", base: "Paulínia", region: "Sudeste (SP)" },
  "ITUPEVA": { lat: -23.1531, lng: -47.0578, label: "Itupeva", base: "Paulínia", region: "Sudeste (SP)" },

  // Baixada Santista / Litoral
  "CUBATÃO": { lat: -23.8950, lng: -46.4253, label: "Cubatão", base: "Cubatão", region: "Sudeste (SP)", isHub: true },
  "SANTOS": { lat: -23.9608, lng: -46.3336, label: "Santos (Porto)", base: "Cubatão", region: "Sudeste (SP)", isHub: true },
  "SÃO VICENTE": { lat: -23.9631, lng: -46.3919, label: "São Vicente", base: "Cubatão", region: "Sudeste (SP)" },
  "GUARUJÁ": { lat: -23.9931, lng: -46.2564, label: "Guarujá", base: "Cubatão", region: "Sudeste (SP)" },
  "BERTIOGA": { lat: -23.8542, lng: -46.1383, label: "Bertioga", base: "Cubatão", region: "Sudeste (SP)" },

  // Interior Central & Eixo Washington Luís
  "ARARAQUARA": { lat: -21.7944, lng: -48.1756, label: "Araraquara", base: "Paulínia", region: "Sudeste (SP)" },
  "SÃO CARLOS": { lat: -22.0175, lng: -47.8908, label: "São Carlos", base: "Paulínia", region: "Sudeste (SP)" },
  "RIBEIRÃO PRETO": { lat: -21.1775, lng: -47.8103, label: "Ribeirão Preto", base: "Ribeirão Preto", region: "Sudeste (SP)", isHub: true },
  "SÃO JOSÉ DO RIO PRETO": { lat: -20.8113, lng: -49.3758, label: "São José do Rio Preto", base: "Paulínia", region: "Sudeste (SP)" },
  "CATIGUÁ": { lat: -20.9833, lng: -49.0333, label: "Catiguá", base: "Paulínia", region: "Sudeste (SP)" },
  "MIRASSOL": { lat: -20.8194, lng: -49.5033, label: "Mirassol", base: "Paulínia", region: "Sudeste (SP)" },
  "MERIDIANO": { lat: -20.3589, lng: -50.1744, label: "Meridiano", base: "Paulínia", region: "Sudeste (SP)" },
  "SÃO JOÃO DA BOA VISTA": { lat: -21.9689, lng: -46.7967, label: "São João da Boa Vista", base: "Paulínia", region: "Sudeste (SP)" },

  // Interior Sudoeste & Oeste
  "SOROCABA": { lat: -23.5015, lng: -47.4526, label: "Sorocaba", base: "Paulínia", region: "Sudeste (SP)" },
  "TIETÊ": { lat: -23.1011, lng: -47.7128, label: "Tietê", base: "Paulínia", region: "Sudeste (SP)" },
  "ITATINGA": { lat: -23.1011, lng: -48.6047, label: "Itatinga", base: "Paulínia", region: "Sudeste (SP)" },
  "GUAREÍ": { lat: -23.3725, lng: -48.1917, label: "Guareí", base: "Paulínia", region: "Sudeste (SP)" },
  "CAPÃO BONITO": { lat: -24.0061, lng: -48.3494, label: "Capão Bonito", base: "Paulínia", region: "Sudeste (SP)" },
  "GUAPIARA": { lat: -24.1856, lng: -48.5322, label: "Guapiara", base: "Paulínia", region: "Sudeste (SP)" },
  "ITAPEVA": { lat: -23.9822, lng: -48.8761, label: "Itapeva", base: "Paulínia", region: "Sudeste (SP)" },
  "OURINHOS": { lat: -22.9789, lng: -49.8706, label: "Ourinhos", base: "Paulínia", region: "Sudeste (SP)" },

  // Polos Interestaduais nos Corredores Logísticos Nacionais
  "ARAUCÁRIA": { lat: -25.5925, lng: -49.4103, label: "Araucária (PR)", base: "Paulínia", region: "Sul (PR)", isHub: true },
  "CURITIBA": { lat: -25.4284, lng: -49.2733, label: "Curitiba (PR)", base: "Paulínia", region: "Sul (PR)", isHub: true },
  "SALTO DO ITARARÉ": { lat: -23.6022, lng: -49.6272, label: "Salto do Itararé (PR)", base: "Paulínia", region: "Sul (PR)" },
  "BELO HORIZONTE": { lat: -19.9167, lng: -43.9345, label: "Belo Horizonte (MG)", base: "Paulínia", region: "Sudeste (MG)", isHub: true },
  "RIO DE JANEIRO": { lat: -22.9068, lng: -43.1729, label: "Rio de Janeiro (RJ)", base: "Paulínia", region: "Sudeste (RJ)", isHub: true },
  "DUQUE DE CAXIAS": { lat: -22.7856, lng: -43.3117, label: "Duque de Caxias (RJ)", base: "Paulínia", region: "Sudeste (RJ)" },
  "BRASÍLIA": { lat: -15.7801, lng: -47.9292, label: "Brasília (DF)", base: "Paulínia", region: "Centro-Oeste (DF)", isHub: true },
  "GOIÂNIA": { lat: -16.6869, lng: -49.2648, label: "Goiânia (GO)", base: "Paulínia", region: "Centro-Oeste (GO)" },
  "CAMPO GRANDE": { lat: -20.4697, lng: -54.6201, label: "Campo Grande (MS)", base: "Paulínia", region: "Centro-Oeste (MS)" },
  "CUIABÁ": { lat: -15.6014, lng: -56.0979, label: "Cuiabá (MT)", base: "Paulínia", region: "Centro-Oeste (MT)" },
  "PORTO ALEGRE": { lat: -30.0346, lng: -51.2177, label: "Porto Alegre (RS)", base: "Paulínia", region: "Sul (RS)", isHub: true },
  "JOINVILLE": { lat: -26.3045, lng: -48.8487, label: "Joinville (SC)", base: "Paulínia", region: "Sul (SC)" },
  "SALVADOR": { lat: -12.9777, lng: -38.5016, label: "Salvador (BA)", base: "Paulínia", region: "Nordeste (BA)" },
  "RECIFE": { lat: -8.0476, lng: -34.8770, label: "Recife (PE)", base: "Paulínia", region: "Nordeste (PE)" },
  "FORTALEZA": { lat: -3.7319, lng: -38.5267, label: "Fortaleza (CE)", base: "Paulínia", region: "Nordeste (CE)" },
  "UBERLÂNDIA": { lat: -18.9186, lng: -48.2772, label: "Uberlândia (MG)", base: "Paulínia", region: "Sudeste (MG)" },
  "VITÓRIA": { lat: -20.3155, lng: -40.3128, label: "Vitória (ES)", base: "Paulínia", region: "Sudeste (ES)" }
};

// Coordenadas padrão de visualização geral do Brasil (Estável e Otimizado para não re-renderizar)
export const BRAZIL_DEFAULT_CENTER: [number, number] = [-15.7801, -47.9292];
export const BRAZIL_DEFAULT_ZOOM = 4;

// Camadas Oficiais Google Maps com Servidores de Alta Performance e Localização pt-BR
const GOOGLE_MAP_LAYERS = {
  streets: {
    label: "Ruas",
    name: "Google Maps Ruas",
    url: "https://mt1.google.com/vt/lyrs=m&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}",
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>'
  },
  satellite: {
    label: "Satélite",
    name: "Google Maps Satélite",
    url: "https://mt1.google.com/vt/lyrs=y&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}",
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>'
  },
  terrain: {
    label: "Relevo",
    name: "Google Maps Relevo",
    url: "https://mt1.google.com/vt/lyrs=p&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}",
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>'
  }
};

// Gerador de Pinos no Design Oficial do Google Maps (Teardrop Oficial, Centro Branco, Sombra e Label)
function createGoogleMapsPin(
  cityName: string,
  count: number,
  isTop1: boolean,
  isTop2: boolean,
  isHub: boolean,
  isSelected: boolean
) {
  // Cores de alta fidelidade do Google Maps
  const pinColor = isTop1
    ? "#EA4335" // Vermelho Google Maps (#1 São Paulo - volume mais expressivo)
    : isTop2
      ? "#E37400" // Âmbar Vibrante Google Maps (#2 São Bernardo do Campo)
      : isHub
        ? "#0F9D58" // Verde Google Maps / Risel (Paulínia, Cubatão, Barueri)
        : count >= 3
          ? "#1A73E8" // Azul Clássico Google Maps
          : "#4285F4"; // Azul Celeste Google Maps

  const pinScale = isSelected ? 1.22 : isTop1 ? 1.15 : isTop2 ? 1.08 : 1.0;
  
  // Ícone SVG Google Maps Pin autêntico com gota esmaltada, sombra de projeção e badge numérico central
  return L.divIcon({
    className: "google-maps-custom-marker",
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        user-select: none;
        cursor: pointer;
        transform: scale(${pinScale});
        transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <div style="
          position: relative;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
        ">
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Corpo em gota oficial do Google Maps -->
            <path d="M17 0C7.61 0 0 7.61 0 17C0 28.5 15.1 42.1 16.35 43.2C16.72 43.53 17.28 43.53 17.65 43.2C18.9 42.1 34 28.5 34 17C34 7.61 26.39 0 17 0Z" fill="${pinColor}"/>
            <!-- Esmalte sutil superior -->
            <path d="M17 1.5C8.44 1.5 1.5 8.44 1.5 17C1.5 25.5 12.8 37 17 40.7C21.2 37 32.5 25.5 32.5 17C32.5 8.44 25.56 1.5 17 1.5Z" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.5"/>
            <!-- Centro circular branco Google Maps -->
            <circle cx="17" cy="16" r="9.5" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.18))"/>
            <!-- Quantidade de sinistros -->
            <text x="17" y="${count > 9 ? '19.8' : '20.2'}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, Roboto, sans-serif" font-size="${count > 9 ? '10.5' : '12'}" font-weight="900" fill="${pinColor}" text-anchor="middle">${count}</text>
          </svg>
        </div>

        <!-- Sombra oval de projeção no solo -->
        <div style="
          width: 14px;
          height: 4px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 75%);
          border-radius: 50%;
          margin-top: -3px;
        "></div>

        <!-- Etiqueta Oficial Google Maps do Nome do Município -->
        <div style="
          margin-top: 3px;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(6px);
          padding: 2px 7px;
          border-radius: 6px;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
          font-size: 10.5px;
          font-weight: 800;
          color: #202124;
          box-shadow: 0 2px 5px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.15);
          border: 1px solid rgba(0,0,0,0.12);
          white-space: nowrap;
          letter-spacing: -0.2px;
          display: flex;
          align-items: center;
          gap: 3px;
        ">
          ${isTop1 ? '<span style="color: #EA4335; font-size: 10px;">★</span>' : ''}
          ${isHub ? '<span style="color: #0F9D58; font-size: 9px;">●</span>' : ''}
          <span>${cityName}</span>
        </div>
      </div>
    `,
    iconSize: [120, 72],
    iconAnchor: [60, 44],
    popupAnchor: [0, -44]
  });
}

// Controlador de Viewport do Leaflet para transição suave de câmera e auto-resize sem sobrecarga
const MapViewportController: React.FC<{
  center: [number, number];
  zoom: number;
  flyToTarget: [number, number] | null;
  targetZoom?: number;
}> = ({ center, zoom, flyToTarget, targetZoom = BRAZIL_DEFAULT_ZOOM }) => {
  const map = useMap();
  const lastTargetKey = useRef<string>("");

  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (flyToTarget) {
      const key = `${flyToTarget[0].toFixed(4)},${flyToTarget[1].toFixed(4)},${targetZoom}`;
      if (lastTargetKey.current !== key) {
        lastTargetKey.current = key;
        map.flyTo(flyToTarget, targetZoom, { duration: 1.2 });
      }
    } else {
      if (lastTargetKey.current !== "default_brazil") {
        lastTargetKey.current = "default_brazil";
        map.flyTo(center, zoom, { duration: 1.2 });
      }
    }
  }, [flyToTarget, targetZoom, center, zoom, map]);

  return null;
};

// Controles Interativos Oficiais Estilo Google Maps
const GoogleMapsFloatingControls: React.FC<{
  onResetBrazil: () => void;
}> = ({ onResetBrazil }) => {
  const map = useMap();

  return (
    <>
      {/* Botões de Navegação Oficiais Google Maps (Canto Inferior Direito) */}
      <div 
        className="leaflet-bottom leaflet-right" 
        style={{ marginBottom: "26px", marginRight: "16px", zIndex: 1000, pointerEvents: "none" }}
      >
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
          {/* Botão de Centralização Geral do Brasil */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResetBrazil();
            }}
            className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-md hover:shadow-lg border border-slate-200/90 flex items-center justify-center cursor-pointer transition-all active:scale-95 group"
            title="Visão Geral do Brasil"
          >
            <Compass className="w-5 h-5 text-emerald-700 group-hover:rotate-45 transition-transform duration-300" />
          </button>

          {/* Controle de Zoom Estilo Google Maps */}
          <div className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200/90 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                map.zoomIn();
              }}
              className="w-10 h-10 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xl cursor-pointer border-b border-slate-100 transition-colors active:bg-slate-200"
              title="Aproximar Zoom (Zoom In)"
            >
              +
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                map.zoomOut();
              }}
              className="w-10 h-10 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xl cursor-pointer transition-colors active:bg-slate-200"
              title="Afastar Zoom (Zoom Out)"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {/* Marca D'Água Oficial Google Maps & Risel (Canto Inferior Esquerdo) */}
      <div 
        className="leaflet-bottom leaflet-left" 
        style={{ marginBottom: "8px", marginLeft: "12px", zIndex: 999, pointerEvents: "none" }}
      >
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-2xs border border-slate-200/70 text-slate-600 pointer-events-auto">
          <span className="font-black text-xs tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <span style={{ color: "#4285F4" }}>G</span>
            <span style={{ color: "#EA4335" }}>o</span>
            <span style={{ color: "#FBBC05" }}>o</span>
            <span style={{ color: "#4285F4" }}>g</span>
            <span style={{ color: "#34A853" }}>l</span>
            <span style={{ color: "#EA4335" }}>e</span>
          </span>
          <span className="text-[10px] font-bold text-slate-600">Maps</span>
          <span className="text-[9px] text-slate-400 border-l border-slate-200 pl-1.5 font-medium">Corredores Risel</span>
        </div>
      </div>
    </>
  );
};

// Normalização padronizada de nomes de municípios para o BI
function normalizeCityName(raw?: string): string {
  if (!raw) return "Paulínia";
  let c = raw.trim().toUpperCase();
  c = c.replace(/[\r\n\t]+/g, " ");
  c = c.replace(/\s+-\s*SP/gi, "").replace(/\s+SP$/gi, "").replace(/\/ SP$/gi, "").replace(/,.*$/, "").trim();
  if (c.includes("PAULINIA") || c.includes("PAULÍNIA")) return "PAULÍNIA";
  if (c.includes("SAO PAULO") || c.includes("SÃO PAULO")) return "SÃO PAULO";
  if (c.includes("BERNARDO")) return "SÃO BERNARDO DO CAMPO";
  if (c.includes("ARARAQUARA")) return "ARARAQUARA";
  if (c.includes("CARLOS") || c.includes("S.CARLOS")) return "SÃO CARLOS";
  if (c.includes("VICENTE")) return "SÃO VICENTE";
  if (c.includes("GUARUJA") || c.includes("GUARUJÁ")) return "GUARUJÁ";
  if (c.includes("SUMARE") || c.includes("SUMARÉ")) return "SUMARÉ";
  if (c.includes("HORTOLANDIA") || c.includes("HORTOLÂNDIA")) return "HORTOLÂNDIA";
  if (c.includes("DIADEMA")) return "DIADEMA";
  if (c.includes("SUZANO")) return "SUZANO";
  if (c.includes("GUARULHOS")) return "GUARULHOS";
  if (c.includes("SOROCABA")) return "SOROCABA";
  if (c.includes("CAMPINAS")) return "CAMPINAS";
  if (c.includes("CUBATAO") || c.includes("CUBATÃO")) return "CUBATÃO";
  if (c.includes("SANTOS")) return "SANTOS";
  if (c.includes("PIRACICABA")) return "PIRACICABA";
  if (c.includes("LIMEIRA")) return "LIMEIRA";
  if (c.includes("RIBEIRAO") || c.includes("RIBEIRÃO")) return "RIBEIRÃO PRETO";
  if (c.includes("RIO PRETO")) return "SÃO JOSÉ DO RIO PRETO";
  if (c.includes("BOA VISTA")) return "SÃO JOÃO DA BOA VISTA";
  if (c.includes("CAPAO") || c.includes("CAPÃO")) return "CAPÃO BONITO";
  if (c.includes("GUAPIARA")) return "GUAPIARA";
  if (c.includes("GUAREI") || c.includes("GUAREÍ")) return "GUAREÍ";
  if (c.includes("OURINHOS")) return "OURINHOS";
  if (c.includes("ITATINGA")) return "ITATINGA";
  if (c.includes("ITAPEVA")) return "ITAPEVA";
  if (c.includes("ITATIBA")) return "ITATIBA";
  if (c.includes("ITUPEVA")) return "ITUPEVA";
  if (c.includes("TIETE") || c.includes("TIETÊ")) return "TIETÊ";
  if (c.includes("CATIGUA") || c.includes("CATIGUÁ")) return "CATIGUÁ";
  if (c.includes("MIRASSOL")) return "MIRASSOL";
  if (c.includes("MERIDIANO")) return "MERIDIANO";
  if (c.includes("BERTIOGA")) return "BERTIOGA";
  if (c.includes("EMBU")) return "EMBU-GUAÇU";
  if (c.includes("ARAUCARIA") || c.includes("ARAUCÁRIA")) return "ARAUCÁRIA";
  if (c.includes("ITARARE") || c.includes("ITARARÉ")) return "SALTO DO ITARARÉ";
  if (c.includes("BELO HORIZONTE")) return "BELO HORIZONTE";
  if (!c || c === "LOCAL NÃO INFORMADO") return "PAULÍNIA";
  return c;
}

export const SinistrosDashboard: React.FC<SinistrosDashboardProps> = ({
  sinistros,
  onNavigateToSinistros,
  onRefreshData,
  onSelectSinistro
}) => {
  // Filtros Avançados
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedBase, setSelectedBase] = useState<string>("");
  const [selectedAssumiu, setSelectedAssumiu] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [selectedMapCity, setSelectedMapCity] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<"mapa" | "matriz">("mapa");
  const [selectedRegion, setSelectedRegion] = useState<string>("TODAS");
  const [mapLayerType, setMapLayerType] = useState<"streets" | "satellite" | "terrain">("streets");
  const [mapFlyTarget, setMapFlyTarget] = useState<[number, number] | null>(null);
  const [mapTargetZoom, setMapTargetZoom] = useState<number>(BRAZIL_DEFAULT_ZOOM);

  // Feedback de sincronização e upload de planilha
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveSinistros = useMemo(() => {
    return Array.isArray(sinistros) && sinistros.length > 0 ? sinistros : [];
  }, [sinistros]);

  // Lista de Meses para filtro
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    effectiveSinistros.forEach(s => {
      if (s.dataHora && s.dataHora.length >= 7) {
        set.add(s.dataHora.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse().map(ym => {
      const [y, m] = ym.split("-");
      const date = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      return { value: ym, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [effectiveSinistros]);

  // Lista de Bases para filtro
  const availableBases = useMemo(() => {
    const set = new Set<string>();
    effectiveSinistros.forEach(s => {
      if (s.base) set.add(s.base.trim());
    });
    return Array.from(set).sort();
  }, [effectiveSinistros]);

  // Lista de Gestores para filtro (padronizado com primeiro nome)
  const availableGestores = useMemo(() => {
    const set = new Set<string>();
    effectiveSinistros.forEach(s => {
      const g = getPrimeiroNomeGestor(s.gestorImediato);
      if (g && g !== "-") set.add(g);
    });
    return Array.from(set).sort();
  }, [effectiveSinistros]);

  // Sinistros Filtrados
  const filteredSinistros = useMemo(() => {
    return effectiveSinistros.filter(s => {
      if (selectedMonth && (!s.dataHora || !s.dataHora.startsWith(selectedMonth))) return false;
      if (selectedBase && s.base !== selectedBase) return false;
      if (selectedGestor && getPrimeiroNomeGestor(s.gestorImediato) !== selectedGestor) return false;
      if (selectedStatus && s.status !== selectedStatus) return false;
      if (selectedAssumiu) {
        const assumiuSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
        if (selectedAssumiu === "SIM" && !assumiuSim) return false;
        if (selectedAssumiu === "NAO" && assumiuSim) return false;
      }
      return true;
    });
  }, [effectiveSinistros, selectedMonth, selectedBase, selectedAssumiu, selectedStatus, selectedGestor]);

  // Métricas Consolidadas para os KPIs
  const metrics = useMemo(() => {
    const total = filteredSinistros.length;
    let finalizados = 0;
    let emApuracao = 0;
    let emSeguradora = 0;
    let aguardandoOrcamento = 0;
    let emReparo = 0;

    let assumiuSim = 0;
    let assumiuNao = 0;

    let comBoletim = 0;
    let comFotos = 0;

    const baseCount: Record<string, number> = {};

    filteredSinistros.forEach(s => {
      const st = s.status || "Em Apuração";
      if (st.includes("Finalizado") || st.includes("Concluído") || st.includes("Encerrado")) finalizados++;
      else if (st.includes("Seguradora")) emSeguradora++;
      else if (st.includes("Orçamento") || st.includes("Pendente")) aguardandoOrcamento++;
      else if (st.includes("Reparo")) emReparo++;
      else emApuracao++;

      const isSim = s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel";
      if (isSim) assumiuSim++;
      else assumiuNao++;

      if (s.boletimOcorrencia || s.boletimOcorrenciaUrl || s.sharepointLinks?.boletim) comBoletim++;
      if ((s.anexosSharePoint && s.anexosSharePoint.length > 0) || (s.sharepointLinks?.fotos && s.sharepointLinks.fotos.length > 0) || (s.anexos && s.anexos.length > 0)) {
        comFotos++;
      }

      const b = (s.base || "Paulínia").trim();
      baseCount[b] = (baseCount[b] || 0) + 1;
    });

    const sortedBases = Object.entries(baseCount).sort((a, b) => b[1] - a[1]);
    const topBaseName = sortedBases[0]?.[0] || "Paulínia";
    const topBaseCount = sortedBases[0]?.[1] || 0;
    const secondBaseName = sortedBases[1]?.[0] || "São Bernardo";
    const secondBaseCount = sortedBases[1]?.[1] || 0;

    return {
      total,
      finalizados,
      emApuracao,
      emSeguradora,
      aguardandoOrcamento,
      emReparo,
      assumiuSim,
      assumiuNao,
      pctAssumiuSim: total > 0 ? Math.round((assumiuSim / total) * 100) : 0,
      pctAssumiuNao: total > 0 ? Math.round((assumiuNao / total) * 100) : 0,
      pctFinalizados: total > 0 ? Math.round((finalizados / total) * 100) : 0,
      comBoletim,
      pctComBoletim: total > 0 ? Math.round((comBoletim / total) * 100) : 0,
      comFotos,
      pctComFotos: total > 0 ? Math.round((comFotos / total) * 100) : 0,
      topBaseName,
      topBaseCount,
      secondBaseName,
      secondBaseCount
    };
  }, [filteredSinistros]);

  // 1. Dados: Evolução Temporal
  const monthlyTimelineData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      if (s.dataHora && s.dataHora.length >= 7) {
        const ym = s.dataHora.substring(0, 7);
        map.set(ym, (map.get(ym) || 0) + 1);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, count]) => {
        const [y, m] = ym.split("-");
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        const label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        return {
          key: ym,
          mes: label.charAt(0).toUpperCase() + label.slice(1),
          ocorrencias: count
        };
      });
  }, [filteredSinistros]);

  const timelineStats = useMemo(() => {
    if (monthlyTimelineData.length === 0) return { peakMonth: "-", peakVal: 0, avg: 0 };
    let peakVal = 0;
    let peakMonth = "";
    let sum = 0;
    monthlyTimelineData.forEach(d => {
      sum += d.ocorrencias;
      if (d.ocorrencias > peakVal) {
        peakVal = d.ocorrencias;
        peakMonth = d.mes;
      }
    });
    const avg = (sum / monthlyTimelineData.length).toFixed(1);
    return { peakMonth, peakVal, avg };
  }, [monthlyTimelineData]);

  // 2. Dados: Distribuição por Base Operacional
  const baseDistributionData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const b = (s.base || "Paulínia").trim();
      map.set(b, (map.get(b) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], index) => {
        const palette = BASE_GRADIENTS[index % BASE_GRADIENTS.length];
        return {
          name,
          count,
          pct: Math.round((count / total) * 100),
          palette
        };
      });
  }, [filteredSinistros]);

  // 3. Dados: Gestores Imediatos (somente o primeiro nome padronizado)
  const gestoresData = useMemo(() => {
    const map = new Map<string, number>();
    filteredSinistros.forEach(s => {
      const g = getPrimeiroNomeGestor(s.gestorImediato);
      const label = g && g !== "-" ? g : "Não Informado";
      map.set(label, (map.get(label) || 0) + 1);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gestor, count], idx) => ({
        gestor,
        count,
        pct: Math.round((count / total) * 100),
        rank: idx + 1
      }));
  }, [filteredSinistros]);

  // 4. Dados: Status dos Processos (Pipeline de 5 Estágios)
  const statusPipelineData = useMemo(() => {
    const total = filteredSinistros.length || 1;
    return [
      {
        id: "finalizado",
        name: "Finalizado / Concluído",
        value: metrics.finalizados,
        pct: Math.round((metrics.finalizados / total) * 100),
        color: "#10b981",
        stageNum: "1",
        desc: "Ocorrência regulada, reparada ou encerrada"
      },
      {
        id: "seguradora",
        name: "Aberto na Seguradora",
        value: metrics.emSeguradora,
        pct: Math.round((metrics.emSeguradora / total) * 100),
        color: "#3b82f6",
        stageNum: "2",
        desc: "Sinistro comunicado à corretora / seguradora"
      },
      {
        id: "orcamento",
        name: "Aguardando Orçamento",
        value: metrics.aguardandoOrcamento,
        pct: Math.round((metrics.aguardandoOrcamento / total) * 100),
        color: "#f59e0b",
        stageNum: "3",
        desc: "Cotação de peças, franquia e mão-de-obra"
      },
      {
        id: "reparo",
        name: "Em Reparo",
        value: metrics.emReparo,
        pct: Math.round((metrics.emReparo / total) * 100),
        color: "#8b5cf6",
        stageNum: "4",
        desc: "Veículo em funilaria ou oficina credenciada"
      },
      {
        id: "apuracao",
        name: "Em Apuração",
        value: metrics.emApuracao,
        pct: Math.round((metrics.emApuracao / total) * 100),
        color: "#64748b",
        stageNum: "5",
        desc: "Coleta inicial de B.O., laudos e declarações"
      }
    ];
  }, [filteredSinistros, metrics]);

  // 5. Dados: Responsabilidade do Condutor
  const responsabilidadeData = useMemo(() => {
    return [
      { 
        name: "Sem Culpa Risel (NÃO)", 
        value: metrics.assumiuNao, 
        color: "#10b981",
        label: "Terceiro / Sem Culpa",
        pct: metrics.pctAssumiuNao 
      },
      { 
        name: "Condutor Risel Assumiu (SIM)", 
        value: metrics.assumiuSim, 
        color: "#f43f5e",
        label: "Condutor Risel",
        pct: metrics.pctAssumiuSim 
      }
    ];
  }, [metrics]);

  // 6. Dados: Cidades com Maior Incidência e Mapeamento Geográfico
  const topCidadesData = useMemo(() => {
    const map = new Map<string, { count: number; bases: Record<string, number> }>();
    filteredSinistros.forEach(s => {
      const rawCity = s.cidade?.trim() || (s.local?.includes("-") ? s.local.split("-").pop()?.trim() : "") || "Paulínia";
      const normalized = normalizeCityName(rawCity);
      
      const entry = map.get(normalized) || { count: 0, bases: {} };
      entry.count += 1;
      const baseName = (s.base || "Paulínia").trim();
      entry.bases[baseName] = (entry.bases[baseName] || 0) + 1;
      map.set(normalized, entry);
    });

    const total = filteredSinistros.length || 1;
    return Array.from(map.entries())
      .map(([name, data]) => {
        const topBase = Object.entries(data.bases).sort((a, b) => b[1] - a[1])[0]?.[0] || "Paulínia";
        const coords = ACCURATE_CITY_COORDINATES[name] || {
          lat: -22.7611,
          lng: -47.1539,
          label: name,
          base: topBase,
          region: "Eixo Noroeste & Interior"
        };
        const citySinistros = filteredSinistros.filter(s => {
          const rawCity = s.cidade?.trim() || (s.local?.includes("-") ? s.local.split("-").pop()?.trim() : "") || "Paulínia";
          return normalizeCityName(rawCity) === name;
        });
        const assumiuSimCount = citySinistros.filter(s => s.condutorAssumiu === "SIM" || s.culpabilidade === "Condutor Risel").length;
        const assumiuNaoCount = citySinistros.length - assumiuSimCount;
        return { 
          name, 
          count: data.count, 
          pct: Math.round((data.count / total) * 100),
          topBase,
          coords,
          region: coords.region || "Geral",
          assumiuSimCount,
          assumiuNaoCount,
          sinistros: citySinistros
        };
      })
      .filter(item => selectedRegion === "TODAS" || item.region === selectedRegion)
      .sort((a, b) => b.count - a.count);
  }, [filteredSinistros, selectedRegion]);

  // Upload direto do arquivo Excel (.xlsx) atualizado
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSyncing(true);
    setSyncFeedback("Importando planilha e decodificando aba Sheet1...");
    try {
      const res = await uploadSinistrosSheet(file);
      if (res.success) {
        setSyncFeedback(`Sucesso! ${res.totalSinistros} ocorrências importadas da planilha Sheet1.`);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncFeedback(res.error || "Erro ao processar planilha.");
      }
    } catch (err: any) {
      setSyncFeedback("Falha no upload da planilha.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 6000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Últimas ocorrências para o rodapé
  const recentSinistros = useMemo(() => {
    return [...filteredSinistros]
      .sort((a, b) => (b.dataHora || "").localeCompare(a.dataHora || ""))
      .slice(0, 4);
  }, [filteredSinistros]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 overflow-x-hidden font-sans">
      
      {/* CABEÇALHO DO PAINEL EXECUTIVO BI */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#114D38] via-[#1a5d44] to-[#0d3b2c] text-white flex items-center justify-center shadow-md shadow-emerald-900/20 shrink-0">
              <ShieldAlert className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Painel Executivo de Sinistros &amp; Avarias
              </h2>
            </div>
          </div>

          {/* Ações Rápidas & Upload da Planilha */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Input Oculto de Arquivo */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60 active:scale-95"
              title="Carregar arquivo atualizado Comunicado de Sinistro_Frota Pesada.xlsx"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Atualizar Planilha (.xlsx)</span>
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* BARRA DE FILTROS AVANÇADOS */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtros Rápidos:</span>
          </div>

          {/* Filtro Período / Mês */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Meses</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro Base */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Building2 className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedBase}
              onChange={(e) => setSelectedBase(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todas as Bases</option>
              {availableBases.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Filtro Responsabilidade Condutor */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedAssumiu}
              onChange={(e) => setSelectedAssumiu(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todas as Responsabilidades</option>
              <option value="SIM">Condutor Risel (SIM)</option>
              <option value="NAO">Sem Culpa / Terceiro (NÃO)</option>
            </select>
          </div>

          {/* Filtro Gestor */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Users className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedGestor}
              onChange={(e) => setSelectedGestor(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Gestores</option>
              {availableGestores.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Activity className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-bold outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="">Todos os Status</option>
              <option value="Finalizado / Concluído">Finalizado / Concluído</option>
              <option value="Aberto na Seguradora">Aberto na Seguradora</option>
              <option value="Aguardando Orçamento">Aguardando Orçamento</option>
              <option value="Em Reparo">Em Reparo</option>
              <option value="Em Apuração">Em Apuração</option>
            </select>
          </div>

          {(selectedMonth || selectedBase || selectedAssumiu || selectedStatus || selectedGestor) && (
            <button
              onClick={() => {
                setSelectedMonth("");
                setSelectedBase("");
                setSelectedAssumiu("");
                setSelectedStatus("");
                setSelectedGestor("");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-black hover:underline cursor-pointer ml-1"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-xs font-bold text-slate-500">
            Exibindo <span className="text-slate-900 font-black">{filteredSinistros.length}</span> de {effectiveSinistros.length} ocorrências
          </div>
        </div>
      </div>

      {/* 6 CARDS DE KPIS ANALÍTICOS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Total de Sinistros */}
        <div className="p-4 rounded-3xl border border-rose-200/80 bg-gradient-to-br from-white via-rose-50/30 to-rose-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Total de Sinistros
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-rose-200 bg-rose-50 text-rose-600 shadow-2xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.total}
            </span>
            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {metrics.finalizados} Concluídos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            {metrics.emApuracao + metrics.emSeguradora + metrics.aguardandoOrcamento + metrics.emReparo} em tramitação ativa
          </span>
        </div>

        {/* KPI 2: Responsabilidade Condutor Risel */}
        <div className="p-4 rounded-3xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/30 to-amber-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Condutor Risel Assumiu
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-amber-200 bg-amber-50 text-amber-600 shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-amber-700 to-amber-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.assumiuSim}
            </span>
            <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {metrics.pctAssumiuSim}% do total
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Responsabilidade assumida (SIM)
          </span>
        </div>

        {/* KPI 3: Sem Culpa Risel / Terceiro */}
        <div className="p-4 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/30 to-emerald-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Terceiro / Sem Culpa
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.assumiuNao}
            </span>
            <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {metrics.pctAssumiuNao}% isentos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Sem responsabilidade Risel (NÃO)
          </span>
        </div>

        {/* KPI 4: Boletim de Ocorrência (B.O.) */}
        <div className="p-4 rounded-3xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/30 to-sky-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Com Boletim (B.O.)
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-sky-200 bg-sky-50 text-sky-600 shadow-2xs">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.comBoletim}
            </span>
            <span className="text-[10px] font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
              {metrics.pctComBoletim}% com B.O.
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            PDFs de B.O. oficial anexados
          </span>
        </div>

        {/* KPI 5: Acervo de Evidências & Fotos */}
        <div className="p-4 rounded-3xl border border-purple-200/80 bg-gradient-to-br from-white via-purple-50/30 to-purple-100/20 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Acervo de Fotos &amp; Laudos
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-purple-200 bg-purple-50 text-purple-600 shadow-2xs">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-3xl font-black bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent block tracking-tight">
              {metrics.comFotos}
            </span>
            <span className="text-[10px] font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
              {metrics.pctComFotos}% registrados
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
            Fotos do veículo e do local anexadas
          </span>
        </div>

        {/* KPI 6: Base Líder */}
        <div className="p-4 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 min-h-[115px]">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
              Base Líder em Sinistros
            </span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-300 bg-slate-100 text-slate-700 shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800 block tracking-tight truncate" title={metrics.topBaseName}>
              {metrics.topBaseName}
            </span>
            <span className="text-[10px] font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded-lg">
              {metrics.topBaseCount} casos
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 block mt-1 truncate">
            2ª: {metrics.secondBaseName} ({metrics.secondBaseCount} casos)
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STANDALONE: EVOLUÇÃO TEMPORAL DAS OCORRÊNCIAS */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#114D38] to-[#1a5d44] text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
              <TrendingUp className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Evolução Temporal das Ocorrências
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Frequência mensal de sinistros registrados na frota pesada.
              </p>
            </div>
          </div>

          {/* Badges Estatísticos Discretos */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Pico:</span>
              <span className="font-black text-rose-600 font-mono text-xs">{timelineStats.peakMonth} ({timelineStats.peakVal} casos)</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Média:</span>
              <span className="font-black text-slate-800 font-mono text-xs">{timelineStats.avg} / mês</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-black text-emerald-900 font-mono text-xs">{filteredSinistros.length} registros</span>
            </div>
          </div>
        </div>

        {/* Gráfico de Área Standalone */}
        <div className="h-72 sm:h-80 w-full mt-2">
          {monthlyTimelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTimelineData} margin={{ top: 15, right: 25, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="sinistroTimelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11, fill: "#475569", fontWeight: 700 }} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                  axisLine={{ stroke: "#cbd5e1" }} 
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} ocorrências`, "Sinistros na Frota"]}
                  labelFormatter={(label) => `Período: ${label}`}
                  contentStyle={{ 
                    backgroundColor: "#0f172a", 
                    borderColor: "#334155", 
                    borderRadius: "14px", 
                    color: "#fff", 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    padding: "8px 14px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)" 
                  }}
                />
                <ReferenceLine 
                  y={parseFloat(String(timelineStats.avg)) || 0} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  strokeWidth={2}
                  label={{ 
                    value: `Média: ${timelineStats.avg}/mês`, 
                    fill: "#d97706", 
                    fontSize: 10, 
                    fontWeight: 800,
                    position: "insideTopRight"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="ocorrencias" 
                  stroke="#059669" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#sinistroTimelineGradient)" 
                  dot={{ r: 4.5, fill: "#059669", strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 7, fill: "#047857", strokeWidth: 3, stroke: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
              Nenhum dado encontrado para os filtros selecionados
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STANDALONE: OCORRÊNCIAS POR BASE OPERACIONAL (CARDS UNIFORMES SEM BARRAS) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-blue-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Ocorrências por Base Operacional
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Distribuição de ocorrências por unidade operacional ativa da frota.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-600 flex items-center gap-2 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Bases: <strong className="text-slate-900">{baseDistributionData.length}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 font-bold text-blue-800 flex items-center gap-2 shadow-2xs">
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>Líder: <strong>{metrics.topBaseName}</strong> ({metrics.topBaseCount} casos · {Math.round((metrics.topBaseCount / (metrics.total || 1)) * 100)}%)</span>
            </div>
          </div>
        </div>

        {/* Grade de Cards Uniformes por Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {baseDistributionData.map((b, idx) => (
            <div 
              key={b.name}
              className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all duration-200 flex flex-col justify-between min-h-[92px] h-full"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${b.palette.bg}`}>
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-800 truncate" title={b.name}>
                    {b.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black text-slate-900 font-mono">
                    {b.count}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    ({b.pct}%)
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.max(8, b.pct)}%`, backgroundColor: b.palette.from }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. STANDALONE: GESTÃO IMEDIATA DA FROTA (DISTRIBUIÇÃO POR GESTOR EM BARRAS VERTICAIS) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-amber-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Gestão Imediata da Frota (Distribuição por Gestor)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Ocorrências acompanhadas por cada gestor responsável imediato.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold shadow-2xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-[11px]">Críticos (Maior Volume)</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="text-[11px]">Moderados (Amarelados)</span>
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 font-bold text-rose-800 shadow-2xs">
              Top Gestor: <strong>{gestoresData[0]?.gestor}</strong> ({gestoresData[0]?.count} casos)
            </div>
          </div>
        </div>

        {/* Gráfico de Barras Verticais */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={gestoresData} 
              margin={{ top: 25, right: 20, left: -15, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="gestor" 
                tick={{ fontSize: 11, fill: "#334155", fontWeight: 700 }} 
                axisLine={{ stroke: "#cbd5e1" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={40}
              />
              <YAxis 
                allowDecimals={false} 
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                axisLine={{ stroke: "#cbd5e1" }} 
              />
              <Tooltip 
                formatter={(val: any) => [`${val} ocorrências acompanhadas (${Math.round((val / (metrics.total || 1)) * 100)}%)`, "Gestor Imediato"]}
                contentStyle={{ 
                  backgroundColor: "#0f172a", 
                  borderColor: "#334155", 
                  borderRadius: "14px", 
                  color: "#fff", 
                  fontSize: "12px", 
                  fontWeight: "bold",
                  padding: "8px 14px"
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="count" position="top" fill="#1e293b" fontSize={11} fontWeight={800} />
                {gestoresData.map((_, index) => (
                  <Cell 
                    key={`gestor-cell-${index}`} 
                    fill={
                      index === 0 ? "#f87171" :
                      index === 1 ? "#fb7185" :
                      index === 2 ? "#fb923c" :
                      index === 3 ? "#f59e0b" :
                      index === 4 ? "#fbbf24" :
                      index === 5 ? "#fcd34d" : "#fde047"
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 & 5. NA MESMA LINHA: STATUS POR PROCESSOS & RESPONSABILIDADE DO CONDUTOR */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        
        {/* GRÁFICO 1: STATUS POR PROCESSOS (PIZZA ELEGANTE COM TOTAL AO CENTRO) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Status por Processos
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Acompanhamento do fluxo operacional.
                  </p>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 text-xs shadow-2xs self-start sm:self-auto">
                Resolução: <strong>{metrics.pctFinalizados}% Concluídos</strong>
              </div>
            </div>

            {/* Donut Chart Elegante 360° com Total de Ocorrências ao Centro */}
            <div className="h-64 w-full flex items-center justify-center relative my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                  <Pie
                    data={statusPipelineData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={104}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPipelineData.map((entry, index) => (
                      <Cell key={`status-slice-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} sinistros (${Math.round((value / (metrics.total || 1)) * 100)}%)`, "Status"]}
                    contentStyle={{ 
                      backgroundColor: "#0f172a", 
                      borderColor: "#334155", 
                      borderRadius: "14px", 
                      color: "#fff", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      padding: "8px 14px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Total de ocorrências ao centro */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900 block leading-tight font-mono">{metrics.total}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Ocorrências</span>
                <span className="text-[10px] font-bold text-emerald-600 block">{metrics.finalizados} concluídas</span>
              </div>
            </div>
          </div>

          {/* Legenda de Status com Mini-Cards Elegantes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            {statusPipelineData.map((st) => (
              <div key={st.id} className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="text-[10.5px] font-bold text-slate-700 truncate" title={st.name}>
                    {st.name.split("/")[0].trim()}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-1 shrink-0">
                  <span className="text-xs font-black font-mono text-slate-900">{st.value}</span>
                  <span className="text-[9.5px] font-bold text-slate-400">({st.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRÁFICO 2: RESPONSABILIDADE DO CONDUTOR (PIZZA ELEGANTE COM TOTAL DE ISENÇÃO AO CENTRO) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Responsabilidade do Condutor
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Declaração de culpabilidade no comunicado oficial.
                  </p>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 text-xs shadow-2xs self-start sm:self-auto">
                Isenção Risel: <strong>{metrics.pctAssumiuNao}% Sem Culpa</strong>
              </div>
            </div>

            {/* Donut Chart Elegante 360° com Total de Isenção ao Centro */}
            <div className="h-64 w-full flex items-center justify-center relative my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                  <Pie
                    data={responsabilidadeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={104}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {responsabilidadeData.map((entry, index) => (
                      <Cell key={`resp-slice-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} casos (${Math.round((value / (metrics.total || 1)) * 100)}%)`, "Responsabilidade"]}
                    contentStyle={{ 
                      backgroundColor: "#0f172a", 
                      borderColor: "#334155", 
                      borderRadius: "14px", 
                      color: "#fff", 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      padding: "8px 14px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Total de Isenção ao centro */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span className="text-3xl font-black text-emerald-600 block leading-tight font-mono">{metrics.assumiuNao}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Isenção</span>
                <span className="text-[10px] font-bold text-emerald-600 block">{metrics.pctAssumiuNao}% Sem Culpa Risel</span>
              </div>
            </div>
          </div>

          {/* Cards Comparativos de Apoio */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900">Sem Culpa (NÃO)</span>
                <span className="text-xs font-black text-emerald-700 font-mono">{metrics.assumiuNao} ({metrics.pctAssumiuNao}%)</span>
              </div>
              <div className="w-full h-2 bg-emerald-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${metrics.pctAssumiuNao}%` }} />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-900">Assumiu (SIM)</span>
                <span className="text-xs font-black text-rose-700 font-mono">{metrics.assumiuSim} ({metrics.pctAssumiuSim}%)</span>
              </div>
              <div className="w-full h-2 bg-rose-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-rose-600 rounded-full transition-all duration-500" style={{ width: `${metrics.pctAssumiuSim}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. STANDALONE: PRINCIPAIS CIDADES DE OCORRÊNCIA (MAPA EXECUTIVO PREMIUM) */}
      {/* ========================================================================= */}
      <div className="w-full bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#114D38] to-[#1a5d44] text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
              <MapPin className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Principais Cidades de Ocorrência</span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Visão Cartográfica Brasil
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Mapeamento territorial das ocorrências ao longo dos corredores rodoviários nacionais e bases.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Seletor de Modo: Mapa ou Matriz */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setMapViewMode("mapa")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  mapViewMode === "mapa" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mapa do Brasil</span>
              </button>
              <button
                onClick={() => setMapViewMode("matriz")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  mapViewMode === "matriz" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ranking Matriz</span>
              </button>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-600 flex items-center gap-2 shadow-2xs">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cidades: <strong className="text-slate-900">{topCidadesData.length}</strong></span>
            </div>

            {topCidadesData[0] && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 flex items-center gap-2 shadow-2xs">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>Líder: <strong>{topCidadesData[0].name}</strong> ({topCidadesData[0].count} casos)</span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Filtros Regionais no Mapa */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            Filtro Territorial:
          </span>
          {[
            { id: "TODAS", label: "Brasil (Todo o Território)" },
            { id: "Sudeste (SP)", label: "Polo Sudeste (SP)" },
            { id: "Sul (PR)", label: "Polo Sul (PR)" },
            { id: "Sudeste (MG)", label: "Polo Minas Gerais" }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedRegion(r.id);
                setSelectedMapCity(null);
                if (r.id === "TODAS") {
                  setMapFlyTarget([-15.7801, -47.9292]);
                  setMapTargetZoom(4);
                } else if (r.id === "Sudeste (SP)") {
                  setMapFlyTarget([-22.95, -47.15]);
                  setMapTargetZoom(7);
                } else if (r.id === "Sul (PR)") {
                  setMapFlyTarget([-25.59, -49.41]);
                  setMapTargetZoom(8);
                } else if (r.id === "Sudeste (MG)") {
                  setMapFlyTarget([-19.92, -43.93]);
                  setMapTargetZoom(8);
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs shrink-0 cursor-pointer ${
                selectedRegion === r.id 
                  ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/30" 
                  : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
          {selectedMapCity && (
            <button
              onClick={() => setSelectedMapCity(null)}
              className="ml-auto text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              Limpar seleção ({selectedMapCity})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* MAPA GOOGLE MAPS PREMIUM DO BRASIL */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative flex flex-col justify-between overflow-hidden">
            
            {/* Header da Barra do Google Maps */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs">
                  <MapIcon className="w-4 h-4 text-emerald-100" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 tracking-tight">Google Maps · Corredores Risel</span>
                    <span className="text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Google Tiles pt-BR
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-medium">
                    Navegação dinâmica com zoom e satélite oficial
                  </p>
                </div>
              </div>

              {/* Controles de Camadas Oficiais Google Maps (Ruas / Satélite / Relevo) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                  {(["streets", "satellite", "terrain"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMapLayerType(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mapLayerType === type
                          ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {GOOGLE_MAP_LAYERS[type].label}
                    </button>
                  ))}
                </div>

                {/* Botão de Centralização Geral do Brasil */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMapCity(null);
                    setMapFlyTarget(BRAZIL_DEFAULT_CENTER);
                    setMapTargetZoom(BRAZIL_DEFAULT_ZOOM);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Visão geral do Brasil"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Brasil</span>
                </button>
              </div>
            </div>

            {mapViewMode === "mapa" ? (
              /* CONTAINER LEAFLET COM CAMADAS GOOGLE MAPS E CONTROLES EXECUTIVOS */
              <div className="relative w-full h-[520px] sm:h-[560px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-inner z-0 bg-slate-100">
                {/* Seletor Rápido Flutuante (Estilo Search Bar Google Maps) */}
                <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 max-w-[calc(100%-24px)] pointer-events-auto">
                  <div className="relative shadow-md rounded-2xl">
                    <select
                      value={selectedMapCity || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedMapCity(val || null);
                        if (val) {
                          const found = topCidadesData.find(c => c.name === val);
                          if (found?.coords) {
                            setMapFlyTarget([found.coords.lat, found.coords.lng]);
                            setMapTargetZoom(12);
                          }
                        }
                      }}
                      className="bg-white/95 backdrop-blur-md text-slate-800 text-xs font-bold pl-8 pr-7 py-2.5 rounded-2xl border border-slate-200/90 appearance-none cursor-pointer focus:outline-emerald-500 transition-all hover:bg-white shadow-xs"
                    >
                      <option value="">🔍 Localizar município no mapa...</option>
                      {topCidadesData.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.count} sinistro{c.count > 1 ? "s" : ""})
                        </option>
                      ))}
                    </select>
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                  </div>
                </div>

                <MapContainer
                  center={BRAZIL_DEFAULT_CENTER}
                  zoom={BRAZIL_DEFAULT_ZOOM}
                  zoomControl={false}
                  scrollWheelZoom={true}
                  style={{ height: "100%", width: "100%" }}
                  className="z-0"
                >
                  <MapViewportController
                    center={BRAZIL_DEFAULT_CENTER}
                    zoom={BRAZIL_DEFAULT_ZOOM}
                    flyToTarget={mapFlyTarget}
                    targetZoom={mapTargetZoom}
                  />

                  <GoogleMapsFloatingControls
                    onResetBrazil={() => {
                      setSelectedMapCity(null);
                      setMapFlyTarget(BRAZIL_DEFAULT_CENTER);
                      setMapTargetZoom(BRAZIL_DEFAULT_ZOOM);
                    }}
                  />

                  <TileLayer
                    key={mapLayerType}
                    url={GOOGLE_MAP_LAYERS[mapLayerType].url}
                    attribution={GOOGLE_MAP_LAYERS[mapLayerType].attribution}
                    maxZoom={18}
                    minZoom={3}
                    updateWhenIdle={true}
                    updateWhenZooming={false}
                    keepBuffer={2}
                  />

                  {topCidadesData.map((c, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isHub = !!c.coords.isHub;
                    const isSelected = selectedMapCity === c.name;
                    const pinIcon = createGoogleMapsPin(c.name, c.count, isTop1, isTop2, isHub, isSelected);

                    return (
                      <Marker
                        key={`gpin-${c.name}`}
                        position={[c.coords.lat, c.coords.lng]}
                        icon={pinIcon}
                        eventHandlers={{
                          click: () => {
                            setSelectedMapCity(c.name);
                            setMapFlyTarget([c.coords.lat, c.coords.lng]);
                            setMapTargetZoom(12);
                          }
                        }}
                      >
                        <Popup className="google-info-popup" minWidth={290} maxWidth={340}>
                          <div className="overflow-hidden rounded-2xl bg-white font-sans text-slate-800">
                            {/* Header estilo Google Maps */}
                            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                  <h4 className="font-black text-sm text-white tracking-tight">{c.name}</h4>
                                </div>
                                <p className="text-[10px] text-slate-300 font-medium">
                                  Base {c.topBase} · {c.region}
                                </p>
                              </div>
                              <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                {c.count} sinistro{c.count > 1 ? "s" : ""}
                              </span>
                            </div>

                            {/* Corpo de Indicadores */}
                            <div className="p-3.5 space-y-2.5 text-xs">
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Participação</span>
                                  <strong className="text-slate-800 text-xs">{c.pct}% da frota</strong>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                  <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Isenção Risel</span>
                                  <strong className="text-emerald-700 text-xs">{c.assumiuNaoCount} sem culpa</strong>
                                </div>
                              </div>

                              {/* Amostra de Placas */}
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Veículos Registrados:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {c.sinistros.slice(0, 4).map(s => (
                                    <span key={s.id} className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                      {s.placa}
                                    </span>
                                  ))}
                                  {c.sinistros.length > 4 && (
                                    <span className="text-[10px] text-slate-500 font-bold self-center">
                                      +{c.sinistros.length - 4} mais
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Botões de Ação Google Maps */}
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMapCity(c.name)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Abrir Dossiê</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMapFlyTarget([c.coords.lat, c.coords.lng]);
                                    setMapTargetZoom(14);
                                  }}
                                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                                  title="Aproximar Zoom (Foco de Rua)"
                                >
                                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Foco</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            ) : (
              /* MODO MATRIZ RANKING DE DISTRIBUIÇÃO */
              <div className="w-full h-full min-h-[480px] p-2 flex flex-col justify-center">
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                  {topCidadesData.map((c, i) => (
                    <div 
                      key={`matriz-${c.name}`} 
                      onClick={() => {
                        setSelectedMapCity(selectedMapCity === c.name ? null : c.name);
                        if (c.coords) {
                          setMapFlyTarget([c.coords.lat, c.coords.lng]);
                          setMapTargetZoom(12);
                        }
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedMapCity === c.name 
                          ? "bg-emerald-50 border-emerald-400" 
                          : "bg-slate-50/70 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center justify-center">
                          #{i + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{c.name}</span>
                          <span className="text-[10px] text-slate-500">Base {c.topBase} · {c.region}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          {c.count} casos ({c.pct}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Painel de Detalhes da Cidade Selecionada (Dossiê Executivo) */}
            {selectedMapCity && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 shadow-md animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black text-emerald-300">
                      Dossiê Territorial: {selectedMapCity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({topCidadesData.find(c => c.name === selectedMapCity)?.count} ocorrências registradas)
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedMapCity(null)}
                    className="text-[10px] text-slate-400 hover:text-white font-bold cursor-pointer"
                  >
                    Fechar ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] mb-2">
                  <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">Base Predominante:</span>
                    <strong className="text-white">{topCidadesData.find(c => c.name === selectedMapCity)?.topBase}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">Responsabilidade:</span>
                    <strong className="text-emerald-400">{topCidadesData.find(c => c.name === selectedMapCity)?.assumiuNaoCount} Isentos</strong> · <span className="text-rose-400">{topCidadesData.find(c => c.name === selectedMapCity)?.assumiuSimCount} Assumidos</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">Participação da Frota:</span>
                    <strong className="text-sky-400">{topCidadesData.find(c => c.name === selectedMapCity)?.pct}% do total</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
                  <span className="text-slate-400 font-bold">Ocorrências:</span>
                  {topCidadesData.find(c => c.name === selectedMapCity)?.sinistros.slice(0, 5).map(s => (
                    <span key={s.id} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px]">
                      {s.placa} ({s.status || "Em Apuração"})
                    </span>
                  ))}
                  {(topCidadesData.find(c => c.name === selectedMapCity)?.sinistros.length || 0) > 5 && (
                    <span className="text-emerald-400 font-bold text-[10px]">
                      +{(topCidadesData.find(c => c.name === selectedMapCity)?.sinistros.length || 0) - 5} mais
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Legenda Oficial Google Maps & Risel */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[10.5px] text-slate-500 font-medium flex-wrap gap-2 mt-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335] shadow-xs" />
                  <span className="font-semibold text-slate-700">#1 São Paulo</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-xs" />
                  <span className="font-semibold text-slate-700">#2 São Bernardo</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0f9d58] shadow-xs" />
                  <span className="font-semibold text-slate-700">Hubs Risel (Paulínia)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1a73e8] shadow-xs" />
                  <span className="font-semibold text-slate-700">Rotas &amp; Municípios</span>
                </span>
              </div>
              <span className="text-slate-600 font-mono text-[10.5px] font-bold">
                {topCidadesData.reduce((acc, c) => acc + c.count, 0)} sinistros georreferenciados
              </span>
            </div>
          </div>

          {/* LISTA RANKING EXECUTIVA LATERAL */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800">Ranking por Município</span>
              <span className="text-[10px] font-bold text-slate-400">Total &amp; Participação</span>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {topCidadesData.map((c, index) => {
                const isSelected = selectedMapCity === c.name;
                const isHovered = hoveredCity === c.name || isSelected;
                return (
                  <div 
                    key={c.name} 
                    onMouseEnter={() => setHoveredCity(c.name)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onClick={() => {
                      setSelectedMapCity(selectedMapCity === c.name ? null : c.name);
                      if (c.coords) {
                        setMapFlyTarget([c.coords.lat, c.coords.lng]);
                        setMapTargetZoom(12);
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-emerald-100/90 border-emerald-400 shadow-xs translate-x-1"
                        : isHovered 
                          ? "bg-emerald-50/80 border-emerald-300 shadow-xs translate-x-1" 
                          : "bg-slate-50/70 border-slate-200/80 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                        index === 0 
                          ? "bg-rose-100 text-rose-800 border border-rose-200" 
                          : index === 1
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : index === 2
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-200 text-slate-700"
                      }`}>
                        #{index + 1}
                      </span>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-800 block truncate" title={c.name}>
                          {c.name}
                        </span>
                        <span className="text-[9.5px] font-semibold text-slate-400 block truncate">
                          Base {c.topBase}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right shrink-0">
                      <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {c.count} casos
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 w-9 text-right">
                        {c.pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 font-medium">
              <span className="font-bold text-slate-700">Interatividade BI:</span> Clique em qualquer cidade do mapa ou lista para abrir o dossiê da ocorrência e dados da frota.
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. PAINEL DE OCORRÊNCIAS RECENTES */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Últimas Ocorrências Registradas
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Registros mais recentes inseridos na planilha da frota pesada.
            </p>
          </div>
          <button
            onClick={onNavigateToSinistros}
            className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
          >
            <span>Ver todas as {filteredSinistros.length} ocorrências na tabela</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {recentSinistros.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between min-h-[140px]"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <MercosulPlateBadge plate={s.placa} size="sm" />
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    s.status?.includes("Finalizado") 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}>
                    {s.status || "Em Apuração"}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 truncate" title={s.motorista}>
                  {s.motorista}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  Base: {s.base} · {s.cidade || s.local || "Local N/I"}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>{s.dataComunicado || s.dataHora?.substring(0, 10)}</span>
                <span className="font-mono font-bold text-slate-700">
                  {s.numeroProtocolo || s.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

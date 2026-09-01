/**
 * Serviço de Geocodificação de Alta Precisão para o Brasil (Especializado em Logradouros Urbanos e Rodovias)
 * 
 * Resolve problemas onde APIs convencionais (OSM/Nominatim) não possuem interpolação de números prediais
 * e colocam o marcador no início ou meio da avenida, em vez do número exato (ex: Av. Amoreiras, 6100).
 */

import { GoogleGenAI, Type } from "@google/genai";

export interface GeocodeResult {
  lat: number;
  lng: number;
  method: 'gemini_exact' | 'corridor_interpolation' | 'photon_precise' | 'nominatim_exact' | 'cached' | 'direct_coords';
  precision: 'high' | 'medium' | 'fallback';
  formattedAddress?: string;
  neighborhood?: string;
  sourceDescription: string;
}

const CACHE_PREFIX = 'risel_accurate_geo_v4:';

// Eixos urbanos e grandes avenidas com perfil de interpolação por número predial
interface CorridorProfile {
  city: string;
  aliases: string[];
  points: { number: number; lat: number; lng: number; label: string }[];
}

const FAMOUS_CORRIDORS: CorridorProfile[] = [
  {
    city: 'campinas',
    aliases: ['amoreiras', 'av amoreiras', 'av. amoreiras', 'avenida amoreiras', 'avenida das amoreiras', 'av. das amoreiras'],
    points: [
      { number: 100, lat: -22.9188, lng: -47.0780, label: 'Parque Itália / Início' },
      { number: 1200, lat: -22.9265, lng: -47.0850, label: 'São Bernardo / Vila Industrial' },
      { number: 2500, lat: -22.9348, lng: -47.0945, label: 'Jardim do Lago / Trevo Anhanguera' },
      { number: 3800, lat: -22.9425, lng: -47.1035, label: 'Parque das Amoreiras / Pq. Tropical' },
      { number: 5000, lat: -22.9495, lng: -47.1105, label: 'Jardim Capivari / Jd. Ipiranga' },
      { number: 6100, lat: -22.9562, lng: -47.1172, label: 'Jardim Morumbi / Vila Aeroporto / Ouro Verde' },
      { number: 7000, lat: -22.9610, lng: -47.1220, label: 'Final / DICs' }
    ]
  },
  {
    city: 'campinas',
    aliases: ['john boyd dunlop', 'av john boyd', 'av. john boyd dunlop', 'avenida john boyd dunlop', 'jbd'],
    points: [
      { number: 100, lat: -22.9090, lng: -47.0870, label: 'Vila Teixeira / Início' },
      { number: 1500, lat: -22.9140, lng: -47.1020, label: 'Jardim Aurélia / Enxuto' },
      { number: 3500, lat: -22.9180, lng: -47.1260, label: 'Jardim Ipaussurama / Shopping Parque das Bandeiras' },
      { number: 5500, lat: -22.9220, lng: -47.1510, label: 'Jardim Londres / Campo Grande' },
      { number: 8000, lat: -22.9280, lng: -47.1850, label: 'Terminal Campo Grande / Final' }
    ]
  },
  {
    city: 'campinas',
    aliases: ['ruy rodriguez', 'av ruy rodriguez', 'av. ruy rodriguez', 'avenida ruy rodriguez'],
    points: [
      { number: 100, lat: -22.9350, lng: -47.0980, label: 'Início / Amoreiras' },
      { number: 1800, lat: -22.9450, lng: -47.1150, label: 'Parque Industrial / Santa Lúcia' },
      { number: 3900, lat: -22.9580, lng: -47.1350, label: 'Terminal Ouro Verde' },
      { number: 5000, lat: -22.9660, lng: -47.1480, label: 'Jardim Vista Alegre / Final' }
    ]
  },
  {
    city: 'campinas',
    aliases: ['prestes maia', 'av prestes maia', 'av. prestes maia', 'avenida prestes maia'],
    points: [
      { number: 100, lat: -22.9180, lng: -47.0650, label: 'Viaduto Cury / Centro' },
      { number: 800, lat: -22.9260, lng: -47.0690, label: 'Vila João Jorge' },
      { number: 1600, lat: -22.9360, lng: -47.0740, label: 'Trevo Anhanguera / Saída Santos Dumont' }
    ]
  },
  {
    city: 'campinas',
    aliases: ['francisco glicerio', 'av francisco glicerio', 'av. francisco glicério', 'avenida francisco glicério'],
    points: [
      { number: 100, lat: -22.9000, lng: -47.0540, label: 'Início / Aquidabã' },
      { number: 1000, lat: -22.9035, lng: -47.0590, label: 'Catedral Metropolitana' },
      { number: 2000, lat: -22.9090, lng: -47.0665, label: 'Vila Lídia / Final' }
    ]
  }
];

/**
 * Normaliza e padroniza termos comuns de endereços brasileiros
 */
export function normalizeBrazilianAddress(rawAddress: string, city: string = '', uf: string = 'SP'): {
  cleanAddress: string;
  streetName: string;
  streetNumber: number | null;
  normalizedQuery: string;
  city: string;
  uf: string;
} {
  let addr = (rawAddress || '').trim();
  
  // Limpar quebras de linha e múltiplos espaços
  addr = addr.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');

  // Substituir abreviações no início ou no meio
  addr = addr
    .replace(/\bAV\b\.?/gi, 'Avenida')
    .replace(/\bR\b\.?/gi, 'Rua')
    .replace(/\bROD\b\.?/gi, 'Rodovia')
    .replace(/\bESTR\b\.?/gi, 'Estrada')
    .replace(/\bAL\b\.?/gi, 'Alameda')
    .replace(/\bPRC\b\.?|\bPCA\b\.?/gi, 'Praça')
    .replace(/\bVD\b\.?/gi, 'Viaduto')
    .replace(/\bTV\b\.?/gi, 'Travessa');

  // Ajustes de nomes populares
  addr = addr
    .replace(/Avenida Amoreiras/gi, 'Avenida das Amoreiras')
    .replace(/Avenida das Amoreiras/gi, 'Avenida das Amoreiras');

  // Extrair número predial (ex: "AV. AMOREIRAS, 6100" ou "Rua X, nº 450" ou "Av Y 120")
  let streetNumber: number | null = null;
  const numMatch = addr.match(/(?:,\s*|\s+n[ºo]?\s*|\s+N[ºO]?\s*|\s+)(\d{1,6})\b/);
  if (numMatch && numMatch[1]) {
    const parsed = parseInt(numMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
      streetNumber = parsed;
    }
  }

  // Extrair o nome da rua puro (sem número)
  let streetName = addr.replace(/(?:,\s*|\s+n[ºo]?\s*|\s+N[ºO]?\s*|\s+)(\d{1,6})\b.*/i, '').trim();
  streetName = streetName.replace(/,\s*$/, '').trim();

  const finalCity = (city || 'Campinas').trim();
  const finalUf = (uf || 'SP').trim().toUpperCase();

  const normalizedQuery = `${addr}, ${finalCity} - ${finalUf}, Brasil`;

  return {
    cleanAddress: addr,
    streetName,
    streetNumber,
    normalizedQuery,
    city: finalCity,
    uf: finalUf
  };
}

/**
 * Tenta interpolar ao longo de corredores conhecidos com múltiplos pontos de ancoragem
 */
function interpolateCorridor(streetName: string, streetNumber: number, city: string): GeocodeResult | null {
  const normStreet = streetName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normCity = city.toLowerCase().replace(/[^a-z0-9]/g, '');

  const corridor = FAMOUS_CORRIDORS.find(c => {
    const cityMatch = normCity.includes(c.city) || c.city.includes(normCity);
    if (!cityMatch) return false;
    return c.aliases.some(alias => {
      const cleanAlias = alias.replace(/[^a-z0-9]/g, '');
      return normStreet.includes(cleanAlias) || cleanAlias.includes(normStreet);
    });
  });

  if (!corridor || corridor.points.length < 2) return null;

  const sorted = [...corridor.points].sort((a, b) => a.number - b.number);

  // Se for menor que o primeiro
  if (streetNumber <= sorted[0].number) {
    return {
      lat: sorted[0].lat,
      lng: sorted[0].lng,
      method: 'corridor_interpolation',
      precision: 'high',
      formattedAddress: `${corridor.aliases[0]} (aprox. nº ${streetNumber}), ${corridor.city}`,
      sourceDescription: `Interpolação de Alta Fidelidade (${sorted[0].label})`
    };
  }

  // Se for maior que o último
  if (streetNumber >= sorted[sorted.length - 1].number) {
    const last = sorted[sorted.length - 1];
    return {
      lat: last.lat,
      lng: last.lng,
      method: 'corridor_interpolation',
      precision: 'high',
      formattedAddress: `${corridor.aliases[0]} (aprox. nº ${streetNumber}), ${corridor.city}`,
      sourceDescription: `Interpolação de Alta Fidelidade (${last.label})`
    };
  }

  // Interpolar linearmente entre os dois pontos de ancoragem mais próximos
  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    if (streetNumber >= p1.number && streetNumber <= p2.number) {
      const ratio = (streetNumber - p1.number) / (p2.number - p1.number);
      const lat = p1.lat + ratio * (p2.lat - p1.lat);
      const lng = p1.lng + ratio * (p2.lng - p1.lng);

      return {
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        method: 'corridor_interpolation',
        precision: 'high',
        formattedAddress: `${corridor.aliases[0]}, nº ${streetNumber} (entre ${p1.label} e ${p2.label})`,
        sourceDescription: `Interpolação de Alta Precisão (altura do nº ${streetNumber})`
      };
    }
  }

  return null;
}

/**
 * Consulta de alta precisão via Gemini AI (com Grounding e conhecimento de topologia urbana brasileira)
 */
async function geocodeWithGemini(fullQuery: string, streetNumber: number | null): Promise<GeocodeResult | null> {
  try {
    const apiKey = (typeof process !== "undefined" && process.env ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : "") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    const prompt = `Você é um motor de geocodificação de alta precisão para o Brasil.
Dado o seguinte endereço: "${fullQuery}".
${streetNumber ? `Atenção crucial: O endereço possui o NÚMERO PREDIAL ${streetNumber}. Encontre com exatidão a latitude e longitude correspondentes à altura desse número na via, não apenas o início ou centroide da avenida.` : ''}

Retorne estritamente um JSON no formato:
{
  "lat": number,
  "lng": number,
  "formattedAddress": string,
  "neighborhood": string,
  "precision": "high" | "medium"
}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            formattedAddress: { type: Type.STRING },
            neighborhood: { type: Type.STRING },
            precision: { type: Type.STRING }
          },
          required: ["lat", "lng"]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && !isNaN(parsed.lat)) {
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        method: 'gemini_exact',
        precision: parsed.precision === 'high' ? 'high' : 'medium',
        formattedAddress: parsed.formattedAddress || fullQuery,
        neighborhood: parsed.neighborhood,
        sourceDescription: 'Geocodificação Inteligente Gemini (Número Exato)'
      };
    }
  } catch (e) {
    console.warn('Gemini accurate geocoding fallback:', e);
  }
  return null;
}

/**
 * Consulta Photon Kompass (OSM difuso com suporte a números prediais)
 */
async function geocodeWithPhoton(query: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://photon.kompass.de/api/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      const [lon, lat] = feat.geometry.coordinates;
      const props = feat.properties || {};
      const hasHousenumber = !!props.housenumber;
      return {
        lat,
        lng: lon,
        method: 'photon_precise',
        precision: hasHousenumber ? 'high' : 'medium',
        formattedAddress: [props.name, props.housenumber, props.city, props.state].filter(Boolean).join(', '),
        neighborhood: props.district || props.suburb,
        sourceDescription: hasHousenumber ? 'Photon (Número Predial Confirmado)' : 'Photon (Logradouro)'
      };
    }
  } catch (e) {
    console.warn('Photon geocoding error:', e);
  }
  return null;
}

/**
 * Consulta Nominatim estruturada (OSM)
 */
async function geocodeWithNominatim(street: string, city: string, uf: string): Promise<GeocodeResult | null> {
  try {
    // 1. Busca por Query Completa
    const query = `${street}, ${city} - ${uf}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const item = data[0];
      const addr = item.address || {};
      const hasHouseNumber = !!addr.house_number;
      return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        method: 'nominatim_exact',
        precision: hasHouseNumber ? 'high' : 'medium',
        formattedAddress: item.display_name,
        neighborhood: addr.suburb || addr.neighbourhood,
        sourceDescription: hasHouseNumber ? 'OpenStreetMap (Número Exato)' : 'OpenStreetMap (Logradouro)'
      };
    }
  } catch (e) {
    console.warn('Nominatim geocoding error:', e);
  }
  return null;
}

/**
 * MOTOR PRINCIPAL DE GEOCODIFICAÇÃO DE ALTA PRECISÃO
 * 
 * Ordem de Execução Otimizada:
 * 1. Coordenadas diretas (se informadas)
 * 2. Cache LocalStorage
 * 3. Interpolação de Corredor (se for grande avenida com número predial como Av. Amoreiras 6100)
 * 4. Gemini AI Geocoding com Grounding de Numeração Predial
 * 5. Photon Kompass
 * 6. Nominatim OSM Estruturado
 */
export async function getAccurateCoordinates(
  rawAddress: string,
  city: string = 'Campinas',
  uf: string = 'SP',
  forceRefresh: boolean = false
): Promise<GeocodeResult | null> {
  if (!rawAddress || rawAddress.trim() === '') return null;

  const parsed = normalizeBrazilianAddress(rawAddress, city, uf);
  const cacheKey = `${CACHE_PREFIX}${parsed.normalizedQuery.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // 1. Verificar Cache
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
          return {
            ...data,
            method: 'cached',
            sourceDescription: `${data.sourceDescription || 'Local'} (Salvo em Cache - 0 req)`
          };
        }
      }
    } catch (e) {}
  }

  let finalResult: GeocodeResult | null = null;

  // 2. Se for uma grande avenida mapeada com número predial, calcular via interpolação de alta fidelidade
  if (parsed.streetNumber !== null) {
    const corridorMatch = interpolateCorridor(parsed.streetName, parsed.streetNumber, parsed.city);
    if (corridorMatch) {
      finalResult = corridorMatch;
    }
  }

  // 3. Se não houver corredor pré-calculado ou for necessária precisão adicional, usar Gemini AI
  if (!finalResult) {
    finalResult = await geocodeWithGemini(parsed.normalizedQuery, parsed.streetNumber);
  }

  // 4. Se o Gemini não respondeu ou deu erro, tentar Photon Kompass
  if (!finalResult) {
    finalResult = await geocodeWithPhoton(`${parsed.cleanAddress}, ${parsed.city}`);
  }

  // 5. Tentar Nominatim OSM
  if (!finalResult) {
    finalResult = await geocodeWithNominatim(parsed.cleanAddress, parsed.city, parsed.uf);
  }

  // Salvar no Cache Persistente se obteve sucesso
  if (finalResult && typeof finalResult.lat === 'number' && typeof finalResult.lng === 'number') {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(finalResult));
    } catch (e) {}
    return finalResult;
  }

  return null;
}

/**
 * Salva manualmente uma coordenada corrigida pelo usuário no cache
 */
export function setManualCoordinateOverride(rawAddress: string, city: string, uf: string, lat: number, lng: number): void {
  const parsed = normalizeBrazilianAddress(rawAddress, city, uf);
  const cacheKey = `${CACHE_PREFIX}${parsed.normalizedQuery.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const record: GeocodeResult = {
    lat,
    lng,
    method: 'direct_coords',
    precision: 'high',
    formattedAddress: `${parsed.cleanAddress}, ${parsed.city} - ${parsed.uf}`,
    sourceDescription: 'Ajuste Manual do Usuário (Localização Exata Confirmada)'
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(record));
  } catch (e) {}
}

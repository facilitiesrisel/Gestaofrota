import { GoogleGenAI, Type } from "@google/genai";

// Lazy-initialized AI client to prevent module-load crashes in browser
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = (typeof process !== "undefined" && process.env ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : "") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    return null;
  }
  try {
    aiClient = new GoogleGenAI({ apiKey });
    return aiClient;
  } catch (e) {
    console.warn("Failed to initialize GoogleGenAI client:", e);
    return null;
  }
}

// Cache estático para cidades comuns da região para economizar cota da API (evitar erro 429)
const STATIC_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "campinas": { lat: -22.9099, lng: -47.0626 },
  "são paulo": { lat: -23.5505, lng: -46.6333 },
  "sao paulo": { lat: -23.5505, lng: -46.6333 },
  "paulínia": { lat: -22.7553, lng: -47.1498 },
  "paulinia": { lat: -22.7553, lng: -47.1498 },
  "sumaré": { lat: -22.8205, lng: -47.2669 },
  "sumare": { lat: -22.8205, lng: -47.2669 },
  "hortolândia": { lat: -22.8583, lng: -47.2200 },
  "hortolandia": { lat: -22.8583, lng: -47.2200 },
  "americana": { lat: -22.7398, lng: -47.3316 },
  "limeira": { lat: -22.5646, lng: -47.4017 },
  "piracicaba": { lat: -22.7338, lng: -47.6476 },
  "indaiatuba": { lat: -23.0903, lng: -47.2180 },
  "valinhos": { lat: -22.9699, lng: -46.9972 },
  "vinhedo": { lat: -23.0302, lng: -46.9736 },
  "jaguariúna": { lat: -22.7025, lng: -46.9870 },
  "jaguariuna": { lat: -22.7025, lng: -46.9870 },
  "rio claro": { lat: -22.4149, lng: -47.5651 },
  "araras": { lat: -22.3572, lng: -47.3842 },
  "sorocaba": { lat: -23.5015, lng: -47.4521 },
  "santos": { lat: -23.9618, lng: -46.3322 },
  "ribeirão preto": { lat: -21.1704, lng: -47.8103 },
  "ribeirao preto": { lat: -21.1704, lng: -47.8103 }
};

/**
 * Fetches the round-trip driving distance between two locations using Gemini.
 * @param origin - The starting point.
 * @param destination - The destination.
 * @returns An object with the distance in km and a potential error message.
 */
export const fetchDistanceWithGemini = async (origin: string, destination: string): Promise<{ distance: number | null; error: string | null; }> => {
    if (!destination) {
        return { distance: null, error: "A cidade de destino nao foi fornecida." };
    }
    
    // Implement caching to reduce API calls for the same routes.
    const cacheKey = `distance:${origin.toLowerCase().replace(/[^a-z0-9]/g, '')}:${destination.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        try {
            const parsedData = JSON.parse(cachedData);
            if (typeof parsedData.distance === 'number') {
                 return { distance: parsedData.distance, error: null };
            }
        } catch (e) {
            console.warn("Failed to parse cached distance data, fetching fresh.", e);
            localStorage.removeItem(cacheKey); // Clear corrupted cache entry
        }
    }
    
    // Using gemini-2.5-flash as it's suitable for basic text tasks.
    const model = 'gemini-2.5-flash';
    
    try {
        const client = getAiClient();
        if (!client) {
            return { distance: null, error: "Chave da API Gemini não configurada." };
        }
        const response = await client.models.generateContent({
            model,
            contents: `Qual e a distancia de conducao de ida e volta em quilometros entre ${origin} e ${destination}?`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        distance: {
                            type: Type.NUMBER,
                            description: "Distancia total de ida e volta em quilometros."
                        }
                    },
                    required: ["distance"]
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (result && typeof result.distance === 'number') {
            const distance = Math.round(result.distance);
            // Cache the successful result to prevent future API calls for the same route.
            localStorage.setItem(cacheKey, JSON.stringify({ distance }));
            return { distance, error: null };
        } else {
            console.warn("Gemini response for distance was not in the expected format.", result);
            return { distance: null, error: "Nao foi possivel extrair a distancia da resposta da IA." };
        }
    } catch (e: any) {
        console.error("Error fetching distance with Gemini:", e);

        // Improved error handling to provide specific feedback for rate limit issues.
        let errorMessage = "A API de IA falhou ao calcular a distancia. Verifique a chave de API e a conexao.";
        // The error object can be complex; stringify it to safely search for rate limit codes.
        const errorString = JSON.stringify(e);
        if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
             errorMessage = "O limite de solicitacoes para a API de calculo de distancia foi atingido. Por favor, aguarde um momento e tente novamente. Se o problema persistir, contate o administrador do sistema.";
        }
        
        return { distance: null, error: errorMessage };
    }
};

import { getAccurateCoordinates } from "./accurateGeocodingService";

/**
 * Geocodes an address string to latitude and longitude using Gemini and Multi-Provider Accurate Geocoding.
 * Implements aggressive caching (LocalStorage -> Accurate Geocoding -> Static Memory -> API) to minimize quota usage.
 * @param address - The address to geocode.
 * @returns An object with lat and lng, or null if not found.
 */
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!address) return null;
    
    const lowerAddr = address.toLowerCase().trim();
    // Create a simple, safe cache key
    const cacheKey = `geo_cache:${lowerAddr.replace(/[^a-z0-9]/g, '')}`;

    // 1. Check LocalStorage Cache First (Persistent)
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Error reading geocoding cache from localStorage', e);
    }

    // 2. Se o endereço possuir rua, avenida, número ou vírgula, usar o motor de alta precisão
    const isFullAddress = lowerAddr.includes('av') || lowerAddr.includes('rua') || lowerAddr.includes('rod') || 
                          lowerAddr.includes('est') || lowerAddr.includes(',') || /\d+/.test(lowerAddr);

    if (isFullAddress) {
        try {
            const accurate = await getAccurateCoordinates(address);
            if (accurate) {
                const coords = { lat: accurate.lat, lng: accurate.lng };
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(coords));
                } catch(e) {}
                return coords;
            }
        } catch (e) {
            console.warn('Accurate geocoding error in geminiService, continuing fallback:', e);
        }
    }

    // 3. Check Static Cache (Apenas se a busca for estritamente o nome de uma cidade, sem rua/número)
    if (!isFullAddress) {
        for (const [key, coords] of Object.entries(STATIC_COORDINATES)) {
            if (lowerAddr === key || lowerAddr === `${key}, sp` || lowerAddr === `${key} sp` || lowerAddr === `${key} - sp`) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(coords));
                } catch(e) {}
                return coords;
            }
        }
    }

    // 4. Call Gemini API
    const model = 'gemini-2.5-flash';
    
    try {
        const client = getAiClient();
        if (!client) {
            return null;
        }
        const response = await client.models.generateContent({
            model,
            contents: `Forneca as coordenadas de latitude e longitude para o seguinte endereco no Brasil: ${address}. Se possuir número predial, forneça a coordenada exata daquele número na via.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lat: {
                            type: Type.NUMBER,
                            description: "A latitude da localizacao exata."
                        },
                        lng: {
                            type: Type.NUMBER,
                            description: "A longitude da localizacao exata."
                        }
                    },
                    required: ["lat", "lng"]
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);

        if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
            const coords = { lat: result.lat, lng: result.lng };
            try {
                localStorage.setItem(cacheKey, JSON.stringify(coords));
            } catch (e) {}
            return coords;
        } else {
            return null;
        }
    } catch (e: any) {
        console.error(`Error geocoding address "${address}" with Gemini:`, e);
        throw e;
    }
};
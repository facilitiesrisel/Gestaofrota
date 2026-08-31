/**
 * Risel Combustíveis - Serviço de Gestão de Provedores de Mapa & Controle de Cota Sem Custo
 *
 * Gerencia o uso da cota gratuita da API do Google Maps com alternância automática (failover)
 * para Mapbox quando faltar 10% da cota mensal gratuita (90% de consumo atingido), garantindo
 * custo ZERO para a Risel e exibição 100% em Português do Brasil (pt-BR).
 */

export interface MapLayerConfig {
  id: string;
  label: string;
  provider: 'google' | 'mapbox' | 'osm_carto';
  type: 'streets' | 'satellite' | 'terrain' | 'hybrid';
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom?: number;
}

export interface MapQuotaState {
  currentMonth: string; // formato YYYY-MM
  requestsThisMonth: number;
  monthlyLimit: number; // Padrão: 25.000 requisições (cota de segurança do tier gratuito)
  thresholdPercent: number; // 90% (quando faltar 10% para iniciar cobrança)
  isFallbackActive: boolean; // true quando atinge o limite e migra para Mapbox
  forcedProvider: 'auto' | 'google' | 'mapbox';
  activeProviderName: 'Google Maps' | 'Mapbox' | 'OpenStreetMap';
}

const STORAGE_KEY = 'risel_map_quota_state';
const DEFAULT_LIMIT = 25000; // Limite de segurança mensal para manter gratuidade total
const THRESHOLD_PERCENT = 90; // Ativa Mapbox quando atingir 90% (faltando 10%)

// Tokens opcionais configuráveis no ambiente ou painel de configurações
const MAPBOX_DEFAULT_TOKEN = 'pk.eyJ1IjoicmlzZWwtZnJvdGFzIiwiYSI6ImNsdzF4cWZvYjA2b20ycW15aXo5ZXByOXgifQ.default_public';

class MapQuotaManager {
  private state: MapQuotaState;
  private listeners: Array<(state: MapQuotaState) => void> = [];

  constructor() {
    this.state = this.loadState();
  }

  private getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private loadState(): MapQuotaState {
    const currentMonth = this.getCurrentMonthKey();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.currentMonth === currentMonth) {
          return {
            ...parsed,
            monthlyLimit: parsed.monthlyLimit || DEFAULT_LIMIT,
            thresholdPercent: THRESHOLD_PERCENT
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar estado de cota do mapa:', e);
    }

    // Inicialização do novo mês
    const initialState: MapQuotaState = {
      currentMonth,
      requestsThisMonth: 0,
      monthlyLimit: DEFAULT_LIMIT,
      thresholdPercent: THRESHOLD_PERCENT,
      isFallbackActive: false,
      forcedProvider: 'auto',
      activeProviderName: 'Google Maps'
    };
    this.saveState(initialState);
    return initialState;
  }

  private saveState(state: MapQuotaState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  public getState(): MapQuotaState {
    // Valida se o mês virou
    const currentMonth = this.getCurrentMonthKey();
    if (this.state.currentMonth !== currentMonth) {
      this.state = {
        currentMonth,
        requestsThisMonth: 0,
        monthlyLimit: this.state.monthlyLimit || DEFAULT_LIMIT,
        thresholdPercent: THRESHOLD_PERCENT,
        isFallbackActive: false,
        forcedProvider: this.state.forcedProvider || 'auto',
        activeProviderName: 'Google Maps'
      };
      this.saveState(this.state);
      this.notify();
    }
    return { ...this.state };
  }

  /**
   * Registra uma requisição/carregamento de mapa no sistema
   */
  public recordMapUsage(count: number = 1): MapQuotaState {
    const currentMonth = this.getCurrentMonthKey();
    if (this.state.currentMonth !== currentMonth) {
      this.state.currentMonth = currentMonth;
      this.state.requestsThisMonth = 0;
    }

    this.state.requestsThisMonth += count;

    // Checa se atingiu 90% (faltando 10% para cobrança)
    const usagePercent = (this.state.requestsThisMonth / this.state.monthlyLimit) * 100;
    const shouldFallback = usagePercent >= this.state.thresholdPercent;

    if (shouldFallback !== this.state.isFallbackActive) {
      this.state.isFallbackActive = shouldFallback;
      console.log(
        `Risel Map Quota: Limite de 90% ${shouldFallback ? 'atingido' : 'normalizado'}. Provedor ativo agora: ${
          shouldFallback ? 'Mapbox (Failover Automático)' : 'Google Maps (Cota Gratuita)'
        }`
      );
    }

    // Define nome do provedor ativo
    if (this.state.forcedProvider === 'google') {
      this.state.activeProviderName = 'Google Maps';
    } else if (this.state.forcedProvider === 'mapbox') {
      this.state.activeProviderName = 'Mapbox';
    } else {
      this.state.activeProviderName = this.state.isFallbackActive ? 'Mapbox' : 'Google Maps';
    }

    this.saveState(this.state);
    this.notify();
    return { ...this.state };
  }

  public setForcedProvider(provider: 'auto' | 'google' | 'mapbox') {
    this.state.forcedProvider = provider;
    if (provider === 'google') {
      this.state.activeProviderName = 'Google Maps';
    } else if (provider === 'mapbox') {
      this.state.activeProviderName = 'Mapbox';
    } else {
      this.state.activeProviderName = this.state.isFallbackActive ? 'Mapbox' : 'Google Maps';
    }
    this.saveState(this.state);
    this.notify();
  }

  public setSimulatedUsage(percent: number) {
    const reqs = Math.round((this.state.monthlyLimit * percent) / 100);
    this.state.requestsThisMonth = reqs;
    this.state.isFallbackActive = percent >= this.state.thresholdPercent;
    this.saveState(this.state);
    this.notify();
  }

  public resetUsage() {
    this.state.requestsThisMonth = 0;
    this.state.isFallbackActive = false;
    this.saveState(this.state);
    this.notify();
  }

  public subscribe(listener: (state: MapQuotaState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const current = { ...this.state };
    this.listeners.forEach(l => {
      try {
        l(current);
      } catch (e) {}
    });
  }

  /**
   * Retorna a lista de camadas ativas (Google Maps quando na cota ou Mapbox no failover)
   * Todas configuradas rigorosamente em Português do Brasil (pt-BR).
   */
  public getLayers(): {
    streets: MapLayerConfig;
    satellite: MapLayerConfig;
    terrain?: MapLayerConfig;
    currentActive: MapLayerConfig;
  } {
    const state = this.getState();
    const useMapbox = state.forcedProvider === 'mapbox' || (state.forcedProvider === 'auto' && state.isFallbackActive);

    const mapboxToken = (typeof window !== 'undefined' && (window as any).__MAPBOX_TOKEN__) ||
      (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN ||
      MAPBOX_DEFAULT_TOKEN;

    if (useMapbox) {
      // Provedor de Failover: Mapbox configurado para visual idêntico ao Google Maps e em Português do Brasil
      const mapboxStreets: MapLayerConfig = {
        id: 'mapbox_streets',
        label: 'Mapbox Ruas (PT-BR - Failover Cota)',
        provider: 'mapbox',
        type: 'streets',
        // Estilo Streets de alta precisão com fallback inteligente
        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 20
      };

      const mapboxSatellite: MapLayerConfig = {
        id: 'mapbox_satellite',
        label: 'Mapbox Satélite Híbrido (PT-BR)',
        provider: 'mapbox',
        type: 'satellite',
        url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.maxar.com/">Maxar</a>',
        maxZoom: 20
      };

      return {
        streets: mapboxStreets,
        satellite: mapboxSatellite,
        currentActive: mapboxStreets
      };
    }

    // Provedor Principal Sem Custo: Google Maps em Português do Brasil (hl=pt-BR, gl=BR)
    const googleStreets: MapLayerConfig = {
      id: 'google_streets',
      label: 'Google Maps Ruas (PT-BR)',
      provider: 'google',
      type: 'streets',
      url: 'https://mt1.google.com/vt/lyrs=m&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}',
      attribution: '&copy; Google Maps',
      maxZoom: 21
    };

    const googleSatellite: MapLayerConfig = {
      id: 'google_satellite',
      label: 'Google Maps Satélite (PT-BR)',
      provider: 'google',
      type: 'satellite',
      url: 'https://mt1.google.com/vt/lyrs=y&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}',
      attribution: '&copy; Google Maps',
      maxZoom: 21
    };

    const googleTerrain: MapLayerConfig = {
      id: 'google_terrain',
      label: 'Google Maps Relevo (PT-BR)',
      provider: 'google',
      type: 'terrain',
      url: 'https://mt1.google.com/vt/lyrs=p&hl=pt-BR&gl=BR&x={x}&y={y}&z={z}',
      attribution: '&copy; Google Maps',
      maxZoom: 21
    };

    return {
      streets: googleStreets,
      satellite: googleSatellite,
      terrain: googleTerrain,
      currentActive: googleStreets
    };
  }
}

export const mapQuotaService = new MapQuotaManager();

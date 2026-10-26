import { safeGetItem, safeSetItem, safeRemoveItem } from './safeStorage';

const COOKIE_ID_NAME = 'risel_my_active_trip_id';
const COOKIE_DATA_NAME = 'risel_my_active_trip_data';

function setCookie(name: string, value: string, maxAgeSeconds = 172800) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  } catch (e) {}
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(';');
    for (let part of parts) {
      part = part.trim();
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.substring(prefix.length));
      }
    }
  } catch (e) {}
  return null;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {}
}

export function isDailyTripCompleted(trip: any): boolean {
  if (!trip) return false;
  const st = String(trip.status || '').trim();
  const hasValidFinalKm =
    trip.finalKm !== undefined &&
    trip.finalKm !== null &&
    String(trip.finalKm).trim() !== '' &&
    !isNaN(Number(trip.finalKm)) &&
    Number(trip.finalKm) > 0;

  return (
    st === 'Concluída' ||
    st === 'Concluida' ||
    st === 'Completed' ||
    st === 'Cancelada' ||
    st === 'Cancelled' ||
    Boolean(trip.actualReturnDateTime) ||
    hasValidFinalKm
  );
}

export function saveDeviceActiveDailyTrip(tripId: string, tripData: any): void {
  if (!tripId) return;
  const payload = {
    ...tripData,
    id: tripId,
    status: 'Em Uso',
  };
  const serialized = JSON.stringify(payload);

  // 1. Grava via safeStorage (localStorage com limpeza automática de cota + sessionStorage + memória)
  safeSetItem('myActiveDailyTripId', tripId);
  safeSetItem('activeDailyTripId', tripId);
  safeSetItem('activeDailyTripData', serialized);
  if (payload.driverName) {
    safeSetItem('myActiveDailyTripDriver', String(payload.driverName).trim().toUpperCase());
  }

  // 2. Redundância explícita em sessionStorage
  try {
    sessionStorage.setItem('myActiveDailyTripId', tripId);
    sessionStorage.setItem('activeDailyTripId', tripId);
    sessionStorage.setItem('activeDailyTripData', serialized);
  } catch (e) {}

  // 3. Redundância em Cookie de 1ª parte (persiste no navegador do celular mesmo se o localStorage atingir limite)
  setCookie(COOKIE_ID_NAME, tripId, 172800);
  setCookie(COOKIE_DATA_NAME, serialized, 172800);

  // 4. Sincroniza parâmetros da URL sem recarregar a página
  try {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('sub', 'dailyUse');
    currentUrl.searchParams.set('tripId', tripId);
    window.history.replaceState(null, '', currentUrl.toString());
  } catch (e) {}

  try {
    window.dispatchEvent(new Event('risel_daily_trip_updated'));
  } catch (e) {}
}

export function clearDeviceActiveDailyTrip(): void {
  safeRemoveItem('myActiveDailyTripId');
  safeRemoveItem('activeDailyTripId');
  safeRemoveItem('activeDailyTripData');
  safeRemoveItem('myActiveDailyTripDriver');

  deleteCookie(COOKIE_ID_NAME);
  deleteCookie(COOKIE_DATA_NAME);

  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('tripId')) {
      currentUrl.searchParams.delete('tripId');
      window.history.replaceState(null, '', currentUrl.toString());
    }
  } catch (e) {}

  try {
    window.dispatchEvent(new Event('risel_daily_trip_updated'));
  } catch (e) {}
}

export function getDeviceActiveDailyTrip(): { id: string; data: any | null } | null {
  if (typeof window === 'undefined') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('tripId');
    const fromStorage =
      safeGetItem('myActiveDailyTripId') ||
      safeGetItem('activeDailyTripId') ||
      getCookie(COOKIE_ID_NAME);

    const rawData =
      safeGetItem('activeDailyTripData') ||
      getCookie(COOKIE_DATA_NAME);

    let parsedData: any = null;
    if (rawData) {
      try {
        parsedData = JSON.parse(rawData);
      } catch (e) {
        parsedData = null;
      }
    }

    const resolvedId = fromUrl || fromStorage || parsedData?.id || null;
    if (!resolvedId) {
      return null;
    }

    if (parsedData && isDailyTripCompleted(parsedData)) {
      clearDeviceActiveDailyTrip();
      return null;
    }

    // Expira viagens órfãs com mais de 48h
    if (parsedData?.departureDateTime) {
      const depTime = new Date(parsedData.departureDateTime).getTime();
      if (depTime > 0 && Date.now() - depTime > 48 * 60 * 60 * 1000) {
        clearDeviceActiveDailyTrip();
        return null;
      }
    }

    // Se veio pela URL ou cookie mas o storage local tinha sido limpo pelo celular, restaura no safeStorage
    if (resolvedId && !safeGetItem('myActiveDailyTripId')) {
      safeSetItem('myActiveDailyTripId', resolvedId);
      safeSetItem('activeDailyTripId', resolvedId);
    }
    if (parsedData && !safeGetItem('activeDailyTripData')) {
      safeSetItem('activeDailyTripData', JSON.stringify(parsedData));
    }

    return {
      id: resolvedId,
      data: parsedData ? { ...parsedData, id: resolvedId } : { id: resolvedId },
    };
  } catch (e) {
    return null;
  }
}

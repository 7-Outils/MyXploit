/**
 * Températures journalières observées (7 j) + prévues (7 j) pour le signal
 * allumage/arrêt du chauffage. Source : Open-Meteo prévision (gratuit, sans
 * clé, modèles AROME/ARPEGE sur la France). Météo France DPClim ne fournit que
 * de l'observé, inutilisable pour la prévision.
 *
 * Rien n'est stocké en base : cache Next de 6 h par coordonnées arrondies.
 */
import { unstable_cache } from "next/cache";
import { WEATHER_STATIONS, resolveStationKey, getStationFromPostalCode } from "@/lib/dju-sync";
import type { DailyTemp } from "@/lib/heating-season";

interface SiteCoords {
  latitude: number | null;
  longitude: number | null;
  stationMeteo: string | null;
  postalCode: string | null;
}

/** Coordonnées représentatives d'un contrat : moyenne des lat/lon renseignés,
 *  sinon station météo du premier site (stationMeteo ou code postal). */
export function contractCoordinates(sites: SiteCoords[]): { lat: number; lon: number } | null {
  const withCoords = sites.filter(
    (s): s is SiteCoords & { latitude: number; longitude: number } =>
      typeof s.latitude === "number" && typeof s.longitude === "number"
  );
  if (withCoords.length > 0) {
    return {
      lat: withCoords.reduce((a, s) => a + s.latitude, 0) / withCoords.length,
      lon: withCoords.reduce((a, s) => a + s.longitude, 0) / withCoords.length,
    };
  }
  for (const s of sites) {
    const key = resolveStationKey(s.stationMeteo) ?? (s.postalCode ? getStationFromPostalCode(s.postalCode) : null);
    const station = key ? WEATHER_STATIONS[key] : null;
    if (station) return { lat: station.lat, lon: station.lon };
  }
  return null;
}

async function fetchDailyTempsUncached(lat: number, lon: number): Promise<DailyTemp[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&past_days=7&forecast_days=7&daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean&timezone=Europe/Paris`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const times: string[] = json?.daily?.time ?? [];
  const mins: (number | null)[] = json?.daily?.temperature_2m_min ?? [];
  const maxs: (number | null)[] = json?.daily?.temperature_2m_max ?? [];
  const means: (number | null)[] = json?.daily?.temperature_2m_mean ?? [];

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const out: DailyTemp[] = [];
  for (let i = 0; i < times.length; i++) {
    const tMin = mins[i];
    const tMax = maxs[i];
    if (tMin === null || tMax === null || tMin === undefined || tMax === undefined) continue;
    const tMean = means[i] ?? (tMin + tMax) / 2;
    out.push({ date: times[i], tMin, tMax, tMean, isForecast: times[i] >= today });
  }
  return out;
}

export async function fetchDailyTemps(lat: number, lon: number): Promise<DailyTemp[]> {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  const cached = unstable_cache(
    () => fetchDailyTempsUncached(rLat, rLon),
    ["heating-weather", String(rLat), String(rLon)],
    { revalidate: 6 * 3600 }
  );
  return cached();
}

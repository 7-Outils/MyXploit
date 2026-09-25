/**
 * Saison de chauffe : helpers purs partagés (saison "YYYY-YYYY+1", statut d'un
 * site d'après sa période de chauffe, signal météo allumage/arrêt).
 */

// ─── Saison "YYYY-YYYY+1" ───────────────────────────────────────────────────

// Saison physique basée sur une date. Juil-Déc → saison commençant cette
// année ; Jan-Juin → saison débutée l'année précédente.
export function dateToSeason(d: Date): string {
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function currentSeason(): string {
  return dateToSeason(new Date());
}

// ─── Seuils météo ───────────────────────────────────────────────────────────
//
// Un bâtiment tient sans chauffage jusqu'à ~15-16 °C extérieurs grâce aux
// apports internes et à l'inertie. On regarde une moyenne glissante (pas la
// température du jour) pour ne pas réagir à un pic isolé, et on utilise deux
// seuils différents (hystérésis) pour éviter le yo-yo allumage/arrêt :
//   - arrêt recommandé : moyenne 5 j ≥ 16 °C et aucun jour prévu sous 13 °C
//   - démarrage recommandé : moyenne 5 j < 14 °C et prévision 7 j < 15 °C
// Valeurs d'usage exploitant, sans norme derrière : à ajuster si besoin.
export const HEATING_START_THRESHOLD = 14;
export const HEATING_STOP_THRESHOLD = 16;
export const HEATING_STOP_FORECAST_MIN = 13;
export const HEATING_START_FORECAST_MAX = 15;

export type HeatingSignal = "START" | "STOP" | "NEUTRAL";

export interface DailyTemp {
  date: string; // YYYY-MM-DD
  tMin: number;
  tMax: number;
  tMean: number;
  isForecast: boolean;
}

export interface HeatingWeather {
  signal: HeatingSignal;
  observedMean5d: number | null;
  forecastMean7d: number | null;
  forecastMinDaily7d: number | null;
  days: DailyTemp[];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeHeatingSignal(daily: DailyTemp[], todayIso: string): HeatingWeather {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const observed = sorted.filter((d) => d.date < todayIso);
  const forecast = sorted.filter((d) => d.date >= todayIso).slice(0, 7);

  const observedMean5d = mean(observed.slice(-5).map((d) => d.tMean));
  const forecastMean7d = mean(forecast.map((d) => d.tMean));
  const forecastMinDaily7d = forecast.length ? Math.min(...forecast.map((d) => d.tMean)) : null;

  let signal: HeatingSignal = "NEUTRAL";
  if (observedMean5d !== null && forecastMean7d !== null && forecastMinDaily7d !== null) {
    if (observedMean5d >= HEATING_STOP_THRESHOLD && forecastMinDaily7d >= HEATING_STOP_FORECAST_MIN) {
      signal = "STOP";
    } else if (observedMean5d < HEATING_START_THRESHOLD && forecastMean7d < HEATING_START_FORECAST_MAX) {
      signal = "START";
    }
  }

  return {
    signal,
    observedMean5d,
    forecastMean7d,
    forecastMinDaily7d,
    days: [...observed.slice(-7), ...forecast],
  };
}

// ─── Statut d'un site ───────────────────────────────────────────────────────

export type SiteHeatingStatus = "ARRETE" | "ALLUMAGE_PREVU" | "EN_CHAUFFE" | "ARRET_PREVU";

export interface PeriodLike {
  startDate: Date | string;
  endDate: Date | string | null;
  startProvisional: boolean;
  endProvisional: boolean;
}

function toIso(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

export function siteHeatingStatus(period: PeriodLike | null, todayIso: string): SiteHeatingStatus {
  if (!period) return "ARRETE";
  if (period.startProvisional) return "ALLUMAGE_PREVU";
  if (period.endDate) {
    if (period.endProvisional) return "ARRET_PREVU";
    // Arrêt confirmé mais daté dans le futur : encore en chauffe jusque-là.
    return toIso(period.endDate) <= todayIso ? "ARRETE" : "EN_CHAUFFE";
  }
  return toIso(period.startDate) <= todayIso ? "EN_CHAUFFE" : "ALLUMAGE_PREVU";
}

export const SITE_HEATING_STATUS_LABEL: Record<SiteHeatingStatus, string> = {
  ARRETE: "À l'arrêt",
  ALLUMAGE_PREVU: "Allumage prévu",
  EN_CHAUFFE: "En chauffe",
  ARRET_PREVU: "Arrêt prévu",
};

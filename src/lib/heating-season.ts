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
  /** Premier jour (aujourd'hui inclus) où les conditions d'allumage sont
   *  réunies d'après la prévision 15 j, null si aucun dans l'horizon. */
  startDate: string | null;
  /** Idem pour l'arrêt. */
  stopDate: string | null;
  days: DailyTemp[];
}

// Au-delà de J+7 la prévision n'est qu'une tendance : affichée à part.
export const HEATING_RELIABLE_DAYS = 7;
// Fenêtre de prévision minimale pour projeter une date (fin d'horizon).
const MIN_FORWARD_DAYS = 3;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

type DayCheck = { mean5d: number; forwardMean: number; forwardMin: number };

function checkStart(c: DayCheck) {
  return c.mean5d < HEATING_START_THRESHOLD && c.forwardMean < HEATING_START_FORECAST_MAX;
}

function checkStop(c: DayCheck) {
  return c.mean5d >= HEATING_STOP_THRESHOLD && c.forwardMin >= HEATING_STOP_FORECAST_MIN;
}

/**
 * Applique la règle d'allumage/arrêt à chaque jour de la prévision, comme si
 * on était ce jour-là : moyenne des 5 jours précédents (observés puis prévus)
 * et prévision des 7 jours suivants. Pour aujourd'hui, c'est exactement le
 * signal courant ; pour les jours suivants, c'est la date projetée.
 */
export function computeHeatingSignal(daily: DailyTemp[], todayIso: string): HeatingWeather {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const firstForecast = sorted.findIndex((d) => d.date >= todayIso);
  const observed = firstForecast === -1 ? sorted : sorted.slice(0, firstForecast);
  const forecast = firstForecast === -1 ? [] : sorted.slice(firstForecast);

  const checkAt = (i: number): DayCheck | null => {
    if (i < 5) return null;
    const forward = sorted.slice(i, i + 7).map((d) => d.tMean);
    if (forward.length < MIN_FORWARD_DAYS) return null;
    return {
      mean5d: mean(sorted.slice(i - 5, i).map((d) => d.tMean))!,
      forwardMean: mean(forward)!,
      forwardMin: Math.min(...forward),
    };
  };

  let startDate: string | null = null;
  let stopDate: string | null = null;
  if (firstForecast !== -1) {
    for (let i = firstForecast; i < sorted.length && (!startDate || !stopDate); i++) {
      const c = checkAt(i);
      if (!c) continue;
      if (!startDate && checkStart(c)) startDate = sorted[i].date;
      if (!stopDate && checkStop(c)) stopDate = sorted[i].date;
    }
  }

  const signal: HeatingSignal =
    stopDate === todayIso ? "STOP" : startDate === todayIso ? "START" : "NEUTRAL";

  const week = forecast.slice(0, HEATING_RELIABLE_DAYS);
  return {
    signal,
    observedMean5d: mean(observed.slice(-5).map((d) => d.tMean)),
    forecastMean7d: mean(week.map((d) => d.tMean)),
    forecastMinDaily7d: week.length ? Math.min(...week.map((d) => d.tMean)) : null,
    startDate,
    stopDate,
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

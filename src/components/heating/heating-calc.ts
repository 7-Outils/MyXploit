/**
 * Rejoue, jour par jour et côté navigateur, la règle d'allumage/arrêt de
 * computeHeatingSignal (src/lib/heating-season.ts) pour pouvoir l'afficher :
 * fenêtre des 5 jours d'avant, fenêtre des 7 jours à partir du jour, et
 * verdict de chaque condition. Même règle, mêmes données (weather.days =
 * 7 jours observés + 15 jours prévus).
 */
import { HEATING_RELIABLE_DAYS, type DailyTemp, type HeatingThresholds } from "@/lib/heating-season";

// Même minimum que heating-season.ts : en fin d'horizon, il faut au moins
// 3 jours de prévision devant soi pour juger la semaine suivante.
export const MIN_FORWARD_DAYS = 3;

export interface Window {
  /** Index (dans days) du premier et du dernier jour de la fenêtre. */
  from: number;
  to: number;
  mean: number;
}

export interface ForwardWindow extends Window {
  min: number;
  minIndex: number;
  count: number;
}

export interface DayEval {
  index: number;
  day: DailyTemp;
  /** Jour déjà passé (observé) : la règle ne s'y applique pas. */
  past: boolean;
  /** Au-delà de J+7 : prévision de tendance. */
  trend: boolean;
  back: Window | null;
  fwd: ForwardWindow | null;
  start: { back: boolean; fwd: boolean; ok: boolean } | null;
  stop: { back: boolean; fwd: boolean; ok: boolean } | null;
}

const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

export function evaluateDays(days: DailyTemp[], todayIso: string, t: HeatingThresholds): DayEval[] {
  const firstForecast = days.findIndex((d) => d.date >= todayIso);
  return days.map((day, i) => {
    const past = firstForecast === -1 || i < firstForecast;
    const trend = !past && i - firstForecast >= HEATING_RELIABLE_DAYS;
    let back: Window | null = null;
    let fwd: ForwardWindow | null = null;
    if (!past && i >= 5) {
      back = { from: i - 5, to: i - 1, mean: avg(days.slice(i - 5, i).map((d) => d.tMean)) };
      const f = days.slice(i, i + 7).map((d) => d.tMean);
      if (f.length >= MIN_FORWARD_DAYS) {
        const min = Math.min(...f);
        fwd = { from: i, to: i + f.length - 1, mean: avg(f), min, minIndex: i + f.indexOf(min), count: f.length };
      }
    }
    const ok = back && fwd;
    const start = ok
      ? (() => {
          const b = back!.mean < t.start;
          const f = fwd!.mean < t.startForecastMax;
          return { back: b, fwd: f, ok: b && f };
        })()
      : null;
    const stop = ok
      ? (() => {
          const b = back!.mean >= t.stop;
          const f = fwd!.min >= t.stopForecastMin;
          return { back: b, fwd: f, ok: b && f };
        })()
      : null;
    return { index: i, day, past, trend, back, fwd, start, stop };
  });
}

/** Premier jour où la règle météo seule est vraie (avant report vacances). */
export function firstRuleDate(evals: DayEval[], kind: "start" | "stop"): string | null {
  return evals.find((e) => e[kind]?.ok)?.day.date ?? null;
}

// ─── Formats ────────────────────────────────────────────────────────────────

/** « 12,4° », signe moins typographique. */
export const fmtDeg = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "–"
    : `${v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace("-", "−")}°`;

export const fmtWeekdayShort = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

export const fmtDM = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

/** « jeudi 15 octobre » */
export const fmtLongDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

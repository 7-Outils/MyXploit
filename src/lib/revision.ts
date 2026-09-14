/**
 * Révision indicielle — helpers partagés entre les routes
 * `revision-timeline`, `revision-pending` et `apply-revision`.
 *
 * Principe : aucune règle générale. Une formule n'a d'échéancier que si
 * `firstRevisionDate` ET `periodicity` sont renseignés ; sinon elle est
 * « non paramétrée » et aucune échéance n'est déduite.
 *
 * Toutes les dates sont manipulées en UTC : les dates saisies côté client
 * (`type="date"`) arrivent en minuit UTC et sont stockées telles quelles.
 */

import type { RevisionPeriod } from "@/generated/prisma/client";

/** Nombre de mois d'un pas de périodicité. */
export function periodMonths(periodicity: RevisionPeriod): number {
  switch (periodicity) {
    case "MONTHLY":
      return 1;
    case "QUARTERLY":
      return 3;
    case "SEMI_ANNUAL":
      return 6;
    case "ANNUAL":
      return 12;
    default:
      return 12;
  }
}

/** Ajoute `times` pas de périodicité à une date (UTC). */
export function addPeriod(
  date: Date,
  periodicity: RevisionPeriod,
  times = 1
): Date {
  return addMonthsUTC(date, periodMonths(periodicity) * times);
}

/** Ajoute n mois à une date en UTC, sans débordement de jour. */
export function addMonthsUTC(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

/** Clé de mois « YYYY-MM » (UTC). */
export function monthKey(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${m}`;
}

/**
 * Borne supérieure exclusive des valeurs d'indice retenues à une échéance.
 * - `lagMonths` null → toute valeur de date ≤ échéance.
 * - `lagMonths` = n  → toute valeur du mois (échéance − n mois) ou antérieure.
 */
export function valueCutoff(dueDate: Date, lagMonths: number | null): Date {
  if (lagMonths == null) {
    // date <= dueDate  ⇔  date < dueDate + 1ms
    return new Date(dueDate.getTime() + 1);
  }
  const target = addMonthsUTC(dueDate, -lagMonths);
  // premier jour du mois suivant le mois cible
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1));
}

export interface IndexValueLite {
  date: Date;
  value: number;
  isProvisional: boolean;
}

/**
 * Valeur d'indice retenue à une échéance : la plus récente dont la date est
 * strictement antérieure à la borne (cf. `valueCutoff`).
 * `values` doit être trié par date croissante.
 */
export function resolveIndexValue(
  values: IndexValueLite[],
  dueDate: Date,
  lagMonths: number | null
): IndexValueLite | null {
  const cutoff = valueCutoff(dueDate, lagMonths);
  let found: IndexValueLite | null = null;
  for (const v of values) {
    if (v.date.getTime() < cutoff.getTime()) found = v;
    else break;
  }
  return found;
}

export interface KComponentInput {
  coefficient: number;
  baseValue: number;
  reconnectionCoef: number;
  value: number;
}

/** K = partie fixe + Σ coef × (I × raccord) / I₀, arrondi à `decimals`. */
export function computeK(
  constantPart: number,
  components: KComponentInput[],
  decimals: number
): { K: number; Kraw: number; decimals: number } {
  let Kraw = constantPart;
  for (const c of components) {
    const recon = c.reconnectionCoef || 1;
    Kraw += c.coefficient * ((c.value * recon) / c.baseValue);
  }
  const d = Math.max(0, Math.min(10, Number.isFinite(decimals) ? decimals : 4));
  const factor = Math.pow(10, d);
  return { K: Math.round(Kraw * factor) / factor, Kraw, decimals: d };
}

/** Garde-fou : nombre maximum d'échéances générées pour une formule. */
export const MAX_OCCURRENCES = 240;

/**
 * Échéances de `firstRevisionDate` jusqu'à la première échéance future incluse.
 * Renvoie [] si l'échéancier n'est pas paramétré.
 */
export function buildOccurrences(
  firstRevisionDate: Date | null,
  periodicity: RevisionPeriod,
  now: Date
): Date[] {
  if (!firstRevisionDate || isNaN(firstRevisionDate.getTime())) return [];
  const step = periodMonths(periodicity);
  if (step <= 0) return [];

  const occurrences: Date[] = [];
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const due = addMonthsUTC(firstRevisionDate, step * i);
    occurrences.push(due);
    if (due.getTime() > now.getTime()) break;
  }
  return occurrences;
}

/** Préfixe du `reason` des ContractSitePriceChange générés par une révision. */
export function revisionReasonPrefix(pType: string): string {
  return `Révision ${pType}`;
}

/** `reason` exact d'une échéance donnée. */
export function revisionReason(pType: string, dueDate: Date): string {
  return `${revisionReasonPrefix(pType)} ${dueDate.toISOString().slice(0, 10)}`;
}

export type RevisionEntryStatus =
  | "applied"
  | "ready"
  | "provisional"
  | "missing_index"
  | "upcoming";

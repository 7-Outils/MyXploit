import {
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  min as dateMin,
  max as dateMax,
} from "date-fns";

/**
 * Répartit une quantité totale sur les mois calendaires touchés par l'intervalle [startDate, endDate].
 * La consommation est supposée uniforme sur la période (moyenne journalière constante).
 *
 * Convention: la consommation entre deux relevés (relevé précédent et relevé courant)
 * est attribuée aux jours strictement APRÈS le relevé précédent jusqu'au relevé courant inclus.
 * L'appelant doit donc passer startDate = previousReading.readingDate + 1 jour.
 *
 * Retourne une Map<"YYYY-MM-01T00:00:00.000Z", number> (clé = 1er du mois en ISO UTC).
 */
export function prorateAcrossMonths(
  startDate: Date,
  endDate: Date,
  totalQuantity: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (totalQuantity === 0) return result;

  const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
  if (totalDays <= 0) return result;

  const perDay = totalQuantity / totalDays;

  let cursor = startOfMonth(startDate);
  const lastMonth = startOfMonth(endDate);

  while (cursor.getTime() <= lastMonth.getTime()) {
    const monthStart = cursor;
    const monthEnd = endOfMonth(cursor);
    const overlapStart = dateMax([monthStart, startDate]);
    const overlapEnd = dateMin([monthEnd, endDate]);
    const daysInOverlap = differenceInCalendarDays(overlapEnd, overlapStart) + 1;

    if (daysInOverlap > 0) {
      const key = periodKey(monthStart);
      result.set(key, (result.get(key) ?? 0) + daysInOverlap * perDay);
    }

    cursor = addMonths(cursor, 1);
  }

  return result;
}

export function periodKey(monthStart: Date): string {
  const d = new Date(Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), 1));
  return d.toISOString();
}

export function periodKeyToDate(key: string): Date {
  return new Date(key);
}

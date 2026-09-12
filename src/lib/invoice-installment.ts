/**
 * Numéro d'acompte d'une facture périodique d'exploitation, déduit de la
 * période facturée et de la date anniversaire du contrat — sans rien demander
 * de plus à l'IA : la longueur de la période donne le rythme (3 mois =
 * trimestriel, 4 acomptes par an), sa position dans l'année contractuelle
 * donne le rang (juin-août d'un contrat au 1er septembre = 4/4).
 */

export interface Installment {
  /** Rang dans l'année contractuelle, 1..count. */
  index: number;
  /** Acomptes par an : 1, 2, 4 ou 12. */
  count: number;
}

const RHYTHMS = [1, 2, 4, 12] as const;

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function installmentOf(
  periodStart: Date | string | null | undefined,
  periodEnd: Date | string | null | undefined,
  contractStart: Date | string | null | undefined
): Installment | null {
  if (!periodStart || !periodEnd || !contractStart) return null;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const anchor = new Date(contractStart);
  if ([start, end, anchor].some((d) => Number.isNaN(d.getTime())) || end <= start) return null;

  // Durée en mois, arrondie : « du 01/06 au 31/08 » fait 2 mois et 30 jours.
  const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.4375 * 86_400_000)));
  const count = RHYTHMS.find((r) => Math.abs(12 / r - months) < 0.75);
  if (!count) return null;

  // Début de l'année contractuelle qui contient la période.
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (yearStart > start) yearStart.setUTCFullYear(yearStart.getUTCFullYear() - 1);
  const offset = monthsBetween(yearStart, start);
  const index = Math.floor(offset / (12 / count)) + 1;
  if (index < 1 || index > count) return null;
  return { index, count };
}

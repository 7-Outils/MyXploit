/**
 * Conformité dérivée des équipements : une règle par type d'équipement dit
 * tous les combien de mois le contrôle est dû ; l'échéance se calcule depuis
 * le dernier contrôle enregistré sur la fiche.
 */

/** Ajoute n mois à une date (fin de mois écrêtée, ex. 31/01 + 1 mois = 28/02). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Échéance d'un contrôle : `null` quand la règle n'a jamais été honorée sur
 * cet équipement — c'est un retard, sans date de référence à afficher.
 */
export function controlDueDate(
  lastDone: Date | null | undefined,
  frequencyMonths: number
): Date | null {
  if (!lastDone) return null;
  return addMonths(new Date(lastDone), frequencyMonths);
}

/** Fenêtre « à venir » : une échéance à moins de 60 jours est signalée. */
export const UPCOMING_WINDOW_DAYS = 60;

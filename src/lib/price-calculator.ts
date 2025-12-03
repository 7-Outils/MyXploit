/**
 * Utilitaires pour le calcul des prix avec prorata
 * selon le type d'année contractuelle et les dates d'effet des avenants
 */

export interface ContractYear {
  startDate: Date;
  endDate: Date;
  label: string; // Ex: "2024" ou "2024-2025"
}

export interface PriceChange {
  effectiveDate: Date;
  amountP1: number | null;
  amountP2: number | null;
  amountP3: number | null;
  deltaP1: number | null;
  deltaP2: number | null;
  deltaP3: number | null;
}

export interface YearlyPrices {
  year: string;
  startDate: Date;
  endDate: Date;
  amountP1: number;
  amountP2: number;
  amountP3: number;
  // Détail du prorata si applicable
  details?: {
    periods: {
      from: Date;
      to: Date;
      days: number;
      amountP1: number;
      amountP2: number;
      amountP3: number;
    }[];
  };
}

/**
 * Calcule les années contractuelles pour un contrat
 */
export function getContractYears(
  contractStartDate: Date,
  contractEndDate: Date,
  yearType: "CIVIL" | "HEATING_SEASON",
  yearStartMonth: number = 1,
  yearStartDay: number = 1
): ContractYear[] {
  const years: ContractYear[] = [];

  let currentStart: Date;

  if (yearType === "CIVIL") {
    // Année civile: 01/01 - 31/12
    currentStart = new Date(contractStartDate.getFullYear(), 0, 1);
  } else {
    // Saison de chauffe: configurable
    const contractYear = contractStartDate.getFullYear();
    const seasonStart = new Date(contractYear, yearStartMonth - 1, yearStartDay);

    // Si le contrat commence après le début de la saison, on prend cette saison
    // Sinon on prend la saison précédente
    if (contractStartDate >= seasonStart) {
      currentStart = seasonStart;
    } else {
      currentStart = new Date(contractYear - 1, yearStartMonth - 1, yearStartDay);
    }
  }

  while (currentStart <= contractEndDate) {
    let currentEnd: Date;
    let label: string;

    if (yearType === "CIVIL") {
      currentEnd = new Date(currentStart.getFullYear(), 11, 31);
      label = currentStart.getFullYear().toString();
    } else {
      currentEnd = new Date(
        currentStart.getFullYear() + 1,
        yearStartMonth - 1,
        yearStartDay - 1
      );
      // Ajuster au dernier jour du mois précédent si jour = 1
      if (yearStartDay === 1) {
        currentEnd = new Date(currentStart.getFullYear() + 1, yearStartMonth - 1, 0);
      }
      label = `${currentStart.getFullYear()}-${currentStart.getFullYear() + 1}`;
    }

    // Ajuster les dates aux limites du contrat
    const effectiveStart = currentStart < contractStartDate ? contractStartDate : currentStart;
    const effectiveEnd = currentEnd > contractEndDate ? contractEndDate : currentEnd;

    if (effectiveStart <= effectiveEnd) {
      years.push({
        startDate: effectiveStart,
        endDate: effectiveEnd,
        label,
      });
    }

    // Passer à l'année suivante
    if (yearType === "CIVIL") {
      currentStart = new Date(currentStart.getFullYear() + 1, 0, 1);
    } else {
      currentStart = new Date(
        currentStart.getFullYear() + 1,
        yearStartMonth - 1,
        yearStartDay
      );
    }
  }

  return years;
}

/**
 * Calcule le nombre de jours entre deux dates
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * Calcule les prix annuels avec prorata pour un site dans un contrat
 */
export function calculateYearlyPrices(
  contractYears: ContractYear[],
  baseAmountP1: number,
  baseAmountP2: number,
  baseAmountP3: number,
  priceChanges: PriceChange[],
  integrationDate?: Date | null,
  exitDate?: Date | null
): YearlyPrices[] {
  const result: YearlyPrices[] = [];

  // Trier les changements de prix par date
  const sortedChanges = [...priceChanges].sort(
    (a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()
  );

  for (const year of contractYears) {
    // Déterminer la période effective pour ce site dans cette année
    let periodStart = year.startDate;
    let periodEnd = year.endDate;

    // Ajuster si le site a une date d'intégration
    if (integrationDate && integrationDate > periodStart) {
      if (integrationDate > periodEnd) {
        // Le site n'est pas encore dans le contrat cette année
        continue;
      }
      periodStart = integrationDate;
    }

    // Ajuster si le site a une date de sortie
    if (exitDate && exitDate < periodEnd) {
      if (exitDate < periodStart) {
        // Le site est déjà sorti du contrat cette année
        continue;
      }
      periodEnd = exitDate;
    }

    const totalDaysInYear = daysBetween(year.startDate, year.endDate);

    // Trouver les changements de prix qui s'appliquent cette année
    const relevantChanges = sortedChanges.filter(
      (change) =>
        change.effectiveDate >= year.startDate &&
        change.effectiveDate <= year.endDate
    );

    if (relevantChanges.length === 0) {
      // Pas de changement cette année, calculer au prorata si nécessaire
      const activeDays = daysBetween(periodStart, periodEnd);
      const ratio = activeDays / totalDaysInYear;

      // Trouver le dernier montant connu avant cette année
      let currentP1 = baseAmountP1;
      let currentP2 = baseAmountP2;
      let currentP3 = baseAmountP3;

      for (const change of sortedChanges) {
        if (change.effectiveDate < year.startDate) {
          if (change.amountP1 !== null) currentP1 = change.amountP1;
          if (change.amountP2 !== null) currentP2 = change.amountP2;
          if (change.amountP3 !== null) currentP3 = change.amountP3;
        }
      }

      result.push({
        year: year.label,
        startDate: year.startDate,
        endDate: year.endDate,
        amountP1: Math.round(currentP1 * ratio * 100) / 100,
        amountP2: Math.round(currentP2 * ratio * 100) / 100,
        amountP3: Math.round(currentP3 * ratio * 100) / 100,
      });
    } else {
      // Il y a des changements cette année, calculer avec prorata
      const periods: {
        from: Date;
        to: Date;
        days: number;
        amountP1: number;
        amountP2: number;
        amountP3: number;
      }[] = [];

      // Trouver le montant initial de l'année
      let currentP1 = baseAmountP1;
      let currentP2 = baseAmountP2;
      let currentP3 = baseAmountP3;

      for (const change of sortedChanges) {
        if (change.effectiveDate < year.startDate) {
          if (change.amountP1 !== null) currentP1 = change.amountP1;
          if (change.amountP2 !== null) currentP2 = change.amountP2;
          if (change.amountP3 !== null) currentP3 = change.amountP3;
        }
      }

      // Construire les périodes
      let currentPeriodStart = periodStart;

      for (const change of relevantChanges) {
        if (change.effectiveDate > currentPeriodStart && change.effectiveDate <= periodEnd) {
          // Période avant le changement
          const periodEndDate = new Date(change.effectiveDate);
          periodEndDate.setDate(periodEndDate.getDate() - 1);

          if (periodEndDate >= currentPeriodStart) {
            periods.push({
              from: currentPeriodStart,
              to: periodEndDate,
              days: daysBetween(currentPeriodStart, periodEndDate),
              amountP1: currentP1,
              amountP2: currentP2,
              amountP3: currentP3,
            });
          }

          // Mettre à jour les montants
          if (change.amountP1 !== null) currentP1 = change.amountP1;
          if (change.amountP2 !== null) currentP2 = change.amountP2;
          if (change.amountP3 !== null) currentP3 = change.amountP3;

          currentPeriodStart = change.effectiveDate;
        }
      }

      // Dernière période jusqu'à la fin de l'année
      if (currentPeriodStart <= periodEnd) {
        periods.push({
          from: currentPeriodStart,
          to: periodEnd,
          days: daysBetween(currentPeriodStart, periodEnd),
          amountP1: currentP1,
          amountP2: currentP2,
          amountP3: currentP3,
        });
      }

      // Calculer les montants au prorata
      let totalP1 = 0;
      let totalP2 = 0;
      let totalP3 = 0;

      for (const period of periods) {
        const ratio = period.days / totalDaysInYear;
        totalP1 += period.amountP1 * ratio;
        totalP2 += period.amountP2 * ratio;
        totalP3 += period.amountP3 * ratio;
      }

      result.push({
        year: year.label,
        startDate: year.startDate,
        endDate: year.endDate,
        amountP1: Math.round(totalP1 * 100) / 100,
        amountP2: Math.round(totalP2 * 100) / 100,
        amountP3: Math.round(totalP3 * 100) / 100,
        details: { periods },
      });
    }
  }

  return result;
}

/**
 * Formate un prix en euros
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

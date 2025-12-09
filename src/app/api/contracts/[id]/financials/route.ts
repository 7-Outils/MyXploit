import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

interface Acompte {
  number: number; // 1, 2, 3, 4
  label: string; // "Acompte 1", etc.
  periodStart: Date;
  periodEnd: Date;
  billingDate: Date; // Date de facturation (fin de période)
  percentage: number; // 25
  amountP2: number;
  amountP3: number;
  total: number;
  isPaid: boolean; // Si la date de facturation est passée
  isCurrent: boolean; // Si on est dans cette période
}

interface SeasonData {
  label: string; // "2025/2026"
  startDate: Date;
  endDate: Date;
  totalP2: number;
  totalP3: number;
  total: number;
  acomptes: Acompte[];
  sites: {
    siteId: string;
    siteName: string;
    amountP2: number;
    amountP3: number;
    total: number;
  }[];
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

// GET /api/contracts/[id]/financials - Get financial summary with acomptes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: user.organizationId,
      },
      include: {
        contractSites: {
          include: {
            site: {
              select: { id: true, name: true },
            },
            priceChanges: {
              orderBy: { effectiveDate: "asc" },
            },
          },
        },
      },
    });

    // Type d'année contractuelle et fréquence de facturation
    const yearType = contract?.yearType || "HEATING_SEASON";
    const yearStartMonth = contract?.yearStartMonth || 7; // Défaut: juillet
    const yearStartDay = contract?.yearStartDay || 1;
    const billingFrequency = contract?.billingFrequency || "TRIMESTRIEL";

    // Nombre d'échéances selon la fréquence
    const frequencyConfig = {
      MENSUEL: { count: 12, label: "Échéance" },
      TRIMESTRIEL: { count: 4, label: "Acompte" },
      SEMESTRIEL: { count: 2, label: "Échéance" },
      ANNUEL: { count: 1, label: "Échéance" },
    };
    const { count: periodsPerYear, label: periodLabel } = frequencyConfig[billingFrequency as keyof typeof frequencyConfig];

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    const today = new Date();
    const seasons: SeasonData[] = [];

    // Calcul du début de période selon le type d'année
    // CIVIL: 01/01 - 31/12
    // HEATING_SEASON: configurable (défaut 01/07 - 30/06)
    // CONTRACTUAL: date anniversaire du contrat
    const contractStartMonth = contract.startDate.getMonth(); // 0-11
    const contractStartDay = contract.startDate.getDate();

    const getYearStart = (date: Date): Date => {
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11

      if (yearType === "CIVIL") {
        // Année civile: toujours 1er janvier de l'année en cours
        return new Date(year, 0, 1);
      } else if (yearType === "CONTRACTUAL") {
        // Année contractuelle: commence à la date anniversaire du contrat
        // Si on est avant la date anniversaire, l'année a commencé l'année précédente
        if (month < contractStartMonth || (month === contractStartMonth && date.getDate() < contractStartDay)) {
          return new Date(year - 1, contractStartMonth, contractStartDay);
        } else {
          return new Date(year, contractStartMonth, contractStartDay);
        }
      } else {
        // Saison de chauffe: commence au mois configuré
        const startMonth = yearStartMonth - 1; // 0-indexed
        // Si on est avant le mois de début, la saison a commencé l'année précédente
        if (month < startMonth || (month === startMonth && date.getDate() < yearStartDay)) {
          return new Date(year - 1, startMonth, yearStartDay);
        } else {
          return new Date(year, startMonth, yearStartDay);
        }
      }
    };

    const getYearEnd = (yearStart: Date): Date => {
      if (yearType === "CIVIL") {
        // Année civile: 31 décembre de la même année
        return new Date(yearStart.getFullYear(), 11, 31);
      } else if (yearType === "CONTRACTUAL") {
        // Année contractuelle: jour avant la date anniversaire suivante
        const endYear = yearStart.getFullYear() + 1;
        const endDate = new Date(endYear, contractStartMonth, contractStartDay);
        endDate.setDate(endDate.getDate() - 1);
        return endDate;
      } else {
        // Saison de chauffe: jour avant le début de la saison suivante
        const endYear = yearStart.getFullYear() + 1;
        const endDate = new Date(endYear, yearStartMonth - 1, yearStartDay);
        endDate.setDate(endDate.getDate() - 1);
        return endDate;
      }
    };

    const getYearLabel = (yearStart: Date): string => {
      if (yearType === "CIVIL") {
        return yearStart.getFullYear().toString();
      } else {
        // Pour HEATING_SEASON et CONTRACTUAL, afficher année/année+1
        return `${yearStart.getFullYear()}/${yearStart.getFullYear() + 1}`;
      }
    };

    // Generate acomptes/échéances for a season/year based on billing frequency
    const generateAcomptes = (yearStart: Date, yearEnd: Date, seasonTotalP2: number, seasonTotalP3: number): Acompte[] => {
      const acomptes: Acompte[] = [];
      const totalDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const daysPerPeriod = Math.floor(totalDays / periodsPerYear);
      const percentagePerPeriod = 100 / periodsPerYear;

      // Générer les échéances selon la fréquence
      let currentStart = new Date(yearStart);
      for (let i = 0; i < periodsPerYear; i++) {
        const isLast = i === periodsPerYear - 1;
        const periodEnd = isLast
          ? new Date(yearEnd)
          : new Date(currentStart.getTime() + daysPerPeriod * 24 * 60 * 60 * 1000 - 1);

        acomptes.push({
          number: i + 1,
          label: `${periodLabel} ${i + 1}`,
          periodStart: new Date(currentStart),
          periodEnd: periodEnd,
          billingDate: periodEnd,
          percentage: percentagePerPeriod,
          amountP2: seasonTotalP2 / periodsPerYear,
          amountP3: seasonTotalP3 / periodsPerYear,
          total: (seasonTotalP2 + seasonTotalP3) / periodsPerYear,
          isPaid: today > periodEnd,
          isCurrent: today >= currentStart && today <= periodEnd,
        });

        currentStart = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      return acomptes.map(a => ({
        ...a,
        amountP2: Math.round(a.amountP2 * 100) / 100,
        amountP3: Math.round(a.amountP3 * 100) / 100,
        total: Math.round(a.total * 100) / 100,
      }));
    };

    // Calculate site amounts for a season, considering price changes with prorata
    const calculateSiteAmounts = (seasonStart: Date, seasonEnd: Date) => {
      const siteTotals: SeasonData["sites"] = [];
      const totalSeasonDays = Math.round((seasonEnd.getTime() - seasonStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      for (const contractSite of contract.contractSites) {
        // Check integration/exit dates
        const siteStart = contractSite.integrationDate
          ? new Date(contractSite.integrationDate)
          : contract.startDate;
        const siteEnd = contractSite.exitDate
          ? new Date(contractSite.exitDate)
          : contract.endDate;

        // Skip if site not active during this season
        if (siteStart > seasonEnd || siteEnd < seasonStart) continue;

        // Effective period for this site within the season
        const effectiveStart = siteStart > seasonStart ? siteStart : seasonStart;
        const effectiveEnd = siteEnd < seasonEnd ? siteEnd : seasonEnd;

        // P2/P3 de BASE (ne change jamais)
        const baseP2 = contractSite.amountP2 || 0;
        const baseP3 = contractSite.amountP3 || 0;

        // Calculer le prix actuel = base + sum(deltas applicables)
        // On applique les deltas des priceChanges dont la date d'effet est <= début de la période
        let currentP2 = baseP2;
        let currentP3 = baseP3;

        for (const change of contractSite.priceChanges) {
          const changeDate = new Date(change.effectiveDate);
          if (changeDate <= effectiveStart) {
            // Ajouter le delta (pas remplacer par amountP2)
            if (change.deltaP2 !== null) currentP2 += change.deltaP2;
            if (change.deltaP3 !== null) currentP3 += change.deltaP3;
          }
        }

        // Collecter les priceChanges qui s'appliquent EN COURS de saison (prorata)
        const priceChangesInSeason = contractSite.priceChanges
          .filter(change => {
            const changeDate = new Date(change.effectiveDate);
            return changeDate > effectiveStart && changeDate <= effectiveEnd;
          })
          .sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());

        // Calculer les montants avec prorata si changements en cours de saison
        let totalP2 = 0;
        let totalP3 = 0;
        let periodStart = effectiveStart;

        for (const change of priceChangesInSeason) {
          const changeDate = new Date(change.effectiveDate);

          // Calculer les jours avant ce changement
          const periodDays = Math.round((changeDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
          const periodRatio = periodDays / totalSeasonDays;

          totalP2 += currentP2 * periodRatio;
          totalP3 += currentP3 * periodRatio;

          // Appliquer le delta pour la période suivante
          if (change.deltaP2 !== null) currentP2 += change.deltaP2;
          if (change.deltaP3 !== null) currentP3 += change.deltaP3;
          periodStart = changeDate;
        }

        // Calculer la période restante après le dernier changement
        const remainingDays = Math.round((effectiveEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const remainingRatio = remainingDays / totalSeasonDays;
        totalP2 += currentP2 * remainingRatio;
        totalP3 += currentP3 * remainingRatio;

        siteTotals.push({
          siteId: contractSite.site.id,
          siteName: contractSite.site.name,
          amountP2: Math.round(totalP2 * 100) / 100,
          amountP3: Math.round(totalP3 * 100) / 100,
          total: Math.round((totalP2 + totalP3) * 100) / 100,
        });
      }

      return siteTotals;
    };

    // Generate seasons/years from contract start to end
    const currentYearStart = getYearStart(today);

    // Find first year/season that includes contract start
    let periodStart = getYearStart(contract.startDate);

    while (periodStart <= contract.endDate) {
      const periodEnd = getYearEnd(periodStart);

      // Skip if period ends before contract starts
      if (periodEnd < contract.startDate) {
        // Move to next period
        if (yearType === "CIVIL") {
          periodStart = new Date(periodStart.getFullYear() + 1, 0, 1);
        } else if (yearType === "CONTRACTUAL") {
          periodStart = new Date(periodStart.getFullYear() + 1, contractStartMonth, contractStartDay);
        } else {
          periodStart = new Date(periodStart.getFullYear() + 1, yearStartMonth - 1, yearStartDay);
        }
        continue;
      }

      const label = getYearLabel(periodStart);
      const sites = calculateSiteAmounts(periodStart, periodEnd);
      const totalP2 = sites.reduce((sum, s) => sum + s.amountP2, 0);
      const totalP3 = sites.reduce((sum, s) => sum + s.amountP3, 0);

      const isCurrent = periodStart.getTime() === currentYearStart.getTime();
      const isPast = periodEnd < today && !isCurrent;
      const isFuture = periodStart > today;

      seasons.push({
        label,
        startDate: periodStart,
        endDate: periodEnd,
        totalP2: Math.round(totalP2 * 100) / 100,
        totalP3: Math.round(totalP3 * 100) / 100,
        total: Math.round((totalP2 + totalP3) * 100) / 100,
        acomptes: generateAcomptes(periodStart, periodEnd, totalP2, totalP3),
        sites,
        isPast,
        isCurrent,
        isFuture,
      });

      // Move to next period
      if (yearType === "CIVIL") {
        periodStart = new Date(periodStart.getFullYear() + 1, 0, 1);
      } else if (yearType === "CONTRACTUAL") {
        periodStart = new Date(periodStart.getFullYear() + 1, contractStartMonth, contractStartDay);
      } else {
        periodStart = new Date(periodStart.getFullYear() + 1, yearStartMonth - 1, yearStartDay);
      }
    }

    // Calculate summary
    const currentSeason = seasons.find(s => s.isCurrent);
    const pastSeasons = seasons.filter(s => s.isPast);
    const futureSeasons = seasons.filter(s => s.isFuture);

    // Calculate paid vs remaining for current season
    let currentSeasonPaid = 0;
    let currentSeasonRemaining = 0;
    if (currentSeason) {
      for (const acompte of currentSeason.acomptes) {
        if (acompte.isPaid) {
          currentSeasonPaid += acompte.total;
        } else {
          currentSeasonRemaining += acompte.total;
        }
      }
    }

    const summary = {
      currentSeasonLabel: currentSeason?.label || "",
      currentSeasonTotal: currentSeason?.total || 0,
      currentSeasonPaid: Math.round(currentSeasonPaid * 100) / 100,
      currentSeasonRemaining: Math.round(currentSeasonRemaining * 100) / 100,
      totalPastSeasons: Math.round(pastSeasons.reduce((sum, s) => sum + s.total, 0) * 100) / 100,
      totalFutureSeasons: Math.round(futureSeasons.reduce((sum, s) => sum + s.total, 0) * 100) / 100,
      totalContract: Math.round(seasons.reduce((sum, s) => sum + s.total, 0) * 100) / 100,
      seasonCount: seasons.length,
    };

    // Label pour l'UI selon le type d'année
    const yearTypeLabels = {
      CIVIL: "Années",
      HEATING_SEASON: "Saisons de chauffe",
      CONTRACTUAL: "Années contractuelles",
    };

    return NextResponse.json({
      contract: {
        id: contract.id,
        reference: contract.reference,
        title: contract.title,
        startDate: contract.startDate,
        endDate: contract.endDate,
        yearType: contract.yearType,
        billingFrequency: contract.billingFrequency,
      },
      summary,
      seasons,
      periodLabel: yearTypeLabels[yearType as keyof typeof yearTypeLabels] || "Périodes",
      billingFrequency,
    });
  } catch (error) {
    console.error("Error calculating financials:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des données financières" },
      { status: 500 }
    );
  }
}

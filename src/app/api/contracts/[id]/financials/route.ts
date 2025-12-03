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

    if (!contract) {
      return NextResponse.json(
        { error: "Contrat non trouvé" },
        { status: 404 }
      );
    }

    const today = new Date();
    const seasons: SeasonData[] = [];

    // Determine current heating season based on today's date
    // Season runs from July 1 to June 30
    const getCurrentSeasonStart = (date: Date): Date => {
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      // If we're in Jan-June, season started previous year
      // If we're in Jul-Dec, season started this year
      if (month < 6) { // Jan-June
        return new Date(year - 1, 6, 1); // July 1 of previous year
      } else { // Jul-Dec
        return new Date(year, 6, 1); // July 1 of current year
      }
    };

    // Generate acomptes for a season
    const generateAcomptes = (seasonStart: Date, seasonTotalP2: number, seasonTotalP3: number): Acompte[] => {
      const year1 = seasonStart.getFullYear();
      const year2 = year1 + 1;

      const acomptes: Acompte[] = [
        {
          number: 1,
          label: "Acompte 1",
          periodStart: new Date(year1, 6, 1), // 01/07
          periodEnd: new Date(year1, 8, 30), // 30/09
          billingDate: new Date(year1, 8, 30), // 30/09
          percentage: 25,
          amountP2: seasonTotalP2 * 0.25,
          amountP3: seasonTotalP3 * 0.25,
          total: (seasonTotalP2 + seasonTotalP3) * 0.25,
          isPaid: today > new Date(year1, 8, 30),
          isCurrent: today >= new Date(year1, 6, 1) && today <= new Date(year1, 8, 30),
        },
        {
          number: 2,
          label: "Acompte 2",
          periodStart: new Date(year1, 9, 1), // 01/10
          periodEnd: new Date(year1, 11, 31), // 31/12
          billingDate: new Date(year1, 11, 31), // 31/12
          percentage: 25,
          amountP2: seasonTotalP2 * 0.25,
          amountP3: seasonTotalP3 * 0.25,
          total: (seasonTotalP2 + seasonTotalP3) * 0.25,
          isPaid: today > new Date(year1, 11, 31),
          isCurrent: today >= new Date(year1, 9, 1) && today <= new Date(year1, 11, 31),
        },
        {
          number: 3,
          label: "Acompte 3",
          periodStart: new Date(year2, 0, 1), // 01/01
          periodEnd: new Date(year2, 2, 31), // 31/03
          billingDate: new Date(year2, 2, 31), // 31/03
          percentage: 25,
          amountP2: seasonTotalP2 * 0.25,
          amountP3: seasonTotalP3 * 0.25,
          total: (seasonTotalP2 + seasonTotalP3) * 0.25,
          isPaid: today > new Date(year2, 2, 31),
          isCurrent: today >= new Date(year2, 0, 1) && today <= new Date(year2, 2, 31),
        },
        {
          number: 4,
          label: "Acompte 4",
          periodStart: new Date(year2, 3, 1), // 01/04
          periodEnd: new Date(year2, 5, 30), // 30/06
          billingDate: new Date(year2, 5, 30), // 30/06
          percentage: 25,
          amountP2: seasonTotalP2 * 0.25,
          amountP3: seasonTotalP3 * 0.25,
          total: (seasonTotalP2 + seasonTotalP3) * 0.25,
          isPaid: today > new Date(year2, 5, 30),
          isCurrent: today >= new Date(year2, 3, 1) && today <= new Date(year2, 5, 30),
        },
      ];

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

    // Generate seasons from contract start to end
    const currentSeasonStart = getCurrentSeasonStart(today);

    // Find first season that includes contract start
    let seasonStart = new Date(contract.startDate.getFullYear(), 6, 1);
    if (seasonStart > contract.startDate) {
      seasonStart = new Date(contract.startDate.getFullYear() - 1, 6, 1);
    }

    while (seasonStart <= contract.endDate) {
      const seasonEnd = new Date(seasonStart.getFullYear() + 1, 5, 30); // June 30 of next year

      // Skip if season ends before contract starts
      if (seasonEnd < contract.startDate) {
        seasonStart = new Date(seasonStart.getFullYear() + 1, 6, 1);
        continue;
      }

      const label = `${seasonStart.getFullYear()}/${seasonStart.getFullYear() + 1}`;
      const sites = calculateSiteAmounts(seasonStart, seasonEnd);
      const totalP2 = sites.reduce((sum, s) => sum + s.amountP2, 0);
      const totalP3 = sites.reduce((sum, s) => sum + s.amountP3, 0);

      const isCurrent = seasonStart.getTime() === currentSeasonStart.getTime();
      const isPast = seasonEnd < today && !isCurrent;
      const isFuture = seasonStart > today;

      seasons.push({
        label,
        startDate: seasonStart,
        endDate: seasonEnd,
        totalP2: Math.round(totalP2 * 100) / 100,
        totalP3: Math.round(totalP3 * 100) / 100,
        total: Math.round((totalP2 + totalP3) * 100) / 100,
        acomptes: generateAcomptes(seasonStart, totalP2, totalP3),
        sites,
        isPast,
        isCurrent,
        isFuture,
      });

      // Move to next season
      seasonStart = new Date(seasonStart.getFullYear() + 1, 6, 1);
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

    return NextResponse.json({
      contract: {
        id: contract.id,
        reference: contract.reference,
        title: contract.title,
        startDate: contract.startDate,
        endDate: contract.endDate,
      },
      summary,
      seasons,
    });
  } catch (error) {
    console.error("Error calculating financials:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des données financières" },
      { status: 500 }
    );
  }
}

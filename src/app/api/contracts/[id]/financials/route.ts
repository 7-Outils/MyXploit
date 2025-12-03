import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

interface YearlyTotal {
  year: string;
  label: string;
  startDate: Date;
  endDate: Date;
  totalP2: number;
  totalP3: number;
  total: number;
  sites: {
    siteId: string;
    siteName: string;
    amountP2: number;
    amountP3: number;
    total: number;
    details?: string; // Ex: "Avenant n°1 (+300€) à partir du 30/06"
  }[];
  isPast: boolean;
  isCurrent: boolean;
}

// GET /api/contracts/[id]/financials - Get yearly financial summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: contractId } = await params;

    // Get contract with all data
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

    // Generate contract years
    const years: YearlyTotal[] = [];
    const today = new Date();

    // Determine year type
    const isHeatingSeasonYear = contract.yearType === "HEATING_SEASON";
    const yearStartMonth = contract.yearStartMonth || 1;
    const yearStartDay = contract.yearStartDay || 1;

    // Function to get year start date
    const getYearStart = (year: number): Date => {
      if (isHeatingSeasonYear) {
        return new Date(year, yearStartMonth - 1, yearStartDay);
      }
      return new Date(year, 0, 1);
    };

    // Function to get year end date
    const getYearEnd = (yearStart: Date): Date => {
      if (isHeatingSeasonYear) {
        const endDate = new Date(yearStart);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(endDate.getDate() - 1);
        return endDate;
      }
      return new Date(yearStart.getFullYear(), 11, 31);
    };

    // Calculate days between two dates
    const daysBetween = (start: Date, end: Date): number => {
      const msPerDay = 24 * 60 * 60 * 1000;
      return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
    };

    // Determine start year
    let currentYearStart = getYearStart(contract.startDate.getFullYear());
    if (currentYearStart > contract.startDate && !isHeatingSeasonYear) {
      // Start from previous year if contract starts before year start
    } else if (isHeatingSeasonYear && currentYearStart > contract.startDate) {
      currentYearStart = getYearStart(contract.startDate.getFullYear() - 1);
    }

    // Iterate through years
    while (currentYearStart <= contract.endDate) {
      const yearEnd = getYearEnd(currentYearStart);

      // Skip if year ends before contract starts
      if (yearEnd < contract.startDate) {
        currentYearStart = getYearStart(currentYearStart.getFullYear() + 1);
        continue;
      }

      const effectiveStart = currentYearStart < contract.startDate ? contract.startDate : currentYearStart;
      const effectiveEnd = yearEnd > contract.endDate ? contract.endDate : yearEnd;
      const totalDaysInYear = daysBetween(currentYearStart, yearEnd);

      // Determine year label
      let label: string;
      if (isHeatingSeasonYear) {
        label = `${currentYearStart.getFullYear()}-${currentYearStart.getFullYear() + 1}`;
      } else {
        label = currentYearStart.getFullYear().toString();
      }

      // Calculate totals for each site
      const siteTotals: YearlyTotal["sites"] = [];
      let yearTotalP2 = 0;
      let yearTotalP3 = 0;

      for (const contractSite of contract.contractSites) {
        // Check if site is active during this year
        const siteIntegration = contractSite.integrationDate
          ? new Date(contractSite.integrationDate)
          : contract.startDate;
        const siteExit = contractSite.exitDate
          ? new Date(contractSite.exitDate)
          : contract.endDate;

        if (siteIntegration > effectiveEnd || siteExit < effectiveStart) {
          // Site not active this year
          continue;
        }

        const siteStart = siteIntegration > effectiveStart ? siteIntegration : effectiveStart;
        const siteEnd = siteExit < effectiveEnd ? siteExit : effectiveEnd;

        // Get base amounts
        let baseP2 = contractSite.amountP2 || 0;
        let baseP3 = contractSite.amountP3 || 0;

        // Find price changes that apply to this year
        const relevantChanges = contractSite.priceChanges.filter(
          (pc) => {
            const changeDate = new Date(pc.effectiveDate);
            return changeDate <= effectiveEnd;
          }
        );

        // Calculate yearly amount with prorata for changes
        let siteP2 = 0;
        let siteP3 = 0;
        let details = "";

        if (relevantChanges.length === 0) {
          // No changes, use base amounts prorated
          const activeDays = daysBetween(siteStart, siteEnd);
          const ratio = activeDays / totalDaysInYear;
          siteP2 = baseP2 * ratio;
          siteP3 = baseP3 * ratio;
        } else {
          // Calculate with price changes
          let currentP2 = baseP2;
          let currentP3 = baseP3;
          let periodStart = siteStart;

          // First, apply all changes that occurred before this year to get the starting amount
          for (const change of relevantChanges) {
            const changeDate = new Date(change.effectiveDate);
            if (changeDate < currentYearStart) {
              if (change.amountP2 !== null) currentP2 = change.amountP2;
              if (change.amountP3 !== null) currentP3 = change.amountP3;
            }
          }

          // Now calculate with any changes during this year
          const changesThisYear = relevantChanges.filter((pc) => {
            const changeDate = new Date(pc.effectiveDate);
            return changeDate >= currentYearStart && changeDate <= effectiveEnd;
          });

          if (changesThisYear.length === 0) {
            // No changes this year, just use current amounts
            const activeDays = daysBetween(siteStart, siteEnd);
            const ratio = activeDays / totalDaysInYear;
            siteP2 = currentP2 * ratio;
            siteP3 = currentP3 * ratio;
          } else {
            // Calculate periods with different prices
            for (const change of changesThisYear) {
              const changeDate = new Date(change.effectiveDate);

              if (changeDate > periodStart) {
                // Calculate for period before this change
                const periodEnd = new Date(changeDate);
                periodEnd.setDate(periodEnd.getDate() - 1);
                const clampedEnd = periodEnd < siteEnd ? periodEnd : siteEnd;

                if (periodStart <= clampedEnd) {
                  const days = daysBetween(periodStart, clampedEnd);
                  const ratio = days / totalDaysInYear;
                  siteP2 += currentP2 * ratio;
                  siteP3 += currentP3 * ratio;
                }
              }

              // Update amounts after change
              if (change.amountP2 !== null) currentP2 = change.amountP2;
              if (change.amountP3 !== null) currentP3 = change.amountP3;
              periodStart = changeDate;

              // Add detail about the change
              if (change.deltaP2 || change.deltaP3) {
                const deltaStr = [];
                if (change.deltaP2) deltaStr.push(`P2 ${change.deltaP2 > 0 ? '+' : ''}${change.deltaP2}€`);
                if (change.deltaP3) deltaStr.push(`P3 ${change.deltaP3 > 0 ? '+' : ''}${change.deltaP3}€`);
                details += `${deltaStr.join(', ')} à partir du ${changeDate.toLocaleDateString('fr-FR')}. `;
              }
            }

            // Calculate for remaining period after last change
            if (periodStart <= siteEnd) {
              const days = daysBetween(periodStart, siteEnd);
              const ratio = days / totalDaysInYear;
              siteP2 += currentP2 * ratio;
              siteP3 += currentP3 * ratio;
            }
          }
        }

        // Round to 2 decimal places
        siteP2 = Math.round(siteP2 * 100) / 100;
        siteP3 = Math.round(siteP3 * 100) / 100;

        siteTotals.push({
          siteId: contractSite.site.id,
          siteName: contractSite.site.name,
          amountP2: siteP2,
          amountP3: siteP3,
          total: siteP2 + siteP3,
          details: details || undefined,
        });

        yearTotalP2 += siteP2;
        yearTotalP3 += siteP3;
      }

      // Determine if year is past, current, or future
      const isPast = yearEnd < today;
      const isCurrent = currentYearStart <= today && yearEnd >= today;

      years.push({
        year: currentYearStart.getFullYear().toString(),
        label,
        startDate: effectiveStart,
        endDate: effectiveEnd,
        totalP2: Math.round(yearTotalP2 * 100) / 100,
        totalP3: Math.round(yearTotalP3 * 100) / 100,
        total: Math.round((yearTotalP2 + yearTotalP3) * 100) / 100,
        sites: siteTotals,
        isPast,
        isCurrent,
      });

      // Move to next year
      currentYearStart = getYearStart(currentYearStart.getFullYear() + 1);
    }

    // Calculate summary
    const currentYear = years.find((y) => y.isCurrent);
    const pastYears = years.filter((y) => y.isPast);
    const futureYears = years.filter((y) => !y.isPast && !y.isCurrent);

    const summary = {
      currentYearTotal: currentYear?.total || 0,
      currentYearLabel: currentYear?.label || "",
      totalPastYears: pastYears.reduce((sum, y) => sum + y.total, 0),
      totalFutureYears: futureYears.reduce((sum, y) => sum + y.total, 0),
      totalContract: years.reduce((sum, y) => sum + y.total, 0),
      yearCount: years.length,
    };

    return NextResponse.json({
      contract: {
        id: contract.id,
        reference: contract.reference,
        title: contract.title,
        startDate: contract.startDate,
        endDate: contract.endDate,
        yearType: contract.yearType,
        yearStartMonth: contract.yearStartMonth,
        yearStartDay: contract.yearStartDay,
      },
      summary,
      years,
    });
  } catch (error) {
    console.error("Error calculating financials:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des données financières" },
      { status: 500 }
    );
  }
}

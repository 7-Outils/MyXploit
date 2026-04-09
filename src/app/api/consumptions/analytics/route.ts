import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { EnergyUsage } from "@/generated/prisma/client";
import { resolveDjuContractuel } from "@/lib/dju-sync";

// GET /api/consumptions/analytics - Get energy performance analytics (NC vs N'B)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { searchParams } = new URL(request.url);

    // Filters
    const siteId = searchParams.get("siteId");
    const contractId = searchParams.get("contractId");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
    const energyType = searchParams.get("energyType");

    // Build date range for the year (heating season: July to June by default)
    const startDate = new Date(year - 1, 6, 1); // July 1st of previous year
    const endDate = new Date(year, 5, 30); // June 30th of current year

    // Get contract site IDs if contractId is provided
    let contractSiteIds: string[] | null = null;
    if (contractId) {
      const contractSites = await prisma.contractSite.findMany({
        where: { contractId },
        select: { siteId: true },
      });
      contractSiteIds = contractSites.map((cs) => cs.siteId);
    }

    // Get all sites with their NB and DJU contractuels
    const sitesWhere: Record<string, unknown> = { organizationId: effectiveOrgId };
    if (siteId) {
      sitesWhere.id = siteId;
    } else if (contractSiteIds) {
      sitesWhere.id = { in: contractSiteIds };
    }

    const sites = await prisma.site.findMany({
      where: sitesWhere,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        postalCode: true,
        nb: true,
        nbUnit: true,
        djuContractuel: true,
        stationMeteo: true,
        energyType: true,
      },
    });

    // Fetch heating seasons for this year to get season-specific NB
    const season = `${year - 1}-${year}`;
    const heatingSeasons = await prisma.heatingSeason.findMany({
      where: {
        siteId: { in: sites.map((s) => s.id) },
        season,
      },
      select: {
        siteId: true,
        nb: true,
        nbUnit: true,
        djuContractuel: true,
      },
    });
    const heatingSeasonMap = new Map(
      heatingSeasons.map((hs) => [hs.siteId, hs])
    );

    // Get consumptions for the period
    const consumptionsWhere: Record<string, unknown> = {
      organizationId: effectiveOrgId,
      period: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (siteId) {
      consumptionsWhere.siteId = siteId;
    } else if (contractSiteIds) {
      consumptionsWhere.siteId = { in: contractSiteIds };
    }
    if (energyType) consumptionsWhere.energyType = energyType;

    const consumptions = await prisma.consumption.findMany({
      where: consumptionsWhere,
      include: {
        site: {
          select: { id: true, name: true },
        },
      },
      orderBy: { period: "asc" },
    });

    // Calculate performance metrics by site
    const siteMap = new Map<string, {
      site: typeof sites[0];
      consumptions: typeof consumptions;
      ncTotal: number; // Niveau de Consommation (réel chauffage)
      nbPrime: number; // N'B = NB × (DJR/DJC) - théorique ajusté
      djrTotal: number; // DJU Réels cumulés
      ecsTotal: number; // Consommation ECS (water-based, in m³)
      ecsHeatTotal: number; // Consommation ECS (heat-based, in kWh)
      mixteTotal: number; // Consommation Mixte (avant déduction ECS)
      months: Map<string, {
        nc: number;
        nbPrime: number;
        djr: number;
        djc: number;
        ecs: number; // Water-based ECS (m³)
        ecsHeat: number; // Heat-based ECS (kWh)
      }>;
    }>();

    // Initialize site map
    sites.forEach((site) => {
      siteMap.set(site.id, {
        site,
        consumptions: [],
        ncTotal: 0,
        nbPrime: 0,
        djrTotal: 0,
        ecsTotal: 0,
        ecsHeatTotal: 0,
        mixteTotal: 0,
        months: new Map(),
      });
    });

    // Process consumptions
    consumptions.forEach((consumption) => {
      const siteData = siteMap.get(consumption.siteId);
      if (!siteData) return;

      const monthKey = `${consumption.period.getFullYear()}-${String(consumption.period.getMonth() + 1).padStart(2, "0")}`;

      let monthData = siteData.months.get(monthKey);
      if (!monthData) {
        monthData = { nc: 0, nbPrime: 0, djr: 0, djc: siteData.site.djuContractuel || 0, ecs: 0, ecsHeat: 0 };
        siteData.months.set(monthKey, monthData);
      }

      // Separate chauffage from ECS
      if (consumption.usage === EnergyUsage.CHAUFFAGE) {
        // NC = consommation chauffage réelle
        siteData.ncTotal += consumption.quantity;
        monthData.nc += consumption.quantity;

        // Accumulate DJU réels
        if (consumption.djuReel) {
          siteData.djrTotal += consumption.djuReel;
          monthData.djr += consumption.djuReel;
        }
      } else if (consumption.usage === EnergyUsage.ECS) {
        // Separate water-based ECS (m³) from heat-based ECS (kWh)
        if (consumption.energyType === "EAU") {
          // Water flow meter - stays in m³
          siteData.ecsTotal += consumption.quantity;
          monthData.ecs += consumption.quantity;
        } else {
          // Heat/Gas/Electric - in kWh
          siteData.ecsHeatTotal += consumption.quantity;
          monthData.ecsHeat += consumption.quantity;
        }
      } else if (consumption.usage === EnergyUsage.MIXTE) {
        // For MIXTE, we use the quantityChauffage if available, or estimate
        siteData.mixteTotal += consumption.quantity;

        if (consumption.quantityChauffage !== null) {
          siteData.ncTotal += consumption.quantityChauffage;
          monthData.nc += consumption.quantityChauffage;
        } else {
          // Default: assume all is chauffage if not split
          siteData.ncTotal += consumption.quantity;
          monthData.nc += consumption.quantity;
        }

        if (consumption.quantityEcs !== null) {
          siteData.ecsTotal += consumption.quantityEcs;
          monthData.ecs += consumption.quantityEcs;
        }

        if (consumption.djuReel) {
          siteData.djrTotal += consumption.djuReel;
          monthData.djr += consumption.djuReel;
        }
      }

      siteData.consumptions.push(consumption);
    });

    // Calculate N'B (theoretical adjusted) for each site
    siteMap.forEach((siteData) => {
      const { site, djrTotal } = siteData;

      // Use heating season's NB if available, otherwise fallback to site's NB
      const heatingSeason = heatingSeasonMap.get(site.id);
      const nb = heatingSeason?.nb ?? site.nb;
      // For djuContractuel, use the same priority chain as NB but with an
      // additional fallback to the trentenaire of the site's stationMeteo
      // (or the postalCode-derived station). The user no longer has to
      // manually fill djuContractuel — we infer it from COSTIC averages
      // when missing. See resolveDjuContractuel() in src/lib/dju-sync.ts.
      const explicitDjuc = heatingSeason?.djuContractuel ?? site.djuContractuel;
      const djuContractuel = resolveDjuContractuel(
        explicitDjuc,
        site.stationMeteo,
        site.postalCode
      );

      // NB is stored in MWh, convert to kWh (* 1000) for consistency with consumptions
      const nbKwh = nb ? nb * 1000 : 0;

      if (nbKwh && djuContractuel && djrTotal > 0) {
        // N'B = NB × (DJR/DJC)
        siteData.nbPrime = nbKwh * (djrTotal / djuContractuel);
      } else if (nbKwh) {
        // If no DJU available, use NB directly
        siteData.nbPrime = nbKwh;
      }

      // Calculate per month N'B
      siteData.months.forEach((monthData) => {
        if (nbKwh && djuContractuel && monthData.djr > 0) {
          // Monthly proportional NB based on DJU ratio (already in kWh)
          const monthlyNbBase = nbKwh / 12; // Simplified: equal monthly distribution
          monthData.nbPrime = monthlyNbBase * (monthData.djr / (djuContractuel / 12));
        }
      });
    });

    // Build response - include sites with consumption OR with NB values
    const sitePerformances = Array.from(siteMap.values())
      .filter((s) => {
        // Include if has consumption data
        if (s.consumptions.length > 0) return true;
        // Also include if has NB value (from HeatingSeason or site)
        const heatingSeason = heatingSeasonMap.get(s.site.id);
        const hasNb = (heatingSeason?.nb ?? s.site.nb) !== null && (heatingSeason?.nb ?? s.site.nb) !== undefined;
        return hasNb;
      })
      .map((siteData) => {
        const { site, ncTotal, nbPrime, djrTotal, ecsTotal, ecsHeatTotal, mixteTotal, months } = siteData;

        // Delta = NC - N'B (positive = dépassement, negative = économie)
        const delta = ncTotal - nbPrime;
        const deltaPercent = nbPrime > 0 ? (delta / nbPrime) * 100 : 0;

        // Performance status
        let status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT";
        if (deltaPercent < -5) {
          status = "ECONOMIE";
        } else if (deltaPercent > 5) {
          status = "DEPASSEMENT";
        } else {
          status = "OBJECTIF";
        }

        // Monthly breakdown (in kWh)
        const monthlyData = Array.from(months.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            nc: Math.round(data.nc),
            nbPrime: Math.round(data.nbPrime),
            djr: data.djr,
            ecs: Math.round(data.ecs),
            ecsHeat: Math.round(data.ecsHeat),
          }));

        // Debug: get actual djuContractuel used in calculation (with fallback
        // to the trentenaire of the site's stationMeteo / postalCode).
        const heatingSeason = heatingSeasonMap.get(site.id);
        const explicitDjuc = heatingSeason?.djuContractuel ?? site.djuContractuel;
        const resolvedDjuc = resolveDjuContractuel(
          explicitDjuc,
          site.stationMeteo,
          site.postalCode
        );

        return {
          siteId: site.id,
          siteName: site.name,
          siteType: site.type,
          city: site.city,
          energyType: site.energyType,
          nb: site.nb,
          nbUnit: site.nbUnit,
          // Expose the *resolved* djuContractuel so the frontend doesn't
          // think it's missing — the resolver auto-fills from the COSTIC
          // trentenaire of the station when no explicit value is set.
          djuContractuel: resolvedDjuc,
          djuContractuelExplicit: explicitDjuc, // raw value from DB, if any
          stationMeteo: site.stationMeteo,
          // Debug info
          _debug: {
            heatingSeasonNb: heatingSeason?.nb,
            heatingSeasonDjuc: heatingSeason?.djuContractuel,
            siteDjuc: site.djuContractuel,
            usedDjuc: resolvedDjuc,
            djrTotal: Math.round(djrTotal),
            nbKwh: (heatingSeason?.nb ?? site.nb) ? (heatingSeason?.nb ?? site.nb)! * 1000 : 0,
            calculationApplied: !!((heatingSeason?.nb ?? site.nb) && resolvedDjuc && djrTotal > 0),
          },
          // Calculated values (in kWh)
          nc: Math.round(ncTotal),
          nbPrime: Math.round(nbPrime),
          djrTotal: Math.round(djrTotal),
          ecsTotal: Math.round(ecsTotal), // Water-based ECS (m³)
          ecsHeatTotal: Math.round(ecsHeatTotal), // Heat-based ECS (kWh)
          mixteTotal: Math.round(mixteTotal),
          delta: Math.round(delta),
          deltaPercent: Math.round(deltaPercent * 10) / 10,
          status,
          monthlyData,
        };
      });

    // Global summary (values in kWh)
    const totalNc = sitePerformances.reduce((sum, s) => sum + s.nc, 0);
    const totalNbPrime = sitePerformances.reduce((sum, s) => sum + s.nbPrime, 0);
    const totalDelta = totalNc - totalNbPrime;
    const globalDeltaPercent = totalNbPrime > 0 ? (totalDelta / totalNbPrime) * 100 : 0;

    // Monthly aggregation across all sites
    const monthlyAggregated = new Map<string, { nc: number; nbPrime: number; djr: number; ecs: number; ecsHeat: number }>();
    sitePerformances.forEach((site) => {
      site.monthlyData.forEach((m) => {
        const existing = monthlyAggregated.get(m.month) || { nc: 0, nbPrime: 0, djr: 0, ecs: 0, ecsHeat: 0 };
        existing.nc += m.nc;
        existing.nbPrime += m.nbPrime;
        existing.djr += m.djr;
        existing.ecs += m.ecs;
        existing.ecsHeat += m.ecsHeat;
        monthlyAggregated.set(m.month, existing);
      });
    });

    const globalMonthlyData = Array.from(monthlyAggregated.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: formatMonthLabel(month),
        nc: data.nc,
        nbPrime: data.nbPrime,
        djr: data.djr,
        ecs: data.ecs,
        ecsHeat: data.ecsHeat,
      }));

    // Performance by site type
    const byType = new Map<string, { nc: number; nbPrime: number; count: number }>();
    sitePerformances.forEach((site) => {
      const existing = byType.get(site.siteType) || { nc: 0, nbPrime: 0, count: 0 };
      existing.nc += site.nc;
      existing.nbPrime += site.nbPrime;
      existing.count++;
      byType.set(site.siteType, existing);
    });

    const performanceByType = Array.from(byType.entries()).map(([type, data]) => ({
      type,
      nc: data.nc,
      nbPrime: data.nbPrime,
      count: data.count,
      deltaPercent: data.nbPrime > 0 ? Math.round(((data.nc - data.nbPrime) / data.nbPrime) * 1000) / 10 : 0,
    }));

    return NextResponse.json({
      year,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalSites: sitePerformances.length,
        totalNc: Math.round(totalNc),
        totalNbPrime: Math.round(totalNbPrime),
        totalDelta: Math.round(totalDelta),
        deltaPercent: Math.round(globalDeltaPercent * 10) / 10,
        status: globalDeltaPercent < -5 ? "ECONOMIE" : globalDeltaPercent > 5 ? "DEPASSEMENT" : "OBJECTIF",
        sitesEnEconomie: sitePerformances.filter((s) => s.status === "ECONOMIE").length,
        sitesEnDepassement: sitePerformances.filter((s) => s.status === "DEPASSEMENT").length,
        sitesObjectifAtteint: sitePerformances.filter((s) => s.status === "OBJECTIF").length,
      },
      monthlyData: globalMonthlyData,
      performanceByType,
      sites: sitePerformances,
    });
  } catch (error) {
    console.error("Error fetching consumption analytics:", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des performances énergétiques" },
      { status: 500 }
    );
  }
}

// Helper: format month label (2024-01 -> Jan)
function formatMonthLabel(month: string): string {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const [, m] = month.split("-");
  return months[parseInt(m) - 1] || month;
}

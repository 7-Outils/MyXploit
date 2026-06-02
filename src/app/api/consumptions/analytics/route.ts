import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { EnergyUsage } from "@/generated/prisma/client";
import { getDailyDjuFromCache, resolveDjuContractuel, resolveStationKey, getStationFromPostalCode } from "@/lib/dju-sync";

// Force dynamic — never cache this route
export const dynamic = "force-dynamic";

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
    const yearType = searchParams.get("yearType") || "HEATING_SEASON";
    const energyType = searchParams.get("energyType");

    // Build date range based on year type:
    // CIVIL       : Jan 1 – Dec 31 of `year`
    // HEATING_SEASON (default): Jul 1 (year-1) – Jun 30 (year)
    const startDate = yearType === "CIVIL"
      ? new Date(year, 0, 1)       // 01/01/YYYY
      : new Date(year - 1, 6, 1);  // 01/07/YYYY-1
    const endDate = yearType === "CIVIL"
      ? new Date(year, 11, 31)     // 31/12/YYYY
      : new Date(year, 5, 30);     // 30/06/YYYY

    // Get contract info (including DJC) and site IDs if contractId is provided
    let contractSiteIds: string[] | null = null;
    let contractDjc: number | null = null;
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { djuContractuel: true },
      });
      contractDjc = contract?.djuContractuel ?? null;

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

    // Coefficient Q par site (pour convertir ECS volumétrique m³ → kWh).
    // Nécessaire pour déduire correctement l'ECS du NC chauffage.
    const siteCoefQ = new Map<string, number>();
    if (sites.length > 0) {
      const contractSitesCoef = await prisma.contractSite.findMany({
        where: {
          siteId: { in: sites.map((s) => s.id) },
          ...(contractId ? { contractId } : {}),
        },
        select: { siteId: true, coefficientQ: true },
      });
      for (const cs of contractSitesCoef) {
        if (cs.coefficientQ != null) siteCoefQ.set(cs.siteId, cs.coefficientQ);
      }
    }

    // Fetch heating seasons for this year to get season-specific NB
    const season = yearType === "CIVIL" ? `${year}` : `${year - 1}-${year}`;
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
        startDate: true,
        endDate: true,
        lastReleveDate: true,
      },
    });
    const heatingSeasonMap = new Map(
      heatingSeasons.map((hs) => [hs.siteId, hs])
    );

    // Fetch ALL heating periods (allumage/arrêt) for the contract sites.
    // A site can have multiple periods per calendar year (CIVIL contract).
    const allHeatingPeriods = await prisma.heatingPeriod.findMany({
      where: { siteId: { in: sites.map((s) => s.id) } },
      select: { siteId: true, startDate: true, endDate: true },
    });

    // ─── Build heating intervals per site (intersected with query range) ────
    // Each heating season becomes an interval. For CIVIL years covering 2
    // seasons, a site can have multiple intervals.
    const todayDate = new Date();
    const qStart = startDate;
    const qEnd = endDate > todayDate ? todayDate : endDate;

    interface Interval { start: Date; end: Date }
    const intervalsBySite = new Map<string, Interval[]>();
    for (const hp of allHeatingPeriods) {
      const hpStart = hp.startDate;
      // Période en cours (pas d'arrêt) : on borne au DERNIER RELEVÉ du site, pas à aujourd'hui,
      // pour ne pas compter des DJU sur des mois non relevés.
      const lastReleve = heatingSeasonMap.get(hp.siteId)?.lastReleveDate ?? null;
      const hpEnd = hp.endDate ?? lastReleve ?? todayDate;
      const iStart = hpStart > qStart ? hpStart : qStart;
      const iEnd = hpEnd < qEnd ? hpEnd : qEnd;
      if (iStart >= iEnd) continue;
      const list = intervalsBySite.get(hp.siteId) || [];
      list.push({ start: iStart, end: iEnd });
      intervalsBySite.set(hp.siteId, list);
    }

    // Helper: is a date within any heating interval for a site?
    const isHeatingDay = (siteId: string, date: Date): boolean => {
      const intervals = intervalsBySite.get(siteId);
      if (!intervals || intervals.length === 0) return false;
      return intervals.some((i) => date >= i.start && date <= i.end);
    };

    // Helper: does a consumption's month overlap with any heating interval?
    // GRDF/manual consumptions are stored with period = 1st of month representing
    // the whole month, so we check month-level overlap instead of day-level.
    const monthOverlapsHeating = (siteId: string, period: Date): boolean => {
      const intervals = intervalsBySite.get(siteId);
      if (!intervals || intervals.length === 0) return false;
      const monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
      const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0);
      return intervals.some((i) => i.start <= monthEnd && i.end >= monthStart);
    };

    // Get consumptions covering the query period + the year before
    // so we can catch heating seasons that span year boundaries
    // (e.g. allumage Sept 2025 → arrêt Mar 2026 for CIVIL year 2026).
    // Final filtering by heating season dates happens in the processing loop.
    const extendedStart = new Date(startDate);
    extendedStart.setFullYear(extendedStart.getFullYear() - 1);

    const basePeriodWhere: Record<string, unknown> = {
      organizationId: effectiveOrgId,
      period: { gte: extendedStart, lte: endDate },
    };
    if (siteId) {
      basePeriodWhere.siteId = siteId;
    } else if (contractSiteIds) {
      basePeriodWhere.siteId = { in: contractSiteIds };
    }
    if (energyType) basePeriodWhere.energyType = energyType;

    const allConsumptions = await prisma.consumption.findMany({
      where: basePeriodWhere,
      include: { site: { select: { id: true, name: true } } },
      orderBy: { period: "asc" },
    });

    // Find which sites have TELERELEVE data in this period
    const sitesWithTelereleve = new Set(
      allConsumptions
        .filter((c) => c.source === "TELERELEVE")
        .map((c) => c.siteId)
    );

    // For sites with TELERELEVE:
    //   - Keep TELERELEVE records (total gaz from GRDF = chauffage + ECS)
    //   - Also keep ECS records from EXPLOITANT (needed to deduct from NC)
    // For sites without TELERELEVE: keep EXPLOITANT/MANUAL only.
    const consumptions = allConsumptions.filter((c) => {
      const src = c.source as string;
      if (sitesWithTelereleve.has(c.siteId)) {
        // Keep GRDF data + ECS from exploitant (to deduct from NC)
        return src === "TELERELEVE" || c.usage === "ECS";
      }
      return src !== "TELERELEVE";
    });

    // Calculate performance metrics by site
    const siteMap = new Map<string, {
      site: typeof sites[0];
      consumptions: typeof consumptions;
      ncTotal: number; // Niveau de Consommation (réel chauffage)
      nbPrime: number; // N'B = NB × (DJR/DJC) - théorique ajusté
      djrTotal: number; // DJU Réels cumulés (computed in a 2nd pass to dedupe legacy values)
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
      /**
       * Per-month list of djuReel values from heating-related consumption
       * rows. We collect them here instead of summing eagerly because of a
       * legacy data shape: before the dju-sync fix, every daily row of a
       * given month was written with the SAME monthly DJR total, which
       * the analytics endpoint then over-counted ~30×. We dedupe defensively
       * in a 2nd pass below.
       */
      djrByMonth: Map<string, number[]>;
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
        djrByMonth: new Map(),
      });
    });

    // Process consumptions — only include those within the site's allumage → arrêt period
    consumptions.forEach((consumption) => {
      const siteData = siteMap.get(consumption.siteId);
      if (!siteData) return;

      // Filter: only count consumption whose month overlaps a heating interval.
      // Using month-level overlap because GRDF/manual records store period as
      // the 1st of the month to represent the entire month's consumption.
      if (intervalsBySite.has(consumption.siteId) && !monthOverlapsHeating(consumption.siteId, consumption.period)) {
        return;
      }

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

        // Collect DJR values for the post-pass dedup (handles the legacy
        // case where every daily row of a month had the SAME monthly total).
        if (consumption.djuReel) {
          const arr = siteData.djrByMonth.get(monthKey) || [];
          arr.push(consumption.djuReel);
          siteData.djrByMonth.set(monthKey, arr);
        }
      } else if (consumption.usage === EnergyUsage.ECS) {
        // Route selon l'UNITÉ stockée, pas selon energyType:
        // - m³ → volumétrique (ecsTotal, sera converti en kWh au moment de la déduction)
        // - kWh/MWh → déjà énergétique (ecsHeatTotal direct)
        // Le projector convertit EAU_CHAUDE m³ → kWh via coefficient Q, donc
        // energyType=EAU peut avoir unit="kWh" après projection.
        const qty = consumption.unit === "MWh" ? consumption.quantity * 1000 : consumption.quantity;
        if (consumption.unit === "m³" || consumption.unit === "m3") {
          siteData.ecsTotal += consumption.quantity;
          monthData.ecs += consumption.quantity;
        } else {
          siteData.ecsHeatTotal += qty;
          monthData.ecsHeat += qty;
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
          const arr = siteData.djrByMonth.get(monthKey) || [];
          arr.push(consumption.djuReel);
          siteData.djrByMonth.set(monthKey, arr);
        }
      }

      siteData.consumptions.push(consumption);
    });

    // ─── Fetch daily DJU from weather API ───────────────────────────────
    const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // Dédup par station météo: un contrat de 74 sites partage souvent 1-5
    // stations (zone géo commune). Sans dédup on faisait 74 appels Open-Meteo
    // en parallèle → rate limit → échecs silencieux → DJR=0 qui se rempli au
    // refresh. Avec dédup on fait ~5 appels, robuste.
    type StationGroup = { key: string; spanStart: Date; spanEnd: Date; siteIds: string[] };
    const stationGroups = new Map<string, StationGroup>();
    for (const site of sites) {
      const intervals = intervalsBySite.get(site.id);
      if (!intervals || intervals.length === 0) continue;
      const spanStart = intervals.reduce((min, i) => (i.start < min ? i.start : min), intervals[0].start);
      const spanEnd = intervals.reduce((max, i) => (i.end > max ? i.end : max), intervals[0].end);
      const stationKey =
        resolveStationKey(site.stationMeteo) ?? getStationFromPostalCode(site.postalCode);
      const existing = stationGroups.get(stationKey);
      if (existing) {
        if (spanStart < existing.spanStart) existing.spanStart = spanStart;
        if (spanEnd > existing.spanEnd) existing.spanEnd = spanEnd;
        existing.siteIds.push(site.id);
      } else {
        stationGroups.set(stationKey, { key: stationKey, spanStart, spanEnd, siteIds: [site.id] });
      }
    }

    const dailyDjuByStation = new Map<string, Map<string, number>>();
    await Promise.all(
      Array.from(stationGroups.values()).map(async (g) => {
        const daily = await getDailyDjuFromCache(
          g.key,
          null,
          toIso(g.spanStart),
          toIso(g.spanEnd),
        );
        dailyDjuByStation.set(g.key, daily);
      })
    );

    // Dispatch par site
    const dailyDjuBySite = new Map<string, Map<string, number>>();
    for (const site of sites) {
      const stationKey =
        resolveStationKey(site.stationMeteo) ?? getStationFromPostalCode(site.postalCode);
      dailyDjuBySite.set(site.id, dailyDjuByStation.get(stationKey) ?? new Map());
    }

    // Inject DJR into site data — DJU réels sommés sur TOUTE la période de chauffe
    // (de l'allumage à l'arrêt, ou au dernier relevé si encore allumé — cf. construction
    // des intervalles). Pas de plafonnement aux mois avec conso : le DJR reflète la
    // période de chauffe, indépendamment de la couverture des relevés.
    siteMap.forEach((siteData) => {
      const daily = dailyDjuBySite.get(siteData.site.id);
      if (!daily) return;

      // Reset monthly DJR and total
      siteData.months.forEach((m) => { m.djr = 0; });
      let total = 0;

      for (const [dateIso, dju] of daily.entries()) {
        const d = new Date(dateIso);
        if (!isHeatingDay(siteData.site.id, d)) continue;
        const monthKey = dateIso.substring(0, 7); // YYYY-MM
        total += dju;
        const monthData = siteData.months.get(monthKey);
        if (monthData) monthData.djr += dju;
      }
      siteData.djrTotal = total;
    });

    // ─── Deduct ECS from NC ──────────────────────────────────────────
    // Le compteur gaz principal mesure TOUT le gaz consommé (chauffage + ECS).
    // Pour avoir le NC chauffage net, on déduit l'ECS:
    //   - ecsHeatTotal: ECS mesuré en kWh (gaz/elec dédié ECS, source TELERELEVE ou EXPLOITANT)
    //   - ecsTotal × coefQ × 1000: ECS volumétrique m³ converti en kWh
    // On applique la déduction à TOUS les sites (pas juste TELERELEVE) dès
    // lors qu'il y a de l'ECS identifié.
    siteMap.forEach((siteData) => {
      const coefQ = siteCoefQ.get(siteData.site.id) ?? 0.13;
      const ecsFromVolume = siteData.ecsTotal > 0 ? siteData.ecsTotal * coefQ * 1000 : 0;
      const ecsKwh = siteData.ecsHeatTotal + ecsFromVolume;
      if (ecsKwh <= 0) return;

      siteData.ncTotal = Math.max(0, siteData.ncTotal - ecsKwh);

      // Also deduct per month: ecsHeat (kWh) + ecs volumétrique × coefQ × 1000
      siteData.months.forEach((monthData) => {
        const monthEcsKwh = monthData.ecsHeat + (monthData.ecs > 0 ? monthData.ecs * coefQ * 1000 : 0);
        if (monthEcsKwh > 0) {
          monthData.nc = Math.max(0, monthData.nc - monthEcsKwh);
        }
      });
    });

    // Calculate N'B (theoretical adjusted) for each site
    siteMap.forEach((siteData) => {
      const { site, djrTotal } = siteData;

      // NB comes exclusively from the heating season (Cibles énergétiques)
      const heatingSeason = heatingSeasonMap.get(site.id);
      const nb = heatingSeason?.nb ?? null;
      // DJC priority: Site.djuContractuel > Contract.djuContractuel > trentenaire
      // (calculé depuis la station météo du site, défaut PARIS-MONTSOURIS si inconnue).
      const djuContractuel = resolveDjuContractuel(
        site.djuContractuel ?? contractDjc ?? null,
        site.stationMeteo ?? null,
        site.postalCode ?? null
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
      const monthCount = siteData.months.size || 1;
      siteData.months.forEach((monthData) => {
        if (nbKwh && djuContractuel && monthData.djr > 0) {
          // Monthly proportional NB based on DJU ratio (already in kWh)
          const monthlyNbBase = nbKwh / 12;
          monthData.nbPrime = monthlyNbBase * (monthData.djr / (djuContractuel / 12));
        } else if (nbKwh && monthData.djr === 0) {
          // No DJR (missing station météo) — distribute NB evenly across months
          monthData.nbPrime = nbKwh / 12;
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
        const hasNb = heatingSeason?.nb != null;
        return hasNb;
      })
      .map((siteData) => {
        const { site, ncTotal, nbPrime, djrTotal, ecsTotal, ecsHeatTotal, mixteTotal, months } = siteData;

        // Delta = NC - N'B (positive = dépassement, negative = économie)
        const delta = ncTotal - nbPrime;
        const deltaPercent = nbPrime > 0 ? (delta / nbPrime) * 100 : 0;

        // Comparable only if we have both real consumption AND a valid heating
        // signal. Without DJR, N'B falls back to raw NB (no normalization);
        // without NC, the comparison is 0 vs target → fake -100% économie.
        const isComparable = ncTotal > 0 && djrTotal > 0;

        // Performance status
        let status: "ECONOMIE" | "OBJECTIF" | "DEPASSEMENT" | "INCOMPLET";
        if (!isComparable) {
          status = "INCOMPLET";
        } else if (deltaPercent < -5) {
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
            label: formatMonthLabel(month),
            nc: Math.round(data.nc),
            nbPrime: Math.round(data.nbPrime),
            djr: data.djr,
            ecs: Math.round(data.ecs),
            ecsHeat: Math.round(data.ecsHeat),
          }));

        const heatingSeason = heatingSeasonMap.get(site.id);

        return {
          siteId: site.id,
          siteName: site.name,
          siteType: site.type,
          city: site.city,
          energyType: site.energyType,
          dataSource: sitesWithTelereleve.has(site.id) ? "TELERELEVE" as const : "MANUAL" as const,
          nb: heatingSeason?.nb ?? null,
          nbUnit: heatingSeason?.nbUnit ?? site.nbUnit,
          djuContractuel: contractDjc,
          stationMeteo: site.stationMeteo,
          _debug: {
            usedDjuc: contractDjc,
            djrTotal: Math.round(djrTotal),
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
    // Only include sites where the NC/N'B comparison is actually meaningful:
    // a real NB target, real consumption (NC>0), and a valid heating signal
    // (DJR>0 — otherwise N'B falls back to raw NB and the écart is bogus).
    const sitesWithTarget = sitePerformances.filter(
      (s) => s.nbPrime > 0 && s.status !== "INCOMPLET"
    );
    const totalNc = sitesWithTarget.reduce((sum, s) => sum + s.nc, 0);
    const totalNbPrime = sitesWithTarget.reduce((sum, s) => sum + s.nbPrime, 0);
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
      summary: (() => {
        // On ne compte que les sites avec NB ET dont la comparaison NC/N'B est
        // valide (NC>0 et DJR>0). Les sites INCOMPLET (pas de relevé, ou pas
        // de saison de chauffe couvrant la période) ne doivent pas alimenter
        // sitesEnEconomie : ils donnaient un faux -100% avant le fix.
        const comparable = sitePerformances.filter(
          (s) => s.nb != null && s.status !== "INCOMPLET"
        );
        const incomplets = sitePerformances.filter(
          (s) => s.nb != null && s.status === "INCOMPLET"
        ).length;
        return {
          totalSites: comparable.length,
          sitesIncomplets: incomplets,
          totalNc: Math.round(totalNc),
          totalNbPrime: Math.round(totalNbPrime),
          totalDelta: Math.round(totalDelta),
          deltaPercent: Math.round(globalDeltaPercent * 10) / 10,
          status: globalDeltaPercent < -5 ? "ECONOMIE" : globalDeltaPercent > 5 ? "DEPASSEMENT" : "OBJECTIF",
          sitesEnEconomie: comparable.filter((s) => s.status === "ECONOMIE").length,
          sitesEnDepassement: comparable.filter((s) => s.status === "DEPASSEMENT").length,
          sitesObjectifAtteint: comparable.filter((s) => s.status === "OBJECTIF").length,
        };
      })(),
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

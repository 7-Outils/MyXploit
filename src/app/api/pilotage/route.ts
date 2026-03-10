import { NextResponse } from "next/server";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { getUserVisibleSiteIds } from "@/lib/portfolio";
import prisma from "@/lib/prisma";

function getDpeScore(kwhPerM2: number): string {
  if (kwhPerM2 <= 50) return "A";
  if (kwhPerM2 <= 90) return "B";
  if (kwhPerM2 <= 150) return "C";
  if (kwhPerM2 <= 230) return "D";
  if (kwhPerM2 <= 330) return "E";
  if (kwhPerM2 <= 450) return "F";
  return "G";
}

export async function GET() {
  try {
    const user = await requireAuth();
    const orgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const visibleSiteIds = await getUserVisibleSiteIds(user.id, user.role, orgId);

    const siteWhere = {
      organizationId: orgId,
      ...(visibleSiteIds ? { id: { in: visibleSiteIds } } : {}),
    };

    // Fetch all sites
    const sites = await prisma.site.findMany({
      where: siteWhere,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        surface: true,
        surfaceChauffee: true,
        energyType: true,
        contractSites: {
          select: {
            contract: {
              select: { provider: true },
            },
          },
          take: 1,
        },
      },
    });

    const siteIds = sites.map((s) => s.id);

    // Date ranges: last 12 months (N) and previous 12 months (N-1)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);

    // Fetch consumptions for last 24 months (covers N and N-1)
    const consumptions = await prisma.consumption.findMany({
      where: {
        siteId: { in: siteIds },
        organizationId: orgId,
        period: { gte: twentyFourMonthsAgo },
      },
      select: {
        siteId: true,
        energyType: true,
        period: true,
        quantity: true,
        unit: true,
        cost: true,
      },
    });

    // Split consumptions into N (current) and N-1 (previous)
    const consoN: Record<string, number> = {};
    const consoNMinus1: Record<string, number> = {};
    const costN: Record<string, number> = {};
    const energyTotalsN: Record<string, number> = {};
    const monthlyData: Record<string, Record<string, number>> = {};

    for (const c of consumptions) {
      const periodDate = new Date(c.period);
      const isCurrentYear = periodDate >= twelveMonthsAgo;
      const qtyKwh = c.unit === "MWh" ? c.quantity * 1000 : c.quantity;

      if (isCurrentYear) {
        consoN[c.siteId] = (consoN[c.siteId] || 0) + qtyKwh;
        costN[c.siteId] = (costN[c.siteId] || 0) + (c.cost || 0);

        // Energy breakdown
        const eType = c.energyType;
        energyTotalsN[eType] = (energyTotalsN[eType] || 0) + qtyKwh;

        // Monthly trend
        const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        monthlyData[monthKey][eType] = (monthlyData[monthKey][eType] || 0) + qtyKwh;
      } else {
        consoNMinus1[c.siteId] = (consoNMinus1[c.siteId] || 0) + qtyKwh;
      }
    }

    // Build buildings array
    const buildings = sites.map((site) => {
      const conso = consoN[site.id] || 0;
      const consoOld = consoNMinus1[site.id] || 0;
      const sChauffee = site.surfaceChauffee || site.surface || 0;
      const kwhPerM2 = sChauffee > 0 ? Math.round(conso / sChauffee) : 0;
      const trend = consoOld > 0 ? Math.round(((conso - consoOld) / consoOld) * 100) : 0;
      const provider = site.contractSites[0]?.contract?.provider || null;

      return {
        id: site.id,
        name: site.name,
        type: site.type,
        city: site.city,
        surface: site.surface || 0,
        surfaceChauffee: sChauffee,
        kwhPerM2,
        score: getDpeScore(kwhPerM2),
        trend,
        contractProvider: provider,
      };
    });

    // KPIs
    const totalConsoN = Object.values(consoN).reduce((a, b) => a + b, 0);
    const totalConsoNMinus1 = Object.values(consoNMinus1).reduce((a, b) => a + b, 0);
    const totalCostN = Object.values(costN).reduce((a, b) => a + b, 0);
    const totalSurface = sites.reduce((sum, s) => sum + (s.surfaceChauffee || s.surface || 0), 0);
    const trendPercent = totalConsoNMinus1 > 0
      ? Math.round(((totalConsoN - totalConsoNMinus1) / totalConsoNMinus1) * 100)
      : 0;

    // Alerts
    const alerts = await prisma.alert.findMany({
      where: {
        organizationId: orgId,
        isRead: false,
        ...(visibleSiteIds ? { siteId: { in: visibleSiteIds } } : {}),
      },
      select: {
        id: true,
        type: true,
        priority: true,
        title: true,
        createdAt: true,
        site: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const criticalAlerts = alerts.filter((a) => a.priority === "CRITIQUE" || a.priority === "HAUTE").length;

    // Equipment issues
    const equipmentIssues = await prisma.equipment.findMany({
      where: {
        organizationId: orgId,
        siteId: { in: siteIds },
        status: { in: ["PANNE", "HORS_SERVICE"] },
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        site: { select: { name: true } },
      },
      take: 10,
    });

    // Energy breakdown
    const totalEnergyN = Object.values(energyTotalsN).reduce((a, b) => a + b, 0);
    const energyBreakdown = Object.entries(energyTotalsN).map(([type, totalKwh]) => ({
      type,
      totalKwh: Math.round(totalKwh),
      percentage: totalEnergyN > 0 ? Math.round((totalKwh / totalEnergyN) * 100) : 0,
    }));

    // Monthly trend (sorted by month)
    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, energies]) => ({
        month,
        gaz: Math.round(energies["GAZ"] || 0),
        electricite: Math.round(energies["ELECTRICITE"] || 0),
        fioul: Math.round(energies["FIOUL"] || 0),
        bois: Math.round(energies["BOIS"] || 0),
        reseauChaleur: Math.round(energies["RESEAU_CHALEUR"] || 0),
        total: Math.round(Object.values(energies).reduce((a, b) => a + b, 0)),
      }));

    return NextResponse.json({
      kpis: {
        buildingCount: sites.length,
        totalSurface: Math.round(totalSurface),
        totalMwh: Math.round(totalConsoN / 1000),
        totalCost: Math.round(totalCostN),
        alertCount: alerts.length,
        criticalAlerts,
        trendPercent,
      },
      buildings,
      energyBreakdown,
      monthlyTrend,
      alerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        priority: a.priority,
        title: a.title,
        siteName: a.site?.name || "—",
        createdAt: a.createdAt,
      })),
      equipmentIssues: equipmentIssues.map((e) => ({
        id: e.id,
        name: e.name || e.type,
        status: e.status,
        siteName: e.site?.name || "—",
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("[API] /api/pilotage error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

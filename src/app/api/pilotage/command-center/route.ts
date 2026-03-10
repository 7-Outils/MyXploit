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
    const profile = user.profile || "AMO";

    const siteWhere = {
      organizationId: orgId,
      ...(visibleSiteIds ? { id: { in: visibleSiteIds } } : {}),
    };

    // ─── Parallel queries ───────────────────────────────
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const twentyFourMonthsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);

    const [
      sites,
      alerts,
      tickets,
      equipmentIssues,
      equipmentTotal,
      recentActivity,
      contracts,
      invoices,
    ] = await Promise.all([
      // Sites with contracts
      prisma.site.findMany({
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
              amountP1: true,
              amountP2: true,
              amountP3: true,
              contract: { select: { provider: true, status: true, endDate: true } },
            },
            take: 1,
          },
        },
      }),
      // Active alerts
      prisma.alert.findMany({
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
        take: 15,
      }),
      // Open tickets
      prisma.ticket.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          ...(visibleSiteIds ? { siteId: { in: visibleSiteIds } } : {}),
        },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          dueDate: true,
          site: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Equipment in trouble
      prisma.equipment.findMany({
        where: {
          organizationId: orgId,
          ...(visibleSiteIds ? { siteId: { in: visibleSiteIds } } : {}),
          status: { in: ["PANNE", "HORS_SERVICE", "MAINTENANCE"] },
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          power: true,
          site: { select: { name: true } },
        },
        take: 10,
      }),
      // Total equipment count
      prisma.equipment.count({
        where: {
          organizationId: orgId,
          ...(visibleSiteIds ? { siteId: { in: visibleSiteIds } } : {}),
        },
      }),
      // Recent activity
      prisma.siteActivityLog.findMany({
        where: {
          organizationId: orgId,
          ...(visibleSiteIds ? { siteId: { in: visibleSiteIds } } : {}),
        },
        select: {
          id: true,
          activityType: true,
          title: true,
          activityDate: true,
          site: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { activityDate: "desc" },
        take: 8,
      }),
      // Contracts (for expiring + P3 budget)
      prisma.contract.findMany({
        where: {
          organizationId: orgId,
          status: "ACTIF",
        },
        select: {
          id: true,
          title: true,
          provider: true,
          endDate: true,
          contractSites: {
            select: { amountP1: true, amountP2: true, amountP3: true },
          },
        },
        orderBy: { endDate: "asc" },
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          issueDate: true,
          site: { select: { name: true } },
        },
        orderBy: { issueDate: "desc" },
        take: 5,
      }),
    ]);

    const siteIds = sites.map((s) => s.id);

    // ─── Consumptions ─────────────────────────────────────
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

    // Aggregate consumptions
    const consoN: Record<string, number> = {};
    const consoNMinus1: Record<string, number> = {};
    const costN: Record<string, number> = {};
    const energyTotals: Record<string, number> = {};
    const monthlyData: Record<string, Record<string, number>> = {};

    for (const c of consumptions) {
      const periodDate = new Date(c.period);
      const isCurrentYear = periodDate >= twelveMonthsAgo;
      const qtyKwh = c.unit === "MWh" ? c.quantity * 1000 : c.quantity;

      if (isCurrentYear) {
        consoN[c.siteId] = (consoN[c.siteId] || 0) + qtyKwh;
        costN[c.siteId] = (costN[c.siteId] || 0) + (c.cost || 0);
        energyTotals[c.energyType] = (energyTotals[c.energyType] || 0) + qtyKwh;

        const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
        monthlyData[monthKey][c.energyType] = (monthlyData[monthKey][c.energyType] || 0) + qtyKwh;
      } else {
        consoNMinus1[c.siteId] = (consoNMinus1[c.siteId] || 0) + qtyKwh;
      }
    }

    // ─── Build response ───────────────────────────────────
    const totalConsoN = Object.values(consoN).reduce((a, b) => a + b, 0);
    const totalConsoNMinus1 = Object.values(consoNMinus1).reduce((a, b) => a + b, 0);
    const totalCost = Object.values(costN).reduce((a, b) => a + b, 0);
    const totalSurface = sites.reduce((s, site) => s + (site.surfaceChauffee || site.surface || 0), 0);
    const trendPercent = totalConsoNMinus1 > 0
      ? Math.round(((totalConsoN - totalConsoNMinus1) / totalConsoNMinus1) * 100)
      : 0;

    const criticalAlerts = alerts.filter((a) => a.priority === "CRITIQUE" || a.priority === "HAUTE").length;
    const overdueTickets = tickets.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;

    // DPE scores distribution
    const buildings = sites.map((site) => {
      const conso = consoN[site.id] || 0;
      const consoOld = consoNMinus1[site.id] || 0;
      const sChauffee = site.surfaceChauffee || site.surface || 0;
      const kwhPerM2 = sChauffee > 0 ? Math.round(conso / sChauffee) : 0;
      const trend = consoOld > 0 ? Math.round(((conso - consoOld) / consoOld) * 100) : 0;
      const cost = costN[site.id] || 0;

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
        cost: Math.round(cost),
        provider: site.contractSites[0]?.contract?.provider || null,
      };
    });

    // Average DPE
    const buildingsWithData = buildings.filter((b) => b.kwhPerM2 > 0);
    const avgKwhPerM2 = buildingsWithData.length > 0
      ? Math.round(buildingsWithData.reduce((s, b) => s + b.kwhPerM2, 0) / buildingsWithData.length)
      : 0;

    // Energy breakdown
    const totalEnergy = Object.values(energyTotals).reduce((a, b) => a + b, 0);
    const energyBreakdown = Object.entries(energyTotals)
      .map(([type, kwh]) => ({
        type,
        totalKwh: Math.round(kwh),
        percentage: totalEnergy > 0 ? Math.round((kwh / totalEnergy) * 100) : 0,
      }))
      .sort((a, b) => b.totalKwh - a.totalKwh);

    // Monthly trend
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

    // P3 budget (sum all contract sites)
    const totalP3Budget = contracts.reduce(
      (sum, c) => sum + c.contractSites.reduce((s, cs) => s + (cs.amountP3 || 0), 0),
      0
    );

    // Contracts expiring within 6 months
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    const expiringContracts = contracts
      .filter((c) => c.endDate <= sixMonthsFromNow)
      .map((c) => ({
        id: c.id,
        title: c.title,
        provider: c.provider,
        endDate: c.endDate,
      }));

    // Top 5 costly buildings
    const topCostly = [...buildings].sort((a, b) => b.cost - a.cost).slice(0, 5);

    return NextResponse.json({
      profile,
      kpis: {
        buildingCount: sites.length,
        totalSurface: Math.round(totalSurface),
        totalMwh: Math.round(totalConsoN / 1000),
        totalCost: Math.round(totalCost),
        costPerM2: totalSurface > 0 ? +(totalCost / totalSurface).toFixed(1) : 0,
        avgKwhPerM2,
        avgDpe: getDpeScore(avgKwhPerM2),
        trendPercent,
        alertCount: alerts.length,
        criticalAlerts,
        ticketCount: tickets.length,
        overdueTickets,
        equipmentIssueCount: equipmentIssues.length,
        equipmentTotal,
        p3Budget: Math.round(totalP3Budget),
      },
      buildings,
      topCostly,
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
      tickets: tickets.map((t) => ({
        id: t.id,
        reference: t.reference,
        title: t.title,
        status: t.status,
        siteName: t.site?.name || "—",
        dueDate: t.dueDate,
        isOverdue: t.dueDate ? new Date(t.dueDate) < now : false,
      })),
      equipmentIssues: equipmentIssues.map((e) => ({
        id: e.id,
        name: e.name || e.type,
        status: e.status,
        power: e.power,
        siteName: e.site?.name || "—",
      })),
      expiringContracts,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        type: inv.type,
        status: inv.status,
        amount: inv.amount,
        issueDate: inv.issueDate,
        siteName: inv.site?.name || "—",
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.activityType,
        title: a.title,
        date: a.activityDate,
        siteName: a.site?.name || "—",
        userName: [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") || "—",
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("[API] /api/pilotage/command-center error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

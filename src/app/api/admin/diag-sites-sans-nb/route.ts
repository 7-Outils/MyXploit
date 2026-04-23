import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/diag-sites-sans-nb?contractId=X&year=Y
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Liste les sites du contrat qui ont des Consumption pour la saison year-1/year
 * mais PAS de HeatingSeason.nb défini → exclus de la comparaison NC vs N'B.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!contractId) {
    return NextResponse.json({ error: "contractId requis" }, { status: 400 });
  }

  const season = `${year - 1}-${year}`;
  const seasonStart = new Date(`${year - 1}-07-01`);
  const seasonEnd = new Date(`${year}-06-30`);

  const contractSites = await prisma.contractSite.findMany({
    where: { contractId },
    select: {
      siteId: true,
      site: { select: { id: true, name: true } },
    },
  });
  const siteIds = contractSites.map((cs) => cs.siteId);

  const heatingSeasons = await prisma.heatingSeason.findMany({
    where: { siteId: { in: siteIds }, season },
    select: { siteId: true, nb: true },
  });
  const nbBySite = new Map(heatingSeasons.map((hs) => [hs.siteId, hs.nb]));

  const consumptionCounts = await prisma.consumption.groupBy({
    by: ["siteId"],
    where: {
      siteId: { in: siteIds },
      period: { gte: seasonStart, lte: seasonEnd },
    },
    _count: { _all: true },
    _sum: { quantity: true },
  });
  const consoBySite = new Map(
    consumptionCounts.map((c) => [c.siteId, { count: c._count._all, totalKwh: c._sum.quantity ?? 0 }])
  );

  const rows = contractSites.map((cs) => {
    const conso = consoBySite.get(cs.siteId);
    const nb = nbBySite.get(cs.siteId);
    return {
      siteName: cs.site.name,
      hasConsumption: !!conso && conso.count > 0,
      hasNb: nb != null && nb > 0,
      consumptionRowCount: conso?.count ?? 0,
      totalKwh: Math.round(conso?.totalKwh ?? 0),
      nb: nb,
    };
  });

  const sitesConsumptionNoNb = rows.filter((r) => r.hasConsumption && !r.hasNb);
  const sitesNbNoConsumption = rows.filter((r) => !r.hasConsumption && r.hasNb);
  const sitesBoth = rows.filter((r) => r.hasConsumption && r.hasNb);
  const sitesNeither = rows.filter((r) => !r.hasConsumption && !r.hasNb);

  return NextResponse.json({
    season,
    contractId,
    summary: {
      total: rows.length,
      withConsoAndNb: sitesBoth.length,
      withConsoWithoutNb: sitesConsumptionNoNb.length,
      withNbWithoutConso: sitesNbNoConsumption.length,
      neither: sitesNeither.length,
    },
    sitesConsumptionWithoutNb: sitesConsumptionNoNb,
    sitesNbWithoutConsumption: sitesNbNoConsumption,
  });
}

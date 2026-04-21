import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/diag-site-ratio?siteName=X&year=Y
 * Authentification: header `Authorization: Bearer <CRON_SECRET>`
 *
 * Diagnostic pour un site qui ne montre pas le ratio conso/DJU dans Relevés.
 * Compare:
 *   - Readings GAZ/CHALEUR/FIOUL avec delta d'index (ce que Relevés utilise)
 *   - Consumptions projetées par période
 *   - HeatingSeason (startDate/endDate/nb)
 *   - HeatingPeriod (dates d'allumage/arrêt)
 *   - Ce que /api/dju renverrait (sans tourner l'API — on calcule la logique)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteName = searchParams.get("siteName");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!siteName) {
    return NextResponse.json({ error: "siteName requis" }, { status: 400 });
  }

  const site = await prisma.site.findFirst({
    where: { name: { contains: siteName, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      postalCode: true,
      stationMeteo: true,
      djuContractuel: true,
    },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // Readings avec indexValue
  const heatingMeters = await prisma.meter.findMany({
    where: {
      siteId: site.id,
      fluid: { in: ["GAZ", "CHALEUR", "FIOUL"] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      fluid: true,
      unit: true,
      readings: {
        where: { indexValue: { not: null } },
        orderBy: { readingDate: "asc" },
        select: {
          id: true,
          readingDate: true,
          indexValue: true,
          isReset: true,
        },
      },
    },
  });

  // HeatingSeason pour l'année ciblée
  const seasonKey = `${year - 1}-${year}`;
  const heatingSeason = await prisma.heatingSeason.findUnique({
    where: { siteId_season: { siteId: site.id, season: seasonKey } },
    select: { season: true, startDate: true, endDate: true, nb: true, nbUnit: true, lastReleveDate: true },
  });

  // HeatingPeriod(s) pour ce site
  const heatingPeriods = await prisma.heatingPeriod.findMany({
    where: { siteId: site.id },
    orderBy: { startDate: "asc" },
    select: { startDate: true, endDate: true },
  });

  // Consumption de la saison
  const consumptions = await prisma.consumption.findMany({
    where: {
      siteId: site.id,
      period: {
        gte: new Date(`${year - 1}-07-01`),
        lte: new Date(`${year}-06-30`),
      },
    },
    orderBy: { period: "asc" },
    select: {
      period: true,
      periodEnd: true,
      energyType: true,
      usage: true,
      source: true,
      quantity: true,
      unit: true,
      meterName: true,
    },
  });

  // Simule la logique de /api/dju: hasConsumptions || hasNb
  const hasConsumptions = consumptions.length > 0;
  const hasNb = !!heatingSeason?.nb;

  // ContractSite pour le coefficient Q/PCS
  const contractSite = await prisma.contractSite.findFirst({
    where: { siteId: site.id },
    select: { coefficientPCS: true, coefficientQ: true, contractId: true },
  });

  return NextResponse.json({
    site,
    year,
    contractSite,
    heatingSeason,
    heatingPeriods,
    consumptions: {
      count: consumptions.length,
      byMonth: consumptions.reduce<Record<string, Record<string, number>>>((acc, c) => {
        const key = c.period.toISOString().substring(0, 7);
        if (!acc[key]) acc[key] = {};
        const cat = `${c.energyType}_${c.usage}_${c.source}`;
        acc[key][cat] = (acc[key][cat] ?? 0) + c.quantity;
        return acc;
      }, {}),
    },
    heatingMeters: heatingMeters.map((m) => ({
      name: m.name,
      fluid: m.fluid,
      unit: m.unit,
      readingsCount: m.readings.length,
      firstReading: m.readings[0]?.readingDate,
      lastReading: m.readings[m.readings.length - 1]?.readingDate,
    })),
    djuApiInclusion: {
      hasConsumptions,
      hasNb,
      wouldBeIncluded: hasConsumptions || hasNb,
      reason: !hasConsumptions && !hasNb
        ? "NI consommations NI NB pour la saison → exclu"
        : "inclus",
    },
  });
}

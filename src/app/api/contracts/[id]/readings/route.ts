import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/contracts/[id]/readings - List recent meter readings for all sites of a contract
 * Each reading includes its previous reading (for context: previous index + date).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      select: { siteId: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json([]);
    }

    const siteIds = contractSites.map((cs) => cs.siteId);

    const readings = await prisma.meterReading.findMany({
      where: {
        source: "MANUEL",
        meter: {
          siteId: { in: siteIds },
          site: { organizationId: effectiveOrgId },
        },
      },
      include: {
        meter: {
          select: {
            id: true,
            name: true,
            fluid: true,
            unit: true,
            siteId: true,
            site: { select: { name: true } },
          },
        },
      },
      orderBy: { readingDate: "desc" },
      take: limit,
    });

    // Map siteId → coefficients contractuels (ContractSite du contrat courant).
    // Source de vérité unique pour la conversion ECS/Gaz → kWh.
    const contractSitesWithCoefs = await prisma.contractSite.findMany({
      where: { contractId, siteId: { in: siteIds } },
      select: { siteId: true, coefficientPCS: true, coefficientQ: true },
    });
    const coefsBySite = new Map(
      contractSitesWithCoefs.map((cs) => [cs.siteId, cs])
    );

    const convertDelta = (
      fluid: string,
      unit: string,
      delta: number,
      siteId: string
    ): { value: number; unit: string } | null => {
      const cs = coefsBySite.get(siteId);
      const pcs = cs?.coefficientPCS ?? 10.5;
      const qMwh = cs?.coefficientQ ?? 0.13;
      const u = unit.toLowerCase().replace(/\s/g, "");
      if (fluid === "GAZ" && (u === "m3" || u === "m³")) return { value: delta * pcs, unit: "kWh" };
      if (fluid === "EAU_CHAUDE" && (u === "m3" || u === "m³")) return { value: delta * qMwh * 1000, unit: "kWh" };
      if (fluid === "FIOUL" && (u === "l" || u === "litres")) return { value: delta * 10, unit: "kWh" };
      if ((fluid === "ELECTRICITE" || fluid === "CHALEUR") && u === "mwh") return { value: delta * 1000, unit: "kWh" };
      if ((fluid === "ELECTRICITE" || fluid === "CHALEUR") && u === "kwh") return { value: delta, unit: "kWh" };
      return null;
    };

    // For each reading, find its previous reading and recalculate consumption
    // on-the-fly so insertions of older readings update the chain automatically.
    // If the current reading is marked as "reset" (new meter), skip the previous.
    // Also, never look past a reset in the history — each "reset" starts a fresh chain.
    const enriched = await Promise.all(
      readings.map(async (r) => {
        let prev: { readingDate: Date; indexValue: number | null } | null = null;

        if (!r.isReset) {
          // Find the most recent reset on or before this reading (excluding self)
          const lastReset = await prisma.meterReading.findFirst({
            where: {
              meterId: r.meterId,
              readingDate: { lte: r.readingDate },
              isReset: true,
              NOT: { id: r.id },
            },
            orderBy: { readingDate: "desc" },
            select: { readingDate: true },
          });

          prev = await prisma.meterReading.findFirst({
            where: {
              meterId: r.meterId,
              readingDate: lastReset
                ? { lt: r.readingDate, gte: lastReset.readingDate }
                : { lt: r.readingDate },
              indexValue: { not: null },
            },
            orderBy: { readingDate: "desc" },
            select: { readingDate: true, indexValue: true },
          });
        }

        // Recalculate consumption live from index difference
        let consumption = r.consumption;
        let consumptionConverted: number | null = null;
        let unitConverted: string | null = null;
        if (r.indexValue != null && prev?.indexValue != null) {
          consumption = r.indexValue - prev.indexValue;
          // Conversion via coefficients contractuels (ContractSite), pas via Meter.conversionCoefficient
          const converted = convertDelta(r.meter.fluid, r.meter.unit, consumption, r.meter.siteId);
          if (converted) {
            consumptionConverted = converted.value;
            unitConverted = converted.unit;
          }
        } else if (r.indexValue != null && !prev) {
          // No previous reading → first reading, no consumption
          consumption = null;
          consumptionConverted = null;
          unitConverted = null;
        }

        return {
          ...r,
          consumption,
          consumptionConverted,
          unitConverted,
          previous: prev ? { readingDate: prev.readingDate, indexValue: prev.indexValue } : null,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching contract readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}

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
        let consumptionConverted = r.consumptionConverted;
        let unitConverted = r.unitConverted;
        if (r.indexValue != null && prev?.indexValue != null) {
          consumption = r.indexValue - prev.indexValue;
          // Fetch meter coefficient for conversion
          const meter = await prisma.meter.findUnique({
            where: { id: r.meterId },
            select: { conversionCoefficient: true, conversionUnit: true },
          });
          if (meter?.conversionCoefficient) {
            consumptionConverted = consumption * meter.conversionCoefficient;
            unitConverted = meter.conversionUnit;
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

    // Also include IDEX/Exploitant imports (stored in Consumption, not MeterReading).
    // They are reshaped as read-only "readings" so they display in the Relevés tab.
    const consumptions = await prisma.consumption.findMany({
      where: {
        siteId: { in: siteIds },
        source: "EXPLOITANT",
        organizationId: effectiveOrgId,
      },
      include: {
        site: { select: { name: true } },
      },
      orderBy: { period: "desc" },
      take: limit,
    });

    const energyTypeToFluid = (energyType: string, usage: string): string => {
      switch (energyType) {
        case "GAZ": return "GAZ";
        case "ELECTRICITE": return "ELECTRICITE";
        case "FIOUL": return "FIOUL";
        case "RESEAU_CHALEUR": return "CHALEUR";
        case "EAU": return usage === "ECS" ? "EAU_CHAUDE" : "EAU_FROIDE";
        case "BOIS": return "FIOUL";
        default: return "GAZ";
      }
    };

    const importRows = consumptions.map((c) => ({
      id: `imp_${c.id}`,
      readingDate: c.periodEnd ?? c.period,
      indexValue: null,
      consumption: c.quantity,
      unit: c.unit,
      consumptionConverted: null,
      unitConverted: null,
      notes: null,
      isImport: true,
      meter: {
        id: `imp_${c.id}`,
        name: c.meterName ?? "Import exploitant",
        fluid: energyTypeToFluid(c.energyType, c.usage),
        unit: c.unit,
        siteId: c.siteId,
        site: { name: c.site.name },
      },
      previous: null,
    }));

    return NextResponse.json([...enriched, ...importRows]);
  } catch (error) {
    console.error("Error fetching contract readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}

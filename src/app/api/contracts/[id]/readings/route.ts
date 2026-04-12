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
    const enriched = await Promise.all(
      readings.map(async (r) => {
        const prev = await prisma.meterReading.findFirst({
          where: {
            meterId: r.meterId,
            readingDate: { lt: r.readingDate },
            indexValue: { not: null },
          },
          orderBy: { readingDate: "desc" },
          select: { readingDate: true, indexValue: true },
        });

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

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching contract readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/heating-seasons/debug - Debug heating seasons dates
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const contractId = searchParams.get("contractId");

    if (!contractId) {
      return NextResponse.json(
        { error: "contractId requis" },
        { status: 400 }
      );
    }

    // Get all sites for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    const siteIds = contractSites.map(cs => cs.site.id);

    // Get heating seasons for these sites
    const heatingSeasons = await prisma.heatingSeason.findMany({
      where: {
        siteId: { in: siteIds },
      },
      include: {
        site: {
          select: {
            name: true,
            city: true,
          },
        },
      },
      orderBy: [
        { season: "desc" },
        { site: { name: "asc" } },
      ],
    });

    // Get last consumption date for each site
    const lastConsumptions = await prisma.consumption.groupBy({
      by: ["siteId"],
      where: {
        siteId: { in: siteIds },
      },
      _max: {
        period: true,
      },
    });

    const lastConsumptionMap = new Map(
      lastConsumptions.map(lc => [lc.siteId, lc._max.period])
    );

    // Format results for easy reading
    const results = heatingSeasons.map(hs => {
      const lastConsumption = lastConsumptionMap.get(hs.siteId);

      return {
        siteName: hs.site.name,
        city: hs.site.city,
        season: hs.season,
        startDate: hs.startDate ? hs.startDate.toISOString().split("T")[0] : null,
        endDate: hs.endDate ? hs.endDate.toISOString().split("T")[0] : null,
        lastReleveDate: hs.lastReleveDate ? hs.lastReleveDate.toISOString().split("T")[0] : null,
        lastConsumptionPeriod: lastConsumption ? lastConsumption.toISOString().split("T")[0] : null,
        nb: hs.nb,
        nbUnit: hs.nbUnit,
        djuContractuel: hs.djuContractuel,
      };
    });

    return NextResponse.json({
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Error fetching heating seasons debug:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données de debug" },
      { status: 500 }
    );
  }
}

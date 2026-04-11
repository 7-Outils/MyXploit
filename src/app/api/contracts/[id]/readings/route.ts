import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

/**
 * GET /api/contracts/[id]/readings - List recent meter readings for all sites of a contract
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

    // Get site IDs for this contract
    const contractSites = await prisma.contractSite.findMany({
      where: { contractId },
      select: { siteId: true },
    });

    if (contractSites.length === 0) {
      return NextResponse.json([]);
    }

    const siteIds = contractSites.map((cs) => cs.siteId);

    // Fetch meter readings with meter + site info
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
            name: true,
            fluid: true,
            unit: true,
            site: { select: { name: true } },
          },
        },
      },
      orderBy: { readingDate: "desc" },
      take: limit,
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error("Error fetching contract readings:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des relevés" },
      { status: 500 }
    );
  }
}

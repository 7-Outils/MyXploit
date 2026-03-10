import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";

// GET /api/sites/[id]/contracts - List all contracts for a site
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: siteId } = await params;

    // Verify site belongs to organization
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        organizationId: effectiveOrgId,
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site non trouvé" },
        { status: 404 }
      );
    }

    const contractSites = await prisma.contractSite.findMany({
      where: { siteId },
      select: {
        id: true,
        contractType: true,
        hasP1: true,
        hasP2: true,
        hasP3: true,
        hasP4: true,
        amountP1: true,
        amountP2: true,
        amountP3: true,
        coefficientPCS: true,
        integrationDate: true,
        exitDate: true,
        contract: {
          select: {
            id: true,
            reference: true,
            title: true,
            provider: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ contractSites });
  } catch (error) {
    console.error("Error fetching contracts for site:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contrats du site" },
      { status: 500 }
    );
  }
}
